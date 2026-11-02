// The DPrice server's own thread in the visitor's browser: Pyodide, the
// product's Python code and the visitor's database (IndexedDB) live here, so a
// calculation of several seconds never freezes the page. runtime.js sends
// each /api/ request here and receives the response. Requests are served one
// at a time, like a single server worker.
import { loadPyodide } from '../runtime/pyodide/pyodide.mjs';
import { bootEngine } from './boot.js?v=202611021218';

let engine = null;
const started = performance.now();
const ready = bootEngine({
  loadPyodide,
  base: new URL('../', import.meta.url).href,
  persistent: true,
  onStage: (stage) => postMessage({ type: 'stage', stage }),
}).then((booted) => {
  engine = booted;
  postMessage({
    type: 'ready', timings: booted.timings, firstVisit: booted.firstVisit,
    ms: Math.round(performance.now() - started), version: booted.manifest?.source?.version || null,
  });
}, (error) => {
  postMessage({ type: 'failed', message: String(error?.message || error).slice(0, 2000) });
});

async function serve(message) {
  const { id } = message;
  try {
    await ready;
    if (!engine) throw new Error('engine unavailable');
    const result = await engine.handle(message.method, message.path, message.query,
      message.headers, new Uint8Array(message.body || new ArrayBuffer(0)));
    const body = new Uint8Array(result.body).buffer;
    postMessage({ type: 'response', id, status: result.status, headers: result.headers, body }, [body]);
  } catch (error) {
    postMessage({ type: 'response', id, error: String(error?.message || error).slice(0, 2000) });
  }
}

let queue = Promise.resolve();
self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'request') queue = queue.then(() => serve(message));
};
