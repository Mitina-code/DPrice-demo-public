// The fetch client — the one place the UI speaks the envelope (AD-15).
//
// Every /api/* call is a POST that returns exactly one envelope:
//   success  { ok: true,  data }
//   failure  { ok: false, error: { key, params } }
// This client unwraps `data` on success and throws an ApiError carrying the
// machine `key` on failure, so callers branch on a stable key, never on prose.
//
// The closed door (FR-1): a 401 x_session_expired on any call means the session
// is gone. Per UX-DR7 that maps to the «Вход» redirect — here, a registered
// handler the app sets to re-render login with «Сессия истекла, войдите снова».
// A login that fails with x_invalid_credentials is NOT a session expiry and does
// not trigger that path.

export class ApiError extends Error {
  constructor(key, params, status) {
    super(key);
    this.name = 'ApiError';
    this.key = key;
    this.params = params || {};
    this.status = status;
  }
}

let sessionExpiredHandler = null;

// Register what happens when a call returns 401 x_session_expired (the «Вход»
// redirect). The app sets this once at bootstrap.
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
}

// POST `body` to an /api/* `path`, returning the unwrapped envelope data or
// throwing ApiError. Same-origin credentials carry the session cookie.
export async function apiCall(path, body) {
  let resp;
  try {
    resp = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'same-origin',
    });
  } catch {
    // Network failure — surface the internal-error key; nothing reached us.
    throw new ApiError('x_internal_error', {}, 0);
  }

  let env = null;
  try {
    env = await resp.json();
  } catch {
    throw new ApiError('x_internal_error', {}, resp.status);
  }

  const err = (env && env.error) || {};
  if (resp.status === 401 && err.key === 'x_session_expired') {
    if (sessionExpiredHandler) {
      sessionExpiredHandler();
    }
    throw new ApiError('x_session_expired', err.params || {}, 401);
  }

  if (!env || env.ok !== true) {
    throw new ApiError(err.key || 'x_internal_error', err.params || {}, resp.status);
  }
  return env.data;
}

// --- the view fetch loop: per-tab sequence tokens, last-wins (AR-15) ---------

// A per-tab monotonic sequence token. Each browser tab runs its own module
// instance, so a module-level counter is per-tab by construction — no tab id is
// needed; the token is never persisted and resets on reload.
let viewSeq = 0;

// Fetch view `surface`, attaching the next sequence token the server echoes.
// Last-wins (AR-15): when the response resolves, if a newer view call has since
// been issued (`viewSeq` moved past this request's token), the payload is stale
// and dropped — it resolves to `null` — so a fast run of what-if changes can
// never render an older payload over a newer one. The echoed `data.seq` is the
// server's confirmation of the token it answered; a payload whose echo is not
// the latest token this tab issued is exactly the stale case.
export async function view(surface, body) {
  const seq = (viewSeq += 1);
  let data;
  try {
    data = await apiCall(`/api/view/${surface}`, { ...(body || {}), seq });
  } catch (err) {
    // Last-wins applies to failures too (AR-15): if a newer view call has since
    // been issued, this request is stale — drop it silently (resolve to null)
    // rather than let an older failure overwrite the newer payload with an error
    // banner. The 401 session-expiry redirect has already fired inside apiCall,
    // so swallowing the stale error here never masks an expiry.
    if (seq !== viewSeq) {
      return null;
    }
    throw err;
  }
  if (data.seq !== viewSeq) {
    return null; // a newer view call superseded this one — drop it (last-wins)
  }
  return data;
}

// Supersede any view request already in flight, without issuing one. A what-if
// edit whose own refresh is *deferred* (a debounced slider) calls this the moment
// it mutates the local term-set: advancing the token makes an older in-flight
// request's echo fail the `data.seq !== viewSeq` guard above and drop, exactly as
// a fresh view() call would. Without it, an older request resolving inside the
// debounce window is still "latest" (the deferred call has not incremented the
// token yet), so its `onAdopt` would overwrite the just-edited term-set with the
// stale echoed set and revert the slider (AR-15). The deferred refresh then issues
// from the freshly edited term-set and wins normally.
export function supersedeInflightViews() {
  viewSeq += 1;
}

