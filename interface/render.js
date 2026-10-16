// The render layer — pure view builders plus the «Вход» controller.
//
// Render functions are pure: state in, DOM out, no side effects and — the hard
// rule — no pricing logic anywhere in the UI layer (NFR-10). The client renders
// the login/landing shell and the live product surfaces from server payloads:
// every number is formatted here, while all pricing and recommendations stay in
// Python view-models and the kernel.

import { DICT, LANGS, localeFor, nf, pct, ppt, sgn, t, tf, tlc, tp } from './dict.js';
import * as api from './fixture-api.js';

const {
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
} = api;

// --- small DOM helpers ------------------------------------------------------

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) {
        continue;
      }
      if (k === 'class') {
        node.className = v;
      } else {
        node.setAttribute(k, v);
      }
    }
  }
  for (const child of children || []) {
    if (child == null) {
      continue;
    }
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

// The SVG namespace an inline SVG element must be created in — a plain
// `createElement('svg'|'path'|…)` yields an inert HTMLUnknownElement that never
// renders, so the hand-rolled charts (UX-DR15: the Release MC fan) build through
// `createElementNS`. Every attribute — `class` included, since an SVG element's
// `className` is a read-only SVGAnimatedString — is set via `setAttribute`. The
// fake DOM the render tests drive implements `createElementNS`, so the SVG tree is
// introspectable there too.
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, children) {
  const node = document.createElementNS
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) {
        continue;
      }
      node.setAttribute(k, String(v));
    }
  }
  for (const child of children || []) {
    if (child == null) {
      continue;
    }
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

// --- pure view builders -----------------------------------------------------

// The supplied brand asset is shared by the authenticated workspaces.
function buildBrand(lang) {
  const wordmark = el('img', {
    class: 'console-logo',
    src: '../interface/brand/dprice_logo.svg?v=lp34-31230e26',
    alt: 'DPrice', width: '107', height: '36',
  });
  return el('div', { class: 'brand' }, [
    wordmark,
    el('small', null, [t('brand_sub', lang)]),
  ]);
}

// The RU/EN switcher — working pre-auth (UX-DR1). Active = solid ink + white.
function buildLangSwitcher(lang, onLang) {
  const buttons = LANGS.map((code) =>
    el(
      'button',
      {
        type: 'button',
        class: code === lang ? 'on' : null,
        'aria-pressed': code === lang ? 'true' : 'false',
        'data-lang': code,
      },
      [code.toUpperCase()],
    ),
  );
  const box = el('div', { class: 'langsw', role: 'group', 'aria-label': 'language' }, buttons);
  box.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-lang]');
    if (target) {
      onLang(target.getAttribute('data-lang'));
    }
  });
  return box;
}

// One labelled field — a <label>-wrapped input with an uppercase micro-label.
function buildField(id, labelKey, type, lang) {
  return el('label', { class: 'field', for: id }, [
    el('span', { class: 'label' }, [t(labelKey, lang)]),
    el('input', {
      class: 'input',
      id,
      name: id,
      type,
      placeholder: t(type === 'password' ? 'login_password_placeholder' : 'login_email_placeholder', lang),
      autocomplete: type === 'password' ? 'current-password' : 'username',
      required: 'required',
    }, []),
  ]);
}

// The footer — "DPrice by RAMAX" + the synthetic-data disclaimer (UX-DR1).
function buildFooter(lang) {
  return el('footer', { class: 'footer' }, [
    t('rf_title', lang),
    el('span', { class: 'disclaimer' }, [t('rf_sub', lang)]),
  ]);
}

// A danger note carrying a message key — the server never sends the prose.
function buildErrorNote(errorKey, lang) {
  return el('div', { class: 'note danger note-error' }, [t(errorKey, lang)]);
}

// Public destinations are absolute: this page is served from the local demo,
// while its navigation still points to the original public platform.
const PUBLIC_PLATFORM = '../landing';
const PUBLIC_LOGIN = '../login/';

function publicIcon(kind, size = 22) {
  const paths = {
    growth: ['M20 8v2h6.6L18 18.6l-4.3-4.3-1.4 0L2 24.6 3.4 26 13 16.4l4.3 4.3 1.4 0L28 11.4V18h2V8z'],
    money: ['M23 20.5c0-4.6-3.8-5.1-6.8-5.6-3.3-.5-5.2-.9-5.2-3.7 0-2.4 2.5-3.2 4.7-3.2 2.3 0 4.1.9 5.5 2.6l1.6-1.2A8.7 8.7 0 0 0 17 6.1V3h-2v3c-3.6.2-6 2.3-6 5.2 0 4.7 3.8 5.3 6.9 5.7 3.3.5 5.1.9 5.1 3.6 0 3.1-3.1 3.5-5 3.5-3.4 0-4.9-1-6.2-2.6l-1.6 1.2a8.4 8.4 0 0 0 6.8 3.3V29h2v-3c3.7-.3 6-2.3 6-5.5z'],
    chart: ['M4 2H2v26a2 2 0 0 0 2 2h26v-2H4z', 'M30 9h-7v2h3.6L19 18.6l-4.3-4.3a1 1 0 0 0-1.4 0L6 21.6 7.4 23 14 16.4l4.3 4.3a1 1 0 0 0 1.4 0L28 12.4V16h2z'],
    clock: ['M16 30a14 14 0 1 1 14-14 14 14 0 0 1-14 14zm0-26a12 12 0 1 0 12 12A12 12 0 0 0 16 4z', 'M20.6 22 15 16.4V7h2v8.6l5 5z'],
    people: ['M8 9a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm16 0a4 4 0 1 1 4-4 4 4 0 0 1-4 4zM26 30h-4a2 2 0 0 1-2-2v-7h2v7h4v-9h2v-6a1 1 0 0 0-1-1h-6.4L16 20l-4.6-8H5a1 1 0 0 0-1 1v6h2v9h4v-7h2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1-2-2v-6a3 3 0 0 1 3-3h7.6l3.4 6 3.4-6H27a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2v7a2 2 0 0 1-2 2z'],
    calculator: ['M26 4v24H6V4h20m0-2H6a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z', 'M9 7h14v3H9zm0 6h2v2H9zm6 0h2v2h-2zm6 0h2v2h-2zM9 18h2v2H9zm6 0h2v2h-2zm6 0h2v2h-2zM9 23h2v2H9zm6 0h2v2h-2zm6 0h2v2h-2z'],
    game: ['M7.5 26A5.6 5.6 0 0 1 2.2 19l2.3-8.8A5.5 5.5 0 0 1 14.7 9h2.6a5.5 5.5 0 0 1 10.2 1.2l2.3 8.8a5.6 5.6 0 0 1-10.6 2.9L19 21h-6l-.2.9A5.6 5.6 0 0 1 7.5 26zM9.8 8a3.6 3.6 0 0 0-3.4 2.7L4.1 19.5a3.6 3.6 0 0 0 6.8 1.9l.6-2.4h9l.6 2.4a3.6 3.6 0 0 0 6.8-1.9l-2.3-8.8A3.6 3.6 0 0 0 19 10.3l-.2.7h-5.6l-.2-.7A3.5 3.5 0 0 0 9.8 8z', 'M9 11h2v3h3v2h-3v3H9v-3H6v-2h3z'],
    arrow: ['M18 6 16.6 7.4 24.2 15H4v2h20.2l-7.6 7.6L18 26l10-10z'],
  };
  return svgEl('svg', { viewBox: '0 0 32 32', width: size, height: size, fill: 'currentColor', 'aria-hidden': 'true', focusable: 'false' }, paths[kind].map((d) => svgEl('path', { d })));
}

function publicCard(icon, titleKey, bodyKey, lang) {
  return el('article', { class: 'auth_benefitCard__W58rG' }, [
    el('div', { class: 'auth_benefitIcon__Booph' }, [publicIcon(icon)]),
    el('h3', { class: 'auth_benefitTitle__cQlZN' }, [t(titleKey, lang)]),
    el('p', { class: 'auth_benefitDesc__5UHXC' }, [t(bodyKey, lang)]),
  ]);
}

function publicCta(icon, flavor, titleKey, bodyKey, actionKey, href, lang, external = false) {
  const flavorClasses = {
    Calculator: ['auth_ctaCardCalculator__Xichf', 'auth_ctaCardIconGreen__D_kzG', ''],
    Game: ['auth_ctaCardGame__zLMQs', 'auth_ctaCardIconBlue__PmfXT', 'auth_ctaCardLinkBlue__AVV97'],
    Landing: ['auth_ctaCardLanding__vNgr2', 'auth_ctaCardIconGold__odLt4', 'auth_ctaCardLinkGold__CJ4sX'],
  }[flavor];
  return el('a', {
    class: `auth_ctaCard__kb0uV ${flavorClasses[0]}`,
    href,
    target: external ? '_blank' : null,
    rel: external ? 'noopener noreferrer' : null,
  }, [
    el('div', { class: `auth_ctaCardIcon__11f_Z ${flavorClasses[1]}` }, [publicIcon(icon, 24)]),
    el('h3', { class: 'auth_ctaCardTitle__SVdFX' }, [t(titleKey, lang)]),
    el('p', { class: 'auth_ctaCardDesc__udzVC' }, [t(bodyKey, lang)]),
    el('span', { class: `auth_ctaCardLink__kg3aY ${flavorClasses[2]}` }, [t(actionKey, lang), publicIcon('arrow', 16)]),
  ]);
}

// The modal mirrors the public registration prompt. Its only action leaves for
// the public platform; entered credentials are never collected or transmitted.
function publicDemoModal(lang, close) {
  const previewFields = [
    ['x_public_username', 'text'],
    ['x_public_email', 'email'],
    ['x_public_first_name', 'text'],
    ['x_public_last_name', 'text'],
    ['x_public_password_placeholder', 'password'],
    ['x_public_confirm_password', 'password'],
  ].map(([key, type]) => el('input', {
    class: 'auth_input__lmX_a', type, placeholder: t(key, lang),
    'aria-label': t(key, lang), disabled: 'disabled',
  }));
  const panel = el('div', { class: 'auth_modalPanel__4nmhE', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'public-demo-title' }, [
    el('button', { type: 'button', class: 'auth_modalClose__M4KE_', 'aria-label': t('x_public_close', lang) }, ['×']),
    el('h2', { id: 'public-demo-title', class: 'auth_modalTitle__1iaoU' }, [t('x_public_modal_title', lang), ' ', el('span', null, ['DPrice'])]),
    el('p', { class: 'auth_modalSubtitle__H1xla' }, [t('x_public_modal_subtitle', lang)]),
    el('div', { class: 'public-demo-fields', 'aria-hidden': 'true' }, previewFields),
    el('a', { class: 'auth_submitButton__Bnn9k public-demo-link', href: PUBLIC_LOGIN, target: '_blank', rel: 'noopener noreferrer' }, [t('x_public_modal_action', lang), publicIcon('arrow', 16)]),
    el('p', { class: 'auth_formNote__VqaNu public-demo-guide' }, [t('x_public_modal_guide', lang)]),
  ]);
  const overlay = el('div', { class: 'auth_modalOverlay__vJeAv' }, [panel]);
  panel.querySelector('button').addEventListener('click', close);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [panel.querySelector('button'), panel.querySelector('a')];
    const edge = event.shiftKey ? focusable[0] : focusable[1];
    if (document.activeElement === edge) {
      event.preventDefault();
      focusable[event.shiftKey ? 1 : 0].focus();
    }
  });
  return overlay;
}

// Build the public login landing; only the form calls the local auth handler.
export function renderLogin(state, handlers) {
  const lang = state.lang;
  const roles = ['manager', 'director', 'analyst', 'data_steward', 'loop_admin'];
  const form = el('div', { class: 'auth_form__cESoh' }, [
    el('p', { class: 'note' }, [t('preview_login_notice', lang)]),
    ...roles.map((role) => el('a', {
      class: 'auth_submitButton__Bnn9k preview-role-link',
      href: `../product/?role=${role}&lang=${lang}`, 'data-preview-role': role,
    }, [t(`preview_role_${role}`, lang)])),
  ]);
  return el('div', { class: 'auth_authPage__jVv48' }, [
    el('header', { class: 'auth_header__4bzKl' }, [
      el('div', { class: 'auth_headerInner__vLBqW' }, [buildBrand(lang), buildLangSwitcher(lang, handlers.onLang)]),
    ]),
    el('section', { class: 'auth_hero__Lsi5u' }, [
      el('div', { class: 'auth_heroGlow__SL1j8', 'aria-hidden': 'true' }),
      el('div', { class: 'auth_heroInner__g4S2K' }, [
        el('div', { class: 'auth_heroContent__StmjY' }, [
          el('h1', { class: 'auth_heroTitle__2f7lP' }, [t('preview_login_title', lang)]),
          el('p', { class: 'auth_heroSubtitle__rwBpL' }, [t('preview_notice', lang)]),
          el('a', { class: 'btn', href: `../demo/?lang=${lang}` }, [t('preview_demo', lang)]),
        ]),
        el('div', { class: 'auth_loginCard__lB0s2' }, [
          el('div', { class: 'auth_loginCardContent__WDWlI' }, [
            el('h2', { class: 'auth_loginTitle__l1xPf' }, [t('preview_choose_role', lang)]), form,
          ]),
        ]),
      ]),
    ]),
  ]);
}

// --- role landings (UX-DR4) --------------------------------------------------

// Landing surface id → its title key. Names verbatim from the frozen prototype
// dictionary; the loop admin has no product surface (landing null) and gets the
// notice page instead. Manager → «Сегодня», director → «Переоценка», analyst →
// «Динамика и прогноз».
const LANDING_TITLE = {
  today: 'nav_today',
  desk: 'nav_desk',
  trend: 'nav_trend',
  data: 'nav_data',
};

// The post-auth header: role badge, the session-scoped market chip (UAE), the
// still-working language switcher and the logout button. Composed strictly from
// the existing token components (chip, langsw, primary button) — the real top
// bar, rail and tabs are Story 3.3's.
function buildLandingHeader(state, handlers) {
  const { lang, role } = state;
  return el('div', { class: 'landing-head' }, [
    el('span', { class: 'chip role-badge' }, [t(`role_${role}`, lang)]),
    el('span', { class: 'chip' }, [t(role === 'data_steward' ? 'data_scope' : 'mk_uae', lang)]),
    buildLangSwitcher(lang, handlers.onLang),
  ]);
}

// The logout control — returns to «Вход» (UX-DR7). Reuses the primary button.
function buildLogout(lang, onLogout) {
  const btn = el('button', { type: 'button', class: 'btn-primary' }, [
    t('sess_logout', lang),
  ]);
  btn.addEventListener('click', () => onLogout());
  return btn;
}

// The title key for a landing, defaulting to the login title if unknown.
function landingTitleKey(landing) {
  return LANDING_TITLE[landing] || 'login_title';
}

// Render an authenticated landing from `state` ({ lang, role, landing }). Pure:
// the role landings render their frame and title only; the loop admin (landing
// null, FR-3) gets the minimal notice page — no product surface, sign-out the
// only action. Payloads arrive with Story 3.3/Epic 4.
export function renderLanding(state, handlers) {
  const { lang, landing } = state;

  const cardChildren =
    landing === null
      ? [
          el('h1', { class: 'surface-title' }, [t('admin_notice_title', lang)]),
          el('div', { class: 'note info' }, [t('admin_notice_body', lang)]),
        ]
      : [el('h1', { class: 'surface-title' }, [t(landingTitleKey(landing), lang)])];

  const card = el('section', { class: 'card' }, [
    ...cardChildren,
    buildLogout(lang, handlers.onLogout),
  ]);

  return el('div', { class: 'login' }, [
    el('div', { class: 'login-top' }, [buildLandingHeader(state, handlers)]),
    buildBrand(lang),
    card,
    buildFooter(lang),
  ]);
}

// --- QF-003 product-change workbench --------------------------------------

function emptyFeedbackState() {
  return {
    open: false,
    loading: false,
    submitting: false,
    error: null,
    success: false,
    refreshError: null,
    items: [],
    pagination: { total: 0, count: 0, limit: 20, offset: 0, has_more: false },
    restoreFocus: null,
    draft: null,
  };
}

function emptyProductLoopState() {
  return {
    loading: false,
    detailLoading: false,
    mutationBusy: false,
    error: null,
    registry: { items: [], total: 0 },
    plans: [],
    planPage: { total: 0, count: 0, limit: 20, offset: 0, has_more: false },
    registryOffset: 0,
    planOffset: 0,
    detailPlanOffset: 0,
    preparationHints: {},
    planDraft: null,
    resultDrafts: {},
    focusFeedbackId: null,
    selectedFeedbackId: null,
    detail: null,
    editPlanId: null,
    progressStale: false,
    pollDelay: 2000,
    activeAutomationCount: 0,
  };
}

function splitWorkbenchLines(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function splitWorkbenchIds(value) {
  // Operational identifiers arrive as decimal strings so values above 2^53
  // remain exact. Keep user-entered IDs as strings too; Pydantic validates and
  // converts valid decimal identifiers server-side without a lossy JS Number.
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function feedbackStateLabel(value, lang) {
  return t(`product_feedback_state_${value || 'new'}`, lang);
}

function formatLoopTimestamp(value, lang) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return String(value || '');
  return new Intl.DateTimeFormat(localeFor(lang), {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(parsed);
}

function loopStageLabel(stage, lang) {
  return t(`product_loop_stage_${stage.key}`, lang);
}

function loopReasonLabel(reason, lang) {
  const publicReasons = new Set(['not_linked', 'invalid_link']);
  return t(
    publicReasons.has(reason)
      ? `product_loop_reason_${reason}`
      : 'product_loop_reason_source_unavailable',
    lang,
  );
}

function buildCompactPager(page, lang, onPage, contextKey = null) {
  if (!page || Number(page.total || 0) <= Number(page.limit || 0)) return null;
  const offset = Number(page.offset || 0);
  const limit = Number(page.limit || 20);
  const previous = el('button', {
    type: 'button', class: 'btn-ghost', disabled: offset <= 0 ? 'disabled' : null,
    'data-loop-focus-key': contextKey ? `${contextKey}:previous` : null,
  }, [t('product_loop_previous', lang)]);
  const next = el('button', {
    type: 'button', class: 'btn-ghost', disabled: page.has_more ? null : 'disabled',
    'data-loop-focus-key': contextKey ? `${contextKey}:next` : null,
  }, [t('product_loop_next', lang)]);
  previous.addEventListener('click', () => onPage(Math.max(0, offset - limit)));
  next.addEventListener('click', () => onPage(offset + limit));
  return el('div', { class: 'loop-pagination' }, [
    previous,
    el('span', { class: 'muted mono' }, [
      `${offset + 1}–${offset + Number(page.count || 0)} / ${page.total}`,
    ]),
    next,
  ]);
}

function buildFeedbackIntake(state, handlers) {
  if (!state.authed || state.role === 'loop_admin') return null;
  const feedback = state.feedbackState;
  const launcher = el('button', {
    type: 'button',
    class: 'feedback-launcher',
    'data-feedback-open': 'true',
    'aria-haspopup': 'dialog',
  }, [t('product_feedback_open', state.lang)]);
  launcher.addEventListener('click', () => handlers.onFeedbackOpen(launcher));
  if (!feedback.open) return launcher;

  const history = feedback.items.length
    ? el('ul', { class: 'feedback-history' }, feedback.items.map((item) =>
      el('li', null, [
        el('b', null, [item.title]),
        el('span', { class: `tag loop-state-${item.state}` }, [
          feedbackStateLabel(item.state, state.lang),
        ]),
      ])))
    : el('p', { class: 'muted' }, [t('product_feedback_empty', state.lang)]);
  const form = el('form', { class: 'feedback-form' }, [
    el('label', { class: 'field' }, [
      el('span', { class: 'label' }, [t('product_feedback_title', state.lang)]),
      el('input', {
        class: 'input', name: 'title', minlength: '3', maxlength: '160', required: 'required',
        value: feedback.draft?.title || '',
      }, []),
    ]),
    el('label', { class: 'field' }, [
      el('span', { class: 'label' }, [t('product_feedback_body', state.lang)]),
      el('textarea', {
        class: 'input', name: 'body', rows: '5', minlength: '3', maxlength: '4000',
        required: 'required',
      }, [feedback.draft?.body || '']),
    ]),
    el('div', { class: 'note w' }, [t('product_feedback_no_pii', state.lang)]),
    feedback.error ? buildErrorNote(feedback.error.key || feedback.error, state.lang) : null,
    feedback.refreshError ? el('div', { class: 'note w', role: 'status' }, [
      t('product_feedback_refresh_failed', state.lang),
      el('button', { type: 'button', class: 'btn-ghost', 'data-feedback-retry': 'true' }, [
        t('x_retry', state.lang),
      ]),
    ]) : null,
    feedback.success
      ? el('div', { class: 'note ok', role: 'status' }, [
        t('product_feedback_submitted', state.lang),
      ]) : null,
    el('div', { class: 'feedback-actions' }, [
      el('button', {
        type: 'submit', class: 'btn-primary', disabled: feedback.submitting ? 'disabled' : null,
      }, [feedback.submitting ? t('x_updating', state.lang) : t('product_feedback_submit', state.lang)]),
      el('button', { type: 'button', class: 'btn-secondary', 'data-feedback-close': 'true' }, [
        t('product_feedback_close', state.lang),
      ]),
    ]),
  ]);
  const syncDraft = () => handlers.onFeedbackDraft({
    title: form.elements.title.value,
    body: form.elements.body.value,
  });
  form.addEventListener('input', syncDraft);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    syncDraft();
    handlers.onFeedbackSubmit({
      title: form.elements.title.value,
      body: form.elements.body.value,
      originatingSurface: state.surface || state.landing || null,
    });
  });
  form.querySelector('[data-feedback-close]').addEventListener(
    'click', () => handlers.onFeedbackClose(),
  );
  form.querySelector('[data-feedback-retry]')?.addEventListener(
    'click', () => handlers.onFeedbackHistoryPage(feedback.pagination.offset || 0),
  );
  const dialog = el('section', {
    class: 'feedback-dialog', role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': 'feedback-dialog-title',
  }, [
    el('div', { class: 'feedback-dialog-head' }, [
      el('h2', { id: 'feedback-dialog-title' }, [t('product_feedback_heading', state.lang)]),
      el('button', {
        type: 'button', class: 'icon-button', 'aria-label': t('product_feedback_close', state.lang),
        'data-feedback-close-head': 'true',
      }, ['×']),
    ]),
    el('p', { class: 'muted' }, [t('product_feedback_scope_note', state.lang)]),
    form,
    el('h3', null, [t('product_feedback_history', state.lang)]),
    feedback.loading ? el('div', { class: 'note info' }, [t('x_loading', state.lang)]) : history,
    buildCompactPager(
      feedback.pagination, state.lang, handlers.onFeedbackHistoryPage,
    ),
  ]);
  dialog.querySelector('[data-feedback-close-head]').addEventListener(
    'click', () => handlers.onFeedbackClose(),
  );
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      handlers.onFeedbackClose();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = Array.from(
        dialog.querySelectorAll('button, input, textarea, select, [href]'),
      ).filter((node) => !node.disabled);
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement);
      const next = event.shiftKey
        ? (index <= 0 ? focusable.length - 1 : index - 1)
        : (index < 0 || index === focusable.length - 1 ? 0 : index + 1);
      event.preventDefault();
      focusable[next].focus();
    }
  });
  return el('div', { class: 'feedback-overlay' }, [launcher, dialog]);
}

function buildLoopTimeline(plan, lang) {
  const stages = (plan.timeline && plan.timeline.stages) || [];
  return el('ol', {
    class: 'product-loop-timeline',
    'aria-live': 'polite',
    tabindex: '-1',
    'data-loop-live-timeline': String(plan.id),
  }, stages.map((stage) =>
    el('li', { class: `loop-stage loop-stage-${stage.state}` }, [
      el('span', { class: 'loop-stage-marker', 'aria-hidden': 'true' }, []),
      el('div', null, [
        el('b', null, [loopStageLabel(stage, lang)]),
        el('span', { class: 'loop-stage-state' }, [
          t(`product_loop_stage_state_${stage.state}`, lang),
        ]),
        stage.source
          ? el('small', null, [
            `${t('product_loop_provenance', lang)}: ${t(`product_loop_source_${stage.source}`, lang)}`,
          ]) : null,
        stage.reason
          ? el('small', null, [loopReasonLabel(stage.reason, lang)]) : null,
        stage.evidence ? el('dl', { class: 'loop-stage-evidence' }, [
          stage.evidence.description
            ? el('div', null, [
              el('dt', null, [t('product_loop_evidence_description', lang)]),
              el('dd', null, [stage.evidence.description]),
            ]) : null,
          stage.evidence.outcome
            ? el('div', null, [
              el('dt', null, [t('product_loop_evidence_outcome', lang)]),
              el('dd', null, [stage.evidence.outcome]),
            ]) : null,
          stage.evidence.ts || stage.evidence.recorded_at_utc
            ? el('div', null, [
              el('dt', null, [t('product_loop_evidence_time', lang)]),
              el('dd', { class: 'mono' }, [
                formatLoopTimestamp(
                  stage.evidence.ts || stage.evidence.recorded_at_utc, lang,
                ),
              ]),
            ]) : null,
        ]) : null,
      ]),
    ])));
}

function canLoop(loopState, capability) {
  const value = loopState.capabilities?.[capability];
  return value === true || value?.allowed === true;
}

function relatedProductLoopPlans(loopState, detail = loopState.detail) {
  if (!detail) return [];
  const merged = [];
  const seen = new Set();
  for (const plan of [...(detail.plans?.items || []), ...loopState.plans]) {
    if (seen.has(String(plan.id))) continue;
    seen.add(String(plan.id));
    if (plan.source_feedback_ids.some((id) => String(id) === String(detail.id))) {
      merged.push(plan);
    }
  }
  return merged;
}

function productLoopStaticPlan(plan) {
  if (!plan) return plan;
  const { development_run: _run, timeline: _timeline, ...staticPlan } = plan;
  return staticPlan;
}

function productLoopStaticSignature(loopState) {
  const detail = loopState.detail;
  const staticDetail = detail ? {
    ...detail,
    preparations: undefined,
    plans: {
      ...(detail.plans || {}),
      items: (detail.plans?.items || []).map(productLoopStaticPlan),
    },
  } : null;
  return JSON.stringify({
    registry: loopState.registry,
    registryOffset: loopState.registryOffset,
    planPage: { ...(loopState.planPage || {}), items: undefined },
    planOffset: loopState.planOffset,
    capabilities: loopState.capabilities || {},
    selected: loopState.selectedFeedbackId == null
      ? null : String(loopState.selectedFeedbackId),
    detailPlanOffset: loopState.detailPlanOffset,
    detail: staticDetail,
    plans: (loopState.plans || []).map(productLoopStaticPlan),
    // A finished preparation fills the new-plan draft during a background
    // poll; the form is static, so a filled draft must repaint the page.
    planDraft: loopState.planDraft,
  });
}

function productLoopLiveSignatures(loopState) {
  const detail = loopState.detail;
  const plans = {};
  for (const plan of relatedProductLoopPlans(loopState, detail)) {
    plans[String(plan.id)] = {
      execution: JSON.stringify({
        run: plan.development_run || null,
        stale: loopState.progressStale,
        busy: loopState.mutationBusy,
      }),
      timeline: JSON.stringify(plan.timeline || null),
    };
  }
  return {
    stale: JSON.stringify({ stale: loopState.progressStale }),
    preparation: JSON.stringify({
      preparations: detail?.preparations || [],
      stale: loopState.progressStale,
      busy: loopState.mutationBusy,
    }),
    plans,
  };
}

function suggestionPlanDraft(suggestion) {
  return {
    planId: null,
    expectedRevision: null,
    sourceIds: suggestion.source_feedback_ids.join(', '),
    content: suggestion.change_content,
    criteria: suggestion.readiness_criteria.join('\n'),
    risks: suggestion.risks.join('\n'),
  };
}

function buildPlanForm(detail, loopState, state, handlers) {
  const allPlans = [
    ...(loopState.detail?.plans?.items || []),
    ...loopState.plans,
  ];
  const editPlan = allPlans.find(
    (plan) => String(plan.id) === String(loopState.editPlanId),
  );
  const defaultIds = editPlan
    ? editPlan.source_feedback_ids
    : [detail.id];
  const draft = loopState.planDraft
    && String(loopState.planDraft.planId || '') === String(editPlan?.id || '')
    ? loopState.planDraft : {
      planId: editPlan?.id || null,
      expectedRevision: editPlan?.revision_number || null,
      sourceIds: defaultIds.join(', '),
      content: editPlan?.change_content || '',
      criteria: editPlan?.readiness_criteria.join('\n') || '',
      risks: editPlan?.risks.join('\n') || '',
    };
  const form = el('form', {
    class: 'loop-form',
    'data-loop-plan': 'true',
    'data-loop-form-key': `plan:${editPlan?.id || 'new'}:${detail.id}`,
  }, [
    el('h3', null, [t(editPlan ? 'product_loop_plan_new_revision' : 'product_loop_plan_prepare', state.lang)]),
    editPlan ? el('div', { class: 'note w' }, [
      t('product_loop_plan_revision_warning', state.lang),
    ]) : null,
    el('label', { class: 'field' }, [
      el('span', { class: 'label' }, [t('product_loop_source_ids', state.lang)]),
      el('input', { class: 'input', name: 'source_ids', value: draft.sourceIds, required: 'required' }, []),
    ]),
    el('label', { class: 'field' }, [
      el('span', { class: 'label' }, [t('product_loop_change_content', state.lang)]),
      el('textarea', { class: 'input', name: 'content', rows: '5', required: 'required' }, [
        draft.content,
      ]),
    ]),
    el('label', { class: 'field' }, [
      el('span', { class: 'label' }, [t('product_loop_readiness', state.lang)]),
      el('textarea', { class: 'input', name: 'criteria', rows: '4' }, [
        draft.criteria,
      ]),
    ]),
    el('label', { class: 'field' }, [
      el('span', { class: 'label' }, [t('product_loop_risks', state.lang)]),
      el('textarea', { class: 'input', name: 'risks', rows: '3' }, [
        draft.risks,
      ]),
    ]),
    el('button', {
      type: 'submit', class: 'btn-primary', disabled: loopState.mutationBusy ? 'disabled' : null,
      'data-loop-focus-key': `plan-submit:${editPlan?.id || 'new'}:${detail.id}`,
    }, [t(editPlan ? 'product_loop_save_revision' : 'product_loop_save_plan', state.lang)]),
  ]);
  const sync = () => handlers.onPlanDraft({
    planId: editPlan?.id || null,
    expectedRevision: editPlan?.revision_number || null,
    sourceIds: form.elements.source_ids.value,
    content: form.elements.content.value,
    criteria: form.elements.criteria.value,
    risks: form.elements.risks.value,
  });
  form.addEventListener('input', sync);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sync();
    handlers.onSavePlan({
      planId: editPlan ? editPlan.id : null,
      expectedRevision: editPlan ? editPlan.revision_number : null,
      feedbackIds: splitWorkbenchIds(form.elements.source_ids.value),
      changeContent: form.elements.content.value,
      readinessCriteria: splitWorkbenchLines(form.elements.criteria.value).length
        ? splitWorkbenchLines(form.elements.criteria.value)
        : [t('product_loop_readiness_default', state.lang)],
      risks: splitWorkbenchLines(form.elements.risks.value),
      linkedLp: editPlan?.linked_lp || null,
    });
  });
  return form;
}

function preparationSourceIds(detail, loopState) {
  // The plan form below is the one place where related feedback is named;
  // a new-plan draft there decides what the model may cite.
  const draft = loopState.planDraft;
  const ids = draft && !draft.planId ? splitWorkbenchIds(draft.sourceIds || '') : [];
  return ids.length ? ids : [String(detail.id)];
}

function buildPreparationPanel(detail, loopState, state, handlers) {
  const preparation = (detail.preparations || [])[0] || null;
  const latestRecord = preparation?.suggestions?.at(-1) || null;
  const latest = latestRecord?.suggestion || null;
  const hintKey = String(detail.id);
  const hint = loopState.preparationHints[hintKey] ?? '';
  const hintField = el('label', { class: 'field' }, [
    el('span', { class: 'label' }, [t('product_loop_prepare_hint', state.lang)]),
    el('textarea', {
      class: 'input', name: 'preparation_hint', rows: '3', maxlength: '4000',
      'data-loop-form-key': `preparation-hint:${detail.id}`,
    }, [hint]),
  ]);
  hintField.querySelector('textarea').addEventListener('input', (event) => {
    handlers.onPreparationHint(detail.id, event.target.value);
  });
  const inFlight = preparation?.state === 'queued' || preparation?.state === 'running';
  const request = el('button', {
    type: 'button', class: preparation?.state === 'completed' ? 'btn-secondary' : 'btn-primary',
    'data-loop-live-action': 'request-preparation',
    'data-loop-focus-key': `preparation-submit:${detail.id}`,
    disabled: loopState.mutationBusy || inFlight ? 'disabled' : null,
  }, [t(
    inFlight
      ? 'product_loop_prepare_assisted'
      : preparation?.state === 'completed'
        ? 'product_loop_prepare_again'
        : 'product_loop_prepare_assisted',
    state.lang,
  )]);
  request.addEventListener('click', () => handlers.onRequestPreparation(detail.id, {
    hint: loopState.preparationHints[hintKey] ?? '',
    sourceFeedbackIds: preparationSourceIds(detail, loopState),
  }));
  const retry = preparation?.allowed_actions?.retry ? el('button', {
    type: 'button', class: 'btn-secondary', disabled: loopState.mutationBusy ? 'disabled' : null,
    'data-loop-live-action': 'retry-preparation',
  }, [t('x_retry', state.lang)]) : null;
  retry?.addEventListener('click', () => handlers.onRetryPreparation(preparation.id));
  const apply = latest ? el('button', {
    type: 'button', class: 'btn-secondary', disabled: loopState.mutationBusy ? 'disabled' : null,
    'data-loop-live-action': 'apply-suggestion',
  }, [t('product_loop_apply_suggestion', state.lang)]) : null;
  apply?.addEventListener('click', () => handlers.onApplySuggestion(latest));
  return el('div', {
    class: 'product-loop-preparation',
    'aria-live': 'polite',
    tabindex: '-1',
    'data-loop-live-preparation': String(detail.id),
  }, [
    el('div', { class: 'product-loop-plan-head' }, [
      el('h3', null, [t('product_loop_assisted_heading', state.lang)]),
      preparation ? el('span', { class: `tag loop-run-${preparation.state}` }, [
        t(`product_loop_preparation_state_${preparation.state}`, state.lang),
      ]) : null,
    ]),
    el('p', { class: 'muted' }, [t('product_loop_assisted_note', state.lang)]),
    hintField,
    el('p', { class: 'muted' }, [t('product_loop_prepare_hint_note', state.lang)]),
    latest ? el('article', { class: 'product-loop-suggestion' }, [
      el('b', null, [t('product_loop_suggestion_editable', state.lang)]),
      el('p', null, [latest.change_content]),
      el('dl', { class: 'loop-plan-facts' }, [
        el('dt', null, [t('product_loop_suggested_class', state.lang)]),
        el('dd', null, [t(`product_loop_class_${latest.suggested_class}`, state.lang)]),
      ]),
      el('h4', null, [t('product_loop_readiness', state.lang)]),
      el('ul', null, latest.readiness_criteria.map((item) => el('li', null, [item]))),
      el('h4', null, [t('product_loop_risks', state.lang)]),
      latest.risks.length
        ? el('ul', null, latest.risks.map((item) => el('li', null, [item])))
        : el('p', { class: 'muted' }, [t('product_loop_no_risks', state.lang)]),
      el('small', { class: 'mono muted' }, [
        `${latestRecord.model_actor} · ${formatLoopTimestamp(
          latestRecord.created_at_utc, state.lang,
        )}`,
      ]),
      el('small', { class: 'muted' }, [latest.attribution]),
    ]) : null,
    loopState.progressStale
      ? el('div', { class: 'note w product-loop-progress-stale' }, [
        t('product_loop_progress_stale', state.lang),
      ]) : null,
    preparation?.failure_key ? buildErrorNote(preparation.failure_key, state.lang) : null,
    el('div', { class: 'loop-plan-actions' }, [request, retry, apply]),
  ]);
}

function buildDevelopmentRun(plan, loopState, state, handlers) {
  const run = plan.development_run;
  if (!run) return null;
  const events = run.events || [];
  const cancel = run.allowed_actions?.cancel ? el('button', {
    type: 'button', class: 'btn-secondary', disabled: loopState.mutationBusy ? 'disabled' : null,
    'data-loop-live-action': 'cancel-run',
  }, [t('product_loop_cancel_run', state.lang)]) : null;
  cancel?.addEventListener('click', () => handlers.onCancelRun(run));
  const retry = run.allowed_actions?.retry ? el('button', {
    type: 'button', class: 'btn-primary', disabled: loopState.mutationBusy ? 'disabled' : null,
    'data-loop-live-action': 'retry-run',
  }, [t('product_loop_retry_run', state.lang)]) : null;
  retry?.addEventListener('click', () => handlers.onRetryRun(run));
  const confirmClass = run.allowed_actions?.confirm_class ? el('button', {
    type: 'button', class: 'btn-primary', disabled: loopState.mutationBusy ? 'disabled' : null,
    'data-loop-live-action': 'confirm-run-class',
  }, [tp('product_loop_confirm_escalation', state.lang, {
    class: t(`product_loop_class_${run.required_class}`, state.lang),
  })]) : null;
  confirmClass?.addEventListener('click', () => handlers.onConfirmRunClass(run));
  return el('section', {
    class: 'product-loop-execution',
    'aria-live': 'polite',
    tabindex: '-1',
    'data-loop-live-execution': String(plan.id),
  }, [
    el('div', { class: 'product-loop-plan-head' }, [
      el('h4', null, [t('product_loop_execution', state.lang)]),
      el('span', { class: `tag loop-run-${run.status}` }, [
        t(`product_loop_run_state_${run.status}`, state.lang),
      ]),
    ]),
    loopState.progressStale ? el('div', { class: 'note w product-loop-progress-stale' }, [
      t('product_loop_progress_stale', state.lang),
    ]) : null,
    el('dl', { class: 'loop-plan-facts' }, [
      el('dt', null, [t('product_loop_confirmed_class', state.lang)]),
      el('dd', null, [t(`product_loop_class_${run.confirmed_class}`, state.lang)]),
      el('dt', null, [t('product_loop_linked_lp', state.lang)]),
      el('dd', { class: 'mono' }, [run.formal_lp || t('product_loop_pending', state.lang)]),
      run.approved_class ? el('dt', null, [t('product_loop_approved_class', state.lang)]) : null,
      run.approved_class ? el('dd', null, [
        t(`product_loop_class_${run.approved_class}`, state.lang),
      ]) : null,
    ]),
    run.failure_key ? buildErrorNote(run.failure_key, state.lang) : null,
    run.verifier_evidence ? el('section', { class: 'product-loop-verifier-evidence' }, [
      el('h5', null, [t('product_loop_verifier_evidence', state.lang)]),
      run.verifier_evidence.summary ? el('p', null, [run.verifier_evidence.summary]) : null,
      run.verifier_evidence.findings?.length ? el('ul', null,
        run.verifier_evidence.findings.map((finding) => el('li', null, [
          `${finding.severity}: ${finding.summary}`,
        ]))) : null,
    ]) : null,
    el('ol', { class: 'product-loop-execution-events' }, events.map((event) => el('li', null, [
      el('b', null, [t(event.message_key, state.lang)]),
      el('span', { class: 'loop-stage-state' }, [
        t(`product_loop_run_state_${event.status}`, state.lang),
      ]),
      el('small', { class: 'mono muted' }, [
        `${event.phase} · ${formatLoopTimestamp(event.created_at_utc, state.lang)}`,
      ]),
      event.evidence_sha256 ? el('small', { class: 'mono muted' }, [
        event.evidence_sha256,
      ]) : null,
      event.details?.excerpt ? el('pre', { class: 'loop-event-excerpt' }, [
        String(event.details.excerpt),
      ]) : null,
    ]))),
    el('div', { class: 'loop-plan-actions' }, [cancel, retry, confirmClass]),
    run.status === 'ready_for_merge' ? el('div', { class: 'note ok' }, [
      t('product_loop_human_merge_only', state.lang),
      el('dl', { class: 'loop-plan-facts product-loop-handoff' }, [
        el('dt', null, [t('product_loop_base_commit', state.lang)]),
        el('dd', { class: 'mono' }, [run.base_commit_sha256]),
        el('dt', null, [t('product_loop_candidate_commit', state.lang)]),
        el('dd', { class: 'mono' }, [run.candidate_commit_sha256]),
        el('dt', null, [t('product_loop_branch', state.lang)]),
        el('dd', { class: 'mono' }, [run.branch_name]),
        el('dt', null, [t('product_loop_linked_lp', state.lang)]),
        el('dd', { class: 'mono' }, [run.formal_lp]),
      ]),
    ]) : null,
  ]);
}

function buildProductLoopStaleStatus(loopState, state) {
  return el('div', {
    class: 'product-loop-stale-status',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    'data-loop-live-stale': 'true',
  }, [loopState.progressStale ? el('div', {
    class: 'note w product-loop-progress-stale',
  }, [t('product_loop_progress_stale', state.lang)]) : null]);
}

function buildPlanCard(plan, loopState, state, handlers) {
  const approved = !!plan.approval;
  const resultDraft = loopState.resultDrafts[String(plan.id)] || {
    summary: '', evidence: '',
  };
  const resultForm = approved && canLoop(loopState, 'product_change_result_record')
    ? el('form', {
      class: 'loop-result-form', 'data-loop-form-key': `result:${plan.id}`,
    }, [
    el('label', { class: 'field' }, [
      el('span', { class: 'label' }, [t('product_loop_result_summary', state.lang)]),
      el('textarea', { class: 'input', name: 'summary', rows: '3', required: 'required' }, [
        resultDraft.summary,
      ]),
    ]),
    el('label', { class: 'field' }, [
      el('span', { class: 'label' }, [t('product_loop_result_evidence', state.lang)]),
      el('textarea', { class: 'input', name: 'evidence', rows: '2' }, [
        resultDraft.evidence,
      ]),
    ]),
    el('button', {
      type: 'submit', class: 'btn-secondary', disabled: loopState.mutationBusy ? 'disabled' : null,
      'data-loop-focus-key': `result-submit:${plan.id}`,
    }, [t('product_loop_record_result', state.lang)]),
  ]) : null;
  if (resultForm) resultForm.addEventListener('input', () => {
    handlers.onResultDraft(plan.id, {
      summary: resultForm.elements.summary.value,
      evidence: resultForm.elements.evidence.value,
    });
  });
  if (resultForm) resultForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onResultDraft(plan.id, {
      summary: resultForm.elements.summary.value,
      evidence: resultForm.elements.evidence.value,
    });
    handlers.onRecordResult(plan, {
      revisionNumber: plan.revision_number,
      summary: resultForm.elements.summary.value,
      evidence: resultForm.elements.evidence.value.trim() || null,
    });
  });
  const start = !plan.development_run && canLoop(loopState, 'product_change_execute')
    ? el('button', {
      type: 'button', class: 'btn-primary', disabled: loopState.mutationBusy ? 'disabled' : null,
      'data-loop-start-development': String(plan.id),
      'data-loop-focus-key': `start:${plan.id}`,
    }, [t('product_loop_approve_and_start', state.lang)]) : null;
  start?.addEventListener('click', () => handlers.onRequestStart(plan));
  const edit = !plan.development_run && canLoop(loopState, 'product_change_plan_manage') ? el('button', {
    type: 'button', class: 'btn-secondary', disabled: loopState.mutationBusy ? 'disabled' : null,
    'data-loop-edit-plan': String(plan.id),
    'data-loop-focus-key': `edit:${plan.id}`,
  }, [t('product_loop_edit_revision', state.lang)]) : null;
  edit?.addEventListener('click', () => handlers.onEditPlan(plan.id));
  return el('article', { class: 'product-loop-plan-card' }, [
    el('div', { class: 'product-loop-plan-head' }, [
      el('h3', null, [`${t('product_loop_plan', state.lang)} #${plan.id} · r${plan.revision_number}`]),
      el('span', { class: approved ? 'tag t-ok' : 'tag t-warn' }, [
        t(approved ? 'product_loop_approved' : 'product_loop_draft', state.lang),
      ]),
    ]),
    el('p', null, [plan.change_content]),
    el('dl', { class: 'loop-plan-facts' }, [
      el('dt', null, [t('product_loop_hash', state.lang)]),
      el('dd', { class: 'mono' }, [plan.plan_sha256]),
      ...(plan.linked_lp ? [
        el('dt', null, [t('product_loop_linked_lp', state.lang)]),
        el('dd', { class: 'mono' }, [plan.linked_lp]),
      ] : []),
    ]),
    plan.last_approved_revision
      && String(plan.last_approved_revision.revision_number) !== String(plan.revision_number)
      ? el('div', { class: 'note w product-loop-prior-approval' }, [
        tp('product_loop_prior_approval', state.lang, {
          revision: plan.last_approved_revision.revision_number,
          hash: plan.last_approved_revision.approved_sha256,
        }),
        el('div', { class: 'mono' }, [
          formatLoopTimestamp(plan.last_approved_revision.approved_at_utc, state.lang),
        ]),
      ]) : null,
    plan.sources?.length ? el('section', { class: 'loop-plan-sources' }, [
      el('h4', null, [t('product_loop_source_feedback', state.lang)]),
      el('ul', null, plan.sources.map((source) => el('li', null, [
        `#${source.id} · ${source.org_name} · ${source.title}`,
      ]))),
    ]) : null,
    el('h4', null, [t('product_loop_readiness', state.lang)]),
    el('ul', null, plan.readiness_criteria.map((item) => el('li', null, [item]))),
    el('h4', null, [t('product_loop_risks', state.lang)]),
    plan.risks.length ? el('ul', null, plan.risks.map((item) => el('li', null, [item])))
      : el('p', { class: 'muted' }, [t('product_loop_no_risks', state.lang)]),
    el('div', { class: 'loop-plan-actions' }, [start, edit]),
    buildDevelopmentRun(plan, loopState, state, handlers),
    buildLoopTimeline(plan, state.lang),
    plan.results?.length ? el('section', { class: 'loop-plan-results' }, [
      el('h4', null, [t('product_loop_recorded_results', state.lang)]),
      ...plan.results.map((result) => el('article', null, [
        el('b', null, [result.summary]),
        result.evidence ? el('p', null, [result.evidence]) : null,
        el('small', { class: 'mono muted' }, [
          formatLoopTimestamp(result.recorded_at_utc, state.lang),
        ]),
      ])),
    ]) : null,
    resultForm,
  ]);
}

export function renderProductLoopWorkspace(state, handlers) {
  const loopState = state.loopState;
  const registryItems = loopState.registry.items || [];
  const master = el('aside', { class: 'product-loop-master', 'aria-label': t('product_loop_registry', state.lang) }, [
    el('h2', null, [t('product_loop_registry', state.lang)]),
    registryItems.length ? el('div', { class: 'product-loop-registry-list' }, registryItems.map((item) => {
      const button = el('button', {
        type: 'button',
        class: String(item.id) === String(loopState.selectedFeedbackId) ? 'loop-registry-item selected' : 'loop-registry-item',
        'aria-current': String(item.id) === String(loopState.selectedFeedbackId) ? 'true' : null,
        'data-loop-feedback-id': String(item.id),
        'data-loop-focus-key': `feedback:${item.id}`,
      }, [
        el('span', { class: 'loop-registry-org' }, [item.org_name]),
        el('b', null, [item.title]),
        el('span', { class: `tag loop-state-${item.state}` }, [feedbackStateLabel(item.state, state.lang)]),
      ]);
      button.addEventListener('click', () => handlers.onSelectFeedback(item.id));
      return button;
    })) : el('div', { class: 'note info' }, [t('product_loop_registry_empty', state.lang)]),
    buildCompactPager(
      loopState.registry, state.lang, handlers.onFeedbackRegistryPage, 'registry-page',
    ),
    el('h3', null, [t('product_loop_plan_pages', state.lang)]),
    buildCompactPager(loopState.planPage, state.lang, handlers.onPlanPage, 'plan-page'),
  ]);
  let detailBody;
  if (loopState.detailLoading && !loopState.detail) {
    detailBody = el('div', { class: 'note info', role: 'status' }, [t('x_loading', state.lang)]);
  } else if (!loopState.detail) {
    detailBody = el('div', { class: 'product-loop-empty-detail' }, [
      el('h2', null, [t('product_loop_select_feedback', state.lang)]),
      el('p', { class: 'muted' }, [t('product_loop_select_feedback_note', state.lang)]),
    ]);
  } else {
    const detail = loopState.detail;
    const relatedPlans = relatedProductLoopPlans(loopState, detail);
    detailBody = el('div', { class: 'product-loop-detail-body' }, [
      el('div', { class: 'product-loop-detail-head' }, [
        el('div', null, [
          el('span', { class: 'loop-registry-org' }, [detail.org_name]),
          el('h2', { id: 'product-loop-detail-heading', tabindex: '-1' }, [detail.title]),
          el('p', { class: 'muted' }, [
            `#${detail.id} · ${t(`role_${detail.submitter_role}`, state.lang)} · ${formatLoopTimestamp(detail.submitted_at_utc, state.lang)}`,
          ]),
          detail.originating_surface ? el('p', { class: 'muted' }, [
            `${t('product_loop_originating_surface', state.lang)}: ${t(`nav_${detail.originating_surface}`, state.lang)}`,
          ]) : null,
        ]),
        el('span', { class: `tag loop-state-${detail.state}` }, [feedbackStateLabel(detail.state, state.lang)]),
      ]),
      el('p', { class: 'product-loop-feedback-body' }, [detail.body]),
      canLoop(loopState, 'product_change_plan_manage') ? el('section', { class: 'product-loop-section' }, [
        buildPreparationPanel(detail, loopState, state, handlers),
        buildPlanForm(detail, loopState, state, handlers),
      ]) : null,
      ...relatedPlans.map((plan) => buildPlanCard(plan, loopState, state, handlers)),
      buildCompactPager(
        detail.plans, state.lang, handlers.onDetailPlanPage, `detail-plan-page:${detail.id}`,
      ),
    ]);
  }
  return el('div', { class: 'product-loop-page' }, [
    el('header', { class: 'product-loop-header' }, [
      buildBrand(state.lang),
      el('div', { class: 'product-loop-title' }, [
        el('h1', null, [t('product_loop_title', state.lang)]),
        el('p', null, [t('product_loop_subtitle', state.lang)]),
      ]),
      el('span', { class: 'spacer' }, []),
      el('span', { class: 'chip role-badge' }, [t('role_loop_admin', state.lang)]),
      buildLangSwitcher(state.lang, handlers.onLang),
      buildLogout(state.lang, handlers.onLogout),
    ]),
    el('div', { class: 'note w' }, [t('product_feedback_no_pii', state.lang)]),
    loopState.error ? buildErrorNote(loopState.error.key || loopState.error, state.lang) : null,
    loopState.loading ? el('div', { class: 'note info', role: 'status' }, [t('x_loading', state.lang)]) : null,
    buildProductLoopStaleStatus(loopState, state),
    el('main', { class: 'product-loop-layout' }, [
      master,
      el('section', { class: 'product-loop-detail', 'aria-live': 'polite' }, [detailBody]),
    ]),
  ]);
}

// --- Data workspace (Story 5.1) -------------------------------------------

function importStatusLabel(status, lang) {
  return t(`import_status_${status}`, lang);
}

function dataPhase(dataState) {
  if (dataState.activating) return 'activating';
  if (dataState.uploading) return 'uploading';
  if (dataState.uploadOutcome === 'duplicate') return 'duplicate';
  if (dataState.selected) {
    if (['active', 'activation_failed'].includes(dataState.selected.activation_state)) {
      return dataState.selected.activation_state;
    }
    return dataState.selected.status;
  }
  if (dataState.file) return 'selected';
  return 'idle';
}

export async function retryFileMatchesBatch(file, batch) {
  if (!(
    file
    && batch
    && (batch.original_filename === 'upload.xlsx' || file.name === batch.original_filename)
    && Number(file.size) === Number(batch.accepted_byte_size)
    && /^[0-9a-f]{64}$/i.test(batch.workbook_sha256 || '')
    && typeof file.arrayBuffer === 'function'
    && globalThis.crypto
    && globalThis.crypto.subtle
  )) return false;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
  return actual === batch.workbook_sha256.toLowerCase();
}

function buildImportStages(dataState, lang) {
  const phase = dataPhase(dataState);
  const current = {
    idle: 'select',
    selected: 'upload',
    uploading: 'upload',
    uploaded: 'review',
    parsing: 'review',
    invalid: 'review',
    failed: 'review',
    duplicate: 'review',
    valid: 'activate',
    activating: 'activate',
    active: 'activate',
    activation_failed: 'activate',
  }[phase] || 'select';
  const order = ['select', 'upload', 'review', 'activate'];
  const currentIndex = order.indexOf(current);
  return el('ol', { class: 'import-stages', 'aria-label': t('data_stages', lang) },
    order.map((stage, index) =>
      el('li', {
        class: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : '',
        'aria-current': index === currentIndex ? 'step' : null,
      }, [
        el('span', { 'aria-hidden': 'true' }, [index < currentIndex ? '✓' : index === currentIndex ? '●' : '○']),
        t(`data_stage_${stage}`, lang),
      ]),
    ),
  );
}

function buildPagination(meta, lang, onPage, labelKey) {
  const page = meta || {};
  const offset = page.offset || 0;
  const limit = page.limit || 25;
  const count = page.count || 0;
  const total = page.total || 0;
  const pageContext = tf(
    'data_pagination', lang, nf(offset + count, lang, 0), nf(total, lang, 0),
  );
  const previous = el('button', {
    type: 'button',
    disabled: offset <= 0 ? 'disabled' : null,
    'aria-label': `${t('data_previous', lang)} · ${pageContext}`,
  }, [t('data_previous', lang)]);
  previous.addEventListener('click', () => onPage(Math.max(0, offset - limit)));
  const next = el('button', {
    type: 'button',
    disabled: page.has_more ? null : 'disabled',
    'aria-label': `${t('data_next', lang)} · ${pageContext}`,
  }, [t('data_next', lang)]);
  next.addEventListener('click', () => onPage(offset + limit));
  const landmarkLabel = `${t(labelKey, lang)} · ${pageContext}`;
  return el('nav', { class: 'data-pagination', 'aria-label': landmarkLabel }, [
    previous,
    el('span', {
      class: 'mono',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    }, [pageContext]),
    next,
  ]);
}

function buildDataTableRegion(table, label) {
  if (!table) return null;
  return el('div', {
    class: 'data-table-scroll',
    role: 'region',
    'aria-label': label,
    tabindex: '0',
  }, [table]);
}

function buildImportDisclosure(table, label) {
  if (!table) return null;
  return el('details', { class: 'import-reconciliation-disclosure' }, [
    el('summary', null, [label]),
    buildDataTableRegion(table, label),
  ]);
}

function buildImportReconciliation(selected, lang) {
  const summary = selected.summary || {};
  const sheets = Object.entries(summary.sheets || {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const comparison = summary.comparison || {};
  const measures = ['units', 'statuses', 'prices'].filter((name) => comparison[name]);
  const reconciled = Object.entries(summary.reconciliation || {}).flatMap(
    ([category, counts]) => Object.entries(counts || {}).map(([name, count]) => ({
      category,
      name,
      count,
    })),
  );
  if (!sheets.length && !measures.length && !reconciled.length) return null;

  const sheetTable = sheets.length
    ? el('table', { class: 'data-table sheet-counts' }, [
        el('caption', null, [t('data_sheet_counts', lang)]),
        el('thead', null, [el('tr', null, [
          el('th', { scope: 'col' }, [t('data_sheet', lang)]),
          el('th', { scope: 'col' }, [t('data_source_rows', lang)]),
          el('th', { scope: 'col' }, [t('data_accepted_rows', lang)]),
          el('th', { scope: 'col' }, [t('data_duplicate_rows', lang)]),
        ])]),
        el('tbody', null, sheets.map(([name, counts]) => el('tr', null, [
          el('th', { scope: 'row' }, [name]),
          el('td', { class: 'mono' }, [nf(counts.source_rows ?? 0, lang, 0)]),
          el('td', { class: 'mono' }, [nf(counts.accepted_rows ?? 0, lang, 0)]),
          el('td', { class: 'mono' }, [nf(counts.duplicate_rows ?? 0, lang, 0)]),
        ]))),
      ])
    : null;
  const comparisonTable = measures.length
    ? el('table', { class: 'data-table import-comparison' }, [
        el('caption', null, [t('data_comparison', lang)]),
        el('thead', null, [el('tr', null, [
          el('th', { scope: 'col' }, [t('data_measure', lang)]),
          el('th', { scope: 'col' }, [t('data_prior', lang)]),
          el('th', { scope: 'col' }, [t('data_new', lang)]),
        ])]),
        el('tbody', null, measures.map((name) => el('tr', null, [
          el('th', { scope: 'row' }, [t(`data_${name}`, lang)]),
          el('td', { class: 'mono' }, [nf(comparison[name].prior ?? 0, lang, 0)]),
          el('td', { class: 'mono' }, [nf(comparison[name].new ?? 0, lang, 0)]),
        ]))),
      ])
    : null;
  const entityTable = reconciled.length
    ? el('table', { class: 'data-table entity-counts' }, [
        el('caption', null, [t('data_entity_reconciliation', lang)]),
        el('thead', null, [el('tr', null, [
          el('th', { scope: 'col' }, [t('data_category', lang)]),
          el('th', { scope: 'col' }, [t('data_measure', lang)]),
          el('th', { scope: 'col' }, [t('data_count', lang)]),
        ])]),
        el('tbody', null, reconciled.map((item) => el('tr', null, [
          el('td', null, [t(`data_reconciliation_${item.category}`, lang)]),
          el('th', { scope: 'row' }, [t(`data_${item.name}`, lang)]),
          el('td', { class: 'mono' }, [nf(item.count, lang, 0)]),
        ]))),
      ])
    : null;
  return el('div', { class: 'import-reconciliation' }, [
    buildImportDisclosure(sheetTable, t('data_sheet_counts', lang)),
    buildImportDisclosure(comparisonTable, t('data_comparison', lang)),
    buildImportDisclosure(entityTable, t('data_entity_reconciliation', lang)),
  ]);
}

function buildImportHistory(dataState, lang, handlers) {
  const items = dataState.batches || [];
  if (!items.length) {
    return el('p', { class: 'empty-copy' }, [t('data_history_empty', lang)]);
  }
  const list = el('ul', { class: 'import-history' }, items.map((batch) => {
    const button = el('button', {
      type: 'button',
      class: dataState.selected && dataState.selected.id === batch.id ? 'import-row selected' : 'import-row',
      'aria-current': dataState.selected && dataState.selected.id === batch.id ? 'true' : null,
    }, [
      el('span', { class: 'mono' }, [`#${batch.id}`]),
      el('strong', { class: 'import-filename' }, [batch.original_filename || '—']),
      el('span', { class: `status-tag ${batch.status}` }, [importStatusLabel(batch.status, lang)]),
      el('span', { class: 'import-received-at mono' }, [
        `${t('data_last_received_at', lang)}: ${batch.last_received_at_utc || '—'}`,
      ]),
      el('span', { class: 'import-counts' }, [
        `${t('data_errors', lang)} ${nf(batch.error_count || 0, lang, 0)} · ` +
        `${t('data_warnings', lang)} ${nf(batch.warning_count || 0, lang, 0)}`,
      ]),
    ]);
    button.addEventListener('click', () => handlers.onSelect(batch.id));
    return el('li', null, [button]);
  }));
  return el('div', null, [
    list,
    buildPagination(dataState.historyPagination, lang, handlers.onHistoryPage, 'data_history'),
  ]);
}

function buildActivationConfirmation(confirmation, lang) {
  const targets = confirmation.targets || [];
  return el('div', { class: 'activation-confirmation-scope' }, [
    el('p', null, [t(confirmation.message_key, lang)]),
    el('dl', { class: 'import-summary' }, [
      el('div', null, [el('dt', null, [t('data_as_of', lang)]), el('dd', { class: 'mono' }, [confirmation.source_as_of_utc || '—'])]),
      el('div', null, [el('dt', null, [t('data_hash', lang)]), el('dd', { class: 'mono' }, [confirmation.checksum_prefix || '—'])]),
    ]),
    buildDataTableRegion(el('table', { class: 'data-table activation-scope-table' }, [
      el('caption', null, [t('data_activation_scope', lang)]),
      el('thead', null, [el('tr', null, [
        el('th', { scope: 'col' }, [t('data_projects', lang)]),
        el('th', { scope: 'col' }, [t('data_current_version', lang)]),
        el('th', { scope: 'col' }, [t('data_units', lang)]),
        el('th', { scope: 'col' }, [t('data_statuses', lang)]),
        el('th', { scope: 'col' }, [t('data_prices', lang)]),
      ])]),
      el('tbody', null, targets.map((target) => el('tr', null, [
        el('th', { scope: 'row' }, [target.project_name || target.project_external_id]),
        el('td', { class: 'mono' }, [target.current_active_version
          ? `v${target.current_active_version.version_sequence}`
          : t('data_no_active_version', lang)]),
        el('td', { class: 'mono' }, [nf((target.incoming_counts || {}).units || 0, lang, 0)]),
        el('td', { class: 'mono' }, [nf((target.incoming_counts || {}).statuses || 0, lang, 0)]),
        el('td', { class: 'mono' }, [nf((target.incoming_counts || {}).prices || 0, lang, 0)]),
      ]))),
    ]), t('data_activation_scope', lang)),
  ]);
}

function buildActiveInventory(dataState, lang, handlers, activationPending = false) {
  const items = ((dataState.activeInventory || {}).items) || [];
  const openTable = items.length ? el('button', {
    type: 'button', class: 'btn-primary', 'data-open-operational-desk': '1',
    disabled: activationPending ? 'disabled' : null,
  }, [t('inventory_open_table', lang)]) : null;
  if (openTable && handlers.onOpenOperationalDesk) {
    openTable.addEventListener('click', handlers.onOpenOperationalDesk);
  }
  return el('section', { class: 'card active-inventory', 'aria-labelledby': 'active-inventory-title' }, [
    el('h2', { id: 'active-inventory-title', tabindex: '-1' }, [t('data_active_inventory', lang)]),
    openTable,
    items.length
      ? el('ul', { class: 'active-inventory-list' }, items.map((item) => el('li', null, [
          el('strong', null, [item.project_name || item.project_external_id]),
          (() => {
            const open = el('button', {
              type: 'button', class: 'btn-ghost', 'data-open-project': String(item.project_id),
              disabled: activationPending ? 'disabled' : null,
            }, [t('x_open_project', lang)]);
            open.addEventListener('click', () => handlers.onOpenOperationalDesk(String(item.project_id)));
            return open;
          })(),
          el('span', { class: 'status-tag active' }, [t('import_status_active', lang)]),
          el('span', { class: 'mono' }, [
            `v${item.version_sequence} · ${item.source_as_of_utc} · ${item.checksum_prefix}`,
          ]),
          el('span', { class: 'mono' }, [
            `${t('data_activated_at', lang)} ${item.activated_at_utc} · `
            + `${t('data_actor', lang)} ${t('preview_actor', lang)}`,
          ]),
          el('span', null, [
            `${t('data_units', lang)} ${nf(item.unit_count, lang, 0)} · `
            + `${t('data_statuses', lang)} ${nf(item.status_count, lang, 0)} · `
            + `${t('data_prices', lang)} ${nf(item.price_count, lang, 0)}`,
          ]),
          el('span', null, [t(
            item.inventory_ready && (item.reconciliation || {}).matched
              ? 'data_reconciled'
              : 'data_not_reconciled',
            lang,
          )]),
        ])))
      : el('p', { class: 'empty-copy' }, [t('data_no_active_inventory', lang)]),
  ]);
}

function buildVersionHistory(dataState, lang, handlers) {
  const items = dataState.versionHistory || [];
  const body = items.length
    ? el('table', { class: 'data-table version-history-table' }, [
        el('thead', null, [el('tr', null, [
          el('th', { scope: 'col' }, [t('data_version', lang)]),
          el('th', { scope: 'col' }, [t('data_projects', lang)]),
          el('th', { scope: 'col' }, [t('data_as_of', lang)]),
          el('th', { scope: 'col' }, [t('data_activated_at', lang)]),
          el('th', { scope: 'col' }, [t('data_actor', lang)]),
          el('th', { scope: 'col' }, [t('data_count', lang)]),
          el('th', { scope: 'col' }, [t('data_hash', lang)]),
          el('th', { scope: 'col' }, [t('data_readiness', lang)]),
        ])]),
        el('tbody', null, items.map((item) => el('tr', {
          class: item.is_active ? 'active-version-row' : '',
        }, [
          el('th', { scope: 'row' }, [
            `v${item.version_sequence} `,
            item.is_active ? el('span', { class: 'status-tag active' }, [t('import_status_active', lang)]) : null,
          ]),
          el('td', null, [item.project_name || item.project_external_id]),
          el('td', { class: 'mono' }, [item.source_as_of_utc]),
          el('td', { class: 'mono' }, [item.activated_at_utc]),
          el('td', { class: 'mono' }, [t('preview_actor', lang)]),
          el('td', { class: 'mono' }, [`${item.unit_count}/${item.status_count}/${item.price_count}`]),
          el('td', { class: 'mono' }, [item.checksum_prefix]),
          el('td', null, [t(item.inventory_ready ? 'data_reconciled' : 'data_not_reconciled', lang)]),
        ]))),
      ])
    : el('p', { class: 'empty-copy' }, [t('data_version_history_empty', lang)]);
  return el('section', { class: 'card version-history', 'aria-labelledby': 'version-history-title' }, [
    el('h2', { id: 'version-history-title', tabindex: '-1' }, [t('data_version_history', lang)]),
    el('p', { class: 'muted' }, [t('data_version_history_read_only', lang)]),
    dataState.versionLoading
      ? el('p', { role: 'status' }, [t('x_loading', lang)])
      : items.length ? buildDataTableRegion(body, t('data_version_history', lang)) : body,
    buildPagination(
      dataState.versionHistoryPagination,
      lang,
      handlers.onVersionHistoryPage,
      'data_version_history',
    ),
  ]);
}

function buildIssueList(dataState, lang, handlers) {
  const selected = dataState.selected;
  if (!selected) return null;
  const severityFilters = el('div', { class: 'issue-filters', role: 'group', 'aria-label': t('data_issue_filter', lang) },
    [null, 'error', 'warning'].map((severity) => {
      const button = el('button', {
        type: 'button',
        class: dataState.severity === severity ? 'filter on' : 'filter',
        'aria-pressed': dataState.severity === severity ? 'true' : 'false',
      }, [t(severity ? `data_${severity}s` : 'data_all_issues', lang)]);
      button.addEventListener('click', () => handlers.onSeverity(severity));
      return button;
    }),
  );
  const filterForm = el('form', {
    class: 'issue-filter-fields',
    'aria-label': t('data_issue_filter', lang),
  }, [
    ...['sheet', 'field', 'code'].map((name) => el('label', null, [
      t(`data_filter_${name}`, lang),
      el('input', {
        type: 'search',
        name,
        value: (dataState.issueFilters || {})[name] || '',
      }),
    ])),
    el('button', { type: 'submit' }, [t('data_apply_filters', lang)]),
  ]);
  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onIssueFilters({
      sheet: filterForm.elements.sheet.value.trim() || null,
      field: filterForm.elements.field.value.trim() || null,
      code: filterForm.elements.code.value.trim() || null,
    });
  });
  const issues = selected.issues || [];
  const list = issues.length
    ? el('table', { class: 'data-table issue-table' }, [
        el('thead', null, [el('tr', null, [
          el('th', { scope: 'col' }, [t('data_issue_severity', lang)]),
          el('th', { scope: 'col' }, [t('data_issue_message', lang)]),
          el('th', { scope: 'col' }, [t('data_issue_sheet', lang)]),
          el('th', { scope: 'col' }, [t('data_issue_cell', lang)]),
          el('th', { scope: 'col' }, [t('data_issue_entity', lang)]),
          el('th', { scope: 'col' }, [t('data_issue_external_id', lang)]),
          el('th', { scope: 'col' }, [t('data_issue_remediation', lang)]),
        ])]),
        el('tbody', null, issues.map((item) => el('tr', { class: `issue ${item.severity}` }, [
          el('td', null, [
            el('span', { class: `status-tag ${item.severity}` }, [t(`data_${item.severity}`, lang)]),
          ]),
          el('th', { scope: 'row' }, [tp(item.message_key, lang, item.params || {})]),
          el('td', { class: 'issue-location mono' }, [item.sheet || '—']),
          el('td', { class: 'issue-location mono' }, [
            `${item.excel_cell || '—'}${item.row_number ? ` · ${t('data_row', lang)} ${item.row_number}` : ''}${item.field ? ` · ${item.field}` : ''} · ${item.code}`,
          ]),
          el('td', { class: 'issue-entity mono' }, [item.entity_type || '—']),
          el('td', { class: 'issue-external-id mono' }, [item.external_id || '—']),
          el('td', { class: 'issue-remediation' }, [t(item['re' + 'covery_hint'], lang)]),
        ]))),
      ])
    : el('p', { class: 'empty-copy' }, [t('data_no_issues', lang)]);
  return el('section', { class: 'card import-issues', 'aria-labelledby': 'data-issues-title' }, [
    el('h2', { id: 'data-issues-title', tabindex: '-1' }, [t('data_issues', lang)]),
    severityFilters,
    filterForm,
    issues.length ? buildDataTableRegion(list, t('data_issues', lang)) : list,
    buildPagination(selected.issues_pagination, lang, handlers.onIssuePage, 'data_issues'),
  ]);
}

export function renderDataWorkspace(state, handlers) {
  const { lang } = state;
  const dataState = state.dataState || {};
  const selected = dataState.selected;
  const uploadLocked = state.dataActivationPending || dataState.calculatingProject != null;
  const fileInput = el('input', {
      id: 'inventory-workbook',
      name: 'workbook',
      tabindex: dataState.createOnly ? '-1' : null,
      disabled: uploadLocked ? 'disabled' : null,
      type: 'file',
      accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) handlers.onFileSelected(file);
  });
  const choose = el('button', {
    type: 'button', class: 'btn-primary', 'data-choose-workbook': '1',
    disabled: uploadLocked ? 'disabled' : null,
  }, [t('x_project_upload_data', lang)]);
  choose.addEventListener('click', () => fileInput.click());
  const dropTarget = el('div', {
      class: 'workbook-drop-target',
  }, [
    el('label', { for: 'inventory-workbook' }, [t('data_drop_workbook', lang)]),
    fileInput,
    dataState.createOnly ? choose : null,
  ]);
  dropTarget.addEventListener('dragover', (event) => event.preventDefault());
  dropTarget.addEventListener('drop', (event) => {
    event.preventDefault();
    const files = event.dataTransfer && event.dataTransfer.files;
    if (files && files.length !== 1) {
      handlers.onFileRejected('import_multiple_files_prohibited');
      return;
    }
    const file = files && files[0];
    if (file) handlers.onFileSelected(file);
  });
  const form = el('form', { class: 'import-upload' }, [
    dropTarget,
    dataState.file
      ? el('p', { class: 'selected-file', role: 'status' }, [
          `${t('data_selected_file', lang)}: ${dataState.file.name} · ` +
          `${t('data_file_size', lang)}: ${dataState.file.size == null ? '—' : nf(dataState.file.size, lang, 0)} B · ` +
          `${t('data_contract_version', lang)}: 1.0`,
        ])
      : null,
    dataState.createOnly && (!dataState.file || selected?.activation_state === 'active') ? null : el('button', {
      type: 'submit',
      class: 'btn-primary',
      disabled: uploadLocked || dataState.uploading || !dataState.file ? 'disabled' : null,
    }, [t(dataState.uploading ? 'data_uploading' : 'data_upload', lang)]),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = dataState.file || (form.elements.workbook.files && form.elements.workbook.files[0]);
    if (file) handlers.onUpload(file);
  });

  const activationButton = el('button', {
        type: 'button',
        class: 'btn-primary',
        disabled: selected && selected.status === 'valid' && selected.inventory_ready
          && (!selected.activation_state
            || selected.activation_state === 'not_started'
            || (selected.activation_state === 'activation_failed'
              && selected.activation_retryable))
          && !dataState.activating && !dataState.confirmationLoading
          ? null : 'disabled',
        'data-confirm-activation': 'true',
        'aria-busy': dataState.activating || dataState.confirmationLoading ? 'true' : null,
      }, [t(
        dataState.activating
          ? 'data_activating'
          : dataState.confirmationLoading
            ? 'data_activation_confirmation_loading'
            : 'data_activate_dataset',
        lang,
      )]);
  activationButton.addEventListener('click', handlers.onRequestActivation);
  const review = selected
    ? el('section', { class: 'card import-review', 'aria-labelledby': 'data-review-title' }, [
        el('div', { class: 'section-head' }, [
          el('h2', { id: 'data-review-title', tabindex: '-1' }, [
            `${t('data_review', lang)}: ${selected.original_filename || '—'} · #${selected.id}`,
          ]),
          el('span', { class: `status-tag ${selected.status}` }, [importStatusLabel(selected.status, lang)]),
        ]),
        el('dl', { class: 'import-summary' }, [
          el('div', null, [el('dt', null, [t('data_inventory_ready', lang)]), el('dd', null, [t(selected.inventory_ready ? 'yes' : 'no', lang)])]),
          el('div', null, [el('dt', null, [t('data_dco_ready', lang)]), el('dd', null, [t(selected.dco_ready ? 'yes' : 'no', lang)])]),
          el('div', null, [el('dt', null, [t('data_projects', lang)]), el('dd', { class: 'mono' }, [((selected.summary || {}).affected_project_ids || []).join(', ') || '—'])]),
          el('div', null, [el('dt', null, [t('data_as_of', lang)]), el('dd', { class: 'mono' }, [selected.workbook_as_of_utc || '—'])]),
          el('div', null, [el('dt', null, [t('data_actor', lang)]), el('dd', { class: 'mono' }, [selected.actor_user_id == null ? '—' : String(selected.actor_user_id)])]),
          el('div', null, [el('dt', null, [t('data_errors', lang)]), el('dd', { class: 'mono' }, [nf(selected.error_count || 0, lang, 0)])]),
          el('div', null, [el('dt', null, [t('data_warnings', lang)]), el('dd', { class: 'mono' }, [nf(selected.warning_count || 0, lang, 0)])]),
          el('div', null, [el('dt', null, [t('data_hash', lang)]), el('dd', { class: 'mono hash' }, [selected.canonical_sha256 || '—'])]),
          el('div', null, [el('dt', null, [t('data_source_filename', lang)]), el('dd', { class: 'mono' }, [selected.original_filename || '—'])]),
          el('div', null, [el('dt', null, [t('data_original_uploaded_at', lang)]), el('dd', { class: 'mono' }, [selected.uploaded_at_utc || '—'])]),
          el('div', null, [el('dt', null, [t('data_last_received_at', lang)]), el('dd', { class: 'mono' }, [selected.last_received_at_utc || '—'])]),
          el('div', null, [el('dt', null, [t('data_source_bytes', lang)]), el('dd', { class: 'mono' }, [selected.accepted_byte_size == null ? '—' : nf(selected.accepted_byte_size, lang, 0)])]),
          el('div', null, [el('dt', null, [t('data_workbook_hash', lang)]), el('dd', { class: 'mono hash' }, [selected.workbook_sha256 || '—'])]),
          el('div', null, [el('dt', null, [t('data_failure_reason', lang)]), el('dd', null, [selected.failure_key ? t(selected.failure_key, lang) : '—'])]),
        ]),
        buildImportReconciliation(selected, lang),
        selected.status === 'failed'
          ? (() => {
              const retry = el('button', { type: 'button' }, [t('data_retry', lang)]);
              retry.addEventListener('click', () => handlers.onRetry(selected));
              return retry;
            })()
          : null,
        dataState.activationResult
          ? el('div', {
              class: 'note info activation-result',
              role: 'status',
              'aria-live': 'polite',
              'aria-atomic': 'true',
            }, [t(
              dataState.activationResult.outcome === 'existing'
                ? 'data_activation_existing'
                : dataState.createOnly ? 'x_project_created' : 'data_activation_succeeded',
              lang,
            )])
          : null,
        selected.activation_state === 'activation_failed'
          ? el('div', { class: 'note danger', role: 'alert' }, [
              t('data_activation_failed_prior_remains', lang),
              selected.activation_failure_key
                ? ` ${t(selected.activation_failure_key === 'x_import_project_exists'
                  ? 'x_import_project_exists_generic' : selected.activation_failure_key, lang)}`
                : '',
              (() => {
                const recordedTargets = ((selected.activation_scope || {}).targets || []);
                const targets = recordedTargets.length
                  ? recordedTargets
                  : ((selected.summary || {}).affected_project_ids || []).map(
                      (projectId) => ({
                        project_external_id: projectId,
                        project_name: projectId,
                        current_active_version: null,
                      }),
                    );
                if (!targets.length) {
                  return el('p', null, [t('data_activation_no_prior_active', lang)]);
                }
                return el('ul', { class: 'activation-prior-list' }, targets.map((target) => {
                  const active = target.current_active_version;
                  return el('li', null, [
                    active
                      ? `${active.project_name} · ${t('data_version', lang)} ${active.version_sequence}`
                      : `${target.project_name || target.project_external_id} · ${t('data_activation_no_prior_active', lang)}`,
                  ]);
                }));
              })(),
            ])
          : null,
      ])
    : null;
  const error = dataState.error
    ? el('div', { class: 'note danger', role: 'alert', id: 'data-workspace-error', tabindex: '-1' }, [
        tp(dataState.error.key, lang, dataState.error.params || {}),
        ...(dataState.error.issues || []).map((issue) => el('p', null, [
          tp(issue.key, lang, issue.params || {}),
          issue.path ? el('span', { class: 'mono' }, [` · ${issue.path}`]) : null,
          Array.isArray(issue.params?.missing_families)
            ? el('span', { class: 'mono' }, [` · ${issue.params.missing_families.join(', ')}`]) : null,
        ])),
      ])
    : null;
  const duplicate = dataState.uploadOutcome === 'duplicate'
    ? el('div', { class: 'note info duplicate-outcome', role: 'status' }, [
        t('data_duplicate_outcome', lang),
      ])
    : null;
  if (dataState.createOnly) {
    const back = el('button', {
      type: 'button', class: 'btn-ghost', 'data-back-to-projects': '1',
      disabled: state.dataActivationPending ? 'disabled' : null,
    }, [t('x_back_to_projects', lang)]);
    back.addEventListener('click', () => handlers.onOpenOperationalDesk());
    const busy = dataState.calculatingProject != null;
    const targets = dataState.creationTargets || [];
    return el('main', { class: 'data-workspace new-project-workspace' }, [
      el('header', { class: 'data-header' }, [
        buildBrand(lang), buildLandingHeader(state, handlers), buildLogout(lang, handlers.onLogout),
      ]),
      el('div', { class: 'data-main' }, [
        el('h1', { id: 'data-workspace-title', tabindex: '-1' }, [t('x_new_project', lang)]),
        el('nav', { class: 'new-project-navigation', 'aria-label': t('x_project_data_actions', lang) }, [
          buildProjectDataActions(state, handlers), back,
        ]),
        error, duplicate,
        el('section', { class: 'card new-project-upload' }, [
          el('p', null, [t('x_project_empty_help', lang)]), form,
          dataState.file ? el('details', null, [
            el('summary', null, [t('x_project_workbook_title', lang)]),
            el('p', null, [t('x_project_workbook_identity', lang)]),
          ]) : null,
        ]),
        dataState.loading ? el('p', { role: 'status' }, [t('x_loading', lang)]) : null,
        review, buildIssueList(dataState, lang, handlers),
        selected && selected.activation_state !== 'active' ? activationButton : null,
        selected?.activation_state === 'active' && !targets.length
          ? el('p', { role: 'status' }, [t('x_project_duplicate_active', lang)]) : null,
        targets.length ? el('section', { class: 'card created-projects' }, [
          el('h2', { id: 'active-inventory-title', tabindex: '-1' }, [t('x_project_continue', lang)]),
          busy ? el('p', { role: 'status', 'aria-live': 'polite' }, [t('x_project_calculating', lang)]) : null,
          el('ul', { class: 'created-project-list' }, targets.map((item) => {
            const open = el('button', {
              type: 'button', class: 'btn-ghost', 'data-open-project': String(item.project_id),
              'aria-label': `${t('x_open_project', lang)}: ${item.project_name || item.project_external_id}`,
              disabled: busy || state.dataActivationPending ? 'disabled' : null,
            }, [t('x_open_project', lang)]);
            open.addEventListener('click', () => handlers.onOpenOperationalDesk(String(item.project_id), item.id));
            const run = el('button', {
              type: 'button', class: 'btn-primary', 'data-run-project-calculation': String(item.project_id),
              'aria-label': `${t('x_project_run_calculation', lang)}: ${item.project_name || item.project_external_id}`,
              disabled: busy || state.dataActivationPending
                || !dataState.capabilities?.calculation_snapshot_create?.allowed
                || !dataState.capabilities?.calculation_snapshot_run_dco?.allowed ? 'disabled' : null,
            }, [t('x_project_run_calculation', lang)]);
            run.addEventListener('click', () => handlers.onCalculateCreatedProject(item));
            return el('li', null, [el('strong', null, [item.project_name || item.project_external_id]), open, run]);
          })),
        ]) : null,
      ]),
    ]);
  }
  return el('main', { class: 'data-workspace' }, [
    el('header', { class: 'data-header' }, [
      buildBrand(lang),
      buildLandingHeader(state, handlers),
      buildLogout(lang, handlers.onLogout),
    ]),
    el('div', { class: 'data-main' }, [
      el('div', { class: 'data-title' }, [
        el('div', null, [el('h1', { id: 'data-workspace-title', tabindex: '-1' }, [t(dataState.createOnly ? 'x_new_project' : 'nav_data', lang)]), el('p', null, [t('data_subtitle', lang)])]),
        buildImportStages(dataState, lang),
      ]),
      buildProjectDataActions(state, handlers),
      state.dataActivationPending ? el('p', { role: 'status' }, [t('data_activating', lang)]) : null,
      (() => {
        const back = el('button', {
          type: 'button', class: 'btn-ghost', 'data-back-to-projects': '1',
          disabled: state.dataActivationPending ? 'disabled' : null,
        }, [t('x_back_to_projects', lang)]);
        back.addEventListener('click', () => handlers.onOpenOperationalDesk());
        return back;
      })(),
      el('p', { class: 'note info project-import-mode', role: 'status' }, [
        t(dataState.createOnly ? 'x_project_create_mode' : 'x_project_update_mode', lang),
      ]),
      dataState.createOnly ? el('section', { class: 'card new-project-guide' }, [
        el('h2', null, [t('x_project_workbook_title', lang)]),
        el('p', null, [t('x_project_workbook_help', lang)]),
        el('p', null, [t('x_project_workbook_identity', lang)]),
        el('p', null, [t('x_project_calculation_help', lang)]),
      ]) : null,
      error,
      duplicate,
      el('div', { class: 'data-grid' }, [
        el('section', { class: 'card' }, [
          el('h2', null, [t('data_upload_title', lang)]),
          el('p', null, [t('data_upload_help', lang)]),
          el('p', { class: 'note' }, [t('preview_notice', lang)]),
          form,
          activationButton,
          dataState.confirmationLoading
            ? el('p', {
                role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true',
              }, [t('data_activation_confirmation_loading', lang)])
            : null,
        ]),
        el('section', { class: 'card data-history-card', 'aria-labelledby': 'data-history-title' }, [
          el('h2', { id: 'data-history-title', tabindex: '-1' }, [t('data_history', lang)]),
          dataState.loading ? el('p', { role: 'status' }, [t('x_loading', lang)]) : buildImportHistory(dataState, lang, handlers),
        ]),
      ]),
      buildActiveInventory(dataState, lang, handlers, state.dataActivationPending),
      review,
      buildIssueList(dataState, lang, handlers),
      buildVersionHistory(dataState, lang, handlers),
    ]),
  ]);
}

function historyFactLabel(item, lang) {
  if (!item) return t('history_no_fact', lang);
  if (Array.isArray(item)) {
    return item.length
      ? item.map((value) => historyFactLabel(value, lang)).join(' · ')
      : t('history_no_fact', lang);
  }
  if (item.kind === 'restriction') {
    return [item.restriction_kind, item.action]
      .filter(Boolean)
      .map((value) => t(`history_value_${value}`, lang))
      .join(' · ');
  }
  const value = item.status || item.version_label;
  return value == null ? t('history_no_fact', lang) : t(`history_value_${value}`, lang);
}

function historyKindLabel(kind, lang) {
  return kind ? t(`history_kind_${kind}`, lang) : '—';
}

function historyLineageLabel(item, lang) {
  const labels = [];
  if (item.is_current) labels.push(t('history_current', lang));
  if (item.is_superseded) labels.push(t('history_superseded', lang));
  if (item.is_correction) labels.push(t('history_correction', lang));
  if (!labels.length) labels.push(t('history_original', lang));
  return labels.join(' · ');
}

function historyTemplateNodes(key, lang, values, numericIndexes = []) {
  const template = t(key, lang);
  const numeric = new Set(numericIndexes);
  const nodes = [];
  let cursor = 0;
  for (const match of template.matchAll(/\{(\d+)\}/g)) {
    if (match.index > cursor) nodes.push(template.slice(cursor, match.index));
    const index = Number(match[1]);
    const raw = values[index] == null ? '—' : values[index];
    const content = Array.isArray(raw) ? raw : [String(raw)];
    if (numeric.has(index)) nodes.push(el('span', { class: 'num' }, content));
    else nodes.push(...content);
    cursor = match.index + match[0].length;
  }
  if (cursor < template.length) nodes.push(template.slice(cursor));
  return nodes;
}

function joinHistoryGroups(groups) {
  return groups.flatMap((group, index) => (index ? [' · ', ...group] : group));
}

function historySourceNodes(item, lang) {
  return historyTemplateNodes(
    'history_lineage_value', lang,
    [
      item.source_batch_id == null ? '—' : item.source_batch_id,
      item.version_sequence == null ? '—' : item.version_sequence,
    ],
    [0, 1],
  );
}

function scaledHistoryMoneyNodes(value, currency, lang) {
  if (value == null) return ['—'];
  const nodes = [el('span', { class: 'num' }, [nf(Number(value) / 100, lang, 2)])];
  if (currency) nodes.push(` ${currency}`);
  return nodes;
}

function historyTermsNodes(item, lang) {
  const values = [];
  if (item.source_status) {
    values.push(historyTemplateNodes(
      'history_source_status_value', lang, [item.source_status],
    ));
  }
  if (item.reason_code) {
    values.push(historyTemplateNodes('history_reason_value', lang, [item.reason_code]));
  }
  if (item.closed_at_utc) {
    values.push(historyTemplateNodes(
      'history_closed_at_value', lang, [item.closed_at_utc], [0],
    ));
  }
  if (item.cancelled_at_utc) {
    values.push(historyTemplateNodes(
      'history_cancelled_at_value', lang, [item.cancelled_at_utc], [0],
    ));
  }
  if (item.conversion_probability_scaled != null) {
    const probability = Number(item.conversion_probability_scaled) / 1_000_000_000;
    values.push(historyTemplateNodes(
      'history_probability_value', lang, [nf(probability * 100, lang, 2)], [0],
    ));
  }
  if (item.contract_price_scaled != null) {
    values.push(historyTemplateNodes('history_contract_price_value', lang, [
      scaledHistoryMoneyNodes(item.contract_price_scaled, item.currency, lang),
    ]));
  }
  if (item.payment_plan_external_id) {
    values.push(historyTemplateNodes(
      'history_payment_plan_value', lang, [item.payment_plan_external_id],
    ));
  }
  if (item.supersedes_external_event_id) {
    values.push(historyTemplateNodes(
      'history_corrects_value', lang, [item.supersedes_external_event_id],
    ));
  }
  return values.length ? joinHistoryGroups(values) : [];
}

function historyTableHead(keys, lang) {
  return el('thead', null, [
    el('tr', null, keys.map((key) => el('th', { scope: 'col' }, [t(key, lang)]))),
  ]);
}

function historyCurrentFacet(item, key, lang) {
  if (Array.isArray(item)) {
    return item.length
      ? el('div', { class: 'history-current-facts' }, item.map((value) => (
          historyCurrentFacet(value, key, lang)
        )))
      : el('span', null, [t('history_no_fact', lang)]);
  }
  if (!item) return el('span', null, [t('history_no_fact', lang)]);
  const primary = key === 'history_current_price'
    ? scaledHistoryMoneyNodes(item.price_absolute_scaled, item.currency, lang)
    : [historyFactLabel(item, lang)];
  const details = [];
  if (key === 'history_current_price') {
    details.push([
      `${t('history_source_version', lang)}: `,
      String(item.version_label || item.external_id || '—'),
    ]);
    if (item.price_per_area_scaled != null) {
      details.push([
        `${t('history_price_per_area', lang)}: `,
        ...scaledHistoryMoneyNodes(item.price_per_area_scaled, item.currency, lang),
        ` / ${item.area_unit || '—'}`,
      ]);
    }
    if (item.effective_to_utc) {
      details.push([
        `${t('history_effective_to', lang)}: `,
        el('span', { class: 'num' }, [item.effective_to_utc]),
      ]);
    }
  }
  const terms = historyTermsNodes(item, lang);
  if (terms.length) details.push(terms);
  if (item.effective_at_utc) {
    details.push([
      `${t('history_effective_at', lang)}: `,
      el('span', { class: 'num' }, [item.effective_at_utc]),
    ]);
  }
  if (item.recorded_at_utc) {
    details.push([
      `${t('history_recorded_at', lang)}: `,
      el('span', { class: 'num' }, [item.recorded_at_utc]),
    ]);
  }
  if (item.source_batch_id != null || item.version_sequence != null) {
    details.push(historySourceNodes(item, lang));
  }
  return el('div', { class: 'history-current-fact' }, [
    el('strong', null, primary),
    ...details.map((value) => el('span', null, value)),
  ]);
}

function historyPageButton(label, disabled, onClick) {
  const button = el('button', { type: 'button', disabled: disabled ? '' : null }, [label]);
  if (!disabled && onClick) button.addEventListener('click', onClick);
  return button;
}

/** Last-wins state seam for the future Story 5.4 history placement. */
export function createInventoryHistoryState(lang = 'ru') {
  let generation = 0;
  const state = { lang, loading: false, error: null, data: null };
  return {
    state,
    begin() {
      generation += 1;
      state.loading = true;
      state.error = null;
      return generation;
    },
    resolve(token, data) {
      if (token !== generation) return false;
      state.loading = false;
      state.error = null;
      state.data = data;
      return true;
    },
    reject(token, error) {
      if (token !== generation) return false;
      state.loading = false;
      state.error = error;
      return true;
    },
    clear() {
      generation += 1;
      state.loading = false;
      state.error = null;
      state.data = null;
    },
  };
}

/** Reusable Story 5.3 history sections; Story 5.4 owns their eventual surface. */
export function renderInventoryHistory(state, handlers = {}) {
  const lang = state.lang || 'ru';
  const heading = el('h2', { id: 'inventory-history-title', tabindex: '-1' }, [
    t('history_commercial_title', lang),
  ]);
  if (state.loading) {
    return el('section', {
      class: 'inventory-history', 'aria-labelledby': 'inventory-history-title',
    }, [
      heading,
      el('p', { role: 'status', 'aria-live': 'polite' }, [t('x_loading', lang)]),
    ]);
  }
  if (state.error) {
    const retry = historyPageButton(t('history_retry', lang), false, handlers.onRetry);
    return el('section', {
      class: 'inventory-history', 'aria-labelledby': 'inventory-history-title',
    }, [
      heading,
      el('p', { class: 'danger', role: 'alert' }, [
        t(state.error.key || 'x_internal_error', lang),
      ]),
      retry,
    ]);
  }

  const data = state.data || {};
  const current = data.current || {};
  const currentRows = [
    ['history_base_status', current.base_status],
    ['history_restriction', current.restrictions || []],
    ['history_booking', current.booking],
    ['history_sale', current.sale],
    ['history_current_price', current.price],
  ];
  const facets = el('section', {
    class: 'history-facets', 'aria-labelledby': 'history-current-title',
  }, [
    el('h3', { id: 'history-current-title' }, [t('history_current_facets', lang)]),
    el('dl', null, currentRows.flatMap(([key, item]) => [
      el('dt', null, [t(key, lang)]),
      el('dd', null, [historyCurrentFacet(item, key, lang)]),
    ])),
  ]);

  const commercialRows = data.commercial_history || [];
  const commercial = el('section', { 'aria-labelledby': 'commercial-history-title' }, [
    el('h3', { id: 'commercial-history-title', tabindex: '-1' }, [
      t('history_commercial_title', lang),
    ]),
    commercialRows.length
      ? el('table', { class: 'data-table commercial-history-table' }, [
          historyTableHead([
            'history_fact', 'history_state', 'history_terms', 'history_effective_at',
            'history_recorded_at', 'history_source_lineage',
          ], lang),
          el('tbody', null, commercialRows.map((item) => el('tr', null, [
            el('th', { scope: 'row' }, [historyKindLabel(item.kind, lang)]),
            el('td', null, [
              `${historyFactLabel(item, lang)} · ${historyLineageLabel(item, lang)}`,
            ]),
            el('td', null, historyTermsNodes(item, lang).length
              ? historyTermsNodes(item, lang) : ['—']),
            el('td', { class: 'num' }, [String(item.effective_at_utc || '—')]),
            el('td', { class: 'num' }, [String(item.recorded_at_utc || '—')]),
            el('td', null, historySourceNodes(item, lang)),
          ]))),
        ])
      : el('p', { class: 'note history-empty' }, [
          t(Number(data.commercial_total || 0)
            ? 'history_page_empty_commercial'
            : 'history_empty_commercial', lang),
        ]),
  ]);

  const priceRows = data.price_history || [];
  const prices = el('section', { 'aria-labelledby': 'price-history-title' }, [
    el('h3', { id: 'price-history-title', tabindex: '-1' }, [
      t('history_price_title', lang),
    ]),
    priceRows.length
      ? el('table', { class: 'data-table price-history-table' }, [
          historyTableHead([
            'history_state', 'history_effective_at', 'history_recorded_at',
            'history_price_absolute', 'history_price_per_area',
            'history_source_lineage',
          ], lang),
          el('tbody', null, priceRows.map((item) => el('tr', null, [
            el('th', { scope: 'row' }, [
              `${String(item.version_label || '—')} · ${historyFactLabel(item, lang)} · ${historyLineageLabel(item, lang)}`,
            ]),
            el('td', { class: 'num' }, [String(item.effective_at_utc || '—')]),
            el('td', { class: 'num' }, [String(item.recorded_at_utc || '—')]),
            el('td', { class: 'history-number-cell' },
              scaledHistoryMoneyNodes(item.price_absolute_scaled, item.currency, lang)),
            el('td', { class: 'history-number-cell' }, [
              ...scaledHistoryMoneyNodes(item.price_per_area_scaled, item.currency, lang),
              ` / ${item.area_unit || '—'}`,
            ]),
            el('td', null, historySourceNodes(item, lang)),
          ]))),
        ])
      : el('p', { class: 'note history-empty' }, [t(
          Number(data.price_total || 0)
            ? 'history_page_empty_prices'
            : 'history_empty_prices',
          lang,
        )]),
  ]);

  const offset = Number(data.offset || 0);
  const limit = Number(data.limit || 100);
  const total = Math.max(
    Number(data.commercial_total || 0), Number(data.price_total || 0),
  );
  const range = total ? `${offset + 1}–${Math.min(offset + limit, total)}` : '0';
  const changePage = (nextOffset) => {
    const restoreFocus = () => {
      const currentHeading = document.querySelector('#inventory-history-title');
      if (currentHeading) currentHeading.focus();
      else if (heading.isConnected !== false) heading.focus();
    };
    let result;
    try {
      result = handlers.onPage?.(nextOffset);
    } catch {
      restoreFocus();
      return;
    }
    if (result && typeof result.then === 'function') {
      void Promise.resolve(result).catch(() => undefined).finally(restoreFocus);
    } else {
      restoreFocus();
    }
  };
  const pager = el('nav', {
    class: 'history-pagination', 'aria-label': tf('data_pagination', lang, range, total),
  }, [
    historyPageButton(
      t('data_previous', lang), offset <= 0,
      () => changePage(Math.max(0, offset - limit)),
    ),
    el('span', { class: 'num', 'aria-live': 'polite' }, [
      total ? `${range} / ${total}` : '0 / 0',
    ]),
    historyPageButton(
      t('data_next', lang), offset + limit >= total,
      () => changePage(offset + limit),
    ),
  ]);
  return el('section', {
    class: 'inventory-history', 'aria-labelledby': 'inventory-history-title',
  }, [heading, facets, commercial, prices, pager]);
}

// --- the live shell: rail, top bar, tabs, strategy bar (Story 3.3, AC1/AC2) --
//
// The console stops being a placeholder: the chrome renders live from the view
// payload's `chrome` block (assembled server-side in viewmodels/chrome.py). The
// DOM structure and class names are the frozen prototype's, verbatim (AD-14,
// UX-DR13) — the token CSS in styles.css already styles them. The three licensed
// changes carry through: the role badge replaces the prototype's role <select>
// (UX-DR2), permission gating disables the strategy pills for non-directors
// (UX-DR3), and the login surface is separate. The current product surfaces now
// render live bodies when their payload data is present.

// The project tabs in fixed order (UX-DR18): the eight project surfaces, each
// mapped to its nav title key — the prototype's `PROJVIEWS`. The portfolio `all`
// surface is NOT a tab: it is reached only through the rail «По всем проектам»
// entry, and portfolio scope hides the tab strip entirely (prototype `renderShell`
// — `if(S.scope==='all'){tb.style.display='none'}`). A tab switch is instant (no
// fetch gate on the frame) and scrolls the content to the top.
const TAB_ORDER = [
  'today',
  'nep',
  'shelf',
  'release',
  'desk',
  'trend',
  'comp',
  'retro',
];

// QF-008 restores the management navigation over active operational data. The
// unfinished Release and Retrospective surfaces remain unreachable.
// The operational shell now carries the frozen prototype's full project tab set
// (`PROJVIEWS`, prototype line 2817) so nothing the prototype offered silently
// disappears on real data. A tab whose inputs the v1 import contract never
// carries renders its prototype header and an explicit «not in the loaded data»
// note — never a synthetic number.
const OPERATIONAL_TAB_ORDER = [
  'today',
  'nep',
  'shelf',
  'release',
  'desk',
  'trend',
  'comp',
  'retro',
];
const OPERATIONAL_SURFACES = new Set(OPERATIONAL_TAB_ORDER);

// The market → demo-chip key and switcher label. The three demo markets in the
// frozen prototype's switcher order `rf uae kz` (UX-DR13, spine naming row); the
// chip reads as an environment fact, the switcher swaps the dataset (Task 4).
const MARKETS = ['rf', 'uae', 'kz'];
const DEMO_CHIP = { uae: 'demo_uae', rf: 'demo_rf', kz: 'demo_kz' };
const MARKET_LABEL = { uae: 'mk_uae', rf: 'mk_rf', kz: 'mk_kz' };

// The «По всем проектам» portfolio scope/surface id (server `RAIL_ALL_ID`); it is
// both a rail scope and the `all` analytics surface. The first project tab a switch
// falls back to when leaving portfolio scope (the prototype's `openProject` guard).
const PORTFOLIO_ID = 'all';
const FIRST_TAB = 'today';

// The term-set fields a project switch drops so the server re-resolves them to
// their defaults and echoes them back (AD-2 switch-reset: the client resets by
// dropping fields, the server owns the reset values). A project switch resets the
// NEP what-if terms plus release size and window — verbatim from the prototype's
// `openProject` (`resetTerms(); S.relWin=9; S.relSize=defRelSize(...)`), which
// leaves the buyer `segment` untouched. Only the market switch resets segment (it
// drops the whole set, state.termSet = {}). The reset *values* become project-aware
// in Epic 4 (projTerms / defRelSize); here they resolve to the static catalog
// defaults.
const PROJECT_SWITCH_RESET_FIELDS = [
  'plan',
  'escrow_coverage',
  'rate',
  'cut',
  'levers',
  'release_size',
  'release_window',
];

// A shallow copy of `termSet` with `fields` removed — the client-side half of a
// switch-reset (AD-2): the dropped fields resolve server-side to their defaults.
function withoutFields(termSet, fields) {
  const next = { ...(termSet || {}) };
  for (const field of fields) {
    delete next[field];
  }
  return next;
}

function filtersForBuildingBoard(filters) {
  return withoutFields(filters, ['section', 'section_id']);
}

function sectionFromFilters(filters, options) {
  const byId = filters?.section_id == null ? null : (options || []).find(
    (item) => String(item.id) === String(filters.section_id),
  );
  if (byId) return byId.id;
  const byValue = filters?.section == null ? null : (options || []).find(
    (item) => String(item.value) === String(filters.section),
  );
  return byValue?.id ?? null;
}

// Pick the active-language leaf of a bilingual `[ru, en]` value (project names,
// areas). A plain string passes through unchanged. Names are proper-noun data,
// not prose — the payload carries both forms and the client selects (AD-3).
function pick(value, lang) {
  if (Array.isArray(value)) {
    return value[lang === 'en' ? 1 : 0];
  }
  return value;
}

// The avatar glyph for the rail `.pav`: the display name's first character,
// verbatim from the prototype (`pname(pr).slice(0,1)`, UX-DR13) — not a two-letter
// monogram.
function initial(name) {
  return String(name).slice(0, 1);
}

// One rail project row (`.pitem`): avatar, name, status sub-label, ops badge.
// The badge count comes straight from the payload (recounted from the kernel task
// feed on every render, AR-17); it renders only when non-zero.
function buildRailProject(item, lang, onProject) {
  const name = pick(item.name, lang);
  const children = [
    el('span', { class: 'pav' }, [initial(name)]),
    el('span', { class: 'pmid' }, [
      el('span', { class: 'pnm' }, [name]),
      el('span', { class: 'psub' }, [
        `${pick(item.area, lang)} · ${t(`st_${item.status}`, lang)}`,
      ]),
    ]),
  ];
  if (item.badge) {
    children.push(el('span', { class: 'pbadge' }, [String(item.badge)]));
  }
  const btn = el(
    'button',
    {
      type: 'button',
      class: item.active ? 'pitem on' : 'pitem',
      'data-project': item.id,
    },
    children,
  );
  btn.addEventListener('click', () => onProject(item.id));
  return btn;
}

// The rail: brand, the project list with ops badges, the «По всем проектам»
// portfolio entry, and the footer. Off-canvas behind the burger at ≤820 px is a
// CSS/responsive concern (Task 4); the markup is the same.
function buildRail(chrome, state, handlers) {
  const { lang } = state;
  const projects = (chrome.rail || []).map((item) =>
    buildRailProject(item, lang, handlers.onProject),
  );
  const railAll = chrome.rail_all || {};
  // The portfolio entry: `∑` icon, the «По всем проектам» name and its sub-label,
  // and — matching the prototype — no ops badge (only the per-project rows carry
  // one). `nav_all` names it; `rail_all` is the sub-label (verbatim, UX-DR13).
  const allChildren = [
    el('span', { class: 'pav ico' }, ['∑']),
    el('span', { class: 'pmid' }, [
      el('span', { class: 'pnm' }, [t('nav_all', lang)]),
      el('span', { class: 'psub' }, [t(railAll.label_key || 'rail_all', lang)]),
    ]),
  ];
  const allBtn = el(
    'button',
    {
      type: 'button',
      class: railAll.active ? 'pitem allitem on' : 'pitem allitem',
      'data-project': railAll.id || 'all',
    },
    allChildren,
  );
  allBtn.addEventListener('click', () => handlers.onProject(railAll.id || 'all'));

  return el('aside', { class: 'rail', id: 'rail' }, [
    buildBrand(lang),
    el('div', { class: 'railsec' }, [t('rail_proj', lang)]),
    el('div', { class: 'plist' }, projects),
    el('div', { class: 'allwrap' }, [allBtn]),
    el('div', { class: 'railfoot' }, [
      el('b', null, [t('rf_title', lang)]),
      t('rf_sub', lang),
    ]),
  ]);
}

// The market switcher (`.mksw`) — a `role="group"` of the three markets; the
// active market is solid green. Switching swaps the dataset server-side (Task 4).
function buildMarketSwitcher(state, handlers) {
  const buttons = MARKETS.map((mk) =>
    el(
      'button',
      {
        type: 'button',
        class: mk === state.market ? 'on' : null,
        'aria-pressed': mk === state.market ? 'true' : 'false',
        'data-market': mk,
      },
      [t(MARKET_LABEL[mk], state.lang)],
    ),
  );
  const box = el(
    'div',
    { class: 'mksw', role: 'group', 'aria-label': 'market' },
    buttons,
  );
  box.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-market]');
    if (target) {
      handlers.onMarket(target.getAttribute('data-market'));
    }
  });
  return box;
}

// The role badge + its single-item «Выйти» popover (UX-DR2): the badge's only
// interactivity is opening the popover — no role switching. Click toggles it;
// the one item signs out. This is the licensed replacement for the prototype's
// free role <select>.
function buildRoleBadge(state, handlers) {
  const { lang, role } = state;
  const badge = el(
    'button',
    {
      type: 'button',
      class: 'role-badge',
      'aria-haspopup': 'true',
      'aria-expanded': state.roleMenuOpen ? 'true' : 'false',
    },
    [t(`role_${role}`, lang)],
  );
  badge.addEventListener('click', () => handlers.onToggleRoleMenu());
  const children = [badge];
  if (state.roleMenuOpen) {
    const item = el('button', { type: 'button', class: 'pill', role: 'menuitem' }, [
      t('sess_logout', lang),
    ]);
    item.addEventListener('click', () => handlers.onLogout());
    children.push(el('div', { class: 'rolemenu', role: 'menu' }, [item]));
  }
  return el('div', { class: 'rolewrap' }, children);
}

// The top bar (`.top`): burger (mobile rail toggle), breadcrumbs `проект /
// вкладка` (with the neutral «предпросмотр» tag beside them on a preview market),
// the market switcher, demo chip, role badge and language switcher. The demo
// chip and preview tag come from the payload's `format`/`preview` blocks — the
// per-market variant is named server-side, so the client never branches on the
// market key (AD-9).
function buildTopBar(state, chrome, handlers) {
  const { lang } = state;
  const crumb = chrome.breadcrumb || {};
  const format = chrome.format || {};
  const preview = chrome.preview || null;
  const projectName = crumb.project ? pick(crumb.project, lang) : null;
  // `проект / вкладка`, with the active tab bold — verbatim from the prototype
  // (`pname / <b>tab</b>`, UX-DR13); a portfolio scope (no project) shows just the
  // bold «По всем проектам» tab.
  const crumbs = el('div', { class: 'crumbs' }, [
    projectName ? projectName : null,
    projectName ? ' / ' : null,
    el('b', null, [t(`nav_${crumb.tab || state.surface}`, lang)]),
    // The neutral preview tag sits beside the breadcrumbs on RF/KZ (UX-DR11).
    preview
      ? el('span', { class: 'tag t-nt preview-tag' }, [t(preview.tag_key, lang)])
      : null,
  ]);
  const demoChipKey = format.demo_chip_key || DEMO_CHIP[state.market] || 'demo_uae';
  const burger = el(
    'button',
    { type: 'button', class: 'burger', 'aria-label': 'menu' },
    ['☰'],
  );
  burger.addEventListener('click', () => handlers.onToggleRail());

  return el('header', { class: 'top' }, [
    burger,
    crumbs,
    el('span', { class: 'spacer' }, []),
    buildMarketSwitcher(state, handlers),
    el('span', { class: 'chip' }, [t(demoChipKey, lang)]),
    buildRoleBadge(state, handlers),
    buildLangSwitcher(lang, handlers.onLang),
  ]);
}

// The market-preview warn banner (FR-6, UX-DR11): a warn note under the tabs on
// RF/KZ that states, honestly, that the market is outside the demo contour (RF:
// full math; KZ: additionally naming its preserved wiring gaps). `null` on UAE
// and whenever the payload carries no preview block. The `role="status"` keeps
// it announced without stealing focus.
function buildPreviewBanner(chrome, lang) {
  const preview = chrome.preview || null;
  if (!preview) {
    return null;
  }
  return el('div', { class: 'note w preview-banner', role: 'status' }, [
    t(preview.banner_key, lang),
  ]);
}

// The tab strip (`.tabs`): the eight project surfaces in fixed order, the active
// one underlined. Portfolio is a rail scope, not a tab. Switching is instant — it
// re-issues the view for the same scope, keeping the session-local what-if terms,
// and scrolls the content to the top.
function buildTabs(state, handlers) {
  const buttons = TAB_ORDER.map((surface) =>
    el(
      'button',
      {
        type: 'button',
        class: surface === state.surface ? 'tab on' : 'tab',
        'aria-current': surface === state.surface ? 'page' : null,
        'data-tab': surface,
      },
      [t(`nav_${surface}`, state.lang)],
    ),
  );
  const box = el('nav', { class: 'tabs', 'aria-label': t('nav_sec', state.lang) }, buttons);
  box.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-tab]');
    if (target) {
      handlers.onTab(target.getAttribute('data-tab'));
    }
  });
  return box;
}

// The strategy bar (`.stratbar`): the org's active strategy shown as three pills,
// the active one lit. The pills are visible but disabled for every role but the
// director (UX-DR3), carrying the «Требуется роль» tooltip — presentation only,
// from the same permission block the command guard enforces (AD-8). The switch
// command itself is Epic 4's; here the pills render their state.
function buildStrategyBar(chrome, state) {
  const strat = chrome.strategy || {};
  const canSwitch = !!strat.can_switch;
  const pills = ['max', 'cash', 'cov'].map((key) => {
    const attrs = {
      type: 'button',
      class: strat.key === key ? 'pill on' : 'pill',
      'data-strategy': key,
      'aria-pressed': strat.key === key ? 'true' : 'false',
    };
    if (!canSwitch) {
      attrs.disabled = 'disabled';
      attrs['aria-disabled'] = 'true';
      attrs.title = tp('x_requires_role_tip', state.lang, {
        role: tlc('role_director', state.lang),
      });
    }
    return el('button', attrs, [t(`sg_${key}`, state.lang)]);
  });
  const noteKey = strat.key ? `sg_${strat.key}_d` : null;
  return el('div', { class: 'stratbar', role: 'group', 'aria-label': t('st_h', state.lang) }, [
    // The strategy label is a `.mini-lb`, verbatim from the prototype (UX-DR13) —
    // not a `.chip`. The ≤1080 breakpoint hides only the demo `.chip` (UX-DR17); a
    // `.chip` here would wrongly vanish the strategy label at that width.
    el('span', { class: 'mini-lb' }, [t('st_h', state.lang)]),
    ...pills,
    noteKey ? el('span', { class: 'stratnote' }, [t(noteKey, state.lang)]) : null,
  ]);
}

// The surface content frame. Known surfaces render live bodies when their `data`
// block is held; the title-only panel is the fallback for absent payloads. A
// `status` slot carries the loading/error affordances (UX-DR7), announced via
// aria-live.
function buildSurfaceFrame(state) {
  const renderer = SURFACE_RENDERERS[state.surface];
  const operationalDesk = state.operationalDesk && state.operationalDesk.enabled;
  const body =
    renderer && (state.surfaceData || operationalDesk)
      ? renderer(state, state.surfaceData || {})
      : el('section', { class: 'panel' }, [
          el('h1', { class: 'surface-title' }, [t(`nav_${state.surface}`, state.lang)]),
        ]);
  return el('div', { class: 'content', id: 'content' }, [
    el(
      'div',
      { class: 'status-slot', 'aria-live': 'polite', 'aria-atomic': 'true' },
      [],
    ),
    body,
  ]);
}

// Render the whole authenticated shell from `state` and the payload `chrome`
// block: the rail, then the main column (top bar, tabs, strategy bar, content
// frame). Pure — it wires only the callbacks passed in.
export function renderShell(state, chrome, handlers) {
  // Portfolio scope («По всем проектам») hides the tab strip and shows only the
  // analytics surface — verbatim from the prototype (`if(S.scope==='all'){tb.
  // style.display='none'}`, UX-DR18/EXPERIENCE: "portfolio scope, tabs hidden,
  // breadcrumb «Аналитика»"). Every project scope renders the eight tabs. The
  // strategy bar stays in both scopes (the prototype's `stratBar` is unconditional).
  const inPortfolioScope = state.surface === PORTFOLIO_ID;
  const inOperationalDesk = state.operationalDesk && state.operationalDesk.enabled;
  if (inOperationalDesk) {
    return el('div', { class: 'shell operational-shell' }, [
      buildOperationalRail(state, handlers),
      buildOperationalRailBackdrop(state, handlers),
      el('div', { class: 'main' }, [
        buildOperationalTopBar(state, handlers),
        buildOperationalTabs(state, handlers),
        buildOperationalAlgorithmBar(state, handlers),
        buildSurfaceFrame(state),
      ]),
    ]);
  }
  return el('div', { class: 'shell' }, [
    buildRail(chrome, state, handlers),
    el('div', { class: 'main' }, [
      buildTopBar(state, chrome, handlers),
      inPortfolioScope ? null : buildTabs(state, handlers),
      buildStrategyBar(chrome, state),
      buildPreviewBanner(chrome, state.lang),
      buildSurfaceFrame(state),
    ]),
  ]);
}

// --- «Цена сделки» / NEP surface (Story 4.1, Task 2) -------------------------
//
// The first kernel-served surface renders live from the view payload's `data`
// block (assembled by viewmodels/nep.py). The DOM structure and class names are
// the frozen prototype's `vNep` (AD-14, UX-DR13); the token CSS in styles.css
// already styles them. Every number is formatted client-side through the `Intl`
// helpers (AD-3) — the payload carries raw values and message keys only — and
// renders mono, right-aligned, with units as muted sub-labels (UX-DR14). A value
// the payload marks not-applicable renders «—» (UX-DR8), never blank, never zero.
//
// Charts (UX-DR15, AC4): these two surfaces carry no inline SVG in the frozen
// prototype (`vNep`/`vShelf` have none — the SVG chart vocabulary of dual-lines,
// fans and bubble maps lives in the release/trend/comp/retro surfaces). Their
// UX-DR15 chart is the hand-rolled render-only visualization the prototype does
// use: the additive waterfall **leakage ladder** here and the **efficiency bars**
// on the Shelf — no library, no build step, and no hover/zoom/click interaction,
// with the values duplicated in an HTML legend/table below as the accessible path.
// Adding an SVG the prototype lacks would break the visual freeze (NFR-10, FR-40).

// The em-dash the not-applicable / empty states render (UX-DR8), never a blank
// cell and never a literal zero.
const EM_DASH = '—';

// The market's price-per-area unit label, resolved from the chrome `format`
// block's message key (AD-9) — the same key the shell's number formatting reads,
// so the NEP surface never branches on the market. Empty when no chrome is held.
function priceUnitLabel(state) {
  const fmt = (state.chrome && state.chrome.format) || {};
  return fmt.price_unit_key ? t(fmt.price_unit_key, state.lang) : '';
}

// The market's area unit label (м² / ft²), from the chrome `format` block.
function areaUnitLabel(state) {
  const fmt = (state.chrome && state.chrome.format) || {};
  return fmt.area_unit_key ? t(fmt.area_unit_key, state.lang) : '';
}

// An absolute money amount formatted with the market currency symbol and its
// placement (prefix/suffix), both from the chrome `format` block (AD-9). The
// number itself is formatted through `Intl` in the active language (AD-3).
function fmtMoney(state, value) {
  const fmt = (state.chrome && state.chrome.format) || {};
  const symbol = fmt.currency || '';
  const number = nf(Math.round(value), state.lang, 0);
  if (!symbol) {
    return number;
  }
  return fmt.placement === 'prefix' ? `${symbol} ${number}` : `${number} ${symbol}`;
}

// One KPI tile (`.kpi`): uppercase label, the mono value (optionally tinted
// pos/neg), a muted unit and a small detail line — verbatim from the prototype's
// `kpi()` helper. Empty unit/detail slots are simply omitted.
function buildKpi(label, value, unit, detail, valueClass) {
  return el('div', { class: 'kpi' }, [
    el('div', { class: 'lb' }, [label]),
    el('div', { class: valueClass ? `v ${valueClass}` : 'v' }, [value]),
    unit ? el('div', { class: 'u' }, [unit]) : null,
    detail ? el('div', { class: 'd' }, [detail]) : null,
  ]);
}

// One big-result column (`.bigres .b`): micro-label, the big mono number, and a
// muted sub-label. `numClass`/`subClass` tint the number/sub-label pos/neg/warn.
function buildBigCol(label, number, sub, numClass, subClass) {
  return el('div', { class: 'b' }, [
    el('div', { class: 'l' }, [label]),
    el('div', { class: numClass ? `n ${numClass}` : 'n' }, [number]),
    sub != null ? el('div', { class: subClass ? `s ${subClass}` : 's' }, [sub]) : null,
  ]);
}

// --- «Сегодня» / Today surface (Story 4.4, Task 1) --------------------------
//
// The daily brief renders live from viewmodels/today.py: KPIs, the shared
// task-feed ops/think lists and the typology price strip + chart. The feed rows
// carry raw message args; this renderer formats them through the same Intl
// helpers the rest of the UI uses (AD-3). The «Открыть» buttons are pure
// navigation: data-open-surface points at the owning project tab, and the shared
// click wiring calls loadSurface(), which already scrolls to top (UX-DR18).

function todayTaskArgs(state, item) {
  const { lang } = state;
  const args = item.args || [];
  if (item.key === 'op_band') {
    return [nf(args[0], lang, 0), (args[1] || []).join(', ')];
  }
  if (item.key === 'op_rel') {
    return [nf(args[0] * 100, lang, 0)];
  }
  if (item.key === 'op_pace') {
    return [pct(args[0], lang, 0)];
  }
  if (item.key === 'th_comp') {
    return [nf(args[0], lang, 0)];
  }
  if (item.key === 'th_frame_kz') {
    return [pct(args[0], lang, 0)];
  }
  if (item.key === 'th_gar_kz') {
    return [pct(args[0], lang, 1)];
  }
  if (args.length) {
    return [nf(args[0], lang, 0)];
  }
  return [];
}

function todayTaskText(state, item) {
  return tf(item.key, state.lang, ...todayTaskArgs(state, item));
}

function buildTodayKpis(state, data) {
  const { lang } = state;
  const k = data.kpis;
  const market = k.market || {};
  let marketKpi;
  if (market.kind === 'coverage') {
    marketKpi = buildKpi(
      t(market.label_key, lang),
      pct(market.coverage || 0, lang, 0),
      '',
      `${t(market.rate_key, lang)} ${market.rate == null ? EM_DASH : pct(market.rate, lang, 2)}`,
    );
  } else if (market.kind === 'scheme') {
    marketKpi = buildKpi(
      t(market.label_key, lang),
      t(market.scheme_key, lang),
      '',
      `${t(market.detail_key, lang)} ${pct(market.wacc, lang, 0)}`,
    );
  } else {
    marketKpi = buildKpi(
      t(market.label_key || 'w_rate', lang),
      market.rate == null ? EM_DASH : pct(market.rate, lang, 1),
      '',
      '',
    );
  }
  return el('div', { class: 'grid g4', style: 'margin-bottom:14px' }, [
    buildKpi(
      t(k.list.label_key, lang),
      nf(k.list.value, lang, 0),
      priceUnitLabel(state),
      tf(k.list.detail_key, lang, nf(k.list.detail_value, lang, 0)),
    ),
    buildKpi(
      t(k.gap.label_key, lang),
      pct(k.gap.value, lang, 1),
      '',
      `${fmtMillions(state, k.gap.leak_abs)} ${t(k.gap.detail_key, lang)}`,
      'wrn',
    ),
    buildKpi(
      t(k.remaining.label_key, lang),
      nf(k.remaining.value, lang, 0),
      t(k.remaining.unit_key, lang),
      `${pct(k.remaining.sold_pct, lang, 0)} ${t(k.remaining.detail_key, lang)}`,
    ),
    marketKpi,
  ]);
}

function buildTodayTaskRow(state, item, tone, primary) {
  return el('div', { class: 'task' }, [
    el('div', { class: `tdot ${tone}` }, []),
    el('div', { class: 'ttxt' }, [todayTaskText(state, item)]),
    el(
      'button',
      {
        type: 'button',
        class: primary ? 'btn sm pri' : 'btn sm',
        'data-open-surface': item.go,
      },
      [t('td_open', state.lang)],
    ),
  ]);
}

function buildTodayFeeds(state, data) {
  const { lang } = state;
  const feed = data.feed || {};
  const ops = feed.ops || [];
  const think = feed.think || [];
  return el('div', { class: 'grid g23' }, [
    el('div', { class: 'panel' }, [
      el('h2', null, [
        t('td_ops', lang),
        ' ',
        el('span', { class: `tag ${ops.length ? 't-wr' : 't-ok'}` }, [nf(ops.length, lang, 0)]),
      ]),
      el('p', { class: 'sub' }, [t('td_ops_s', lang)]),
      ops.length
        ? el(
            'div',
            { class: 'tasks' },
            ops.map((item) =>
              buildTodayTaskRow(state, item, item.weight >= 3 ? 'hi' : '', true),
            ),
          )
        : el('div', { class: 'note' }, [t(feed.quiet_key || 'td_ops_none', lang)]),
    ]),
    el('div', { class: 'panel' }, [
      el('h2', null, [t('td_think', lang)]),
      el('p', { class: 'sub' }, [t('td_think_s', lang)]),
      el(
        'div',
        { class: 'tasks' },
        think.map((item) => buildTodayTaskRow(state, item, 'lo', false)),
      ),
    ]),
  ]);
}

function buildTodayPrice(state, data) {
  const { lang } = state;
  const price = data.price || {};
  const strip = price.strip || {};
  const unit = priceUnitLabel(state);
  const was = strip.was || {};
  const now = strip.now || {};
  const forecast = strip.forecast || {};
  const nep = strip.nep || {};
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(price.title_key || 'td_price', lang)]),
    el('div', { class: 'bigres' }, [
      buildBigCol(
        t(was.label_key || 'td_was', lang),
        nf(was.value || 0, lang, 0),
        trendMonthLabel(lang, was.offset || -12),
      ),
      el('div', { class: 'arrow' }, ['→']),
      buildBigCol(
        t(now.label_key || 'td_now', lang),
        nf(now.value || 0, lang, 0),
        ppt(now.change || 0, lang, 1),
        'pos',
      ),
      el('div', { class: 'arrow' }, ['→']),
      buildBigCol(
        t(forecast.label_key || 'td_fwd', lang),
        nf(forecast.value || 0, lang, 0),
        `${ppt(forecast.change || 0, lang, 1)} · ${trendMonthLabel(lang, forecast.offset || 0)}`,
      ),
      buildBigCol(
        t(nep.label_key || 'w_nep', lang),
        nf(nep.value || 0, lang, 0),
        unit,
      ),
    ]),
    buildTrendChart(state, {
      bare: true,
      title_key: price.title_key || 'td_price',
      months: price.months,
      split: price.split,
      height: 190,
      series: (price.series || []).map((line) => ({
        name: line.name,
        values: line.values,
        color: TREND_PALETTE[line.index % TREND_PALETTE.length],
      })),
    }),
  ]);
}

export function renderTodaySurface(state, data) {
  const { lang } = state;
  const sub = data.sub || {};
  const name = pick(sub.project, lang);
  return el('div', null, [
    el('div', { class: 'h' }, [
      el('h1', null, [t(data.heading_key || 'td_h1', lang)]),
      el('p', { class: 'sub' }, [
        [name, sub.strategy_key ? t(sub.strategy_key, lang) : null]
          .filter(Boolean)
          .join(' · '),
      ]),
    ]),
    buildTodayKpis(state, data),
    buildTodayFeeds(state, data),
    buildTodayPrice(state, data),
  ]);
}

// The big-result strip: list price → NEP (green), the discount gap (warn), and
// the peer benchmark with the signed delta tinted pos/neg (UX-DR15/prototype
// `bigres`). Numbers are mono; units are muted sub-labels (UX-DR14).
function buildNepBigRes(state, result) {
  const { lang } = state;
  const unit = priceUnitLabel(state);
  const bench = result.benchmark || {};
  const delta = bench.delta;
  return el('div', { class: 'bigres' }, [
    buildBigCol(t('w_list', lang), nf(result.list_psf, lang, 0), unit),
    el('div', { class: 'arrow' }, ['→']),
    buildBigCol(t('w_nep', lang), nf(result.nep_psf, lang, 0), unit, 'pos'),
    buildBigCol(t('n_disc', lang), pct(result.gap, lang, 1), t('n_disc_s', lang), 'wrn'),
    buildBigCol(
      t(bench.label_key, lang),
      nf(bench.psf, lang, 0),
      `${sgn(delta, lang, 0)} ${unit}`,
      null,
      delta > 0 ? 'pos' : 'neg',
    ),
  ]);
}

// The additive waterfall ladder (FR-11, UX-DR15): the NEP block plus every
// deduction component in ladder order, the grouped sub-threshold bucket rendered
// honestly as its own segment (never dropped), the peer benchmark marker, and an
// HTML legend below. Widths are `psf / total`; the total extends past the list
// price by any payment-form premium (a negative cut), exactly as the prototype.
function buildNepLadder(state, waterfall) {
  const { lang } = state;
  const unit = priceUnitLabel(state);
  const segs = [
    { cls: 'lad-nep', psf: waterfall.nep_psf, label: t('n_seg_nep', lang) },
  ];
  for (const comp of waterfall.components) {
    segs.push({ cls: comp.class, psf: comp.psf, label: t(comp.seg_key, lang) });
  }
  if (waterfall.grouped) {
    // The grouped bucket carries its own itemization so nothing becomes invisible
    // (FR-11); the items ride in the legend entry's title as `label value` pairs.
    const items = waterfall.grouped.items
      .map((it) => `${t(it.seg_key, lang)} ${nf(it.psf, lang, 0)}`)
      .join(' · ');
    segs.push({
      cls: 'lad-c2',
      psf: waterfall.grouped.psf,
      label: t('n_seg_other', lang),
      title: items,
    });
  }
  const cut = waterfall.components.find((c) => c.key === 'cut');
  const premium = cut ? Math.max(0, -cut.psf) : 0;
  const total = waterfall.list_psf + premium;
  // Only positive components ladder as bars (prototype filter `x[1] > listPsf*0.002`,
  // line 1728): a negative component is a payment-form premium (e.g. the default
  // UAE `ph3` cut), already carried by the `premium` extension of `total`, and a
  // signed psf used as a width would emit an invalid negative CSS width. The payload
  // still carries it (the zero-residue sum holds); it just does not draw a bar. The
  // sub-threshold bucket is grouped by the view-model (FR-11), so nothing positive is
  // dropped here.
  const drawn = segs.filter((s) => s.psf > 0);
  const bars = drawn.map((s) => {
    const width = total ? (s.psf / total) * 100 : 0;
    return el(
      'div',
      { class: `lad ${s.cls}`, style: `width:${width}%`, title: s.title || s.label },
      width > 7 ? [el('span', null, [nf(s.psf, lang, 0)])] : [],
    );
  });
  const bench = waterfall.benchmark || {};
  if (bench.psf != null) {
    const left = Math.min(99, (bench.psf / total) * 100);
    bars.push(
      el(
        'div',
        {
          class: 'bench',
          'data-l': `${t(bench.label_key, lang)} ${nf(bench.psf, lang, 0)}`,
          style: `left:${left}%`,
        },
        [],
      ),
    );
  }
  const legend = el(
    'div',
    { class: 'legend' },
    drawn.map((s) =>
      el('div', { title: s.title || null }, [
        el('i', { class: s.cls }, []),
        `${s.label} `,
        el('b', null, [nf(s.psf, lang, 0)]),
      ]),
    ),
  );
  return el('div', { class: 'ladwrap' }, [
    el('div', { class: 'ladscale' }, [
      el('span', null, ['0']),
      el('span', null, [`${nf(total, lang, 0)} ${unit}`]),
    ]),
    el('div', { class: 'ladder' }, bars),
    legend,
  ]);
}

// The committee note (AD-3, NFR-1): a message key with the raw NEP / delta params
// the client formats and localizes — never prose from the server. `n_note_ok`
// (result at or above the reference) renders neutral; `n_note_wr` renders warn.
function buildCommitteeNote(state, data) {
  const { lang } = state;
  const note = data.committee_note;
  const unit = priceUnitLabel(state);
  const params = (note.params || []).map((p) => `${nf(p, lang, 0)} ${unit}`);
  const positive = note.key === 'n_note_ok';
  return el('div', { class: positive ? 'note' : 'note w', style: 'margin-top:12px' }, [
    el('b', null, [`${t('w_committee', lang)}.`]),
    ` ${tf(note.key, lang, ...params)}`,
  ]);
}

// The break-even discount-rate note «Точка равновесия по ставке» (FR-14): the
// crossing rate against the current rate where it exists (UAE), «—» otherwise
// (RF/KZ, UX-DR8) — always rendered, never blank.
function buildBreakEvenNote(state, data) {
  const { lang } = state;
  const be = data.break_even;
  const body = be
    ? tf(
        'n_be_txt',
        lang,
        pct(be.rate, lang, 1),
        be.current_rate != null ? pct(be.current_rate, lang, 1) : EM_DASH,
      )
    : EM_DASH;
  return el('div', { class: 'note', style: 'margin-top:9px' }, [
    el('b', null, [`${t('n_be', lang)}.`]),
    ` ${body}`,
  ]);
}

// The result panel (`.panel`): the big-result strip, the additive waterfall
// ladder with its legend and benchmark marker, the committee note and the
// break-even note.
function buildNepResult(state, data) {
  return el('div', { class: 'panel' }, [
    el('h2', null, [t('n_res', state.lang)]),
    buildNepBigRes(state, data.result),
    buildNepLadder(state, data.waterfall),
    buildCommitteeNote(state, data),
    buildBreakEvenNote(state, data),
  ]);
}

// The plan `<select>` (`.projsel`): the market's payment plans as options, the
// current effective plan selected. `data-control="plan"` marks it for the live
// what-if wiring (Task 4).
function buildPlanSelect(state, data) {
  const { lang } = state;
  const selected = data.controls.plan;
  const options = data.plans.map((p) =>
    el(
      'option',
      { value: p.key, selected: p.key === selected ? 'selected' : null },
      [t(p.name_key, lang)],
    ),
  );
  return el(
    'select',
    { class: 'projsel', style: 'width:100%;margin-bottom:12px', 'data-control': 'plan' },
    options,
  );
}

// One labelled range slider (`.sl`): the label, the current value read-out, and
// the `<input type=range>` carrying its contractual min/max/step (UX-DR5).
// `data-control` marks it for the live what-if wiring (Task 4).
function buildSlider(control, label, valueText, min, max, step, value) {
  return el('div', { class: 'sl' }, [
    el('label', null, [label]),
    el('b', null, [valueText]),
    el(
      'input',
      {
        type: 'range',
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(value),
        'data-control': control,
      },
      [],
    ),
  ]);
}

// The lever toggles (`.tg`): one `.tgi` per lever, each showing its per-lever
// discounted cost (FR-10). An inapplicable lever (marked `disabled` because its
// marginal cost is zero — an unfurnished project, a below-threshold visa) renders
// dimmed and disabled with «—» for its cost (UX-DR8). Cost numbers are mono; the
// unit is a muted sub-label (UX-DR14). `data-lever` marks each for Task 4's wiring.
function buildLevers(state, levers, unit) {
  const { lang } = state;
  const rows = levers.map((lv) => {
    const on = lv.on && !lv.disabled;
    const attrs = { class: on ? 'tgi on' : 'tgi', 'data-lever': lv.flag };
    if (lv.disabled) {
      attrs.style = 'opacity:.5';
    }
    const inputAttrs = { type: 'checkbox', 'data-lever': lv.flag };
    // The server carries each lever's real on-magnitude (2 for the two-year `sc`
    // holiday, 1 otherwise) so the client submits the same on-value without
    // duplicating the magnitude policy — it is the one source (AD-3). Default 1 for
    // an older payload that omits it.
    inputAttrs['data-on-magnitude'] = lv.on_magnitude == null ? 1 : lv.on_magnitude;
    if (on) {
      inputAttrs.checked = 'checked';
    }
    if (lv.disabled) {
      inputAttrs.disabled = 'disabled';
    }
    return el('label', attrs, [
      el('input', inputAttrs, []),
      el('div', null, [
        el('div', { class: 'nm' }, [t(lv.name_key, lang)]),
        el('div', { class: 'ds' }, [t(lv.desc_key, lang)]),
      ]),
      el('div', { class: 'cost' }, [
        lv.disabled ? EM_DASH : nf(lv.cost_psf, lang, 0),
        el('span', null, [unit]),
      ]),
    ]);
  });
  return el('div', { class: 'tg' }, rows);
}

// The controls panel (`.panel`): the fixed unit line, the plan select, the market
// rate control (coverage on escrow markets, developer rate elsewhere — UX-DR5's
// contractual ranges), the cut slider, and the lever toggles.
function buildNepControls(state, data) {
  const { lang } = state;
  const controls = data.controls;
  const unit = priceUnitLabel(state);
  const areaUnit = areaUnitLabel(state);
  const unitName = pick(data.unit.name, lang);
  const children = [
    el('h2', null, [t('n_ctrl', lang)]),
    el('div', { class: 'mini-lb' }, [t('n_unit', lang)]),
    el('div', { class: 'fx wrap', style: 'margin-bottom:12px' }, [
      `${unitName} · ${nf(data.unit.sqft, lang, 0)} ${areaUnit} · ${fmtMoney(state, data.unit.list_abs)}`,
    ]),
    el('div', { class: 'mini-lb' }, [t('w_plan', lang)]),
    buildPlanSelect(state, data),
  ];
  if (controls.rate_kind === 'coverage' && controls.coverage != null) {
    children.push(
      buildSlider(
        'coverage',
        t('n_esc_cov', lang),
        pct(controls.coverage, lang, 0),
        0,
        110,
        1,
        controls.coverage * 100,
      ),
    );
  } else if (controls.rate_kind === 'rate' && controls.rate != null) {
    children.push(
      buildSlider(
        'rate',
        t('w_rate', lang),
        pct(controls.rate, lang, 1),
        5,
        16,
        0.5,
        controls.rate * 100,
      ),
    );
  }
  children.push(
    buildSlider('cut', t('w_cut', lang), pct(controls.cut, lang, 1), 0, 10, 0.5, controls.cut * 100),
  );
  children.push(el('div', { class: 'mini-lb', style: 'margin-top:14px' }, [t('n_lev', lang)]));
  children.push(buildLevers(state, controls.levers, unit));
  return el('div', { class: 'panel' }, children);
}

// The market financing panel (FR-12), selected by the payload's `financing.kind`
// (AD-9), never a market `if`: `escrow` (RF) shows the base/special/effective
// escrow rates, `scheme` (KZ) the sales scheme with its cost, and `flat` (UAE) the
// flat cost of capital (the effective discount rate — no escrow, no scheme, just
// the developer's own money). Not-applicable rates within a panel render «—»
// (UX-DR8).
function buildNepFinancing(state, data) {
  const { lang } = state;
  const financing = data.financing;
  const unit = priceUnitLabel(state);
  if (financing.kind === 'escrow') {
    const pf = financing.pf;
    const bump = financing.r_bump
      ? `${t('st_bump', lang)} +${nf(financing.r_bump * 100, lang, 0)} ${t('u_pp', lang)}`
      : '';
    return el('div', { class: 'panel' }, [
      el('h2', null, [t('n_esc', lang)]),
      el('div', { class: 'grid g3', style: 'gap:9px' }, [
        buildKpi(
          t('n_esc_base', lang),
          pf ? pct(pf.base, lang, 2) : EM_DASH,
          '',
          tf('n_esc_key', lang, nf((financing.margin || 0) * 100, lang, 1)),
        ),
        buildKpi(t('n_esc_spec', lang), pf ? pct(pf.spec, lang, 2) : EM_DASH, '', ''),
        buildKpi(t('n_esc_eff', lang), pf ? pct(pf.eff, lang, 2) : EM_DASH, '', bump, 'pos'),
      ]),
      // The formula + discounting notes below the KPIs (prototype `vNep`, NFR-10):
      // the effective-rate formula and the "cost of money not counted twice" note.
      el('div', { class: 'fx', style: 'margin-top:10px' }, [t('n_esc_fx', lang)]),
      el('div', { class: 'src' }, [t('n_esc_note', lang)]),
    ]);
  }
  if (financing.kind === 'scheme') {
    const scheme = financing.scheme;
    const descParam =
      scheme === 'gar'
        ? pct(financing.gar_fee, lang, 1)
        : scheme === 'bank'
          ? pct(financing.wacc, lang, 0)
          : pct(financing.frame_at, lang, 0);
    const costKpi = financing.gar_fee
      ? buildKpi(
          t('n_garfee', lang),
          pct(financing.gar_fee, lang, 1),
          '',
          `${nf(financing.gar_psf, lang, 0)} ${unit}`,
        )
      : buildKpi(
          t('n_frame', lang),
          pct(financing.frame_at, lang, 0),
          '',
          `${nf(financing.lock_psf, lang, 0)} ${unit}`,
        );
    return el('div', { class: 'panel' }, [
      el('h2', null, [t('n_fin_kz', lang)]),
      el('div', { class: 'grid g3', style: 'gap:9px' }, [
        buildKpi(
          t('n_scheme', lang),
          t(`sch_${scheme}`, lang),
          '',
          tf(`sch_${scheme}_d`, lang, descParam),
        ),
        buildKpi(t('n_capital', lang), pct(financing.wacc, lang, 0), '', ''),
        costKpi,
      ]),
    ]);
  }
  if (financing.kind === 'flat') {
    // UAE: no escrow and no scheme — the flat cost of capital is the effective
    // discount rate the deal is priced at (FR-12). One KPI, the flat rate.
    return el('div', { class: 'panel' }, [
      el('h2', null, [t('n_fin_uae', lang)]),
      el('div', { class: 'grid g3', style: 'gap:9px' }, [
        buildKpi(t('n_capital', lang), pct(financing.r_eff, lang, 1), '', t('n_fin_uae_s', lang)),
      ]),
    ]);
  }
  return null;
}

// The RF pace-yield panel (FR-13): present only where the payload carries a
// `pace` block (escrow markets); the client shows nothing here otherwise, and the
// break-even note above already renders «—» for the non-applicable UAE/KZ case.
// The `full` case (pace already fully collected) is a plain note; otherwise the
// saved-capital / share KPIs and the interpreting note render.
function buildNepPace(state, data) {
  const pace = data.pace;
  if (!pace) {
    return null;
  }
  const { lang } = state;
  const header = [el('h2', null, [t('n_pace', lang)])];
  if (pace.full) {
    header.push(el('div', { class: 'note' }, [t('n_pace_full', lang)]));
    return el('div', { class: 'panel', style: 'border-left:3px solid var(--green)' }, header);
  }
  const moUnit = t('u_mo', lang);
  header.push(
    el('div', { class: 'grid g2', style: 'gap:10px;margin-bottom:10px' }, [
      buildKpi(t('n_pace_v', lang), fmtMoney(state, pace.saved), '', ''),
      buildKpi(t('n_pace_p', lang), `+${pct(pace.share, lang, 1)}`, '', '', 'pos'),
    ]),
    el('div', { class: 'note' }, [
      tf(
        'n_pace_txt',
        lang,
        fmtMoney(state, pace.nep_abs),
        ppt(pace.dk, lang, 2),
        ppt(-pace.dr, lang, 2),
        `${nf(pace.months, lang, 0)} ${moUnit}`,
        fmtMoney(state, pace.saved),
        `+${pct(pace.share, lang, 1)}`,
      ),
    ]),
  );
  return el('div', { class: 'panel', style: 'border-left:3px solid var(--green)' }, header);
}

// Render the whole «Цена сделки» surface from `state` and the surface `data`
// block: a header, then a `g32` two-column grid — controls + financing on the
// left, result + pace on the right (prototype `vNep` layout, UX-DR13). Pure:
// state in, DOM out; the live what-if wiring is Task 4's.
export function renderNepSurface(state, data) {
  const { lang } = state;
  return el('div', null, [
    el('div', { class: 'h' }, [el('h1', null, [t('n_h1', lang)])]),
    el('div', { class: 'grid g32' }, [
      el('div', null, [buildNepControls(state, data), buildNepFinancing(state, data)].filter(Boolean)),
      el('div', null, [buildNepResult(state, data), buildNepPace(state, data)].filter(Boolean)),
    ]),
  ]);
}

// --- «Формы оплаты и акции» (Shelf) surface (Story 4.1, Task 3) --------------

// A raw money amount rendered in millions with the market currency and a
// language-appropriate «млн»/«m» token (prototype `mio`, line 1139). The number is
// formatted client-side (AD-3); the payload carries the raw absolute money.
function fmtMillions(state, value) {
  const fmt = (state.chrome && state.chrome.format) || {};
  const symbol = fmt.currency || '';
  const number = nf(value / 1e6, state.lang, 1);
  const token = state.lang === 'ru' ? 'млн' : 'm';
  if (!symbol) {
    return `${number} ${token}`;
  }
  // Russian trails the currency after «млн» (`1,2 млн AED`); English prefixes the
  // symbol and glues the token to the number (`AED 1.2m`) — the prototype's split.
  return state.lang === 'ru' ? `${number} ${token} ${symbol}` : `${symbol} ${number}${token}`;
}

// One efficiency bar (`.bar`): a filled `<i>` whose width is the efficiency
// relative to the segment's top efficiency (prototype `bar()`, line 1551). The
// class tints it by tier (bright / `s` neutral / `w` weak); width is clamped 2..100.
function buildBar(fraction, cls) {
  const width = Math.max(2, Math.min(100, fraction * 100));
  return el('div', { class: 'bar' }, [
    el('i', { class: cls || null, style: `width:${width}%` }, []),
  ]);
}

// The payment-form table (FR-15): one row per plan with its down payment, markup,
// cancellation, the NEP it brings the project and the delta versus the reference
// form. The reference row is highlighted with its tag; a zero markup and the
// reference's own delta render «—» (UX-DR8). Numbers are mono/right-aligned and
// formatted client-side (AD-3, UX-DR14). Below, the worst-form warning renders from
// its message keys with the mix-weighted params the payload carries.
function buildShelfForms(state, forms) {
  const { lang } = state;
  const unit = priceUnitLabel(state);
  const head = el('tr', null, [
    el('th', null, [t('th_planname', lang)]),
    el('th', { class: 'num' }, [t('th_dp', lang)]),
    el('th', { class: 'num' }, [t('th_mk', lang)]),
    el('th', { class: 'num' }, [t('th_cx', lang)]),
    el('th', { class: 'num' }, [t('th_in', lang)]),
    el('th', { class: 'num' }, [t('th_vsref', lang)]),
  ]);
  const rows = forms.rows.map((r) => {
    const mkClass = r.mk > 0 ? 'num pos' : r.mk < 0 ? 'num neg' : 'num';
    const deltaClass = r.delta < 0 ? 'num neg' : r.delta > 0 ? 'num pos' : 'num';
    const nameCell = el('td', null, [
      el('b', null, [t(r.name_key, lang)]),
      r.is_ref ? el('span', { class: 'tag t-ok', style: 'margin-left:6px' }, [t('fm_ref', lang)]) : null,
    ]);
    const rowAttrs = r.is_ref
      ? { style: 'background:#F5FBF6;box-shadow:inset 2px 0 0 var(--green)' }
      : null;
    return el('tr', rowAttrs, [
      nameCell,
      el('td', { class: 'num' }, [pct(r.dp, lang, 0)]),
      el('td', { class: mkClass }, [r.mk ? `${sgn(r.mk * 100, lang, 1)}%` : EM_DASH]),
      el('td', { class: r.cx >= 0.05 ? 'num neg' : 'num' }, [pct(r.cx, lang, 1)]),
      el('td', { class: 'num' }, [el('b', null, [nf(r.nep_psf, lang, 0)])]),
      el('td', { class: deltaClass }, [
        r.is_ref ? EM_DASH : `${sgn(r.delta, lang, 0)} ${unit}`,
      ]),
    ]);
  });
  const worst = forms.worst;
  const markup = worst.mk ? `${sgn(worst.mk * 100, lang, 1)}%` : '0%';
  const note = el('div', { class: 'note w', style: 'margin-top:11px' }, [
    el('b', null, [
      tf(worst.note_key, lang, t(worst.name_key, lang), markup, `${nf(-worst.delta, lang, 0)} ${unit}`),
    ]),
    ` ${tf(worst.mix_note_key, lang, pct(worst.mix_share, lang, 0), fmtMillions(state, worst.mix_impact_abs))}`,
  ]);
  return el('div', { class: 'panel' }, [
    el('h2', null, [t('fm_h', lang)]),
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [el('thead', null, [head]), el('tbody', null, rows)]),
    ]),
    note,
  ]);
}

// The buyer-segment switcher (FR-16): one pill per market segment, the active one
// highlighted. `data-control="segment"` marks the discrete control for Task 4's
// live-recalc wiring; `data-segment` carries the key the client submits.
function buildShelfSegments(state, segments) {
  const { lang } = state;
  const pills = segments.map((s) =>
    el(
      'button',
      {
        class: s.active ? 'btn pri' : 'btn',
        'data-control': 'segment',
        'data-segment': s.key,
      },
      [t(s.name_key, lang)],
    ),
  );
  return el(
    'div',
    { class: 'panel', style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' },
    [el('div', { class: 'mini-lb', style: 'margin:0' }, [t('w_seg', lang)]), ...pills],
  );
}

// The verdict tag class + label key per verdict (prototype `vShelf`, line 1826):
// give-first is positive, neutral, give-last is warn, n-a is neutral-muted.
const SHELF_VERDICT = {
  first: ['t-ok', 'v_first'],
  ok: ['t-nt', 'v_ok'],
  last: ['t-wr', 'v_last'],
  na: ['t-nt', 'v_na'],
};

// The efficiency-ranked lever table (FR-16): each lever with its discounted cost,
// buyer value, the efficiency bar, the efficiency number and its verdict. An
// inapplicable lever (`na` — kernel zero-cost or the KZ cataloged inert lever, AR-9)
// dims and renders «—» for cost and value (parity/UX-DR8); every row's efficiency
// still shows. Numbers are mono, formatted client-side (AD-3, UX-DR14).
function buildShelfLevers(state, levers) {
  const { lang } = state;
  const head = el('tr', null, [
    el('th', null, [t('th_lever', lang)]),
    el('th', { class: 'num' }, [t('th_cost', lang)]),
    el('th', { class: 'num' }, [t('th_val', lang)]),
    el('th', { style: 'width:150px' }, []),
    el('th', { class: 'num' }, [t('th_eff', lang)]),
    el('th', null, [t('th_verdict', lang)]),
  ]);
  const rows = levers.rows.map((r) => {
    const [tagClass, tagKey] = SHELF_VERDICT[r.verdict] || SHELF_VERDICT.na;
    const barClass = r.bar_class || '';
    return el('tr', r.na ? { style: 'opacity:.5' } : null, [
      el('td', null, [
        el('b', null, [t(r.name_key, lang)]),
        el('div', { style: 'font-size:11.3px;color:var(--muted);line-height:1.35' }, [
          t(r.desc_key, lang),
        ]),
      ]),
      el('td', { class: 'num' }, [r.na ? EM_DASH : nf(r.cost_psf, lang, 0)]),
      el('td', { class: 'num' }, [r.na ? EM_DASH : nf(r.val_psf, lang, 0)]),
      el('td', null, [buildBar(levers.max_eff ? r.eff / levers.max_eff : 0, barClass)]),
      el('td', { class: 'num' }, [el('b', null, [nf(r.eff, lang, 2)])]),
      el('td', null, [el('span', { class: `tag ${tagClass}` }, [t(tagKey, lang)])]),
    ]);
  });
  return el('div', { class: 'panel' }, [
    el('h2', null, [t('s_tbl', lang)]),
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [el('thead', null, [head]), el('tbody', null, rows)]),
    ]),
    el('div', { class: 'src' }, [t(levers.source_note_key, lang)]),
  ]);
}

// The recommended concession package (FR-17): the greedily-filled levers for the
// active segment, and its savings-equivalence — the accumulated buyer value and
// cost as KPIs and the savings note rendered from its message key with the raw
// per-lot / inventory-wide params the payload carries. Numbers formatted
// client-side (AD-3); the note is a key, never prose (NFR-1).
function buildShelfPackage(state, pkg) {
  const { lang } = state;
  const unit = priceUnitLabel(state);
  const items = pkg.picked.map((x) =>
    el('li', null, [
      `${t(x.name_key, lang)} — ${nf(x.cost_psf, lang, 0)} → ${nf(x.val_psf, lang, 0)} ${unit} (${nf(x.eff, lang, 2)})`,
    ]),
  );
  const left = el('div', { class: 'panel' }, [
    el('h2', null, [`${t('s_pack', lang)} — ${t(pkg.name_key, lang)}`]),
    el('ul', { class: 'tight' }, items),
  ]);
  const note = pkg.saved_note;
  const right = el('div', { class: 'panel' }, [
    el('h2', null, [t('s_equiv', lang)]),
    el('div', { class: 'grid g2', style: 'gap:10px' }, [
      buildKpi(t('s_target', lang), nf(pkg.acc_value, lang, 0), unit, ''),
      buildKpi(t('s_costs', lang), nf(pkg.acc_cost, lang, 0), unit, ''),
    ]),
    el('div', { class: 'note', style: 'margin-top:11px' }, [
      el('b', null, [`${t('s_saved', lang)}: ${nf(pkg.saved, lang, 0)} ${unit}.`]),
      ` ${tf(note.key, lang, fmtMoney(state, note.params[0]), fmtMillions(state, note.params[1]))}`,
    ]),
  ]);
  return el('div', { class: 'grid g2' }, [left, right]);
}

// Render the whole «Формы оплаты и акции» surface from `state` and the surface
// `data` block: a header, the payment-form table with its worst-form warning, the
// segment switcher, the ranked lever table, and the recommended package. Pure:
// state in, DOM out; the live what-if wiring is Task 4's.
export function renderShelfSurface(state, data) {
  const { lang } = state;
  return el('div', null, [
    el('div', { class: 'h' }, [
      el('h1', null, [t('s_h1', lang)]),
      el('p', { class: 'sub' }, [t('s_sub', lang)]),
    ]),
    buildShelfForms(state, data.forms),
    buildShelfSegments(state, data.segments),
    buildShelfLevers(state, data.levers),
    buildShelfPackage(state, data.package),
  ]);
}

// --- «Переоценка» (Desk) surface (Story 4.2) --------------------------------
//
// The console's first decision surface renders live from the desk payload
// (viewmodels/desk.py): the regulatory-threshold panel, the 26-unit reprice table
// with each unit's fired-rule reason and its accept/decline verdict, the typology
// price groups with the five-factor reasoning modal, and the append-only decision
// journal (UX-DR10). Every number is formatted client-side (AD-3) from the raw
// payload; the fired-rule reason is a message key rendered as human text, never an
// internal identifier (NFR-1). The manager decides units; the director approves
// groups and switches strategy — the controls the caller's role may not invoke are
// simply absent, and the server enforces regardless (AD-8). No pricing logic here
// (NFR-10): a decision carries only the verdict, and the surface re-renders from the
// server's fresh post-commit payload (AR-7).

// The regulatory-threshold panel (FR-21): the market's play (Golden-Visa / family
// mortgage) with its threshold, count, value and the interpreting note — rendered
// from the payload's message keys and raw values, or the verbatim none-text when no
// unit qualifies (UX-DR8). The value is shown in millions (prototype `mio`).
function buildDeskThreshold(state, panel) {
  const { lang } = state;
  const noteParams = (panel.note_params || []).map((p, i) => {
    // The fm note interleaves money (threshold/target/cost) and a plain count; the gv
    // note is (count, value). Format the money params as millions, counts as plain.
    if (panel.kind === 'fm') {
      return i === 1 ? nf(p, lang, 0) : fmtMillions(state, p);
    }
    return i === 0 ? nf(p, lang, 0) : fmtMillions(state, p);
  });
  const note = panel.note_params && panel.note_params.length
    ? tf(panel.note_key, lang, ...noteParams)
    : t(panel.note_key, lang);
  return el('div', { class: 'panel', style: 'border-left:3px solid var(--green)' }, [
    el('h2', null, [t(panel.title_key, lang)]),
    el('div', { class: 'grid g3', style: 'gap:9px' }, [
      buildKpi(t(panel.count_key, lang), String(panel.count), t(panel.count_unit_key, lang), ''),
      buildKpi(t(panel.act_key, lang), fmtMoney(state, panel.threshold), '', ''),
      buildKpi(t('th_popt', lang), fmtMoney(state, panel.target), '', '', 'pos'),
    ]),
    el('div', { class: panel.count ? 'note' : 'note w', style: 'margin-top:10px' }, [note]),
  ]);
}

// One reprice-table row: the unit's attributes, its current (baseline+overlay) price,
// the strategy optimal and deviation, days-on-market, the fired-rule reason as human
// text, and the action cell — a pending unit shows its raise/lower target (with
// accept/decline for the manager, and the same buttons disabled + «Требуется роль»
// tooltipped for every other role, AC5/UX-DR3), a decided one its «Принять»/«Отклонить»
// chip, a manual unit the «Ручная цена» tag, and a hold the «Держать» chip.
// `unitPerm` is the payload's `unit_decision` permission entry ({allowed, requires}).
// `canonical` marks the one same-id pending row a decision may be taken on: the overlay
// keys by unit id (AR-5), so same-id pending rows collapse to a single decision the
// server resolves on the *first* decidable match — the row the confirm modal previews.
// A later same-id pending row is not `canonical` and shows its recommendation without
// accept/decline controls, so the UI never offers a decision the store cannot record
// separately (a raise and a lower under one id would otherwise both look actionable
// yet both resolve to the first).
function buildDeskRow(state, row, unitPerm, canonical = true) {
  const { lang } = state;
  const canDecide = !!(unitPerm && unitPerm.allowed);
  const devClass = row.deviation > 0 ? 'num pos' : row.deviation < 0 ? 'num neg' : 'num';
  let action;
  if (row.manual) {
    action = el('span', { class: 'tag t-wr' }, [t('mn_tag', lang)]);
  } else if (row.decided) {
    const cls = row.decided === 'accepted' ? 't-ok' : 't-nt';
    action = el('span', { class: `tag ${cls}` }, [
      t(row.decided === 'accepted' ? 'w_accept' : 'w_reject', lang),
    ]);
  } else if (row.pending) {
    // The raise/lower recommendation with its recomputed target (AC2) — shown to
    // every viewer; the accept/decline controls follow only for the manager.
    const raise = row.act === 'raise';
    const recoTag = el('span', { class: `tag ${raise ? 't-ok' : 't-wr'}` }, [
      `${t(raise ? 'w_raise' : 'w_lower', lang)} → ${nf(row.target, lang, 0)}`,
    ]);
    const children = [recoTag];
    if (!canonical) {
      // A non-canonical same-id pending row (the seeded world can collide two
      // actionable ids): show the recommendation, but no accept/decline — the one
      // decision this id can carry is taken on the canonical row above (AR-5).
    } else if (canDecide) {
      children.push(
        el(
          'button',
          { type: 'button', class: 'btn pri', 'data-decision': 'accept', 'data-unit': row.id },
          [t('d_accept', lang)],
        ),
        el(
          'button',
          { type: 'button', class: 'btn', 'data-decision': 'decline', 'data-unit': row.id },
          [t('d_declbtn', lang)],
        ),
      );
    } else {
      // AC5 / UX-DR3: a non-manager (the analyst, the director) sees the same
      // accept/decline pair, but disabled + dimmed and carrying the «Требуется
      // роль: {role}» tooltip — presentation only, never enforcement (the server
      // guard 403s regardless). The disabled buttons omit `data-decision`, so the
      // click delegation can never fire them.
      const requires = unitPerm && unitPerm.requires;
      const tip = requires
        ? tp('x_requires_role_tip', lang, { role: tlc(`role_${requires}`, lang) })
        : null;
      const disabledBtn = (labelKey, cls) => {
        const attrs = { type: 'button', class: cls, disabled: 'disabled', 'aria-disabled': 'true' };
        if (tip) attrs.title = tip;
        return el('button', attrs, [t(labelKey, lang)]);
      };
      children.push(disabledBtn('d_accept', 'btn pri'), disabledBtn('d_declbtn', 'btn'));
    }
    action = el('div', { class: 'fx wrap', style: 'gap:6px;background:none;border:0;padding:0' }, children);
  } else {
    // A hold recommendation — no action to take (prototype's `w_hold` chip).
    action = el('span', { class: 'tag t-nt' }, [t('w_hold', lang)]);
  }
  return el('tr', null, [
    el('td', null, [el('b', null, [row.id])]),
    el('td', null, [t(row.type, lang)]),
    el('td', { class: 'num' }, [String(row.floor)]),
    el('td', null, [t(row.view, lang)]),
    el('td', { class: 'num' }, [nf(row.area, lang, 0)]),
    el('td', { class: 'num' }, [fmtMoney(state, row.price)]),
    el('td', { class: 'num' }, [nf(row.ppsf, lang, 0)]),
    el('td', { class: 'num' }, [nf(row.optimal, lang, 0)]),
    el('td', { class: devClass }, [pct(row.deviation, lang, 1)]),
    el('td', { class: 'num' }, [String(row.dom)]),
    el('td', null, [t(row.reason_key, lang)]),
    el('td', null, [action]),
  ]);
}

// The 26-unit reprice table (FR-22, FR-25). The header names the columns; each row
// carries the unit and its action. `unit` unit-label suffixes ppsf/optimal via the
// column headers, so the cells stay bare numbers (UX-DR14).
function buildDeskTable(state, data, unitPerm) {
  const { lang } = state;
  const head = el('tr', null, [
    el('th', null, [t('th_unit', lang)]),
    el('th', null, [t('th_type', lang)]),
    el('th', { class: 'num' }, [t('th_floor', lang)]),
    el('th', null, [t('th_view', lang)]),
    el('th', { class: 'num' }, [t('th_sqft', lang)]),
    el('th', { class: 'num' }, [t('th_price', lang)]),
    el('th', { class: 'num' }, [t('th_ppsf', lang)]),
    el('th', { class: 'num' }, [t('th_popt', lang)]),
    el('th', { class: 'num' }, [t('th_dev', lang)]),
    el('th', { class: 'num' }, [t('th_dom', lang)]),
    el('th', null, [t('th_reason', lang)]),
    el('th', null, [t('th_act', lang)]),
  ]);
  // One decision per unit id (AR-5): where the seeded world collides two actionable
  // ids, only the first pending row is decidable — the row the confirm modal previews
  // and the command resolves. Mark it canonical; later same-id pending rows render
  // their recommendation without independently-clickable controls.
  const seenPending = new Set();
  const rows = data.table.rows.map((row) => {
    let canonical = true;
    if (row.pending) {
      canonical = !seenPending.has(row.id);
      seenPending.add(row.id);
    }
    return buildDeskRow(state, row, unitPerm, canonical);
  });
  return el('div', { class: 'panel' }, [
    el('h2', null, [t('d_tbl', lang)]),
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [el('thead', null, [head]), el('tbody', null, rows)]),
    ]),
  ]);
}

// The typology price-group cards (FR-23): each group's count/free/averages/deviation
// and a «Обоснование» button opening the five-factor reasoning modal (openReasoning).
// Every role sees the per-group «Согласовать группу» control (one of the four command
// controls, UX-DR3): the director's is enabled only where the group still has pending
// recommendations; a manager/analyst sees it visible-but-disabled with the «Требуется
// роль» tooltip — presentation only, never enforcement. `groupPerm` is the payload's
// `group_approval` permission entry ({allowed, requires}).
function buildDeskGroups(state, data, groupPerm, pendingByType) {
  const { lang } = state;
  const unit = priceUnitLabel(state);
  const canApprove = !!(groupPerm && groupPerm.allowed);
  const requires = groupPerm && groupPerm.requires;
  const roleTip = requires
    ? tp('x_requires_role_tip', lang, { role: tlc(`role_${requires}`, lang) })
    : null;
  const cards = data.groups.map((g) => {
    const pending = pendingByType[g.type] || 0;
    // AC4 / FR-23: the group carries count, available (free), its average price
    // against the computed optimal, and the deviation — the full stats the committee
    // approves on, not price alone.
    const stats = [
      `${t('th_pgcnt', lang)}: ${nf(g.count, lang)}`,
      `${t('th_pgfree', lang)}: ${nf(g.free, lang)}`,
      `${t('th_popt', lang)}: ${nf(g.optimal_avg, lang, 0)}`,
      `${t('th_dev', lang)}: ${pct(g.deviation, lang, 1)}`,
    ].join(' · ');
    const children = [
      el('div', { class: 'kpi' }, [
        el('div', { class: 'lb' }, [t(g.type, lang)]),
        el('div', { class: 'v' }, [nf(g.price_avg, lang, 0)]),
        el('div', { class: 'u' }, [unit]),
        el('div', { class: 'd' }, [stats]),
      ]),
      el(
        'button',
        { type: 'button', class: 'btn', 'data-reason-group': g.type },
        [t('ap_reason', lang)],
      ),
    ];
    const approveAttrs = {
      type: 'button',
      class: 'btn pri',
      'data-approve-group': g.type,
    };
    if (!canApprove) {
      // AC5 / UX-DR3: the manager/analyst sees the control disabled + dimmed with the
      // «Требуется роль: {role}» tooltip (the click delegation guards on `disabled`).
      approveAttrs.disabled = 'disabled';
      approveAttrs['aria-disabled'] = 'true';
      if (roleTip) approveAttrs.title = roleTip;
    } else if (!pending) {
      // The director, but this group has nothing left pending (UX-DR6).
      approveAttrs.disabled = 'disabled';
      approveAttrs['aria-disabled'] = 'true';
    }
    children.push(el('button', approveAttrs, [t('cmd_group_approval', lang)]));
    return el('div', { class: 'panel', style: 'display:flex;gap:12px;align-items:center' }, children);
  });
  return el('div', null, [
    el('h2', null, [t('ap_h', lang)]),
    ...cards,
  ]);
}

// The append-only decision journal (UX-DR10): a 2px left-border `.log` list, each
// entry a `<b>HH:MM text</b>` line with the actor subline, in the verbatim formats
// for unit / group / strategy decisions — market-scoped and never cleared. The empty
// state renders the verbatim «Решений пока нет…» text (UX-DR8).
function buildJournalEntry(state, entry) {
  const { lang } = state;
  const p = entry.params || {};
  const time = String(entry.utc || '').slice(11, 16); // HH:MM from the ISO capture
  // The unit-decision money params are per-area `money_psf` values (the journal
  // shape's semantic type, prototype `pu(u.lpsf) → pu(rc.target)`): render each as
  // the number plus the market's price-per-area label, exactly as the prototype's
  // `pu()` does — never a bare or absolute number.
  const puf = (value) => `${nf(value, lang, 0)} ${priceUnitLabel(state)}`.trim();
  let text;
  if (entry.kind === 'd_appr') {
    text = tf('d_appr', lang, p.unit, puf(p.from), puf(p.to));
  } else if (entry.kind === 'd_decl') {
    text = tf('d_decl', lang, p.unit, puf(p.kept));
  } else if (entry.kind === 'd_strat') {
    text = tf('d_strat', lang, t(`sg_${p.old}`, lang), t(`sg_${p.new}`, lang));
  } else if (entry.kind === 'd_scen') {
    // The committed release scenario (Story 4.3, FR-20): its inputs — the size (лоты),
    // the window (мес) and the signed price index (%) — each formatted client-side from
    // the raw params, exactly as the release controls render them (AD-3, NFR-1).
    text = tf(
      'd_scen', lang, nf(p.size, lang), nf(p.win, lang), `${sgn(p.index, lang, 1)}%`,
    );
  } else {
    text = t(entry.kind, lang);
  }
  // The actor subline (UX-DR10, NFR-3): the acting account and its localized role, both
  // resolved server-side from the entry's user id — the real attribution, never a static
  // name. Absent only for a legacy row whose user has since been removed.
  const roleLabel = entry.role ? t(`role_${entry.role}`, lang) : null;
  const actor = [entry.by, roleLabel].filter(Boolean).join(' · ');
  return el('div', null, [
    el('b', null, [`${time} ${text}`]),
    el('div', { class: 'sub' }, [actor]),
  ]);
}

export function buildJournal(state, entries) {
  const { lang } = state;
  const list = entries || [];
  if (!list.length) {
    return el('div', { class: 'panel' }, [
      el('h2', null, [t('d_shadow', lang)]),
      el('div', { class: 'note' }, [t('d_journal_empty', lang)]),
    ]);
  }
  return el('div', { class: 'panel' }, [
    el('h2', null, [t('d_shadow', lang)]),
    el('div', { class: 'log' }, list.map((entry) => buildJournalEntry(state, entry))),
  ]);
}

// The «Согласовать все» control (one of the four command controls, UX-DR3): approves
// every pending recommendation. Shown to every role — the director's is disabled only
// at zero pending (UX-DR6); a manager/analyst sees it visible-but-disabled with the
// «Требуется роль» tooltip (presentation only). The command failure/pending note slot
// rides beside it. `groupPerm` is the payload's `group_approval` permission entry.
function buildApproveAll(state, data, groupPerm) {
  const { lang } = state;
  const canApprove = !!(groupPerm && groupPerm.allowed);
  const attrs = { type: 'button', class: 'btn-primary', 'data-approve-all': '1' };
  if (!canApprove) {
    // AC5 / UX-DR3: disabled + tooltip for the non-director; the click delegation
    // guards on `disabled` so the hook never fires.
    attrs.disabled = 'disabled';
    attrs['aria-disabled'] = 'true';
    const requires = groupPerm && groupPerm.requires;
    if (requires) {
      attrs.title = tp('x_requires_role_tip', lang, { role: tlc(`role_${requires}`, lang) });
    }
  } else if (!data.pending) {
    attrs.disabled = 'disabled';
    attrs['aria-disabled'] = 'true';
  }
  return el('div', { class: 'fx wrap', style: 'gap:10px;background:none;border:0;padding:0' }, [
    el('span', { class: 'mini-lb', style: 'margin:0' }, [
      `${t('ap_pending', lang)}: ${data.pending}`,
    ]),
    el('button', attrs, [t('ap_all', lang)]),
  ]);
}

// The per-type pending counts, read off the table rows — the recommendation count the
// group-approval confirm modal shows and the enablement of each group control.
function deskPendingByType(data) {
  const counts = {};
  const seen = new Set();
  for (const row of data.table.rows) {
    if (!row.pending) continue;
    // The overlay's natural key is the unit id, so an id is owned by its first pending
    // row — the canonical row the table decides on and `group_approval` keys off. Dedup
    // globally, not per type: a later same-id row of another typology must not add a
    // second count, or that group's confirm modal would promise a recommendation the
    // transaction refuses to move (the id belongs to the first row's group) (AR-5/FR-24).
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    counts[row.type] = (counts[row.type] || 0) + 1;
  }
  return counts;
}

function operationalMoney(value, currency, lang) {
  if (value == null) return '—';
  return `${formatScaledOperational(value, 2, 2, lang)}${currency ? ` ${currency}` : ''}`;
}

function operationalBuildingKey(section) {
  if (section?.building_id != null) return `id:${section.building_id}`;
  if (section?.building_external_id) return `external:${section.building_external_id}`;
  return null;
}

function composeOperationalBuildingBoard(boards, preferredSectionId = null, filters = {}) {
  const available = (boards || []).filter(Boolean);
  if (!available.length) return null;
  const preferred = available.find((board) => (
    String(board.section?.section_id) === String(preferredSectionId)
  ));
  const filteredBuilding = available.find((board) => (
    (filters.building_id != null
      && String(board.section?.building_id) === String(filters.building_id))
    || (filters.building != null
      && String(board.section?.building_external_id) === String(filters.building))
  ));
  const anchor = filteredBuilding || preferred || available[0];
  const buildingKey = operationalBuildingKey(anchor.section);
  const selectedUnordered = buildingKey == null
    ? [anchor]
    : available.filter((board) => operationalBuildingKey(board.section) === buildingKey);
  const selected = [...selectedUnordered].sort((left, right) => {
    const leftPreferred = String(left.section?.section_id) === String(preferredSectionId);
    const rightPreferred = String(right.section?.section_id) === String(preferredSectionId);
    return Number(rightPreferred) - Number(leftPreferred);
  });
  const sections = selected.map((board, index) => ({
    ...board,
    sectionIndex: index,
  }));
  const floorNumbers = new Map();
  for (const board of sections) {
    for (const floor of board.axes?.floors || []) {
      const number = Number(floor.floor_number);
      if (!floorNumbers.has(number)) {
        floorNumbers.set(number, {
          floor_number: number,
          label: floor.label ?? floor.floor_number,
        });
      }
    }
  }
  const floors = [...floorNumbers.values()].sort(
    (left, right) => right.floor_number - left.floor_number,
  );
  const unitIds = new Set();
  let placements = 0;
  let sectionUnits = 0;
  let filteredOccupied = 0;
  let physicalPlacements = 0;
  let tableFilteredUnits = 0;
  let emittedDistinctUnits = 0;
  for (const board of sections) {
    sectionUnits += Number(board.counts?.section_units || 0);
    placements += Number(board.counts?.placements || 0);
    filteredOccupied += Number(board.counts?.filtered_occupied || 0);
    physicalPlacements += Number(board.counts?.physical_placements || 0);
    tableFilteredUnits += Number(board.reconciliation?.table_filtered_units || 0);
    emittedDistinctUnits += Number(board.reconciliation?.emitted_distinct_units
      ?? board.counts?.visible_units ?? 0);
    for (const cell of board.cells || []) {
      if (cell.type === 'unit' && cell.unit?.unit_id != null) {
        unitIds.add(String(cell.unit.unit_id));
      }
    }
  }
  const physicalPositions = floors.length * sections.reduce(
    (total, board) => total + (board.axes?.stacks || []).length, 0,
  );
  const failedLayout = sections.find((board) => board.layout?.state === 'unavailable');
  const reconciliationMatched = sections.every(
    (board) => board.reconciliation?.matched !== false,
  );
  const inventoryReady = sections.every(
    (board) => board.readiness?.inventory?.state === 'ready',
  );
  const calculationReady = sections.every(
    (board) => board.readiness?.calculation?.state === 'ready',
  );
  const missingInputs = (kind) => [...new Set(sections.flatMap(
    (board) => board.readiness?.[kind]?.missing_inputs || [],
  ))];
  return {
    context: anchor.context || {},
    section: anchor.section || null,
    axes: anchor.axes || { floors: [], stacks: [] },
    cells: anchor.cells || [],
    building: {
      building_id: anchor.section?.building_id,
      building_external_id: anchor.section?.building_external_id,
      building_name: anchor.section?.building_name,
    },
    layout: failedLayout?.layout || { state: 'available', reason: null },
    sections,
    floors,
    counts: {
      visible_units: unitIds.size,
      section_units: sectionUnits,
      placements,
      filtered_occupied: filteredOccupied,
      physical_placements: physicalPlacements,
      physical_positions: physicalPositions,
      gaps: physicalPositions - physicalPlacements,
    },
    reconciliation: {
      table_filtered_units: tableFilteredUnits,
      emitted_distinct_units: emittedDistinctUnits,
      matched: reconciliationMatched,
      reason: reconciliationMatched ? null : 'inventory_chessboard_reconciliation_failed',
    },
    readiness: {
      state: inventoryReady ? 'ready' : 'missing',
      missing_inputs: missingInputs('inventory'),
      inventory: {
        state: inventoryReady ? 'ready' : 'missing',
        missing_inputs: missingInputs('inventory'),
      },
      calculation: {
        state: calculationReady ? 'ready' : 'missing',
        missing_inputs: missingInputs('calculation'),
      },
    },
    no_matches: sections.length > 0 && sections.every((board) => board.no_matches),
  };
}

function operationalBoardSections(board) {
  if (Array.isArray(board?.sections)) return board.sections;
  return board?.section ? [{ ...board, sectionIndex: 0 }] : [];
}

function operationalBoardFloors(board) {
  if (Array.isArray(board?.floors)) return board.floors;
  return (board?.axes?.floors || []).map((floor) => ({
    floor_number: Number(floor.floor_number),
    label: floor.label ?? floor.floor_number,
  }));
}

function operationalBoardUnitEntries(board) {
  const sections = operationalBoardSections(board);
  const floors = operationalBoardFloors(board);
  let columnOffset = 0;
  const entries = [];
  sections.forEach((sectionBoard, sectionIndex) => {
    const sectionId = sectionBoard.section?.section_id;
    const stacks = sectionBoard.axes?.stacks || [];
    const localFloors = sectionBoard.axes?.floors || [];
    for (const cell of sectionBoard.cells || []) {
      if (cell.type !== 'unit') continue;
      const floor = localFloors.find(
        (item) => String(item.floor_id) === String(cell.floor_id),
      );
      const floorNumber = Number(floor?.floor_number);
      const row = floors.findIndex((item) => Number(item.floor_number) === floorNumber);
      const localColumn = stacks.findIndex(
        (item) => String(item.stack_id) === String(cell.stack_id),
      );
      if (row < 0 || localColumn < 0) continue;
      entries.push({
        cell,
        sectionId,
        sectionIndex,
        floorId: cell.floor_id,
        floorNumber,
        stackId: cell.stack_id,
        row,
        column: columnOffset + localColumn,
      });
    }
    columnOffset += stacks.length;
  });
  return entries;
}

function operationalRecommendationText(recommendation, lang) {
  const value = recommendation || { state: 'unavailable' };
  const stateLabel = t(`inventory_recommendation_${value.state || 'unavailable'}`, lang);
  return value.target_absolute_scaled != null
    ? `${stateLabel}: ${operationalMoney(
      value.target_absolute_scaled, value.currency, lang,
    )}`
    : stateLabel;
}

function buildOperationalDecisionControls(
  state, operational, unit, recommendation, surfaceKey,
) {
  const unitId = unit?.unit_id;
  const value = recommendation || {};
  if (value.target_absolute_scaled == null || !value.lineage) return null;
  if (value.state === 'stale') return null;
  const savedRefreshFailure = operational.decisionSavedRefreshFailures?.[String(unitId)];
  if (savedRefreshFailure) {
    return el('div', { class: 'inventory-decision-controls' }, [
      el('p', { class: 'danger', role: 'alert' }, [
        t('inventory_recommendation_decision_saved_refresh_failed', state.lang),
      ]),
    ]);
  }
  const capability = operational.capabilities?.inventory_recommendation_decision || {};
  const allowed = capability.allowed === true;
  const ready = value.state === 'ready';
  const busy = operational.decisionBusy === true;
  const disabled = !allowed || !ready || busy;
  const roleTip = tp('x_requires_role_tip', state.lang, {
    role: tlc('role_manager', state.lang),
  });
  const stateTip = t(`inventory_recommendation_${value.state || 'unavailable'}`, state.lang);
  const title = !allowed ? roleTip : !ready ? stateTip : null;
  const noteId = `inventory-decision-note-${surfaceKey}-${unitId}`;
  const button = (verdict, labelKey) => el('button', {
    type: 'button', class: verdict === 'accepted' ? 'btn-primary' : 'btn-ghost',
    'data-inventory-recommendation-decision': verdict,
    'data-inventory-unit-id': unitId,
    'data-inventory-version-id': value.lineage.inventory_version_id,
    'data-inventory-snapshot-id': value.lineage.snapshot_id,
    'data-inventory-result-id': value.lineage.result_id,
    'data-inventory-decision-surface': surfaceKey,
    disabled: disabled ? 'disabled' : null,
    'aria-disabled': disabled ? 'true' : null,
    'aria-describedby': noteId,
    title,
  }, [busy && operational.decisionIntent?.unitId === String(unitId)
    ? t('inventory_recommendation_decision_pending', state.lang)
    : t(labelKey, state.lang)]);
  const error = operational.decisionError
    && operational.decisionError.unitId === String(unitId)
    ? el('p', { class: 'danger', role: 'alert' }, [
        t(operational.decisionError.key || 'x_internal_error', state.lang),
      ]) : null;
  // In the unit table the «price stays put» note is said once above the
  // rows; each row keeps only what differs — a role tip or a state tip.
  const compact = surfaceKey === 'table' && allowed && ready;
  return el('div', { class: 'inventory-decision-controls' }, [
    el('div', { class: 'actions', role: 'group',
      'aria-label': t('inventory_recommendation_decision_actions', state.lang) }, [
      button('accepted', 'inventory_recommendation_accept'),
      button('declined', 'inventory_recommendation_decline'),
    ]),
    compact ? null : el('p', { id: noteId, class: 'sub' }, [
      !allowed ? roleTip : ready
        ? t('inventory_recommendation_decision_price_unchanged', state.lang)
        : stateTip,
    ]),
    error,
  ]);
}

function projectDataCapabilities(state, operational = state.operationalDesk) {
  return state.confirmedCapabilities || (state.screen === 'data'
    ? state.dataState?.capabilities : operational?.capabilities) || {};
}

function buildProjectDataActions(state, handlers) {
  const capabilities = projectDataCapabilities(state);
  if (!capabilities?.import_upload?.allowed) return null;
  const data = el('button', {
    type: 'button', class: 'btn-ghost', 'data-open-data': '1',
    disabled: state.dataActivationPending ? 'disabled' : null,
  }, [t('nav_data', state.lang)]);
  data.addEventListener('click', () => handlers.onOpenData(false));
  const create = el('button', {
    type: 'button', class: 'btn-primary', 'data-new-project': '1',
    disabled: state.dataActivationPending ? 'disabled' : null,
  }, [t('x_new_project', state.lang)]);
  create.addEventListener('click', () => handlers.onOpenData(true));
  return el('nav', {
    class: 'project-data-actions', 'aria-label': t('x_project_data_actions', state.lang),
  }, [data, create]);
}

function buildOperationalRail(state, handlers) {
  const operational = state.operationalDesk || {};
  const projects = operational.projects || [];
  const signatures = new Map();
  projects.forEach((project) => {
    const name = project.project_name || project.project_external_id || '—';
    const signature = `${name}|${project.version_sequence ?? ''}|${operationalDateLabel(project.source_as_of_utc)}`;
    signatures.set(signature, (signatures.get(signature) || 0) + 1);
  });
  const items = projects.map((project) => {
    const name = project.project_name || project.project_external_id || '—';
    const signature = `${name}|${project.version_sequence ?? ''}|${operationalDateLabel(project.source_as_of_utc)}`;
    const displayName = signatures.get(signature) > 1
      ? `${name} · ${project.project_external_id}` : name;
    const active = String(project.project_id) === String(operational.projectId);
    const button = el('button', {
      type: 'button',
      class: active ? 'pitem on' : 'pitem',
      'data-operational-rail-project': project.project_id,
      'aria-current': active ? 'page' : null,
      'aria-label': `${displayName}. ${tf(
        'operational_rail_project_meta', state.lang,
        project.version_sequence ?? '—',
        operationalDateLabel(project.source_as_of_utc),
      )}`,
    }, [
      el('span', { class: 'pav' }, [initial(displayName)]),
      el('span', { class: 'pmid' }, [
        el('span', { class: 'pnm' }, [displayName]),
        el('span', { class: 'psub mono' }, [
          tf(
            'operational_rail_project_meta', state.lang,
            project.version_sequence ?? '—',
            operationalDateLabel(project.source_as_of_utc),
          ),
        ]),
      ]),
    ]);
    button.addEventListener('click', () => {
      handlers.onOperationalProject(project.project_id);
    });
    return button;
  });
  const close = el('button', {
      type: 'button', class: 'operational-rail-close',
      'aria-label': t('operational_close_menu', state.lang),
      'data-operational-rail-close': '1',
  }, ['×']);
  close.addEventListener('click', handlers.onCloseRail);
  return el('aside', { class: 'rail operational-rail', id: 'rail' }, [
    close,
    buildBrand(state.lang),
    buildProjectDataActions(state, handlers),
    el('div', { class: 'railsec' }, [t('rail_proj', state.lang)]),
    el('div', { class: 'plist' }, items),
    el('div', { class: 'railfoot' }, [
      el('b', null, [t('operational_rail_footer', state.lang)]),
      tf('operational_rail_project_count', state.lang, projects.length),
    ]),
  ]);
}

// Active inventory keeps the original shell anatomy while every label and
// project row comes from active, org-scoped operational data. Unsupported
// synthetic market, portfolio and strategy controls remain absent.
function buildOperationalTopBar(state, handlers) {
  const selected = (state.operationalDesk?.projects || []).find(
    (item) => String(item.project_id) === String(state.operationalDesk?.projectId),
  );
  const burger = el('button', {
    type: 'button', class: 'burger',
    'aria-label': t('operational_menu', state.lang),
    'aria-controls': 'rail', 'aria-expanded': 'false',
  }, ['☰']);
  burger.addEventListener('click', () => handlers.onToggleRail());
  return el('header', { class: 'top operational-top' }, [
    burger,
    el('div', { class: 'crumbs' }, [
      selected?.project_name || selected?.project_external_id || t('inventory_title', state.lang),
      ' / ',
      el('b', null, [t(`nav_${state.surface}`, state.lang)]),
    ]),
    el('span', { class: 'spacer' }, []),
    el('div', { class: 'mobile-project-data-actions' }, [buildProjectDataActions(state, handlers)]),
    buildRoleBadge(state, handlers),
    buildLangSwitcher(state.lang, handlers.onLang),
  ]);
}

function buildOperationalRailBackdrop(state, handlers) {
  const backdrop = el('button', {
    type: 'button', class: 'operational-rail-backdrop', hidden: '',
    'aria-label': t('operational_close_menu', state.lang),
  }, []);
  backdrop.addEventListener('click', handlers.onCloseRail);
  return backdrop;
}

function buildOperationalTabs(state, handlers) {
  const buttons = OPERATIONAL_TAB_ORDER.map((surface) => el('button', {
    type: 'button',
    class: surface === state.surface ? 'tab on' : 'tab',
    'aria-current': surface === state.surface ? 'page' : null,
    'data-tab': surface,
  }, [t(`nav_${surface}`, state.lang)]));
  const box = el('nav', {
    class: 'tabs operational-tabs',
    'aria-label': t('nav_sec', state.lang),
  }, buttons);
  box.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-tab]');
    if (target) handlers.onTab(target.getAttribute('data-tab'));
  });
  return box;
}

// The algorithm switch. Every surface on this shell renders one algorithm's
// result, and this is where the operator picks which — the prototype's own
// `.stratbar` pills, reused because the gesture is the same one: a row of named
// alternatives with the live one lit and its description beside it.
//
// The keys are the server's implementation ids, so a pill names exactly one
// stored result; `label`/`note` are dictionary keys because a pill has to stay
// short in both languages while the long form reads underneath.
// The first entry is only the pill the console selects first. Nothing here
// runs unasked: a calculation can take long, so every one of them — this one
// included — starts on the operator's explicit command and never otherwise.
const OPERATIONAL_ALGORITHMS = [
  { key: 'dco-neutral', label: 'algo_dco', note: 'algo_dco_d', policy: 'neutral' },
  {
    key: 'dco-revenue-rate',
    label: 'algo_dco_revenue',
    note: 'algo_dco_revenue_d',
    policy: 'revenue_rate',
  },
  {
    key: 'dco-uniform-washout',
    label: 'algo_dco_uniform',
    note: 'algo_dco_uniform_d',
    policy: 'uniform_washout',
  },
];
const DEFAULT_OPERATIONAL_ALGORITHM = OPERATIONAL_ALGORITHMS[0].key;

function operationalAlgorithm(key) {
  return OPERATIONAL_ALGORITHMS.find((item) => item.key === key)
    || OPERATIONAL_ALGORITHMS[0];
}

// The `calculation` view the server puts on every operational read. Whichever
// of them the shell is currently holding says the same thing about the snapshot
// and the algorithms, so the first one held is as good as any.
function operationalCalculationView(operational) {
  const projection = operational.surfaceProjection || {};
  return projection.deal_price?.calculation
    || projection.today?.calculation
    || operational.table?.readiness?.calculation
    || {};
}

// Which algorithm produced these numbers, and which ones have a stored result.
function operationalAlgorithmBlock(operational) {
  return operationalCalculationView(operational).algorithms || {};
}

function buildOperationalAlgorithmBar(state, handlers) {
  const operational = state.operationalDesk || {};
  const lang = state.lang;
  const block = operationalAlgorithmBlock(operational);
  const computed = block.results || {};
  const active = operational.algorithm || DEFAULT_OPERATIONAL_ALGORITHM;
  const busyKey = operational.algorithmBusy;
  const canRun = operational.capabilities?.calculation_snapshot_run_dco?.allowed
    === true;
  const snapshotId = operationalSnapshotIdForAlgorithms(operational);

  const pills = OPERATIONAL_ALGORITHMS.map((item) => {
    const on = item.key === active;
    const attrs = {
      type: 'button',
      class: on ? 'pill on' : 'pill',
      'data-operational-algorithm': item.key,
      'aria-pressed': on ? 'true' : 'false',
    };
    if (busyKey === item.key) {
      attrs['aria-busy'] = 'true';
    }
    // A pill whose algorithm has not been run is offered, not hidden: choosing
    // it is how an operator asks for the run.
    if (!computed[item.key]) attrs.class += ' pill-uncomputed';
    return el('button', attrs, [t(item.label, lang)]);
  });

  const selected = operationalAlgorithm(active);
  const missing = !computed[active];
  const outdated = operationalSnapshotOutdated(operational);
  const note = busyKey
    ? t('algo_running', lang)
    : missing
      ? (outdated
        ? t('algo_snapshot_outdated', lang)
        : snapshotId == null
          ? t('algo_needs_snapshot', lang)
          : canRun
            ? t('algo_not_run', lang)
            : t('algo_requires_role', lang))
      : t(selected.note, lang);

  const children = [
    el('span', { class: 'mini-lb' }, [t('algo_h', lang)]),
    ...pills,
  ];
  // The run control appears only when it can do something: an algorithm that
  // has no result yet, a snapshot to run it against, and the role to ask for
  // it. There is no exception for the first pill — nothing runs by itself.
  if (missing && snapshotId != null && canRun) {
    children.push(el('button', {
      type: 'button',
      class: 'btn-ghost',
      'data-operational-algorithm-run': active,
      disabled: busyKey ? 'disabled' : null,
    }, [t(busyKey ? 'algo_running' : 'algo_run', lang)]));
  }
  children.push(el('span', { class: 'stratnote' }, [note]));
  if (operational.algorithmError) {
    children.push(el('span', { class: 'stratnote error-note' }, [
      t(operational.algorithmError.key || 'x_internal_error', lang),
    ]));
  }

  const box = el('div', {
    class: 'stratbar algobar',
    role: 'group',
    'aria-label': t('algo_h', lang),
  }, children);
  box.addEventListener('click', (event) => {
    const run = event.target.closest('button[data-operational-algorithm-run]');
    if (run) {
      handlers.onOperationalAlgorithmRun(
        run.getAttribute('data-operational-algorithm-run'),
      );
      return;
    }
    const pill = event.target.closest('button[data-operational-algorithm]');
    if (pill) {
      handlers.onOperationalAlgorithm(
        pill.getAttribute('data-operational-algorithm'),
      );
    }
  });
  return box;
}

// The input contract a snapshot must be stamped with for today's algorithms to
// run on it. A snapshot built under an earlier stamp is still a valid record —
// its old result stays readable — but nothing current can be run against it,
// and the console says so instead of offering a run that the server refuses.
const CURRENT_SNAPSHOT_STAMP = {
  algorithm_version: 'preview-snapshot-v1',
  policy_version: 'preview-policy-v1',
};

function operationalSnapshotStampCurrent(snapshot) {
  return !!snapshot
    && snapshot.algorithm_version === CURRENT_SNAPSHOT_STAMP.algorithm_version
    && snapshot.policy_version === CURRENT_SNAPSHOT_STAMP.policy_version;
}

// The snapshot the surfaces are reading is outdated when it is current for its
// version but carries an earlier stamp — the one case where «not calculated»
// would be the wrong thing to say.
function operationalSnapshotOutdated(operational) {
  const snapshot = operationalCalculationView(operational).snapshot;
  return !!snapshot && snapshot.current_state === 'current'
    && !operationalSnapshotStampCurrent(snapshot);
}

// The snapshot an algorithm run would target: the one the surfaces are already
// reading, only while it is the current one, and only under today's stamp.
function operationalSnapshotIdForAlgorithms(operational) {
  const snapshot = operationalCalculationView(operational).snapshot;
  if (!snapshot || snapshot.current_state !== 'current') return null;
  if (!operationalSnapshotStampCurrent(snapshot)) return null;
  return snapshot.id;
}

function operationalArea(value, areaUnit, lang) {
  if (value == null) return '—';
  return `${formatScaledOperational(value, 4, 4, lang)} ${areaUnit || ''}`.trim();
}

// Whole-currency money for the repricing tables: the kopecks a fixed-scale
// price carries are rounding residue, not a fact anyone prices on.
function operationalMoneyWhole(value, currency, lang) {
  if (value == null) return '—';
  return `${formatScaledOperational(value, 2, 0, lang)}${currency ? ` ${currency}` : ''}`;
}

function operationalAreaUnitLabel(areaUnit, lang) {
  if (!areaUnit) return '';
  const key = `inventory_area_unit_${String(areaUnit).toLowerCase()}`;
  return DICT[key] ? t(key, lang) : String(areaUnit);
}

// Area to one decimal with a localized unit: «61,4 м²», not «61,4100 sqm».
function operationalAreaShort(value, areaUnit, lang) {
  if (value == null) return '—';
  return `${formatScaledOperational(value, 4, 1, lang)} ${
    operationalAreaUnitLabel(areaUnit, lang)}`.trim();
}

function operationalPropertyType(propertyType, lang) {
  if (!propertyType) return '';
  const key = `inventory_property_type_${String(propertyType).toLowerCase()}`;
  return DICT[key] ? t(key, lang) : String(propertyType);
}

// The typology a unit row is priced under: its price group by name, or the
// source's own type and room count when the row carries no group.
function operationalUnitTypology(row, groupNames, lang) {
  const group = (row.pricing_inputs?.groups || [])[0];
  if (group?.name) return group.name;
  const named = groupNames.get(String(row.recommendation?.group_id));
  if (named) return named;
  const type = operationalPropertyType(row.property_type, lang);
  const rooms = row.rooms_value == null || row.rooms_value === ''
    ? '' : tf('inventory_rooms_short', lang, row.rooms_value);
  return [type, rooms].filter(Boolean).join(' · ') || '—';
}

// Relative change between two fixed-scale values of one scale, or null when a
// side is missing or the base is zero. Basis points keep the division in
// integers; the ratio is only for display.
function operationalDeltaRatio(current, recommended) {
  if (current == null || recommended == null) return null;
  let base;
  let target;
  try {
    base = BigInt(String(current));
    target = BigInt(String(recommended));
  } catch {
    return null;
  }
  if (base === 0n) return null;
  const bps = ((target - base) * 10000n) / base;
  if (bps > BigInt(Number.MAX_SAFE_INTEGER)
    || bps < BigInt(Number.MIN_SAFE_INTEGER)) return null;
  return Number(bps) / 10000;
}

function operationalDeltaNode(current, recommended, lang) {
  const ratio = operationalDeltaRatio(current, recommended);
  if (ratio == null) return el('span', { class: 'delta delta-none' }, ['—']);
  const direction = ratio > 0 ? 'delta-up' : ratio < 0 ? 'delta-down' : 'delta-flat';
  return el('span', { class: `delta ${direction} num` }, [
    `${ratio > 0 ? '+' : ''}${nf(ratio * 100, lang, 1)}%`,
  ]);
}

// A group's current base price per area, on the same footing as the
// recommended one: the deal-terms category base (before modifiers) when the
// projection carries it, else the current average price divided back through
// the group's average modifier.
function operationalGroupCurrentBase(group, categories) {
  const category = categories.get(String(group.group_id));
  if (category?.base_price_per_area_scaled != null) {
    return String(category.base_price_per_area_scaled);
  }
  const current = group.current || {};
  if (current.average_price_per_area_scaled == null
    || current.average_modifier_factor_scaled == null) return null;
  try {
    const factor = BigInt(String(current.average_modifier_factor_scaled));
    if (factor === 0n) return null;
    return String(
      (BigInt(String(current.average_price_per_area_scaled)) * 1000000000n) / factor,
    );
  } catch {
    return null;
  }
}

function formatScaledOperational(value, scaleDigits, displayDigits, lang) {
  let scaled;
  try {
    scaled = BigInt(String(value));
  } catch {
    return '—';
  }
  const negative = scaled < 0n;
  let absolute = negative ? -scaled : scaled;
  const droppedDigits = Math.max(0, scaleDigits - displayDigits);
  const roundingUnit = 10n ** BigInt(droppedDigits);
  if (droppedDigits) absolute = (absolute + (roundingUnit / 2n)) / roundingUnit;
  const decimalUnit = 10n ** BigInt(displayDigits);
  const whole = absolute / decimalUnit;
  const fraction = String(absolute % decimalUnit).padStart(displayDigits, '0');
  const decimal = (1.1).toLocaleString(localeFor(lang)).replace(/\d/g, '').charAt(0) || '.';
  return `${negative ? '-' : ''}${nf(whole, lang, 0)}${displayDigits ? decimal + fraction : ''}`;
}

function decimalToScaled(value, scaleDigits) {
  const match = String(value).trim().match(/^(\d+)(?:[.,](\d*))?$/);
  if (!match) return null;
  if ((match[2] || '').length > scaleDigits) return null;
  const fraction = (match[2] || '').padEnd(scaleDigits, '0');
  const scaled = BigInt(match[1]) * (10n ** BigInt(scaleDigits))
    + BigInt((fraction.slice(0, scaleDigits) || '').padEnd(scaleDigits, '0') || '0');
  return scaled <= 9223372036854775807n ? String(scaled) : null;
}

function scaledInputValue(value, scaleDigits) {
  try {
    const scaled = BigInt(String(value));
    const unit = 10n ** BigInt(scaleDigits);
    const whole = scaled / unit;
    const fraction = String(scaled % unit).padStart(scaleDigits, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : String(whole);
  } catch {
    return '';
  }
}

function operationalOption(value, label, selected) {
  return el('option', { value, selected: selected ? 'selected' : null }, [label]);
}

function localizedOperationalMissingInputs(keys, lang) {
  return (keys || []).map((key) => {
    const aliases = {
      inventory_history: 'inventory_history',
      calculation_snapshot: 'calculation_snapshot',
      dco: 'dco',
      snapshot: 'snapshot',
      'lineage.inventory_version_id': 'inventory_version',
      production_algorithm: 'production_algorithm',
      manual_control: 'manual_control',
      commercial_status: 'commercial_status',
      price_group: 'price_group',
      baseline_history_missing: 'history',
      baseline_history_invalid: 'history',
      baseline_history_group_missing: 'price_group',
      baseline_mixed_currency: 'currency',
      baseline_mixed_area_unit: 'area_unit',
      baseline_horizon_zero: 'time_grid',
      baseline_price_non_positive: 'demand_solution',
      baseline_absolute_price_non_positive: 'demand_solution',
      baseline_result: 'calculation_snapshot',
      inventory: 'inventory',
      reconciliation: 'reconciliation',
      history_reconciliation: 'history_reconciliation',
      'inventory.units': 'inventory',
      'inventory.current_prices': 'current_prices',
      'inventory.sales': 'sales',
      'inventory.price_history': 'price_history',
      'inventory.price_history.values': 'price_history_values',
      'inventory.modifiers.current': 'current_modifiers',
      'inventory.modifiers.completed': 'completed_modifiers',
      trend_history_invalid: 'history',
    };
    const known = aliases[key] || 'unknown';
    return t(`inventory_missing_input_${known}`, lang);
  });
}

function buildOperationalFilters(state, operational) {
  const { lang } = state;
  const filters = operational.filters || {};
  const options = operational.table?.filter_options || {};
  const optionSelect = (key, labelKey, optionKey) => el('label', { class: 'field' }, [
    el('span', { class: 'label' }, [t(labelKey, lang)]),
    el('select', {
      class: 'input', name: key, value: filters[key] || '',
      'data-inventory-filter': key,
    }, [
      operationalOption('', t('inventory_filter_all', lang), !filters[key]),
      ...((options[optionKey] || []).map((item) => operationalOption(
        item.value, item.label, String(filters[key]) === String(item.value),
      ))),
    ]),
  ]);
  const choiceSelect = (key, labelKey, choices) => el('label', { class: 'field' }, [
    el('span', { class: 'label' }, [t(labelKey, lang)]),
    el('select', { class: 'input', name: key, 'data-inventory-filter': key }, [
      operationalOption('', t('inventory_filter_all', lang), !filters[key]),
      ...choices.map(([value, keyName]) => operationalOption(
        value, t(keyName, lang), filters[key] === value,
      )),
    ]),
  ]);
  const scaledInput = (key, labelKey, scaleDigits) => el('label', { class: 'field' }, [
    el('span', { class: 'label' }, [t(labelKey, lang)]),
    el('input', {
      class: 'input', name: key, type: 'number', min: '0',
      step: scaleDigits === 4 ? '0.0001' : '0.01',
      value: filters[key] == null ? '' : scaledInputValue(filters[key], scaleDigits),
      'data-inventory-filter': key, 'data-filter-scale-digits': scaleDigits,
    }, []),
  ]);
  // The few filters a repricing pass actually reaches for stay in view; the
  // rest of the registry's facets fold away until one of them is in use.
  const advancedKeys = [
    'phase', 'section', 'property_type', 'rooms_value', 'area_min_scaled',
    'area_max_scaled', 'price_min_scaled', 'price_max_scaled',
    'calculation_readiness', 'manual_control', 'readiness',
  ];
  const advancedOpen = advancedKeys.some((key) => filters[key] != null && filters[key] !== '')
    || operational.sort !== 'unit_number' || operational.direction !== 'asc';
  return el('form', { class: 'inventory-filters', 'data-inventory-filters': '1' }, [
    operational.filterError
      ? el('p', { class: 'danger', role: 'alert' }, [
          t(operational.filterError.key || 'inventory_filter_invalid', lang),
        ]) : null,
    el('div', { class: 'inventory-filters-row' }, [
      el('label', { class: 'field' }, [
        el('span', { class: 'label' }, [t('inventory_filter_identity', lang)]),
        el('input', {
          class: 'input', name: 'identity', value: filters.identity || '',
          'data-inventory-filter': 'identity',
        }, []),
      ]),
      optionSelect('building', 'inventory_filter_building', 'buildings'),
      optionSelect('floor', 'inventory_filter_floor', 'floors'),
      el('label', { class: 'field' }, [
        el('span', { class: 'label' }, [t('inventory_filter_status', lang)]),
        el('select', {
          class: 'input', name: 'commercial_status',
          'data-inventory-filter': 'commercial_status',
        }, [
          operationalOption('', t('inventory_filter_all', lang), !filters.commercial_status),
          ...[
            'planned', 'not_released', 'available', 'reserved', 'booked',
            'sold', 'withdrawn', 'blocked', 'cancelled',
            'unknown',
          ].map((status) => operationalOption(
            status, t(`inventory_status_${status}`, lang), filters.commercial_status === status,
          )),
        ]),
      ]),
      choiceSelect('recommendation_state', 'inventory_filter_recommendation', [
        ['any', 'inventory_filter_recommendation_any'],
        ['ready', 'inventory_recommendation_ready'],
        ['accepted', 'inventory_recommendation_accepted'],
        ['declined', 'inventory_recommendation_declined'],
        ['stale', 'inventory_recommendation_stale'],
        ['unavailable', 'inventory_recommendation_unavailable'],
        ['calculation_pending', 'inventory_recommendation_calculation_pending'],
        ['no_change_recommended', 'inventory_recommendation_no_change_recommended'],
      ]),
    ]),
    el('details', { class: 'inventory-filters-more', open: advancedOpen ? 'open' : null }, [
      el('summary', null, [t('inventory_more_filters', lang)]),
      el('div', { class: 'inventory-filters-row' }, [
        optionSelect('phase', 'inventory_filter_phase', 'phases'),
        optionSelect('section', 'inventory_filter_section', 'sections'),
        optionSelect('property_type', 'inventory_filter_type', 'property_types'),
        optionSelect('rooms_value', 'inventory_filter_rooms', 'rooms'),
        scaledInput('area_min_scaled', 'inventory_filter_area_min', 4),
        scaledInput('area_max_scaled', 'inventory_filter_area_max', 4),
        scaledInput('price_min_scaled', 'inventory_filter_price_min', 2),
        scaledInput('price_max_scaled', 'inventory_filter_price_max', 2),
        choiceSelect('calculation_readiness', 'inventory_filter_calculation', [
          ['ready', 'inventory_readiness_ready'], ['missing', 'inventory_readiness_missing'],
          ['pending', 'inventory_readiness_pending'], ['stale', 'inventory_readiness_stale'],
        ]),
        el('label', { class: 'field' }, [
          el('span', { class: 'label' }, [t('inventory_filter_manual', lang)]),
          el('select', {
            class: 'input', name: 'manual_control',
            'data-inventory-filter': 'manual_control',
          }, [
            operationalOption('', t('inventory_filter_all', lang), filters.manual_control == null),
            operationalOption('true', t('inventory_yes', lang), filters.manual_control === true),
            operationalOption('false', t('inventory_no', lang), filters.manual_control === false),
          ]),
        ]),
        el('label', { class: 'field' }, [
          el('span', { class: 'label' }, [t('inventory_filter_readiness', lang)]),
          el('select', {
            class: 'input', name: 'readiness', 'data-inventory-filter': 'readiness',
          }, [
            operationalOption('', t('inventory_filter_all', lang), !filters.readiness),
            operationalOption('ready', t('inventory_readiness_ready', lang), filters.readiness === 'ready'),
            operationalOption('missing', t('inventory_readiness_missing', lang), filters.readiness === 'missing'),
          ]),
        ]),
        el('label', { class: 'field' }, [
          el('span', { class: 'label' }, [t('inventory_sort', lang)]),
          el('select', { class: 'input', name: 'sort', 'data-inventory-sort': 'sort' }, [
            ...[
              'unit_number', 'phase', 'building', 'section', 'floor', 'stack',
              'property_type', 'rooms', 'area', 'commercial_status', 'price',
              'manual_control',
            ].map((key) => operationalOption(
              key, t(`inventory_sort_${key}`, lang), operational.sort === key,
            )),
          ]),
        ]),
        el('label', { class: 'field' }, [
          el('span', { class: 'label' }, [t('inventory_direction', lang)]),
          el('select', {
            class: 'input', name: 'direction', 'data-inventory-sort': 'direction',
          }, [
            operationalOption('asc', t('inventory_ascending', lang), operational.direction === 'asc'),
            operationalOption('desc', t('inventory_descending', lang), operational.direction === 'desc'),
          ]),
        ]),
      ]),
    ]),
    el('div', { class: 'actions' }, [
      el('button', { type: 'submit', class: 'btn-ghost' }, [
        t('data_apply_filters', lang),
      ]),
      el('button', {
        type: 'button', class: 'btn-ghost', 'data-clear-inventory-filters': '1',
      }, [t('inventory_clear_filters', lang)]),
    ]),
  ]);
}

function buildOperationalDetail(state, operational) {
  const { lang } = state;
  const close = el('button', {
    type: 'button', class: 'btn-ghost', 'data-close-inventory-detail': '1',
  }, [t('inventory_detail_close', lang)]);
  const heading = el('h2', { id: 'inventory-detail-title', tabindex: '-1' }, [
    t('inventory_detail_title', lang),
  ]);
  if (operational.detailLoading) {
    return el('aside', {
      id: 'inventory-detail-panel', class: 'inventory-detail',
      'aria-labelledby': 'inventory-detail-title',
    }, [heading, close, el('p', { role: 'status' }, [t('x_loading', lang)])]);
  }
  if (operational.detailError) {
    return el('aside', {
      id: 'inventory-detail-panel', class: 'inventory-detail',
      'aria-labelledby': 'inventory-detail-title',
    }, [
      heading,
      close,
      el('p', { class: 'danger', role: 'alert' }, [
        t(operational.detailError.key || 'x_internal_error', lang),
      ]),
      el('button', {
        type: 'button', 'data-retry-inventory-detail': '1',
      }, [t('x_retry', lang)]),
    ]);
  }
  const detail = operational.detail;
  if (!detail) return null;
  const identity = detail.identity || {};
  const hierarchy = detail.hierarchy || {};
  const physical = detail.physical || {};
  const factsSection = (headingKey, id, facts) => el('section', {
    class: 'inventory-detail-section', 'aria-labelledby': id,
  }, [
    el('h3', { id }, [t(headingKey, lang)]),
    el('dl', { class: 'inventory-detail-facts' }, facts
      .filter(([_label, value]) => value !== null && value !== undefined && value !== '')
      .flatMap(([label, value]) => [
        el('dt', null, [label]), el('dd', { class: 'mono' }, [String(value)]),
      ])),
  ]);
  const identitySection = factsSection('inventory_detail_identity', 'inventory-identity-title', [
    [t('inventory_unit', lang), identity.unit_number || identity.unit_external_id],
    [t('inventory_external_id', lang), identity.unit_external_id],
    [t('inventory_source_system', lang), identity.source_system],
    [t('inventory_phase', lang), hierarchy.phase_name],
    [t('inventory_building', lang), hierarchy.building_name],
    [t('inventory_section', lang), hierarchy.section_name],
    [t('inventory_all_floors', lang), (hierarchy.floors || []).map(
      (floor) => floor.label ?? floor.floor_number,
    ).filter((value) => value != null).join(', ')],
    [t('inventory_stack', lang), hierarchy.stack_label || hierarchy.stack_code],
  ]);
  const physicalSection = factsSection('inventory_detail_physical', 'inventory-physical-title', [
    [t('inventory_type_rooms', lang), [physical.property_type, physical.rooms_value]
      .filter(Boolean).join(' · ')],
    [t('inventory_area', lang), physical.sellable_area_scaled == null ? null
      : operationalArea(physical.sellable_area_scaled, physical.area_unit, lang)],
    [t('inventory_total_area', lang), physical.total_area_scaled == null ? null
      : operationalArea(physical.total_area_scaled, physical.area_unit, lang)],
    [t('inventory_living_area', lang), physical.living_area_scaled == null ? null
      : operationalArea(physical.living_area_scaled, physical.area_unit, lang)],
    [t('inventory_kitchen_area', lang), physical.kitchen_area_scaled == null ? null
      : operationalArea(physical.kitchen_area_scaled, physical.area_unit, lang)],
    [t('inventory_balcony_area', lang), physical.balcony_area_scaled == null ? null
      : operationalArea(physical.balcony_area_scaled, physical.area_unit, lang)],
    [t('inventory_layout', lang), physical.layout_code],
    [t('inventory_orientation', lang), physical.orientation],
    [t('inventory_view', lang), physical.view_code],
    [t('inventory_finish', lang), physical.finish_code],
    [t('inventory_sellability', lang), physical.is_sellable == null ? null
      : t(physical.is_sellable ? 'inventory_yes' : 'inventory_no', lang)],
  ]);
  const pricingInputs = detail.pricing_inputs || {};
  const pricingSection = factsSection(
    'inventory_pricing_inputs',
    'inventory-pricing-inputs-title',
    [
      [t('inventory_price_groups', lang), (pricingInputs.groups || [])
        .map((group) => `${group.name} (${group.group_id})`).join(', ') || '—'],
      [t('inventory_modifier_factor', lang), pricingInputs.modifier?.factor_scaled == null
        ? '—' : formatScaledOperational(
          pricingInputs.modifier.factor_scaled, 9, 6, lang,
        )],
    ],
  );
  const recommendation = detail.recommendation || { state: 'unavailable', missing_inputs: [] };
  const inventoryReadiness = (detail.readiness || {}).inventory || { state: 'missing' };
  const calculation = (detail.readiness || {}).calculation || { state: 'missing' };
  const missingInputs = [...new Set([
    ...(inventoryReadiness.missing_inputs || []),
    ...(calculation.missing_inputs || []),
    ...(recommendation.missing_inputs || []),
  ])];
  const lineage = el('section', {
    class: 'inventory-detail-section inventory-unavailable',
    'aria-labelledby': 'inventory-lineage-title',
  }, [
    el('h3', { id: 'inventory-lineage-title' }, [t('inventory_detail_lineage', lang)]),
    el('p', null, [operationalRecommendationText(recommendation, lang)]),
    buildOperationalDecisionControls(
      state, operational, identity, recommendation, 'detail',
    ),
    recommendation.group_id ? el('p', null, [
      `${t('inventory_recommendation_group', lang)}: ${recommendation.group_id} · ${
        t(`inventory_group_outcome_${recommendation.group_state || 'unavailable'}`, lang)}`,
    ]) : null,
    (recommendation.rationale_codes || []).length ? el('p', null, [
      `${t('inventory_snapshot_rationale', lang)}: ${recommendation.rationale_codes
        .map((key) => t(key, lang)).join(' · ')}`,
    ]) : null,
    recommendation.lineage ? el('dl', {
      class: 'inventory-detail-facts inventory-recommendation-lineage',
    }, [
      [t('inventory_version', lang), recommendation.lineage.inventory_version_id],
      [t('inventory_version_key', lang), recommendation.lineage.inventory_version_key],
      [t('inventory_inventory_hash', lang), recommendation.lineage.inventory_sha256],
      [t('inventory_source_batch', lang), recommendation.lineage.source_batch_id],
      [t('inventory_snapshot_id', lang), recommendation.lineage.snapshot_id],
      [t('inventory_snapshot_hash', lang), recommendation.lineage.snapshot_sha256],
      [t('inventory_snapshot_result_id', lang), recommendation.lineage.result_id],
      [t('inventory_snapshot_result_hash', lang), recommendation.lineage.result_sha256],
      [t('inventory_snapshot_algorithm', lang), `${
        recommendation.lineage.algorithm_version || '—'} · ${
        recommendation.lineage.policy_version || '—'}`],
      [t('inventory_snapshot_implementation', lang), `${
        recommendation.lineage.implementation_id || '—'} · ${
        recommendation.lineage.implementation_version || '—'}`],
      [t('inventory_snapshot_executor', lang), recommendation.lineage.executed_by_user_id],
      [t('inventory_snapshot_executed_at', lang), recommendation.lineage.executed_at_utc],
    ].filter(([_label, value]) => value !== null && value !== undefined)
      .flatMap(([label, value]) => [
        el('dt', null, [label]),
        el('dd', { class: 'mono' }, [String(value)]),
      ])) : null,
    recommendation.decision ? el('dl', {
      class: 'inventory-detail-facts inventory-decision-lineage',
    }, [
      [t('inventory_recommendation_decision', lang),
        t(`inventory_recommendation_${recommendation.decision.verdict}`, lang)],
      [t('inventory_recommendation_decided_by', lang),
        recommendation.decision.decided_by_user_id],
      [t('inventory_recommendation_decided_at', lang),
        recommendation.decision.decided_at_utc],
    ].flatMap(([label, value]) => [
      el('dt', null, [label]), el('dd', { class: 'mono' }, [String(value)]),
    ])) : null,
    el('p', null, [`${t('inventory_inventory_readiness', lang)}: ${
      t(`inventory_readiness_${inventoryReadiness.state}`, lang)}`]),
    el('p', null, [`${t('inventory_calculation_readiness', lang)}: ${
      t(`inventory_readiness_${calculation.state}`, lang)}`]),
    // The recommendation's lineage already names this snapshot; the block
    // below is for units that have readiness but no recommendation to cite it.
    calculation.snapshot && !recommendation.lineage
      ? el('dl', { class: 'inventory-detail-facts inventory-snapshot-lineage' }, [
          el('dt', null, [t('inventory_snapshot_id', lang)]),
          el('dd', { class: 'mono' }, [String(calculation.snapshot.id)]),
          el('dt', null, [t('inventory_snapshot_hash', lang)]),
          el('dd', { class: 'mono' }, [String(calculation.snapshot.canonical_sha256)]),
          el('dt', null, [t('inventory_snapshot_algorithm', lang)]),
          el('dd', { class: 'mono' }, [
            `${calculation.snapshot.algorithm_version} · ${calculation.snapshot.policy_version}`,
          ]),
          el('dt', null, [t('inventory_snapshot_source', lang)]),
          el('dd', { class: 'mono' }, [
            `${calculation.snapshot.inventory_version_id} · ${calculation.snapshot.source_batch_id}`,
          ]),
          el('dt', null, [t('inventory_snapshot_cutoff', lang)]),
          el('dd', { class: 'mono' }, [String(calculation.snapshot.as_of_utc)]),
          el('dt', null, [t('inventory_snapshot_seed', lang)]),
          el('dd', { class: 'mono' }, ['—']),
          el('dt', null, [t('inventory_snapshot_reconciliation', lang)]),
          el('dd', null, [String(calculation.snapshot.reconciliation?.matched === true)]),
          el('dt', null, [t(`inventory_snapshot_${calculation.snapshot.current_state || 'stale'}`, lang)]),
          el('dd', { class: 'mono' }, [String(calculation.snapshot.source_as_of_utc)]),
        ]) : null,
    missingInputs.length
      ? el('p', null, [tf('inventory_missing_inputs', lang,
          localizedOperationalMissingInputs(missingInputs, lang).join(', '))]) : null,
  ]);
  const historyState = {
    lang,
    loading: false,
    error: null,
    data: detail.history || {},
  };
  return el('aside', {
    id: 'inventory-detail-panel', class: 'inventory-detail',
    'aria-labelledby': 'inventory-detail-title',
  }, [
    el('div', { class: 'inventory-detail-head' }, [heading, close]),
    identitySection,
    physicalSection,
    pricingSection,
    detail.history
      ? renderInventoryHistory(historyState, operational.historyHandlers || {})
      : el('section', { class: 'inventory-history', 'aria-labelledby': 'inventory-history-title' }, [
          el('h2', { id: 'inventory-history-title' }, [t('history_commercial_title', lang)]),
          el('p', { class: 'note', role: 'status' }, [t('inventory_history_pending', lang)]),
        ]),
    lineage,
  ]);
}

function buildOperationalDetailSurface(state, operational) {
  const detail = buildOperationalDetail(state, operational);
  if (!detail || operational.detailOriginMode !== 'chessboard') return detail;
  return el('div', {
    class: 'inventory-detail-dialog-mask',
    'data-inventory-detail-dialog-mask': '1',
  }, [el('div', {
    id: 'inventory-detail-dialog',
    class: 'inventory-detail-dialog',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'inventory-detail-title',
    'data-inventory-detail-dialog': '1',
  }, [detail])]);
}

function operationalModifierComponents(modifier) {
  const raw = modifier?.components;
  if (raw == null) return [];
  let components = raw;
  if (typeof components === 'string') {
    try {
      components = JSON.parse(components);
    } catch {
      return [];
    }
  }
  if (!components || Array.isArray(components) || typeof components !== 'object') return [];
  return Object.entries(components).sort(([left], [right]) => left.localeCompare(right));
}

function operationalModifierTag([key, value], lang) {
  const label = ['good_view', 'view'].includes(key)
    ? t('inventory_modifier_good_view', lang) : key;
  const factor = Number(value);
  if (!Number.isFinite(factor)) return `${label}: ${value}`;
  const delta = (factor - 1) * 100;
  return `${label} ${delta >= 0 ? '+' : ''}${nf(delta, lang, 0)}%`;
}

function buildOperationalChessboard(state, operational) {
  const { lang } = state;
  const board = operational.board || {};
  const floors = operationalBoardFloors(board);
  const sections = operationalBoardSections(board);
  const cells = sections.flatMap((sectionBoard) => sectionBoard.cells || []);
  const activeError = operational.boardError || operational.error;
  const retryAttributes = activeError?.retryProjectId != null
    ? {
        type: 'button',
        'data-retry-operational-project': activeError.retryProjectId,
      }
    : activeError?.retryMode
      ? {
          type: 'button',
          'data-retry-operational-mode': activeError.retryMode,
        }
    : activeError?.refresh
      ? { type: 'button', 'data-refresh-inventory-version': '1' }
      : { type: 'button', 'data-retry-chessboard': '1' };
  let boardBody = null;
  if (board.layout?.state === 'unavailable') {
    boardBody = el('div', { class: 'note w', role: 'status' }, [
      t(board.layout.reason || 'inventory_chessboard_layout_unavailable', lang),
    ]);
  } else if (operational.boardLoading && !cells.length) {
    boardBody = el('p', { role: 'status', 'aria-live': 'polite' }, [t('x_loading', lang)]);
  } else if (!floors.length || !sections.length || sections.every(
    (sectionBoard) => !(sectionBoard.axes?.stacks || []).length,
  )) {
    boardBody = el('p', { class: 'note', role: 'status' }, [
      t('inventory_chessboard_empty', lang),
    ]);
  } else {
    const rows = floors.map((sharedFloor, rowIndex) => el('tr', null, [
      el('th', { scope: 'row', class: 'chessboard-floor' }, [
        String(sharedFloor.label ?? sharedFloor.floor_number),
      ]),
      ...sections.flatMap((sectionBoard, sectionIndex) => {
        const section = sectionBoard.section || {};
        const stacks = sectionBoard.axes?.stacks || [];
        const floor = (sectionBoard.axes?.floors || []).find(
          (item) => Number(item.floor_number) === Number(sharedFloor.floor_number),
        );
        const byCoordinate = new Map((sectionBoard.cells || []).map((cell) => [
          `${cell.floor_id}:${cell.stack_id}`, cell,
        ]));
        return stacks.map((stack, stackIndex) => {
          const cell = floor
            ? byCoordinate.get(`${floor.floor_id}:${stack.stack_id}`) || { type: 'gap' }
            : { type: 'gap' };
          const entranceName = section.section_name || section.section_external_id || section.section_id;
          if (cell.type === 'gap') {
            return el('td', {
              class: `chessboard-gap ${stackIndex === 0 ? 'entrance-start' : ''}`.trim(),
              'data-chessboard-gap': '1',
              'aria-label': `${entranceName}: ${t('inventory_chessboard_gap', lang)}`,
            }, [el('span', { 'aria-hidden': 'true' }, ['—'])]);
          }
          if (cell.type === 'filtered') {
            return el('td', {
              class: `chessboard-filtered ${stackIndex === 0 ? 'entrance-start' : ''}`.trim(),
              'data-chessboard-filtered': '1',
              'aria-label': `${entranceName}: ${t('inventory_chessboard_filtered', lang)}`,
            }, [el('span', null, [t('inventory_chessboard_filtered', lang)])]);
          }
          const unit = cell.unit || {};
          const commercial = unit.commercial || {};
          const statusKey = commercial.status || 'unknown';
          const selected = String(operational.selectedUnitId) === String(unit.unit_id);
          const status = t(`inventory_status_${statusKey}`, lang);
          const price = unit.price
            ? operationalMoney(unit.price.absolute_scaled, unit.price.currency, lang) : '—';
          const pricePerArea = unit.price
            ? operationalMoney(unit.price.per_area_scaled, unit.price.currency, lang) : '—';
          const area = operationalArea(unit.sellable_area_scaled, unit.area_unit, lang);
          const pricingInputs = unit.pricing_inputs || {};
          const groupNames = (pricingInputs.groups || []).map(
            (group) => group.name || group.group_id,
          );
          const groupText = groupNames.join(', ') || '—';
          const modifier = pricingInputs.modifier;
          const modifierComponents = operationalModifierComponents(modifier);
          const modifierText = modifierComponents.length
            ? modifierComponents.map((component) => (
              operationalModifierTag(component, lang)
            )).join(', ')
            : t('inventory_chessboard_no_modifiers', lang);
          const placementRole = t(
            `inventory_chessboard_role_${cell.role || 'primary'}`, lang,
          );
          const recommendationText = operationalRecommendationText(
            unit.recommendation, lang,
          );
          const accessible = `${tf(
            'inventory_chessboard_cell_summary', lang,
            unit.unit_number || unit.unit_external_id,
            entranceName,
            sharedFloor.label ?? sharedFloor.floor_number,
            stack.label || stack.stack_code,
            status,
            groupText,
            price,
            pricePerArea,
            area,
            modifierText,
          )} · ${t('inventory_recommendation', lang)}: ${recommendationText}`;
          const tooltipId = `inventory-chessboard-summary-${sectionIndex}-${rowIndex}-${stackIndex}`;
          const focusKey = `${section.section_id}:${floor.floor_id}:${stack.stack_id}`;
          return el('td', {
            class: `chessboard-unit ${stackIndex === 0 ? 'entrance-start' : ''} ${
              selected ? 'selected' : ''}`.trim(),
          }, [el('button', {
            type: 'button',
            class: `chessboard-square status-${statusKey} recommendation-${
              unit.recommendation?.state || 'unavailable'}`,
            'data-commercial-status': statusKey,
            'data-chessboard-unit': unit.unit_id,
            'data-inventory-unit': unit.unit_id,
            'data-chessboard-section': section.section_id,
            'data-chessboard-floor': floor.floor_id,
            'data-chessboard-floor-number': sharedFloor.floor_number,
            'data-chessboard-stack': stack.stack_id,
            'data-chessboard-key': `${floor.floor_id}:${stack.stack_id}`,
            'data-chessboard-focus-key': focusKey,
            'aria-label': accessible,
            'aria-describedby': tooltipId,
            title: accessible,
            'aria-current': selected ? 'true' : null,
            'aria-expanded': String(operational.detailUnitId) === String(unit.unit_id)
              ? 'true' : 'false',
            'aria-controls': 'inventory-detail-dialog',
          }, [
            el('strong', { class: 'mono' }, [String(unit.unit_number || unit.unit_external_id)]),
            el('span', { class: 'sr-only' }, [` · ${status}`]),
            el('span', { id: tooltipId, class: 'chessboard-tooltip', role: 'tooltip' }, [
              el('strong', null, [String(unit.unit_number || unit.unit_external_id)]),
              el('span', { class: `status-tag status-${statusKey}` }, [status]),
              el('span', { class: `status-tag recommendation-${
                unit.recommendation?.state || 'unavailable'}` }, [recommendationText]),
              el('span', null, [`${t('inventory_price_groups', lang)}: ${groupText}`]),
              el('span', { class: 'num' }, [`${t('inventory_price', lang)}: ${price}`]),
              el('span', { class: 'num' }, [
                `${t('inventory_chessboard_price_per_area', lang)}: ${pricePerArea}`,
              ]),
              el('span', { class: 'num' }, [`${t('inventory_area', lang)}: ${area}`]),
              el('span', null, [`${t('inventory_modifier_factor', lang)}: ${
                modifier?.factor_scaled == null ? '—'
                  : formatScaledOperational(modifier.factor_scaled, 9, 4, lang)}`]),
              el('span', null, [`${t('inventory_chessboard_modifier_components', lang)}:`]),
              modifierComponents.length ? el('span', { class: 'chessboard-modifier-tags' },
                modifierComponents.map((component) => el('span', {
                  class: 'chessboard-modifier-tag',
                }, [operationalModifierTag(component, lang)]))) : el('span', null, [modifierText]),
              el('span', null, [placementRole]),
            ]),
          ])]);
        });
      }),
    ]));
    const nativeTable = el('table', { class: 'inventory-chessboard-table' }, [
      el('thead', null, [
        el('tr', null, [
          el('th', { scope: 'col', rowspan: '2' }, [t('inventory_floor', lang)]),
          ...sections.map((sectionBoard) => el('th', {
            scope: 'colgroup',
            colspan: String((sectionBoard.axes?.stacks || []).length),
            class: 'chessboard-entrance',
          }, [
            `${t('inventory_chessboard_entrance', lang)} ${
              sectionBoard.section?.section_name || sectionBoard.section?.section_external_id || ''}`,
          ])),
        ]),
        el('tr', null, sections.flatMap((sectionBoard) => (
          (sectionBoard.axes?.stacks || []).map((stack, stackIndex) => el('th', {
            scope: 'col', class: stackIndex === 0 ? 'entrance-start' : null,
          }, [String(stack.label || stack.stack_code)]))
        ))),
      ]),
      el('tbody', null, rows),
    ]);
    boardBody = el('div', {
      class: 'inventory-chessboard-scroll', tabindex: '0',
      'aria-label': t('inventory_chessboard_overflow', lang),
    }, [nativeTable]);
  }
  const selectedSection = operational.selectedUnitSectionId;
  const sectionOptions = operational.table?.filter_options?.sections || [];
  const boardSectionIds = new Set(sections.map(
    (sectionBoard) => String(sectionBoard.section?.section_id),
  ));
  const outsideSection = operational.selectedUnitId != null
    && selectedSection != null && !boardSectionIds.has(String(selectedSection));
  const replacementStatus = operational.boardLoading
    && (cells.length || board.layout?.state === 'unavailable')
    ? el('p', { role: 'status', 'aria-live': 'polite' }, [t('x_loading', lang)])
    : activeError
      ? el('div', { class: 'danger', role: 'alert' }, [
          t(activeError.key || 'x_internal_error', lang),
          el('button', retryAttributes, [t('x_retry', lang)]),
        ]) : null;
  const boardReconciliation = board.reconciliation || {};
  const reconciliationStatus = boardReconciliation.matched === false
    ? el('div', { class: 'danger', role: 'status' }, [
        el('p', null, [t(
          boardReconciliation.reason || 'inventory_chessboard_reconciliation_failed',
          lang,
        )]),
        el('p', { class: 'num' }, [tf(
          'inventory_chessboard_reconciliation_counts', lang,
          boardReconciliation.emitted_distinct_units ?? 0,
          boardReconciliation.table_filtered_units ?? 0,
        )]),
      ]) : null;
  return el('section', {
    class: 'inventory-chessboard', 'aria-labelledby': 'inventory-chessboard-title',
  }, [
    el('div', { class: 'inventory-chessboard-controls' }, [
      el('h2', { id: 'inventory-chessboard-title', tabindex: '-1' }, [
        t('inventory_chessboard_title', lang),
      ]),
      board.counts ? el('p', { class: 'sub num', role: 'status' }, [tf(
        'inventory_chessboard_counts', lang,
        board.counts.visible_units,
        board.counts.section_units,
        board.counts.placements,
        board.counts.physical_positions,
      )]) : null,
      sectionOptions.length ? el('label', { class: 'inventory-chessboard-jump' }, [
        el('span', null, [t('inventory_chessboard_section', lang)]),
        el('select', {
          class: 'input',
          'data-chessboard-section': '1',
          'aria-label': t('inventory_chessboard_section', lang),
        }, sectionOptions.map((section) => operationalOption(
          section.id,
          section.label || section.value || section.id,
          String(section.id) === String(operational.sectionId),
        ))),
      ]) : null,
      el('div', {
        class: 'inventory-chessboard-legend',
        'aria-label': t('inventory_chessboard_status_legend', lang),
      }, ['available', 'reserved', 'booked', 'sold', 'blocked'].map((statusKey) => el(
        'span', { class: `status-tag status-${statusKey}` }, [
          t(`inventory_status_${statusKey}`, lang),
        ],
      ))),
    ]),
    outsideSection ? el('div', { class: 'note', role: 'status' }, [
      t('inventory_selection_outside_section', lang),
      el('button', {
        type: 'button', class: 'btn-ghost',
        'data-open-selected-section': selectedSection,
      }, [t('inventory_open_selected_section', lang)]),
    ]) : null,
    board.no_matches ? el('div', { class: 'note', role: 'status' }, [
      el('p', null, [t('inventory_chessboard_no_matches', lang)]),
      el('button', {
        type: 'button', class: 'btn-ghost', 'data-clear-inventory-filters': '1',
      }, [t('inventory_clear_filters', lang)]),
    ]) : null,
    replacementStatus,
    reconciliationStatus,
    boardBody,
  ]);
}

function buildSnapshotWorkflow(state, operational) {
  const { lang } = state;
  const canCreate = operational.capabilities?.calculation_snapshot_create?.allowed === true;
  const canRun = operational.capabilities?.calculation_snapshot_run_dco?.allowed === true;
  const matchesCurrentContext = (snapshot) => (
    snapshot.current_state === 'current'
    && String(snapshot.project_id) === String(operational.projectId)
    && String(snapshot.inventory_version_id) === String(operational.inventoryVersionId)
    && snapshot.as_of_utc === operational.asOfUtc
    && snapshot.algorithm_version === 'preview-snapshot-v1'
    && snapshot.policy_version === 'preview-policy-v1'
  );
  const rows = (operational.snapshots || []).map((snapshot) => el('li', {
    class: `inventory-snapshot-item ${snapshot.current_state || 'stale'}`,
  }, [
    el('button', {
      type: 'button', class: 'btn-ghost mono',
      'data-inspect-calculation-snapshot': snapshot.id,
      disabled: operational.snapshotBusy ? 'disabled' : null,
    }, [`#${snapshot.id} · ${String(snapshot.canonical_sha256).slice(0, 12)} · ${
      t(`inventory_snapshot_${snapshot.current_state || 'stale'}`, lang)}`]),
    el('span', { class: 'sub' }, [
      `${t('inventory_snapshot_cutoff', lang)}: ${snapshot.as_of_utc} · ${
        t('inventory_snapshot_seed', lang)}: —`,
    ]),
    canRun && matchesCurrentContext(snapshot) ? el('button', {
      type: 'button', class: 'btn-ghost', 'data-run-calculation-snapshot': snapshot.id,
      disabled: operational.snapshotBusy ? 'disabled' : null,
    }, [t('inventory_snapshot_run_baseline', lang)]) : null,
  ]));
  const inspected = operational.inspectedSnapshot;
  const inspectedSnapshot = inspected?.snapshot || {};
  const inspectedResults = Array.isArray(inspected?.results)
    ? inspected.results : (inspected?.result ? [inspected.result] : []);
  const snapshotPage = operational.snapshotPagination || {};
  const resultPage = inspected?.result_pagination || {};
  const attribution = inspectedSnapshot.attribution || {};
  const provenanceRows = [
    [t('inventory_snapshot_id', lang), inspectedSnapshot.id],
    [t('inventory_snapshot_hash', lang), inspectedSnapshot.canonical_sha256],
    [t('inventory_snapshot_source', lang), `${inspectedSnapshot.inventory_version_key || '—'} · ${inspectedSnapshot.source_batch_id || '—'}`],
    [t('inventory_snapshot_source_as_of', lang), inspectedSnapshot.source_as_of_utc],
    [t('inventory_snapshot_cutoff', lang), inspectedSnapshot.as_of_utc],
    [t('inventory_snapshot_algorithm', lang), `${inspectedSnapshot.algorithm_version || '—'} · ${inspectedSnapshot.policy_version || '—'}`],
    [t('inventory_snapshot_seed', lang), '—'],
    [t('inventory_snapshot_reconciliation', lang), JSON.stringify(inspectedSnapshot.reconciliation || {})],
    [t('inventory_snapshot_attribution', lang), `${attribution.request_count || 0} · ${(attribution.requester_user_ids || []).join(', ') || '—'}${attribution.sample_has_more ? ' · …' : ''}`],
    [t('inventory_snapshot_state', lang), t(`inventory_snapshot_${inspected?.current_state || 'stale'}`, lang)],
  ];
  const resultSections = inspectedResults.map((inspectedResult) => {
    const resultRows = [
      [t('inventory_snapshot_result_id', lang), inspectedResult.result_id],
      [t('inventory_snapshot_result_hash', lang), inspectedResult.result_sha256],
      [t('inventory_snapshot_implementation', lang), `${inspectedResult.implementation_id || '—'} · ${inspectedResult.implementation_version || '—'}`],
      [t('inventory_snapshot_rationale', lang), (inspectedResult.payload?.rationale || [])
        .map((key) => t(key, lang)).join(' · ') || '—'],
    ];
    const groupRows = (inspectedResult.payload?.group_outcomes || []).map((outcome) => {
      const target = outcome.base_price_per_area_scaled == null ? '—'
        : `${operationalMoney(outcome.base_price_per_area_scaled, outcome.currency, lang)} / ${
          outcome.area_unit}`;
      return el('li', { class: 'mono' }, [
        `${outcome.group_id} · ${t(`inventory_group_outcome_${outcome.state}`, lang)} · ${
          target} · ${t('inventory_snapshot_horizon_steps', lang)}: ${
          outcome.horizon_steps ?? '—'} · ${(outcome.rationale_codes || [])
          .map((key) => t(key, lang)).join(' · ')}`,
      ]);
    });
    return el('section', { class: 'inventory-snapshot-result' }, [
      el('h4', null, [t('inventory_snapshot_result_title', lang)]),
      el('dl', { class: 'inventory-detail-grid' }, resultRows.map(([label, value]) => el('div', null, [
        el('dt', null, [label]), el('dd', { class: 'mono' }, [String(value ?? '—')]),
      ]))),
      groupRows.length ? el('ul', { class: 'inventory-snapshot-groups' }, groupRows) : null,
    ]);
  });
  const inspectionJson = inspected ? JSON.stringify(inspected, (key, value) => (
    key === 'rationale' && Array.isArray(value)
      ? value.map((rationaleKey) => t(rationaleKey, lang)) : value
  ), 2) : '';
  const semanticInspection = inspected ? el('section', {
    class: 'inventory-snapshot-inspection',
    'aria-labelledby': 'inventory-snapshot-inspection-title',
  }, [
    el('h3', { id: 'inventory-snapshot-inspection-title' }, [
      t('inventory_snapshot_inspection_title', lang),
    ]),
    el('dl', { class: 'inventory-detail-grid' }, provenanceRows.map(([label, value]) => el('div', null, [
      el('dt', null, [label]),
      el('dd', { class: 'mono' }, [value == null ? '—' : String(value)]),
    ]))),
    ...resultSections,
    el('details', null, [
      el('summary', null, [t('inventory_snapshot_raw', lang)]),
      el('pre', { class: 'mono' }, [inspectionJson]),
    ]),
  ]) : null;
  return el('section', {
    class: 'inventory-snapshot-workflow', 'aria-labelledby': 'inventory-snapshots-title',
  }, [
    el('h2', { id: 'inventory-snapshots-title' }, [t('inventory_snapshot_provenance', lang)]),
    operational.snapshotLoading || operational.snapshotBusy
      ? el('p', { role: 'status' }, [t('inventory_snapshot_busy', lang)]) : null,
    operational.snapshotError
      ? el('div', { class: 'danger', role: 'alert' }, [
        el('p', null, [t(operational.snapshotError.key, lang)]),
        ...(operational.snapshotError.issues || []).map((issue) => {
          const remedyLink = issue['reco' + 'very_link'];
          return el('p', null, [
            el('span', null, [t(issue.key, lang)]),
            remedyLink ? el('a', {
              href: remedyLink, class: 'btn-link',
            }, [t('inventory_snapshot_remedy', lang)]) : null,
          ]);
        }),
      ]) : null,
    rows.length ? el('ul', { class: 'inventory-snapshot-list' }, rows)
      : el('p', { class: 'note' }, [t('inventory_snapshot_empty', lang)]),
    snapshotPage.total > operational.snapshotPageSize ? el('div', {
      class: 'actions', 'aria-label': t('inventory_snapshot_pages', lang),
    }, [
      el('button', {
        type: 'button', class: 'btn-ghost', 'data-snapshot-page': 'prev',
        disabled: operational.snapshotBusy || operational.snapshotOffset <= 0
          ? 'disabled' : null,
      }, [t('inventory_snapshot_prev', lang)]),
      el('span', { class: 'num' }, [String(
        Math.floor(operational.snapshotOffset / operational.snapshotPageSize) + 1,
      )]),
      el('button', {
        type: 'button', class: 'btn-ghost', 'data-snapshot-page': 'next',
        disabled: operational.snapshotBusy || !snapshotPage.has_more ? 'disabled' : null,
      }, [t('inventory_snapshot_next', lang)]),
    ]) : null,
    canCreate ? el('div', { class: 'actions' }, [
      el('button', {
        type: 'button', class: 'btn-primary', 'data-create-calculation-snapshot': '1',
        disabled: operational.snapshotBusy ? 'disabled' : null,
      }, [t('inventory_snapshot_create', lang)]),
    ]) : null,
    semanticInspection,
    inspected && resultPage.total > operational.snapshotResultPageSize ? el('div', {
      class: 'actions', 'aria-label': t('inventory_snapshot_result_pages', lang),
    }, [
      el('button', {
        type: 'button', class: 'btn-ghost', 'data-snapshot-result-page': 'prev',
        disabled: operational.snapshotBusy || operational.snapshotResultOffset <= 0
          ? 'disabled' : null,
      }, [t('inventory_snapshot_prev', lang)]),
      el('span', { class: 'num' }, [String(
        Math.floor(operational.snapshotResultOffset / operational.snapshotResultPageSize) + 1,
      )]),
      el('button', {
        type: 'button', class: 'btn-ghost', 'data-snapshot-result-page': 'next',
        disabled: operational.snapshotBusy || !resultPage.has_more ? 'disabled' : null,
      }, [t('inventory_snapshot_next', lang)]),
    ]) : null,
  ]);
}


export function renderOperationalDeskSurface(state, operational) {
  const { lang } = state;
  const projects = operational.projects || [];
  if (!projects.length) {
    const returnToData = () => projectDataCapabilities(state, operational).import_upload?.allowed ? el('button', {
      type: 'button', class: 'btn-ghost', 'data-return-data-workspace': '1',
    }, [t('inventory_return_data', lang)]) : null;
    const status = operational.loading
      ? el('div', null, [
          el('p', { role: 'status', 'aria-live': 'polite' }, [t('x_loading', lang)]),
          returnToData(),
        ])
      : operational.error
        ? el('div', { class: 'danger', role: 'alert' }, [
            t(operational.error.key || 'x_internal_error', lang),
            el('button', {
              type: 'button', class: 'btn-primary',
              'data-retry-operational-discovery': '1',
            }, [t('x_retry', lang)]),
            returnToData(),
          ])
        : el('div', { class: 'note info', role: 'status' }, [
            el('h2', null, [t('inventory_no_active_version_title', lang)]),
            el('p', null, [t('inventory_no_active_version_body', lang)]),
            projectDataCapabilities(state, operational).import_upload?.allowed
              ? el('p', null, [t('inventory_no_active_version_steward', lang)]) : null,
            el('div', { class: 'actions' }, [
              el('button', {
                type: 'button', class: 'btn-primary',
                'data-retry-operational-discovery': '1',
              }, [t('x_retry', lang)]),
              returnToData(),
            ]),
          ]);
    return el('div', { class: 'desk operational-desk' }, [
      el('div', { class: 'h' }, [
        el('h1', { id: 'inventory-desk-title', tabindex: '-1' }, [t(`nav_${state.surface || 'desk'}`, lang)]),
        el('p', { class: 'sub' }, [t('inventory_subtitle', lang)]),
      ]),
      status,
    ]);
  }
  const table = operational.table || {};
  const activeProjection = operational.mode === 'chessboard' && operational.board
    ? operational.board : table;
  const context = activeProjection.context || {};
  const reconciliation = activeProjection.reconciliation || {};
  const readiness = activeProjection.readiness || table.readiness || {
    state: operational.loading ? 'pending' : 'missing',
    inventory: {
      state: operational.loading ? 'pending' : 'missing',
      missing_inputs: operational.loading ? [] : ['inventory_history'],
    },
    calculation: {
      state: operational.loading ? 'pending' : 'missing',
      missing_inputs: [],
    },
  };
  const rows = table.items || [];
  const deal = operational.surfaceProjection?.deal_price || null;
  const groupNames = new Map((deal?.groups || []).map((group) => [
    String(group.group_id), group.name || group.group_id,
  ]));
  const filters = operational.filters || {};
  const activeGroupId = filters.price_group_id;
  const showBuilding = (table.filter_options?.buildings || []).length > 1;
  const stale = context.version_changed
    ? el('div', { class: 'note w inventory-stale', role: 'status' }, [
        el('strong', null, [t('inventory_version_changed', lang)]),
        ` ${tf('inventory_active_version_named', lang, context.active_inventory_version_sequence)}`,
        el('button', {
          type: 'button', class: 'btn-primary', 'data-refresh-inventory-version': '1',
        }, [t('inventory_refresh_active', lang)]),
      ])
    : null;
  const tableRetryAttributes = operational.error?.retryProjectId != null
    ? {
        type: 'button',
        'data-retry-operational-project': operational.error.retryProjectId,
      }
    : operational.error?.retryMode
      ? {
          type: 'button',
          'data-retry-operational-mode': operational.error.retryMode,
        }
      : { type: 'button', 'data-retry-inventory-table': '1' };
  let body;
  if (operational.loading && !rows.length) {
    body = el('p', { role: 'status', 'aria-live': 'polite' }, [t('x_loading', lang)]);
  } else if (operational.error && !rows.length) {
    body = el('div', { class: 'danger', role: 'alert' }, [
      t(operational.error.key || 'x_internal_error', lang),
      el('button', tableRetryAttributes, [t('x_retry', lang)]),
    ]);
  } else if (!rows.length) {
    const versionUnits = Number(reconciliation.version_units || 0);
    const total = Number(table.total || 0);
    // The desk opens on «units with a recommendation»; when that alone empties
    // the list, the message says there are none yet, not that filters hid them.
    const onlyDefaultFilter = Object.keys(filters).length === 1
      && filters.recommendation_state === 'any';
    const emptyKey = versionUnits === 0
      ? 'inventory_empty'
      : total === 0
        ? (onlyDefaultFilter ? 'inventory_no_recommendations_yet' : 'inventory_no_matches')
        : 'inventory_page_empty';
    body = el('div', { class: 'note' }, [
      el('p', null, [t(emptyKey, lang)]),
      total === 0 && versionUnits > 0 ? el('button', {
        type: 'button', class: 'btn-ghost', 'data-clear-inventory-filters': '1',
      }, [t(onlyDefaultFilter ? 'inventory_show_all_units' : 'inventory_clear_filters', lang)]) : null,
    ]);
  } else {
    const sortHeader = (columnSort) => (
      columnSort.includes(operational.sort)
        ? (operational.direction === 'desc' ? 'descending' : 'ascending') : null
    );
    // Eight columns that answer «which unit, priced how, changed to what»;
    // readiness, manual control and lineage moved to the detail panel.
    const columns = [
      ['inventory_unit', ['unit_number']],
      ['inventory_location', ['building', 'section', 'floor']],
      ['inventory_typology', ['property_type', 'rooms']],
      ['inventory_area', ['area'], 'num'],
      ['inventory_status', ['commercial_status']],
      ['inventory_price', ['price'], 'num'],
      ['inventory_recommended_price', [], 'num'],
      ['inventory_delta', [], 'num'],
      ['inventory_recommendation_decision', []],
    ];
    const tableNode = el('table', { class: 'data-table inventory-table' }, [
      el('thead', null, [el('tr', null, [
        ...columns.map(([key, sorts, className]) => el('th', {
          scope: 'col', 'aria-sort': sortHeader(sorts), class: className || null,
        }, [t(key, lang)])),
      ])]),
      el('tbody', null, rows.map((row) => {
        const hierarchy = row.hierarchy || {};
        const commercial = row.commercial || {};
        const price = row.price;
        const recommendation = row.recommendation || { state: 'unavailable' };
        const target = recommendation.target_absolute_scaled;
        const selected = String(operational.selectedUnitId) === String(row.unit_id);
        const detailOpen = String(operational.detailUnitId) === String(row.unit_id);
        const location = [
          showBuilding ? hierarchy.building_name : null,
          hierarchy.section_name,
          ...(hierarchy.floors || []).map((floor) => floor.floor_label ?? floor.floor_number),
        ].filter((v) => v != null && v !== '').join(' · ') || '—';
        const stateLabel = t(`inventory_recommendation_${recommendation.state || 'unavailable'}`, lang);
        // A priced row's rationale is the algorithm's, the same for every row
        // and already named on the typology table; it stays for the rows that
        // need explaining — why there is no target.
        const explained = ['ready', 'accepted', 'declined'].includes(recommendation.state);
        const rationale = explained ? []
          : (recommendation.rationale_codes || []).map((key) => t(key, lang));
        const missing = localizedOperationalMissingInputs(recommendation.missing_inputs || [], lang);
        return el('tr', {
          class: selected ? 'selected' : null,
        }, [
          el('th', { scope: 'row' }, [el('button', {
            type: 'button', class: 'inventory-unit-link',
            'data-inventory-unit': row.unit_id,
            'aria-expanded': detailOpen ? 'true' : 'false',
            'aria-controls': 'inventory-detail-panel',
            'aria-current': selected ? 'true' : null,
          }, [String(row.unit_number || row.unit_external_id), detailOpen
            ? el('span', { class: 'sr-only' }, [` · ${t('inventory_detail_current', lang)}`])
            : null])]),
          el('td', null, [location]),
          el('td', null, [operationalUnitTypology(row, groupNames, lang)]),
          el('td', { class: 'num' }, [operationalAreaShort(row.sellable_area_scaled, row.area_unit, lang)]),
          el('td', null, [
            t(`inventory_status_${commercial.status}`, lang),
            commercial.manual_control ? el('span', { class: 'status-tag inventory-manual-tag' }, [
              t('inventory_manual_tag', lang),
            ]) : null,
          ]),
          el('td', { class: 'num' }, [price
            ? operationalMoneyWhole(price.absolute_scaled, price.currency, lang) : '—']),
          el('td', { class: 'num' }, [target != null
            ? operationalMoneyWhole(target, recommendation.currency || price?.currency, lang) : '—']),
          el('td', { class: 'num' }, [target != null && price
            ? operationalDeltaNode(price.absolute_scaled, target, lang) : '—']),
          el('td', { class: 'inventory-decision-cell' }, [
            el('span', {
              class: `status-tag recommendation-${recommendation.state || 'unavailable'}`,
            }, [stateLabel]),
            rationale.length || missing.length ? el('p', { class: 'sub inventory-rationale' }, [
              [
                ...rationale,
                ...(missing.length ? [tf('inventory_missing_inputs', lang, missing.join(', '))] : []),
              ].join(' · '),
            ]) : null,
            buildOperationalDecisionControls(
              state, operational, row, row.recommendation, 'table',
            ),
          ]),
        ]);
      })),
    ]);
    const tableScroll = el('div', { class: 'inventory-table-scroll', tabindex: '0',
      'aria-label': t('inventory_table_overflow', lang) }, [tableNode]);
    const replacementStatus = operational.loading
      ? el('p', { role: 'status', 'aria-live': 'polite' }, [t('x_loading', lang)])
      : operational.error ? el('div', { class: 'danger', role: 'alert' }, [
          t(operational.error.key || 'x_internal_error', lang),
          el('button', tableRetryAttributes, [
            t('x_retry', lang),
          ]),
        ]) : null;
    body = el('div', null, [replacementStatus, tableScroll]);
  }
  const offset = Number(table.offset || 0);
  const limit = Number(table.limit || operational.pageSize || 50);
  const total = Number(table.total || 0);
  const pager = el('nav', { class: 'inventory-pagination',
    'aria-label': t('inventory_pagination', lang) }, [
    el('button', { type: 'button', 'data-inventory-page': Math.max(1, operational.page - 1),
      disabled: operational.page <= 1 ? 'disabled' : null }, [t('data_previous', lang)]),
    el('span', { class: 'num', 'aria-live': 'polite' }, [
      total ? `${offset + 1}–${Math.min(offset + limit, total)} / ${total}` : '0 / 0',
    ]),
    el('button', { type: 'button', 'data-inventory-page': operational.page + 1,
      disabled: table.has_more ? null : 'disabled' }, [t('data_next', lang)]),
  ]);
  const readinessCard = (labelKey, value) => {
    const item = value || { state: 'missing', missing_inputs: [] };
    const missing = localizedOperationalMissingInputs(item.missing_inputs, lang);
    return el('div', { class: `inventory-readiness-item ${item.state || 'missing'}` }, [
      el('h3', null, [t(labelKey, lang)]),
      el('p', { class: 'status-tag', role: 'status' }, [
        t(`inventory_readiness_${item.state || 'missing'}`, lang),
      ]),
      missing.length ? el('p', { class: 'sub' }, [
        tf('inventory_missing_inputs', lang, missing.join(', ')),
      ]) : null,
    ]);
  };
  const readinessStrip = el('section', {
    class: 'inventory-readiness-strip',
    'aria-labelledby': 'inventory-readiness-title',
  }, [
    el('h2', { id: 'inventory-readiness-title' }, [t('inventory_readiness', lang)]),
    readinessCard('inventory_inventory_readiness', readiness.inventory),
    readinessCard('inventory_calculation_readiness', readiness.calculation),
  ]);
  // Readiness stays in front only while something is not ready; once both
  // sides are green it lives with the snapshots, where the provenance is.
  const readinessOk = (readiness.inventory?.state || readiness.state) === 'ready'
    && readiness.calculation?.state === 'ready';
  const serviceOpen = !!operational.inspectedSnapshot || !!operational.snapshotError
    || operational.snapshotBusy === true;
  const serviceBlock = el('details', {
    class: 'operational-details inventory-service',
    open: serviceOpen ? 'open' : null,
  }, [
    el('summary', null, [t('inventory_service_title', lang)]),
    readinessOk ? readinessStrip : null,
    buildSnapshotWorkflow(state, operational),
  ]);
  const groupNote = activeGroupId != null && activeGroupId !== ''
    ? el('div', { class: 'note info repricing-group-note', role: 'status' }, [
        tf('repricing_showing_group', lang, groupNames.get(String(activeGroupId)) || activeGroupId),
        el('button', {
          type: 'button', class: 'btn-ghost', 'data-inventory-group-filter': '',
        }, [t('repricing_all_groups', lang)]),
      ])
    : null;
  return el('div', { class: 'desk operational-desk' }, [
    el('div', { class: 'h' }, [
      el('h1', { id: 'inventory-desk-title', tabindex: '-1' }, [t('nav_desk', lang)]),
      el('p', { class: 'sub' }, [t('repricing_sub', lang)]),
      projectDataCapabilities(state, operational).import_upload?.allowed ? el('button', {
        type: 'button', class: 'btn-ghost', 'data-return-data-workspace': '1',
      }, [t('inventory_return_data', lang)]) : null,
    ]),
    el('div', { class: 'inventory-context' }, [
      context.project_external_id
        ? el('p', { class: 'sub mono' }, [
            `${t('inventory_project_external_id', lang)}: ${context.project_external_id}`,
          ]) : null,
      reconciliation.version_units != null
        ? el('p', { class: 'sub num' }, [tf(
            'inventory_reconciliation', lang,
            reconciliation.version_units,
            reconciliation.expected_units,
            reconciliation.filtered_units,
          )]) : null,
    ]),
    stale,
    buildRepricingStatusLine(state, operational, deal),
    readinessOk ? null : readinessStrip,
    buildOperationalRepricingSummary(state, operational),
    buildRepricingGroupsTable(state, operational, deal),
    el('div', { class: 'inventory-mode-switch', role: 'group',
      'aria-label': t('inventory_mode', lang) }, [
      el('button', {
        type: 'button', class: operational.mode === 'table' ? 'active' : 'btn-ghost',
        'data-inventory-mode': 'table',
        'aria-pressed': operational.mode === 'table' ? 'true' : 'false',
      }, [t('inventory_mode_table', lang)]),
      el('button', {
        type: 'button', class: operational.mode === 'chessboard' ? 'active' : 'btn-ghost',
        'data-inventory-mode': 'chessboard',
        'aria-pressed': operational.mode === 'chessboard' ? 'true' : 'false',
      }, [t('inventory_mode_chessboard', lang)]),
    ]),
    buildOperationalFilters(state, operational),
    groupNote,
    operational.mode === 'chessboard'
      ? buildOperationalChessboard(state, operational)
      : el('section', { 'aria-labelledby': 'inventory-table-title' }, [
          el('h2', { id: 'inventory-table-title', tabindex: '-1' }, [
            t('inventory_title', lang),
          ]),
          rows.length ? el('p', { class: 'sub' }, [
            t('inventory_recommendation_decision_price_unchanged', lang),
          ]) : null,
          body,
          pager,
        ]),
    buildOperationalDetailSurface(state, operational),
    serviceBlock,
  ]);
}

// Render the whole «Переоценка» surface. Every role sees all four command controls
// (accept/decline, group approval, «Согласовать все», strategy pills): the enabled
// ones for the role that owns them, the rest visible-but-disabled with the «Требуется
// роль» tooltip (UX-DR3). The command note slot carries the pessimistic-lifecycle /
// failure affordances (UX-DR6/UX-DR7). Pure: state in, DOM out; the wiring
// (invokeDecision / group approval / strategy switch) is attached by
// wireSurfaceControls after each paint.
export function renderDeskSurface(state, data) {
  if (state.operationalDesk && state.operationalDesk.enabled) {
    return renderOperationalDeskSurface(state, state.operationalDesk);
  }
  const { lang } = state;
  const perms = state.permissions || {};
  const unitPerm = perms.unit_decision || {};
  const groupPerm = perms.group_approval || {};
  const pendingByType = deskPendingByType(data);
  return el('div', { class: 'desk' }, [
    el('div', { class: 'h' }, [
      el('h1', null, [t('d_h1', lang)]),
      el('p', { class: 'sub' }, [t('d_sub', lang)]),
    ]),
    // The command note slot: the pessimistic-lifecycle danger/pending notes land here.
    el('div', { class: 'cmd-note', 'aria-live': 'polite', 'aria-atomic': 'true' }, []),
    buildDeskThreshold(state, data.threshold),
    // «Согласовать все» renders for every role (UX-DR3, visible-but-disabled for a
    // non-director) — the command control is always present, never hidden by role.
    buildApproveAll(state, data, groupPerm),
    buildDeskGroups(state, data, groupPerm, pendingByType),
    buildDeskTable(state, data, unitPerm),
    buildJournal(state, data.journal),
  ]);
}

// --- «Релиз» (Release) surface (Story 4.3, Task 2) ---------------------------
//
// The seeded simulator renders live from the release payload (viewmodels/
// release.py): the configuration controls with their contractual ranges (UX-DR5),
// the Monte-Carlo fan of cumulative sell-through as hand-rolled inline SVG
// (UX-DR15) with its stock and target reference lines, and the big-result readouts
// — the hit-probability tag with its severity colour, the P50 revenue, the NEP-vs-
// benchmark delta, and (RF only) the coverage → escrow-rate improvement note. The
// DOM structure and class names are the frozen prototype's `vRelease` (AD-14,
// UX-DR13); every number is formatted client-side through the `Intl` helpers (AD-3)
// — the payload carries raw values and message keys only. A project with fewer than
// 10 free units returns its verbatim empty state pointing at «Ретроспектива»
// (UX-DR8) — a state, not an error. The live-recalc wiring (discrete radio
// immediate, sliders debounced, sequence-token last-wins) is attached by
// wireSurfaceControls after each paint; the `scenario_save` command is Task 3's.

// The Release fan's chart palette — the frozen prototype's literal hex vocabulary
// (`vRelease`, lines 1905-1913): the green median line and its translucent P10–P90
// band, the dark dashed stock line, the amber dashed target line, and the muted
// grid/axis ink. Inline SVG needs explicit stroke/fill values, so these are named
// here once rather than reaching for a CSS variable per element (the prototype's
// SVG uses the same literals, so this preserves the visual freeze, NFR-10).
const FAN_COLORS = {
  band: 'rgba(47,184,77,.16)',
  median: '#2FB84D',
  stock: '#2B3A34',
  target: '#D9962B',
  grid: '#EFF4F1',
  axis: '#5C6B64',
};

// The controls panel (`.panel`): the size / window / index sliders with their
// contractual ranges (UX-DR5), the market discount-rate slider where the market
// reads one (UAE/KZ — RF drives its rate from escrow, so the payload carries no
// rate control and none renders), the concession-package radio group, and the
// coverage-plan context note under the coverage stance. Each slider carries its
// `data-control` marker for the live-recalc wiring; the number read-outs format
// client-side (AD-3, UX-DR14).
function buildReleaseControls(state, data) {
  const { lang } = state;
  const c = data.controls;
  const children = [
    el('h2', null, [t('r_ctrl', lang)]),
    buildSlider(
      'release_size', t('r_size', lang), nf(c.size.value, lang),
      c.size.min, c.size.max, c.size.step, c.size.value,
    ),
    buildSlider(
      'release_window', t('r_win', lang), nf(c.window.value, lang),
      c.window.min, c.window.max, c.window.step, c.window.value,
    ),
    buildSlider(
      'release_index', t('r_price', lang), `${sgn(c.index.value, lang, 1)}%`,
      c.index.min, c.index.max, c.index.step, c.index.value,
    ),
  ];
  // The discount-rate slider renders only where the payload carries a rate control
  // (UAE/KZ); RF omits it (escrow drives the rate). The slider carries a percent in
  // half-steps (5..16) matching the NEP surface, so it reuses the `rate` control
  // wiring — the value is the payload fraction scaled to a percent (UX-DR5).
  if (c.rate) {
    children.push(
      buildSlider('rate', t('w_rate', lang), pct(c.rate.value, lang, 1), 5, 16, 0.5, c.rate.value * 100),
    );
  }
  // The concession-package radio group (UX-DR5): one radio per none/base/full option,
  // the selected one lit, each carrying its per-market label key (never a localized
  // label, AD-3) and the `data-control="release_pack"` marker for the discrete-control
  // wiring that fires an immediate recalc.
  const radios = c.package.options.map((opt) => {
    const on = opt.key === c.package.selected;
    return el('label', { class: on ? 'tgi on' : 'tgi' }, [
      el('input', {
        type: 'radio',
        name: 'release_pack',
        value: opt.key,
        'data-control': 'release_pack',
        checked: on ? 'checked' : null,
      }, []),
      el('div', { class: 'nm' }, [t(opt.label_key, lang)]),
    ]);
  });
  children.push(
    el('div', { class: 'mini-lb', style: 'margin-top:12px' }, [t('r_pack', lang)]),
    el('div', { class: 'tg' }, radios),
  );
  // The coverage-plan context note (prototype `r_plan_d`, line 1890): the target
  // revenue (in millions) and its month, shown only under the coverage stance with a
  // covTarget. The months value renders «—» where the payload leaves it null (UX-DR8).
  if (data.cov_plan) {
    const cp = data.cov_plan;
    children.push(
      el('div', { class: 'note', style: 'margin-top:11px' }, [
        tf(
          cp.note_key, lang,
          fmtMillions(state, cp.target_abs),
          cp.months != null ? nf(cp.months, lang) : EM_DASH,
        ),
      ]),
    );
  }
  return el('div', { class: 'panel' }, children);
}

// The MC fan as hand-rolled inline SVG (UX-DR15): the P10–P90 band as a filled
// area, the P50 median as a green line, and the stock and target reference lines
// in the documented dashed vocabulary (dark `4 3` for stock, amber `2 3` for
// target). No hover, zoom or click — the accessible path is the P10/P50/P90/hit
// KPIs above and the HTML legend below (both carrying the same values). The
// geometry is the prototype's `vRelease` verbatim (W 640 × H 210, pad 34, the band
// upper/lower/median paths and the four-line grid), so the fan matches the frozen
// visual. The hit-probability tag carries its severity colour (pos/warn/neg from
// the payload) and its strategy-derived target; the committee note renders from its
// message key with the client-formatted hit percent (AD-3, NFR-1).
function buildReleaseFan(state, data) {
  const { lang } = state;
  const fan = data.fan;
  const result = data.result;
  const band = fan.band;
  const months = fan.months;
  const W = 640;
  const Hh = 210;
  const pad = 34;
  const mx = months || 1;
  const my = Math.max(fan.stock, fan.p90) * 1.05 || 1;
  const X = (i) => pad + ((W - pad - 10) * i) / mx;
  const Y = (v) => Hh - 24 - ((Hh - 40) * v) / my;
  // The band's upper (P90) edge left-to-right, its lower (P10) edge right-to-left,
  // and the P50 median — the prototype's three SVG path strings, verbatim.
  let up = '';
  let dn = '';
  let mid = '';
  band.forEach((b, i) => {
    up += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(b[2]).toFixed(1);
  });
  for (let i = band.length - 1; i >= 0; i -= 1) {
    dn += 'L' + X(i).toFixed(1) + ',' + Y(band[i][0]).toFixed(1);
  }
  band.forEach((b, i) => {
    mid += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(b[1]).toFixed(1);
  });
  const kids = [];
  // The four-line grid with its right-aligned mono value labels.
  for (let g = 0; g <= 4; g += 1) {
    const v = (my * g) / 4;
    kids.push(
      svgEl('line', { x1: pad, x2: W - 10, y1: Y(v), y2: Y(v), stroke: FAN_COLORS.grid }, []),
      svgEl(
        'text',
        { x: pad - 6, y: Y(v) + 3.5, 'text-anchor': 'end', 'font-size': 9, fill: FAN_COLORS.axis, 'font-family': 'monospace' },
        [nf(v, lang, 0)],
      ),
    );
  }
  // The filled band, then the median line over it.
  kids.push(
    svgEl('path', { d: up + dn + 'Z', fill: FAN_COLORS.band }, []),
    svgEl('path', { d: mid, fill: 'none', stroke: FAN_COLORS.median, 'stroke-width': 2 }, []),
  );
  // The stock reference line (dark dashed) with its right-anchored label, then the
  // target reference line (amber dashed) — the documented dashed vocabulary.
  kids.push(
    svgEl(
      'line',
      { x1: pad, x2: W - 10, y1: Y(fan.stock), y2: Y(fan.stock), stroke: FAN_COLORS.stock, 'stroke-width': 1, 'stroke-dasharray': '4 3' },
      [],
    ),
    svgEl(
      'text',
      { x: W - 12, y: Y(fan.stock) - 5, 'text-anchor': 'end', 'font-size': 9.5, fill: FAN_COLORS.stock },
      [`${t('r_size', lang)} ${nf(fan.stock, lang)}`],
    ),
    svgEl(
      'line',
      { x1: pad, x2: W - 10, y1: Y(fan.target), y2: Y(fan.target), stroke: FAN_COLORS.target, 'stroke-width': 1, 'stroke-dasharray': '2 3' },
      [],
    ),
  );
  // The x-axis month ticks and the axis title.
  const stepX = Math.max(1, Math.round(mx / 6));
  for (let g = 0; g <= mx; g += stepX) {
    kids.push(
      svgEl(
        'text',
        { x: X(g), y: Hh - 13, 'text-anchor': 'middle', 'font-size': 9, fill: FAN_COLORS.axis, 'font-family': 'monospace' },
        [String(g)],
      ),
    );
  }
  kids.push(
    svgEl(
      'text',
      { x: W / 2, y: Hh - 2, 'text-anchor': 'middle', 'font-size': 9, fill: FAN_COLORS.axis },
      [t('r_chart_x', lang)],
    ),
  );
  const svg = svgEl(
    'svg',
    { viewBox: `0 0 ${W} ${Hh}`, style: 'width:100%;height:auto;display:block', role: 'img', 'aria-label': t('r_out', lang) },
    kids,
  );

  // The strategy-derived target label — the coverage stance names its plan target,
  // every other stance its per-strategy sell-through target (prototype line 1904).
  const targetLabel =
    result.target_kind === 'cov' ? t('r_plan', lang) : t(`r_tgt_${result.target_kind}`, lang);
  const kpis = el('div', { class: 'grid g4', style: 'gap:9px;margin-bottom:12px' }, [
    buildKpi(t('r_p10', lang), nf(fan.p10, lang), t('u_units', lang), ''),
    buildKpi(t('r_p50', lang), nf(fan.p50, lang), t('u_units', lang), ''),
    buildKpi(t('r_p90', lang), nf(fan.p90, lang), t('u_units', lang), ''),
    buildKpi(
      t('r_hit', lang),
      `${nf(result.hit * 100, lang, 0)}%`,
      '',
      `${targetLabel}: ${nf(result.target, lang)} ${t('u_units', lang)}`,
      result.severity,
    ),
  ]);
  // The HTML legend below the SVG (UX-DR15): the four chart marks named with their
  // values, the accessible non-interactive path to the same data the fan draws.
  const legend = el('div', { class: 'legend' }, [
    el('div', null, [
      el('i', { style: `background:${FAN_COLORS.band};border:1px solid ${FAN_COLORS.median}` }, []),
      `${t('r_p10', lang)} – ${t('r_p90', lang)}`,
    ]),
    el('div', null, [el('i', { style: `background:${FAN_COLORS.median}` }, []), t('r_p50', lang)]),
    el('div', null, [
      el('i', { style: `background:${FAN_COLORS.stock}` }, []),
      `${t('r_size', lang)} `,
      el('b', null, [nf(fan.stock, lang)]),
    ]),
    el('div', null, [
      el('i', { style: `background:${FAN_COLORS.target}` }, []),
      `${targetLabel} `,
      el('b', null, [nf(fan.target, lang)]),
    ]),
  ]);
  // The committee note (AD-3, NFR-1): a message key with the raw hit fraction the
  // client formats as a whole-percent «cases out of a hundred» count — never prose.
  // A sub-55% hit renders the warn class the payload marks (`note_warn`).
  const committee = el(
    'div',
    { class: result.note_warn ? 'note w' : 'note', style: 'margin-top:10px' },
    [
      el('b', null, [`${t(result.committee_key, lang)}.`]),
      ` ${tf(result.note_key, lang, nf(result.note_params[0] * 100, lang, 0))}`,
    ],
  );
  return el('div', { class: 'panel' }, [
    el('h2', null, [t('r_out', lang)]),
    kpis,
    svg,
    legend,
    committee,
  ]);
}

// The big-result readouts (UX-DR15): the P50 present-value revenue in millions and
// the NEP-vs-benchmark comparison — the signed fraction tinted pos/neg, with the raw
// NEP / benchmark per-area pair as its detail. Numbers are mono and formatted
// client-side (AD-3, UX-DR14); the fraction renders «—» where the payload has no
// benchmark to compare against (UX-DR8).
function buildReleaseBigRes(state, data) {
  const { lang } = state;
  const result = data.result;
  const unit = priceUnitLabel(state);
  const frac = result.vs_bench_frac;
  return el('div', { class: 'grid g2', style: 'gap:10px;margin-top:12px' }, [
    buildKpi(t('r_rev', lang), fmtMillions(state, result.revenue_p50), '', ''),
    buildKpi(
      `${t('w_nep', lang)} / ${t('w_bench', lang)}`,
      frac != null ? ppt(frac, lang, 1) : EM_DASH,
      '',
      `${nf(result.nep_psf, lang, 0)} / ${nf(result.benchmark_psf, lang, 0)} ${unit}`,
      result.nep_psf >= result.benchmark_psf ? 'pos' : 'neg',
    ),
  ]);
}

// The RF coverage → escrow-rate improvement note (FR-19): committing the P50 revenue
// lifts escrow coverage, and the effective project-financing rate follows — the note
// reports both coverages and both effective rates, formatted client-side from the raw
// payload values. Present only where the payload carries an `escrow_note` (RF); UAE/KZ
// have none and this panel does not render (the «—» is the note's absence, UX-DR8).
function buildReleaseEscrow(state, note) {
  const { lang } = state;
  return el('div', { class: 'panel', style: 'margin-top:14px' }, [
    el('h2', null, [t('r_esc', lang)]),
    el('div', { class: 'note' }, [
      tf(
        note.note_key, lang,
        pct(note.cov, lang, 0),
        pct(note.cov2, lang, 0),
        pct(note.eff, lang, 2),
        pct(note.eff2, lang, 2),
      ),
    ]),
  ]);
}

// The «Зафиксировать сценарий для комитета» save control (Story 4.3, FR-20, UX-DR3).
// The manager's commit of the current scenario, gated exactly like the desk command
// controls: allowed → a live primary button carrying the `data-save-scenario` marker
// the click wiring dispatches on; disallowed → the same button visible-but-disabled
// with the «Требуется роль: {роль}» tooltip (presentation only — the server's guard
// enforces, AC2). The `.cmd-note` slot beside it carries the pessimistic-lifecycle
// failure/pending affordances (UX-DR6/UX-DR7), the mirror of the desk's slot.
function buildReleaseSave(state) {
  const { lang } = state;
  const perm = (state.permissions || {}).scenario_save || {};
  const allowed = !!perm.allowed;
  const attrs = { type: 'button', class: 'btn-primary', 'data-save-scenario': '1' };
  if (!allowed) {
    attrs.disabled = 'disabled';
    attrs['aria-disabled'] = 'true';
    if (perm.requires) {
      attrs.title = tp('x_requires_role_tip', lang, {
        role: tlc(`role_${perm.requires}`, lang),
      });
    }
  }
  return el('div', { class: 'panel', style: 'margin-top:14px' }, [
    // The command note slot: the pessimistic-lifecycle danger/pending notes land here.
    el('div', { class: 'cmd-note', 'aria-live': 'polite', 'aria-atomic': 'true' }, []),
    el('div', { class: 'fx wrap', style: 'gap:10px;background:none;border:0;padding:0' }, [
      el('button', attrs, [t('r_save', lang)]),
    ]),
  ]);
}

// Render the whole «Релиз» surface from `state` and the surface `data` block. A
// sold-out project (<10 free units) renders its verbatim empty state pointing at
// «Ретроспектива» (UX-DR8) — a state, not an error. Otherwise a header and a `g32`
// two-column grid: the controls on the left, the fan + big-result readouts + the RF
// escrow note + the committee save control on the right (prototype `vRelease` layout,
// UX-DR13). Pure: state in, DOM out; the live-recalc and save wiring is attached by
// wireSurfaceControls after paint.
export function renderReleaseSurface(state, data) {
  const { lang } = state;
  const header = el('div', { class: 'h' }, [
    el('h1', null, [t('r_h1', lang)]),
    el('p', { class: 'sub' }, [t('r_sub', lang)]),
  ]);
  if (data.state === 'empty') {
    // The verbatim <10-free-units empty state (UX-DR8): a warn note with the
    // «Ретроспектива» pointer text, never a fan or a big-result block — and no save
    // control, since there is no scenario to commit.
    return el('div', null, [
      header,
      el('div', { class: 'panel' }, [el('div', { class: 'note w' }, [t(data.note_key, lang)])]),
    ]);
  }
  const escrow = data.escrow_note ? buildReleaseEscrow(state, data.escrow_note) : null;
  return el('div', null, [
    header,
    el('div', { class: 'grid g32' }, [
      buildReleaseControls(state, data),
      el('div', null, [
        buildReleaseFan(state, data),
        buildReleaseBigRes(state, data),
        escrow,
        buildReleaseSave(state),
      ].filter(Boolean)),
    ]),
  ]);
}

// The «Динамика и прогноз» chart palette (prototype `CPAL`, line 2331) — the
// per-typology price-line colours, indexed by the line's size rank.
const TREND_PALETTE = ['#2FB84D', '#2B6FB8', '#B8632F', '#7A4FB8', '#B82F6B'];
// The forecast chart marks (UX-DR15): the cumulative-sold line, the total-stock
// dashed reference, the escrow-coverage line and the project-financing-rate line.
const TREND_COLORS = {
  sold: '#2FB84D',
  all: '#2B3A34',
  esc: '#2FB84D',
  rate: '#B8632F',
  band: 'rgba(47,184,77,.14)',
  grid: '#EFF4F1',
  axis: '#5C6B64',
  split: '#C9D8CF',
};

// The Russian / English month-name triples the month-axis labels read from — the
// prototype's `mlabel` names (line 2376). A label is `«мес 'YY»` for the month
// `offset` columns from today (offset 0 = the fact/forecast split «now»).
const TREND_MONTHS = {
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

// A month-axis label for the column `offset` months from today — the prototype's
// `mlabel(pr, i, back)` (line 2374): the calendar month/year, `offset` months from
// the current one (negative into the fact past, positive into the forecast). The
// current date is the client's, exactly as the prototype reads `new Date()`.
function trendMonthLabel(lang, offset) {
  const now = new Date();
  const names = TREND_MONTHS[lang] || TREND_MONTHS.en;
  let month = now.getMonth() + offset;
  let year = now.getFullYear();
  while (month < 0) {
    month += 12;
    year -= 1;
  }
  while (month > 11) {
    month -= 12;
    year += 1;
  }
  return `${names[month]} ${String(year).slice(2)}`;
}

function monthPointLabel(lang, point) {
  const names = TREND_MONTHS[lang] || TREND_MONTHS.en;
  const month = Number(point?.month);
  const year = Number(point?.year);
  if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isFinite(year)) {
    return EM_DASH;
  }
  return `${names[month]} ${year}`;
}

// A hand-rolled inline line chart (UX-DR15): grid, an optional fact/forecast split
// marker, an optional ±band area, the series polylines (each carrying its own colour,
// width and dash), a month axis, and an HTML legend below. Values that are `null`
// break the line into subpaths (the sales band is drawn only over the forecast). No
// hover, no zoom — the accessible path to the data is the legend and the tables. The
// `connectGaps` is reserved for a two-endpoint reference segment such as a constant
// horizon target; ordinary null facts still break their series. The mirror of the
// prototype's `lineChart` (line 2291) is built with `svgEl` so the fake DOM in the
// render harness walks the same tree a browser builds.
function buildTrendChart(state, opts) {
  const { lang } = state;
  const W = 660;
  const H = opts.height || 220;
  const padL = 48;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const n = opts.months;
  const split = opts.split;
  // The value range: every series point plus any band edge, then a 10% pad unless a
  // fixed min/max is given; `floor0` clamps the floor to zero for count charts.
  const all = [];
  opts.series.forEach((s) => s.values.forEach((v) => {
    if (v !== null && v !== undefined) all.push(v);
  }));
  if (opts.band) {
    opts.band.lo.forEach((v) => v !== null && v !== undefined && all.push(v));
    opts.band.hi.forEach((v) => v !== null && v !== undefined && all.push(v));
  }
  let mn = opts.min !== undefined ? opts.min : Math.min(...all);
  let mx = opts.max !== undefined ? opts.max : Math.max(...all);
  if (mx === mn) mx = mn + 1;
  if (opts.min === undefined && opts.max === undefined) {
    const pad = (mx - mn) * 0.1;
    mn -= pad;
    mx += pad;
  }
  if (opts.floor0) mn = Math.max(0, mn);
  const xValues = Array.isArray(opts.xValues) && opts.xValues.length === n
    ? opts.xValues.map(Number) : null;
  const xMin = xValues ? Math.min(...xValues) : 0;
  const xMax = xValues ? Math.max(...xValues) : Math.max(1, n - 1);
  const X = (i) => padL + (W - padL - padR) * (
    xValues ? (xValues[i] - xMin) / Math.max(1, xMax - xMin)
      : i / Math.max(1, n - 1)
  );
  const Y = (v) => H - padB - ((H - padT - padB) * (v - mn)) / (mx - mn);
  const kids = [];
  // The four-line grid with its right-aligned mono value labels.
  for (let g = 0; g <= 4; g += 1) {
    const v = mn + ((mx - mn) * g) / 4;
    kids.push(
      svgEl('line', { x1: padL, x2: W - padR, y1: Y(v), y2: Y(v), stroke: TREND_COLORS.grid }, []),
      svgEl(
        'text',
        { x: padL - 6, y: Y(v) + 3.4, 'text-anchor': 'end', 'font-size': 9, fill: TREND_COLORS.axis, 'font-family': 'monospace' },
        [nf(v, lang, 0)],
      ),
    );
  }
  // The fact/forecast split marker: a dashed vertical with «факт» / «прогноз» labels.
  if (split !== undefined && split > 0) {
    kids.push(
      svgEl('line', { x1: X(split), x2: X(split), y1: padT, y2: H - padB, stroke: TREND_COLORS.split, 'stroke-dasharray': '3 3' }, []),
      svgEl('text', { x: X(split) - 4, y: padT + 8, 'text-anchor': 'end', 'font-size': 9, fill: TREND_COLORS.axis }, [t('w_fact', lang)]),
      svgEl('text', { x: X(split) + 4, y: padT + 8, 'font-size': 9, fill: TREND_COLORS.axis }, [t('w_fcst', lang)]),
    );
  }
  // The ±band area (the sales P10–P90 envelope): its upper edge left-to-right, its
  // lower edge right-to-left, closed — drawn only where both edges are present.
  if (opts.band) {
    const { lo, hi } = opts.band;
    let up = '';
    let dn = '';
    lo.forEach((v, i) => {
      if (v === null || v === undefined) return;
      up += (up ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(hi[i]).toFixed(1);
    });
    for (let i = lo.length - 1; i >= 0; i -= 1) {
      if (lo[i] === null || lo[i] === undefined) continue;
      dn += 'L' + X(i).toFixed(1) + ',' + Y(lo[i]).toFixed(1);
    }
    if (up) kids.push(svgEl('path', { d: up + dn + 'Z', fill: opts.band.color || TREND_COLORS.band }, []));
  }
  // The series polylines: a `null` fact ends the current subpath (a gap). A series
  // explicitly marked `connectGaps` joins only its supplied endpoints, which lets a
  // constant reference span the horizon without manufacturing intermediate points.
  opts.series.forEach((s) => {
    let d = '';
    let started = false;
    s.values.forEach((v, i) => {
      if (v === null || v === undefined) {
        if (!s.connectGaps) started = false;
        return;
      }
      d += (started ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1);
      started = true;
    });
    const attrs = { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 1.8 };
    if (s.dash) attrs['stroke-dasharray'] = s.dash;
    kids.push(svgEl('path', attrs, []));
  });
  // The month axis: a label every ~sixth column, at the calendar month it stands for.
  const step = Math.max(1, Math.round(n / 6));
  const tickIndexes = new Set([0, Math.max(0, n - 1)]);
  for (let i = 0; i < n; i += step) tickIndexes.add(i);
  (opts.tickIndexes || []).forEach((i) => tickIndexes.add(i));
  [...tickIndexes].sort((a, b) => a - b).forEach((i) => {
    if (i < 0 || i >= n) return;
    const axisLabel = Array.isArray(opts.labels) && opts.labels[i] != null
      ? String(opts.labels[i])
      : split !== undefined ? trendMonthLabel(lang, i - split) : String(i);
    kids.push(
      svgEl(
        'text',
        { x: X(i), y: H - 10, 'text-anchor': 'middle', 'font-size': 8.6, fill: TREND_COLORS.axis },
        [axisLabel],
      ),
    );
  });
  const svg = svgEl(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;height:auto;display:block', role: 'img', 'aria-label': t(opts.title_key, lang) },
    kids,
  );
  // The HTML legend below the SVG (UX-DR15): the named marks, the non-interactive
  // path to the same series the chart draws. Unnamed marks (the split, and the
  // dashed continuation of an already-named line) are skipped. A series marked
  // `legendSolid` keeps the solid swatch even where the drawn line is dashed —
  // one typology is one legend row, exactly as the prototype's legend reads.
  const legend = el(
    'div',
    { class: 'legend', style: 'margin-top:2px' },
    opts.series
      .filter((s) => s.name)
      .map((s) => el('div', null, [
        el('i', {
          class: s.dash && !s.legendSolid ? 'legend-line dashed' : 'legend-line',
          style: s.dash && !s.legendSolid
            ? `background:transparent;border-top-color:${s.color}`
            : `background:${s.color}`,
        }, []),
        s.name,
      ])),
  );
  if (opts.bare) {
    return el('div', null, [svg, legend]);
  }
  return el('div', { class: 'panel' }, [el('h2', null, [t(opts.title_key, lang)]), svg, legend]);
}

// The per-typology price panel (FR-26): one fact-plus-forecast line per typology with
// the split marker, coloured by the size-rank palette.
function buildTrendPrice(state, data) {
  const price = data.price;
  return buildTrendChart(state, {
    title_key: price.title_key,
    months: price.months,
    split: price.split,
    series: price.series.map((line) => ({
      name: line.name,
      values: line.values,
      color: TREND_PALETTE[line.index % TREND_PALETTE.length],
    })),
  });
}

// The cumulative-sales panel (FR-26): the sold line with its ±1.28σ forecast band and
// the total-stock dashed reference, floored at zero.
function buildTrendSales(state, data) {
  const { lang } = state;
  const sales = data.sales;
  return buildTrendChart(state, {
    title_key: sales.title_key,
    months: sales.months,
    split: sales.split,
    floor0: true,
    height: 210,
    band: { lo: sales.lo, hi: sales.hi },
    series: [
      { name: t(sales.sold_key, lang), values: sales.sold, color: TREND_COLORS.sold },
      {
        name: t(sales.all_key, lang),
        values: sales.sold.map(() => sales.total_stock),
        color: TREND_COLORS.all,
        width: 1,
        dash: '4 3',
      },
    ],
  });
}

// The washout table (FR-27): free stock, pace and months-to-clear per typology with
// the «Успевает» / «Впритык» / «Не успевает» verdict tag; numbers client-formatted,
// «—» where the clear time is past the display ceiling (UX-DR8). The horizon note reads
// its message key with the client-formatted build horizon (AD-3).
function buildTrendWashout(state, data) {
  const { lang } = state;
  const washout = data.washout;
  const verdictTag = {
    ok: ['t-ok', 'tr_v_ok'],
    wr: ['t-wr', 'tr_v_wr'],
    bd: ['t-bd', 'tr_v_bd'],
  };
  const head = el('thead', null, [
    el('tr', null, [
      el('th', null, [t('th_pgname', lang)]),
      el('th', { class: 'num' }, [t('tr_free', lang)]),
      el('th', { class: 'num' }, [t('tr_pace', lang)]),
      el('th', { class: 'num' }, [t('tr_mo', lang)]),
      el('th', null, [t('tr_verdict', lang)]),
    ]),
  ]);
  const rows = washout.rows.map((r) => {
    const [cls, key] = verdictTag[r.verdict] || verdictTag.bd;
    return el('tr', null, [
      el('td', null, [el('b', null, [r.name])]),
      el('td', { class: 'num' }, [nf(r.free, lang)]),
      el('td', { class: 'num' }, [nf(r.pace, lang, 1)]),
      el('td', { class: 'num' }, [r.months === null ? EM_DASH : nf(r.months, lang, 1)]),
      el('td', null, [el('span', { class: `tag ${cls}` }, [t(key, lang)])]),
    ]);
  });
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(washout.title_key, lang)]),
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [head, el('tbody', null, rows)]),
    ]),
    el('div', { class: 'src' }, [tf(washout.note_key, lang, nf(washout.horizon, lang))]),
  ]);
}

// The three-strategy comparison table (FR-28): NEP, gap, raise/lower counts, release
// target and hit probability per strategy, the active stance's row highlighted. Every
// number is client-formatted from the raw payload (AD-3); the strategy label reads its
// `sg_*` message key.
function buildTrendComparison(state, data) {
  const { lang } = state;
  const cmp = data.comparison;
  const head = el('thead', null, [
    el('tr', null, [
      el('th', null, [t('st_h', lang)]),
      el('th', { class: 'num' }, [t('w_nep', lang)]),
      el('th', { class: 'num' }, [t('th_gap', lang)]),
      el('th', { class: 'num' }, [t('tr_updn', lang)]),
      el('th', { class: 'num' }, [t('r_target', lang)]),
      el('th', { class: 'num' }, [t('r_hit', lang)]),
    ]),
  ]);
  const rows = cmp.rows.map((r) => {
    const on = r.strat === cmp.active;
    const attrs = on
      ? { style: 'background:#F5FBF6;box-shadow:inset 2px 0 0 var(--green)' }
      : null;
    return el('tr', attrs, [
      el('td', null, [el('b', null, [t(`sg_${r.strat}`, lang)])]),
      el('td', { class: 'num' }, [nf(r.nep_psf, lang, 0)]),
      el('td', { class: 'num' }, [pct(r.gap, lang, 1)]),
      el('td', { class: 'num' }, [`${nf(r.up, lang)} / ${nf(r.dn, lang)}`]),
      el('td', { class: 'num' }, [`${nf(r.target, lang)} ${t('u_units', lang)}`]),
      el('td', { class: 'num' }, [`${nf(r.hit * 100, lang, 0)}%`]),
    ]);
  });
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(cmp.title_key, lang)]),
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [head, el('tbody', null, rows)]),
    ]),
  ]);
}

// The RF escrow → rate forecast panel (FR-28): escrow coverage and the effective
// project-financing rate over the forecast, floored at zero with a headroom ceiling.
// Present only where the payload carries an `escrow` block (RF); UAE/KZ have none.
function buildTrendEscrow(state, data) {
  const { lang } = state;
  const esc = data.escrow;
  const chart = buildTrendChart(state, {
    title_key: esc.title_key || 'tr_esc',
    months: esc.months,
    split: esc.split,
    floor0: true,
    height: 200,
    min: 0,
    max: Math.max(120, Math.max(...esc.esc)),
    series: [
      { name: t(esc.esc_key, lang), values: esc.esc, color: TREND_COLORS.esc },
      { name: `${t(esc.rate_key, lang)}, %`, values: esc.rate, color: TREND_COLORS.rate },
    ],
  });
  chart.append(el('div', { class: 'src' }, [t(esc.note_key, lang)]));
  return chart;
}

// Render the whole «Динамика и прогноз» surface from `state` and the surface `data`
// block (prototype `vTrend`, line 2384): a header, the per-typology price panel, a
// two-column row of the cumulative-sales chart and the washout table, the RF escrow →
// rate chart where it applies, and the three-strategy comparison table. Pure: state in,
// DOM out; the surface is read-only (no live-recalc controls of its own), so nothing is
// wired after paint beyond the shared tab navigation.
export function renderTrendSurface(state, data) {
  const { lang } = state;
  const header = el('div', { class: 'h' }, [
    el('h1', null, [t(data.heading_key, lang)]),
    el('p', { class: 'sub' }, [t(data.sub_key, lang)]),
  ]);
  const salesWashout = el('div', { class: 'grid g23' }, [
    buildTrendSales(state, data),
    buildTrendWashout(state, data),
  ]);
  return el('div', null, [
    header,
    buildTrendPrice(state, data),
    salesWashout,
    data.escrow ? buildTrendEscrow(state, data) : null,
    buildTrendComparison(state, data),
  ].filter(Boolean));
}

// --- «Аналитика» / Portfolio surface (Story 4.4, Task 2) -------------------
//
// The all-project scope renders from viewmodels/portfolio.py: four KPIs, the
// project table, the portfolio loss ladder and the strategy comparison. Portfolio
// rows are navigation only: data-open-project carries the project id, and the shared
// click/keyboard wiring below switches to that project's «Сегодня» and scrolls to
// top (UX-DR18).

function portfolioFinancingText(state, financing) {
  const { lang } = state;
  if (!financing) {
    return EM_DASH;
  }
  if (financing.kind === 'coverage') {
    const coverage = financing.coverage == null ? EM_DASH : pct(financing.coverage, lang, 0);
    const rate = financing.rate == null ? EM_DASH : pct(financing.rate, lang, 2);
    return `${t(financing.label_key, lang)} ${coverage} · ${t(financing.rate_key, lang)} ${rate}`;
  }
  if (financing.kind === 'scheme') {
    return `${t(financing.scheme_key, lang)} · ${t('n_capital', lang)} ${pct(financing.wacc, lang, 0)}`;
  }
  return financing.rate == null
    ? EM_DASH
    : `${t(financing.label_key || 'w_rate', lang)} ${pct(financing.rate, lang, 1)}`;
}

function buildPortfolioKpis(state, data) {
  const { lang } = state;
  const k = data.kpis;
  return el('div', { class: 'grid g4', style: 'margin-bottom:14px' }, [
    buildKpi(
      t(k.projects.label_key, lang),
      nf(k.projects.value, lang, 0),
      '',
      `${nf(k.projects.stock, lang, 0)} ${t(k.projects.stock_unit_key, lang)}`,
    ),
    buildKpi(
      t(k.revenue.label_key, lang),
      fmtMillions(state, k.revenue.value),
      '',
      t(k.revenue.detail_key, lang),
    ),
    buildKpi(
      t(k.leak.label_key, lang),
      fmtMillions(state, k.leak.value),
      '',
      pct(k.leak.share, lang, 1),
      'wrn',
    ),
    buildKpi(
      t(k.ops.label_key, lang),
      nf(k.ops.value, lang, 0),
      '',
      t(k.ops.detail_key, lang),
    ),
  ]);
}

function portfolioProbTag(state, probability) {
  const tagClass = {
    ok: 't-ok',
    warn: 't-wr',
    bad: 't-bd',
  }[probability.severity] || 't-nt';
  return el('span', { class: `tag ${tagClass}` }, [
    `${nf((probability.prob || 0) * 100, state.lang, 0)}%`,
  ]);
}

function buildPortfolioTable(state, data) {
  const { lang } = state;
  const table = data.table || {};
  const rows = table.rows || [];
  const head = el('thead', null, [
    el('tr', null, [
      el('th', null, [t('th_proj', lang)]),
      el('th', { class: 'num' }, [t('th_rem', lang)]),
      el('th', { class: 'num' }, [t(table.handover_label_key || 'th_hand', lang)]),
      el('th', null, [t('w_fin', lang)]),
      el('th', { class: 'num' }, [t('th_list', lang)]),
      el('th', { class: 'num' }, [t('th_nep', lang)]),
      el('th', { class: 'num' }, [t('th_gap', lang)]),
      el('th', { class: 'num' }, [t('th_loss', lang)]),
      el('th', null, [t('th_pace', lang)]),
      el('th', null, [t('th_prob', lang)]),
      el('th', { class: 'num' }, [t('al_th_ops', lang)]),
    ]),
  ]);
  const bodyRows = rows.map((row) => {
    const paceClass = row.pace < 0.85 ? 'w' : '';
    return el(
      'tr',
      {
        'data-open-project': row.id,
        tabindex: '0',
        role: 'button',
        style: 'cursor:pointer',
      },
      [
        el('td', null, [
          el('b', null, [pick(row.name, lang)]),
          el('div', { class: 'src' }, [pick(row.area, lang)]),
          row.start_here
            ? el('span', { class: 'tag t-wr' }, [t('pr_first', lang)])
            : null,
        ]),
        el('td', { class: 'num' }, [`${nf(row.stock, lang)} ${t('u_units', lang)}`]),
        el('td', { class: 'num' }, [`${nf(row.handover_months, lang)} ${t('u_mo', lang)}`]),
        el('td', null, [portfolioFinancingText(state, row.financing)]),
        el('td', { class: 'num' }, [nf(row.list_psf, lang, 0)]),
        el('td', { class: 'num' }, [nf(row.nep_psf, lang, 0)]),
        el('td', { class: 'num' }, [pct(row.gap, lang, 1)]),
        el('td', { class: 'num' }, [fmtMillions(state, row.leak_abs)]),
        el('td', null, [
          el('div', { class: 'miniflex' }, [
            buildBar(Math.min(1, row.pace), paceClass),
            el('span', { class: 'pct' }, [pct(row.pace, lang, 0)]),
          ]),
        ]),
        el('td', null, [
          portfolioProbTag(state, row.probability || {}),
          el('div', { class: 'src' }, [
            `P50 ${nf((row.probability || {}).p50 || 0, lang, 0)} / ${nf(row.stock, lang, 0)}`,
          ]),
        ]),
        el('td', { class: 'num' }, [nf(row.ops, lang, 0)]),
      ],
    );
  });
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(table.title_key || 'al_tbl', lang)]),
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [head, el('tbody', null, bodyRows)]),
    ]),
  ]);
}

function buildPortfolioLadder(state, data) {
  const { lang } = state;
  const ladder = data.ladder || {};
  const components = ladder.components || [];
  const scale = Math.max(
    1,
    ...components.map((component) => Math.abs(component.value || 0)),
  );
  const classByKey = {
    tvm: 'lad-tvm',
    financing: 'lad-esc',
    cancellation: 'lad-cx',
    cut: 'lad-cut',
    concessions: 'lad-c',
  };
  const bars = components.map((component) =>
    el(
      'div',
      {
        class: `lad ${classByKey[component.key] || 'lad-c2'}`,
        style: `width:${Math.max(4, (Math.abs(component.value || 0) / scale) * 100)}%`,
      },
      [el('span', null, [fmtMillions(state, component.value || 0)])],
    ),
  );
  const legend = components.map((component) =>
    el('div', null, [
      el('i', { class: classByKey[component.key] || 'lad-c2' }, []),
      `${t(component.label_key, lang)} `,
      el('b', null, [fmtMillions(state, component.value || 0)]),
    ]),
  );
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(ladder.title_key || 'al_loss', lang)]),
    el('div', { class: 'bigres' }, [
      buildBigCol(t('th_loss', lang), fmtMillions(state, ladder.total || 0), '', 'wrn'),
    ]),
    el('div', { class: 'ladder' }, bars),
    el('div', { class: 'legend' }, legend),
  ]);
}

function buildPortfolioComparison(state, data) {
  const { lang } = state;
  const cmp = data.comparison || {};
  const head = el('thead', null, [
    el('tr', null, [
      el('th', null, [t('st_h', lang)]),
      el('th', { class: 'num' }, [t('al_k2', lang)]),
      el('th', { class: 'num' }, [t('th_loss', lang)]),
      el('th', { class: 'num' }, [t('th_gap', lang)]),
    ]),
  ]);
  const rows = (cmp.rows || []).map((row) => {
    const on = row.strat === cmp.active;
    const attrs = on
      ? { style: 'background:#F5FBF6;box-shadow:inset 2px 0 0 var(--green)' }
      : null;
    return el('tr', attrs, [
      el('td', null, [el('b', null, [t(`sg_${row.strat}`, lang)])]),
      el('td', { class: 'num' }, [fmtMillions(state, row.revenue)]),
      el('td', { class: 'num' }, [fmtMillions(state, row.leak)]),
      el('td', { class: 'num' }, [pct(row.gap, lang, 1)]),
    ]);
  });
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(cmp.title_key || 'al_strat', lang)]),
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [head, el('tbody', null, rows)]),
    ]),
  ]);
}

export function renderPortfolioSurface(state, data) {
  const { lang } = state;
  const header = el('div', { class: 'h' }, [
    el('h1', null, [t(data.heading_key, lang)]),
    el('p', { class: 'sub' }, [t(data.sub_key, lang)]),
  ]);
  return el('div', null, [
    header,
    buildPortfolioKpis(state, data),
    buildPortfolioTable(state, data),
    el('div', { class: 'grid g23' }, [
      buildPortfolioLadder(state, data),
      buildPortfolioComparison(state, data),
    ]),
  ]);
}

// --- «Конкуренты» surface (Story 4.4, Task 3) ------------------------------

function buildCompModeControl(state, mode) {
  const { lang } = state;
  const options = mode.options || [];
  const buttons = options.map((option) =>
    el(
      'button',
      {
        type: 'button',
        class: option.value === mode.value ? 'pill on' : 'pill',
        'aria-pressed': option.value === mode.value ? 'true' : 'false',
        'data-control': 'competitors_mode',
        'data-value': option.value,
      },
      [t(option.label_key, lang)],
    ),
  );
  return el('div', { class: 'seg', role: 'group', 'aria-label': t(mode.label_key, lang) }, [
    el('span', { class: 'mini-lb' }, [t(mode.label_key, lang)]),
    ...buttons,
  ]);
}

function compKpiValue(state, key, kpi) {
  if (key === 'average_price') {
    return `${fmtMoney(state, kpi.value)} / ${priceUnitLabel(state)}`;
  }
  if (key === 'share') {
    return pct(kpi.value, state.lang, 1);
  }
  if (key === 'raised') {
    return `${nf(kpi.value, state.lang, 0)} / ${nf(kpi.total, state.lang, 0)}`;
  }
  return nf(kpi.value, state.lang, 0);
}

function compKpiDetail(state, key, kpi) {
  const { lang } = state;
  if (!kpi.detail_key) {
    return '';
  }
  if (key === 'absorption') {
    return tf(kpi.detail_key, lang, pct(kpi.share || 0, lang, 1));
  }
  if (key === 'average_price') {
    return tf(kpi.detail_key, lang, signedPct(kpi.own_delta || 0, lang, 1));
  }
  return t(kpi.detail_key, lang);
}

function signedPct(value, lang, digits = 1) {
  return `${value > 0 ? '+' : ''}${pct(value, lang, digits)}`;
}

function buildCompKpis(state, kpis) {
  const { lang } = state;
  const tiles = Object.entries(kpis || {}).map(([key, kpi]) =>
    buildKpi(
      t(kpi.label_key, lang),
      compKpiValue(state, key, kpi),
      kpi.unit_key ? t(kpi.unit_key, lang) : '',
      compKpiDetail(state, key, kpi),
      key === 'average_price' && (kpi.own_delta || 0) < 0 ? 'pos' : '',
    ),
  );
  return el('div', { class: 'kpis' }, tiles);
}

function buildCompTable(state, table) {
  const { lang } = state;
  const own = table.own || {};
  const head = el('tr', null, [
    el('th', null, [t('cp_th_name', lang)]),
    el('th', null, [t('cp_th_ready', lang)]),
    el('th', { class: 'num' }, [t('cp_th_supply', lang)]),
    el('th', { class: 'num' }, [t('cp_th_left', lang)]),
    el('th', { class: 'num' }, [t('cp_th_price', lang)]),
    el('th', { class: 'num' }, [t('cp_th_pace', lang)]),
    el('th', { class: 'num' }, [t('cp_th_mo', lang)]),
    el('th', null, [t('cp_th_src', lang)]),
  ]);
  const ownRow = el('tr', { style: 'background:#F5FBF6;box-shadow:inset 2px 0 0 var(--green)' }, [
    el('td', null, [el('b', null, [pick(own.name, lang)]), el('span', { class: 'tag t-ok', style: 'margin-left:6px' }, [t('cp_me', lang)])]),
    el('td', null, [EM_DASH]),
    el('td', { class: 'num' }, [nf(own.units || own.stock || 0, lang, 0)]),
    el('td', { class: 'num' }, [nf(own.stock || 0, lang, 0)]),
    el('td', { class: 'num' }, [`${fmtMoney(state, own.price || 0)} / ${priceUnitLabel(state)}`]),
    el('td', { class: 'num' }, [nf(own.pace || 0, lang, 1)]),
    el('td', { class: 'num' }, [nf(own.months || 0, lang, 1)]),
    el('td', null, [EM_DASH]),
  ]);
  const rows = (table.rows || []).map((row) =>
    el('tr', null, [
      el('td', null, [el('b', null, [pick(row.name, lang)]), el('div', { class: 'src' }, [row.developer])]),
      el('td', null, [`${row.class} / ${nf(row.readiness, lang, 0)}%`]),
      el('td', { class: 'num' }, [nf(row.supply, lang, 0)]),
      el('td', { class: 'num' }, [nf(row.left, lang, 0)]),
      el('td', { class: 'num' }, [`${fmtMoney(state, row.price)} / ${priceUnitLabel(state)}`]),
      el('td', { class: 'num' }, [nf(row.pace, lang, 1)]),
      el('td', { class: 'num' }, [nf(row.months, lang, 1)]),
      el('td', null, [t(row.source_key, lang)]),
    ]),
  );
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(table.title_key, lang)]),
    el('div', { style: 'overflow-x:auto' }, [el('table', null, [el('thead', null, [head]), el('tbody', null, [ownRow, ...rows])])]),
  ]);
}

function buildCompMap(state, map) {
  const points = map.points || [];
  const prices = points.map((p) => p.price);
  const months = points.map((p) => p.months);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minMonth = Math.min(...months);
  const maxMonth = Math.max(...months);
  const scale = (value, lo, hi, a, b) => (hi === lo ? (a + b) / 2 : a + ((value - lo) / (hi - lo)) * (b - a));
  const circles = points.map((point) =>
    svgEl('circle', {
      cx: scale(point.price, minPrice, maxPrice, 48, 360),
      cy: scale(point.months, minMonth, maxMonth, 160, 34),
      r: Math.max(5, Math.min(18, point.radius || 5)),
      fill: point.color,
      opacity: point.own ? '0.95' : '0.70',
      'data-own': point.own ? 'true' : 'false',
    }, []),
  );
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(map.title_key, state.lang)]),
    map.sub_key ? el('div', { class: 'src' }, [t(map.sub_key, state.lang)]) : null,
    svgEl('svg', { viewBox: '0 0 408 190', role: 'img', 'aria-label': t(map.title_key, state.lang) }, [
      svgEl('line', { x1: 36, y1: 166, x2: 372, y2: 166, stroke: '#DFE6E8' }, []),
      svgEl('line', { x1: 36, y1: 166, x2: 36, y2: 24, stroke: '#DFE6E8' }, []),
      ...circles,
    ]),
  ]);
}

function buildCompCorridor(state, corridor) {
  const { lang } = state;
  return el('div', { class: 'panel', style: 'border-left:3px solid var(--amber)' }, [
    el('h2', null, [t(corridor.title_key, lang)]),
    el('div', { class: 'bigres' }, [
      buildBigCol(t(corridor.low_label_key, lang), fmtMoney(state, corridor.low), priceUnitLabel(state)),
      buildBigCol(t(corridor.high_label_key, lang), fmtMoney(state, corridor.high), priceUnitLabel(state)),
      buildBigCol(
        t(corridor.share_label_key, lang),
        pct(corridor.share || 0, lang, 1),
        tf(corridor.share_detail_key, lang, nf(corridor.own_pace || 0, lang, 1)),
        'wrn',
      ),
    ]),
    el('div', { class: 'src' }, [
      tf(
        corridor.note_key,
        lang,
        `${fmtMoney(state, corridor.low)}-${fmtMoney(state, corridor.high)}`,
        nf(corridor.capacity || 0, lang, 1),
      ),
    ]),
  ]);
}

function buildCompDynamics(state, dynamics) {
  const all = (dynamics.series || []).flatMap((line) => line.values || []);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const x = (i) => 28 + (i / Math.max(1, (dynamics.months || 1) - 1)) * 342;
  const y = (v) => (max === min ? 90 : 160 - ((v - min) / (max - min)) * 120);
  const lines = (dynamics.series || []).map((line) =>
    svgEl('polyline', {
      points: (line.values || []).map((value, index) => `${x(index)},${y(value)}`).join(' '),
      fill: 'none',
      stroke: line.color,
      'stroke-width': 3,
      'stroke-dasharray': line.dash || null,
    }, []),
  );
  const legend = (dynamics.series || []).map((line) =>
    el('span', { class: 'tag' }, [t(line.name_key, state.lang)]),
  );
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(dynamics.title_key, state.lang)]),
    svgEl('svg', { viewBox: '0 0 400 180', role: 'img', 'aria-label': t(dynamics.title_key, state.lang) }, [
      svgEl('line', { x1: 28, y1: 160, x2: 370, y2: 160, stroke: '#DFE6E8' }, []),
      ...lines,
    ]),
    el('div', { class: 'legend' }, legend),
  ]);
}

function buildCompMovers(state, movers) {
  const { lang } = state;
  const rows = (movers.rows || []).map((row) =>
    el('tr', null, [
      el('td', null, [el('b', null, [pick(row.name, lang)]), el('div', { class: 'src' }, [row.developer])]),
      el('td', { class: 'num' }, [`${fmtMoney(state, row.price)} / ${priceUnitLabel(state)}`]),
      el('td', { class: row.delta_price >= 0 ? 'num pos' : 'num neg' }, [sgn(row.delta_price, lang, 1)]),
      el('td', { class: 'num' }, [nf(row.left, lang, 0)]),
    ]),
  );
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(movers.title_key, lang)]),
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [
        el('thead', null, [el('tr', null, [
          el('th', null, [t('cp_th_name', lang)]),
          el('th', { class: 'num' }, [t('cp_th_price', lang)]),
          el('th', { class: 'num' }, [t('cp_th_d', lang)]),
          el('th', { class: 'num' }, [t('cp_th_left', lang)]),
        ])]),
        el('tbody', null, rows),
      ]),
    ]),
    el('div', { class: movers.note_warn ? 'note w' : 'note note-hint' }, [
      tf(movers.note_key, lang, nf(movers.raised, lang, 0), nf(movers.total, lang, 0), signedPct(movers.own_delta || 0, lang, 1)),
    ]),
  ]);
}

function buildCompRegistry(state, registry) {
  const { lang } = state;
  const rows = (registry.rows || []).map((row) =>
    el('tr', null, [
      el('td', null, [t(row.source_key, lang)]),
      el('td', null, [t(row.provides_key, lang)]),
      el('td', null, [t(row.access_key, lang)]),
    ]),
  );
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(registry.title_key, lang)]),
    registry.accepted_defect_key ? el('div', { class: 'note w' }, [t(registry.accepted_defect_key, lang)]) : null,
    el('div', { style: 'overflow-x:auto' }, [
      el('table', null, [
        el('thead', null, [el('tr', null, [
          el('th', null, [t(registry.source_header_key, lang)]),
          el('th', null, [t(registry.provides_header_key, lang)]),
          el('th', null, [t(registry.access_header_key, lang)]),
        ])]),
        el('tbody', null, rows),
      ]),
    ]),
  ]);
}

export function renderCompetitorsSurface(state, data) {
  const { lang } = state;
  const body = data.mode.value === 'live'
    ? [
        buildCompKpis(state, data.live.kpis),
        buildCompDynamics(state, data.live.dynamics),
        buildCompMovers(state, data.live.movers),
      ]
    : [
        buildCompKpis(state, data.prelaunch.kpis),
        buildCompTable(state, data.prelaunch.table),
        el('div', { class: 'grid g23' }, [
          buildCompMap(state, data.prelaunch.map),
          buildCompCorridor(state, data.prelaunch.corridor),
        ]),
      ];
  return el('div', null, [
    el('div', { class: 'h' }, [
      el('h1', null, [t(data.heading_key, lang)]),
      el('p', { class: 'sub' }, [t(data.sub_key, lang)]),
      buildCompModeControl(state, data.mode),
    ]),
    ...body,
    buildCompRegistry(state, data.registry),
  ]);
}

// --- «Ретроспектива» surface (Story 4.4, Task 3) ---------------------------

function buildRetroControl(state, control) {
  return el('div', { class: 'panel' }, [
    el('div', { class: 'lb' }, [t(control.label_key, state.lang)]),
    el('input', {
      type: 'range',
      min: control.min,
      max: control.max,
      step: control.step,
      value: control.value,
      'data-control': 'retro_month',
      'aria-label': t(control.month_label_key, state.lang),
    }, []),
    el('div', { class: 'src' }, [
      `${t(control.month_label_key, state.lang)}: ${monthPointLabel(state.lang, control.month_point)}`,
    ]),
  ]);
}

function buildRetroKpis(state, point) {
  const { lang } = state;
  const k = point.kpis || {};
  return el('div', { class: 'kpis' }, [
    buildKpi(t(k.sold.label_key, lang), nf(k.sold.value, lang, 0), t(k.sold.unit_key, lang), pct(k.sold.share, lang, 0)),
    buildKpi(t(k.actual.label_key, lang), `${fmtMoney(state, k.actual.value)} / ${priceUnitLabel(state)}`, '', ''),
    buildKpi(t(k.optimal.label_key, lang), `${fmtMoney(state, k.optimal.value)} / ${priceUnitLabel(state)}`, '', sgn(k.optimal.delta, lang, 1), k.optimal.delta >= 0 ? 'pos' : 'neg'),
    buildKpi(t(k.deviation.label_key, lang), fmtMillions(state, k.deviation.value), '', pct(k.deviation.share, lang, 1), 'wrn'),
  ]);
}

function buildRetroChart(state, chart) {
  const months = chart.months || 0;
  const values = [...(chart.actual || []), ...(chart.optimal || [])];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const maxSold = Math.max(...(chart.sales || [1]));
  const x = (i) => 28 + (i / Math.max(1, months - 1)) * 342;
  const y = (v) => (max === min ? 76 : 134 - ((v - min) / (max - min)) * 108);
  const actual = (chart.actual || []).reduce((path, value, index) => {
    const px = x(index);
    const py = y(value);
    if (index === 0) {
      return `M ${px} ${py}`;
    }
    return `${path} H ${px} V ${py}`;
  }, '');
  const optimal = (chart.optimal || []).map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const bars = (chart.sales || []).map((sold, index) =>
    svgEl('rect', {
      x: x(index) - 4,
      y: 164 - (sold / maxSold) * 34,
      width: 6,
      height: (sold / maxSold) * 34,
      fill: '#B8C6CC',
      opacity: '0.85',
    }, []),
  );
  const markerX = x(chart.marker.month);
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(chart.title_key, state.lang)]),
    svgEl('svg', { viewBox: '0 0 400 190', role: 'img', 'aria-label': t(chart.title_key, state.lang) }, [
      ...bars,
      svgEl('path', { d: actual, fill: 'none', stroke: '#263238', 'stroke-width': 3, 'stroke-linejoin': 'round' }, []),
      svgEl('polyline', { points: optimal, fill: 'none', stroke: '#2FB84D', 'stroke-width': 3, 'stroke-dasharray': '6 4' }, []),
      svgEl('line', { x1: markerX, y1: 18, x2: markerX, y2: 176, stroke: chart.marker.color, 'stroke-width': 2 }, []),
    ]),
    el('div', { class: 'legend' }, [
      el('span', { class: 'tag' }, [t(chart.actual_key, state.lang)]),
      el('span', { class: 'tag t-ok' }, [t(chart.optimal_key, state.lang)]),
      el('span', { class: 'tag t-w' }, [monthPointLabel(state.lang, chart.marker.month_point)]),
    ]),
  ]);
}

function buildRetroTotals(state, totals) {
  const { lang } = state;
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(totals.title_key, lang)]),
    el('div', { class: 'bigres' }, [
      buildBigCol(t(totals.revenue.label_key, lang), fmtMillions(state, totals.revenue.value), `${fmtMoney(state, totals.revenue.psf)} / ${priceUnitLabel(state)}`),
      buildBigCol(t(totals.lost_to_lag.label_key, lang), fmtMillions(state, totals.lost_to_lag.value), pct(totals.lost_to_lag.share, lang, 1), 'wrn'),
      buildBigCol(t(totals.lost_to_forms.label_key, lang), fmtMillions(state, totals.lost_to_forms.value), pct(totals.lost_to_forms.share, lang, 1), 'wrn'),
    ]),
    el('div', { class: 'note note-hint' }, [t(totals.honesty_key, lang)]),
  ]);
}

function buildRetroForms(state, forms) {
  const shares = forms.installment_share || [];
  const max = Math.max(0, ...shares);
  const width = (value) => (max > 0 ? Math.max(2, (value / max) * 100) : 2);
  const bars = shares.map((value, index) =>
    el('div', { class: 'bar', title: `${monthPointLabel(state.lang, forms.labels[index])}: ${pct(value, state.lang, 0)}` }, [
      el('i', { style: `width:${width(value)}%` }, []),
      index % 6 === 0 ? el('span', null, [monthPointLabel(state.lang, forms.labels[index])]) : null,
    ]),
  );
  return el('div', { class: 'panel' }, [
    el('h2', null, [t(forms.title_key, state.lang)]),
    forms.sub_key ? el('div', { class: 'src' }, [t(forms.sub_key, state.lang)]) : null,
    el('div', { class: 'ladder' }, bars),
  ]);
}

export function renderRetroSurface(state, data) {
  const { lang } = state;
  return el('div', null, [
    el('div', { class: 'h' }, [
      el('h1', null, [t(data.heading_key, lang)]),
      el('p', { class: 'sub' }, [t(data.sub_key, lang)]),
    ]),
    el('div', { class: 'grid g23' }, [
      buildRetroControl(state, data.control),
      buildRetroKpis(state, data.point),
    ]),
    buildRetroChart(state, data.chart),
    el('div', { class: 'grid g23' }, [
      buildRetroTotals(state, data.totals),
      buildRetroForms(state, data.forms),
    ]),
    el('div', { class: 'panel' }, [
      el('h2', null, [t(data.why.title_key, lang)]),
      el('div', { class: 'src' }, [t(data.why.sub_key, lang)]),
    ]),
  ]);
}

// The project a surface stands on is chosen in the rail, so the surface itself
// carries no project picker and no version line — only what the rail cannot say:
// the stale-version warning and the steward's way back to the data workspace.
// Nothing to say means no context strip at all.
function buildOperationalSurfaceContext(state, operational) {
  const projectionContext = operational.surfaceProjection?.context || {};
  if (!projectionContext.version_changed && state.role !== 'data_steward') {
    return null;
  }
  return el('div', { class: 'inventory-context operational-surface-context' }, [
    projectionContext.version_changed ? el('div', {
      class: 'note w inventory-stale', role: 'status',
    }, [
      el('strong', null, [t('inventory_version_changed', state.lang)]),
      ` ${tf(
        'inventory_active_version_named', state.lang,
        projectionContext.active_inventory_version_sequence,
      )}`,
      el('button', {
        type: 'button', class: 'btn-primary', 'data-refresh-inventory-version': '1',
      }, [t('inventory_refresh_active', state.lang)]),
    ]) : null,
    projectDataCapabilities(state, operational).import_upload?.allowed ? el('button', {
      type: 'button', class: 'btn-ghost', 'data-return-data-workspace': '1',
    }, [t('inventory_return_data', state.lang)]) : null,
  ]);
}

function buildOperationalSurfaceState(state, operational, titleKey) {
  if (!operational.projects?.length) {
    return renderOperationalDeskSurface(state, operational);
  }
  if (operational.surfaceLoading && !operational.surfaceProjection) {
    return el('div', null, [
      el('h1', { class: 'surface-title' }, [t(titleKey, state.lang)]),
      buildOperationalSurfaceContext(state, operational),
      el('p', { role: 'status' }, [t('x_loading', state.lang)]),
    ]);
  }
  if (operational.surfaceError && !operational.surfaceProjection) {
    return el('div', null, [
      el('h1', { class: 'surface-title' }, [t(titleKey, state.lang)]),
      buildOperationalSurfaceContext(state, operational),
      el('div', { class: 'danger', role: 'alert' }, [
        t(operational.surfaceError.key || 'x_internal_error', state.lang),
        el('button', {
          type: 'button', class: 'btn-primary', 'data-retry-operational-surface': '1',
        }, [t('x_retry', state.lang)]),
      ]),
    ]);
  }
  return null;
}

function operationalPricePerArea(value, currency, areaUnit, lang) {
  if (value == null) return '—';
  return `${operationalMoney(value, currency, lang)} / ${areaUnit || '—'}`;
}

function operationalChartScaled(value, scaleDigits = 2) {
  if (value == null) return null;
  try {
    const scaled = BigInt(String(value));
    const unit = 10n ** BigInt(scaleDigits);
    const whole = scaled / unit;
    if (whole > BigInt(Number.MAX_SAFE_INTEGER)
      || whole < BigInt(Number.MIN_SAFE_INTEGER)) return null;
    return Number(whole) + (Number(scaled % unit) / Number(unit));
  } catch {
    return null;
  }
}

function operationalDateLabel(value) {
  return value ? String(value).slice(0, 10) : '—';
}

function operationalTask(state, text, surface, tone = '') {
  return el('div', { class: 'task' }, [
    el('div', { class: `tdot ${tone}` }, []),
    el('div', { class: 'ttxt' }, [text]),
    el('button', {
      type: 'button', class: 'btn sm', 'data-open-surface': surface,
    }, [t('td_open', state.lang)]),
  ]);
}

// The repricing desk's one-line answer to «what am I looking at»: when the
// calculation was made, by which algorithm, and whether the snapshot is still
// current — or what to do while there is nothing to look at yet.
function buildRepricingStatusLine(state, operational, deal) {
  const { lang } = state;
  if (!deal) return null;
  const recommendation = deal.recommendation || { state: 'missing' };
  const snapshot = operationalCalculationView(operational).snapshot;
  const canCreate = operational.capabilities?.calculation_snapshot_create?.allowed === true;
  if (!snapshot) {
    return el('div', { class: 'note info repricing-status', role: 'status' }, [
      t('repricing_status_no_snapshot', lang),
      canCreate ? el('button', {
        type: 'button', class: 'btn-primary', 'data-create-calculation-snapshot': '1',
        disabled: operational.snapshotBusy ? 'disabled' : null,
      }, [t('inventory_snapshot_create', lang)]) : null,
    ]);
  }
  if (recommendation.state === 'missing'
    && (recommendation.missing_inputs || []).includes('baseline_result')) {
    return el('div', { class: 'note info repricing-status', role: 'status' }, [
      t('repricing_status_no_result', lang),
    ]);
  }
  if (recommendation.state !== 'ready') return null;
  const algorithm = operationalAlgorithm(operational.algorithm || DEFAULT_OPERATIONAL_ALGORITHM);
  return el('p', { class: 'sub repricing-status', role: 'status' }, [
    `${tf('repricing_calculated_on', lang, operationalDateLabel(snapshot.as_of_utc))} · ${
      t(algorithm.label, lang)} · ${
      t(`inventory_snapshot_${snapshot.current_state || 'stale'}`, lang)}`,
  ]);
}

function operationalDealCategories(deal) {
  return new Map((deal?.deal_terms?.categories || []).map((category) => [
    String(category.group_id), category,
  ]));
}

// One row per price group — the level the algorithm actually prices. Current
// and recommended base are the same quantity (per area, before modifiers), so
// the change between them is the change the algorithm proposes.
function buildRepricingGroupsTable(state, operational, deal) {
  const { lang } = state;
  if (!deal) return null;
  const groups = deal.groups || [];
  const categories = operationalDealCategories(deal);
  const activeGroupId = operational.filters?.price_group_id;
  const nameCounts = new Map();
  groups.forEach((group) => {
    const name = group.name || group.group_id;
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  });
  const heading = [
    el('h2', { id: 'repricing-groups-title' }, [t('repricing_groups_title', lang)]),
    el('p', { class: 'sub' }, [t('repricing_groups_sub', lang)]),
  ];
  const section = (children) => el('section', {
    class: 'panel repricing-groups', 'aria-labelledby': 'repricing-groups-title',
  }, [...heading, ...children]);
  if (!groups.length) {
    return section([el('p', { class: 'note', role: 'status' }, [
      t('repricing_groups_empty', lang),
    ])]);
  }
  const rows = groups.map((group) => {
    const groupId = String(group.group_id);
    const name = group.name || groupId;
    const label = nameCounts.get(name) > 1 ? `${name} · ${groupId}` : name;
    const category = categories.get(groupId) || {};
    const baseline = group.baseline || null;
    const currentBase = operationalGroupCurrentBase(group, categories);
    const recommendedBase = baseline?.recommended_base_price_per_area_scaled ?? null;
    const currency = baseline?.currency || category.currency || group.current?.currency;
    const areaUnit = operationalAreaUnitLabel(
      baseline?.area_unit || category.area_unit || group.current?.area_unit, lang,
    );
    const remaining = baseline?.remaining_units
      ?? category.available_units ?? group.current?.available_units ?? null;
    const counts = group.decision_counts || {};
    const active = activeGroupId != null && String(activeGroupId) === groupId;
    const outcome = !baseline ? ['—']
      : baseline.state === 'recommended'
        ? [el('span', { class: 'status-tag recommendation-ready' }, [
            t('inventory_group_outcome_recommended', lang),
          ])]
        : operationalGroupOutcome(baseline, lang);
    return el('tr', { class: active ? 'selected' : null }, [
      el('th', { scope: 'row' }, [label]),
      el('td', { class: 'num' }, [remaining == null ? '—' : nf(remaining, lang)]),
      el('td', { class: 'num' }, [currentBase == null ? '—'
        : `${operationalMoneyWhole(currentBase, currency, lang)} / ${areaUnit}`]),
      el('td', { class: 'num' }, [recommendedBase == null ? '—'
        : `${operationalMoneyWhole(recommendedBase, currency, lang)} / ${areaUnit}`]),
      el('td', { class: 'num' }, [operationalDeltaNode(currentBase, recommendedBase, lang)]),
      el('td', { class: 'num' }, [
        counts.total == null ? '—' : String(counts.total),
        counts.pending ? el('span', { class: 'sub' }, [
          ` · ${tf('repricing_pending_short', lang, counts.pending)}`,
        ]) : null,
      ]),
      el('td', null, Array.isArray(outcome) ? outcome : [outcome]),
      el('td', null, [el('button', {
        type: 'button', class: active ? 'active' : 'btn-ghost',
        'data-inventory-group-filter': active ? '' : groupId,
        'aria-pressed': active ? 'true' : 'false',
      }, [t(active ? 'repricing_all_groups' : 'repricing_show_units', lang)])]),
    ]);
  });
  const table = el('table', { class: 'data-table repricing-groups-table' }, [
    el('thead', null, [el('tr', null, [
      'inventory_typology', 'repricing_th_remaining', 'repricing_th_current',
      'repricing_th_recommended', 'inventory_delta', 'repricing_th_recommendations',
      'repricing_th_state', 'repricing_th_units',
    ].map((key) => el('th', { scope: 'col' }, [t(key, lang)])))]),
    el('tbody', null, rows),
  ]);
  return section([operationalTableRegion('repricing_groups_title', lang, table)]);
}

function buildOperationalRepricingSummary(state, operational) {
  const deal = operational.surfaceProjection?.deal_price;
  if (operational.surfaceLoading && !deal) {
    return el('section', { class: 'panel operational-repricing-summary' }, [
      el('h2', null, [t('operational_repricing_summary', state.lang)]),
      el('p', { role: 'status' }, [t('x_loading', state.lang)]),
    ]);
  }
  if (!deal) return null;
  const { lang } = state;
  const recommendation = deal.recommendation || { state: 'missing' };
  const counts = recommendation.decision_counts || {};
  // The base-price change over the whole project, weighted by what each
  // group still has to sell: the ratio of the two weighted sums.
  const categories = operationalDealCategories(deal);
  let currentSum = 0n;
  let recommendedSum = 0n;
  let weight = 0n;
  let currency = null;
  let areaUnit = null;
  (deal.groups || []).forEach((group) => {
    const currentBase = operationalGroupCurrentBase(group, categories);
    const recommendedBase = group.baseline?.recommended_base_price_per_area_scaled;
    if (currentBase == null || recommendedBase == null) return;
    const units = group.baseline?.remaining_units
      ?? categories.get(String(group.group_id))?.available_units ?? 1;
    try {
      const w = BigInt(Math.max(1, Number(units) || 1));
      currentSum += BigInt(String(currentBase)) * w;
      recommendedSum += BigInt(String(recommendedBase)) * w;
      weight += w;
      currency = currency || group.baseline?.currency || null;
      areaUnit = areaUnit || group.baseline?.area_unit || null;
    } catch {
      // A malformed scaled value drops out of the average rather than breaking it.
    }
  });
  const weighted = weight > 0n;
  return el('section', {
    class: 'panel operational-repricing-summary',
    'aria-labelledby': 'operational-repricing-summary-title',
  }, [
    el('h2', { id: 'operational-repricing-summary-title' }, [
      t('operational_repricing_summary', lang),
    ]),
    recommendation.state === 'ready' ? null
      : operationalReadinessNote(recommendation, lang),
    el('div', { class: 'bigres' }, [
      buildBigCol(
        t('repricing_pending', lang),
        counts.pending == null ? '—' : String(counts.pending),
        counts.total == null ? '' : tf('repricing_of_total', lang, counts.total),
      ),
      buildBigCol(
        t('repricing_decided', lang),
        counts.total == null ? '—' : `${counts.accepted ?? 0} / ${counts.declined ?? 0}`,
        t(`operational_surface_${recommendation.state || 'missing'}`, lang),
      ),
      buildBigCol(
        t('repricing_mean_delta', lang),
        weighted ? operationalDeltaNode(currentSum, recommendedSum, lang) : '—',
        weighted ? tf(
          'repricing_delta_basis', lang,
          operationalMoneyWhole(String(currentSum / weight), currency, lang),
          operationalMoneyWhole(String(recommendedSum / weight), currency, lang),
          operationalAreaUnitLabel(areaUnit, lang) || '—',
        ) : '',
      ),
    ]),
  ]);
}

function operationalSurfaceRefreshStatus(state, operational) {
  if (operational.surfaceLoading) {
    return el('p', { role: 'status' }, [t('x_loading', state.lang)]);
  }
  if (!operational.surfaceError) return null;
  return el('div', { class: 'danger', role: 'alert' }, [
    t(operational.surfaceError.key || 'x_internal_error', state.lang),
    el('button', {
      type: 'button', class: 'btn-primary', 'data-retry-operational-surface': '1',
    }, [t('x_retry', state.lang)]),
  ]);
}

function operationalTableRegion(labelKey, lang, table) {
  return el('div', {
    class: 'data-table-scroll', tabindex: '0', role: 'region',
    'aria-label': t(labelKey, lang),
  }, [table]);
}

function operationalTypologyPriceChart(state, projection) {
  const facts = projection.trend?.facts || { price_periods: [] };
  const periods = facts.price_periods || [];
  // The imported deals, month by month and typology by typology. A source that
  // prices its stock once (the single-project workbook) has no price-list
  // history to draw, but every deal it records carries a price: those are the
  // typology's facts then, and they are the level the algorithms start from.
  const salePeriods = facts.completed_sales || [];
  // A recorded price history — two or more priced price-list periods — is the
  // fact and is drawn as it was recorded. Deals stand in only when the source
  // priced its stock once and nothing else describes how prices moved.
  const priceListHistoryUsable = periods.filter((period) => (period.groups || []).some(
    (group) => group.average_price_per_area_scaled != null,
  )).length >= 2;
  const groups = projection.deal_price?.groups || [];
  const chart = projection.today?.typology_price_chart || {};
  const chartGroups = new Map((chart.groups || []).map((group) => [
    String(group.group_id), group,
  ]));
  const asOfDate = chart.horizon?.as_of_date || null;
  const horizonEnd = chart.horizon?.horizon_end_date || null;
  const names = new Map(groups.map((group) => [
    String(group.group_id), group.name || group.group_id,
  ]));
  periods.forEach((period) => (period.groups || []).forEach((group) => {
    names.set(String(group.group_id), group.name || group.group_id);
  }));
  salePeriods.forEach((period) => (period.groups || []).forEach((group) => {
    if (!names.has(String(group.group_id))) {
      names.set(String(group.group_id), group.name || group.group_id);
    }
  }));
  const factSources = new Set();
  const nameCounts = new Map();
  names.forEach((name) => nameCounts.set(name, (nameCounts.get(name) || 0) + 1));
  const groupsById = new Map(groups.map((group) => [String(group.group_id), group]));
  const rows = [...names].sort(([left], [right]) => left.localeCompare(right)).map(
    ([groupId, name], index) => {
      const group = groupsById.get(groupId) || {};
      const displayName = nameCounts.get(name) > 1 ? `${name} · ${groupId}` : name;
      const priceListHistory = periods.map((period) => {
        const value = (period.groups || []).find(
          (candidate) => String(candidate.group_id) === groupId,
        );
        return {
          value: value?.average_price_per_area_scaled ?? null,
          currency: period.currency || null,
          areaUnit: period.area_unit || null,
          date: period.effective_from_utc,
          lineage: `${period.price_list_id || '—'} · ${period.version_label || '—'}`,
        };
      });
      // The deal-based fact is one continuous line from the first month to the
      // as-of split: a month without a deal in this typology keeps the last
      // observed price (the months before the first deal take the first one),
      // and the last price holds until the as-of date, where the algorithm's
      // path takes over.
      const saleHistory = priceListHistoryUsable ? [] : salePeriods.map((period) => {
        const value = (period.groups || []).find(
          (candidate) => String(candidate.group_id) === groupId,
        );
        const priced = value && value.completed_count > 0
          && value.average_contract_price_per_area_scaled != null;
        return {
          value: priced ? value.average_contract_price_per_area_scaled : null,
          currency: (priced && value.currency) || period.currency || null,
          areaUnit: (priced && value.area_unit) || period.area_unit || null,
          date: `${period.period}-01`,
          lineage: `${t('operational_fact_source_sales', state.lang)} · ${
            period.period} · ${priced ? value.completed_count : 0}`,
        };
      });
      const firstPriced = saleHistory.findIndex((point) => point.value != null);
      if (firstPriced >= 0) {
        let last = saleHistory[firstPriced];
        saleHistory.forEach((point, pointIndex) => {
          if (point.value != null) { last = point; return; }
          const source = pointIndex < firstPriced ? saleHistory[firstPriced] : last;
          point.value = source.value;
          point.currency = source.currency;
          point.areaUnit = source.areaUnit;
          point.carried = true;
        });
        const splitDay = asOfDate ? String(asOfDate).slice(0, 10) : null;
        if (splitDay && saleHistory.at(-1).date < splitDay) {
          saleHistory.push({ ...last, date: splitDay, carried: true });
        }
      }
      const salesPriced = firstPriced >= 0;
      const history = salesPriced ? saleHistory : priceListHistory;
      if (salesPriced) factSources.add('sales');
      else if (history.some((point) => point.value != null)) factSources.add('price_lists');
      return {
        groupId, name: displayName, index, group,
        target: chartGroups.get(groupId) || { state: 'missing', price_path: [] },
        history,
      };
    },
  );
  const partitions = new Map();
  const ensurePartition = (currency, areaUnit) => {
    const key = `${currency || ''}|${areaUnit || ''}`;
    if (!partitions.has(key)) partitions.set(key, {
      key, currency, areaUnit, facts: new Map(), targets: new Map(), factDates: new Set(),
    });
    return partitions.get(key);
  };
  let pricedFactCount = 0;
  rows.forEach((row) => row.history.forEach((point, periodIndex) => {
    const partition = ensurePartition(point.currency, point.areaUnit);
    partition.factDates.add(String(point.date).slice(0, 10));
    if (point.value == null) return;
    pricedFactCount += 1;
    if (!partition.facts.has(row.groupId)) partition.facts.set(row.groupId, []);
    partition.facts.get(row.groupId).push({ ...point, periodIndex });
  }));
  let drawableTargetCount = 0;
  const incompatibleTargetIds = new Set();
  rows.forEach((row) => {
    const target = row.target;
    if (chart.recommendation_state !== 'ready'
      || !asOfDate || !horizonEnd || target.state !== 'ready'
      || !(target.price_path || []).length
      || !target.currency || !target.area_unit) return;
    const factPairs = new Set(row.history.filter((point) => point.value != null).map(
      (point) => `${point.currency}|${point.areaUnit}`,
    ));
    const targetPair = `${target.currency}|${target.area_unit}`;
    if (factPairs.size > 1 || (factPairs.size === 1 && !factPairs.has(targetPair))) {
      incompatibleTargetIds.add(row.groupId);
      return;
    }
    ensurePartition(target.currency, target.area_unit).targets.set(row.groupId, target);
    drawableTargetCount += 1;
  });
  const visuals = [...partitions.values()].map((partition) => {
    const axisDates = new Set(partition.factDates);
    partition.facts.forEach((points) => points.forEach(
      (point) => axisDates.add(String(point.date).slice(0, 10)),
    ));
    if (partition.targets.size) {
      partition.targets.forEach((target) => (target.price_path || []).forEach(
        (point) => axisDates.add(String(point.period_start).slice(0, 10)),
      ));
    }
    const dates = [...axisDates].sort();
    const dateIndex = new Map(dates.map((date, index) => [date, index]));
    const series = [];
    rows.forEach((row) => {
      const points = partition.facts.get(row.groupId) || [];
      const color = TREND_PALETTE[row.index % TREND_PALETTE.length];
      // One legend row per typology (the prototype's legend): the fact line carries
      // the name, and the algorithm path that continues it stays unnamed. A typology
      // the import prices nowhere still earns its legend row from the path alone —
      // drawn dashed, but with the solid swatch every other row shows.
      let named = false;
      if (points.length) {
        const values = dates.map(() => null);
        points.forEach((point) => {
          values[dateIndex.get(String(point.date).slice(0, 10))] = operationalChartScaled(
            point.value,
          );
        });
        series.push({ name: row.name, values, color });
        named = true;
      }
      const target = partition.targets.get(row.groupId);
      if (target) {
        const values = dates.map(() => null);
        (target.price_path || []).forEach((point) => {
          values[dateIndex.get(String(point.period_start).slice(0, 10))]
            = operationalChartScaled(
              point.average_recommended_price_per_area_scaled,
            );
        });
        series.push({
          name: named ? null : row.name,
          values, color, dash: '2 3', legendSolid: true,
        });
      }
    });
    // The «факт | прогноз» split sits on the last axis date at or before the
    // snapshot's as-of: left of it the lines are the imported history, right of it
    // the algorithm's path. An as-of that is the first date leaves the chart
    // unsplit — there is no fact side to name.
    const splitDate = asOfDate ? String(asOfDate).slice(0, 10) : null;
    const split = splitDate
      ? dates.filter((date) => date <= splitDate).length - 1 : -1;
    const unitLabel = `${partition.currency} / ${partition.areaUnit}`;
    return el('section', { class: 'operational-chart-unit-panel' }, [
      el('h3', null, [unitLabel]),
      buildTrendChart(state, {
        title_key: 'operational_typology_price_chart',
        months: dates.length,
        split: split > 0 ? split : undefined,
        labels: dates.map(operationalDateLabel),
        xValues: dates.map((date) => Date.parse(`${date}T00:00:00Z`)),
        tickIndexes: dates.length ? [0, dates.length - 1] : [],
        series, bare: true,
      }),
    ]);
  });
  const visual = visuals.length ? el('div', {
    class: 'operational-chart-partitions',
  }, visuals) : null;
  const factAvailabilityNote = pricedFactCount ? null : el('div', {
    class: 'note', role: 'status',
  }, [
    periods.length
      ? t('operational_no_priced_history_values', state.lang)
      : t('operational_no_price_history', state.lang),
  ]);
  return el('section', {
    class: 'panel operational-typology-chart',
    'aria-labelledby': 'operational-typology-chart-title',
  }, [
    el('h2', { id: 'operational-typology-chart-title' }, [
      t('operational_typology_price_chart', state.lang),
    ]),
    el('p', { class: 'sub' }, [drawableTargetCount
      ? `${t('operational_typology_chart_sub', state.lang)} ${tf(
        'operational_typology_grid', state.lang,
        chart.horizon?.step_size || '—',
        t(`operational_step_${chart.horizon?.step_unit || 'month'}`, state.lang),
        operationalDateLabel([...chartGroups.values()].flatMap(
          (group) => group.price_path || [],
        ).map((point) => point.period_start).sort().at(-1)),
        operationalDateLabel(horizonEnd),
      )}`
      : t('operational_typology_chart_facts_only_sub', state.lang)]),
    chart.recommendation_state === 'ready' ? null : operationalReadinessNote({
      state: chart.recommendation_state || 'missing',
      missing_inputs: chart.recommendation_state === 'missing' ? ['baseline_result'] : [],
    }, state.lang),
    factSources.size ? el('p', { class: 'sub operational-typology-fact-source' }, [
      (factSources.has('sales')
        ? ['sales', ...(factSources.has('price_lists') ? ['price_lists_fallback'] : [])]
        : ['price_lists']
      ).map((source) => t(`operational_typology_fact_${source}`, state.lang)).join(' '),
    ]) : null,
    pricedFactCount > 0 && partitions.size > 1 ? el('div', {
      class: 'note', role: 'status',
    }, [t('operational_typology_fact_units_split', state.lang)]) : null,
    rows.some((row) => row.target.state === 'unsupported'
      || incompatibleTargetIds.has(row.groupId)) ? el('div', {
      class: 'note w', role: 'status',
    }, [t('operational_typology_units_unsupported', state.lang)]) : null,
    factAvailabilityNote,
    visual,
  ]);
}

function renderOperationalTodaySurface(state) {
  const operational = state.operationalDesk;
  const early = buildOperationalSurfaceState(state, operational, 'nav_today');
  if (early) return early;
  const projection = operational.surfaceProjection || {};
  const today = projection.today || {};
  const inventory = today.inventory || {};
  const contracts = today.contracts || {};
  const flow = today.price_flow || {};
  const recommendationCounts = today.actions?.recommendation_counts || {};
  const firstPrice = flow.first || {};
  const currentPrice = flow.current || {};
  const actions = today.actions || {};
  const tasks = [];
  if (actions.calculation_runnable) {
    tasks.push(operationalTask(
      state, t('operational_calculation_missing_action', state.lang), 'desk', 'hi',
    ));
  } else if (actions.calculation_state === 'pending') {
    tasks.push(operationalTask(
      state, t('operational_calculation_pending_action', state.lang), 'desk', 'hi',
    ));
  } else if (actions.calculation_state === 'stale') {
    tasks.push(operationalTask(
      state, t('operational_calculation_stale_action', state.lang), 'desk', 'hi',
    ));
  } else if (actions.calculation_state === 'missing') {
    const missing = localizedOperationalMissingInputs(
      actions.calculation_missing_inputs || [], state.lang,
    );
    tasks.push(operationalTask(
      state,
      tf(
        'operational_calculation_unavailable_action', state.lang,
        missing.join(', ') || t('inventory_missing_input_unknown', state.lang),
      ),
      'desk', 'hi',
    ));
  }
  if (recommendationCounts.pending) {
    tasks.push(operationalTask(
      state,
      tf('operational_pending_action', state.lang, recommendationCounts.pending),
      'desk', 'hi',
    ));
  }
  if (flow.retained_period_count) {
    tasks.push(operationalTask(
      state,
      tf('operational_history_action', state.lang, flow.retained_period_count),
      'trend',
    ));
  }
  if (contracts.completed_count) {
    tasks.push(operationalTask(
      state,
      tf('operational_deals_action', state.lang, contracts.completed_count),
      'nep',
    ));
  }
  return el('div', { class: 'operational-management-surface' }, [
    el('div', { class: 'h' }, [
      el('h1', { id: 'operational-today-title', tabindex: '-1' }, [t('nav_today', state.lang)]),
      el('p', { class: 'sub' }, [t('operational_today_sub', state.lang)]),
    ]),
    buildOperationalSurfaceContext(state, operational),
    operationalSurfaceRefreshStatus(state, operational),
    today.state === 'ready' ? null : operationalFactsReadinessNote(today, state.lang),
    el('div', { class: 'grid g4' }, [
      buildKpi(
        t('operational_current_price_per_area', state.lang),
        operationalPricePerArea(
          currentPrice.average_price_per_area_scaled,
          currentPrice.currency, currentPrice.area_unit, state.lang,
        ), '', tf('operational_priced_units', state.lang, inventory.priced_unit_count ?? 0),
      ),
      buildKpi(
        t('operational_completed_deals', state.lang),
        contracts.completed_count == null ? '—' : String(contracts.completed_count),
        '', `${t('operational_units', state.lang)}: ${inventory.unit_count ?? '—'}`,
      ),
      buildKpi(
        t('operational_available', state.lang),
        String(inventory.available_sellable_count ?? '—'),
        '', `${t('operational_units', state.lang)}: ${inventory.sellable_unit_count ?? '—'}`,
      ),
      buildKpi(
        t('operational_price_periods', state.lang),
        flow.retained_period_count > 0 ? String(flow.retained_period_count) : '—', '',
        currentPrice.effective_from_utc
          ? operationalDateLabel(currentPrice.effective_from_utc) : '',
      ),
    ]),
    el('div', { class: 'grid g23' }, [
      el('div', { class: 'panel' }, [
        el('h2', null, [t('operational_tasks', state.lang)]),
        tasks.length ? el('div', { class: 'tasks' }, tasks)
          : el('div', { class: 'note', role: 'status' }, [
            t('operational_tasks_empty', state.lang),
          ]),
      ]),
      el('div', { class: 'panel operational-price-flow' }, [
        el('h2', null, [t('operational_price_history', state.lang)]),
        el('div', { class: 'bigres' }, [
          buildBigCol(
            operationalDateLabel(firstPrice.effective_from_utc),
            operationalPricePerArea(
              firstPrice.average_price_per_area_scaled,
              firstPrice.currency, firstPrice.area_unit, state.lang,
            ), t('operational_fact_history', state.lang),
          ),
          buildBigCol(
            operationalDateLabel(currentPrice.effective_from_utc),
            operationalPricePerArea(
              currentPrice.average_price_per_area_scaled,
              currentPrice.currency, currentPrice.area_unit, state.lang,
            ), t('operational_current_price', state.lang),
          ),
        ]),
      ]),
    ]),
    operationalTypologyPriceChart(state, projection),
  ]);
}

function operationalReadinessNote(value, lang) {
  const missing = localizedOperationalMissingInputs(value?.missing_inputs || [], lang);
  const rationale = (value?.rationale_codes || []).map((key) => t(key, lang));
  return el('div', { class: `note ${value?.state === 'stale' ? 'w' : 'info'}`, role: 'status' }, [
    t(`operational_surface_${value?.state || 'missing'}`, lang),
    missing.length ? ` ${tf('inventory_missing_inputs', lang, missing.join(', '))}` : null,
    rationale.length ? ` ${rationale.join(' · ')}` : null,
  ]);
}

function operationalFactsReadinessNote(value, lang) {
  const missing = localizedOperationalMissingInputs(value?.missing_inputs || [], lang);
  return el('div', { class: `note ${value?.state === 'stale' ? 'w' : 'info'}`, role: 'status' }, [
    t(`operational_facts_${value?.state || 'missing'}`, lang),
    missing.length ? ` ${tf('inventory_missing_inputs', lang, missing.join(', '))}` : null,
  ]);
}

function operationalGroupOutcome(baseline, lang) {
  if (!baseline) return '—';
  const stateLabel = t(`inventory_group_outcome_${baseline.state}`, lang);
  const rationale = (baseline.rationale_codes || []).map((key) => t(key, lang));
  return [stateLabel, rationale.length ? ` · ${rationale.join(' · ')}` : ''];
}

// --- «Цена сделки»: the deal terms and what reaches the project --------------
//
// The surface is the frozen prototype's `vNep` (line 1625) rebuilt on imported
// data: the controls panel on the left, the leakage ladder on the right. What
// changed from the prototype is the top control — the prototype priced one named
// apartment, this prices a whole *price category*, whose current base price is
// the average of its units' base prices before modifiers.
//
// Every control writes to the acting user's own retained «Условия сделки» row;
// the server clamps, resolves and re-prices them, so the client never computes a
// price of its own and never keeps a value the server did not confirm.

// One `<select>` in the prototype's own `.projsel` shape, marked for the
// deal-terms delegation on `#content`.
function buildDealTermSelect(term, options, selected) {
  return el('select', {
    class: 'projsel', style: 'width:100%;margin-bottom:12px', 'data-deal-term': term,
  }, options.map((option) => el('option', {
    value: option.value,
    selected: String(option.value) === String(selected) ? 'selected' : null,
  }, [option.label])));
}

// One horizontal slider (`.sl`) over a 1e9-scaled value: the label, the read-out
// and the range input over the contract's own min/max/step, expressed in percent
// so the control grid stays the prototype's. Both deal rates — the cut the
// project gives away and the rate the money left is worth — are this one control.
function buildDealTermPercentSlider(term, label, bounds, lang) {
  const toPercent = (value) => String(Number(value) / 1e7);
  // Deliberately not `buildSlider`: that one stamps `data-control`, which is the
  // session-local what-if wiring. A deal term is retained, not session-local, so
  // it carries its own `data-deal-term` marker and never reaches that handler.
  return el('div', { class: 'sl' }, [
    el('label', null, [label]),
    el('b', null, [pct(Number(bounds.value_scaled) / 1e9, lang, 1)]),
    el('input', {
      type: 'range',
      min: toPercent(bounds.min_scaled),
      max: toPercent(bounds.max_scaled),
      step: toPercent(bounds.step_scaled),
      value: toPercent(bounds.value_scaled),
      'data-deal-term': term,
    }, []),
  ]);
}

// The promotion toggles (`.tg`), the prototype's own set for the imported
// currency (`vNep` line 1664/1670): name, description and the concession's
// discounted cost per unit of area. A promotion the v1 import contract cannot
// price renders dimmed and disabled with «—», exactly as the prototype rendered
// an inapplicable one.
function buildDealLevers(state, levers, unit) {
  const { lang } = state;
  return el('div', { class: 'tg' }, levers.map((lever) => {
    const attrs = { class: lever.on ? 'tgi on' : 'tgi', 'data-lever': lever.flag };
    if (lever.disabled) attrs.style = 'opacity:.5';
    const inputAttrs = {
      type: 'checkbox',
      'data-deal-lever': lever.flag,
      'data-on-magnitude': lever.on_magnitude == null ? 1 : lever.on_magnitude,
    };
    if (lever.on) inputAttrs.checked = 'checked';
    if (lever.disabled) inputAttrs.disabled = 'disabled';
    return el('label', attrs, [
      el('input', inputAttrs, []),
      el('div', null, [
        el('div', { class: 'nm' }, [t(lever.name_key, lang)]),
        el('div', { class: 'ds' }, [t(lever.desc_key, lang)]),
      ]),
      el('div', { class: 'cost' }, [
        lever.cost_per_area_scaled == null
          ? EM_DASH : formatScaledOperational(lever.cost_per_area_scaled, 2, 0, lang),
        el('span', null, [unit]),
      ]),
    ]);
  }));
}

// The «Условия сделки» panel: the price category and its current base price, the
// imported payment form, the direct cut, and the promotions handed over.
function buildDealTermsPanel(state, terms) {
  const { lang } = state;
  const selected = (terms.categories || []).find(
    (row) => String(row.group_id) === String(terms.terms?.group_id),
  );
  const currency = terms.currency || '';
  const areaUnit = terms.area_unit || EM_DASH;
  const unit = `${currency} / ${areaUnit}`.trim();
  const coverage = selected?.base_price_coverage;
  const children = [
    el('h2', null, [t('n_ctrl', lang)]),
    el('div', { class: 'mini-lb' }, [t('operational_price_category', lang)]),
    (terms.categories || []).length ? buildDealTermSelect(
      'group_id',
      terms.categories.map((row) => ({ value: row.group_id, label: row.name })),
      terms.terms?.group_id,
    ) : el('div', { class: 'note info', role: 'status' }, [
      tf('inventory_missing_inputs', lang, 'inventory.price_groups'),
    ]),
    el('div', { class: 'mini-lb' }, [t('operational_current_base_price', lang)]),
    el('div', { class: 'fx wrap', style: 'margin-bottom:4px' }, [
      selected?.base_price_per_area_scaled == null ? EM_DASH
        : `${formatScaledOperational(
          selected.base_price_per_area_scaled, 2, 2, lang,
        )} ${unit}`,
    ]),
    el('div', { class: 'src', style: 'margin-bottom:12px' }, [
      coverage && !coverage.complete
        ? tf(
          'operational_base_price_partial', lang,
          coverage.covered_count, coverage.expected_count,
        )
        : t('operational_base_price_scope', lang),
    ]),
    el('div', { class: 'mini-lb' }, [t('w_plan', lang)]),
    (terms.plans || []).length ? buildDealTermSelect(
      'payment_plan_id',
      terms.plans.map((row) => ({ value: row.payment_plan_id, label: row.name })),
      terms.terms?.payment_plan_id,
    ) : el('div', { class: 'note info', role: 'status' }, [
      tf('inventory_missing_inputs', lang, 'dco.PaymentPlans'),
    ]),
    // The deal's two rates stand together, in the prototype's own order: the
    // rate the money is discounted at, then the cut taken off the price.
    buildDealTermPercentSlider('discount_rate', t('w_rate', lang), terms.rate, lang),
    buildDealTermPercentSlider('cut', t('w_cut', lang), terms.cut, lang),
    el('div', { class: 'mini-lb', style: 'margin-top:14px' }, [t('n_lev', lang)]),
    buildDealLevers(state, terms.levers || [], unit),
  ];
  if ((terms.unavailable_lever_inputs || []).length) {
    children.push(el('div', { class: 'src', style: 'margin-top:8px' }, [
      tf(
        'operational_lever_unavailable', lang,
        terms.unavailable_lever_inputs.join(', '),
      ),
    ]));
  }
  return el('div', { class: 'panel' }, children);
}

// The ladder segment colours are the prototype's own map (`vNep` line 1735), so
// an enabled promotion draws the bar it has always drawn.
const DEAL_SEGMENT_CLASS = {
  n_seg_nep: 'lad-nep',
  n_seg_tvm: 'lad-tvm',
  n_seg_cut: 'lad-cut',
  n_seg_dld: 'lad-c',
  n_seg_sc: 'lad-c2',
  n_seg_furn: 'lad-c2',
  n_seg_ch: 'lad-ch',
  n_seg_visa: 'lad-c',
  n_seg_sub: 'lad-c',
  n_seg_fin: 'lad-c2',
  n_seg_park: 'lad-c2',
  n_seg_fix: 'lad-c',
  n_seg_other: 'lad-c2',
};

// The prototype's leakage ladder («Цена сделки», `vNep` line 1730) drawn for the
// deal the user has set: the category's base price on the left, what reaches the
// project on the right, and one bar per leak between them.
function buildDealResultPanel(state, terms) {
  const { lang } = state;
  const result = terms.result;
  if (!result) {
    return el('div', { class: 'panel operational-leakage-ladder' }, [
      el('h2', null, [t('n_res', lang)]),
      el('div', { class: 'note info', role: 'status' }, [
        t('operational_deal_terms_missing', lang),
        (terms.missing_inputs || []).length
          ? ` ${tf(
            'inventory_missing_inputs', lang,
            localizedOperationalMissingInputs(terms.missing_inputs, lang).join(', '),
          )}` : null,
      ]),
    ]);
  }
  const list = operationalChartScaled(result.list_price_per_area_scaled);
  const reaches = operationalChartScaled(result.reaches_project_per_area_scaled);
  const unit = `${terms.currency || ''} / ${terms.area_unit || EM_DASH}`.trim();
  const segments = (result.segments || []).map((segment) => ({
    cls: DEAL_SEGMENT_CLASS[segment.key] || 'lad-c2',
    label: t(segment.key, lang),
    value: operationalChartScaled(segment.value_scaled) || 0,
  })).filter((segment) => list && segment.value > list * 0.002);
  const bars = segments.map((segment) => {
    const width = (segment.value / list) * 100;
    return el('div', {
      class: `lad ${segment.cls}`, style: `width:${width}%`, title: segment.label,
    }, width > 7 ? [el('span', null, [nf(Math.round(segment.value), lang, 0)])] : []);
  });
  return el('div', { class: 'panel operational-leakage-ladder' }, [
    el('h2', null, [t('n_res', lang)]),
    el('div', { class: 'bigres' }, [
      buildBigCol(
        t('operational_current_base_price', lang),
        list == null ? EM_DASH : nf(Math.round(list), lang, 0), unit,
      ),
      el('div', { class: 'arrow' }, ['→']),
      buildBigCol(
        t('w_nep', lang),
        reaches == null ? EM_DASH : nf(Math.round(reaches), lang, 0), unit, 'pos',
      ),
      buildBigCol(
        t('n_disc', lang), pct(Number(result.gap_share_scaled) / 1e9, lang, 1),
        t('n_disc_s', lang), 'wrn',
      ),
    ]),
    list == null ? null : el('div', { class: 'ladwrap' }, [
      el('div', { class: 'ladscale' }, [
        el('span', null, ['0']),
        el('span', null, [`${nf(Math.round(list), lang, 0)} ${unit}`]),
      ]),
      el('div', { class: 'ladder' }, bars),
      el('div', { class: 'legend' }, segments.map((segment) => el('div', null, [
        el('i', { class: segment.cls }, []),
        `${segment.label} `,
        el('b', null, [nf(Math.round(segment.value), lang, 0)]),
      ]))),
    ]),
    el('div', { class: 'note', role: 'status' }, [t('operational_ladder_scope', lang)]),
  ]);
}

function renderOperationalDealPriceSurface(state) {
  const operational = state.operationalDesk;
  const early = buildOperationalSurfaceState(state, operational, 'nav_nep');
  if (early) return early;
  const deal = operational.surfaceProjection?.deal_price || { state: 'missing', groups: [] };
  const terms = deal.deal_terms;
  return el('div', { class: 'operational-management-surface' }, [
    el('div', { class: 'h' }, [
      el('h1', { id: 'operational-deal-price-title', tabindex: '-1' }, [t('nav_nep', state.lang)]),
      el('p', { class: 'sub' }, [t('operational_deal_price_sub', state.lang)]),
    ]),
    buildOperationalSurfaceContext(state, operational),
    operationalSurfaceRefreshStatus(state, operational),
    operational.dealTermsError ? el('div', { class: 'danger', role: 'alert' }, [
      t('operational_deal_terms_error', state.lang),
    ]) : null,
    terms ? el('div', { class: 'grid g32 operational-deal-terms' }, [
      buildDealTermsPanel(state, terms),
      buildDealResultPanel(state, terms),
    ]) : el('div', { class: 'note info', role: 'status' }, [
      t('operational_deal_terms_missing', state.lang),
    ]),
  ]);
}

function operationalPriceHistoryChart(state, facts, deal) {
  const periods = facts.price_periods || [];
  if (!periods.length) return el('div', { class: 'panel' }, [
    el('h2', null, [t('operational_price_history', state.lang)]),
    el('div', { class: 'note', role: 'status' }, [
      t('operational_no_price_history', state.lang),
    ]),
  ]);
  const hasPricedHistory = periods.some((period) => (
    period.average_price_per_area_scaled != null
    || (period.groups || []).some(
      (group) => group.average_price_per_area_scaled != null,
    )
  ));
  if (!hasPricedHistory) return el('div', { class: 'panel' }, [
    el('h2', null, [t('operational_price_history', state.lang)]),
    el('div', { class: 'note', role: 'status' }, [
      t('operational_no_priced_history_values', state.lang),
    ]),
  ]);
  const groupNames = new Map();
  periods.forEach((period) => (period.groups || []).forEach((group) => {
    groupNames.set(String(group.group_id), group.name || group.group_id);
  }));
  const recommendation = deal.recommendation || {};
  const hasForecast = recommendation.state === 'ready'
    && recommendation.average_recommended_base_price_per_area_scaled != null;
  const labels = periods.map((period) => operationalDateLabel(period.effective_from_utc));
  if (hasForecast) labels.push(t('operational_forecast', state.lang));
  const ids = ['__all__', ...[...groupNames.keys()].sort()];
  const series = ids.map((groupId, index) => {
    const factValues = periods.map((period) => {
      const value = groupId === '__all__' ? period.average_price_per_area_scaled
        : (period.groups || []).find(
          (group) => String(group.group_id) === groupId,
        )?.average_price_per_area_scaled;
      return operationalChartScaled(value);
    });
    if (hasForecast) factValues.push(null);
    return {
      name: groupId === '__all__' ? t('operational_all_units', state.lang)
        : groupNames.get(groupId),
      values: factValues,
      color: groupId === '__all__' ? TREND_COLORS.all
        : TREND_PALETTE[(index - 1) % TREND_PALETTE.length],
    };
  });
  if (hasForecast) {
    const current = operationalChartScaled(periods.at(-1)?.average_price_per_area_scaled);
    const recommended = operationalChartScaled(
      recommendation.average_recommended_base_price_per_area_scaled,
    );
    series.push({
      name: t('operational_portfolio_forecast', state.lang),
      values: [...periods.map((_, index) => (
        index === periods.length - 1 ? current : null
      )), recommended],
      color: TREND_COLORS.all,
      dash: '4 3',
    });
  }
  return buildTrendChart(state, {
    title_key: 'operational_price_history',
    months: labels.length,
    labels,
    split: hasForecast ? periods.length - 1 : undefined,
    series,
  });
}

function operationalSalesHistoryChart(state, facts) {
  const sales = facts.completed_sales || [];
  if ((facts.missing_inputs || []).includes('inventory.sales')) {
    return el('div', { class: 'panel' }, [
      el('h2', null, [t('operational_sales_history', state.lang)]),
      operationalFactsReadinessNote({
        state: 'missing', missing_inputs: ['inventory.sales'],
      }, state.lang),
    ]);
  }
  if (!sales.length) return el('div', { class: 'panel' }, [
    el('h2', null, [t('operational_sales_history', state.lang)]),
    el('div', { class: 'note' }, [t('operational_no_completed_sales', state.lang)]),
  ]);
  const values = sales.map((period) => Number(period.cumulative_completed_count));
  return buildTrendChart(state, {
    title_key: 'operational_sales_history',
    months: sales.length,
    labels: sales.map((period) => period.period),
    floor0: true,
    series: [
      { name: t('operational_completed_deals', state.lang), values, color: TREND_COLORS.sold },
      {
        name: t('operational_sellable_units', state.lang),
        values: values.map(() => Number(facts.total_units || 0)),
        color: TREND_COLORS.all, width: 1, dash: '4 3',
      },
    ],
  });
}

function operationalPricePeriodEvidence(state, facts) {
  const periods = facts.price_periods || [];
  if (!periods.length) return null;
  return el('details', {
    class: 'panel operational-details operational-price-periods',
  }, [
    el('summary', null, [
      `${t('operational_price_history', state.lang)} · ${periods.length}`,
    ]),
    operationalTableRegion('operational_price_history', state.lang, el('table', {
      class: 'data-table',
    }, [
      el('caption', { class: 'sr-only' }, [t('operational_price_history', state.lang)]),
      el('thead', null, [el('tr', null, [
        el('th', { scope: 'col' }, [t('operational_price_list', state.lang)]),
        el('th', { scope: 'col' }, [t('operational_effective_from', state.lang)]),
        el('th', { scope: 'col' }, [t('operational_group', state.lang)]),
        el('th', { scope: 'col' }, [t('operational_average_price', state.lang)]),
      ])]),
      el('tbody', null, periods.flatMap((period) => ([
        {
          name: t('operational_all_units', state.lang),
          average_price_per_area_scaled: period.average_price_per_area_scaled,
        },
        ...(period.groups || []),
      ].map((group) => el('tr', null, [
        el('th', { scope: 'row' }, [
          period.version_label || period.price_list_id || '—',
        ]),
        el('td', { class: 'num' }, [operationalDateLabel(period.effective_from_utc)]),
        el('td', null, [group.name || group.group_id || '—']),
        el('td', { class: 'num' }, [operationalPricePerArea(
          group.average_price_per_area_scaled,
          period.currency, period.area_unit, state.lang,
        )]),
      ])))),
    )])),
  ]);
}

function operationalSalesPeriodEvidence(state, facts) {
  const sales = facts.completed_sales || [];
  if (!sales.length) return null;
  return el('details', {
    class: 'panel operational-details operational-sales-periods',
  }, [
    el('summary', null, [
      `${t('operational_sales_history', state.lang)} · ${sales.length}`,
    ]),
    operationalTableRegion('operational_sales_history', state.lang, el('table', {
      class: 'data-table',
    }, [
      el('caption', { class: 'sr-only' }, [t('operational_sales_history', state.lang)]),
      el('thead', null, [el('tr', null, [
        el('th', { scope: 'col' }, [t('operational_sales_period', state.lang)]),
        el('th', { scope: 'col' }, [t('operational_completed_in_period', state.lang)]),
        el('th', { scope: 'col' }, [t('operational_cumulative_completed', state.lang)]),
        el('th', { scope: 'col' }, [t('operational_sellable_units', state.lang)]),
      ])]),
      el('tbody', null, sales.map((period) => el('tr', null, [
        el('th', { scope: 'row' }, [String(period.period)]),
        el('td', { class: 'num' }, [String(period.completed_count)]),
        el('td', { class: 'num' }, [String(period.cumulative_completed_count)]),
        el('td', { class: 'num' }, [String(facts.total_units ?? '—')]),
      ]))),
    ])),
  ]);
}

function renderOperationalTrendSurface(state) {
  const operational = state.operationalDesk;
  const early = buildOperationalSurfaceState(state, operational, 'nav_trend');
  if (early) return early;
  const trend = operational.surfaceProjection?.trend || { state: 'missing', points: [] };
  const facts = trend.facts || { state: 'missing', price_periods: [], completed_sales: [] };
  const forecast = trend.forecast || { state: 'missing', points: [] };
  const deal = operational.surfaceProjection?.deal_price || {};
  return el('div', { class: 'operational-management-surface' }, [
    el('div', { class: 'h' }, [
      el('h1', { id: 'operational-trend-title', tabindex: '-1' }, [t('nav_trend', state.lang)]),
      el('p', { class: 'sub' }, [t('operational_trend_sub', state.lang)]),
    ]),
    buildOperationalSurfaceContext(state, operational),
    operationalSurfaceRefreshStatus(state, operational),
    facts.state === 'ready' ? null : operationalFactsReadinessNote(facts, state.lang),
    el('div', { class: 'grid g2 operational-history-charts' }, [
      operationalPriceHistoryChart(state, facts, deal),
      operationalSalesHistoryChart(state, facts),
    ]),
    operationalPricePeriodEvidence(state, facts),
    operationalSalesPeriodEvidence(state, facts),
    el('div', { class: 'panel operational-forecast-summary' }, [
      el('h2', null, [t('operational_forecast', state.lang)]),
      forecast.state === 'ready' ? null : operationalReadinessNote(forecast, state.lang),
      (forecast.points || []).length ? el('div', { class: 'grid g4' }, [
        buildKpi(
          t('operational_snapshot_date', state.lang),
          operationalDateLabel(forecast.points.at(-1)?.as_of_utc), '', '',
        ),
        buildKpi(
          t('operational_baseline_outcomes', state.lang),
          String(forecast.points.at(-1)?.groups?.length ?? 0), '', '',
        ),
        buildKpi(
          t('operational_remaining_units', state.lang),
          String((forecast.points.at(-1)?.groups || []).reduce(
            (total, group) => total + Number(group.remaining_units || 0), 0,
          )), '', '',
        ),
        buildKpi(
          t('operational_horizon_steps', state.lang),
          String(Math.max(0, ...(forecast.points.at(-1)?.groups || []).map(
            (group) => Number(group.horizon_steps || 0),
          ))), '', '',
        ),
      ]) : null,
    ]),
    (forecast.points || []).length ? el('details', {
      class: 'panel operational-details',
    }, [
      el('summary', null, [t('operational_trend_table_label', state.lang)]),
      operationalTableRegion('operational_trend_table_label', state.lang, el('table', {
        class: 'data-table operational-trend',
      }, [
        el('caption', { class: 'sr-only' }, [
          t('operational_trend_table_label', state.lang),
        ]),
        el('thead', null, [el('tr', null, [
          el('th', { scope: 'col' }, [t('operational_snapshot_date', state.lang)]),
          el('th', { scope: 'col' }, [t('operational_group', state.lang)]),
          el('th', { scope: 'col' }, [t('operational_group_state', state.lang)]),
          el('th', { scope: 'col' }, [t('operational_completed_purchases', state.lang)]),
          el('th', { scope: 'col' }, [t('operational_remaining_units', state.lang)]),
          el('th', { scope: 'col' }, [t('operational_demand_velocity', state.lang)]),
          el('th', { scope: 'col' }, [t('operational_observed_horizon', state.lang)]),
          el('th', { scope: 'col' }, [t('operational_normalized_deal_price', state.lang)]),
          el('th', { scope: 'col' }, [t('operational_recommendation_basis', state.lang)]),
        ])]),
        el('tbody', null, forecast.points.flatMap((point) => (
          (point.groups || []).map((group) => el('tr', null, [
            el('td', { class: 'num' }, [String(point.as_of_utc)]),
            el('th', { scope: 'row' }, [String(group.group_name || group.group_id)]),
            el('td', null, operationalGroupOutcome(group, state.lang)),
            el('td', { class: 'num' }, [String(group.completed_purchases)]),
            el('td', { class: 'num' }, [String(group.remaining_units)]),
            el('td', { class: 'num' }, [group.demand_velocity_scaled == null
              ? '—' : formatScaledOperational(group.demand_velocity_scaled, 9, 3, state.lang)]),
            el('td', { class: 'num' }, [
              `${group.observed_steps ?? '—'} / ${group.horizon_steps ?? '—'}`,
            ]),
            el('td', { class: 'num' }, [operationalPricePerArea(
              group.normalized_completed_price_per_area_scaled,
              group.currency, group.area_unit, state.lang,
            )]),
            el('td', { class: 'num' }, [operationalPricePerArea(
              group.recommended_base_price_per_area_scaled,
              group.currency, group.area_unit, state.lang,
            )]),
          ]))
        ))),
      ])),
    ]) : null,
    forecast.truncated ? el('p', { class: 'note w' }, [
      t('operational_trend_truncated', state.lang),
    ]) : null,
  ]);
}

// --- «Формы оплаты и акции» / operational Shelf -----------------------------
//
// The frozen prototype's `vShelf` vocabulary (the payment-form table with its
// reference row, the ranked bars, the package panels) rendered from the imported
// workbook instead of the prototype's own numbers. What the v1 import contract
// carries — the payment plans, their schedules, their discount, their share of
// sales, and the project's financing rate — drives every number here. What it
// does not carry (cancellation rates, price-list premiums, buyer segments, the
// promotions themselves) renders as an explicit «not in the loaded data» note,
// never as a synthetic value.

// One payment plan's schedule as «60% · шаг 0 / 40% · шаг 6», the shape that
// decides how much of the contract the target function ever discounts.
function operationalScheduleLabel(plan, lang) {
  const items = plan.schedule || [];
  if (!items.length) return '—';
  return items.map((item) => `${
    formatScaledOperational(item.fraction_scaled, 7, 1, lang)
  }% · ${t('operational_plan_step', lang)} ${item.offset_steps}`).join(' / ');
}

// The «Формы оплаты» table: one row per imported plan, the reference row (the
// one with the largest share of sales) highlighted the way the prototype does,
// and a bar per row showing how its target function stands against the best.
function buildOperationalPaymentFormTable(state, forms) {
  const { lang } = state;
  const plans = forms.plans || [];
  const targets = plans
    .map((plan) => operationalChartScaled(plan.target_function_scaled))
    .filter((value) => value != null && value > 0);
  const best = targets.length ? Math.max(...targets) : 0;
  const head = el('tr', null, [
    el('th', null, [t('th_planname', lang)]),
    el('th', { class: 'num' }, [t('th_dp', lang)]),
    el('th', { class: 'num' }, [t('operational_plan_discount', lang)]),
    el('th', { class: 'num' }, [t('th_in', lang)]),
    el('th', { class: 'num' }, [t('operational_target_value', lang)]),
    el('th', { style: 'width:130px' }, []),
    el('th', { class: 'num' }, [t('th_vsref', lang)]),
  ]);
  const rows = plans.map((plan) => {
    const isRef = String(plan.payment_plan_id) === String(forms.reference_plan_id);
    const delta = operationalChartScaled(plan.delta_vs_reference_scaled);
    const target = operationalChartScaled(plan.target_function_scaled);
    const deltaClass = delta == null || delta === 0 ? 'num'
      : delta < 0 ? 'num neg' : 'num pos';
    return el('tr', isRef
      ? { style: 'background:#F5FBF6;box-shadow:inset 2px 0 0 var(--green)' }
      : null, [
      el('td', null, [
        el('b', null, [plan.name || plan.payment_plan_id]),
        isRef ? el('span', {
          class: 'tag t-ok', style: 'margin-left:6px',
        }, [t('fm_ref', lang)]) : null,
        // The schedule rides under the name the way the prototype's lever
        // description does, so the widest fact does not own a column.
        el('div', { class: 'schedule' }, [
          `${operationalScheduleLabel(plan, lang)} · ${
            t('operational_plan_npv_short', lang)} ${
            plan.npv_factor_scaled == null ? EM_DASH
              : formatScaledOperational(plan.npv_factor_scaled, 9, 3, lang)}`,
        ]),
      ]),
      el('td', { class: 'num' }, [plan.down_payment_share_scaled == null ? EM_DASH
        : `${formatScaledOperational(plan.down_payment_share_scaled, 7, 0, lang)}%`]),
      el('td', { class: 'num' }, [plan.discount_scaled == null ? EM_DASH
        : `${formatScaledOperational(plan.discount_scaled, 7, 1, lang)}%`]),
      el('td', { class: 'num' }, [operationalPricePerArea(
        plan.reaches_project_per_area_scaled, forms.currency, forms.area_unit, lang,
      )]),
      el('td', { class: 'num' }, [el('b', null, [
        operationalMoney(plan.target_function_scaled, forms.currency, lang),
      ])]),
      el('td', null, [buildBar(best && target != null ? target / best : 0,
        isRef ? '' : 's')]),
      el('td', { class: deltaClass }, [isRef || delta == null ? EM_DASH
        : operationalMoney(plan.delta_vs_reference_scaled, forms.currency, lang)]),
    ]);
  });
  return el('div', { class: 'panel' }, [
    el('h2', null, [t('fm_h', lang)]),
    operationalTableRegion('operational_payment_forms_table_label', lang, el('table', {
      class: 'data-table operational-payment-forms',
    }, [
      el('caption', { class: 'sr-only' }, [
        t('operational_payment_forms_table_label', lang),
      ]),
      el('thead', null, [head]),
      el('tbody', null, rows),
    ])),
    plans.length < 2 ? el('div', { class: 'note', role: 'status' }, [
      t('operational_payment_forms_single', lang),
    ]) : null,
  ]);
}

// The target function itself: what the algorithms will maximize, stated in the
// prototype's big-result vocabulary. The undiscounted revenue is the ceiling; the
// reference form's value is what the current sales mix actually delivers.
function buildOperationalTargetFunction(state, forms) {
  const { lang } = state;
  const target = forms.target_function;
  const reference = (forms.plans || []).find(
    (plan) => String(plan.payment_plan_id) === String(forms.reference_plan_id),
  );
  const referenceTarget = reference?.target_function_scaled ?? null;
  const nominal = operationalChartScaled(target?.nominal_revenue_scaled);
  const held = operationalChartScaled(referenceTarget);
  const rate = forms.discount_rate || {};
  const horizon = forms.horizon || {};
  return el('div', { class: 'panel operational-target-function' }, [
    el('h2', null, [t('operational_target_function', lang)]),
    el('p', { class: 'sub' }, [t('operational_target_function_sub', lang)]),
    el('div', { class: 'bigres' }, [
      buildBigCol(
        t('operational_target_nominal', lang),
        operationalMoney(target?.nominal_revenue_scaled, forms.currency, lang),
        horizon.as_of_date ? tf(
          'operational_horizon_window', lang,
          operationalDateLabel(horizon.as_of_date),
          operationalDateLabel(horizon.horizon_end_date),
          horizon.step_size ?? '—',
          t(`operational_step_${horizon.step_unit || 'month'}`, lang),
        ) : '',
      ),
      el('div', { class: 'arrow' }, ['→']),
      buildBigCol(
        t('operational_target_reference', lang),
        operationalMoney(referenceTarget, forms.currency, lang),
        reference ? reference.name || reference.payment_plan_id : '',
        'pos',
      ),
      buildBigCol(
        t('operational_target_discount_loss', lang),
        nominal && held != null ? pct((held - nominal) / nominal, lang, 1) : EM_DASH,
        t('operational_target_vs_nominal', lang),
        'wrn',
      ),
    ]),
    el('div', { class: 'grid g3', style: 'gap:9px;margin-top:12px' }, [
      buildKpi(
        t('operational_expected_sales_horizon', lang),
        target?.expected_sales_scaled == null ? EM_DASH
          : formatScaledOperational(target.expected_sales_scaled, 9, 1, lang),
        '', '',
      ),
      buildKpi(
        t('operational_expected_area_horizon', lang),
        target?.expected_area_scaled == null ? EM_DASH
          : formatScaledOperational(target.expected_area_scaled, 4, 0, lang),
        forms.area_unit || '', '',
      ),
      buildKpi(
        t('operational_discount_rate', lang),
        rate.per_step_scaled == null ? EM_DASH
          : `${formatScaledOperational(rate.per_step_scaled, 7, 2, lang)}%`,
        '',
        t(`operational_discount_rate_${rate.source || 'assumption'}`, lang),
      ),
    ]),
  ]);
}

function renderOperationalShelfSurface(state) {
  const operational = state.operationalDesk;
  const early = buildOperationalSurfaceState(state, operational, 'nav_shelf');
  if (early) return early;
  const forms = operational.surfaceProjection?.payment_forms
    || { state: 'missing', missing_inputs: ['dco'], plans: [] };
  const ready = (forms.plans || []).length > 0;
  const unavailable = (forms.unavailable_facts || []).map(
    (key) => t(`operational_fact_${key}`, state.lang),
  );
  return el('div', { class: 'operational-management-surface' }, [
    el('div', { class: 'h' }, [
      el('h1', { id: 'operational-shelf-title', tabindex: '-1' }, [t('s_h1', state.lang)]),
      el('p', { class: 'sub' }, [t('operational_payment_forms_sub', state.lang)]),
    ]),
    buildOperationalSurfaceContext(state, operational),
    operationalSurfaceRefreshStatus(state, operational),
    ready ? null : el('div', { class: 'note info', role: 'status' }, [
      t('operational_payment_forms_empty', state.lang),
    ]),
    forms.state === 'ready' || !ready ? null
      : operationalReadinessNote(forms, state.lang),
    ready ? buildOperationalPaymentFormTable(state, forms) : null,
    ready && forms.target_function
      ? buildOperationalTargetFunction(state, forms) : null,
    el('div', { class: 'panel' }, [
      el('h2', null, [t('s_tbl', state.lang)]),
      el('div', { class: 'note info', role: 'status' }, [
        t('operational_promotions_empty', state.lang),
      ]),
    ]),
    unavailable.length ? el('div', { class: 'note', role: 'status' }, [
      tf('operational_payment_forms_unavailable', state.lang, unavailable.join(', ')),
    ]) : null,
  ]);
}

// --- «Релиз» / operational Release -------------------------------------------
//
// The prototype's release console sizes the next tranche against a Monte-Carlo
// sell-through fan. The placeholder algorithm is deterministic — it produces one
// expected-sales path, no scenario spread — so this surface shows the facts that
// path does support (the stock it starts from, the sales it expects, the base
// price it recommends) and says plainly that the fan needs an algorithm that
// does not exist yet.
function renderOperationalReleaseSurface(state) {
  const operational = state.operationalDesk;
  const early = buildOperationalSurfaceState(state, operational, 'nav_release');
  if (early) return early;
  const projection = operational.surfaceProjection || {};
  const today = projection.today || {};
  const inventory = today.inventory || {};
  const forms = projection.payment_forms || {};
  const target = forms.target_function || null;
  const recommendation = projection.deal_price?.recommendation || { state: 'missing' };
  const horizon = forms.horizon || today.typology_price_chart?.horizon || {};
  const firstStep = (target?.steps || [])[0] || null;
  return el('div', { class: 'operational-management-surface' }, [
    el('div', { class: 'h' }, [
      el('h1', { id: 'operational-release-title', tabindex: '-1' }, [
        t('r_h1', state.lang),
      ]),
      el('p', { class: 'sub' }, [t('operational_release_sub', state.lang)]),
    ]),
    buildOperationalSurfaceContext(state, operational),
    operationalSurfaceRefreshStatus(state, operational),
    el('div', { class: 'panel' }, [
      el('h2', null, [t('operational_release_facts', state.lang)]),
      el('div', { class: 'grid g4' }, [
        buildKpi(
          t('operational_available', state.lang),
          inventory.available_sellable_count == null ? EM_DASH
            : String(inventory.available_sellable_count),
          '', '',
        ),
        buildKpi(
          t('operational_expected_sales_first_step', state.lang),
          firstStep == null ? EM_DASH
            : operationalMoney(firstStep.revenue_scaled, forms.currency, state.lang),
          '',
          horizon.as_of_date ? operationalDateLabel(horizon.as_of_date) : '',
        ),
        buildKpi(
          t('operational_recommendation_basis', state.lang),
          operationalPricePerArea(
            recommendation.average_recommended_base_price_per_area_scaled,
            recommendation.currency, recommendation.area_unit, state.lang,
          ), '', '',
        ),
        buildKpi(
          t('operational_expected_sales_horizon', state.lang),
          target?.expected_sales_scaled == null ? EM_DASH
            : formatScaledOperational(target.expected_sales_scaled, 9, 1, state.lang),
          '', '',
        ),
      ]),
    ]),
    el('div', { class: 'note info', role: 'status' }, [
      t('operational_release_empty', state.lang),
    ]),
  ]);
}

// --- «Ретроспектива» / operational Retrospective -----------------------------
//
// The prototype replays a finished project against what the calculation would
// have advised. Only half of that is in the data: the completed sales are real
// imported facts and are drawn; the counterfactual «optimal» curve needs an
// optimizer the placeholder algorithm is not, so it is named absent, not drawn.
function renderOperationalRetroSurface(state) {
  const operational = state.operationalDesk;
  const early = buildOperationalSurfaceState(state, operational, 'nav_retro');
  if (early) return early;
  const trend = operational.surfaceProjection?.trend || { facts: {} };
  const facts = trend.facts || {};
  const sales = facts.completed_sales || [];
  const chart = sales.length ? buildTrendChart(state, {
    title_key: 'operational_completed_sales_chart',
    months: sales.length,
    labels: sales.map((point) => operationalDateLabel(point.period)),
    tickIndexes: sales.length ? [0, sales.length - 1] : [],
    floor0: true,
    series: [{
      name_key: 'operational_cumulative_completed',
      values: sales.map((point) => Number(point.cumulative_completed_count ?? 0)),
      color: '#2FB84D',
    }],
  }) : null;
  return el('div', { class: 'operational-management-surface' }, [
    el('div', { class: 'h' }, [
      el('h1', { id: 'operational-retro-title', tabindex: '-1' }, [
        t('rt_h1', state.lang),
      ]),
      el('p', { class: 'sub' }, [t('operational_retro_sub', state.lang)]),
    ]),
    buildOperationalSurfaceContext(state, operational),
    operationalSurfaceRefreshStatus(state, operational),
    el('div', { class: 'panel' }, [
      el('h2', null, [t('operational_completed_sales_chart', state.lang)]),
      chart || el('div', { class: 'note', role: 'status' }, [
        t('operational_no_completed_sales', state.lang),
      ]),
    ]),
    el('div', { class: 'note info', role: 'status' }, [
      t('operational_retro_empty', state.lang),
    ]),
  ]);
}

function renderOperationalPlaceholderSurface(state, titleKey, bodyKey) {
  const operational = state.operationalDesk;
  if (!operational.projects?.length) return renderOperationalDeskSurface(state, operational);
  return el('div', { class: 'operational-management-surface' }, [
    el('div', { class: 'h' }, [
      el('h1', { class: 'surface-title' }, [t(titleKey, state.lang)]),
    ]),
    buildOperationalSurfaceContext(state, operational),
    el('div', { class: 'note info', role: 'status' }, [t(bodyKey, state.lang)]),
  ]);
}

// The registry of surface body renderers keyed by surface id. A surface with an
// entry and a held `data` block renders its live body; otherwise the content
// frame falls back to its neutral title panel. Function declarations hoist, so
// the map may name renderers defined above without ordering hazard.
const SURFACE_RENDERERS = {
  today: (state, data) => state.operationalDesk?.enabled
    ? renderOperationalTodaySurface(state) : renderTodaySurface(state, data),
  nep: (state, data) => state.operationalDesk?.enabled
    ? renderOperationalDealPriceSurface(state) : renderNepSurface(state, data),
  shelf: (state, data) => state.operationalDesk?.enabled
    ? renderOperationalShelfSurface(state) : renderShelfSurface(state, data),
  desk: renderDeskSurface,
  release: (state, data) => state.operationalDesk?.enabled
    ? renderOperationalReleaseSurface(state) : renderReleaseSurface(state, data),
  trend: (state, data) => state.operationalDesk?.enabled
    ? renderOperationalTrendSurface(state) : renderTrendSurface(state, data),
  comp: (state, data) => state.operationalDesk?.enabled
    ? renderOperationalPlaceholderSurface(
      state, 'nav_comp', 'operational_competitors_placeholder',
    ) : renderCompetitorsSurface(state, data),
  retro: (state, data) => state.operationalDesk?.enabled
    ? renderOperationalRetroSurface(state) : renderRetroSurface(state, data),
  all: renderPortfolioSurface,
};

// --- the seam state patterns (UX-DR7) & the view fetch loop (AR-15) ----------
//
// The full shell that drives these per what-if change is Story 3.3 / Epic 4; the
// state machine UX-DR7 mandates lives here now so the seam story pins it. The
// patterns: nothing under 300 ms, then the content dims to a muted «Обновляем…»
// (a dim, never an animated placeholder) with chrome live; a view-model failure
// swaps the surface content for a danger banner + «Повторить», chrome still
// live; a command failure drops a danger note near the control, re-enables it,
// changes no state.

// Below this threshold (ms) a view refresh shows nothing at all; only a refresh
// that outlasts it earns the loading affordance. One named constant so the
// timing is a single edit and the test can pin it.
export const LOADING_DELAY_MS = 300;

// The trailing debounce a continuous control (a slider) applies before it fires
// its single view refresh (UX-DR5): a burst of `input` events during a drag
// collapses to exactly one refresh ~150 ms after the last movement. Discrete
// controls (select, checkbox, radio, segment pill) never debounce — they fire at
// once. One named constant so the window is a single edit and a test can pin it.
export const SLIDER_DEBOUNCE_MS = 150;

// A trailing debounce (UX-DR5): the returned function reschedules a single timer
// on every call and runs `fn` with the latest arguments once `ms` elapses with no
// further call — so a rapid burst collapses to one trailing invocation, never many.
// `timers` is injectable ({ set, clear }) so a test drives the window without a
// real clock; it defaults to setTimeout/clearTimeout.
export function debounce(fn, ms, timers) {
  const setT = (timers && timers.set) || ((f, d) => setTimeout(f, d));
  const clearT = (timers && timers.clear) || ((id) => clearTimeout(id));
  let handle = null;
  function debounced(...args) {
    if (handle !== null) {
      clearT(handle);
    }
    handle = setT(() => {
      handle = null;
      fn(...args);
    }, ms);
  }
  debounced.cancel = () => {
    if (handle !== null) clearT(handle);
    handle = null;
  };
  return debounced;
}

// Resolve one term-set field from a control's raw value (UX-DR5, AR-2). Sliders
// carry a percent in whole/half steps (rate 5..16, coverage 0..110, cut 0..10);
// the kernel-read fields are fractions, so the percent controls divide by 100.
// Plan and segment carry their key verbatim. Returns a fresh term-set (the
// adopt-on-echo cycle stays side-effect free); an unknown control is a no-op.
export function termFromControl(termSet, control, rawValue) {
  if (control === 'rate') {
    return { ...termSet, rate: Number(rawValue) / 100 };
  }
  if (control === 'coverage') {
    return { ...termSet, escrow_coverage: Number(rawValue) / 100 };
  }
  if (control === 'cut') {
    return { ...termSet, cut: Number(rawValue) / 100 };
  }
  if (control === 'plan') {
    return { ...termSet, plan: rawValue };
  }
  if (control === 'segment') {
    return { ...termSet, segment: rawValue };
  }
  // The Release surface's own controls (Story 4.3, UX-DR5). Size and window carry
  // whole counts; the price index carries a signed percent the server reads
  // as-is (it applies `listPsf · (1 + index/100)`, so no /100 here); the package
  // radio carries its none/base/full key. The server clamps each into its slider
  // contract and re-resolves the release defaults it echoes back (AR-2).
  if (control === 'release_size') {
    return { ...termSet, release_size: Number(rawValue) };
  }
  if (control === 'release_window') {
    return { ...termSet, release_window: Number(rawValue) };
  }
  if (control === 'release_index') {
    return { ...termSet, release_index: Number(rawValue) };
  }
  if (control === 'release_pack') {
    return { ...termSet, release_pack: rawValue };
  }
  if (control === 'competitors_mode') {
    return { ...termSet, competitors_mode: rawValue };
  }
  if (control === 'retro_month') {
    return { ...termSet, retro_month: Number(rawValue) };
  }
  return termSet;
}

// Toggle one lever flag in the term-set's `levers` map (the client submits the
// whole map; the server keeps only pack-legal flags, AR-9). The on-value is the
// lever's real magnitude — carried by the payload (`on_magnitude`) so a multi-unit
// concession (the UAE `sc` service-charge holiday = 2 years) is not flattened to 1
// on toggle; the magnitude policy lives on the server, not duplicated here (the
// prototype's `toggleLever`, line 2900). `magnitude` defaults to 1 (a plain 0/1
// flag). Off is always 0. Returns a fresh set.
export function leverToggle(termSet, flag, checked, magnitude = 1) {
  const levers = { ...(termSet.levers || {}) };
  levers[flag] = checked ? magnitude : 0;
  return { ...termSet, levers };
}

// The muted status line «Обновляем…» shown while a view refresh is in flight
// past the threshold. Only the surface content dims; chrome stays operable.
function buildUpdatingNote(lang) {
  return el('div', { class: 'status-updating', 'aria-live': 'polite' }, [
    t('x_updating', lang),
  ]);
}

// Start the loading affordance for a view refresh (UX-DR7): nothing under 300 ms,
// then the `content` dims to opacity .6 and the «Обновляем…» line renders into
// `statusSlot` while the chrome stays live — a plain dim, no animated placeholder.
// Returns a `settle()` the caller runs when the fetch resolves; it cancels a
// not-yet-fired timer and clears any dim already applied. `timers` is injectable
// so a test can drive the threshold without a real clock.
export function beginUpdating(content, statusSlot, lang, timers) {
  const setT = (timers && timers.set) || ((fn, ms) => setTimeout(fn, ms));
  const clearT = (timers && timers.clear) || ((id) => clearTimeout(id));
  const handle = setT(() => {
    if (content) {
      content.style.opacity = '0.6';
    }
    if (statusSlot) {
      statusSlot.replaceChildren(buildUpdatingNote(lang));
    }
  }, LOADING_DELAY_MS);
  return function settle() {
    clearT(handle);
    if (content) {
      content.style.opacity = '';
    }
    if (statusSlot) {
      statusSlot.replaceChildren();
    }
  };
}

// A view-model failure (UX-DR7): the surface content is replaced by a danger
// banner naming a plain-language cause (the server's message key, resolved
// through the dictionary) plus a «Повторить» control; the chrome stays live.
// `onRetry` re-issues the view.
export function buildViewFailure(errorKey, lang, onRetry) {
  const retry = el(
    'button',
    { type: 'button', class: 'btn-primary btn-retry' },
    [t('x_retry', lang)],
  );
  if (onRetry) {
    retry.addEventListener('click', () => onRetry());
  }
  return el(
    'div',
    { class: 'note danger note-error view-failure', role: 'alert' },
    [el('div', null, [t(errorKey, lang)]), retry],
  );
}

// A command failure (UX-DR7): a danger note rendered near the invoking control.
// A 403 carries x_requires_role with a `role` param — the note names the
// required role (UX-DR3 defense-in-depth), mapped to its localized label; any
// other failure renders its plain cause. Caller re-enables the control and
// leaves state unchanged.
export function buildCommandFailure(errorKey, params, lang) {
  const role = params && params.role;
  const text = role
    ? tp(errorKey, lang, { role: tlc(`role_${role}`, lang) })
    : t(errorKey, lang);
  return el(
    'div',
    { class: 'note danger note-error command-failure', role: 'alert' },
    [text],
  );
}

// The documented placeholder a future guarded command can return before its
// effect exists (x_command_pending): an info note acknowledging the accepted
// command without implying a state change.
export function buildCommandPending(lang) {
  return el(
    'div',
    { class: 'note info command-pending', role: 'status' },
    [t('x_command_pending', lang)],
  );
}

// Refresh a surface's content in place (UX-DR7, AR-15): dim + «Обновляем…» past
// 300 ms while chrome stays live, drop a stale (superseded) payload silently
// (last-wins), and on a view-model failure swap the content for the danger
// banner + «Повторить». On a fresh (non-stale) payload runs `onAdopt(data)` —
// the caller's adopt-state-and-repaint step — so a successful «Повторить» retry
// restores the surface exactly as the primary refresh would (the retry re-issues
// this same call, `onAdopt` included). Returns the fresh payload, or `null` when
// the response was stale or failed. `targets` is `{ content, status }` hosts.
export async function refreshSurface(surface, targets, state, termSet, onAdopt) {
  const { content, status } = targets || {};
  const settle = beginUpdating(content, status, state.lang);
  let data;
  try {
    data = await view(surface, {
      term_set: termSet,
      market: state.market,
      project: state.project,
    });
  } catch (err) {
    settle();
    const key = err instanceof ApiError ? err.key : 'x_internal_error';
    if (content) {
      content.replaceChildren(
        buildViewFailure(key, state.lang, () =>
          refreshSurface(surface, targets, state, termSet, onAdopt),
        ),
      );
    }
    return null;
  }
  settle();
  // A stale response the last-wins guard already dropped: leave the newer
  // content in place and change nothing (AR-15).
  if (data === null) {
    return null;
  }
  if (onAdopt) {
    onAdopt(data);
  }
  return data;
}

// Invoke a product command from its control (UX-DR7 command-failure pattern).
// Disables the control while in flight; on failure renders a danger note near it
// and re-enables it, leaving state unchanged; on success shows the documented
// fallback placeholder. A 401 x_session_expired still redirects via the api.js hook.
export async function invokeCommand(name, controlEl, noteSlot, state, body) {
  if (controlEl) {
    controlEl.disabled = true;
  }
  try {
    await command(name, body);
    if (noteSlot) {
      noteSlot.replaceChildren(buildCommandPending(state.lang));
    }
  } catch (err) {
    const key = err instanceof ApiError ? err.key : 'x_internal_error';
    const params = err instanceof ApiError ? err.params : {};
    if (noteSlot) {
      noteSlot.replaceChildren(buildCommandFailure(key, params, state.lang));
    }
  } finally {
    if (controlEl) {
      controlEl.disabled = false; // re-enable; state unchanged (UX-DR7)
    }
  }
}

// --- the confirm modal + the pessimistic decision lifecycle (UX-DR9/UX-DR6) --
//
// A decision is never applied on the client: the manager confirms in a modal, the
// control disables with a pending label while the request is in flight, and the
// surface re-renders only from the server's fresh post-commit payload (AR-7). A
// failure leaves the surface unchanged and drops a danger note near the control
// (UX-DR7). The confirm copy promises what the server guarantees — the price
// change is written and journaled — so presentation and effect never diverge.

// Open the single reusable confirm modal (UX-DR9): one level deep, a title, a body
// line, and Cancel / Confirm. Closes on × / Cancel / mask click / Escape, restoring
// focus to the invoking control. `onConfirm` runs on confirm (after the modal is
// torn down, so a re-render replaces the surface cleanly). Returns the modal node.
export function openConfirmModal(state, opts) {
  const options = opts || {};
  // One level deep (UX-DR9): never stack a second modal over an already-open one.
  // The desk command guard (`deskCommandInFlight`) is only set on *confirm*, so a
  // rapid double-click on a command control would otherwise open two overlays before
  // the lock engages, and confirming both would dispatch duplicate decisions and
  // append duplicate journal rows. Refuse to mount a second modal while one is live —
  // enforcing the single-modal invariant at the one place every modal is created.
  if (typeof document !== 'undefined' && document.querySelector('.modal-mask')) {
    return null;
  }
  // Remember the invoking control so focus returns to it on close (UX-DR9).
  const invoker =
    typeof document !== 'undefined' ? document.activeElement : null;
  const lang = (state && state.lang) || 'ru';

  function restoreFocus() {
    const target = options.restoreFocusTarget
      ? options.restoreFocusTarget()
      : invoker;
    if (target && typeof target.focus === 'function') {
      target.focus();
    }
  }

  let onKeydown = null;
  let restoreOnClose = true;
  function close() {
    const shouldRestoreFocus = restoreOnClose;
    restoreOnClose = true;
    if (onKeydown) {
      document.removeEventListener('keydown', onKeydown);
    }
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (shouldRestoreFocus) restoreFocus();
  }

  const confirmBtn = el(
    'button',
    { type: 'button', class: 'btn-primary modal-confirm' },
    [t(options.confirmKey || 'w_confirm', lang)],
  );
  confirmBtn.addEventListener('click', () => {
    restoreOnClose = !options.restoreFocusAfterConfirm;
    close();
    if (options.onConfirm) {
      options.onConfirm(restoreFocus);
    }
  });
  const cancelBtn = el(
    'button',
    { type: 'button', class: 'btn modal-cancel' },
    [t('w_cancel', lang)],
  );
  cancelBtn.addEventListener('click', close);
  const closeX = el(
    'button',
    { type: 'button', class: 'modal-x', 'aria-label': t('w_cancel', lang) },
    ['×'],
  );
  closeX.addEventListener('click', close);

  // The body is either a pre-resolved string (`options.body`, e.g. a positional-`{0}`
  // format resolved through `tf` by the caller) or a named-param key `options.bodyKey`
  // interpolated here — so both the ported `{0}` copy (cf_b) and `{name}` copy render
  // through the one reusable modal (UX-DR9).
  const body =
    options.body != null
      ? options.body
      : options.bodyKey
        ? tp(options.bodyKey, lang, options.params || {})
        : '';
  const bodyContent = options.bodyNode
    || (body ? el('p', { id: 'confirm-dialog-description', class: 'modal-body' }, [body]) : null);
  if (options.bodyNode && bodyContent && bodyContent.setAttribute) {
    bodyContent.setAttribute('id', 'confirm-dialog-description');
  }
  const dialog = el(
    'div',
    {
      class: 'modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': options.titleKey ? 'confirm-dialog-title' : null,
      'aria-describedby': bodyContent ? 'confirm-dialog-description' : null,
    },
    [
      closeX,
      options.titleKey
        ? el('h2', { id: 'confirm-dialog-title', class: 'modal-title' }, [t(options.titleKey, lang)])
        : null,
      bodyContent,
      el('div', { class: 'modal-actions' }, [cancelBtn, confirmBtn]),
    ],
  );
  const overlay = el('div', { class: 'modal-mask' }, [dialog]);
  // A click on the mask itself (not the dialog) closes — mask-click dismissal.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  // The modal's focusable controls, in tab order — used to trap focus (UX-DR9): Tab
  // from the last wraps to the first and Shift+Tab from the first wraps to the last,
  // so focus never leaves the open dialog.
  const focusable = [closeX, cancelBtn, confirmBtn];
  onKeydown = (event) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'Tab') {
      const active = document.activeElement;
      let index = focusable.indexOf(active);
      if (index === -1) {
        index = focusable.length - 1;
      }
      const next = event.shiftKey
        ? (index - 1 + focusable.length) % focusable.length
        : (index + 1) % focusable.length;
      event.preventDefault();
      focusable[next].focus();
    }
  };
  document.addEventListener('keydown', onKeydown);

  document.body.append(overlay);
  confirmBtn.focus(); // focus enters the modal; close() restores it to the invoker
  return overlay;
}

// The pessimistic lifecycle for a unit accept/decline (UX-DR6, AR-7). Disables the
// invoking control and shows a pending label while the request is in flight; on
// success hands the server's fresh desk payload to `onFresh` (the surface re-render
// — nothing changed client-side until this point); on failure drops a danger note
// near the control and re-enables it with state unchanged (UX-DR7). `body` is the
// { unit, decision, market, project } the command carries — never a price (AR-7).
export async function invokeDecision(controlEl, noteSlot, state, body, onFresh) {
  const priorLabel = controlEl ? controlEl.textContent : null;
  if (controlEl) {
    controlEl.disabled = true;
    controlEl.classList.add('is-pending');
    controlEl.textContent = t('ap_pending', state.lang); // «На согласовании»
  }
  try {
    const fresh = await unitDecision(body);
    // The re-render comes from the fresh payload alone (AR-7): no optimistic edit.
    if (onFresh) {
      onFresh(fresh);
    }
    if (noteSlot) {
      noteSlot.replaceChildren();
    }
    return fresh;
  } catch (err) {
    const key = err instanceof ApiError ? err.key : 'x_internal_error';
    const params = err instanceof ApiError ? err.params : {};
    if (noteSlot) {
      noteSlot.replaceChildren(buildCommandFailure(key, params, state.lang));
    }
    // State unchanged (UX-DR7): re-enable the control and restore its label.
    if (controlEl) {
      controlEl.disabled = false;
      controlEl.classList.remove('is-pending');
      if (priorLabel != null) {
        controlEl.textContent = priorLabel;
      }
    }
    return null;
  }
}

// --- permission gating in the UI (UX-DR3, AC2) -------------------------------
//
// The view payload's `permissions` block {command: {allowed, requires}} renders
// here as command controls, and it is presentation only: a command the caller's
// role may not invoke shows visible but disabled (opacity .45 via the shared
// `.btn-primary:disabled` token) carrying the «Требуется роль: {роль}» tooltip
// that names the role it needs. The disabled state never enforces — the server
// 403s regardless of what the UI shows (AC2). Because the block is the very
// table the command guard reads (AD-8), the controls rendered disabled are
// exactly the commands the server denies; test_permission_gating.py pins that
// the two layers agree, per role.

// Each product command's stub control label ([ASSUMPTION] — the real controls
// and their frozen prototype labels arrive with Epic 4; these name the seam's
// four commands so the disabled-state affordance is demonstrable now).
const COMMAND_LABEL = {
  unit_decision: 'cmd_unit_decision',
  group_approval: 'cmd_group_approval',
  strategy_switch: 'cmd_strategy_switch',
  scenario_save: 'cmd_scenario_save',
};

// Build one command control from its permission entry ({allowed, requires}).
// Allowed → a live primary button; disallowed → the same button rendered
// visible but disabled and dimmed, with the «Требуется роль: {роль}» tooltip
// naming the required role (UX-DR3). Presentation only: the `disabled` attribute
// here never gates the command — the server's permission guard does (AC2).
export function buildCommandControl(command, perm, lang) {
  const allowed = !!(perm && perm.allowed);
  const requires = perm && perm.requires;
  const attrs = {
    type: 'button',
    class: 'btn-primary cmd-control',
    'data-command': command,
  };
  if (!allowed) {
    attrs.disabled = 'disabled';
    attrs['aria-disabled'] = 'true';
    if (requires) {
      attrs.title = tp('x_requires_role_tip', lang, {
        role: tlc(`role_${requires}`, lang),
      });
    }
  }
  return el('button', attrs, [t(COMMAND_LABEL[command] || command, lang)]);
}

// Render the command controls from a payload's `permissions` block (UX-DR3):
// one control per product command, disabled + dimmed + tooltipped wherever the
// block marks the role disallowed. The set of disabled controls equals the set
// of commands the server 403s, because the block is the guard's own table
// (AD-8) — presentation can never disagree with enforcement.
export function renderCommandControls(permissions, lang) {
  const perms = permissions || {};
  return Object.keys(perms).map((command) =>
    buildCommandControl(command, perms[command], lang),
  );
}

// --- the top-level controller ------------------------------------------------

// Mount the whole client into `root`: the «Вход» screen, the per-role landings
// and the logout/expiry redirect. Holds the session-scoped screen state —
// language RU and market UAE by default, never persisted (AC4) — wires the
// language switch, login submit, logout and the session-expiry redirect, and
// resolves an ApiError to an inline note through the dictionary.
const MAX_IMPORT_POLL_ATTEMPTS = 60;

function emptyDataWorkspaceState({ loading = false } = {}) {
  return {
    loading,
    createOnly: false,
    uploading: false,
    file: null,
    uploadOutcome: null,
    batches: [],
    historyPagination: { total: 0, count: 0, limit: 25, offset: 0, has_more: false },
    selected: null,
    severity: null,
    issueFilters: { sheet: null, field: null, code: null },
    issueOffset: 0,
    pollAttempts: 0,
    confirmation: null,
    confirmationLoading: false,
    activating: false,
    activationResult: null,
    creationTargets: [],
    calculatingProject: null,
    activeInventory: { items: [], count: 0, has_active_inventory: false },
    versionHistory: [],
    versionHistoryPagination: { total: 0, count: 0, limit: 25, offset: 0, has_more: false },
    versionLoading: false,
    capabilities: {},
    error: null,
  };
}

// What the repricing desk opens on: the units that carry a recommendation, in
// any verdict state. «Сбросить фильтры» widens to the whole inventory.
function defaultInventoryFilters() {
  return { recommendation_state: 'any' };
}

function emptyOperationalDeskState() {
  return {
    enabled: false,
    projects: [],
    projectId: null,
    inventoryVersionId: null,
    asOfUtc: null,
    mode: 'table',
    filters: defaultInventoryFilters(),
    sort: 'unit_number',
    direction: 'asc',
    page: 1,
    pageSize: 50,
    loading: false,
    noActiveVersion: false,
    error: null,
    surfaceProjection: null,
    dealTermsError: null,
    surfaceLoading: false,
    surfaceError: null,
    filterError: null,
    table: null,
    sectionId: null,
    board: null,
    boardLoading: false,
    boardError: null,
    boardFocus: null,
    selectedUnitId: null,
    selectedUnitSectionId: null,
    detailOriginMode: null,
    detailUnitId: null,
    detail: null,
    detailLoading: false,
    detailError: null,
    historyOffset: 0,
    historyHandlers: null,
    snapshots: [],
    snapshotOffset: 0,
    snapshotPageSize: 25,
    snapshotPagination: null,
    snapshotResultOffset: 0,
    snapshotResultPageSize: 25,
    snapshotLoading: false,
    snapshotError: null,
    snapshotBusy: false,
    inspectedSnapshot: null,
    snapshotIntentId: null,
    capabilities: {},
    // Which algorithm's result every surface on this shell is reading. The
    // first pill is selected to begin with; every run is asked for explicitly.
    algorithm: DEFAULT_OPERATIONAL_ALGORITHM,
    algorithmBusy: null,
    algorithmError: null,
    decisionBusy: false,
    decisionError: null,
    decisionIntent: null,
    decisionSavedRefreshFailures: {},
  };
}

export function mountApp(root, options) {
  const opts = options || {};
  const state = {
    screen: 'login', // 'login' | 'landing' | 'shell' | 'data' | 'loop'
    lang: opts.lang === 'en' ? 'en' : 'ru', // preview default language, session-scoped (AC4)
    market: 'uae', // post-login default market, session-scoped (AC4)
    role: null,
    landing: null,
    surface: null, // the active tab (a product surface) once in the shell
    project: null, // the active rail scope (a project id, or 'all'); null → first
    chrome: null, // the last view payload's chrome block (rail, badges, strategy)
    surfaceData: null, // the last view payload's surface `data` block (Epic 4)
    permissions: null, // the last view payload's permissions block (AD-8, UX-DR3)
    termSet: {}, // the session-local what-if terms, submitted whole with each view
    roleMenuOpen: false, // the role badge's «Выйти» popover (UX-DR2)
    error: opts.initialError || null,
    authed: false, // has a session been established this load?
    sessionBusy: false,
    confirmedCapabilities: null,
    dataActivationPending: false,
    dataState: emptyDataWorkspaceState(),
    operationalDesk: emptyOperationalDeskState(),
    feedbackState: emptyFeedbackState(),
    loopState: emptyProductLoopState(),
  };
  let dataNavigationSequence = 0;
  let dataRequestSequence = 0;
  let reviewRequestSequence = 0;
  let uploadRequestSequence = 0;
  let activationRequestSequence = 0;
  let versionRequestSequence = 0;
  let feedbackRequestSequence = 0;
  let loopRequestSequence = 0;
  let loopDetailSequence = 0;
  let loopMutationSequence = 0;
  let operationalDiscoverySequence = 0;
  let operationalSurfaceSequence = 0;
  let operationalTableSequence = 0;
  let operationalDetailSequence = 0;
  let operationalBoardSequence = 0;
  let operationalSnapshotSequence = 0;
  let operationalSnapshotCreateSequence = 0;
  let operationalSnapshotInspectSequence = 0;
  let operationalSnapshotRunSequence = 0;
  let operationalDecisionSequence = 0;
  let operationalAlgorithmSequence = 0;
  let operationalContextGeneration = 0;
  let selectedBatchIntent = null;
  let reviewPollTimer = null;
  let loopPollTimer = null;
  const loopRequestTimeouts = new Set();
  let sessionGeneration = 0;
  let deskCommandInFlight = false;
  let operationalRailOpen = false;
  let operationalRailTrigger = null;
  const scheduleTimeout = opts.setTimeout || globalThis.setTimeout;
  const cancelTimeout = opts.clearTimeout || globalThis.clearTimeout;

  function clearDataWorkspaceState() {
    dataNavigationSequence += 1;
    dataRequestSequence += 1;
    reviewRequestSequence += 1;
    uploadRequestSequence += 1;
    activationRequestSequence += 1;
    versionRequestSequence += 1;
    selectedBatchIntent = null;
    if (reviewPollTimer !== null) cancelTimeout(reviewPollTimer);
    reviewPollTimer = null;
    state.dataState = emptyDataWorkspaceState();
  }

  function clearOperationalDeskState() {
    operationalContextGeneration += 1;
    operationalDiscoverySequence += 1;
    operationalSurfaceSequence += 1;
    operationalTableSequence += 1;
    operationalDetailSequence += 1;
    operationalBoardSequence += 1;
    operationalSnapshotSequence += 1;
    operationalSnapshotCreateSequence += 1;
    operationalSnapshotInspectSequence += 1;
    operationalSnapshotRunSequence += 1;
    operationalDecisionSequence += 1;
    state.operationalDesk = emptyOperationalDeskState();
  }

  async function loadOperationalSnapshots({ repaint = true } = {}) {
    const operational = state.operationalDesk;
    if (!operational.enabled || operational.projectId == null) return false;
    const sequence = ++operationalSnapshotSequence;
    const generation = operationalContextGeneration;
    const sessionAtStart = sessionGeneration;
    const projectAtStart = operational.projectId;
    const versionAtStart = operational.inventoryVersionId;
    const cutoffAtStart = operational.asOfUtc;
    operational.snapshotLoading = true;
    operational.snapshotError = null;
    if (repaint) paint();
    try {
      const page = await listCalculationSnapshots(operational.projectId, {
        limit: operational.snapshotPageSize,
        offset: operational.snapshotOffset,
        inventoryVersionId: operational.inventoryVersionId,
        asOfUtc: operational.asOfUtc,
      });
      if (sequence !== operationalSnapshotSequence || generation !== operationalContextGeneration
        || sessionAtStart !== sessionGeneration || !state.authed
        || String(operational.projectId) !== String(projectAtStart)
        || String(operational.inventoryVersionId) !== String(versionAtStart)
        || operational.asOfUtc !== cutoffAtStart) return false;
      operational.snapshots = page.items || [];
      operational.snapshotPagination = page;
      return true;
    } catch (err) {
      if (sequence !== operationalSnapshotSequence || generation !== operationalContextGeneration
        || sessionAtStart !== sessionGeneration
        || String(operational.projectId) !== String(projectAtStart)
        || String(operational.inventoryVersionId) !== String(versionAtStart)
        || operational.asOfUtc !== cutoffAtStart) return false;
      operational.snapshotError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error', params: {},
      };
      return false;
    } finally {
      if (sequence === operationalSnapshotSequence && generation === operationalContextGeneration
        && sessionAtStart === sessionGeneration && state.authed
        && String(operational.projectId) === String(projectAtStart)
        && String(operational.inventoryVersionId) === String(versionAtStart)
        && operational.asOfUtc === cutoffAtStart) {
        operational.snapshotLoading = false;
        if (repaint) paint();
      }
    }
  }

  function pageOperationalSnapshots(direction) {
    const operational = state.operationalDesk;
    if (operational.snapshotBusy || operational.snapshotLoading) return;
    const delta = direction === 'next'
      ? operational.snapshotPageSize : -operational.snapshotPageSize;
    operational.snapshotOffset = Math.max(0, operational.snapshotOffset + delta);
    loadOperationalSnapshots();
  }

  function pageOperationalSnapshotResults(direction) {
    const operational = state.operationalDesk;
    const snapshotId = operational.inspectedSnapshot?.snapshot?.id;
    if (operational.snapshotBusy || snapshotId == null) return;
    const delta = direction === 'next'
      ? operational.snapshotResultPageSize : -operational.snapshotResultPageSize;
    operational.snapshotResultOffset = Math.max(
      0, operational.snapshotResultOffset + delta,
    );
    inspectOperationalSnapshot(snapshotId, { preserveResultPage: true });
  }

  function operationalSnapshotCommandToken(kind, sequence, snapshotId = null) {
    const operational = state.operationalDesk;
    operational.snapshotIntentId = snapshotId == null ? null : String(snapshotId);
    return {
      kind, sequence, snapshotId: operational.snapshotIntentId, operational,
      generation: operationalContextGeneration, session: sessionGeneration,
      projectId: operational.projectId, inventoryVersionId: operational.inventoryVersionId,
      asOfUtc: operational.asOfUtc, mode: operational.mode,
    };
  }

  function operationalSnapshotCommandStillWins(token) {
    const expectedSequence = token.kind === 'create' ? operationalSnapshotCreateSequence
      : token.kind === 'inspect' ? operationalSnapshotInspectSequence : operationalSnapshotRunSequence;
    return state.authed && token.operational === state.operationalDesk
      && token.sequence === expectedSequence
      && token.generation === operationalContextGeneration && token.session === sessionGeneration
      && String(token.projectId) === String(token.operational.projectId)
      && String(token.inventoryVersionId) === String(token.operational.inventoryVersionId)
      && token.asOfUtc === token.operational.asOfUtc
      && token.snapshotId === token.operational.snapshotIntentId;
  }

  async function createOperationalSnapshot() {
    const operational = state.operationalDesk;
    if (operational.snapshotBusy || operational.projectId == null
      || operational.inventoryVersionId == null || !operational.asOfUtc) return;
    const token = operationalSnapshotCommandToken('create', ++operationalSnapshotCreateSequence);
    const projectId = token.projectId;
    const inventoryVersionId = token.inventoryVersionId;
    const asOfUtc = token.asOfUtc;
    operational.snapshotBusy = true;
    operational.snapshotError = null;
    paint();
    try {
      const outcome = await createCalculationSnapshot(projectId, {
        inventoryVersionId, asOfUtc,
      });
      if (!operationalSnapshotCommandStillWins(token)) return;
      if (outcome?.state !== 'ready' || !outcome?.snapshot) {
        const issues = Array.isArray(outcome?.issues) ? outcome.issues : [];
        operational.snapshotError = {
          key: issues[0]?.key || 'calculation_snapshot_not_ready',
          params: {}, issues,
        };
        return;
      }
      operational.snapshotOffset = 0;
      await loadOperationalSnapshots({ repaint: false });
      if (!operationalSnapshotCommandStillWins(token)) return;
      // The table load minted a context generation of its own here, which
      // silently ended this command after it: the steps below never ran. The
      // run command already hands the table its own token; this does the same.
      await loadOperationalTable({ preserveViewport: true, contextToken: token });
      if (!operationalSnapshotCommandStillWins(token)) return;
      // Re-read the projection so the algorithm bar sees the new snapshot at
      // once and can offer a run against it, instead of on the next tab switch.
      await loadOperationalSurfaceProjection();
      if (!operationalSnapshotCommandStillWins(token)) return;
    } catch (err) {
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.snapshotError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error', params: {},
      };
    } finally {
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.snapshotBusy = false;
      paint();
    }
  }

  async function inspectOperationalSnapshot(snapshotId, { preserveResultPage = false } = {}) {
    const operational = state.operationalDesk;
    if (operational.snapshotBusy) return;
    if (!preserveResultPage) operational.snapshotResultOffset = 0;
    const token = operationalSnapshotCommandToken(
      'inspect', ++operationalSnapshotInspectSequence, snapshotId,
    );
    operational.snapshotBusy = true;
    operational.snapshotError = null;
    paint();
    try {
      const inspected = await inspectCalculationSnapshot(token.projectId, snapshotId, {
        resultLimit: operational.snapshotResultPageSize,
        resultOffset: operational.snapshotResultOffset,
      });
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.inspectedSnapshot = inspected;
    } catch (err) {
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.snapshotError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error', params: {},
      };
    } finally {
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.snapshotBusy = false;
      paint();
    }
  }

  async function runOperationalSnapshot(snapshotId) {
    const operational = state.operationalDesk;
    if (operational.snapshotBusy) return;
    const target = operational.snapshots.find(
      (snapshot) => String(snapshot.id) === String(snapshotId),
    );
    if (!target || target.current_state !== 'current'
      || String(target.project_id) !== String(operational.projectId)
      || String(target.inventory_version_id) !== String(operational.inventoryVersionId)
      || target.as_of_utc !== operational.asOfUtc
      || target.algorithm_version !== 'preview-snapshot-v1'
      || target.policy_version !== 'preview-policy-v1') return;
    const token = operationalSnapshotCommandToken(
      'run', ++operationalSnapshotRunSequence, snapshotId,
    );
    operational.snapshotBusy = true;
    operational.snapshotError = null;
    paint();
    try {
      await runCalculationSnapshotDco(
        token.projectId, snapshotId,
        operationalAlgorithm(DEFAULT_OPERATIONAL_ALGORITHM).policy,
      );
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.snapshotResultOffset = 0;
      const inspected = await inspectCalculationSnapshot(token.projectId, snapshotId, {
        resultLimit: operational.snapshotResultPageSize,
        resultOffset: 0,
      });
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.inspectedSnapshot = inspected;
      await loadOperationalSnapshots({ repaint: false });
      if (!operationalSnapshotCommandStillWins(token)) return;
      await loadOperationalTable({ preserveViewport: true, contextToken: token });
      if (!operationalSnapshotCommandStillWins(token)) return;
      if (operational.mode === 'chessboard') {
        await loadOperationalBoard({ contextToken: token });
        if (!operationalSnapshotCommandStillWins(token)) return;
      }
      if (operational.detailUnitId != null) {
        await loadOperationalDetail(
          operational.detailUnitId,
          operational.historyOffset,
          operational.detailOriginMode,
        );
        if (!operationalSnapshotCommandStillWins(token)) return;
      }
      await loadOperationalSurfaceProjection();
      if (!operationalSnapshotCommandStillWins(token)) return;
    } catch (err) {
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.snapshotError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error', params: {},
      };
    } finally {
      if (!operationalSnapshotCommandStillWins(token)) return;
      operational.snapshotBusy = false;
      paint();
    }
  }

  // --- the algorithm switch -------------------------------------------------
  //
  // Two moves live here. Choosing an algorithm re-reads everything under it;
  // running one asks the server for a result the snapshot does not hold yet.
  // Nothing runs unasked: a calculation can take long, and the operator decides
  // when to spend that time.

  function operationalAlgorithmToken() {
    const operational = state.operationalDesk;
    return {
      sequence: ++operationalAlgorithmSequence,
      operational,
      session: sessionGeneration,
      projectId: operational.projectId,
      inventoryVersionId: operational.inventoryVersionId,
      asOfUtc: operational.asOfUtc,
      algorithm: operational.algorithm,
    };
  }

  function operationalAlgorithmStillWins(token) {
    const operational = state.operationalDesk;
    return state.authed && operational === token.operational
      && token.sequence === operationalAlgorithmSequence
      && token.session === sessionGeneration
      && String(token.projectId) === String(operational.projectId)
      && String(token.inventoryVersionId) === String(operational.inventoryVersionId)
      && token.asOfUtc === operational.asOfUtc
      && token.algorithm === operational.algorithm;
  }

  // Everything held on the shell was produced by the algorithm that was
  // selected a moment ago, so it is dropped rather than left on screen under a
  // pill that now names something else.
  async function reloadOperationalForAlgorithm() {
    const operational = state.operationalDesk;
    const token = operationalAlgorithmToken();
    operational.surfaceProjection = null;
    operational.table = null;
    operational.board = null;
    operational.detail = null;
    paint();
    await loadOperationalTable({ preserveViewport: true });
    if (!operationalAlgorithmStillWins(token)) return;
    if (operational.mode === 'chessboard') {
      await loadOperationalBoard({});
      if (!operationalAlgorithmStillWins(token)) return;
    }
    if (operational.detailUnitId != null) {
      await loadOperationalDetail(
        operational.detailUnitId,
        operational.historyOffset,
        operational.detailOriginMode,
      );
      if (!operationalAlgorithmStillWins(token)) return;
    }
    await loadOperationalSurfaceProjection();
  }

  async function runOperationalAlgorithm(key) {
    const operational = state.operationalDesk;
    const entry = OPERATIONAL_ALGORITHMS.find((item) => item.key === key);
    if (!operational.enabled || !entry) return;
    if (operational.algorithmBusy) return;
    const snapshotId = operationalSnapshotIdForAlgorithms(operational);
    if (snapshotId == null) return;
    const token = operationalAlgorithmToken();
    operational.algorithmBusy = key;
    operational.algorithmError = null;
    paint();
    try {
      await runCalculationSnapshotDco(token.projectId, snapshotId, entry.policy);
      if (!operationalAlgorithmStillWins(token)) return;
      operational.algorithmBusy = null;
      await reloadOperationalForAlgorithm();
    } catch (err) {
      if (!operationalAlgorithmStillWins(token)) return;
      operational.algorithmError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error', params: {},
      };
    } finally {
      if (operationalAlgorithmStillWins(token)) {
        operational.algorithmBusy = null;
        paint();
      }
    }
  }

  function operationalDecisionStillWins(token) {
    const operational = state.operationalDesk;
    return state.authed && operational === token.operational
      && token.sequence === operationalDecisionSequence
      && token.generation === operationalContextGeneration
      && token.session === sessionGeneration
      && String(token.projectId) === String(operational.projectId)
      && String(token.inventoryVersionId) === String(operational.inventoryVersionId)
      && token.mode === operational.mode
      && operational.decisionIntent?.key === token.key;
  }

  function operationalDecisionContextMatches(context, token) {
    return context != null
      && String(context.project_id) === String(token.projectId)
      && String(context.inventory_version_id) === String(token.inventoryVersionId)
      && context.version_changed !== true;
  }

  function operationalDecisionProjectionFingerprint(unit, token) {
    if (!unit || String(unit.unit_id) !== token.unitId) return null;
    const recommendation = unit.recommendation;
    const lineage = recommendation?.lineage;
    const decision = recommendation?.decision;
    const decisionLineage = decision?.lineage;
    if (!recommendation || recommendation.state !== token.verdict
      || decision?.verdict !== token.verdict || !lineage || !decisionLineage
      || String(lineage.inventory_version_id) !== String(token.inventoryVersionId)
      || String(lineage.inventory_version_key) !== String(token.inventoryVersionKey)
      || String(lineage.snapshot_id) !== String(token.snapshotId)
      || String(lineage.result_id) !== String(token.resultId)) return null;
    const lineageKeys = [
      'inventory_version_id', 'inventory_version_key', 'inventory_sha256',
      'source_batch_id', 'snapshot_id', 'snapshot_sha256', 'result_id',
      'result_sha256', 'algorithm_version', 'policy_version',
      'implementation_id', 'implementation_version',
    ];
    if (lineageKeys.some((field) => (
      lineage[field] == null || decisionLineage[field] == null
      || String(lineage[field]) !== String(decisionLineage[field])
    ))) return null;
    return JSON.stringify({
      unit_id: String(unit.unit_id),
      unit_external_id: String(unit.unit_external_id),
      state: recommendation.state,
      target_absolute_scaled: String(recommendation.target_absolute_scaled),
      base_price_per_area_scaled: String(recommendation.base_price_per_area_scaled),
      currency: recommendation.currency,
      area_unit: recommendation.area_unit,
      group_id: recommendation.group_id,
      lineage: lineageKeys.map((field) => String(lineage[field])),
      decision: [
        String(decision.id), decision.verdict,
        String(decision.decided_by_user_id), decision.decided_at_utc,
      ],
    });
  }

  function operationalDecisionRefreshIsCoherent(table, board, detail, token) {
    if (!operationalDecisionContextMatches(table?.context, token)) return false;
    const tableUnits = (table.items || []).filter(
      (unit) => String(unit.unit_id) === token.unitId,
    );
    if (tableUnits.length !== 1) return false;
    const units = [...tableUnits];
    if (token.mode === 'chessboard') {
      if (!operationalDecisionContextMatches(board?.context, token)) return false;
      const boardUnits = operationalBoardUnitEntries(board)
        .map((entry) => entry.cell.unit)
        .filter((unit) => String(unit.unit_id) === token.unitId);
      if (!boardUnits.length) return false;
      units.push(...boardUnits);
    }
    if (token.detailUnitId != null) {
      if (!operationalDecisionContextMatches(detail?.context, token)
        || String(detail?.identity?.unit_id) !== token.unitId) return false;
      units.push({
        ...detail.identity,
        recommendation: detail.recommendation,
      });
    }
    const fingerprints = units.map(
      (unit) => operationalDecisionProjectionFingerprint(unit, token),
    );
    return fingerprints.every((value) => value != null && value === fingerprints[0]);
  }

  async function refreshOperationalDecisionSurfaces(token) {
    const operational = token.operational;
    const table = await inventoryProjectUnits(token.projectId, {
      inventoryVersionId: token.inventoryVersionId,
      filters: operational.filters,
      sort: operational.sort,
      direction: operational.direction,
      page: operational.page,
      pageSize: operational.pageSize,
      asOfUtc: operational.asOfUtc,
      algorithm: state.operationalDesk.algorithm,
    });
    if (!operationalDecisionStillWins(token)) return false;
    let board = operational.board;
    if (token.mode === 'chessboard') {
      const sections = table.filter_options?.sections || [];
      if (!sections.length) throw new ApiError('inventory_chessboard_layout_unavailable');
      board = composeOperationalBuildingBoard(await inventoryProjectBuildingChessboard(
        token.projectId,
        sections,
        {
          inventoryVersionId: token.inventoryVersionId,
          filters: filtersForBuildingBoard(operational.filters),
          asOfUtc: operational.asOfUtc,
          algorithm: state.operationalDesk.algorithm,
        },
      ), operational.sectionId, operational.filters);
      if (!board) throw new ApiError('inventory_chessboard_layout_unavailable');
      if (!operationalDecisionStillWins(token)) return false;
    }
    let detail = operational.detail;
    if (operational.detailUnitId != null) {
      detail = await inventoryProjectUnitDetail(
        token.projectId,
        operational.detailUnitId,
        {
          inventoryVersionId: token.inventoryVersionId,
          historyLimit: 100,
          historyOffset: operational.historyOffset,
          asOfUtc: operational.asOfUtc,
          algorithm: state.operationalDesk.algorithm,
        },
      );
      if (!operationalDecisionStillWins(token)) return false;
    }
    if (!operationalDecisionRefreshIsCoherent(table, board, detail, token)) {
      throw new ApiError('inventory_recommendation_decision_refresh_mismatch');
    }
    operational.table = table;
    operational.board = board;
    operational.detail = detail;
    operational.error = null;
    operational.boardError = null;
    operational.detailError = null;
    operational.decisionSavedRefreshFailures = {};
    return true;
  }

  async function submitOperationalDecision(intent) {
    const operational = state.operationalDesk;
    if (operational.decisionBusy || intent.verdict == null) return;
    const key = `${intent.unitId}:${intent.snapshotId}:${intent.resultId}:${intent.verdict}`;
    const token = {
      operational,
      sequence: ++operationalDecisionSequence,
      generation: operationalContextGeneration,
      session: sessionGeneration,
      projectId: operational.projectId,
      inventoryVersionId: operational.inventoryVersionId,
      inventoryVersionKey: intent.inventoryVersionKey,
      snapshotId: intent.snapshotId,
      resultId: intent.resultId,
      verdict: intent.verdict,
      mode: operational.mode,
      unitId: String(intent.unitId),
      detailUnitId: operational.detailUnitId,
      key,
    };
    operational.decisionBusy = true;
    operational.decisionError = null;
    operational.decisionIntent = { key, unitId: token.unitId };
    paint();
    let persisted = false;
    try {
      await recordInventoryRecommendationDecision(token.projectId, {
        inventoryVersionId: intent.inventoryVersionId,
        unitId: intent.unitId,
        snapshotId: intent.snapshotId,
        resultId: intent.resultId,
        verdict: intent.verdict,
      });
      persisted = true;
      if (!operationalDecisionStillWins(token)) return;
      const refreshed = await refreshOperationalDecisionSurfaces(token);
      if (!refreshed || !operationalDecisionStillWins(token)) return;
      await loadOperationalSurfaceProjection();
      if (!operationalDecisionStillWins(token)) return;
    } catch (err) {
      if (!operationalDecisionStillWins(token)) return;
      if (persisted) {
        operational.decisionSavedRefreshFailures = {
          ...operational.decisionSavedRefreshFailures,
          [token.unitId]: { verdict: token.verdict },
        };
        operational.decisionError = null;
      } else {
        operational.decisionError = {
          unitId: token.unitId,
          key: err instanceof ApiError ? err.key : 'x_internal_error',
          params: err instanceof ApiError ? err.params : {},
        };
      }
    } finally {
      if (!operationalDecisionStillWins(token)) return;
      operational.decisionBusy = false;
      operational.decisionIntent = null;
      preserveOperationalViewport(paint);
    }
  }

  function confirmOperationalDecision(control) {
    if (!control || control.disabled || state.operationalDesk.decisionBusy) return;
    const verdict = control.getAttribute('data-inventory-recommendation-decision');
    const unitId = control.getAttribute('data-inventory-unit-id');
    const operational = state.operationalDesk;
    const tableUnit = (operational.table?.items || []).find(
      (unit) => String(unit.unit_id) === String(unitId),
    );
    const detailMatches = String(operational.detail?.identity?.unit_id) === String(unitId);
    const identity = detailMatches ? operational.detail.identity : tableUnit;
    const recommendation = detailMatches
      ? operational.detail.recommendation : tableUnit?.recommendation;
    const unitNumber = identity?.unit_number;
    const unitExternalId = identity?.unit_external_id;
    const unitLabel = unitNumber && unitExternalId && unitNumber !== unitExternalId
      ? `${unitNumber} (${unitExternalId})`
      : unitNumber || unitExternalId || unitId;
    const intent = {
      verdict,
      unitId,
      inventoryVersionId: control.getAttribute('data-inventory-version-id'),
      snapshotId: control.getAttribute('data-inventory-snapshot-id'),
      resultId: control.getAttribute('data-inventory-result-id'),
      inventoryVersionKey: recommendation?.lineage?.inventory_version_key,
    };
    if (!['accepted', 'declined'].includes(verdict)
      || Object.values(intent).some((value) => value == null || value === '')) return;
    openConfirmModal(state, {
      titleKey: 'inventory_recommendation_decision_confirm_title',
      confirmKey: verdict === 'accepted'
        ? 'inventory_recommendation_accept' : 'inventory_recommendation_decline',
      bodyKey: 'inventory_recommendation_decision_confirm_body',
      params: {
        unit: unitLabel,
        verdict: t(`inventory_recommendation_${verdict}`, state.lang),
        target: operationalMoney(
          recommendation.target_absolute_scaled, recommendation.currency, state.lang,
        ),
        dataset: `${intent.inventoryVersionId} · ${intent.inventoryVersionKey}`,
      },
      onConfirm: () => submitOperationalDecision(intent),
    });
  }

  function beginOperationalContextGeneration() {
    const operational = state.operationalDesk;
    operationalSnapshotCreateSequence += 1;
    operationalSnapshotInspectSequence += 1;
    operationalSnapshotRunSequence += 1;
    operationalDecisionSequence += 1;
    operational.snapshotBusy = false;
    operational.snapshotIntentId = null;
    operational.decisionBusy = false;
    operational.decisionIntent = null;
    operational.decisionError = null;
    operational.decisionSavedRefreshFailures = {};
    cancelPendingOperationalDetail();
    operational.loading = false;
    operational.boardLoading = false;
    return {
      generation: ++operationalContextGeneration,
      session: sessionGeneration,
      projectId: operational.projectId,
      inventoryVersionId: operational.inventoryVersionId,
      mode: operational.mode,
    };
  }

  function operationalContextStillWins(token) {
    const operational = state.operationalDesk;
    return token.generation === operationalContextGeneration
      && token.session === sessionGeneration
      && state.authed
      && String(token.projectId) === String(operational.projectId)
      && String(token.inventoryVersionId) === String(operational.inventoryVersionId)
      && token.mode === operational.mode;
  }

  function clearSessionState() {
    state.confirmedCapabilities = null;
    state.dataActivationPending = false;
    sessionGeneration += 1;
    supersedeInflightViews();
    onSliderInput.cancel();
    deskCommandInFlight = false;
    clearDataWorkspaceState();
    clearOperationalDeskState();
    feedbackRequestSequence += 1;
    loopRequestSequence += 1;
    loopDetailSequence += 1;
    loopMutationSequence += 1;
    if (loopPollTimer !== null) cancelTimeout(loopPollTimer);
    loopPollTimer = null;
    for (const timer of loopRequestTimeouts) cancelTimeout(timer);
    loopRequestTimeouts.clear();
    state.feedbackState = emptyFeedbackState();
    state.loopState = emptyProductLoopState();
    state.screen = 'login';
    state.market = 'rf';
    state.role = null;
    state.landing = null;
    state.surface = null;
    state.project = null;
    state.chrome = null;
    state.surfaceData = null;
    state.permissions = null;
    state.termSet = {};
    state.roleMenuOpen = false;
    state.authed = false;
    state.sessionBusy = false;
    operationalRailOpen = false;
    operationalRailTrigger = null;
  }

  function operationalRailIsMobile() {
    return typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(max-width: 820px)').matches;
  }

  function syncOperationalRail({ focus = false, restoreFocus = false } = {}) {
    const rail = root.querySelector('#rail');
    const burger = root.querySelector('.burger');
    const backdrop = root.querySelector('.operational-rail-backdrop');
    if (!rail || !burger) return;
    const mobile = operationalRailIsMobile();
    const open = mobile && operationalRailOpen;
    rail.className = `rail operational-rail${open ? ' open' : ''}`;
    rail.inert = mobile && !open;
    rail.setAttribute('aria-hidden', mobile && !open ? 'true' : 'false');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (backdrop) {
      backdrop.hidden = !open;
      backdrop.inert = !open;
      backdrop.className = `operational-rail-backdrop${open ? ' open' : ''}`;
    }
    if (focus && open) rail.querySelector('[data-operational-rail-close]')?.focus();
    if (restoreFocus && !open) (operationalRailTrigger || burger).focus();
  }

  function closeOperationalRail(restoreFocus = true) {
    operationalRailOpen = false;
    syncOperationalRail({ restoreFocus });
  }

  function paint() {
    // Preserve a destination heading through background snapshot/history repaints,
    // but never move focus back after the user has focused another control.
    const focusedId = document.activeElement?.getAttribute?.('id');
    const preserveHeading = ['data-workspace-title', 'inventory-desk-title'].includes(focusedId)
      && root.querySelector(`#${focusedId}`) === document.activeElement;
    if (state.screen === 'loop') {
      root.replaceChildren(renderProductLoopWorkspace(state, handlers));
      document.title = t('product_loop_title', state.lang);
    } else if (state.screen === 'data') {
      root.replaceChildren(renderDataWorkspace(state, handlers));
      document.title = t(state.dataState.createOnly ? 'x_new_project' : 'nav_data', state.lang);
    } else if (state.screen === 'shell') {
      root.replaceChildren(renderShell(state, state.chrome || {}, handlers));
      document.title = t(`nav_${state.surface}`, state.lang);
      // Re-attach the live what-if wiring to the freshly-built controls (UX-DR5).
      wireSurfaceControls();
    } else if (state.screen === 'landing') {
      root.replaceChildren(renderLanding(state, handlers));
      document.title = t(
        state.landing === null ? 'admin_notice_title' : landingTitleKey(state.landing),
        state.lang,
      );
    } else {
      root.replaceChildren(renderLogin(state, handlers));
      document.title = 'DPrice';
    }
    const feedbackIntake = buildFeedbackIntake(state, handlers);
    if (feedbackIntake) root.append(feedbackIntake);
    // The language switch re-renders everything (replaceChildren above) and
    // swaps `<html lang>`; the `Intl` locale follows the same `state.lang`
    // through localeFor() in the format helpers — there is no global locale to
    // mutate (AD-3, UX-DR12).
    document.documentElement.setAttribute('lang', state.lang);
    if (state.operationalDesk.enabled) syncOperationalRail();
    if (preserveHeading) root.querySelector(`#${focusedId}`)?.focus();
  }

  function enterLanding(data) {
    state.role = data.role;
    state.landing = data.landing;
    // Every fresh login starts at the session-scoped defaults RU + UAE, with no
    // per-user persistence (AC4, EXPERIENCE UX-DR1): a language chosen on the
    // pre-auth switcher must not carry into the landing.
    state.lang = opts.lang === 'en' ? 'en' : 'ru';
    state.market = 'rf';
    state.project = null; // reset scope to the first project (UX-DR11)
    state.termSet = {}; // fresh session-local what-if terms
    state.chrome = null;
    state.surfaceData = null;
    state.permissions = null;
    state.feedbackState = emptyFeedbackState();
    state.loopState = emptyProductLoopState();
    state.roleMenuOpen = false;
    state.error = null;
    state.authed = true;
    state.sessionBusy = false;
    // The vendor-side loop administrator enters the org-less workbench. It is
    // deliberately separate from every org-scoped product surface.
    if (data.landing === 'loop') {
      state.screen = 'loop';
      state.surface = null;
      state.loopState.loading = true;
      paint();
      loadProductLoopWorkspace();
    } else if (data.landing === null) {
      state.screen = 'landing';
      state.surface = null;
      paint();
    } else if (data.landing === 'data') {
      state.screen = 'data';
      state.surface = null;
      state.dataState = emptyDataWorkspaceState({ loading: true });
      paint();
      loadDataWorkspace();
    } else {
      state.screen = 'shell';
      // Only the six restored operational routes may own authenticated product
      // navigation. Hidden and stale legacy landings fail closed to Today.
      state.surface = OPERATIONAL_SURFACES.has(data.landing) ? data.landing : FIRST_TAB;
      state.operationalDesk = {
        ...emptyOperationalDeskState(), enabled: true, loading: true,
      };
      paint();
      loadSurface(state.surface);
    }
  }

  function workbenchError(err) {
    return {
      key: err instanceof ApiError ? err.key : 'x_internal_error',
      params: err instanceof ApiError ? err.params : {},
    };
  }

  function hasActiveProductLoopAutomation() {
    const detailPlans = state.loopState.detail?.plans?.items || [];
    const activeRun = [...state.loopState.plans, ...detailPlans].some((plan) =>
      ['queued', 'running'].includes(plan.development_run?.status));
    const activePreparation = (state.loopState.detail?.preparations || []).some(
      (preparation) => ['queued', 'running'].includes(preparation.state),
    );
    return activeRun || activePreparation
      || Number(state.loopState.activeAutomationCount || 0) > 0;
  }

  function normalizeProductLoopPlanPage(plans) {
    return Array.isArray(plans)
      ? { items: plans, total: plans.length, count: plans.length,
        limit: 20, offset: 0, has_more: false }
      : (plans || { items: [], total: 0, count: 0, limit: 20,
        offset: 0, has_more: false });
  }

  function autoFillPlanDraft() {
    // A finished preparation lands in the plan form by itself: the operator
    // edits a filled draft instead of applying it first.
    const detail = state.loopState.detail;
    if (!detail || state.loopState.planDraft || state.loopState.editPlanId != null) return;
    if (relatedProductLoopPlans(state.loopState, detail).length) return;
    const suggestion = (detail.preparations || [])[0]?.suggestions?.at(-1)?.suggestion;
    if (!suggestion) return;
    state.loopState.planDraft = suggestionPlanDraft(suggestion);
  }

  function captureProductLoopViewContext() {
    const active = document.activeElement;
    const form = active?.closest?.('[data-loop-form-key]') || null;
    const island = active?.closest?.(
      '[data-loop-live-preparation], [data-loop-live-execution], [data-loop-live-timeline]',
    ) || null;
    let islandKind = null;
    let islandId = null;
    for (const kind of ['preparation', 'execution', 'timeline']) {
      const value = island?.getAttribute?.(`data-loop-live-${kind}`);
      if (value != null) {
        islandKind = kind;
        islandId = value;
        break;
      }
    }
    return {
      formKey: form?.getAttribute?.('data-loop-form-key') || null,
      formField: active?.getAttribute?.('name') || null,
      focusKey: active?.getAttribute?.('data-loop-focus-key') || null,
      liveAction: active?.getAttribute?.('data-loop-live-action') || null,
      selectionStart: Number.isInteger(active?.selectionStart) ? active.selectionStart : null,
      selectionEnd: Number.isInteger(active?.selectionEnd) ? active.selectionEnd : null,
      selectionDirection: active?.selectionDirection || 'none',
      islandKind,
      islandId,
      hadWorkbenchFocus: Boolean(active?.closest?.('.product-loop-page')),
      windowX: Number.isFinite(window.scrollX) ? window.scrollX : null,
      windowY: Number.isFinite(window.scrollY) ? window.scrollY : null,
      masterScroll: root.querySelector('.product-loop-master')?.scrollTop ?? null,
      detailScroll: root.querySelector('.product-loop-detail')?.scrollTop ?? null,
    };
  }

  function restoreProductLoopViewContext(context) {
    let focusTarget = null;
    if (context.formKey && context.formField) {
      focusTarget = root.querySelector(
        `[data-loop-form-key="${context.formKey}"]`,
      )?.querySelector(`[name="${context.formField}"]`);
    } else if (context.focusKey) {
      focusTarget = root.querySelector(`[data-loop-focus-key="${context.focusKey}"]`);
    } else if (context.islandKind && context.islandId && context.liveAction) {
      const liveIsland = root.querySelector(
        `[data-loop-live-${context.islandKind}="${context.islandId}"]`,
      );
      focusTarget = liveIsland?.querySelector(
        `[data-loop-live-action="${context.liveAction}"]`,
      );
    }
    if (focusTarget?.disabled) focusTarget = null;
    if ((!focusTarget || focusTarget.disabled) && context.hadWorkbenchFocus) {
      focusTarget = root.querySelector('#product-loop-detail-heading');
    }
    if (focusTarget && !focusTarget.disabled) {
      focusTarget.focus();
      if (
        context.selectionStart != null
        && context.selectionEnd != null
        && typeof focusTarget.setSelectionRange === 'function'
      ) {
        const length = String(focusTarget.value || '').length;
        focusTarget.setSelectionRange(
          Math.min(context.selectionStart, length),
          Math.min(context.selectionEnd, length),
          context.selectionDirection,
        );
      }
    }
    const master = root.querySelector('.product-loop-master');
    const detail = root.querySelector('.product-loop-detail');
    if (master && context.masterScroll != null) master.scrollTop = context.masterScroll;
    if (detail && context.detailScroll != null) detail.scrollTop = context.detailScroll;
    if (context.windowX != null && context.windowY != null) {
      window.scrollTo(context.windowX, context.windowY);
    }
  }

  function syncProductLoopLiveRoot(current, replacement) {
    const currentNames = current.getAttributeNames?.() || Object.keys(current.attrs || {});
    const replacementNames = replacement.getAttributeNames?.()
      || Object.keys(replacement.attrs || {});
    for (const name of currentNames) {
      if (name !== 'class' && !replacementNames.includes(name)) current.removeAttribute(name);
    }
    current.className = replacement.className;
    for (const name of replacementNames) {
      if (name !== 'class') current.setAttribute(name, replacement.getAttribute(name));
    }
    current.replaceChildren(...Array.from(replacement.childNodes || replacement.children || []));
  }

  function patchProductLoopLiveIslands(previousLiveSignatures) {
    const replacements = [];
    const detail = state.loopState.detail;
    const nextLiveSignatures = productLoopLiveSignatures(state.loopState);
    const currentStale = root.querySelector('[data-loop-live-stale="true"]');
    if (!currentStale) return false;
    if (previousLiveSignatures.stale !== nextLiveSignatures.stale) {
      replacements.push([
        currentStale,
        buildProductLoopStaleStatus(state.loopState, state),
      ]);
    }
    if (detail) {
      const currentPreparation = root.querySelector(
        `[data-loop-live-preparation="${detail.id}"]`,
      );
      if (!currentPreparation) return false;
      if (previousLiveSignatures.preparation !== nextLiveSignatures.preparation) {
        replacements.push([
          currentPreparation,
          buildPreparationPanel(detail, state.loopState, state, handlers),
        ]);
      }
    }
    for (const plan of relatedProductLoopPlans(state.loopState, detail)) {
      const currentTimeline = root.querySelector(
        `[data-loop-live-timeline="${plan.id}"]`,
      );
      if (!currentTimeline) return false;
      const previousPlan = previousLiveSignatures.plans[String(plan.id)];
      const nextPlan = nextLiveSignatures.plans[String(plan.id)];
      if (previousPlan?.timeline !== nextPlan.timeline) {
        replacements.push([currentTimeline, buildLoopTimeline(plan, state.lang)]);
      }
      if (plan.development_run) {
        const currentExecution = root.querySelector(
          `[data-loop-live-execution="${plan.id}"]`,
        );
        if (!currentExecution) return false;
        if (previousPlan?.execution !== nextPlan.execution) {
          replacements.push([
            currentExecution,
            buildDevelopmentRun(plan, state.loopState, state, handlers),
          ]);
        }
      }
    }
    for (const [current, replacement] of replacements) {
      syncProductLoopLiveRoot(current, replacement);
    }
    return true;
  }

  function renderProductLoopBackgroundResult(
    previousStaticSignature, previousLiveSignatures, context,
  ) {
    const staticFactsUnchanged = previousStaticSignature === productLoopStaticSignature(
      state.loopState,
    );
    if (!staticFactsUnchanged
      || !patchProductLoopLiveIslands(previousLiveSignatures)) paint();
    restoreProductLoopViewContext(context);
  }

  function withProductLoopPollTimeout(request) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = scheduleTimeout(() => {
        loopRequestTimeouts.delete(timer);
        if (settled) return;
        settled = true;
        reject(new Error('product-loop polling request timed out'));
      }, 10000);
      loopRequestTimeouts.add(timer);
      Promise.resolve(request).then(
        (value) => {
          if (settled) return;
          settled = true;
          loopRequestTimeouts.delete(timer);
          cancelTimeout(timer);
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          loopRequestTimeouts.delete(timer);
          cancelTimeout(timer);
          reject(error);
        },
      );
    });
  }

  async function pollProductLoopWorkspace() {
    if (state.loopState.mutationBusy) {
      scheduleProductLoopPolling();
      return;
    }
    const sequence = ++loopRequestSequence;
    const detailSequenceAtStart = loopDetailSequence;
    const generation = sessionGeneration;
    let detailSequence = null;
    const requestStillWins = () => generation === sessionGeneration
      && sequence === loopRequestSequence
      && (detailSequence == null
        ? detailSequenceAtStart === loopDetailSequence
        : detailSequence === loopDetailSequence)
      && state.authed && state.screen === 'loop';
    try {
      const data = await withProductLoopPollTimeout(productLoopWorkspace({
        offset: state.loopState.registryOffset,
        planOffset: state.loopState.planOffset,
      }));
      if (!requestStillWins()) return;
      const registry = data.registry || { items: [], total: 0 };
      const planPage = normalizeProductLoopPlanPage(data.plans);
      const items = registry.items || [];
      const priorSelection = state.loopState.selectedFeedbackId;
      let selected = priorSelection || items[0]?.id || null;
      let detail = null;
      let selectionDisappeared = false;
      if (selected != null) {
        detailSequence = ++loopDetailSequence;
        try {
          detail = await withProductLoopPollTimeout(productLoopFeedback(selected, {
            planOffset: state.loopState.detailPlanOffset,
          }));
          if (!requestStillWins()) return;
          selectionDisappeared = priorSelection != null && detail == null;
        } catch (err) {
          if (!(priorSelection != null && err instanceof ApiError && err.status === 404)) {
            throw err;
          }
          selectionDisappeared = true;
        }
      }
      if (selectionDisappeared) {
        selected = items.find(
          (item) => String(item.id) !== String(priorSelection),
        )?.id || null;
        detail = null;
        if (selected != null) {
          detailSequence = ++loopDetailSequence;
          detail = await withProductLoopPollTimeout(productLoopFeedback(selected, {
            planOffset: 0,
          }));
          if (!requestStillWins()) return;
        }
      }

      const previousStaticSignature = productLoopStaticSignature(state.loopState);
      const previousLiveSignatures = productLoopLiveSignatures(state.loopState);
      const context = captureProductLoopViewContext();
      if (selectionDisappeared) {
        const preparationHints = { ...state.loopState.preparationHints };
        delete preparationHints[String(priorSelection)];
        state.loopState.preparationHints = preparationHints;
        state.loopState.planDraft = null;
        state.loopState.editPlanId = null;
        state.loopState.focusFeedbackId = null;
        state.loopState.detailPlanOffset = 0;
      }
      state.loopState.registry = registry;
      state.loopState.plans = planPage.items || [];
      state.loopState.planPage = planPage;
      state.loopState.capabilities = data.capabilities || {};
      state.loopState.activeAutomationCount = Number(data.active_automation_count || 0);
      state.loopState.selectedFeedbackId = selected;
      state.loopState.detail = detail;
      autoFillPlanDraft();
      state.loopState.progressStale = false;
      state.loopState.pollDelay = 2000;
      renderProductLoopBackgroundResult(
        previousStaticSignature, previousLiveSignatures, context,
      );
    } catch (err) {
      if (!requestStillWins()) return;
      const previousStaticSignature = productLoopStaticSignature(state.loopState);
      const previousLiveSignatures = productLoopLiveSignatures(state.loopState);
      const context = captureProductLoopViewContext();
      state.loopState.progressStale = true;
      state.loopState.pollDelay = Math.min(30000, state.loopState.pollDelay * 2);
      renderProductLoopBackgroundResult(
        previousStaticSignature, previousLiveSignatures, context,
      );
    } finally {
      if (requestStillWins()) scheduleProductLoopPolling();
    }
  }

  function scheduleProductLoopPolling() {
    if (loopPollTimer !== null) cancelTimeout(loopPollTimer);
    loopPollTimer = null;
    if (!state.authed || state.screen !== 'loop') return;
    if (!hasActiveProductLoopAutomation()) return;
    const generation = sessionGeneration;
    loopPollTimer = scheduleTimeout(() => {
      loopPollTimer = null;
      if (generation !== sessionGeneration || !state.authed || state.screen !== 'loop') return;
      pollProductLoopWorkspace();
    }, state.loopState.pollDelay);
  }

  async function loadProductLoopFeedback(feedbackId, parentSequence = loopRequestSequence) {
    const sequence = ++loopDetailSequence;
    const generation = sessionGeneration;
    state.loopState.selectedFeedbackId = feedbackId;
    state.loopState.detailLoading = true;
    state.loopState.error = null;
    paint();
    try {
      const detail = await productLoopFeedback(feedbackId, {
        planOffset: state.loopState.detailPlanOffset,
      });
      if (generation !== sessionGeneration || parentSequence !== loopRequestSequence
        || sequence !== loopDetailSequence || !state.authed || state.screen !== 'loop') return;
      state.loopState.detail = detail;
      autoFillPlanDraft();
    } catch (err) {
      if (generation !== sessionGeneration || parentSequence !== loopRequestSequence
        || sequence !== loopDetailSequence || !state.authed || state.screen !== 'loop') return;
      state.loopState.progressStale = hasActiveProductLoopAutomation();
      state.loopState.pollDelay = Math.min(30000, state.loopState.pollDelay * 2);
      state.loopState.error = workbenchError(err);
    } finally {
      if (generation === sessionGeneration && parentSequence === loopRequestSequence
        && sequence === loopDetailSequence && state.authed && state.screen === 'loop') {
        state.loopState.detailLoading = false;
        paint();
        if (String(state.loopState.focusFeedbackId) === String(feedbackId)) {
          root.querySelector('#product-loop-detail-heading')?.focus();
          state.loopState.focusFeedbackId = null;
        }
        scheduleProductLoopPolling();
      }
    }
  }

  async function loadProductLoopWorkspace(selectId = null) {
    const sequence = ++loopRequestSequence;
    const generation = sessionGeneration;
    state.loopState.loading = true;
    state.loopState.error = null;
    paint();
    try {
      const data = await productLoopWorkspace({
        offset: state.loopState.registryOffset,
        planOffset: state.loopState.planOffset,
      });
      if (generation !== sessionGeneration || sequence !== loopRequestSequence
        || !state.authed || state.screen !== 'loop') return;
      state.loopState.registry = data.registry || { items: [], total: 0 };
      const planPage = normalizeProductLoopPlanPage(data.plans);
      state.loopState.plans = planPage.items || [];
      state.loopState.planPage = planPage;
      state.loopState.capabilities = data.capabilities || {};
      state.loopState.activeAutomationCount = Number(data.active_automation_count || 0);
      state.loopState.progressStale = false;
      state.loopState.pollDelay = 2000;
      const items = state.loopState.registry.items || [];
      const candidate = selectId || state.loopState.selectedFeedbackId || items[0]?.id || null;
      const selected = items.some((item) => String(item.id) === String(candidate))
        ? candidate : items[0]?.id || null;
      state.loopState.selectedFeedbackId = selected;
      state.loopState.detail = selected == null ? null : state.loopState.detail;
      if (selected != null) await loadProductLoopFeedback(selected, sequence);
    } catch (err) {
      if (generation !== sessionGeneration || sequence !== loopRequestSequence
        || !state.authed || state.screen !== 'loop') return;
      state.loopState.error = workbenchError(err);
      state.loopState.progressStale = hasActiveProductLoopAutomation();
      state.loopState.pollDelay = Math.min(30000, state.loopState.pollDelay * 2);
    } finally {
      if (generation === sessionGeneration && sequence === loopRequestSequence
        && state.authed && state.screen === 'loop') {
        state.loopState.loading = false;
        paint();
        scheduleProductLoopPolling();
      }
    }
  }

  async function runProductLoopMutation(request, { draftKind = null, draftKey = null } = {}) {
    if (state.loopState.mutationBusy) return false;
    const sequence = ++loopMutationSequence;
    const generation = sessionGeneration;
    state.loopState.mutationBusy = true;
    state.loopState.error = null;
    paint();
    try {
      await request();
      if (generation !== sessionGeneration || sequence !== loopMutationSequence
        || !state.authed || state.screen !== 'loop') return false;
      if (draftKind === 'preparation') {
        delete state.loopState.preparationHints[String(draftKey)];
      } else if (draftKind === 'plan') {
        state.loopState.planDraft = null;
      } else if (draftKind === 'result') {
        delete state.loopState.resultDrafts[String(draftKey)];
      }
      state.loopState.editPlanId = null;
      await loadProductLoopWorkspace(state.loopState.selectedFeedbackId);
      return true;
    } catch (err) {
      if (generation !== sessionGeneration || sequence !== loopMutationSequence
        || !state.authed || state.screen !== 'loop') return false;
      state.loopState.error = workbenchError(err);
      return false;
    } finally {
      if (generation === sessionGeneration && sequence === loopMutationSequence
        && state.authed && state.screen === 'loop') {
        state.loopState.mutationBusy = false;
        paint();
      }
    }
  }

  async function loadDataWorkspace(selectId = null) {
    const sequence = ++dataRequestSequence;
    state.dataState.loading = true;
    state.dataState.error = null;
    paint();
    try {
      if (state.dataState.createOnly) {
        const batchId = selectId || selectedBatchIntent || state.dataState.selected?.id;
        if (batchId) {
          selectedBatchIntent = batchId;
          await loadImportReview(batchId, 0);
        }
        return;
      }
      const data = await dataWorkspace();
      if (sequence !== dataRequestSequence) return;
      state.confirmedCapabilities = data.capabilities || {};
      state.dataState.capabilities = state.confirmedCapabilities;
      state.dataState.batches = data.batches || [];
      state.dataState.activeInventory = data.active_inventory || {
        items: [], count: 0, has_active_inventory: false,
      };
      state.dataState.historyPagination = data.history_pagination || {
        total: state.dataState.batches.length,
        count: state.dataState.batches.length,
        limit: 25,
        offset: 0,
        has_more: false,
      };
      const batchId = selectId || selectedBatchIntent
        || (state.dataState.selected && state.dataState.selected.id);
      if (batchId) {
        selectedBatchIntent = batchId;
        await loadImportReview(batchId, 0);
      }
      else state.dataState.selected = null;
      if (sequence !== dataRequestSequence) return;
      await loadVersionHistory(state.dataState.versionHistoryPagination.offset || 0);
    } catch (err) {
      if (sequence !== dataRequestSequence) return;
      state.dataState.error = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
    } finally {
      if (sequence === dataRequestSequence) {
        state.dataState.loading = false;
        paint();
      }
    }
  }

  async function loadVersionHistory(offset = 0) {
    const sequence = ++versionRequestSequence;
    state.dataState.versionLoading = true;
    try {
      const page = await inventoryVersionHistory({
        limit: state.dataState.versionHistoryPagination.limit || 25,
        offset,
      });
      if (sequence !== versionRequestSequence) return;
      state.dataState.versionHistory = page.items || [];
      state.dataState.versionHistoryPagination = page;
      state.dataState.error = null;
    } catch (err) {
      if (sequence !== versionRequestSequence) return;
      state.dataState.error = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
    } finally {
      if (sequence === versionRequestSequence) {
        state.dataState.versionLoading = false;
        paint();
      }
    }
  }

  function preserveOperationalViewport(callback, focusSelector = null) {
    const content = root.querySelector('#content');
    const scrollTop = content ? content.scrollTop : 0;
    callback();
    const freshContent = root.querySelector('#content');
    if (freshContent) freshContent.scrollTop = scrollTop;
    if (focusSelector) {
      const focusTarget = root.querySelector(focusSelector);
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    }
  }

  function configureOperationalProjects(payload) {
    if (payload.capabilities) state.confirmedCapabilities = payload.capabilities;
    const projects = payload.items || [];
    const prior = state.operationalDesk;
    if (prior.requiredVersionId != null && !projects.some((item) =>
      String(item.project_id) === String(prior.projectId)
      && String(item.id) === String(prior.requiredVersionId))) {
      prior.loading = false;
      prior.error = { key: 'x_project_target_changed', params: {} };
      return false;
    }
    if (!projects.length) {
      state.operationalDesk = {
        ...emptyOperationalDeskState(),
        enabled: true,
        loading: false,
        noActiveVersion: true,
        capabilities: payload.capabilities || prior.capabilities || {},
      };
      return false;
    }
    const selected = projects.find(
      (item) => String(item.project_id) === String(prior.projectId),
    ) || projects[0];
    const sameProject = String(selected.project_id) === String(prior.projectId);
    state.operationalDesk = {
      ...prior,
      enabled: true,
      projects,
      capabilities: payload.capabilities || prior.capabilities || {},
      projectId: selected.project_id,
      inventoryVersionId: sameProject && prior.inventoryVersionId != null
        ? prior.inventoryVersionId : selected.id,
      asOfUtc: sameProject && prior.asOfUtc
        ? prior.asOfUtc : selected.source_as_of_utc,
      sectionId: sameProject ? prior.sectionId : null,
      board: sameProject ? prior.board : null,
      boardFocus: sameProject ? prior.boardFocus : null,
      selectedUnitId: sameProject ? prior.selectedUnitId : null,
      selectedUnitSectionId: sameProject ? prior.selectedUnitSectionId : null,
      error: null,
      noActiveVersion: false,
    };
    state.operationalDesk.historyHandlers = {
      onPage: (offset) => loadOperationalDetail(
        state.operationalDesk.detailUnitId, offset,
      ),
      onRetry: () => loadOperationalDetail(
        state.operationalDesk.detailUnitId, state.operationalDesk.historyOffset,
      ),
    };
    return true;
  }

  function invalidateOperationalDetail({ clearSelection = false } = {}) {
    operationalDetailSequence += 1;
    state.operationalDesk.detailUnitId = null;
    state.operationalDesk.detail = null;
    state.operationalDesk.detailLoading = false;
    state.operationalDesk.detailError = null;
    state.operationalDesk.historyOffset = 0;
    state.operationalDesk.detailOriginMode = null;
    if (clearSelection) {
      state.operationalDesk.selectedUnitId = null;
      state.operationalDesk.selectedUnitSectionId = null;
      state.operationalDesk.boardFocus = null;
    }
  }

  async function loadOperationalSurfaceProjection({ focus = false } = {}) {
    const operational = state.operationalDesk;
    if (!operational.enabled || operational.projectId == null
      || operational.inventoryVersionId == null
      || !['today', 'nep', 'shelf', 'release', 'desk', 'trend', 'retro']
        .includes(state.surface)) return false;
    const sequence = ++operationalSurfaceSequence;
    const generation = sessionGeneration;
    const surfaceAtStart = state.surface;
    const projectAtStart = operational.projectId;
    const versionAtStart = operational.inventoryVersionId;
    const asOfAtStart = operational.asOfUtc;
    operational.surfaceLoading = true;
    operational.surfaceError = null;
    paint();
    const isCurrent = () => generation === sessionGeneration
      && sequence === operationalSurfaceSequence
      && state.authed && state.screen === 'shell'
      && state.surface === surfaceAtStart
      && String(state.operationalDesk.projectId) === String(projectAtStart)
      && String(state.operationalDesk.inventoryVersionId) === String(versionAtStart)
      && state.operationalDesk.asOfUtc === asOfAtStart;
    try {
      const projection = await operationalSurfaces(projectAtStart, {
        inventoryVersionId: versionAtStart,
        asOfUtc: asOfAtStart,
        algorithm: state.operationalDesk.algorithm,
      });
      if (!isCurrent()) return false;
      if (String(projection?.context?.project_id) !== String(projectAtStart)
        || String(projection?.context?.inventory_version_id) !== String(versionAtStart)) {
        throw new ApiError('operational_surface_lineage_mismatch');
      }
      operational.surfaceProjection = projection;
      operational.surfaceError = null;
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      operational.surfaceError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
      return false;
    } finally {
      if (isCurrent()) {
        operational.surfaceLoading = false;
        paint();
        if (focus) root.querySelector(
          surfaceAtStart === 'today' ? '#operational-today-title'
            : surfaceAtStart === 'nep' ? '#operational-deal-price-title'
              : surfaceAtStart === 'shelf' ? '#operational-shelf-title'
                : surfaceAtStart === 'release' ? '#operational-release-title'
                  : surfaceAtStart === 'retro' ? '#operational-retro-title'
                    : surfaceAtStart === 'desk' ? '#inventory-desk-title'
                      : '#operational-trend-title',
        )?.focus();
      }
    }
  }

  async function loadCurrentOperationalSurface({ focus = false } = {}) {
    state.operationalDesk.loading = false;
    if (state.surface === 'desk') {
      const tableReady = state.operationalDesk.table
        ? true : await loadOperationalTable({ focusTable: false });
      if (!tableReady) return false;
      return loadOperationalSurfaceProjection({ focus });
    }
    if (['today', 'nep', 'shelf', 'release', 'trend', 'retro'].includes(state.surface)) {
      return loadOperationalSurfaceProjection({ focus });
    }
    paint();
    return true;
  }

  function cancelPendingOperationalDetail() {
    operationalDetailSequence += 1;
    const operational = state.operationalDesk;
    operational.detailError = null;
    if (!operational.detailLoading) return;
    operational.detailLoading = false;
    const confirmedId = operational.detail?.identity?.unit_id;
    operational.detailUnitId = confirmedId == null ? null : confirmedId;
    if (confirmedId == null) {
      operational.historyOffset = 0;
      operational.detailOriginMode = null;
    }
  }

  async function loadOperationalTable({
    preserveViewport = false,
    focusTable = false,
    replacement = null,
    clearDetailOnSuccess = false,
    contextToken = null,
  } = {}) {
    const operational = state.operationalDesk;
    const token = contextToken || beginOperationalContextGeneration();
    const requested = { ...operational, ...(replacement || {}) };
    if (!operational.enabled || requested.projectId == null
      || requested.inventoryVersionId == null) return false;
    const sequence = ++operationalTableSequence;
    operational.loading = true;
    operational.error = null;
    const repaint = () => paint();
    if (preserveViewport) preserveOperationalViewport(repaint);
    else paint();
    try {
      const page = await inventoryProjectUnits(requested.projectId, {
        inventoryVersionId: requested.inventoryVersionId,
        filters: requested.filters,
        sort: requested.sort,
        direction: requested.direction,
        page: requested.page,
        pageSize: requested.pageSize,
        asOfUtc: requested.asOfUtc,
        algorithm: state.operationalDesk.algorithm,
      });
      if (sequence !== operationalTableSequence
        || !operationalContextStillWins(token)) return false;
      if (replacement) Object.assign(operational, replacement);
      operational.table = page;
      const sectionOptions = page.filter_options?.sections || [];
      if (operational.sectionId == null && sectionOptions.length) {
        operational.sectionId = sectionOptions[0].id;
      }
      operational.error = null;
      operational.filterError = null;
      if (clearDetailOnSuccess) invalidateOperationalDetail({ clearSelection: true });
      loadOperationalSnapshots();
      return true;
    } catch (err) {
      if (sequence !== operationalTableSequence
        || !operationalContextStillWins(token)) return false;
      operational.error = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
      return false;
    } finally {
      if (sequence === operationalTableSequence && operationalContextStillWins(token)) {
        operational.loading = false;
        if (preserveViewport) preserveOperationalViewport(
          repaint, focusTable ? '#inventory-table-title' : null,
        );
        else if (focusTable) preserveOperationalViewport(
          repaint, '#inventory-table-title',
        );
        else paint();
      }
    }
  }

  async function loadOperationalBoard({
    replacement = null, focusBoard = false, contextToken = null,
  } = {}) {
    const operational = state.operationalDesk;
    const token = contextToken || beginOperationalContextGeneration();
    const requested = { ...operational, ...(replacement || {}) };
    requested.filters = filtersForBuildingBoard(requested.filters);
    const sectionOptions = requested.table?.filter_options?.sections || [];
    if (!operational.enabled || requested.projectId == null
      || requested.inventoryVersionId == null || !sectionOptions.length) return false;
    const sequence = ++operationalBoardSequence;
    operational.boardLoading = true;
    operational.boardError = null;
    preserveOperationalViewport(paint);
    let committed = false;
    try {
      const boards = await inventoryProjectBuildingChessboard(
        requested.projectId, sectionOptions, {
          inventoryVersionId: requested.inventoryVersionId,
          filters: requested.filters,
          asOfUtc: requested.asOfUtc,
          algorithm: state.operationalDesk.algorithm,
        },
      );
      if (sequence !== operationalBoardSequence
        || !operationalContextStillWins(token)) return false;
      const board = composeOperationalBuildingBoard(
        boards, requested.sectionId, requested.filters,
      );
      if (!board) throw new ApiError('inventory_chessboard_layout_unavailable');
      if (replacement) Object.assign(operational, replacement);
      operational.filters = requested.filters;
      operational.sectionId = board.sections?.[0]?.section?.section_id ?? requested.sectionId;
      operational.board = board;
      operational.boardError = null;
      const realCells = operationalBoardUnitEntries(board);
      const focused = operational.boardFocus && realCells.find((entry) => (
        String(entry.sectionId) === String(operational.boardFocus.sectionId)
        && String(entry.floorId) === String(operational.boardFocus.floorId)
        && String(entry.stackId) === String(operational.boardFocus.stackId)
      ));
      const selected = realCells.find((entry) => (
        String(entry.cell.unit?.unit_id) === String(operational.selectedUnitId)
      ));
      const target = focused || selected || realCells[0];
      operational.boardFocus = target ? {
        sectionId: target.sectionId,
        floorId: target.floorId,
        stackId: target.stackId,
        unitId: target.cell.unit?.unit_id,
      } : null;
      committed = true;
      return true;
    } catch (err) {
      if (sequence !== operationalBoardSequence
        || !operationalContextStillWins(token)) return false;
      operational.boardError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
      return false;
    } finally {
      if (sequence === operationalBoardSequence && operationalContextStillWins(token)) {
        operational.boardLoading = false;
        const focus = committed && focusBoard && operational.boardFocus
          ? `[data-chessboard-focus-key="${operational.boardFocus.sectionId}:${
            operational.boardFocus.floorId}:${operational.boardFocus.stackId}"]`
          : '#inventory-chessboard-title';
        preserveOperationalViewport(paint, focusBoard ? focus : null);
      }
    }
  }

  async function switchOperationalMode(nextMode) {
    const operational = state.operationalDesk;
    if (!['table', 'chessboard'].includes(nextMode) || nextMode === operational.mode) {
      return false;
    }
    const contextToken = beginOperationalContextGeneration();
    const destinationSequence = nextMode === 'chessboard'
      ? ++operationalBoardSequence : ++operationalTableSequence;
    const sections = operational.table?.filter_options?.sections || [];
    const selectedSection = operational.selectedUnitSectionId;
    const filteredSection = sectionFromFilters(operational.filters, sections);
    const priorBoardSection = sections.find((item) => (
      String(item.id) === String(operational.sectionId)
    ))?.id;
    const sectionId = filteredSection || priorBoardSection
      || selectedSection || sections[0]?.id || null;
    const candidateFilters = nextMode === 'chessboard'
      ? filtersForBuildingBoard(operational.filters)
      : operational.filters;
    const stillCurrent = () => operationalContextStillWins(contextToken);
    if (nextMode === 'chessboard') operational.boardLoading = true;
    else operational.loading = true;
    operational.error = null;
    operational.boardError = null;
    try {
      if (nextMode === 'chessboard') {
        if (!sections.length) {
          throw new ApiError('inventory_chessboard_layout_unavailable');
        }
        const sectionBoards = await inventoryProjectBuildingChessboard(
          operational.projectId, sections, {
            inventoryVersionId: operational.inventoryVersionId,
            filters: candidateFilters,
            asOfUtc: operational.asOfUtc,
            algorithm: state.operationalDesk.algorithm,
          },
        );
        const board = composeOperationalBuildingBoard(
          sectionBoards, sectionId, operational.filters,
        );
        if (destinationSequence !== operationalBoardSequence || !stillCurrent()) return false;
        if (!board) throw new ApiError('inventory_chessboard_layout_unavailable');
        const realCells = operationalBoardUnitEntries(board);
        const priorFocus = operational.boardFocus && realCells.find((entry) => (
          String(entry.sectionId) === String(operational.boardFocus.sectionId)
          && String(entry.floorId) === String(operational.boardFocus.floorId)
          && String(entry.stackId) === String(operational.boardFocus.stackId)
        ));
        const selectedCell = realCells.find((entry) => (
          String(entry.cell.unit?.unit_id) === String(operational.selectedUnitId)
        ));
        const target = priorFocus || selectedCell || realCells[0] || null;
        Object.assign(operational, {
          mode: 'chessboard',
          filters: candidateFilters,
          sectionId: board.sections?.[0]?.section?.section_id ?? sectionId,
          board,
          boardFocus: target ? {
            sectionId: target.sectionId,
            floorId: target.floorId,
            stackId: target.stackId,
            unitId: target.cell.unit?.unit_id,
          } : null,
          boardLoading: false,
          error: null,
          boardError: null,
        });
        const focus = target
          ? `[data-chessboard-focus-key="${target.sectionId}:${target.floorId}:${target.stackId}"]`
          : '#inventory-chessboard-title';
        preserveOperationalViewport(paint, focus);
      } else {
        const table = await inventoryProjectUnits(operational.projectId, {
          inventoryVersionId: operational.inventoryVersionId,
          filters: candidateFilters,
          sort: operational.sort,
          direction: operational.direction,
          page: 1,
          pageSize: operational.pageSize,
          asOfUtc: operational.asOfUtc,
          algorithm: state.operationalDesk.algorithm,
        });
        if (destinationSequence !== operationalTableSequence || !stillCurrent()) return false;
        Object.assign(operational, {
          mode: 'table',
          filters: candidateFilters,
          page: 1,
          table,
          loading: false,
          error: null,
          boardError: null,
        });
        preserveOperationalViewport(paint, '#inventory-table-title');
      }
      return true;
    } catch (err) {
      if ((nextMode === 'chessboard' && destinationSequence !== operationalBoardSequence)
        || (nextMode === 'table' && destinationSequence !== operationalTableSequence)
        || !stillCurrent()) return false;
      operational.loading = false;
      operational.boardLoading = false;
      operational.error = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
        retryMode: nextMode,
      };
      operational.boardError = null;
      const focus = operational.mode === 'chessboard'
        ? '#inventory-chessboard-title' : '#inventory-table-title';
      preserveOperationalViewport(paint, focus);
      return false;
    } finally {
      if (stillCurrent()) {
        operational.loading = false;
        operational.boardLoading = false;
      }
    }
  }

  async function loadOperationalDetail(
    unitId, historyOffset = 0, origin = null, placement = null,
  ) {
    if (unitId == null) return;
    const operational = state.operationalDesk;
    const contextToken = {
      generation: operationalContextGeneration,
      session: sessionGeneration,
      projectId: operational.projectId,
      inventoryVersionId: operational.inventoryVersionId,
      mode: operational.mode,
    };
    const sequence = ++operationalDetailSequence;
    operational.selectedUnitId = unitId;
    operational.detailOriginMode = origin || operational.mode;
    if (origin === 'chessboard') {
      operational.selectedUnitSectionId = placement?.sectionId ?? operational.sectionId;
      if (placement) {
        operational.boardFocus = {
          sectionId: placement.sectionId,
          floorId: placement.floorId,
          stackId: placement.stackId,
          unitId,
        };
      }
    } else if (origin === 'table') {
      const selectedRow = (operational.table?.items || []).find(
        (item) => String(item.unit_id) === String(unitId),
      );
      if (selectedRow?.hierarchy?.section_id != null) {
        operational.selectedUnitSectionId = selectedRow.hierarchy.section_id;
      }
    }
    operational.detailUnitId = unitId;
    operational.historyOffset = historyOffset;
    operational.detailLoading = true;
    operational.detailError = null;
    preserveOperationalViewport(paint, '#inventory-detail-title');
    try {
      const detail = await inventoryProjectUnitDetail(
        operational.projectId,
        unitId,
        {
          inventoryVersionId: operational.inventoryVersionId,
          historyLimit: 100,
          historyOffset,
          asOfUtc: operational.asOfUtc,
          algorithm: state.operationalDesk.algorithm,
        },
      );
      if (sequence !== operationalDetailSequence
        || !operationalContextStillWins(contextToken)
        || String(operational.detailUnitId) !== String(unitId)) return;
      operational.detail = detail;
      operational.detailError = null;
      if (detail.hierarchy?.section_id != null) {
        operational.selectedUnitSectionId = detail.hierarchy.section_id;
      }
      if (detail.context?.version_changed && operational.table) {
        const drift = detail.context;
        operational.table = {
          ...operational.table,
          context: {
            ...(operational.table.context || {}),
            version_changed: true,
            version_state: 'historical',
            is_current: false,
            active_inventory_version_id: drift.active_inventory_version_id,
            active_inventory_version_sequence: drift.active_inventory_version_sequence,
            active_version_key: drift.active_version_key,
            active_source_as_of_utc: drift.active_source_as_of_utc,
            active_activated_at_utc: drift.active_activated_at_utc,
            version_change: drift.version_change,
          },
        };
        if (operational.board) {
          operational.board = {
            ...operational.board,
            context: {
              ...(operational.board.context || {}),
              version_changed: true,
              version_state: 'historical',
              is_current: false,
              active_inventory_version_id: drift.active_inventory_version_id,
              active_inventory_version_sequence: drift.active_inventory_version_sequence,
              active_version_key: drift.active_version_key,
              active_source_as_of_utc: drift.active_source_as_of_utc,
              active_activated_at_utc: drift.active_activated_at_utc,
              version_change: drift.version_change,
            },
          };
        }
      }
    } catch (err) {
      if (sequence !== operationalDetailSequence
        || !operationalContextStillWins(contextToken)
        || String(operational.detailUnitId) !== String(unitId)) return;
      operational.detailError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
    } finally {
      if (sequence === operationalDetailSequence
        && operationalContextStillWins(contextToken)
        && String(operational.detailUnitId) === String(unitId)) {
        operational.detailLoading = false;
        preserveOperationalViewport(paint, '#inventory-detail-title');
      }
    }
  }

  function closeOperationalDetail() {
    const operational = state.operationalDesk;
    const unitId = state.operationalDesk.detailUnitId;
    const placement = state.operationalDesk.boardFocus;
    invalidateOperationalDetail();
    preserveOperationalViewport(paint);
    const boardMode = operational.mode === 'chessboard';
    const exactPlacement = boardMode && placement
      ? root.querySelector(`[data-chessboard-focus-key="${placement.sectionId}:${
        placement.floorId}:${placement.stackId}"]`)
      : null;
    const unit = unitId == null ? null : root.querySelector(
      boardMode
        ? `[data-chessboard-unit="${unitId}"]`
        : `[data-inventory-unit="${unitId}"]`,
    );
    const target = exactPlacement || unit || root.querySelector(
      boardMode ? '#inventory-chessboard-title' : '#inventory-table-title',
    );
    if (target && typeof target.focus === 'function') target.focus();
  }

  function handleChessboardKey(event, target) {
    const board = state.operationalDesk.board;
    if (!board) return false;
    const sectionId = target.getAttribute('data-chessboard-section');
    const floorId = target.getAttribute('data-chessboard-floor');
    const floorNumber = Number(target.getAttribute('data-chessboard-floor-number'));
    const stackId = target.getAttribute('data-chessboard-stack');
    const unitId = target.getAttribute('data-chessboard-unit');
    if (event.key === 'Enter') {
      event.preventDefault();
      loadOperationalDetail(unitId, 0, 'chessboard', {
        sectionId, floorId, stackId,
      });
      return true;
    }
    const navigation = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!navigation.includes(event.key)) return false;
    event.preventDefault();
    const ordered = operationalBoardUnitEntries(board);
    const current = ordered.find((entry) => (
      String(entry.sectionId) === String(sectionId)
      && String(entry.floorId) === String(floorId)
      && String(entry.stackId) === String(stackId)
    ));
    if (!current || Number(current.floorNumber) !== floorNumber) return false;
    let candidates = [];
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      candidates = ordered.filter((item) => item.row === current.row && (
        event.key === 'ArrowLeft' ? item.column < current.column : item.column > current.column
      )).sort((a, b) => (
        event.key === 'ArrowLeft' ? b.column - a.column : a.column - b.column
      ));
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      candidates = ordered.filter((item) => (
        String(item.sectionId) === String(current.sectionId)
        && item.column === current.column
        && (event.key === 'ArrowUp' ? item.row < current.row : item.row > current.row)
      )).sort((a, b) => (
        event.key === 'ArrowUp' ? b.row - a.row : a.row - b.row
      ));
    } else if (event.ctrlKey) {
      candidates = [...ordered].sort((a, b) => (
        event.key === 'Home'
          ? (a.row - b.row || a.column - b.column)
          : (b.row - a.row || b.column - a.column)
      ));
    } else {
      candidates = ordered.filter((item) => item.row === current.row).sort((a, b) => (
        event.key === 'Home' ? a.column - b.column : b.column - a.column
      ));
    }
    const destination = candidates[0];
    if (!destination) {
      if (typeof target.focus === 'function') target.focus();
      return true;
    }
    state.operationalDesk.boardFocus = {
      sectionId: destination.sectionId,
      floorId: destination.floorId,
      stackId: destination.stackId,
      unitId: destination.cell.unit?.unit_id,
    };
    const next = root.querySelector(
      `[data-chessboard-focus-key="${destination.sectionId}:${
        destination.floorId}:${destination.stackId}"]`,
    );
    if (next && typeof next.focus === 'function') next.focus();
    return true;
  }

  async function refreshOperationalVersion() {
    if (state.surface !== 'desk') {
      const generation = sessionGeneration;
      const sequence = ++operationalDiscoverySequence;
      const operational = state.operationalDesk;
      beginOperationalContextGeneration();
      operational.surfaceLoading = true;
      operational.surfaceError = null;
      paint();
      try {
        const payload = await activeInventory();
        if (generation !== sessionGeneration || sequence !== operationalDiscoverySequence
          || !state.authed || state.surface === 'desk') return false;
        const projects = payload.items || [];
        const selected = projects.find(
          (item) => String(item.project_id) === String(operational.projectId),
        ) || projects[0];
        if (!selected) {
          state.operationalDesk = {
            ...emptyOperationalDeskState(), enabled: true,
            projects, noActiveVersion: true,
            capabilities: payload.capabilities || operational.capabilities || {},
          };
          paint();
          return false;
        }
        Object.assign(operational, {
          projects,
          capabilities: payload.capabilities || operational.capabilities || {},
          projectId: selected.project_id,
          inventoryVersionId: selected.id,
          asOfUtc: selected.source_as_of_utc,
          mode: 'table',
          filters: defaultInventoryFilters(),
          page: 1,
          surfaceProjection: null,
          dealTermsError: null,
          surfaceLoading: false,
          surfaceError: null,
          table: null,
          board: null,
          boardLoading: false,
          boardError: null,
          boardFocus: null,
          sectionId: null,
          selectedUnitId: null,
          selectedUnitSectionId: null,
          detail: null,
          detailUnitId: null,
          detailLoading: false,
          detailError: null,
          detailOriginMode: null,
          historyOffset: 0,
          snapshots: [],
          snapshotOffset: 0,
          snapshotPagination: null,
          snapshotResultOffset: 0,
          snapshotLoading: false,
          snapshotError: null,
          inspectedSnapshot: null,
          decisionError: null,
          error: null,
          filterError: null,
          noActiveVersion: false,
        });
        return loadCurrentOperationalSurface({ focus: true });
      } catch (err) {
        if (generation !== sessionGeneration || sequence !== operationalDiscoverySequence) {
          return false;
        }
        operational.surfaceLoading = false;
        operational.surfaceError = {
          key: err instanceof ApiError ? err.key : 'x_internal_error',
          params: err instanceof ApiError ? err.params : {},
        };
        paint();
        return false;
      }
    }
    const contextToken = beginOperationalContextGeneration();
    const sequence = ++operationalDiscoverySequence;
    const operational = state.operationalDesk;
    operationalTableSequence += 1;
    operationalBoardSequence += 1;
    operationalDetailSequence += 1;
    const detailIntentSequence = operationalDetailSequence;
    const selectedUnitIntent = operational.selectedUnitId;
    const selectedSectionIntent = operational.selectedUnitSectionId;
    const detailUnitIntent = operational.detailUnitId;
    const historyOffsetIntent = operational.historyOffset;
    operational.loading = true;
    if (operational.mode === 'chessboard') operational.boardLoading = true;
    operational.error = null;
    preserveOperationalViewport(paint);
    const stillCurrent = () => (
      sequence === operationalDiscoverySequence
      && operationalContextStillWins(contextToken)
    );
    const selectionStillCurrent = () => (
      operationalDetailSequence === detailIntentSequence
      && String(operational.selectedUnitId) === String(selectedUnitIntent)
      && String(operational.detailUnitId) === String(detailUnitIntent)
    );
    try {
      const payload = await activeInventory();
      if (!stillCurrent()) return false;
      const projects = payload.items || [];
      const selected = projects.find(
        (item) => String(item.project_id) === String(operational.projectId),
      );
      if (!selected) {
        if (projects.length) return switchOperationalProject(projects[0]);
        state.operationalDesk = {
          ...emptyOperationalDeskState(), enabled: true, noActiveVersion: true,
          capabilities: payload.capabilities || operational.capabilities || {},
        };
        paint();
        return false;
      }
      const candidate = {
        projectId: operational.projectId,
        inventoryVersionId: selected.id,
        asOfUtc: selected.source_as_of_utc,
        filters: { ...operational.filters },
        sort: operational.sort,
        direction: operational.direction,
        page: 1,
        pageSize: operational.pageSize,
      };
      const readTable = () => inventoryProjectUnits(candidate.projectId, {
        inventoryVersionId: candidate.inventoryVersionId,
        filters: candidate.filters,
        sort: candidate.sort,
        direction: candidate.direction,
        page: candidate.page,
        pageSize: candidate.pageSize,
        asOfUtc: candidate.asOfUtc,
        algorithm: state.operationalDesk.algorithm,
      });
      let table = await readTable();
      if (!stillCurrent()) return false;
      const sections = table.filter_options?.sections || [];
      const validSection = (sectionId) => sections.find(
        (item) => String(item.id) === String(sectionId),
      )?.id ?? null;
      let sectionId = validSection(operational.sectionId)
        || validSection(operational.selectedUnitSectionId)
        || sectionFromFilters(candidate.filters, sections)
        || sections[0]?.id
        || null;
      let board = operational.mode === 'chessboard' ? operational.board : null;
      if (operational.mode === 'chessboard') {
        if (sectionId == null) throw new ApiError('inventory_chessboard_layout_unavailable');
        candidate.filters = filtersForBuildingBoard(candidate.filters);
        table = await readTable();
        if (!stillCurrent()) return false;
        board = composeOperationalBuildingBoard(await inventoryProjectBuildingChessboard(
          candidate.projectId, sections, {
            inventoryVersionId: candidate.inventoryVersionId,
            filters: candidate.filters,
            asOfUtc: candidate.asOfUtc,
            algorithm: state.operationalDesk.algorithm,
          },
        ), sectionId, candidate.filters);
        if (!stillCurrent()) return false;
      }
      let detail = operational.detail;
      let detailUnitId = operational.detailUnitId;
      let historyOffset = operational.historyOffset;
      let detailOriginMode = operational.detailOriginMode;
      let removedSelection = false;
      const selectionProbeId = detailUnitIntent ?? selectedUnitIntent;
      let selectedUnitProbe = null;
      if (selectionProbeId != null) {
        try {
          selectedUnitProbe = await inventoryProjectUnitDetail(
            candidate.projectId,
            selectionProbeId,
            {
              inventoryVersionId: candidate.inventoryVersionId,
              historyLimit: 100,
              historyOffset: detailUnitIntent == null ? 0 : historyOffsetIntent,
              asOfUtc: candidate.asOfUtc,
              algorithm: state.operationalDesk.algorithm,
            },
          );
          if (detailUnitIntent != null) detail = selectedUnitProbe;
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) throw err;
          detail = null;
          detailUnitId = null;
          historyOffset = 0;
          detailOriginMode = null;
          removedSelection = true;
        }
        if (!stillCurrent() || !selectionStillCurrent()) return false;
      }
      if (!selectionStillCurrent()) return false;
      const selectedSectionId = removedSelection ? null : (
        validSection(selectedUnitProbe?.hierarchy?.section_id)
        ?? validSection(selectedSectionIntent)
      );
      const realCells = operationalBoardUnitEntries(board);
      const priorFocus = operational.boardFocus && realCells.find((entry) => (
        String(entry.sectionId) === String(operational.boardFocus.sectionId)
        && String(entry.floorId) === String(operational.boardFocus.floorId)
        && String(entry.stackId) === String(operational.boardFocus.stackId)
      ));
      const selectedCell = realCells.find((entry) => (
        String(entry.cell.unit?.unit_id) === String(selectedUnitIntent)
      ));
      const focusCell = priorFocus || selectedCell || realCells[0] || null;
      Object.assign(operational, {
        projects: payload.items || [],
        capabilities: payload.capabilities || operational.capabilities || {},
        inventoryVersionId: candidate.inventoryVersionId,
        asOfUtc: candidate.asOfUtc,
        filters: candidate.filters,
        page: 1,
        table,
        sectionId,
        board,
        detail,
        detailUnitId,
        historyOffset,
        detailOriginMode,
        selectedUnitSectionId: selectedSectionId,
        selectedUnitId: removedSelection || selectedSectionId == null
          ? null : selectedUnitIntent,
        boardFocus: focusCell ? {
          sectionId: focusCell.sectionId,
          floorId: focusCell.floorId,
          stackId: focusCell.stackId,
          unitId: focusCell.cell.unit?.unit_id,
        } : null,
        error: null,
        boardError: null,
        detailError: null,
      });
      operational.loading = false;
      operational.boardLoading = false;
      const selector = operational.mode === 'chessboard'
        ? '#inventory-chessboard-title' : '#inventory-table-title';
      preserveOperationalViewport(paint, selector);
      return true;
    } catch (err) {
      if (!stillCurrent()) return false;
      operational.error = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
      if (operational.mode === 'chessboard') {
        operational.boardError = {
          ...operational.error,
          refresh: true,
        };
      }
      return false;
    } finally {
      if (stillCurrent()) {
        operational.loading = false;
        operational.boardLoading = false;
        if (selectionStillCurrent()) {
          const selector = operational.mode === 'chessboard'
            ? '#inventory-chessboard-title' : '#inventory-table-title';
          preserveOperationalViewport(paint, selector);
        } else {
          preserveOperationalViewport(paint);
        }
      }
    }
  }

  async function switchOperationalProject(selected) {
    const operational = state.operationalDesk;
    if (state.surface !== 'desk') {
      beginOperationalContextGeneration();
      operationalSurfaceSequence += 1;
      operationalTableSequence += 1;
      operationalBoardSequence += 1;
      Object.assign(operational, {
        projectId: selected.project_id,
        inventoryVersionId: selected.id,
        asOfUtc: selected.source_as_of_utc,
        mode: 'table',
        filters: defaultInventoryFilters(),
        page: 1,
        table: null,
        board: null,
        boardLoading: false,
        boardError: null,
        boardFocus: null,
        sectionId: null,
        selectedUnitId: null,
        selectedUnitSectionId: null,
        detailUnitId: null,
        detail: null,
        detailLoading: false,
        detailError: null,
        detailOriginMode: null,
        historyOffset: 0,
        snapshots: [],
        snapshotOffset: 0,
        snapshotPagination: null,
        snapshotResultOffset: 0,
        snapshotLoading: false,
        snapshotError: null,
        inspectedSnapshot: null,
        surfaceProjection: null,
        dealTermsError: null,
        surfaceLoading: false,
        surfaceError: null,
        filterError: null,
        error: null,
      });
      paint();
      return loadCurrentOperationalSurface({ focus: true });
    }
    operational.mode = 'table';
    const contextToken = beginOperationalContextGeneration();
    operationalTableSequence += 1;
    operationalBoardSequence += 1;
    operationalDetailSequence += 1;
    const candidate = {
      projectId: selected.project_id,
      inventoryVersionId: selected.id,
      asOfUtc: selected.source_as_of_utc,
      filters: withoutFields(
        operational.filters,
        ['phase', 'building', 'section', 'floor',
          'phase_id', 'building_id', 'section_id', 'floor_id'],
      ),
      sort: operational.sort,
      direction: operational.direction,
      page: 1,
      pageSize: operational.pageSize,
    };
    operational.loading = true;
    operational.error = null;
    operational.boardError = null;
    preserveOperationalViewport(paint);
    const stillCurrent = () => operationalContextStillWins(contextToken);
    try {
      const readTable = () => inventoryProjectUnits(candidate.projectId, {
        inventoryVersionId: candidate.inventoryVersionId,
        filters: candidate.filters,
        sort: candidate.sort,
        direction: candidate.direction,
        page: candidate.page,
        pageSize: candidate.pageSize,
        asOfUtc: candidate.asOfUtc,
        algorithm: state.operationalDesk.algorithm,
      });
      let table = await readTable();
      if (!stillCurrent()) return false;
      const sections = table.filter_options?.sections || [];
      let sectionId = sectionFromFilters(candidate.filters, sections)
        || sections[0]?.id || null;
      let board = null;
      const priorSection = sections.find((item) => (
        String(item.id) === String(operational.sectionId)
      ))?.id;
      sectionId = priorSection || sectionId;
      const realCells = operationalBoardUnitEntries(board);
      const focusCell = realCells[0] || null;
      Object.assign(operational, {
        projectId: candidate.projectId,
        inventoryVersionId: candidate.inventoryVersionId,
        asOfUtc: candidate.asOfUtc,
        mode: 'table',
        filters: candidate.filters,
        page: 1,
        table,
        sectionId,
        board,
        boardFocus: focusCell ? {
          sectionId: focusCell.sectionId,
          floorId: focusCell.floorId,
          stackId: focusCell.stackId,
          unitId: focusCell.cell.unit?.unit_id,
        } : null,
        selectedUnitId: null,
        selectedUnitSectionId: null,
        snapshots: [],
        snapshotOffset: 0,
        snapshotPagination: null,
        snapshotResultOffset: 0,
        inspectedSnapshot: null,
        snapshotError: null,
        snapshotBusy: false,
        snapshotIntentId: null,
        detailOriginMode: null,
        detailUnitId: null,
        detail: null,
        detailError: null,
        historyOffset: 0,
        surfaceProjection: null,
        dealTermsError: null,
        surfaceLoading: false,
        surfaceError: null,
        loading: false,
        boardLoading: false,
        error: null,
        boardError: null,
      });
      loadOperationalSnapshots();
      preserveOperationalViewport(paint, '#inventory-table-title');
      return true;
    } catch (err) {
      if (!stillCurrent()) return false;
      const failure = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
        retryProjectId: selected.project_id,
      };
      operational.error = failure;
      return false;
    } finally {
      if (stillCurrent()) {
        operational.loading = false;
        operational.boardLoading = false;
        preserveOperationalViewport(paint, '#inventory-table-title');
      }
    }
  }

  async function resumeCreatedProjectResult() {
    const operational = state.operationalDesk;
    const pending = operational.pendingCreatedResult;
    if (!pending || state.screen !== 'shell' || state.surface !== 'desk' || operational.error
      || String(operational.projectId) !== String(pending.projectId)
      || String(operational.inventoryVersionId) !== String(pending.versionId)
      || operational.asOfUtc !== pending.asOfUtc) return;
    await inspectOperationalSnapshot(pending.snapshotId);
    if (state.operationalDesk === operational && !operational.snapshotError
      && String(operational.inspectedSnapshot?.snapshot?.id) === String(pending.snapshotId)) {
      operational.pendingCreatedResult = null;
    }
  }

  async function retryOperationalDiscovery() {
    const generation = sessionGeneration;
    const sequence = ++operationalDiscoverySequence;
    state.operationalDesk.enabled = true;
    state.operationalDesk.loading = true;
    state.operationalDesk.noActiveVersion = false;
    state.operationalDesk.error = null;
    paint();
    try {
      const payload = await activeInventory();
      if (generation !== sessionGeneration
        || sequence !== operationalDiscoverySequence
        || !state.authed || !OPERATIONAL_SURFACES.has(state.surface)) return;
      if (!configureOperationalProjects(payload || {})) {
        paint();
        root.querySelector('#inventory-desk-title')?.focus();
        return;
      }
      await loadCurrentOperationalSurface({ focus: true });
      if (generation === sessionGeneration && sequence === operationalDiscoverySequence) {
        await resumeCreatedProjectResult();
      }
    } catch (err) {
      if (generation !== sessionGeneration
        || sequence !== operationalDiscoverySequence
        || !state.authed || !OPERATIONAL_SURFACES.has(state.surface)) return;
      state.operationalDesk.loading = false;
      state.operationalDesk.error = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
      paint();
      root.querySelector('button[data-retry-operational-discovery]')?.focus();
    }
  }

  function reviewOptions(offset) {
    return {
      severity: state.dataState.severity,
      ...state.dataState.issueFilters,
      limit: 50,
      offset,
    };
  }

  function scheduleReviewPoll(batch) {
    if (reviewPollTimer !== null) cancelTimeout(reviewPollTimer);
    reviewPollTimer = null;
    if (!batch || !['uploaded', 'parsing'].includes(batch.status)) {
      state.dataState.pollAttempts = 0;
      return;
    }
    if (state.dataState.pollAttempts >= MAX_IMPORT_POLL_ATTEMPTS) {
      state.dataState.error = { key: 'import_poll_timeout', params: {} };
      return;
    }
    state.dataState.pollAttempts += 1;
    if (batch) {
      reviewPollTimer = scheduleTimeout(() => {
        reviewPollTimer = null;
        loadImportReview(batch.id, state.dataState.issueOffset);
      }, 1000);
    }
  }

  function cancelReviewPoll() {
    if (reviewPollTimer !== null) cancelTimeout(reviewPollTimer);
    reviewPollTimer = null;
  }

  async function loadImportReview(batchId, offset = 0) {
    const sequence = ++reviewRequestSequence;
    try {
      const selected = await importReview(batchId, reviewOptions(offset));
      if (sequence !== reviewRequestSequence) return;
      state.dataState.selected = selected;
      state.dataState.issueOffset = offset;
      state.dataState.error = null;
      scheduleReviewPoll(selected);
    } catch (err) {
      if (sequence !== reviewRequestSequence) return;
      state.dataState.error = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
      scheduleReviewPoll(state.dataState.selected);
    }
    if (sequence === reviewRequestSequence) paint();
  }

  function focusDataHeading(selector) {
    const heading = root.querySelector(selector);
    if (heading && typeof heading.focus === 'function') heading.focus();
  }

  // Scroll the content area (and the window) to the top — every tab switch resets
  // the scroll position (UX-DR18).
  function scrollContentTop() {
    const content = root.querySelector('#content');
    if (content) {
      content.scrollTop = 0;
    }
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo(0, 0);
    }
  }

  // Product navigation stays inside the operational project routes — the frozen
  // prototype's own project tab set. Anything outside it (the portfolio id, a
  // stale or injected route) fails closed to Today, and no route here can select
  // `/api/view/*`.
  async function loadSurface(requestedSurface) {
    if (!state.authed) return;
    const generation = sessionGeneration;
    const surface = OPERATIONAL_SURFACES.has(requestedSurface)
      ? requestedSurface : FIRST_TAB;
    state.surface = surface;
    state.surfaceData = null;
    state.roleMenuOpen = false;
    if (state.operationalDesk.enabled && state.operationalDesk.projects.length) {
      operationalSurfaceSequence += 1;
      paint();
      scrollContentTop();
      await loadCurrentOperationalSurface();
      return;
    }
    const priorProjectId = state.operationalDesk.projectId;
    const requiredVersionId = state.operationalDesk.requiredVersionId;
    const pendingCreatedResult = state.operationalDesk.pendingCreatedResult;
    clearOperationalDeskState();
    state.operationalDesk = {
      ...emptyOperationalDeskState(),
      enabled: true,
      loading: true,
      projectId: priorProjectId,
      requiredVersionId,
      pendingCreatedResult,
    };
    paint();
    scrollContentTop();
    const discoverySequence = ++operationalDiscoverySequence;
    try {
      const payload = await activeInventory();
      if (generation !== sessionGeneration || !state.authed
        || discoverySequence !== operationalDiscoverySequence
        || state.surface !== surface) return;
      if (configureOperationalProjects(payload || {})) {
        paint();
        await loadCurrentOperationalSurface();
      } else {
        paint();
      }
    } catch (err) {
      if (generation !== sessionGeneration || !state.authed
        || discoverySequence !== operationalDiscoverySequence
        || state.surface !== surface) return;
      state.operationalDesk.enabled = true;
      state.operationalDesk.loading = false;
      state.operationalDesk.noActiveVersion = false;
      state.operationalDesk.error = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
        params: err instanceof ApiError ? err.params : {},
      };
      paint();
      root.querySelector('button[data-retry-operational-discovery]')?.focus();
    }
  }

  // --- live what-if recalculation (UX-DR5, Task 4) --------------------------
  //
  // A what-if control change updates exactly one field of the session-local
  // term-set and fires exactly one view refresh. The client never re-derives a
  // price — it re-submits the whole term-set and adopts the server-resolved
  // effective set (AR-2). Discrete controls (select, checkbox, segment pill) fire
  // immediately; sliders debounce their `input` burst to one trailing refresh
  // (SLIDER_DEBOUNCE_MS). The per-tab sequence token in view() makes the last call
  // win, so a stale response can never overwrite a newer render (AR-15).

  // Update one term-set field from a control's raw value (see termFromControl).
  // --- «Условия сделки» (deal-price surface) ---------------------------------
  //
  // Every control on «Цена сделки» writes the acting user's own retained terms.
  // The client patches the held block so the control reads back at once, then
  // submits; the server clamps, resolves and re-prices, and its answer replaces
  // the block wholesale — so a value the server refused never survives on screen
  // (AR-7: the client computes no price of its own).

  let dealTermsTimer = null;
  let dealTermsSequence = 0;
  // A save repaints the shell, which replaces the very `<input>` the pointer is
  // holding — and an element torn out mid-gesture takes the browser's implicit
  // pointer capture with it, so the rest of the drag moves nothing. While a
  // range control is held, nothing is written and nothing is repainted: the
  // read-out still follows the thumb live, and the value commits once on release.
  let dealTermsDragging = false;
  let dealTermsRepaintPending = false;

  function heldDealTerms() {
    return state.operationalDesk?.surfaceProjection?.deal_price?.deal_terms || null;
  }

  // Patch one term into the held block. Returns false for an unknown control so
  // the delegation can fall through untouched.
  function updateDealTerm(term, rawValue) {
    const block = heldDealTerms();
    if (!block || !block.terms) return false;
    if (term === 'group_id' || term === 'payment_plan_id') {
      block.terms[term] = rawValue;
      return true;
    }
    // A share slider carries percent; the contract carries a 1e9-scaled share.
    const scaled = Math.round(Number(rawValue) * 1e7);
    if (!Number.isFinite(scaled)) return false;
    if (term === 'cut') {
      block.terms.cut_scaled = scaled;
      if (block.cut) block.cut.value_scaled = String(scaled);
      return true;
    }
    if (term === 'discount_rate') {
      block.terms.discount_rate_scaled = scaled;
      if (block.rate) block.rate.value_scaled = String(scaled);
      return true;
    }
    return false;
  }

  function updateDealLever(flag, checked, magnitude) {
    const block = heldDealTerms();
    if (!block || !block.terms) return false;
    const levers = { ...(block.terms.levers || {}) };
    if (checked) levers[flag] = magnitude;
    else delete levers[flag];
    block.terms.levers = levers;
    const row = (block.levers || []).find((item) => item.flag === flag);
    if (row) row.on = checked;
    return true;
  }

  // Keep a dragging slider's read-out live without a repaint: the surrounding
  // `.sl` row and the rate strip each carry exactly one `<b>`.
  function syncDealReadout(input, rawValue) {
    const readout = input.closest('.sl')?.querySelector('b');
    if (readout) readout.textContent = pct(Number(rawValue) / 100, state.lang, 1);
  }

  async function saveDealTermsNow() {
    const operational = state.operationalDesk;
    const block = heldDealTerms();
    if (!block || !operational?.enabled || operational.projectId == null
      || operational.inventoryVersionId == null) return;
    const sequence = ++dealTermsSequence;
    const generation = sessionGeneration;
    const projectAtStart = operational.projectId;
    const versionAtStart = operational.inventoryVersionId;
    const isCurrent = () => sequence === dealTermsSequence
      && generation === sessionGeneration && state.authed
      && String(state.operationalDesk.projectId) === String(projectAtStart)
      && String(state.operationalDesk.inventoryVersionId) === String(versionAtStart);
    try {
      const response = await saveDealTerms(projectAtStart, {
        inventoryVersionId: versionAtStart,
        asOfUtc: operational.asOfUtc,
        groupId: block.terms.group_id,
        paymentPlanId: block.terms.payment_plan_id,
        cutScaled: block.terms.cut_scaled,
        discountRateScaled: block.terms.discount_rate_scaled,
        levers: block.terms.levers || {},
      });
      if (!isCurrent()) return;
      const projection = state.operationalDesk.surfaceProjection;
      if (projection?.deal_price && response?.deal_terms) {
        projection.deal_price.deal_terms = response.deal_terms;
      }
      state.operationalDesk.dealTermsError = null;
    } catch (err) {
      if (!isCurrent()) return;
      state.operationalDesk.dealTermsError = {
        key: err instanceof ApiError ? err.key : 'x_internal_error',
      };
    } finally {
      if (isCurrent()) {
        if (dealTermsDragging) {
          // Repainting now would tear the held control out of the user's hand.
          dealTermsRepaintPending = true;
          return;
        }
        // The repaint rebuilds the controls, so hand focus back to the one the
        // user is still working in.
        const active = root.querySelector('#content')?.contains(document.activeElement)
          ? document.activeElement : null;
        const focusTerm = active?.getAttribute?.('data-deal-term');
        const focusLever = active?.getAttribute?.('data-deal-lever');
        preserveOperationalViewport(paint, focusTerm
          ? `[data-deal-term="${focusTerm}"]`
          : focusLever ? `[data-deal-lever="${focusLever}"]` : null);
      }
    }
  }

  // Discrete controls submit at once; a dragging slider collapses its burst into
  // one write, the same trailing debounce every other continuous control uses.
  function scheduleDealTermsSave(debounce) {
    if (dealTermsTimer) {
      clearTimeout(dealTermsTimer);
      dealTermsTimer = null;
    }
    // A held slider commits on release, not on a timer: the held block already
    // carries every movement, so there is nothing to lose by waiting.
    if (dealTermsDragging) return;
    if (!debounce) {
      saveDealTermsNow();
      return;
    }
    dealTermsTimer = setTimeout(() => {
      dealTermsTimer = null;
      saveDealTermsNow();
    }, SLIDER_DEBOUNCE_MS);
  }

  // The pointer went down on a range control: hold every write and repaint until
  // it comes back up, wherever that happens (the pointer can leave the control,
  // and the window, before it is released).
  function beginDealTermsDrag() {
    if (dealTermsDragging) return;
    dealTermsDragging = true;
    if (dealTermsTimer) {
      clearTimeout(dealTermsTimer);
      dealTermsTimer = null;
    }
    const end = () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      endDealTermsDrag();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function endDealTermsDrag() {
    if (!dealTermsDragging) return;
    dealTermsDragging = false;
    if (dealTermsRepaintPending) {
      // A save that started before the drag landed while it was held.
      dealTermsRepaintPending = false;
      preserveOperationalViewport(paint);
    }
    saveDealTermsNow();
  }

  function updateTermFromControl(control, rawValue) {
    state.termSet = termFromControl(state.termSet, control, rawValue);
  }

  // Toggle one lever flag in the term-set's `levers` map (see leverToggle). The
  // on-magnitude comes from the payload the control was rendered from (the server
  // is the one source), read off the checkbox's `data-on-magnitude`.
  function updateLever(flag, checked, magnitude) {
    state.termSet = leverToggle(state.termSet, flag, checked, magnitude);
  }

  // Fire the single view refresh for the current surface (UX-DR7 loading dim,
  // AR-15 last-wins): dim past 300 ms, drop a stale/failed response (the banner is
  // rendered by refreshSurface), else adopt the server-resolved chrome + term-set
  // and repaint. Re-wiring happens in paint(), so the fresh controls are live again.
  async function recalcSurface() {
    if (state.surface === 'desk' || state.operationalDesk?.enabled) return;
    const generation = sessionGeneration;
    const content = root.querySelector('#content');
    const status = content ? content.querySelector('.status-slot') : null;
    // The adopt-and-repaint step, run on every fresh payload — the primary
    // refresh and a successful «Повторить» retry alike (the retry re-issues the
    // same refreshSurface call carrying this callback), so a restored surface
    // is always rendered rather than left under the error banner.
    await refreshSurface(
      state.surface,
      { content, status },
      state,
      state.termSet,
      (data) => {
        if (generation !== sessionGeneration || !state.authed) return;
        state.chrome = data.chrome;
        state.surfaceData = data.data;
        state.permissions = data.permissions;
        state.termSet = data.term_set; // adopt the server-resolved set (AR-2)
        paint();
      },
    );
  }

  // The single trailing-debounced slider refresh (UX-DR5): one instance for the
  // app's lifetime so a drag's burst of `input` events — spanning no repaint —
  // collapses to one refresh. Only the *refresh* is debounced; each `input` writes
  // its term-set field synchronously (in the wiring below), so two sliders moved
  // within one window both land — the debounce coalesces the network call, it never
  // decides which control's value survives. Discrete controls call recalcSurface()
  // directly.
  const onSliderInput = debounce(() => {
    recalcSurface();
  }, SLIDER_DEBOUNCE_MS);

  // --- the desk decision lifecycle (Story 4.2, UX-DR6/UX-DR9/AR-7) ----------
  //
  // Adopt a command's fresh post-commit desk payload and repaint — the re-render
  // comes from the server alone (AR-7): no optimistic client edit. The command note
  // slot is cleared by the re-render. The strategy switch instead re-loads the whole
  // surface so the entire console re-renders under the new strategy.

  // A single desk command runs at a time (the command analogue of the view fetch
  // loop's last-wins guard, AR-15). The pessimistic lifecycle disables only the
  // *invoking* control, so without this a second command fired from another live
  // control could put two responses in flight; an earlier one resolving after a
  // later one would repaint a payload missing the later committed action until the
  // next refresh. Serialising the commands removes the race at the source: while one
  // is in flight every command initiator is a no-op, so no stale payload can land.
  // The scope a desk command was fired under: the active surface, market and project.
  // A command acts on the surface the user is looking at, but its response lands after
  // a network round-trip — during which the user can switch tab / project / market
  // (those handlers are not blocked by `deskCommandInFlight`, which only serialises
  // commands against each other). A fresh *desk* payload adopted after such a switch
  // would paint the desk `data` into whatever surface is now active, corrupting or
  // crashing another renderer. Capturing the scope at fire time lets adoptDeskFresh
  // drop a payload that resolves after navigation — the command analogue of the view
  // fetch loop's last-wins guard (AR-15).
  function deskScope() {
    return { surface: state.surface, market: state.market, project: state.project };
  }

  function deskScopeCurrent(scope) {
    return (
      scope.surface === state.surface &&
      scope.market === state.market &&
      scope.project === state.project
    );
  }

  // Structural equality over two resolved term-sets (JSON-ish: numbers, strings, and
  // the nested `levers` map). Both operands are server-resolved sets — the command's
  // echoed `term_set` and the client's current `state.termSet`, each `{...defaults,
  // ...submitted}` from the same boundary — so a value compare answers "have the
  // what-if terms moved since this command resolved its target?" without the false
  // drops a reference compare would raise (every view load reassigns termSet to a new
  // object with the same values).
  function sameTermSet(a, b) {
    if (a === b) return true;
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
      return a === b;
    }
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameTermSet(a[k], b[k]));
  }

  function adoptDeskFresh(fresh, scope) {
    if (!state.authed) return;
    // Drop a payload whose command was fired under a scope the user has since left
    // (a tab / project / market switch mid-flight) — never paint desk data into
    // another surface (AR-15).
    if (scope && !deskScopeCurrent(scope)) {
      return;
    }
    // Drop a payload whose what-if terms the user has since changed. The command
    // recomputed and echoed the terms it rode at fire time; a what-if edit while it
    // was in flight — including a navigate-away, edit, navigate-back that lands on the
    // same Desk scope — has already painted the newer resolved set, so adopting this
    // stale echo would revert it. Scope equality alone misses a term change that keeps
    // the same surface/market/project; this is the command path's analogue of the view
    // loop's last-wins seq guard (AR-15).
    if (!sameTermSet(fresh.term_set, state.termSet)) {
      return;
    }
    state.chrome = fresh.chrome;
    state.surfaceData = fresh.data;
    state.permissions = fresh.permissions;
    state.termSet = fresh.term_set;
    paint();
  }

  // The manager's accept/decline of one unit (UX-DR6): the confirm modal, then the
  // pessimistic lifecycle (invokeDecision disables the control with a pending label,
  // nothing changes until the server confirms, the re-render is from the fresh payload).
  function onDecideUnit(unit, decision, controlEl) {
    if (deskCommandInFlight) return; // one command at a time (last-wins, see above)
    const note = root.querySelector('.cmd-note');
    // The confirm variant for a price-moving command carries the unit and its price
    // context (UX-DR9, the prototype's mo_appr_*/mo_decl_*), never a bare button label:
    // the per-area current price and — for an accept — the recomputed target, each
    // rendered with the market's price-per-area label exactly as the journal does.
    const accept = decision === 'accept';
    const rows = ((state.surfaceData || {}).table || {}).rows || [];
    // Show the price context of the row the *server* will decide. Ids may collide in the
    // seeded world, and the command resolves a same-id click to the first *decidable*
    // (pending) unit — never a same-id hold/manual/decided sibling that sorts first — so
    // the modal must match that same first-pending row, not the first row by id, or an
    // accept could preview a hold row's numbers while the server prices the pending one
    // (AR-7/UX-DR9). The `|| find(id)` keeps a defensive fallback.
    const same = (r) => String(r.id) === String(unit);
    const row = rows.find((r) => same(r) && r.pending) || rows.find(same) || {};
    const puf = (value) =>
      value == null ? '' : `${nf(value, state.lang, 0)} ${priceUnitLabel(state)}`.trim();
    const body = accept
      ? tf('mo_appr_b', state.lang, unit, puf(row.ppsf), puf(row.target))
      : tf('mo_decl_b', state.lang, unit, puf(row.ppsf));
    openConfirmModal(state, {
      titleKey: accept ? 'mo_appr_t' : 'mo_decl_t',
      body,
      confirmKey: 'w_confirm',
      onConfirm: () => {
        deskCommandInFlight = true;
        // Snapshot the scope at fire time so a payload resolving after the user has
        // navigated away is dropped rather than painted into the new surface (AR-15).
        const scope = deskScope();
        invokeDecision(
          controlEl,
          note,
          state,
          {
            unit,
            decision,
            market: state.market,
            project: state.project,
            // The shared what-if term-set rides along (AR-2) so the fresh payload
            // echoes it back rather than the catalog defaults — otherwise adopting
            // the response would wipe the session-local NEP/Shelf terms.
            termSet: state.termSet,
          },
          (fresh) => adoptDeskFresh(fresh, scope),
        ).finally(() => {
          deskCommandInFlight = false;
        });
      },
    });
  }

  // A director command (group approval / strategy switch) run through the confirm
  // modal, then the pessimistic lifecycle: the control disables in flight, the surface
  // re-renders only from the server's fresh payload (or a full reload for a strategy
  // switch), and a failure drops a danger note near the control (UX-DR7). Never a price.
  async function runDeskCommand(fn, body, controlEl, { reload } = {}) {
    const note = root.querySelector('.cmd-note');
    // Snapshot the scope this command fires under (synchronously, before the await):
    // a fresh non-reload payload resolving after the user navigates away is dropped
    // by adoptDeskFresh rather than painted into the new surface (AR-15). The reload
    // path re-loads whatever surface is now active through view()'s own last-wins.
    const scope = deskScope();
    // The pessimistic lifecycle (UX-DR6) applies to all four commands: disable the
    // invoking control and switch it to the pending label «На согласовании» while the
    // request is in flight, exactly as a unit decision does.
    const priorLabel = controlEl ? controlEl.textContent : null;
    if (controlEl) {
      controlEl.disabled = true;
      controlEl.classList.add('is-pending');
      controlEl.textContent = t('ap_pending', state.lang);
    }
    try {
      const fresh = await fn(body);
      if (!state.authed) return;
      if (reload) {
        loadSurface(state.surface); // the whole console re-renders (FR-36)
      } else {
        adoptDeskFresh(fresh, scope);
      }
    } catch (err) {
      const key = err instanceof ApiError ? err.key : 'x_internal_error';
      const params = err instanceof ApiError ? err.params : {};
      if (note) {
        note.replaceChildren(buildCommandFailure(key, params, state.lang));
      }
      if (controlEl) {
        // State unchanged (UX-DR7): re-enable the control and restore its label.
        controlEl.disabled = false;
        controlEl.classList.remove('is-pending');
        if (priorLabel != null) {
          controlEl.textContent = priorLabel;
        }
      }
    }
  }

  // The director's group approval: the confirm modal shows the recommendation count
  // (UX-DR9), then the same recompute-and-journal path as a single decision (FR-23).
  // `group` null → «Согласовать все».
  function onApproveGroup(group, count, controlEl) {
    if (deskCommandInFlight) return; // one command at a time (last-wins, see above)
    openConfirmModal(state, {
      titleKey: group ? 'cmd_group_approval' : 'ap_all',
      body: tp('cf_grp', state.lang, { count }),
      confirmKey: 'w_confirm',
      onConfirm: () => {
        deskCommandInFlight = true;
        runDeskCommand(
          groupApproval,
          {
            group,
            market: state.market,
            project: state.project,
            // Carry the session-local what-if terms so the fresh payload preserves
            // them rather than echoing the catalog defaults (AR-2).
            termSet: state.termSet,
          },
          controlEl,
        ).finally(() => {
          deskCommandInFlight = false;
        });
      },
    });
  }

  // The director's strategy switch (FR-36): «Сменить стратегию?» with the copy that the
  // change re-weights the whole org and that decided prices remain (cf_b), then the
  // command and a full re-render under the new strategy.
  function onStrategySwitch(strategy, controlEl) {
    if (deskCommandInFlight) return; // one command at a time (last-wins, see above)
    openConfirmModal(state, {
      titleKey: 'cf_t',
      body: tf('cf_b', state.lang, t(`sg_${strategy}`, state.lang)),
      confirmKey: 'cf_ok',
      onConfirm: () => {
        deskCommandInFlight = true;
        runDeskCommand(
          strategySwitch,
          { strategy, market: state.market, project: state.project },
          controlEl,
          { reload: true },
        ).finally(() => {
          deskCommandInFlight = false;
        });
      },
    });
  }

  // The manager's «Зафиксировать сценарий для комитета» (FR-20, Story 4.3): the
  // confirm modal («Зафиксировать сценарий для комитета» + the mo_save_b committee
  // copy), then the same pessimistic lifecycle as a desk command — the control
  // disables in flight, the surface re-renders only from the server's fresh «Релиз»
  // payload, and a failure drops a danger note near the control (UX-DR6/UX-DR7/UX-DR9).
  // The command carries the scenario *inputs* (the shared what-if terms), never the
  // outcome (AR-7); the server recomputes and journals «Сценарий релиза зафиксирован…».
  function onSaveScenario(controlEl) {
    if (deskCommandInFlight) return; // one command at a time (last-wins, see above)
    openConfirmModal(state, {
      titleKey: 'r_save',
      body: t('mo_save_b', state.lang),
      confirmKey: 'w_confirm',
      onConfirm: () => {
        deskCommandInFlight = true;
        runDeskCommand(
          scenarioSave,
          { market: state.market, project: state.project, termSet: state.termSet },
          controlEl,
        ).finally(() => {
          deskCommandInFlight = false;
        });
      },
    });
  }

  // The five-factor reasoning modal a group's «Обоснование» opens (FR-23 read side):
  // the group's live factors rendered from their message keys — read-only, so the
  // reusable modal's confirm/cancel both simply close it.
  // One reasoning factor rendered as «label: live value» (AC4): the view-model emits
  // each factor's raw params, formatted here in the active locale — the group's
  // deviation, sales pace, demand elasticity, average floor/area, and remaining supply
  // with months to handover (prototype `openR`, line 2274). Values only, never a raw key.
  function reasoningFactorText(f) {
    const { lang } = state;
    const p = f.params || [];
    const label = t(f.key, lang);
    let value;
    switch (f.key) {
      case 'ap_r1': // group price-vs-optimal deviation
        value = pct(p[0], lang, 1);
        break;
      case 'ap_r2': // project sales pace
        value = pct(p[0], lang, 0);
        break;
      case 'ap_r3': // segment demand elasticity
        value = nf(p[0], lang, 2);
        break;
      case 'ap_r4': // average unit characteristics: floor + area
        value = `${t('th_floor', lang).toLowerCase()} ${nf(p[0], lang, 0)}, `
          + `${t('th_sqft', lang).toLowerCase()} ${nf(p[1], lang, 0)} ${areaUnitLabel(state)}`;
        break;
      case 'ap_r5': // remaining supply in the group + months to handover
        value = `${nf(p[0], lang)} ${t('u_units', lang)}, ${nf(p[1], lang)} ${t('u_mo', lang)}`;
        break;
      default:
        value = '';
    }
    return value ? `${label}: ${value}` : label;
  }

  function openReasoningModal(group) {
    const data = state.surfaceData || {};
    const g = (data.groups || []).find((x) => x.type === group);
    if (!g) {
      return;
    }
    const body = (g.factors || []).map((f) => reasoningFactorText(f)).join(' · ');
    openConfirmModal(state, {
      titleKey: 'ap_reason_t',
      body,
      confirmKey: 'w_confirm',
    });
  }

  // Wire the surface controls after each shell paint via event delegation on the
  // `#content` host (the controls are rebuilt every paint, so delegation attaches
  // once to the stable-per-paint host and survives the body swap). Discrete
  // controls fire one immediate refresh; range sliders debounce their `input`.
  function wireSurfaceControls() {
    const content = root.querySelector('#content');
    if (!content) {
      return;
    }
    const openProjectFromRow = (openProject) => {
      state.project = openProject.getAttribute('data-open-project');
      state.surface = FIRST_TAB;
      state.termSet = withoutFields(state.termSet, PROJECT_SWITCH_RESET_FIELDS);
      loadSurface(FIRST_TAB);
    };
    // One path applies a new filter set to whichever projection is open; the
    // form submit, a changed select and the typology «Показать квартиры»
    // buttons all end here.
    const applyOperationalFilters = (next) => {
      state.operationalDesk.filterError = null;
      if (state.operationalDesk.mode === 'chessboard') {
        const sections = state.operationalDesk.table?.filter_options?.sections || [];
        const filteredSection = sectionFromFilters(next, sections);
        loadOperationalBoard({
          replacement: {
            filters: next,
            page: 1,
            sectionId: filteredSection || state.operationalDesk.sectionId,
          },
          focusBoard: true,
        });
      } else {
        loadOperationalTable({
          preserveViewport: true,
          focusTable: true,
          replacement: { filters: next, page: 1 },
        });
      }
    };
    const applyInventoryFilterForm = (form) => {
      const next = {};
      let invalidFilter = false;
      for (const input of form.querySelectorAll('[data-inventory-filter]')) {
        const key = input.getAttribute('data-inventory-filter');
        if (!input.value) continue;
        const scaleDigits = input.getAttribute('data-filter-scale-digits');
        if (scaleDigits != null) {
          const scaled = decimalToScaled(input.value, Number(scaleDigits));
          if (scaled == null) {
            invalidFilter = true;
            break;
          }
          next[key] = scaled;
        } else if (key === 'manual_control') {
          next[key] = input.value === 'true';
        } else {
          next[key] = input.value;
        }
      }
      // A group drill-down has no control of its own in the form; it rides
      // along until the typology table or «Все группы» lifts it.
      const currentGroup = state.operationalDesk.filters?.price_group_id;
      if (currentGroup) next.price_group_id = currentGroup;
      if (invalidFilter) {
        state.operationalDesk.filterError = {
          key: 'inventory_filter_invalid', params: {},
        };
        preserveOperationalViewport(paint);
        return;
      }
      applyOperationalFilters(next);
    };
    content.addEventListener('submit', (event) => {
      const form = event.target;
      if (!form || !form.matches || !form.matches('[data-inventory-filters]')) return;
      event.preventDefault();
      applyInventoryFilterForm(form);
    });
    content.addEventListener('change', (event) => {
      const target = event.target;
      if (!target || !target.matches) {
        return;
      }
      if (target.matches('[data-chessboard-section]')) {
        loadOperationalBoard({
          replacement: { sectionId: target.value }, focusBoard: true,
        });
      } else if (target.matches('[data-inventory-sort]')) {
        const key = target.getAttribute('data-inventory-sort');
        loadOperationalTable({
          preserveViewport: true,
          focusTable: true,
          replacement: { [key]: target.value, page: 1 },
        });
      } else if (target.matches('select[data-inventory-filter]')) {
        // A chosen option is a decision; it applies without a second click.
        const form = typeof target.closest === 'function'
          ? target.closest('form[data-inventory-filters]') : null;
        if (form) applyInventoryFilterForm(form);
      } else if (target.matches('select[data-deal-term]')) {
        if (updateDealTerm(target.getAttribute('data-deal-term'), target.value)) {
          scheduleDealTermsSave(false);
        }
      } else if (target.matches('input[data-deal-lever]')) {
        if (updateDealLever(
          target.getAttribute('data-deal-lever'),
          target.checked,
          Number(target.getAttribute('data-on-magnitude')) || 1,
        )) scheduleDealTermsSave(false);
      } else if (target.matches('select[data-control]')) {
        updateTermFromControl(target.getAttribute('data-control'), target.value);
        recalcSurface();
      } else if (target.matches('input[type="radio"][data-control]')) {
        // A discrete radio (the Release concession package) fires an immediate
        // recalc, exactly as a select does — no debounce (UX-DR5).
        updateTermFromControl(target.getAttribute('data-control'), target.value);
        recalcSurface();
      } else if (target.matches('input[data-lever]')) {
        updateLever(
          target.getAttribute('data-lever'),
          target.checked,
          Number(target.getAttribute('data-on-magnitude')) || 1,
        );
        recalcSurface();
      }
    });
    content.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (target && target.matches
        && target.matches('input[type="range"][data-deal-term]')) {
        beginDealTermsDrag();
      }
    });
    content.addEventListener('input', (event) => {
      const target = event.target;
      if (target && target.matches && target.matches('input[type="range"][data-deal-term]')) {
        if (updateDealTerm(target.getAttribute('data-deal-term'), target.value)) {
          syncDealReadout(target, target.value);
          scheduleDealTermsSave(true);
        }
        return;
      }
      if (target && target.matches && target.matches('input[type="range"][data-control]')) {
        // Capture this slider's value immediately so a second slider moving within
        // the debounce window cannot drop it; only the refresh coalesces.
        updateTermFromControl(target.getAttribute('data-control'), target.value);
        // Our refresh is deferred by the debounce, so invalidate any request still
        // in flight now: otherwise an older one resolving inside the window would
        // adopt its stale echoed term-set and revert this slider's value (AR-15).
        supersedeInflightViews();
        onSliderInput();
      }
    });
    content.addEventListener('keydown', (event) => {
      const detailDialog = event.target.closest
        && event.target.closest('[data-inventory-detail-dialog]');
      if (detailDialog && event.key === 'Tab') {
        const focusable = Array.from(
          detailDialog.querySelectorAll('button, input, textarea, select, [href]'),
        ).filter((node) => !node.disabled);
        if (focusable.length) {
          const index = focusable.indexOf(document.activeElement);
          const next = event.shiftKey
            ? (index <= 0 ? focusable.length - 1 : index - 1)
            : (index < 0 || index === focusable.length - 1 ? 0 : index + 1);
          event.preventDefault();
          focusable[next].focus();
        }
        return;
      }
      if (event.key === 'Escape' && state.operationalDesk.enabled
        && (state.operationalDesk.detailUnitId != null
          || state.operationalDesk.detailLoading)) {
        event.preventDefault();
        closeOperationalDetail();
        return;
      }
      const chessboardCell = event.target.closest
        && event.target.closest('button[data-chessboard-unit]');
      if (chessboardCell && handleChessboardKey(event, chessboardCell)) return;
      const openProject =
        event.target.closest && event.target.closest('[data-open-project]');
      if (!openProject || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
      }
      event.preventDefault();
      openProjectFromRow(openProject);
    });
    content.addEventListener('click', (event) => {
      const close = (sel) => event.target.closest && event.target.closest(sel);
      if (event.target.matches
        && event.target.matches('[data-inventory-detail-dialog-mask]')) {
        closeOperationalDetail();
        return;
      }
      const pill = close('button[data-control="segment"][data-segment]');
      if (pill) {
        updateTermFromControl('segment', pill.getAttribute('data-segment'));
        recalcSurface();
        return;
      }
      const termButton = close('button[data-control][data-value]');
      if (termButton) {
        updateTermFromControl(
          termButton.getAttribute('data-control'),
          termButton.getAttribute('data-value'),
        );
        recalcSurface();
        return;
      }
      const openSurface = close('button[data-open-surface]');
      if (openSurface) {
        loadSurface(openSurface.getAttribute('data-open-surface'));
        return;
      }
      const openProject = close('[data-open-project]');
      if (openProject) {
        openProjectFromRow(openProject);
        return;
      }
      const inventoryDecision = close(
        'button[data-inventory-recommendation-decision]',
      );
      if (inventoryDecision) {
        confirmOperationalDecision(inventoryDecision);
        return;
      }
      const createSnapshot = close('button[data-create-calculation-snapshot]');
      if (createSnapshot) {
        createOperationalSnapshot();
        return;
      }
      const snapshotPage = close('button[data-snapshot-page]');
      if (snapshotPage && !snapshotPage.disabled) {
        pageOperationalSnapshots(snapshotPage.getAttribute('data-snapshot-page'));
        return;
      }
      const snapshotResultPage = close('button[data-snapshot-result-page]');
      if (snapshotResultPage && !snapshotResultPage.disabled) {
        pageOperationalSnapshotResults(
          snapshotResultPage.getAttribute('data-snapshot-result-page'),
        );
        return;
      }
      const inspectSnapshot = close('button[data-inspect-calculation-snapshot]');
      if (inspectSnapshot) {
        inspectOperationalSnapshot(
          inspectSnapshot.getAttribute('data-inspect-calculation-snapshot'),
        );
        return;
      }
      const runSnapshot = close('button[data-run-calculation-snapshot]');
      if (runSnapshot && !runSnapshot.disabled) {
        runOperationalSnapshot(runSnapshot.getAttribute('data-run-calculation-snapshot'));
        return;
      }
      const mode = close('button[data-inventory-mode]');
      if (mode) {
        const nextMode = mode.getAttribute('data-inventory-mode');
        if (nextMode === state.operationalDesk.mode) {
          if (state.operationalDesk.loading || state.operationalDesk.boardLoading) {
            beginOperationalContextGeneration();
            state.operationalDesk.error = null;
            state.operationalDesk.boardError = null;
            const selector = nextMode === 'chessboard'
              ? '#inventory-chessboard-title' : '#inventory-table-title';
            preserveOperationalViewport(paint, selector);
          }
          return;
        }
        switchOperationalMode(nextMode);
        return;
      }
      const inventoryUnit = close('button[data-inventory-unit]');
      if (inventoryUnit) {
        const fromChessboard = inventoryUnit.getAttribute('data-chessboard-unit') != null;
        loadOperationalDetail(
          inventoryUnit.getAttribute('data-inventory-unit'),
          0,
          fromChessboard ? 'chessboard' : 'table',
          fromChessboard ? {
            sectionId: inventoryUnit.getAttribute('data-chessboard-section'),
            floorId: inventoryUnit.getAttribute('data-chessboard-floor'),
            stackId: inventoryUnit.getAttribute('data-chessboard-stack'),
          } : null,
        );
        return;
      }
      const returnDataWorkspace = close('button[data-return-data-workspace]');
      if (returnDataWorkspace) {
        handlers.onOpenData(false);
        return;
      }
      const closeInventoryDetail = close('button[data-close-inventory-detail]');
      if (closeInventoryDetail) {
        closeOperationalDetail();
        return;
      }
      const retryInventoryDetail = close('button[data-retry-inventory-detail]');
      if (retryInventoryDetail) {
        loadOperationalDetail(
          state.operationalDesk.detailUnitId, state.operationalDesk.historyOffset,
        );
        return;
      }
      const retryInventoryTable = close('button[data-retry-inventory-table]');
      if (retryInventoryTable) {
        if (state.operationalDesk.projectId == null) retryOperationalDiscovery();
        else {
          const operational = state.operationalDesk;
          const session = sessionGeneration;
          const pending = loadOperationalTable({ preserveViewport: true, focusTable: true });
          const context = operationalContextGeneration;
          pending.then((loaded) => {
            if (loaded && state.operationalDesk === operational
              && session === sessionGeneration && context === operationalContextGeneration) {
              return resumeCreatedProjectResult();
            }
          });
        }
        return;
      }
      const retryDiscoveryButton = close(
        'button[data-retry-operational-discovery]',
      );
      if (retryDiscoveryButton) {
        retryOperationalDiscovery();
        return;
      }
      const retryOperationalSurface = close('button[data-retry-operational-surface]');
      if (retryOperationalSurface) {
        loadOperationalSurfaceProjection({ focus: true });
        return;
      }
      const retryOperationalProject = close('button[data-retry-operational-project]');
      if (retryOperationalProject) {
        const selected = state.operationalDesk.projects.find(
          (item) => String(item.project_id) === String(
            retryOperationalProject.getAttribute('data-retry-operational-project'),
          ),
        );
        if (selected) switchOperationalProject(selected);
        return;
      }
      const retryOperationalMode = close('button[data-retry-operational-mode]');
      if (retryOperationalMode) {
        switchOperationalMode(
          retryOperationalMode.getAttribute('data-retry-operational-mode'),
        );
        return;
      }
      const retryChessboard = close('button[data-retry-chessboard]');
      if (retryChessboard) {
        loadOperationalBoard({ focusBoard: true });
        return;
      }
      const openSelectedSection = close('button[data-open-selected-section]');
      if (openSelectedSection) {
        loadOperationalBoard({
          replacement: {
            sectionId: openSelectedSection.getAttribute('data-open-selected-section'),
          },
          focusBoard: true,
        });
        return;
      }
      const refreshInventoryVersion = close('button[data-refresh-inventory-version]');
      if (refreshInventoryVersion) {
        refreshOperationalVersion();
        return;
      }
      const groupFilter = close('button[data-inventory-group-filter]');
      if (groupFilter) {
        const groupId = groupFilter.getAttribute('data-inventory-group-filter');
        const next = { ...(state.operationalDesk.filters || {}) };
        if (groupId) next.price_group_id = groupId;
        else delete next.price_group_id;
        applyOperationalFilters(next);
        return;
      }
      const clearInventoryFilters = close('button[data-clear-inventory-filters]');
      if (clearInventoryFilters) {
        if (state.operationalDesk.mode === 'chessboard') {
          loadOperationalBoard({
            replacement: { filters: {}, page: 1 }, focusBoard: true,
          });
        } else {
          loadOperationalTable({
            preserveViewport: true,
            focusTable: true,
            replacement: { filters: {}, page: 1 },
          });
        }
        return;
      }
      const inventoryPage = close('button[data-inventory-page]');
      if (inventoryPage && !inventoryPage.disabled) {
        loadOperationalTable({
          preserveViewport: true,
          focusTable: true,
          replacement: {
            page: Number(inventoryPage.getAttribute('data-inventory-page')),
          },
        });
        return;
      }
      // Desk (Story 4.2): the manager's accept/decline, the director's group approval
      // and «Согласовать все», and the group reasoning modal. A disabled control (a
      // zero-pending group / approve-all) never acts.
      const decide = close('button[data-decision][data-unit]');
      if (decide) {
        onDecideUnit(
          decide.getAttribute('data-unit'),
          decide.getAttribute('data-decision'),
          decide,
        );
        return;
      }
      const group = close('button[data-approve-group]');
      if (group && !group.disabled) {
        const type = group.getAttribute('data-approve-group');
        const counts = deskPendingByType(state.surfaceData || { table: { rows: [] } });
        onApproveGroup(type, counts[type] || 0, group);
        return;
      }
      const all = close('button[data-approve-all]');
      if (all && !all.disabled) {
        onApproveGroup(null, (state.surfaceData || {}).pending || 0, all);
        return;
      }
      const reason = close('button[data-reason-group]');
      if (reason) {
        openReasoningModal(reason.getAttribute('data-reason-group'));
        return;
      }
      // Release (Story 4.3): the manager's «Зафиксировать сценарий для комитета». A
      // disabled control (a non-manager, UX-DR3) never acts — the guard mirrors the
      // desk command controls.
      const save = close('button[data-save-scenario]');
      if (save && !save.disabled) {
        onSaveScenario(save);
      }
    });
  }

  function showLogin(errorKey) {
    clearSessionState();
    state.error = errorKey || null;
    paint();
  }

  const handlers = {
    onLang(lang) {
      if (state.lang !== lang) {
        state.lang = lang;
        // The language switch re-renders everything from the same payload — the
        // chrome carries message keys and bilingual values, so no refetch is
        // needed (AD-3, UX-DR12); the shell repaints in the new language.
        paint();
      }
    },
    async onOpenData(createOnly = false) {
      if (state.dataActivationPending) return;
      const capabilities = projectDataCapabilities(state);
      if (!capabilities?.import_upload?.allowed) return;
      closeOperationalRail(false);
      clearOperationalDeskState();
      clearDataWorkspaceState();
      state.dataState.capabilities = capabilities;
      state.dataState.createOnly = createOnly;
      state.screen = 'data';
      state.surface = null;
      const navigation = dataNavigationSequence;
      const generation = sessionGeneration;
      if (createOnly) {
        paint();
        focusDataHeading('#data-workspace-title');
        return;
      }
      const pending = loadDataWorkspace();
      const request = dataRequestSequence;
      await pending;
      if (request === dataRequestSequence && navigation === dataNavigationSequence && generation === sessionGeneration
        && state.screen === 'data') focusDataHeading('#data-workspace-title');
    },
    async onCalculateCreatedProject(target) {
      const data = state.dataState;
      if (state.dataActivationPending || data.calculatingProject != null || !data.createOnly
        || !data.creationTargets.includes(target)
        || !data.capabilities?.calculation_snapshot_create?.allowed
        || !data.capabilities?.calculation_snapshot_run_dco?.allowed) return;
      const navigation = dataNavigationSequence;
      const generation = sessionGeneration;
      const file = data.file;
      const stillCurrent = () => state.authed && state.screen === 'data'
        && state.dataState === data && file === data.file
        && data.creationTargets.includes(target)
        && generation === sessionGeneration && navigation === dataNavigationSequence;
      data.calculatingProject = target.project_id;
      data.error = null;
      paint();
      try {
        const active = await activeInventory();
        if (!stillCurrent()) return;
        if (!(active.items || []).some((item) => String(item.project_id) === String(target.project_id)
          && String(item.id) === String(target.id))) throw new ApiError('x_project_target_changed');
        const outcome = await createCalculationSnapshot(target.project_id, {
          inventoryVersionId: target.id, asOfUtc: target.source_as_of_utc,
        });
        if (!stillCurrent()) return;
        const snapshot = outcome?.snapshot;
        if (outcome?.state !== 'ready' || !snapshot) {
          data.error = { key: outcome?.issues?.[0]?.key || 'calculation_snapshot_not_ready',
            params: outcome?.issues?.[0]?.params || {}, issues: outcome?.issues || [] };
          return;
        }
        if (String(snapshot.project_id) !== String(target.project_id)
          || String(snapshot.inventory_version_id) !== String(target.id)
          || snapshot.as_of_utc !== target.source_as_of_utc
          || !operationalSnapshotStampCurrent(snapshot)) throw new ApiError('x_project_target_changed');
        await runCalculationSnapshotDco(target.project_id, snapshot.id,
          operationalAlgorithm(DEFAULT_OPERATIONAL_ALGORITHM).policy);
        if (!stillCurrent()) return;
        await handlers.onOpenOperationalDesk(String(target.project_id), target.id, {
          projectId: target.project_id, versionId: target.id, snapshotId: snapshot.id,
          asOfUtc: target.source_as_of_utc,
        });
        if (generation !== sessionGeneration || navigation + 1 !== dataNavigationSequence
          || state.screen !== 'shell' || state.surface !== 'desk'
          || String(state.operationalDesk.projectId) !== String(target.project_id)
          || String(state.operationalDesk.inventoryVersionId) !== String(target.id)
          || state.operationalDesk.error) return;
        await resumeCreatedProjectResult();
      } catch (err) {
        if (!stillCurrent()) return;
        data.error = { key: err instanceof ApiError ? err.key : 'x_internal_error',
          params: err instanceof ApiError ? err.params : {} };
      } finally {
        if (stillCurrent()) {
          data.calculatingProject = null;
          paint();
          if (data.error) focusDataHeading('#data-workspace-error');
        }
      }
    },
    async onOpenOperationalDesk(projectId = null, versionId = null, pendingResult = null) {
      if (state.dataActivationPending) return;
      // Re-discover projects and active versions after every Data visit.
      clearDataWorkspaceState();
      clearOperationalDeskState();
      state.operationalDesk.projectId = typeof projectId === 'string' ? projectId : null;
      state.operationalDesk.requiredVersionId = versionId;
      state.operationalDesk.pendingCreatedResult = pendingResult;
      state.screen = 'shell';
      state.surface = 'desk';
      state.project = null;
      state.termSet = {};
      const navigation = dataNavigationSequence;
      const generation = sessionGeneration;
      const pending = loadSurface('desk');
      const discovery = operationalDiscoverySequence;
      await pending;
      if (discovery === operationalDiscoverySequence && navigation === dataNavigationSequence && generation === sessionGeneration
        && (typeof projectId !== 'string' || String(state.operationalDesk.projectId) === projectId)
        && state.screen === 'shell' && state.surface === 'desk') {
        focusDataHeading('#inventory-desk-title');
      }
    },
    async onFeedbackOpen() {
      const sequence = ++feedbackRequestSequence;
      const generation = sessionGeneration;
      state.feedbackState.open = true;
      state.feedbackState.loading = true;
      state.feedbackState.error = null;
      state.feedbackState.success = false;
      paint();
      root.querySelector('.feedback-dialog input')?.focus();
      try {
        const page = await myProductFeedback({ limit: 20, offset: 0 });
        if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
          || !state.authed || !state.feedbackState.open) return;
        state.feedbackState.items = page.items || [];
        state.feedbackState.pagination = page;
      } catch (err) {
        if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
          || !state.authed || !state.feedbackState.open) return;
        state.feedbackState.error = workbenchError(err);
      } finally {
        if (generation === sessionGeneration && sequence === feedbackRequestSequence
          && state.authed && state.feedbackState.open) {
          state.feedbackState.loading = false;
          paint();
          root.querySelector('.feedback-dialog input')?.focus();
        }
      }
    },
    onFeedbackClose() {
      feedbackRequestSequence += 1;
      state.feedbackState.open = false;
      state.feedbackState.loading = false;
      state.feedbackState.submitting = false;
      state.feedbackState.error = null;
      state.feedbackState.draft = null;
      paint();
      root.querySelector('[data-feedback-open]')?.focus();
    },
    onFeedbackDraft(draft) {
      state.feedbackState.draft = draft;
      state.feedbackState.success = false;
    },
    async onFeedbackHistoryPage(offset) {
      const sequence = ++feedbackRequestSequence;
      const generation = sessionGeneration;
      state.feedbackState.loading = true;
      state.feedbackState.refreshError = null;
      paint();
      try {
        const page = await myProductFeedback({ limit: 20, offset });
        if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
          || !state.authed || !state.feedbackState.open) return;
        state.feedbackState.items = page.items || [];
        state.feedbackState.pagination = page;
      } catch (err) {
        if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
          || !state.authed || !state.feedbackState.open) return;
        state.feedbackState.refreshError = workbenchError(err);
      } finally {
        if (generation === sessionGeneration && sequence === feedbackRequestSequence
          && state.authed && state.feedbackState.open) {
          state.feedbackState.loading = false;
          paint();
        }
      }
    },
    async onFeedbackSubmit(payload) {
      if (state.feedbackState.submitting) return;
      const sequence = ++feedbackRequestSequence;
      const generation = sessionGeneration;
      state.feedbackState.draft = payload;
      state.feedbackState.submitting = true;
      state.feedbackState.error = null;
      state.feedbackState.refreshError = null;
      state.feedbackState.success = false;
      paint();
      try {
        await submitProductFeedback(payload);
        if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
          || !state.authed || !state.feedbackState.open) return;
        if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
          || !state.authed || !state.feedbackState.open) return;
        state.feedbackState.success = true;
        state.feedbackState.draft = null;
        paint();
        try {
          const page = await myProductFeedback({ limit: 20, offset: 0 });
          if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
            || !state.authed || !state.feedbackState.open) return;
          state.feedbackState.items = page.items || [];
          state.feedbackState.pagination = page;
        } catch (refreshErr) {
          if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
            || !state.authed || !state.feedbackState.open) return;
          state.feedbackState.refreshError = workbenchError(refreshErr);
        }
      } catch (err) {
        if (generation !== sessionGeneration || sequence !== feedbackRequestSequence
          || !state.authed || !state.feedbackState.open) return;
        state.feedbackState.error = workbenchError(err);
      } finally {
        if (generation === sessionGeneration && sequence === feedbackRequestSequence
          && state.authed && state.feedbackState.open) {
          state.feedbackState.submitting = false;
          paint();
        }
      }
    },
    onSelectFeedback(feedbackId) {
      state.loopState.editPlanId = null;
      state.loopState.planDraft = null;
      state.loopState.detailPlanOffset = 0;
      state.loopState.focusFeedbackId = feedbackId;
      loadProductLoopFeedback(feedbackId);
    },
    onPreparationHint(feedbackId, hint) {
      state.loopState.preparationHints[String(feedbackId)] = hint;
    },
    onPlanDraft(draft) {
      state.loopState.planDraft = draft;
    },
    onSavePlan(payload) {
      return runProductLoopMutation(
        () => saveProductChangePlan(payload), { draftKind: 'plan' },
      );
    },
    onRequestPreparation(feedbackId, payload) {
      return runProductLoopMutation(
        () => requestProductChangePreparation(feedbackId, payload),
        { draftKind: 'preparation', draftKey: feedbackId },
      );
    },
    onRetryPreparation(preparationId) {
      return runProductLoopMutation(
        () => retryProductChangePreparation(preparationId),
      );
    },
    onApplySuggestion(suggestion) {
      state.loopState.editPlanId = null;
      state.loopState.planDraft = suggestionPlanDraft(suggestion);
      paint();
      root.querySelector('[data-loop-plan] textarea')?.focus();
    },
    onRequestStart(plan) {
      // Every run starts at the minimal class; the deterministic classifier
      // escalates and the operator confirms only when it asks.
      const confirmedClass = 'ui-class';
      openConfirmModal(state, {
        titleKey: 'product_loop_start_title',
        body: tp('product_loop_start_consequence', state.lang, {
          revision: plan.revision_number,
          hash: plan.plan_sha256,
          sources: plan.source_feedback_ids.join(', '),
        }),
        confirmKey: 'product_loop_confirm_start',
        restoreFocusAfterConfirm: true,
        restoreFocusTarget: () => root.querySelector(
          `[data-loop-start-development="${plan.id}"]`,
        ),
        onConfirm: async (restoreFocus) => {
          await runProductLoopMutation(
            () => startProductChangeDevelopment(plan.id, {
              revisionNumber: plan.revision_number,
              confirmedClass,
            }),
          );
          restoreFocus();
        },
      });
    },
    onCancelRun(run) {
      return runProductLoopMutation(
        () => cancelProductChangeDevelopment(run.id),
      );
    },
    onRetryRun(run) {
      return runProductLoopMutation(
        () => retryProductChangeDevelopment(run.id),
      );
    },
    onConfirmRunClass(run) {
      return runProductLoopMutation(
        () => confirmProductChangeDevelopmentClass(run.id),
      );
    },
    onEditPlan(planId) {
      state.loopState.editPlanId = planId;
      state.loopState.planDraft = null;
      paint();
      root.querySelector('[data-loop-plan] textarea')?.focus();
    },
    onRecordResult(plan, payload) {
      return runProductLoopMutation(
        () => recordProductChangeResult(plan.id, payload),
        { draftKind: 'result', draftKey: plan.id },
      );
    },
    onResultDraft(planId, draft) {
      state.loopState.resultDrafts[String(planId)] = draft;
    },
    onFeedbackRegistryPage(offset) {
      state.loopState.registryOffset = offset;
      state.loopState.detail = null;
      loadProductLoopWorkspace();
    },
    onPlanPage(offset) {
      state.loopState.planOffset = offset;
      loadProductLoopWorkspace(state.loopState.selectedFeedbackId);
    },
    onDetailPlanPage(offset) {
      state.loopState.detailPlanOffset = offset;
      loadProductLoopFeedback(state.loopState.selectedFeedbackId);
    },
    // Switch the active rail scope. The «По всем проектам» entry opens the `all`
    // portfolio surface (the prototype's `openAll` — `view='all'`); a project entry
    // opens that project (the prototype's `openProject`), resetting the NEP what-if
    // terms and release size/window (AD-2 switch-reset: drop the fields, the server
    // re-resolves the defaults) and keeping the current tab unless we are leaving
    // the portfolio surface, which is not a project tab (then fall back to «Сегодня»).
    onProject(project) {
      if (project === PORTFOLIO_ID) {
        state.project = PORTFOLIO_ID;
        loadSurface(PORTFOLIO_ID);
        return;
      }
      state.project = project;
      if (state.surface === PORTFOLIO_ID) {
        state.surface = FIRST_TAB;
      }
      state.termSet = withoutFields(state.termSet, PROJECT_SWITCH_RESET_FIELDS);
      loadSurface(state.surface);
    },
    onOperationalProject(projectId) {
      const selected = state.operationalDesk.projects.find(
        (item) => String(item.project_id) === String(projectId),
      );
      if (selected) {
        closeOperationalRail(false);
        switchOperationalProject(selected);
      }
    },
    // Pick which algorithm's result the console shows. Every operational read
    // carries the selection, so the whole shell — surfaces, table, board and
    // unit detail — moves together and never shows two algorithms at once.
    onOperationalAlgorithm(key) {
      const operational = state.operationalDesk;
      if (!operational.enabled || operational.algorithmBusy) return;
      if (!OPERATIONAL_ALGORITHMS.some((item) => item.key === key)) return;
      if (operational.algorithm === key) return;
      operational.algorithm = key;
      operational.algorithmError = null;
      reloadOperationalForAlgorithm();
    },
    onOperationalAlgorithmRun(key) {
      runOperationalAlgorithm(key);
    },
    // Switch the market (FR-6): the dataset swap and preview treatment are the
    // server's; the client executes the AD-2 switch-reset — scope to the first
    // project's «Сегодня», the whole what-if term-set dropped (NEP terms, release
    // params, segment, retro month, competitors mode, and the dormant status filter;
    // the server resolves every field to its default and echoes it). The org
    // strategy is server-side and untouched.
    onMarket(market) {
      if (state.market !== market) {
        state.market = market;
        state.project = null; // the server resets scope to the first project
        state.surface = FIRST_TAB; // reset to the first project's Today (AD-2)
        state.termSet = {}; // drop every what-if term; the server re-resolves them
        loadSurface(FIRST_TAB);
      }
    },
    // Switch tabs (UX-DR18): instant frame, scroll-to-top, session-local terms
    // survive. A no-op when the tab is already active.
    onTab(surface) {
      if (state.surface !== surface) {
        loadSurface(surface);
      }
    },
    onToggleRoleMenu() {
      state.roleMenuOpen = !state.roleMenuOpen;
      paint();
    },
    onToggleRail() {
      if (!operationalRailIsMobile()) return;
      operationalRailTrigger = root.querySelector('.burger');
      operationalRailOpen = !operationalRailOpen;
      syncOperationalRail({ focus: operationalRailOpen, restoreFocus: false });
    },
    onCloseRail() {
      closeOperationalRail(true);
    },
    async onSubmit(email, password) {
      if (state.sessionBusy) return;
      const generation = ++sessionGeneration;
      state.sessionBusy = true;
      state.error = null;
      // Update the live region in place so the screen reader announces a change
      // from a prior error to "clear" before the request resolves.
      const slot = root.querySelector('.error-slot');
      if (slot) {
        slot.replaceChildren();
      }
      paint();
      try {
        const data = await login(email, password);
        if (generation !== sessionGeneration) return;
        state.sessionBusy = false;
        enterLanding(data);
      } catch (err) {
        if (generation !== sessionGeneration) return;
        state.sessionBusy = false;
        const key = err instanceof ApiError ? err.key : 'x_internal_error';
        state.error = key;
        const liveSlot = root.querySelector('.error-slot');
        if (liveSlot) {
          liveSlot.replaceChildren(buildErrorNote(key, state.lang));
        }
        paint();
      }
    },
    async onLogout() {
      // Org-scoped state is cleared and the login surface is painted before
      // waiting for the best-effort network request.
      showLogin(null);
      const generation = sessionGeneration;
      state.sessionBusy = true;
      paint();
      try {
        await logout();
      } catch {
        // Logout is best-effort client-side; the cookie is cleared server-side
        // regardless, so we always return to «Вход».
      } finally {
        if (generation === sessionGeneration) {
          state.sessionBusy = false;
          paint();
        }
      }
    },
    onFileSelected(file) {
      if (state.dataActivationPending || state.dataState.calculatingProject != null) return;
      // Selecting a replacement explicitly supersedes any older upload. Its
      // eventual response must not overwrite the new file or selected batch.
      uploadRequestSequence += 1;
      dataRequestSequence += 1;
      activationRequestSequence += 1;
      state.dataState.creationTargets = [];
      state.dataState.calculatingProject = null;
      state.dataState.file = file;
      selectedBatchIntent = null;
      state.dataState.loading = false;
      state.dataState.uploading = false;
      state.dataState.uploadOutcome = null;
      state.dataState.selected = null;
      state.dataState.confirmation = null;
      state.dataState.confirmationLoading = false;
      state.dataState.activating = false;
      state.dataState.activationResult = null;
      state.dataState.error = null;
      state.dataState.pollAttempts = 0;
      reviewRequestSequence += 1;
      if (reviewPollTimer !== null) cancelTimeout(reviewPollTimer);
      reviewPollTimer = null;
      paint();
      if (state.dataState.createOnly) focusDataHeading('.import-upload button[type=submit]');
    },
    onFileRejected(key) {
      if (state.dataActivationPending || state.dataState.calculatingProject != null) return;
      state.dataState.error = { key, params: {} };
      paint();
    },
    async onUpload(file) {
      if (state.dataActivationPending || state.dataState.calculatingProject != null) return;
      if (state.dataState.createOnly && state.dataState.selected?.activation_state === 'active') return;
      state.dataState.creationTargets = [];
      const sequence = ++uploadRequestSequence;
      state.dataState.uploading = true;
      state.dataState.uploadOutcome = null;
      state.dataState.error = null;
      state.dataState.confirmation = null;
      state.dataState.activationResult = null;
      paint();
      try {
        const batch = await uploadWorkbook(file);
        if (sequence !== uploadRequestSequence) return;
        state.dataState.uploadOutcome = batch.outcome || 'created';
        state.dataState.severity = null;
        state.dataState.issueFilters = { sheet: null, field: null, code: null };
        state.dataState.issueOffset = 0;
        await loadDataWorkspace(batch.id);
      } catch (err) {
        if (sequence !== uploadRequestSequence) return;
        state.dataState.error = {
          key: err instanceof ApiError ? err.key : 'x_internal_error',
          params: err instanceof ApiError ? err.params : {},
        };
      } finally {
        if (sequence === uploadRequestSequence) {
          state.dataState.uploading = false;
          paint();
        }
      }
    },
    async onSelect(batchId) {
      ++uploadRequestSequence;
      ++activationRequestSequence;
      selectedBatchIntent = batchId;
      if (reviewPollTimer !== null) cancelTimeout(reviewPollTimer);
      reviewPollTimer = null;
      state.dataState.pollAttempts = 0;
      state.dataState.error = null;
      state.dataState.confirmation = null;
      state.dataState.confirmationLoading = false;
      state.dataState.activating = false;
      state.dataState.activationResult = null;
      state.dataState.uploadOutcome = null;
      state.dataState.issueOffset = 0;
      await loadImportReview(batchId, 0);
    },
    async onSeverity(severity) {
      cancelReviewPoll();
      state.dataState.severity = severity;
      if (state.dataState.selected) {
        await loadImportReview(state.dataState.selected.id, 0);
      } else {
        paint();
      }
    },
    async onIssueFilters(filters) {
      cancelReviewPoll();
      state.dataState.issueFilters = filters;
      if (state.dataState.selected) {
        await loadImportReview(state.dataState.selected.id, 0);
      } else {
        paint();
      }
    },
    async onIssuePage(offset) {
      cancelReviewPoll();
      if (state.dataState.selected) {
        await loadImportReview(state.dataState.selected.id, offset);
        focusDataHeading('#data-issues-title');
      }
    },
    async onHistoryPage(offset) {
      cancelReviewPoll();
      const sequence = ++dataRequestSequence;
      state.dataState.loading = true;
      paint();
      try {
        const page = await importHistory({
          limit: state.dataState.historyPagination.limit || 25,
          offset,
        });
        if (sequence !== dataRequestSequence) return;
        state.dataState.batches = page.items || [];
        state.dataState.historyPagination = page;
        state.dataState.error = null;
      } catch (err) {
        if (sequence !== dataRequestSequence) return;
        state.dataState.error = {
          key: err instanceof ApiError ? err.key : 'x_internal_error',
          params: err instanceof ApiError ? err.params : {},
        };
      } finally {
        if (sequence === dataRequestSequence) {
          state.dataState.loading = false;
          paint();
          focusDataHeading('#data-history-title');
        }
      }
    },
    async onVersionHistoryPage(offset) {
      await loadVersionHistory(offset);
      focusDataHeading('#version-history-title');
    },
    async onRetry(batch) {
      const sequence = ++uploadRequestSequence;
      const file = state.dataState.file;
      const batchId = batch.id;
      let matches = false;
      try {
        matches = await retryFileMatchesBatch(file, batch);
      } catch {
        if (
          sequence !== uploadRequestSequence
          || state.dataState.file !== file
          || state.dataState.selected?.id !== batchId
        ) return;
        state.dataState.error = {
          key: 'import_retry_digest_failed',
          params: {},
        };
        paint();
        return;
      }
      if (
        sequence !== uploadRequestSequence
        || state.dataState.file !== file
        || state.dataState.selected?.id !== batchId
      ) return;
      if (!matches) {
        state.dataState.error = {
          key: 'import_retry_file_mismatch',
          params: {},
        };
        paint();
        return;
      }
      await handlers.onUpload(file);
    },
    async onRequestActivation() {
      const selected = state.dataState.selected;
      if (!selected || state.dataActivationPending || state.dataState.activating) return;
      const batchId = selected.id;
      const sequence = ++activationRequestSequence;
      state.dataState.error = null;
      state.dataState.confirmation = null;
      state.dataState.confirmationLoading = true;
      paint();
      try {
        const confirmation = await confirmImportActivation(batchId, state.dataState.createOnly);
        if (
          sequence !== activationRequestSequence
          || state.dataState.selected?.id !== batchId
        ) return;
        state.dataState.confirmation = confirmation;
        state.dataState.confirmationLoading = false;
        if (!confirmation.activation_allowed) {
          state.dataState.selected = {
            ...state.dataState.selected,
            activation_state: confirmation.activation_state,
            activation_retryable: confirmation.activation_retryable,
          };
          state.dataState.error = {
            key: confirmation.activation_denial_key || 'import_activation_not_ready',
            params: {},
          };
          paint();
          focusDataHeading('[data-confirm-activation]');
          return;
        }
        paint();
        openConfirmModal(state, {
          titleKey: 'data_activation_confirmation_title',
          bodyNode: buildActivationConfirmation(confirmation, state.lang),
          confirmKey: 'data_activation_confirmation_continue',
          restoreFocusAfterConfirm: true,
          restoreFocusTarget: () => root.querySelector('[data-confirm-activation]'),
          onConfirm: (restoreFocus) => handlers.onConfirmActivation(
            batchId, sequence, confirmation.confirmation_token, restoreFocus,
          ),
        });
      } catch (err) {
        if (sequence !== activationRequestSequence) return;
        state.dataState.confirmationLoading = false;
        state.dataState.error = {
          key: err instanceof ApiError ? err.key : 'x_internal_error',
          params: err instanceof ApiError ? err.params : {},
        };
        paint();
        focusDataHeading('[data-confirm-activation]');
      }
    },
    async onConfirmActivation(
      batchId, confirmationSequence, confirmationToken, restoreFocus,
    ) {
      if (
        state.dataActivationPending
        || confirmationSequence !== activationRequestSequence
        || state.dataState.selected?.id !== batchId
      ) {
        if (restoreFocus) restoreFocus();
        return;
      }
      const sequence = ++activationRequestSequence;
      const generation = sessionGeneration;
      const navigation = dataNavigationSequence;
      const createOnly = state.dataState.createOnly;
      state.dataActivationPending = true;
      state.dataState.activating = true;
      state.dataState.activationResult = null;
      state.dataState.error = null;
      paint();
      focusDataHeading('#data-review-title');
      try {
        const result = await activateImport(batchId, confirmationToken, createOnly);
        if (generation !== sessionGeneration || !state.authed
          || navigation !== dataNavigationSequence || state.screen !== 'data') return;
        const isCurrent = () => sequence === activationRequestSequence
          && state.dataState.selected?.id === batchId;
        if (isCurrent()) {
          state.dataState.activationResult = result;
          if (createOnly) state.dataState.creationTargets = (result.versions || []).filter(
            (item) => String(item.source_batch_id) === String(batchId),
          );
        }
        await loadDataWorkspace(selectedBatchIntent || state.dataState.selected?.id || null);
        if (generation !== sessionGeneration || !state.authed
          || navigation !== dataNavigationSequence || state.screen !== 'data') return;
        if (isCurrent()) focusDataHeading('#active-inventory-title');
      } catch (err) {
        if (generation !== sessionGeneration || !state.authed
          || navigation !== dataNavigationSequence || state.screen !== 'data') return;
        const isCurrent = () => sequence === activationRequestSequence
          && state.dataState.selected?.id === batchId;
        const activationError = {
          key: err instanceof ApiError ? err.key : 'x_internal_error',
          params: err instanceof ApiError ? err.params : {},
        };
        await loadDataWorkspace(selectedBatchIntent || state.dataState.selected?.id || null);
        if (generation !== sessionGeneration || !state.authed
          || navigation !== dataNavigationSequence || state.screen !== 'data') return;
        if (isCurrent()) {
          state.dataState.error = activationError;
          paint();
          focusDataHeading('[data-confirm-activation]');
        }
      } finally {
        if (generation === sessionGeneration) state.dataActivationPending = false;
        if (generation === sessionGeneration && sequence === activationRequestSequence) {
          state.dataState.activating = false;
          paint();
          if (state.dataState.activationResult) focusDataHeading('#active-inventory-title');
          else if (restoreFocus) restoreFocus();
        } else if (generation === sessionGeneration) {
          paint();
        }
      }
    },
  };

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && operationalRailOpen && operationalRailIsMobile()) {
      event.preventDefault();
      closeOperationalRail(true);
    }
  });

  // The strategy bar lives in the chrome (rebuilt each paint), outside `#content`, so
  // wire its pills via a delegated listener on the persistent root: the director's
  // click on an inactive strategy pill opens the «Сменить стратегию?» confirm (FR-36).
  // A disabled pill (a non-director, UX-DR3) never acts, and the active pill is a no-op.
  root.addEventListener('click', (event) => {
    const pill =
      event.target.closest &&
      event.target.closest('.stratbar button[data-strategy]');
    if (!pill || pill.disabled) {
      return;
    }
    const key = pill.getAttribute('data-strategy');
    const current = state.chrome && state.chrome.strategy && state.chrome.strategy.key;
    if (key && key !== current) {
      onStrategySwitch(key, pill);
    }
  });

  // A 401 x_session_expired on any call redirects to «Вход» (UX-DR7). The note
  // shows only if a session had been established this load; a cold-boot probe
  // that finds no session just shows the plain login screen.
  onSessionExpired(() => {
    const hadSession = state.authed;
    showLogin(hadSession ? 'x_session_expired' : null);
  });

  // The public entry page disables this legacy probe so every visit requires
  // credentials. Explicit callers such as in-memory test harnesses may still
  // request session restoration to exercise authenticated workspace behavior.
  paint();
  if (opts.probeSession !== false) {
    const generation = sessionGeneration;
    session()
      .then((data) => {
        if (generation === sessionGeneration) enterLanding(data);
      })
      .catch(() => {
        /* no session — the login screen is already shown */
      });
  }
  return state;
}

// Re-export the localization and number-formatting API through the render
// facade — the single UI entry point. The dictionary for key enumeration, the
// resolvers (`t` literal, `tp` named params, `tf` positional `{0}` — the shape
// the ported prototype strings use), and the `Intl` helpers whose locale follows
// the active language, never the market (ru-RU space-thousands/comma-decimals vs
// en-US, AD-3): surfaces (Epic 4) format the raw payload numbers through these.
export { DICT, localeFor, nf, pct, ppt, sgn, t, tf, tp };
