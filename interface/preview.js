// Imports that load fixtures must stay inside the bootstrap error boundary.
let t, previewRole, roleLandings;
const params = new URLSearchParams(location.search);
const entry = document.body.dataset.entry;
const app = document.getElementById('app');
const chrome = document.getElementById('preview-chrome');
document.documentElement.lang = params.get('lang') === 'en' ? 'en' : 'ru';
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--preview-chrome-height', `${chrome.offsetHeight}px`);
}).observe(chrome);
function paintChrome() {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
  chrome.replaceChildren();
  const top = document.createElement('div'); top.className = 'preview-toolbar';
  const gallery = document.createElement('a'); gallery.href = `../interfaces/?lang=${lang}`;
  gallery.textContent = '← ' + t('preview_gallery', lang);
  const context = document.createElement('strong'); context.textContent = t(`preview_context_${entry}`, lang);
  top.append(gallery, context);
  if (entry !== 'login') {
    const label = document.createElement('label'); label.textContent = t('preview_choose_role', lang) + ' ';
    const select = document.createElement('select'); select.id = 'preview-role';
    for (const role of Object.keys(roleLandings)) {
      const option = document.createElement('option'); option.value = role;
      option.textContent = t(`preview_role_${role}`, lang); option.selected = role === previewRole;
      select.append(option);
    }
    select.addEventListener('change', () => {
      const destination = entry === 'admin' ? 'product' : entry;
      location.href = `../${destination}/?role=${select.value}&lang=${lang}`;
    });
    label.append(select); top.append(label);
  }
  const notice = document.createElement('p'); notice.textContent = t('preview_notice', lang);
  chrome.append(top, notice);
}
try {
  const [renderer, adapter] = await Promise.all([import('./render.js'), import('./fixture-api.js')]);
  ({ t } = renderer);
  ({ previewRole, roleLandings } = adapter);
  renderer.mountApp(app, { lang: params.get('lang'), probeSession: entry !== 'login' });
  paintChrome();
  new MutationObserver(paintChrome).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
} catch (error) {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'Не удалось загрузить примеры. / Could not load examples.';
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'btn-primary'; retry.dataset.previewRetry = 'true';
  retry.textContent = 'Повторить / Retry'; retry.addEventListener('click', () => location.reload());
  const gallery = document.createElement('a'); gallery.href = `../interfaces/?lang=${document.documentElement.lang}`;
  gallery.textContent = 'Все интерфейсы / All interfaces';
  app.classList.add('preview-load-error'); app.replaceChildren(message, retry, gallery);
}
