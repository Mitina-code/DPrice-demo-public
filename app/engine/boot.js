// Start the DPrice server inside Pyodide. Shared by the browser worker
// (engine-worker.js) and the Node check (tools/check_runtime.mjs).
//
//   const engine = await bootEngine({ loadPyodide, base, persistent, onStage });
//   const { status, headers, body } = await engine.handle(method, path, query, headers, bodyBytes);
//
// `base` is the URL of the folder holding runtime/ (Pyodide, wheels, the dprice
// source bundle and the starting database) and engine/engine.py.
import { scryptRomix } from './scrypt.js?v=202611111555';

// Packages from the Pyodide lock (their dependencies come along).
const LOCK_PACKAGES = ['fastapi', 'pydantic', 'tzdata'];

async function bytesOf(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function bootEngine({
  loadPyodide, base, persistent = false, onStage = () => {}, fetchImpl = fetch, pyodideOptions = {},
}) {
  const at = (rel) => new URL(rel, base).href;
  // The manifest is revalidated on every start; each runtime file it lists is
  // asked for by its content hash, so a new release never meets a stale cache.
  const manifest = await (await fetchImpl(at('runtime/MANIFEST.json'), { cache: 'no-cache' })).json();
  const file = (rel) => `${at(`runtime/${rel}`)}?v=${(manifest.files[rel]?.sha256 || '').slice(0, 12)}`;
  const timings = {};
  let t = performance.now();
  const lap = (name) => {
    const now = performance.now();
    timings[name] = Math.round(now - t);
    t = now;
  };

  onStage('python');
  const py = await loadPyodide({ indexURL: at('runtime/pyodide/'), ...pyodideOptions });
  lap('python');

  onStage('packages');
  const wheels = Promise.all(manifest.wheels.map((name) => bytesOf(file(`wheels/${name}`), fetchImpl)));
  const source = bytesOf(file('dprice-src.json.gz'), fetchImpl);
  const engineCode = fetchImpl(at('./engine/engine.py'), { cache: 'no-cache' }).then((r) => r.text());
  await py.loadPackage(LOCK_PACKAGES, { messageCallback: () => {} });
  for (const wheel of await wheels) py.unpackArchive(wheel, 'wheel');
  lap('packages');

  onStage('source');
  const files = JSON.parse(new TextDecoder().decode(await gunzip(await source)));
  for (const [rel, text] of Object.entries(files)) {
    const target = `/app/src/${rel}`;
    py.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
    py.FS.writeFile(target, text);
  }
  lap('source');

  onStage('database');
  const FS = py.FS;
  FS.mkdirTree('/app/var');
  const sync = (populate) => new Promise((resolve, reject) => {
    FS.syncfs(populate, (error) => (error ? reject(error) : resolve()));
  });
  if (persistent) {
    FS.mount(FS.filesystems.IDBFS, {}, '/app/var');
    await sync(true);
  }
  const dbPath = '/app/var/prod.db';
  let firstVisit = false;
  if (!FS.analyzePath(dbPath).exists) {
    firstVisit = true;
    FS.writeFile(dbPath, await gunzip(await bytesOf(file('start-db.sqlite.gz'), fetchImpl)));
  }
  lap('database');

  onStage('server');
  globalThis.dpriceScryptRomix = scryptRomix;
  py.globals.set('DPRICE_SESSION_SECRET', randomSecret());
  py.runPython(`
import os
os.environ['DPRICE_ENV'] = 'prod'
os.environ['DPRICE_SESSION_SECRET'] = DPRICE_SESSION_SECRET
del DPRICE_SESSION_SECRET
`);
  await py.runPythonAsync(await engineCode, { filename: '/app/engine.py' });
  const handlePy = py.globals.get('handle');
  lap('server');
  if (persistent) await sync(false);

  // Writes reach IndexedDB one sync at a time; a request arriving during a
  // sync waits for the next one.
  let syncing = null;
  let again = false;
  async function persist() {
    if (!persistent) return;
    if (syncing) {
      again = true;
      return syncing;
    }
    syncing = (async () => {
      do {
        again = false;
        await sync(false);
      } while (again);
    })().finally(() => {
      syncing = null;
    });
    return syncing;
  }

  async function handle(method, path, query, headers, body) {
    const result = await handlePy(method, path, query || '', headers || [], body || new Uint8Array());
    const [status, outHeaders, outBody] = result;
    if (result.destroy) result.destroy();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase())) await persist();
    return { status, headers: outHeaders, body: outBody };
  }

  return { py, handle, persist, timings, firstVisit, manifest };
}