// Invoke a product `command`; unwraps the envelope or throws ApiError. A 403
// x_requires_role (the permission seam, AD-8) surfaces as an ApiError the render
// layer turns into the danger note near the control (UX-DR3 defense-in-depth) —
// the server denies regardless of what the UI shows.
export function command(name, body) {
  return apiCall(`/api/command/${name}`, body || {});
}

// Accept or decline a unit's repricing recommendation (Story 4.2, AR-7). Carries
// only *what* was decided — the unit, its scope, and the verdict — and NEVER a
// price: the server recomputes the target and returns a fresh desk view-model.
// `decision` is 'accept' or 'decline'. The shared what-if term-set rides along (as
// every call does, AR-2) so the fresh payload echoes it back unchanged rather than
// the catalog defaults — without it the session-local terms would be lost. Unwraps
// the fresh payload or throws ApiError (a 403 x_requires_role surfaces as the note).
export function unitDecision({ unit, decision, market, project, termSet }) {
  return command('unit_decision', {
    unit,
    decision,
    market,
    project,
    term_set: termSet,
  });
}

// Approve a typology group's recommendations, or «Согласовать все» (Story 4.2, FR-23).
// Carries only the scope and — optionally — the group; NEVER a price. `group` absent
// means approve every pending recommendation. The shared what-if term-set rides along
// (AR-2) so the fresh payload preserves it. The server recomputes each unit's target
// and returns a fresh desk view-model. Director-only (a 403 surfaces as the danger note).
export function groupApproval({ group, market, project, termSet }) {
  return command('group_approval', {
    group,
    market,
    project,
    term_set: termSet,
  });
}

// Switch the org's active pricing strategy (Story 4.2, FR-36). Carries the new strategy
// key only; the server persists org-wide state, journals the change, and returns a fresh
// view-model under the new strategy. Director-only (a 403 surfaces as the danger note).
export function strategySwitch({ strategy, market, project }) {
  return command('strategy_switch', { strategy, market, project });
}

// Commit the current release scenario for the pricing committee (Story 4.3, FR-20).
// Carries the scenario's *inputs* only — the scope and the shared what-if term-set
// (which holds the release size / window / index / pack); NEVER its computed outcome.
// The server recomputes the outcome from the kernel, persists the scenario row and
// journals «Сценарий релиза зафиксирован…» in one transaction, and returns a fresh
// «Релиз» view-model. Manager-only (a 403 x_requires_role surfaces as the danger note).
export function scenarioSave({ market, project, termSet }) {
  return command('scenario_save', {
    market,
    project,
    term_set: termSet,
  });
}

// Convenience wrappers for the auth commands this story exposes.
export function login(email, password) {
  return apiCall('/api/command/login', { email, password });
}

export function logout() {
  return apiCall('/api/command/logout', {});
}

// Resolve the current session server-side: returns { role, landing, org_id }
// read back from the user id per request (AD-8), or throws x_session_expired
// when no valid session exists. The entry page intentionally does not use this
// to resume a role landing: each navigation requires fresh credentials.
export function session() {
  return apiCall('/api/command/session', {});
}

// Story 5.1 Data routes use bounded GET reads and a multipart upload while
// preserving the same envelope/session-expiry behavior as apiCall().
async function dataRequest(path, options = {}) {
  let resp;
  try {
    resp = await fetch(path, { credentials: 'same-origin', ...options });
  } catch {
    throw new ApiError('x_internal_error', {}, 0);
  }
  let env;
  try {
    env = await resp.json();
  } catch {
    throw new ApiError('x_internal_error', {}, resp.status);
  }
  const err = (env && env.error) || {};
  if (resp.status === 401 && err.key === 'x_session_expired') {
    if (sessionExpiredHandler) sessionExpiredHandler();
    throw new ApiError('x_session_expired', err.params || {}, 401);
  }
  if (!env || env.ok !== true) {
    throw new ApiError(err.key || 'x_internal_error', err.params || {}, resp.status);
  }
  return env.data;
}

