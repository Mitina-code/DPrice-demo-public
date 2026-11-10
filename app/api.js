// The console's API on the public site: the product's own client
// (server-api.js, a copy of DPrice-platform/ui/api.js) talking to the real
// DPrice server that runtime.js runs inside the visitor's browser. Every
// feature works as on the server version; the visitor's data stays in their
// browser.
//
// What this module adds on top of the product client:
// - the site's own sign-in gate (issued accounts in ./users.json, SHA-256
//   fingerprints of «login:password», or a visitor registered on the landing);
//   once it passes, the in-browser server signs in its seeded manager account;
// - the demo regions (World, UAE, Saudi Arabia, Thailand, India): the demo
//   projects (external id demo26-<region>-…) of the chosen region are listed,
//   the visitor's own projects are listed in every region;
// - «hide demo projects», a choice kept in this browser.
import { CONFIG } from './demo-config.js?v=202611101651';
// Starting the in-browser server begins with this import; its state is exposed
// for the console (e.g. to say the engine is still loading).
export { engineReady, engineState } from './runtime.js?v=202611101651';
import * as server from './server-api.js?v=202611101651';

export * from './server-api.js?v=202611101651';

export const OFFLINE = false;
export const PUBLIC_EDITION = true;
export const GATE_LOGIN = true;

const ApiError = server.ApiError;

// The seeded account the in-browser server opens for every visitor (synthetic
// demo organisation; DPrice-platform/src/dprice/store/seed.py).
const BROWSER_ACCOUNT = { email: 'manager@dprice.demo', password: 'manager-demo' };

// --- visitor-local memory ---------------------------------------------------
const STORE = 'dprice-demo:';
function remember(key, value) {
  try {
    window.localStorage.setItem(STORE + key, JSON.stringify(value));
  } catch {
    // Storage blocked: the choice applies to this visit only.
  }
}
function recall(key, fallback) {
  try {
    const raw = window.localStorage.getItem(STORE + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// --- region -------------------------------------------------------------
// The landing passes its own region codes; its default «World» opens the
// product on the UAE, the product's default; World stays one pick away.
const LANDING_REGION = { global: 'uae', gulf: 'uae' };
function initialRegion() {
  const asked = new URLSearchParams(window.location.search).get('region');
  const mapped = LANDING_REGION[asked] || asked;
  if (CONFIG.regions.includes(mapped)) return mapped;
  const saved = recall('region', null);
  return CONFIG.regions.includes(saved) ? saved : CONFIG.regions[0];
}
let region = initialRegion();
remember('region', region);

export function regionOptions() {
  return CONFIG.regions;
}
export function setRegion(next) {
  if (!CONFIG.regions.includes(next)) return;
  region = next;
  remember('region', next);
}
export function currentRegion() {
  return region;
}

// --- demo on/off ----------------------------------------------------------
export function demoEnabled() {
  return recall('enabled', true) !== false;
}
export function setDemoEnabled(enabled) {
  remember('enabled', Boolean(enabled));
}
export function connectProjectUrl(lang) {
  const params = new URLSearchParams({ lang: lang === 'ru' ? 'ru' : 'en', region: CONFIG.landingRegion[region] || 'global' });
  return `${CONFIG.landing}?${params}#contact`;
}
export function landingUrl(lang) {
  return `${CONFIG.landing}?lang=${lang === 'ru' ? 'ru' : 'en'}`;
}

// A demo project belongs to the regions whose countries include its own; a
// project the visitor added is shown everywhere.
const DEMO_PROJECT = /^demo26-([a-z]+)-/;
export function projectVisible(item) {
  const demo = DEMO_PROJECT.exec(String(item?.project_external_id || ''));
  if (!demo) return true;
  if (!demoEnabled()) return false;
  return (CONFIG.parts?.[region] || [region]).includes(demo[1]);
}

export async function activeInventory() {
  const payload = await server.activeInventoryAll();
  if (!Array.isArray(payload?.items)) return payload;
  return { ...payload, items: payload.items.filter(projectVisible) };
}

// --- the site's sign-in gate ----------------------------------------------
let users = null;
async function issuedUsers() {
  if (!users) {
    users = window.fetch(new URL('./users.json', import.meta.url))
      .then((response) => (response.ok ? response.json() : { users: [] }))
      .catch(() => ({ users: [] }));
  }
  return (await users).users || [];
}
async function fingerprint(loginName, password) {
  const bytes = new TextEncoder().encode(`${loginName.trim().toLowerCase()}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function gateSignedIn() {
  const current = recall('session', null);
  if (!current?.login) return false;
  if (current.login.startsWith('registered:')) return true;
  return (await issuedUsers()).some((user) => user.login === current.login);
}

// --- the in-browser server's session ----------------------------------------
// Plain envelope calls that never trigger the console's «session expired»
// path: the gate, not the server, decides when the visitor must sign in.
// While the engine starts, runtime.js holds the request and shows its notice.
async function envelopeCall(path, body) {
  let response;
  try {
    response = await window.fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('x_internal_error', {}, 0);
  }
  let env = null;
  try {
    env = await response.json();
  } catch {
    throw new ApiError('x_internal_error', {}, response.status);
  }
  if (!env || env.ok !== true) {
    const error = env?.error || {};
    throw new ApiError(error.key || 'x_internal_error', error.params || {}, response.status);
  }
  return env.data;
}

let serverLogin = null;
function signInServer() {
  if (!serverLogin) {
    serverLogin = envelopeCall('/api/command/login', BROWSER_ACCOUNT).catch((error) => {
      serverLogin = null;
      throw error;
    });
  }
  return serverLogin;
}

async function serverSession() {
  try {
    return await envelopeCall('/api/command/session');
  } catch (error) {
    if (error?.status !== 401) throw error;
    serverLogin = null;
    return signInServer();
  }
}

export async function session() {
  if (!(await gateSignedIn())) throw new ApiError('x_session_expired', {}, 401);
  return serverSession();
}

export async function login(loginName, password) {
  const name = String(loginName || '').trim().toLowerCase();
  const hash = await fingerprint(name, String(password || ''));
  if (!(await issuedUsers()).some((user) => user.login === name && user.hash === hash)) {
    throw new ApiError('x_invalid_credentials', {}, 401);
  }
  remember('session', { login: name, at: new Date().toISOString() });
  serverLogin = null;
  return signInServer();
}

export async function logout() {
  remember('session', null);
  try {
    await envelopeCall('/api/command/logout');
  } catch {
    // The visitor leaves either way.
  }
  serverLogin = null;
  window.location.href = CONFIG.landing;
  return {};
}
