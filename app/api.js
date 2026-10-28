// Offline API for the serverless DPrice demo. It replaces the console's
// server client (ui/api.js in DPrice-platform) with reads of pre-computed
// demo data: one JSON file per region in ./fixtures/, captured from the real
// DPrice engine by DPrice-platform/tools/capture_demo.mjs. Nothing is sent to
// any server. Recommendation decisions and the «hide demo projects» choice are
// kept in the visitor's browser only; if the browser refuses storage, the demo
// simply opens with the demo projects.
import { CONFIG } from './demo-config.js';

export const OFFLINE = true;

export class ApiError extends Error {
  constructor(key, params = {}, status = 0) {
    super(key);
    this.key = key;
    this.params = params;
    this.status = status;
  }
}

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
// The landing passes its own region codes; map them onto the demo regions
// (older links still carry the former single-country codes). The landing's
// default «World» opens the product on the UAE, the product's default; World
// stays one pick away, last in the list.
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

// --- data -----------------------------------------------------------------
// Demo files store repeated pieces once ({"$r": n} points into `table`).
function expand(file) {
  if (file?.format !== 'dprice-demo-interned-1') return file;
  const cache = [];
  const resolve = (node) => {
    if (node === null || typeof node !== 'object') return node;
    if (!Array.isArray(node) && Object.keys(node).length === 1 && '$r' in node) {
      const i = node.$r;
      if (!(i in cache)) cache[i] = resolve(file.table[i]);
      return cache[i];
    }
    return Array.isArray(node) ? node.map(resolve)
      : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolve(v)]));
  };
  return resolve(file.root);
}

// A demo region shows the captured data of one or more countries
// (CONFIG.parts, e.g. World = every country); project ids never repeat
// across countries, so their projects simply sit side by side.
function regionData(which = region) {
  const parts = CONFIG.parts?.[which] || [which];
  if (parts.length === 1) return countryData(parts[0]);
  return Promise.all(parts.map(countryData)).then((all) => ({
    ...all[0],
    region: which,
    active: { ...all[0].active, items: all.flatMap((data) => data.active.items) },
    projects: Object.assign({}, ...all.map((data) => data.projects)),
  }));
}

const loaded = new Map();
function countryData(which) {
  if (!loaded.has(which)) {
    loaded.set(which, fetch(new URL(`./fixtures/${which}.json`, import.meta.url))
      .then((response) => {
        if (!response.ok) throw new ApiError('offline_unavailable');
        return response.json();
      })
      .then(expand)
      .catch((error) => {
        loaded.delete(which);
        throw error instanceof ApiError ? error : new ApiError('offline_unavailable');
      }));
  }
  return loaded.get(which);
}

const clone = (value) => {
  if (value === undefined) throw new ApiError('offline_unavailable');
  return JSON.parse(JSON.stringify(value));
};

async function projectData(id) {
  const data = await regionData();
  const project = data.projects[String(id)];
  if (!project) throw new ApiError('offline_unavailable');
  return project;
}

async function captured(id, options = {}) {
  const project = await projectData(id);
  const record = project.algorithms[options.algorithm || 'dco-neutral'];
  if (!record) throw new ApiError('offline_unavailable');
  return { project, record };
}

// Writes the demo cannot make (uploads, new calculations) say so plainly.
const readonly = async () => {
  throw new ApiError('offline_readonly');
};

const READONLY_CAPABILITIES = /import|snapshot_create|run|upload|activation/;
function demoCapabilities(capabilities = {}) {
  const result = clone(capabilities);
  for (const [key, value] of Object.entries(result)) {
    if (READONLY_CAPABILITIES.test(key) && value && typeof value === 'object') {
      value.allowed = false;
    }
  }
  return result;
}