// QF-003 product feedback and loop-admin workbench. Tenancy, actor, UTC and
// trusted plan hashes are never accepted from the client.
export function submitProductFeedback({ title, body, originatingSurface = null }) {
  return dataRequest('/api/product-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      body,
      originating_surface: originatingSurface,
    }),
  });
}

export function myProductFeedback({ limit = 100, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return dataRequest(`/api/product-feedback/mine?${query}`);
}

export function productLoopWorkspace({
  limit = 100, offset = 0, planLimit = 20, planOffset = 0,
} = {}) {
  const query = new URLSearchParams({
    limit: String(limit), offset: String(offset),
    plan_limit: String(planLimit), plan_offset: String(planOffset),
  });
  return dataRequest(`/api/product-loop?${query}`);
}

export function productLoopFeedback(feedbackId, {
  planLimit = 20, planOffset = 0,
} = {}) {
  const query = new URLSearchParams({
    plan_limit: String(planLimit), plan_offset: String(planOffset),
  });
  return dataRequest(
    `/api/product-loop/feedback/${encodeURIComponent(feedbackId)}?${query}`,
  );
}

export function saveProductChangePlan({
  planId = null, expectedRevision = null, feedbackIds, changeContent,
  readinessCriteria, risks = [], linkedLp = null,
}) {
  return dataRequest('/api/product-loop/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id: planId,
      expected_revision: expectedRevision,
      feedback_ids: feedbackIds,
      change_content: changeContent,
      readiness_criteria: readinessCriteria,
      risks,
      linked_lp: linkedLp,
    }),
  });
}

export function requestProductChangePreparation(feedbackId, {
  hint = null, sourceFeedbackIds = [],
} = {}) {
  return dataRequest(
    `/api/product-loop/feedback/${encodeURIComponent(feedbackId)}/preparations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hint: hint && hint.trim() ? hint.trim() : null,
        source_feedback_ids: sourceFeedbackIds,
      }),
    },
  );
}

export function retryProductChangePreparation(preparationId) {
  return dataRequest(
    `/api/product-loop/preparations/${encodeURIComponent(preparationId)}/retry`,
    { method: 'POST' },
  );
}

export function startProductChangeDevelopment(
  planId, { revisionNumber, confirmedClass },
) {
  return dataRequest(`/api/product-loop/plans/${encodeURIComponent(planId)}/development`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revision_number: revisionNumber,
      confirmed_class: confirmedClass,
    }),
  });
}

export function cancelProductChangeDevelopment(runId) {
  return dataRequest(
    `/api/product-loop/development-runs/${encodeURIComponent(runId)}/cancel`,
    { method: 'POST' },
  );
}

export function retryProductChangeDevelopment(runId) {
  return dataRequest(
    `/api/product-loop/development-runs/${encodeURIComponent(runId)}/retry`,
    { method: 'POST' },
  );
}

export function confirmProductChangeDevelopmentClass(runId) {
  return dataRequest(
    `/api/product-loop/development-runs/${encodeURIComponent(runId)}/confirm-class`,
    { method: 'POST' },
  );
}

export function productChangeDevelopmentRun(
  runId, { eventLimit = 50, eventAfterSequence = 0 } = {},
) {
  const query = new URLSearchParams({
    event_limit: String(eventLimit),
    event_after_sequence: String(eventAfterSequence),
  });
  return dataRequest(
    `/api/product-loop/development-runs/${encodeURIComponent(runId)}?${query}`,
  );
}

export function recordProductChangeResult(planId, {
  revisionNumber, summary, evidence = null,
}) {
  return dataRequest(`/api/product-loop/plans/${encodeURIComponent(planId)}/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revision_number: revisionNumber,
      summary,
      evidence,
    }),
  });
}

