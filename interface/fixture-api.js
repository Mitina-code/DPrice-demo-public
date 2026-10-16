// Static display adapter: the only network reads are these local JSON files.
import { createOfflineApi } from './fixture-store.js';
export const roleLandings = { manager: 'today', director: 'desk', analyst: 'trend', data_steward: 'data', loop_admin: 'loop' };
const params = new URLSearchParams(location.search);
const entry = document.body.dataset.entry;
export const previewRole = entry === 'admin' ? 'loop_admin' : (Object.hasOwn(roleLandings, params.get('role')) ? params.get('role') : 'manager');
async function readFixture(name) {
  const response = await fetch(new URL(`./fixtures/${name}.json`, import.meta.url), { method: 'GET', credentials: 'omit' });
  if (!response.ok) throw new Error('Preview fixture could not be loaded');
  return response.json();
}
// Login has no data dependency. Administrators need only the small workbench fixture.
const needsInventory = entry !== 'login' && previewRole !== 'loop_admin';
const [data, feedback] = await Promise.all([
  needsInventory ? readFixture('data') : Promise.resolve({}),
  entry !== 'login' ? readFixture('feedback') : Promise.resolve(null),
]);
if (needsInventory && (!data.projects || !data.active || !data.workspace)) {
  throw new Error('Invalid inventory preview fixture');
}
if (entry !== 'login' && (!feedback?.workspace || !feedback.details || !feedback.my_feedback)) {
  throw new Error('Invalid feedback preview fixture');
}
function applyRole(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value.allowed_roles)) value.allowed = value.allowed_roles.includes(previewRole);
  for (const child of Object.values(value)) applyRole(child);
}
applyRole(data);
applyRole(feedback);
data.session = { role: previewRole, landing: roleLandings[previewRole] };
const adapter = createOfflineApi(data);
adapter.productLoopWorkspace = async () => structuredClone(feedback.workspace);
adapter.productLoopFeedback = async (id) => {
  if (!feedback.details[id]) throw new adapter.ApiError('offline_unavailable');
  return structuredClone(feedback.details[id]);
};
adapter.myProductFeedback = async () => structuredClone(feedback.my_feedback);
export const {
  ApiError,
  activateImport,
  command,
  confirmImportActivation,
  dataWorkspace,
  groupApproval,
  importHistory,
  importReview,
  inventoryProjectBuildingChessboard,
  inventoryProjectUnitDetail,
  inventoryProjectUnits,
  inventoryVersionHistory,
  activeInventory,
  operationalSurfaces,
  cancelProductChangeDevelopment,
  confirmProductChangeDevelopmentClass,
  createCalculationSnapshot,
  listCalculationSnapshots,
  inspectCalculationSnapshot,
  runCalculationSnapshotDco,
  recordInventoryRecommendationDecision,
  login,
  logout,
  myProductFeedback,
  onSessionExpired,
  scenarioSave,
  productLoopFeedback,
  productLoopWorkspace,
  recordProductChangeResult,
  requestProductChangePreparation,
  retryProductChangeDevelopment,
  retryProductChangePreparation,
  saveDealTerms,
  saveProductChangePlan,
  session,
  strategySwitch,
  supersedeInflightViews,
  submitProductFeedback,
  startProductChangeDevelopment,
  unitDecision,
  uploadWorkbook,
  view,
} = adapter;