// --- decisions kept in the browser ---------------------------------------
function decisionKey(unitId, recommendation) {
  const lineage = recommendation?.lineage || {};
  return `${region}:${unitId}:${lineage.snapshot_id}:${lineage.result_id}`;
}
function decisions() {
  return recall('decisions', {});
}
// A visitor's decision is shown exactly like a server-recorded one: the
// recommendation carries a decision receipt tied to the same calculation.
function withDecision(row) {
  const recommendation = row?.recommendation;
  if (!recommendation || recommendation.state !== 'ready') return row;
  const stored = decisions()[decisionKey(row.unit_id, recommendation)];
  if (!stored) return row;
  const verdict = typeof stored === 'string' ? stored : stored.verdict;
  recommendation.state = verdict;
  recommendation.decision = {
    id: `browser-${row.unit_id}`,
    verdict,
    decided_by_user_id: 'demo',
    decided_at_utc: stored.at || null,
    target_absolute_scaled: recommendation.target_absolute_scaled,
    lineage: { ...(recommendation.lineage || {}) },
  };
  return row;
}

// --- filtering, ordering, paging (same rules as the server) ---------------
const same = (left, right) => String(left) === String(right);
function matches(row, filters = {}) {
  return Object.entries(filters).every(([key, value]) => {
    if (value === '' || value == null) return true;
    const h = row.hierarchy || {};
    switch (key) {
      case 'identity':
        return [row.unit_number, row.unit_external_id]
          .some((text) => String(text || '').toLocaleLowerCase().includes(String(value).toLocaleLowerCase()));
      case 'phase': case 'building': case 'section': case 'floor':
      case 'phase_id': case 'building_id': case 'section_id': case 'floor_id':
        return same(h[key], value);
      case 'property_type': case 'rooms_value': return same(row[key], value);
      case 'commercial_status': return same(row.commercial?.display_state, value);
      case 'manual_control': return same(row.commercial?.manual_control, value);
      case 'readiness': return same(row.readiness?.state, value);
      case 'calculation_readiness': return same(row.readiness?.calculation?.state, value);
      case 'recommendation_state': return value === 'any'
        ? ['ready', 'accepted', 'declined'].includes(row.recommendation?.state)
        : same(row.recommendation?.state, value);
      case 'price_group_id': return (row.pricing_inputs?.groups || []).some((g) => same(g.group_id, value));
      case 'area_min_scaled': return Number(row.sellable_area_scaled) >= Number(value);
      case 'area_max_scaled': return Number(row.sellable_area_scaled) <= Number(value);
      case 'price_min_scaled': return row.price?.absolute_scaled != null && Number(row.price.absolute_scaled) >= Number(value);
      case 'price_max_scaled': return row.price?.absolute_scaled != null && Number(row.price.absolute_scaled) <= Number(value);
      default: return true;
    }
  });
}
function orderValue(row, key) {
  const h = row.hierarchy || {};
  const target = row.recommendation?.target_absolute_scaled;
  const price = row.price?.absolute_scaled;
  const values = {
    unit_number: row.unit_number, phase: h.phase_name, building: h.building_name,
    section: h.section_name, floor: h.floor_number, stack: h.stack_code,
    property_type: row.property_type, rooms: row.rooms_value,
    area: Number(row.sellable_area_scaled), commercial_status: row.commercial?.display_state,
    price: price == null ? null : Number(price),
    recommended_price: target == null ? null : Number(target),
    recommendation_delta: target == null || price == null ? null : Number(target) / Number(price) - 1,
    manual_control: Number(row.commercial?.manual_control),
  };
  return values[key];
}
function paginate(source = { items: [] }, options = {}) {
  const result = clone(source);
  const offset = options.offset || 0;
  const limit = options.limit || result.limit || 25;
  result.items = result.items.slice(offset, offset + limit);
  result.total = source.items.length;
  result.count = result.items.length;
  result.offset = offset;
  result.limit = limit;
  result.has_more = offset + limit < result.total;
  return result;
}

// --- the console's API, offline ------------------------------------------
export function onSessionExpired() {}
export function supersedeInflightViews() {}