export function dataWorkspace() {
  return dataRequest('/api/data');
}

export function importHistory({ limit = 25, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return dataRequest(`/api/imports?${query}`);
}

export function importReview(
  batchId,
  {
    severity = null,
    sheet = null,
    field = null,
    code = null,
    limit = 50,
    offset = 0,
  } = {},
) {
  const query = new URLSearchParams({
    issue_limit: String(limit),
    issue_offset: String(offset),
  });
  if (severity) query.set('severity', severity);
  if (sheet) query.set('sheet', sheet);
  if (field) query.set('field', field);
  if (code) query.set('code', code);
  return dataRequest(`/api/imports/${encodeURIComponent(batchId)}?${query}`);
}

export function uploadWorkbook(file) {
  const body = new FormData();
  body.append('workbook', file);
  return dataRequest('/api/imports', { method: 'POST', body });
}

export function confirmImportActivation(batchId, createOnly = false) {
  return dataRequest(`/api/imports/${encodeURIComponent(batchId)}/activation-confirmation${createOnly ? "?create_only=true" : ""}`, {
    method: 'POST',
  });
}

export function activateImport(batchId, confirmationToken, createOnly = false) {
  return dataRequest(`/api/imports/${encodeURIComponent(batchId)}/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation_token: confirmationToken, ...(createOnly ? { create_only: true } : {}) }),
  });
}

export function inventoryVersionHistory({ limit = 25, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return dataRequest(`/api/inventory/versions?${query}`);
}

// The region the console shows. Projects carry no region field, so a demo
// project is recognised by its external-ID prefix and any other project by the
// currency of its prices (looked up once per active version and cached).
const REGION_BY_CURRENCY = {
  AED: 'uae', SAR: 'sa', THB: 'th', INR: 'in', IDR: 'id', VND: 'vn', MYR: 'my', SGD: 'sg', PHP: 'ph', RUB: 'rf', KZT: 'kz',
};
const regionCache = new Map();
let selectedRegion = 'all';

export function setRegion(region) {
  selectedRegion = region || 'all';
}

export function currentRegion() {
  return selectedRegion;
}

async function projectRegion(item) {
  const external = String(item.project_external_id || '');
  const demo = /^demo26-([a-z]+)-/.exec(external);
  if (demo) return demo[1];
  const key = `${item.project_id}:${item.id}`;
  if (!regionCache.has(key)) {
    regionCache.set(key, (async () => {
      try {
        const page = await inventoryProjectUnits(item.project_id, {
          inventoryVersionId: item.id, pageSize: 1,
        });
        const row = (page.items || page.rows || [])[0];
        const currency = row?.price?.currency || row?.price?.currency_code;
        return REGION_BY_CURRENCY[currency] || 'other';
      } catch {
        return 'other';
      }
    })());
  }
  return regionCache.get(key);
}

export function activeInventoryAll() {
  return dataRequest('/api/inventory/active');
}

export async function activeInventory() {
  const payload = await activeInventoryAll();
  if (selectedRegion === 'all' || !Array.isArray(payload?.items)) return payload;
  const regions = await Promise.all(payload.items.map(projectRegion));
  return {
    ...payload,
    items: payload.items.filter((_, index) => regions[index] === selectedRegion),
  };
}

export function operationalSurfaces(
  projectId,
  { inventoryVersionId, asOfUtc = null, algorithm = null } = {},
) {
  const query = new URLSearchParams({
    inventory_version_id: String(inventoryVersionId),
  });
  if (asOfUtc) query.set('as_of_utc', asOfUtc);
  if (algorithm) query.set('algorithm', algorithm);
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}`
      + `/operational-surfaces?${query}`,
  );
}

// «Рынок рядом»: `include` null keeps the server's default competitor set; a
// list (possibly empty) names the DLD projects to compare against.
export function marketNearby(projectId, { inventoryVersionId, include = null } = {}) {
  const query = new URLSearchParams({ inventory_version_id: String(inventoryVersionId) });
  if (include !== null) query.set('include', include.join(','));
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}/market-nearby?${query}`,
  );
}

export function inventoryUnitHistory(
  unitId,
  { inventoryVersionId = null, asOfUtc = null, limit = 100, offset = 0 } = {},
) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (inventoryVersionId != null) {
    query.set('inventory_version_id', String(inventoryVersionId));
  }
  if (asOfUtc) query.set('as_of_utc', asOfUtc);
  return dataRequest(`/api/inventory/units/${encodeURIComponent(unitId)}/history?${query}`);
}

export function inventoryProjectUnits(
  projectId,
  {
    inventoryVersionId,
    filters = {},
    sort = 'unit_number',
    direction = 'asc',
    page = 1,
    pageSize = 50,
    asOfUtc = null,
    algorithm = null,
  } = {},
) {
  const query = new URLSearchParams({
    inventory_version_id: String(inventoryVersionId),
    sort,
    direction,
    page: String(page),
    page_size: String(pageSize),
  });
  if (asOfUtc) query.set('as_of_utc', asOfUtc);
  if (algorithm) query.set('algorithm', algorithm);
  for (const [key, value] of Object.entries(filters || {})) {
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, typeof value === 'boolean' ? String(value) : String(value));
    }
  }
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}/units?${query}`,
  );
}

