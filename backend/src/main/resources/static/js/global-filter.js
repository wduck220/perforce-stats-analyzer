

let globalFilterDepots = new Set();
let globalFilterWorkspaces = new Set();
let globalFilterExts = new Set();
let globalFilterInitialized = false;

function ensureGlobalFilterInit() {
  if (globalFilterInitialized) return;
  globalFilterDepots = new Set(DEPOTS);
  globalFilterWorkspaces = new Set(WORKSPACE_LIST || []);
  globalFilterExts = new Set(EXTS_LIST);
  globalFilterInitialized = true;
}

function renderGlobalFilterPanel() {
  const container = document.getElementById('globalFilterPanel');
  if (!container) return;
  ensureGlobalFilterInit();

  const depotHtml = renderDropdownFilter({
    key: 'gf-depot',
    icon: DROPDOWN_ICONS.depot,
    label: 'Депо',
    searchPlaceholder: 'Поиск депо…',
    items: DEPOT_LIST,
    itemText: (d) => d.label,
    isActive: (d) => globalFilterDepots.has(d.key),
    activeCount: globalFilterDepots.size,
    itemExtraHtml: (d) => `<div class="dpi-dot" style="background:${getDepotColor(d.key)}"></div>`,
    onSearchExpr: `onGlobalFilterSearch('gf-depot', this.value)`,
    onSelectAllExpr: `gfSelectAllDepots()`,
    onItemClickExpr: (d) => `gfToggleDepot('${d.key.replace(/'/g, "\\'")}')`,
  });

  const wsHtml = renderDropdownFilter({
    key: 'gf-workspace',
    icon: DROPDOWN_ICONS.workspace,
    label: 'Воркспейсы',
    searchPlaceholder: 'Поиск воркспейса…',
    items: WORKSPACE_LIST || [],
    itemText: (w) => w,
    isActive: (w) => globalFilterWorkspaces.has(w),
    activeCount: globalFilterWorkspaces.size,
    onSearchExpr: `onGlobalFilterSearch('gf-workspace', this.value)`,
    onSelectAllExpr: `gfSelectAllWorkspaces()`,
    onItemClickExpr: (w) => `gfToggleWorkspace('${w.replace(/'/g, "\\'")}')`,
  });

  const extHtml = renderDropdownFilter({
    key: 'gf-ext',
    icon: DROPDOWN_ICONS.depot,
    label: 'Расширения',
    searchPlaceholder: 'Поиск расширения…',
    items: EXTS_LIST,
    itemText: (e) => '.' + e,
    isActive: (e) => globalFilterExts.has(e),
    activeCount: globalFilterExts.size,
    itemExtraHtml: (e) => `<div class="dpi-dot" style="background:${getExtColor(e)}"></div>`,
    onSearchExpr: `onGlobalFilterSearch('gf-ext', this.value)`,
    onSelectAllExpr: `gfSelectAllExts()`,
    onItemClickExpr: (e) => `gfToggleExt('${e.replace(/'/g, "\\'")}')`,
  });

  container.innerHTML = `
    <div class="gf-row">${depotHtml}${wsHtml}${extHtml}</div>
    <div class="gf-actions">
      <button class="gf-apply-btn" onclick="applyGlobalFilterToAll()">Применить ко всем разделам</button>
      <button class="gf-reset-btn" onclick="resetGlobalFilter()">Сбросить (выбрать всё)</button>
    </div>
  `;

  ['gf-depot', 'gf-workspace', 'gf-ext'].forEach((key) => {
    const state = ensurePopState(key);
    if (state.open) {
      document.getElementById('pop-' + key)?.classList.add('on');
      document.getElementById('btn-' + key)?.classList.add('open');
    }
  });
}

function onGlobalFilterSearch(key, value) {
  handleDropdownFilterSearch(key, value, renderGlobalFilterPanel);
}

function gfToggleDepot(d) { globalFilterDepots.has(d) ? globalFilterDepots.delete(d) : globalFilterDepots.add(d); renderGlobalFilterPanel(); }
function gfToggleWorkspace(w) { globalFilterWorkspaces.has(w) ? globalFilterWorkspaces.delete(w) : globalFilterWorkspaces.add(w); renderGlobalFilterPanel(); }
function gfToggleExt(e) { globalFilterExts.has(e) ? globalFilterExts.delete(e) : globalFilterExts.add(e); renderGlobalFilterPanel(); }
function gfSelectAllDepots() { globalFilterDepots = new Set(DEPOTS); renderGlobalFilterPanel(); }
function gfSelectAllWorkspaces() { globalFilterWorkspaces = new Set(WORKSPACE_LIST || []); renderGlobalFilterPanel(); }
function gfSelectAllExts() { globalFilterExts = new Set(EXTS_LIST); renderGlobalFilterPanel(); }

function resetGlobalFilter() {
  globalFilterDepots = new Set(DEPOTS);
  globalFilterWorkspaces = new Set(WORKSPACE_LIST || []);
  globalFilterExts = new Set(EXTS_LIST);
  renderGlobalFilterPanel();
  applyGlobalFilterToAll();
}

function showBriefLoadingOverlay(text) {
  let el = document.getElementById('gfLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gfLoadingOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(13,17,23,.55);z-index:9998;display:flex;align-items:center;justify-content:center;';
    el.innerHTML = '<div style="background:var(--s1,#161b22);border:1px solid var(--border,#30363d);border-radius:8px;padding:16px 24px;display:flex;align-items:center;gap:12px;">' +
      '<div style="width:20px;height:20px;border:2px solid var(--border,#30363d);border-top-color:var(--blue,#58a6ff);border-radius:50%;animation:gfspin .7s linear infinite;"></div>' +
      '<span style="color:var(--text,#e6edf3);font-size:13px;" id="gfLoadingText"></span></div>' +
      '<style>@keyframes gfspin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(el);
  }
  document.getElementById('gfLoadingText').textContent = text || 'Применяем ко всем разделам…';
  el.style.display = 'flex';
}
function hideBriefLoadingOverlay() {
  const el = document.getElementById('gfLoadingOverlay');
  if (el) el.style.display = 'none';
}

function applyGlobalFilterToAll() {
  showBriefLoadingOverlay('Применяем фильтр ко всем разделам…');
  setTimeout(() => {
    applyGlobalFilterToAllInner();
    hideBriefLoadingOverlay();
  }, 30);
}

function applyGlobalFilterToAllInner() {
  Object.keys(depotPickers).forEach((scope) => {
    depotPickers[scope].active = new Set(globalFilterDepots);
    if (typeof renderDepotPicker === 'function') renderDepotPicker(scope);
    if (typeof depotPickers[scope].onChange === 'function') depotPickers[scope].onChange();
  });

  Object.keys(workspacePickers).forEach((scope) => {
    workspacePickers[scope].active = new Set(globalFilterWorkspaces);
    if (typeof renderWorkspacePicker === 'function') renderWorkspacePicker(scope);
    if (typeof workspacePickers[scope].onChange === 'function') workspacePickers[scope].onChange();
  });

  Object.keys(extensionPickerRegistry).forEach((scope) => {
    extensionPickers[scope] = new Set(globalFilterExts);
    if (typeof renderExtensionPicker === 'function') renderExtensionPicker(scope);
    if (typeof extensionRebuild === 'function') extensionRebuild(scope);
  });
}

renderGlobalFilterPanel();
