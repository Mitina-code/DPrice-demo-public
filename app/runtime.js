// The DPrice server running in the visitor's browser.
//
// The site has no server of its own: the product's real Python server
// (FastAPI, the same code as platform.dprice.ru) runs in a Web Worker through
// Pyodide, with the visitor's own database kept in this browser (IndexedDB).
// This module starts that worker once and answers every same-origin /api/
// request the console makes with it: the request (method, headers, body —
// JSON or a multipart workbook upload) goes to the worker as an ASGI call and
// comes back as an ordinary Response. Nothing leaves the browser.

const API = '/api/';
const TEXT = {
  en: {
    title: 'Starting DPrice in your browser',
    python: 'Loading the calculation engine…',
    packages: 'Loading components…',
    source: 'Loading DPrice…',
    database: 'Opening your data…',
    server: 'Starting the server…',
    first: 'The first start downloads about 18 MB and takes a little longer. Your projects and data stay in this browser.',
    failed: 'DPrice could not start in this browser. Reload the page or try another browser.',
  },
  ru: {
    title: 'Запускаем DPrice в вашем браузере',
    python: 'Загружаем расчётное ядро…',
    packages: 'Загружаем компоненты…',
    source: 'Загружаем DPrice…',
    database: 'Открываем ваши данные…',
    server: 'Запускаем сервер…',
    first: 'Первый запуск загружает около 18 МБ и занимает чуть больше времени. Ваши проекты и данные остаются в этом браузере.',
    failed: 'DPrice не удалось запустить в этом браузере. Обновите страницу или откройте другой браузер.',
  },
};

const nativeFetch = window.fetch.bind(window);
const worker = new Worker(new URL('./engine/worker.js?v=202611111353', import.meta.url), { type: 'module' });
const pending = new Map();
let nextId = 1;
let stage = 'python';
let state = 'starting'; // starting | ready | failed
let waiting = 0;
let failure = null;
let resolveReady;
let rejectReady;
const readyPromise = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});
readyPromise.catch(() => {});
export const timings = { requested: performance.now() };

worker.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'stage') {
    stage = message.stage;
    paintOverlay();
  } else if (message.type === 'ready') {
    state = 'ready';
    Object.assign(timings, message, { readyAt: performance.now() });
    resolveReady(message);
    paintOverlay();
  } else if (message.type === 'failed') {
    state = 'failed';
    failure = message.message;
    console.error('DPrice engine failed to start:', failure);
    rejectReady(new Error(failure));
    paintOverlay();
  } else if (message.type === 'response') {
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id);
    if (message.error) job.reject(new TypeError(`DPrice engine: ${message.error}`));
    else job.resolve(message);
  }
};
worker.onerror = (event) => {
  if (state !== 'starting') return;
  state = 'failed';
  failure = event.message || 'worker error';
  rejectReady(new Error(failure));
  paintOverlay();
};

export function engineReady() {
  return readyPromise;
}
export function engineState() {
  return state;
}

// --- the loading notice ---------------------------------------------------
let overlay = null;
function lang() {
  return String(document.documentElement.lang || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
function paintOverlay() {
  const show = (state === 'starting' && waiting > 0) || state === 'failed';
  if (!show) {
    overlay?.remove();
    overlay = null;
    return;
  }
  const text = TEXT[lang()];
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'engine-loading';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    document.body.append(overlay);
  }
  const card = document.createElement('div');
  card.className = 'engine-loading-card';
  const title = document.createElement('strong');
  title.textContent = state === 'failed' ? 'DPrice' : text.title;
  const line = document.createElement('span');
  line.textContent = state === 'failed' ? text.failed : text[stage] || text.python;
  card.append(title, line);
  if (state === 'starting') {
    const bar = document.createElement('span');
    bar.className = 'engine-loading-bar';
    const note = document.createElement('small');
    note.textContent = text.first;
    card.append(bar, note);
  }
  overlay.replaceChildren(card);
}

// --- the fetch interceptor ------------------------------------------------
function isApi(url) {
  return url.origin === window.location.origin && url.pathname.startsWith(API);
}

async function serve(request) {
  const url = new URL(request.url);
  const body = ['GET', 'HEAD'].includes(request.method) ? new ArrayBuffer(0) : await request.arrayBuffer();
  const headers = [...request.headers.entries()];
  if (state !== 'ready') {
    waiting += 1;
    paintOverlay();
    try {
      await readyPromise;
    } finally {
      waiting -= 1;
      paintOverlay();
    }
  }
  const id = nextId++;
  const reply = await new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({
      type: 'request', id, method: request.method, path: url.pathname,
      query: url.search.slice(1), headers, body,
    }, [body]);
  });
  const empty = [101, 204, 205, 304].includes(reply.status) || request.method === 'HEAD';
  return new Response(empty ? null : reply.body, { status: reply.status, headers: reply.headers });
}

window.fetch = function fetchThroughEngine(input, init) {
  let request;
  try {
    request = new Request(input, init);
  } catch {
    return nativeFetch(input, init);
  }
  if (!isApi(new URL(request.url))) return nativeFetch(input, init);
  return serve(request);
};

// For support and checks: the engine's state and start-up timings.
window.dpriceEngine = { timings, state: engineState };