export function inventoryProjectUnitDetail(
  projectId,
  unitId,
  {
    inventoryVersionId,
    historyLimit = 100,
    historyOffset = 0,
    asOfUtc = null,
    algorithm = null,
  } = {},
) {
  const query = new URLSearchParams({
    inventory_version_id: String(inventoryVersionId),
    history_limit: String(historyLimit),
    history_offset: String(historyOffset),
  });
  if (asOfUtc) query.set('as_of_utc', asOfUtc);
  if (algorithm) query.set('algorithm', algorithm);
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}`
      + `/units/${encodeURIComponent(unitId)}?${query}`,
  );
}

export function inventoryProjectChessboard(
  projectId,
  sectionId,
  { inventoryVersionId, filters = {}, asOfUtc = null, algorithm = null } = {},
) {
  const query = new URLSearchParams({
    inventory_version_id: String(inventoryVersionId),
  });
  if (asOfUtc) query.set('as_of_utc', asOfUtc);
  if (algorithm) query.set('algorithm', algorithm);
  for (const [key, value] of Object.entries(filters || {})) {
    // Section ancestry is owned by the path. The Desk keeps a structural
    // section filter in shared state for Table/Board reconciliation, but it
    // must never become a duplicate or mismatched Chessboard query field.
    if (key === 'section_id' || key === 'section') continue;
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, typeof value === 'boolean' ? String(value) : String(value));
    }
  }
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}`
      + `/sections/${encodeURIComponent(sectionId)}/chessboard?${query}`,
  );
}

// The server contract remains section-scoped, while the operational UI renders
// the whole building. Keep the fan-out at the API boundary so the controller
// treats a building projection as one logical request and preserves its
// last-request-wins semantics.
export async function inventoryProjectBuildingChessboard(
  projectId,
  sections,
  options = {},
) {
  // Read the section projections in deterministic order. The SQLite service
  // serialises their transaction lifecycle, so parallel fan-out can reject an
  // otherwise valid section. The controller still observes one logical request.
  const boards = [];
  for (const section of sections || []) {
    const sectionId = section?.id ?? section;
    boards.push(await inventoryProjectChessboard(projectId, sectionId, options));
  }
  return boards;
}

export function createCalculationSnapshot(
  projectId,
  { inventoryVersionId, asOfUtc },
) {
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}/calculation-snapshots`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_version_id: inventoryVersionId,
        as_of_utc: asOfUtc,
      }),
    },
  );
}

export function listCalculationSnapshots(projectId, {
  limit = 25, offset = 0, inventoryVersionId = null, asOfUtc = null,
} = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (inventoryVersionId != null) query.set('inventory_version_id', String(inventoryVersionId));
  if (asOfUtc) query.set('as_of_utc', asOfUtc);
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}`
      + `/calculation-snapshots?${query}`,
  );
}