// --- demo sign-in -----------------------------------------------------------
// Only accounts issued in ./users.json open the demo (MVP gate: the list holds
// SHA-256 fingerprints of «login:password», never the passwords). A visitor who
// registers on the landing is let in without a password.
let users = null;
async function issuedUsers() {
  if (!users) {
    users = fetch(new URL('./users.json', import.meta.url))
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
async function signedIn() {
  const current = recall('session', null);
  if (!current?.login) return false;
  if (current.login.startsWith('registered:')) return true;
  return (await issuedUsers()).some((user) => user.login === current.login);
}

export function landingUrl(lang) {
  return `${CONFIG.landing}?lang=${lang === 'ru' ? 'ru' : 'en'}`;
}

export async function session() {
  if (!(await signedIn())) throw new ApiError('x_session_expired', {}, 401);
  const data = await regionData();
  return clone(data.session);
}
export async function login(loginName, password) {
  const name = String(loginName || '').trim().toLowerCase();
  const hash = await fingerprint(name, String(password || ''));
  if (!(await issuedUsers()).some((user) => user.login === name && user.hash === hash)) {
    throw new ApiError('x_invalid_credentials', {}, 401);
  }
  remember('session', { login: name, at: new Date().toISOString() });
  const data = await regionData();
  return clone(data.session);
}
export async function logout() {
  remember('session', null);
  window.location.href = CONFIG.landing;
  return {};
}

export async function activeInventoryAll() {
  const data = await regionData();
  const payload = clone(data.active);
  payload.capabilities = demoCapabilities(payload.capabilities);
  if (!demoEnabled()) payload.items = [];
  return payload;
}
export const activeInventory = activeInventoryAll;

export async function operationalSurfaces(id, options = {}) {
  const { record } = await captured(id, options);
  const surfaces = clone(record.surfaces);
  countBrowserDecisions(surfaces, record.units?.items || []);
  return surfaces;
}

// The captured counters know only the server's decisions; every decision kept
// in this browser moves one unit from «awaiting» to «accepted» or «declined».
function countBrowserDecisions(surfaces, units) {
  const deal = surfaces?.deal_price;
  if (!deal) return;
  const move = (counts, verdict) => {
    if (!counts || counts.pending == null) return;
    counts.pending = Math.max(0, Number(counts.pending) - 1);
    counts[verdict] = Number(counts[verdict] || 0) + 1;
  };
  for (const unit of units) {
    if (unit.recommendation?.state !== 'ready') continue;
    const verdict = withDecision(clone(unit)).recommendation.state;
    if (verdict === 'ready') continue;
    move(deal.recommendation?.decision_counts, verdict);
    const groups = new Set((unit.pricing_inputs?.groups || []).map((g) => String(g.group_id)));
    for (const group of deal.groups || []) {
      if (groups.has(String(group.group_id))) move(group.decision_counts, verdict);
    }
  }
}

export async function inventoryProjectUnits(id, options = {}) {
  const { record } = await captured(id, options);
  const result = clone(record.units);
  result.items.forEach(withDecision);
  const filters = options.filters || {};
  const sort = options.sort || 'unit_number';
  const direction = options.direction || 'asc';
  const rows = result.items.filter((row) => matches(row, filters));
  rows.sort((a, b) => {
    const left = orderValue(a, sort);
    const right = orderValue(b, sort);
    const cmp = left == null ? (right == null ? 0 : 1) : right == null ? -1
      : typeof left === 'number' ? left - right
        : String(left).localeCompare(String(right), 'en', { numeric: true });
    return (cmp || Number(a.unit_id) - Number(b.unit_id)) * (direction === 'desc' ? -1 : 1);
  });
  const size = options.pageSize || 50;
  const page = options.page || 1;
  result.total = rows.length;
  result.offset = (page - 1) * size;
  result.limit = size;
  result.items = rows.slice(result.offset, result.offset + size);
  result.count = result.items.length;
  result.has_more = result.offset + size < result.total;
  result.applied = { ...result.applied, filters, sort, direction, page, page_size: size, limit: size, offset: result.offset };
  if (result.reconciliation) result.reconciliation.filtered_units = result.total;
  return result;
}

export async function inventoryProjectChessboard(id, sectionId, options = {}) {
  const { record } = await captured(id, options);
  const board = clone(record.boards[String(sectionId)]);
  const filters = { ...(options.filters || {}) };
  delete filters.section;
  delete filters.section_id;
  const rows = clone(record.units.items).map(withDecision);
  const ids = new Set(rows.filter((row) => matches(row, filters)).map((row) => row.unit_id));
  let hidden = 0;
  for (const cell of board.cells || []) {
    if (cell.unit && !ids.has(cell.unit.unit_id)) {
      // The server's shape for a unit hidden by filters, plus its number.
      cell.type = 'filtered';
      cell.unit_number = cell.unit.unit_number;
      cell.unit = null;
      hidden += 1;
    } else if (cell.unit) {
      withDecision(cell.unit);
    }
  }
  if (board.counts) {
    board.counts.visible_units = new Set((board.cells || []).filter((c) => c.unit).map((c) => c.unit.unit_id)).size;
    board.counts.filtered_occupied = hidden;
  }
  if (board.applied) board.applied.filters = filters;
  return board;
}

export async function inventoryProjectBuildingChessboard(id, sections, options = {}) {
  const boards = [];
  for (const section of sections || []) boards.push(await inventoryProjectChessboard(id, section?.id ?? section, options));
  return boards;
}

export async function inventoryProjectUnitDetail(id, unitId, options = {}) {
  const { project, record } = await captured(id, options);
  const base = project.algorithms['dco-neutral'].details[String(unitId)];
  const detail = clone({ ...base, ...(record.details[String(unitId)] || {}) });
  withDecision({ unit_id: unitId, recommendation: detail.recommendation });
  const offset = options.historyOffset || 0;
  const limit = options.historyLimit || 100;
  for (const key of ['price_history', 'commercial_history']) {
    if (Array.isArray(detail.history?.[key])) detail.history[key] = detail.history[key].slice(offset, offset + limit);
  }
  if (detail.history) {
    detail.history.offset = offset;
    detail.history.limit = limit;
  }
  return detail;
}

export async function inventoryUnitHistory(unitId, options = {}) {
  throw new ApiError('offline_unavailable', { unitId, options });
}

export async function listCalculationSnapshots(id, options = {}) {
  const project = await projectData(id);
  return paginate(project.snapshots, options);
}

export async function inspectCalculationSnapshot(id, snapshotId, options = {}) {
  const project = await projectData(id);
  const result = clone(project.snapshot_details[String(snapshotId)]);
  const offset = options.resultOffset || 0;
  const limit = options.resultLimit || 25;
  const total = (result.results || []).length;
  result.results = (result.results || []).slice(offset, offset + limit);
  result.result_pagination = { total, count: result.results.length, offset, limit, has_more: offset + limit < total };
  return result;
}

export async function recordInventoryRecommendationDecision(id, { unitId, snapshotId, resultId, verdict }) {
  if (!['accepted', 'declined'].includes(verdict)) throw new ApiError('x_invalid_input');
  const all = decisions();
  all[`${region}:${unitId}:${snapshotId}:${resultId}`] = { verdict, at: new Date().toISOString() };
  remember('decisions', all);
  return { verdict, unit_id: String(unitId), project_id: String(id), stored: 'browser' };
}

export async function myProductFeedback() {
  return { items: [], total: 0, count: 0, limit: 100, offset: 0, has_more: false };
}

// Everything that would change data on a server is unavailable in the demo.
export const uploadWorkbook = readonly;
export const confirmImportActivation = readonly;
export const activateImport = readonly;
export const createCalculationSnapshot = readonly;
export const runCalculationSnapshotDco = readonly;
export const runCalculationSnapshotContractEvidence = readonly;
export const runCalculationSnapshotBaselineDemand = readonly;
export const saveDealTerms = readonly;
export const submitProductFeedback = readonly;
export const dataWorkspace = readonly;
export const importHistory = readonly;
export const importReview = readonly;
export const inventoryVersionHistory = readonly;
export const apiCall = readonly;
export const view = readonly;
export const command = readonly;
export const unitDecision = readonly;
export const groupApproval = readonly;
export const strategySwitch = readonly;
export const scenarioSave = readonly;
export const productLoopWorkspace = readonly;
export const productLoopFeedback = readonly;
export const saveProductChangePlan = readonly;
export const requestProductChangePreparation = readonly;
export const retryProductChangePreparation = readonly;
export const startProductChangeDevelopment = readonly;
export const cancelProductChangeDevelopment = readonly;
export const retryProductChangeDevelopment = readonly;
export const confirmProductChangeDevelopmentClass = readonly;
export const productChangeDevelopmentRun = readonly;
export const recordProductChangeResult = readonly;