export function inspectCalculationSnapshot(projectId, snapshotId, {
  resultLimit = 25, resultOffset = 0,
} = {}) {
  const query = new URLSearchParams({
    result_limit: String(resultLimit), result_offset: String(resultOffset),
  });
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}`
      + `/calculation-snapshots/${encodeURIComponent(snapshotId)}?${query}`,
  );
}

export function runCalculationSnapshotContractEvidence(projectId, snapshotId) {
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}`
      + `/calculation-snapshots/${encodeURIComponent(snapshotId)}/contract-evidence`,
    { method: 'POST' },
  );
}

export function runCalculationSnapshotBaselineDemand(projectId, snapshotId) {
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}`
      + `/calculation-snapshots/${encodeURIComponent(snapshotId)}/baseline-recommendations`,
    { method: 'POST' },
  );
}

// One DCO policy priced over an existing snapshot. Unlike the baseline this is
// never automatic: the operator asks for it from the algorithm switch.
export function runCalculationSnapshotDco(projectId, snapshotId, policy) {
  const query = new URLSearchParams({ policy });
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}`
      + `/calculation-snapshots/${encodeURIComponent(snapshotId)}`
      + `/dco-recommendations?${query}`,
    { method: 'POST' },
  );
}

// Coefficients of chosen units: `mode` 'multiply' (factor 1.05 = 5% dearer than
// now) or 'set' (factor becomes the coefficient). The server activates the edit
// as a new inventory version and answers with its id.
export function editUnitModifiers(
  projectId,
  { inventoryVersionId, unitIds, mode, factor, label = null },
) {
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}/modifiers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_version_id: String(inventoryVersionId),
        unit_ids: unitIds.map(String),
        mode,
        factor: String(factor),
        label,
      }),
    },
  );
}

// Which floors, risers and buildings sell out of line with their coefficients,
// read from the version's latest calculation snapshot.
export function modifierAdvice(projectId, { inventoryVersionId }) {
  const query = new URLSearchParams({ inventory_version_id: String(inventoryVersionId) });
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}/modifier-advice?${query}`,
  );
}

// Accept or decline every undecided recommendation of one result, or of one
// unit type (`groupId`). Verdicts already given are kept.
export function recordGroupRecommendationDecisions(
  projectId,
  { inventoryVersionId, snapshotId, resultId, verdict, groupId = null },
) {
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}/recommendation-decisions/bulk`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_version_id: String(inventoryVersionId),
        snapshot_id: String(snapshotId),
        result_id: String(resultId),
        verdict,
        group_id: groupId,
      }),
    },
  );
}

export function recordInventoryRecommendationDecision(
  projectId,
  { inventoryVersionId, unitId, snapshotId, resultId, verdict },
) {
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}/recommendation-decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_version_id: String(inventoryVersionId),
        unit_id: String(unitId),
        snapshot_id: String(snapshotId),
        result_id: String(resultId),
        verdict,
      }),
    },
  );
}

// «Условия сделки» on the deal-price surface: store the acting user's own terms
// for one project. The server clamps and resolves everything sent here against
// the active version and answers with its own recomputed block, so the caller
// adopts the response rather than its own optimistic values.
export function saveDealTerms(
  projectId,
  {
    inventoryVersionId, asOfUtc = null, groupId = null, paymentPlanId = null,
    cutScaled, discountRateScaled, levers = {},
  },
) {
  return dataRequest(
    `/api/inventory/projects/${encodeURIComponent(projectId)}/deal-terms`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_version_id: String(inventoryVersionId),
        as_of_utc: asOfUtc,
        group_id: groupId,
        payment_plan_id: paymentPlanId,
        cut_scaled: String(cutScaled),
        discount_rate_scaled: String(discountRateScaled),
        levers,
      }),
    },
  );
}
