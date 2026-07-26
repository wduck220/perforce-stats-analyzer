

const scalablePopState = {};

function ensurePopState(key) {
  if (!scalablePopState[key]) {
    scalablePopState[key] = { open: false, search: '' };
  }
  return scalablePopState[key];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function closeAllScalablePops() {
  Object.keys(scalablePopState).forEach((k) => { scalablePopState[k].open = false; });
  document.querySelectorAll('.pill-drop.on').forEach((el) => el.classList.remove('on'));
  document.querySelectorAll('.pill-btn.open').forEach((el) => el.classList.remove('open'));
}

function toggleScalablePop(key) {
  const state = ensurePopState(key);
  const wasOpen = state.open;
  closeAllScalablePops();
  state.open = !wasOpen;
  if (state.open) {
    document.getElementById('pop-' + key)?.classList.add('on');
    document.getElementById('btn-' + key)?.classList.add('open');
    setTimeout(() => document.getElementById('search-' + key)?.focus(), 0);
  }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.pill-select')) return;
  closeAllScalablePops();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllScalablePops();
});

function renderDropdownFilter(opts) {
  const {
    key, icon, label, searchPlaceholder, items, itemText, isActive, activeCount,
    itemExtraHtml, onSearchExpr, onSelectAllExpr, onItemClickExpr,
    searchEmptyText = 'Ничего не найдено',
  } = opts;

  const state = ensurePopState(key);
  const total = items.length;
  const query = state.search.trim().toLowerCase();
  const visibleItems = query
    ? items.filter((item) => itemText(item).toLowerCase().includes(query))
    : items;
  const showSearch = total > 6;

  const rowsHtml = visibleItems.length
    ? visibleItems.map((item) => `
        <div class="pill-row${isActive(item) ? ' on' : ''}" onclick="${onItemClickExpr(item)}">
          <div class="pill-check"><svg viewBox="0 0 16 16" fill="#0d1117"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg></div>
          ${itemExtraHtml ? itemExtraHtml(item) : ''}
          <span class="pill-name">${escapeHtml(itemText(item))}</span>
        </div>`).join('')
    : `<div class="pill-empty">${escapeHtml(searchEmptyText)}</div>`;

  const searchHtml = showSearch
    ? `<div class="pill-search-wrap"><input id="search-${key}" type="text" placeholder="${escapeHtml(searchPlaceholder)}" value="${escapeHtml(state.search)}" oninput="${onSearchExpr}"></div>`
    : '';

  return `
    <div class="pill-select">
      <button class="pill-btn" id="btn-${key}" onclick="toggleScalablePop('${key}')">
        <span class="pill-lbl">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">${icon}</svg>
          ${label} <span class="pill-count">${activeCount}/${total}</span>
        </span>
        <span class="pill-arrow">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/></svg>
        </span>
      </button>
      <div class="pill-drop" id="pop-${key}">
        ${searchHtml}
        <div class="pill-actions">
          <button class="pill-action-btn" onclick="${onSelectAllExpr}">Выбрать все</button>
        </div>
        <div class="pill-list">${rowsHtml}</div>
      </div>
    </div>`;
}

function handleDropdownFilterSearch(key, value, rerender) {
  const state = ensurePopState(key);
  state.search = value;
  rerender();
  const input = document.getElementById('search-' + key);
  if (input) {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}

function toggleTreeAuthorOpen(key, authorName) {
  const state = ensurePopState(key);
  if (!state.openAuthors) state.openAuthors = new Set();
  if (state.openAuthors.has(authorName)) state.openAuthors.delete(authorName);
  else state.openAuthors.add(authorName);
}

function renderStaticLegend(items, emptyText = 'Ничего не выбрано') {
  if (!items.length) return `<div class="chart-legend"><span class="chart-legend-empty">${escapeHtml(emptyText)}</span></div>`;
  return `<div class="chart-legend">${items.map((i) =>
    `<span class="chart-legend-item"><span class="dot" style="background:${i.color}"></span>${escapeHtml(i.label)}</span>`
  ).join('')}</div>`;
}

function shadeTowardBlack(hex, percent) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (channel) => Math.round(channel * (1 - percent));
  return '#' + [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function renderPeriodDelta(current, previous) {
  if (previous == null) return '';
  const diff = current - previous;
  const pct = previous !== 0 ? (diff / previous) * 100 : (current > 0 ? 100 : 0);
  const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
  const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const sign = diff > 0 ? '+' : '';
  return `<span class="period-delta ${cls}">${arrow} ${sign}${pct.toFixed(0)}%</span>`;
}

function renderSparklineSVG(values, color, opts) {
  opts = opts || {};
  const width = opts.width || 100;
  const height = opts.height || 28;
  if (!values.length) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

const authorTreeStates = {};
const authorTreeRegistry = {};

function ensureAuthorTreeState(scope) {
  if (!authorTreeStates[scope]) authorTreeStates[scope] = new Set(USERS.map((u) => u.name));
  return authorTreeStates[scope];
}

function registerAuthorTree(scope, containerId, rebuildFnNames) {
  authorTreeRegistry[scope] = { containerId, rebuildFnNames: Array.isArray(rebuildFnNames) ? rebuildFnNames : [rebuildFnNames] };
  ensureAuthorTreeState(scope);
}

function isAuthorActiveInScope(scope, name) {
  return ensureAuthorTreeState(scope).has(name);
}

function renderAuthorTree(scope) {
  const reg = authorTreeRegistry[scope];
  if (!reg) return;
  const container = document.getElementById(reg.containerId);
  if (!container) return;

  const activeAuthors = ensureAuthorTreeState(scope);
  const wsPicker = typeof workspacePickers !== 'undefined' ? workspacePickers[scope] : null;
  const key = 'authtree-' + scope;
  const totalWs = (window.WORKSPACE_LIST || []).length;

  container.innerHTML = renderAuthorWorkspaceTree({
    key,
    users: USERS,
    isAuthorActive: (u) => activeAuthors.has(u.name),
    workspacesForAuthor: (name) => workspacesOwnedBy(name),
    isWorkspaceActive: (ws) => !wsPicker || wsPicker.active.has(ws),
    activeAuthorCount: activeAuthors.size,
    activeWorkspaceCount: wsPicker ? wsPicker.active.size : totalWs,
    totalWorkspaceCount: totalWs,
    onSearchExpr: `onAuthorTreeSearch('${scope}', this.value)`,
    onSelectAllExpr: `authorTreeSelectAll('${scope}')`,
    onAuthorToggleExpr: (u) => `authorTreeToggleAuthor('${scope}','${u.name.replace(/'/g, "\\'")}')`,
    onWorkspaceToggleExpr: (ws) => `workspaceToggleOne('${scope}','${ws}')`,
    rerenderExpr: `renderAuthorTree('${scope}')`,
  });

  const state = ensurePopState(key);
  if (state.open) {
    document.getElementById('pop-' + key)?.classList.add('on');
    document.getElementById('btn-' + key)?.classList.add('open');
  }
}

function authorTreeRebuild(scope) {
  const reg = authorTreeRegistry[scope];
  if (!reg) return;
  reg.rebuildFnNames.forEach((fnName) => {
    if (typeof window[fnName] === 'function') window[fnName]();
  });
}

function onAuthorTreeSearch(scope, value) {
  handleDropdownFilterSearch('authtree-' + scope, value, () => renderAuthorTree(scope));
}

function authorTreeSelectAll(scope) {
  authorTreeStates[scope] = new Set(USERS.map((u) => u.name));
  if (typeof workspacePickers !== 'undefined' && workspacePickers[scope]) {
    workspacePickers[scope].active = new Set(WORKSPACE_LIST);
  }
  renderAuthorTree(scope);
  authorTreeRebuild(scope);
}

function authorTreeToggleAuthor(scope, name) {
  const set = ensureAuthorTreeState(scope);
  if (set.has(name)) set.delete(name);
  else set.add(name);
  renderAuthorTree(scope);
  authorTreeRebuild(scope);
}

function renderAuthorWorkspaceTree(opts) {
  const {
    key, users, isAuthorActive, workspacesForAuthor, isWorkspaceActive,
    activeAuthorCount, activeWorkspaceCount, totalWorkspaceCount,
    onSearchExpr, onSelectAllExpr, onAuthorToggleExpr, onWorkspaceToggleExpr, rerenderExpr,
  } = opts;

  const state = ensurePopState(key);
  if (!state.openAuthors) state.openAuthors = new Set();
  const query = state.search.trim().toLowerCase();
  const showSearch = users.length > 4;

  const rowsHtml = users.map((user) => {
    const ownedWs = workspacesForAuthor(user.name);
    const matchesAuthor = user.name.toLowerCase().includes(query);
    const matchingWs = ownedWs.filter((ws) => matchesAuthor || ws.toLowerCase().includes(query));
    if (query && !matchesAuthor && !matchingWs.length) return '';

    const activeOwnedWs = ownedWs.filter((ws) => isWorkspaceActive(ws));
    const authorActive = isAuthorActive(user);
    const authorOn = authorActive && (ownedWs.length === 0 || activeOwnedWs.length === ownedWs.length);
    const indeterminate = authorActive && activeOwnedWs.length > 0 && activeOwnedWs.length < ownedWs.length;
    const isOpen = state.openAuthors.has(user.name) || !!query;
    const checkClass = indeterminate ? ' indeterminate' : (authorOn ? ' on' : '');

    const wsVisuallyOn = (ws) => authorActive && isWorkspaceActive(ws);

    const wsToShow = query ? matchingWs : ownedWs;
    const childrenHtml = wsToShow.map((ws) => `
        <div class="row lvl1${wsVisuallyOn(ws) ? ' on' : ''}" onclick="${onWorkspaceToggleExpr(ws)}">
          <div class="pill-check${wsVisuallyOn(ws) ? ' on' : ''}"><svg viewBox="0 0 16 16" fill="#0d1117"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg></div>
          <span class="dot" style="background:${getWorkspaceColor(ws)}"></span>
          <span class="name">${escapeHtml(ws)}</span>
        </div>`).join('');

    return `
      <div class="row" onclick="toggleTreeAuthorOpen('${key}','${user.name.replace(/'/g, "\\'")}');${rerenderExpr}">
        <span class="caret${isOpen ? ' open' : ''}">▶</span>
        <div class="pill-check${checkClass}" onclick="event.stopPropagation();${onAuthorToggleExpr(user)}"><svg viewBox="0 0 16 16" fill="#0d1117"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg></div>
        <span class="dot" style="background:${user.color}"></span>
        <span class="name">${escapeHtml(user.name)}</span>
        <span class="meta">${authorActive ? activeOwnedWs.length : 0}/${ownedWs.length}</span>
      </div>
      <div class="tree-children" style="${isOpen ? '' : 'display:none'}">${childrenHtml}</div>`;
  }).join('') || `<div class="pill-empty">Ничего не найдено</div>`;

  const searchHtml = showSearch
    ? `<input class="pill-search" id="search-${key}" type="text" placeholder="Поиск автора/воркспейса…" value="${escapeHtml(state.search)}" oninput="${onSearchExpr}">`
    : '';

  return `
    <div class="pill-select">
      <button class="pill-btn" id="btn-${key}" onclick="toggleScalablePop('${key}')">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">${DROPDOWN_ICONS.person}</svg>
        <span class="pill-lbl">Авторы / Воркспейсы</span>
        <span class="pill-count">${activeAuthorCount} авт · ${activeWorkspaceCount}/${totalWorkspaceCount} WS</span>
        <span class="pill-arrow">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/></svg>
        </span>
      </button>
      <div class="pill-drop wide" id="pop-${key}">
        ${searchHtml}
        <div class="tree-wrap">${rowsHtml}</div>
        <div class="pill-actions">
          <button class="pill-action-btn" onclick="${onSelectAllExpr}">Выбрать всех</button>
        </div>
      </div>
    </div>`;
}

function renderGroupByPill(opts) {
  const {
    key, label, groupOptions, selectedGroupId, onSelectGroupExpr,
    entityItems, entityText, entityColor, isEntityActive, activeEntityCount,
    onEntityToggleExpr, onEntitySelectAllExpr,
  } = opts;
  const selectedGroup = groupOptions.find((o) => o.id === selectedGroupId) || groupOptions[0];

  const radioRowsHtml = groupOptions.map((o) => `
      <div class="radio-row${o.id === selectedGroupId ? ' on' : ''}" onclick="${onSelectGroupExpr(o.id)}">
        <span class="radio-check"></span>
        <span class="radio-name">${escapeHtml(o.label)}</span>
        ${o.desc ? `<span class="radio-desc">${escapeHtml(o.desc)}</span>` : ''}
      </div>`).join('');

  const entityRowsHtml = entityItems.length
    ? entityItems.map((item) => `
        <div class="pill-row${isEntityActive(item) ? ' on' : ''}" onclick="${onEntityToggleExpr(item)}">
          <div class="pill-check${isEntityActive(item) ? ' on' : ''}"><svg viewBox="0 0 16 16" fill="#0d1117"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg></div>
          ${entityColor ? `<span class="dot" style="background:${entityColor(item)}"></span>` : ''}
          <span class="pill-name">${escapeHtml(entityText(item))}</span>
        </div>`).join('')
    : `<div class="pill-empty">Нет данных</div>`;

  return `
    <div class="pill-select">
      <button class="pill-btn" id="btn-${key}" onclick="toggleScalablePop('${key}')">
        <span class="pill-lbl" style="font-weight:400;color:var(--muted)">${escapeHtml(label)} <b style="color:var(--text);font-weight:600">${escapeHtml(selectedGroup.label)}</b> <span class="pill-count">${activeEntityCount}/${entityItems.length}</span></span>
        <span class="pill-arrow">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/></svg>
        </span>
      </button>
      <div class="pill-drop wide" id="pop-${key}">
        <div class="pill-list" style="max-height:none;border-bottom:1px solid var(--border2);padding-bottom:4px;margin-bottom:4px">${radioRowsHtml}</div>
        <div class="pill-list">${entityRowsHtml}</div>
        <div class="pill-actions">
          <button class="pill-action-btn" onclick="${onEntitySelectAllExpr}">Показать все</button>
        </div>
      </div>
    </div>`;
}

function renderRadioPill(opts) {
  const { key, label, options, selectedId, onSelectExpr } = opts;
  const selected = options.find((o) => o.id === selectedId) || options[0];

  const rowsHtml = options.map((o) => `
      <div class="radio-row${o.id === selectedId ? ' on' : ''}" onclick="${onSelectExpr(o.id)}">
        <span class="radio-check"></span>
        <span class="radio-name">${escapeHtml(o.label)}</span>
        ${o.desc ? `<span class="radio-desc">${escapeHtml(o.desc)}</span>` : ''}
      </div>`).join('');

  const longestLabel = options.reduce((max, o) => (o.label.length > max.length ? o.label : max), '');
  const minWidthCh = label.length + longestLabel.length + 7;

  return `
    <div class="pill-select">
      <button class="pill-btn" id="btn-${key}" onclick="toggleScalablePop('${key}')" style="min-width:${minWidthCh}ch">
        <span class="pill-lbl" style="font-weight:400;color:var(--muted)">${escapeHtml(label)} <b style="color:var(--text);font-weight:600">${escapeHtml(selected.label)}</b></span>
        <span class="pill-arrow">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/></svg>
        </span>
      </button>
      <div class="pill-drop" id="pop-${key}">
        <div class="pill-list" style="max-height:none">${rowsHtml}</div>
      </div>
    </div>`;
}

const CHART_GROUP_BY_OPTIONS = [
  { id: 'authors', label: 'Авторам', desc: 'сумма' },
  { id: 'workspaces', label: 'Воркспейсам', desc: 'по автору' },
  { id: 'depot', label: 'Депо', desc: 'независимо' },
];

const EXT_PALETTE = ['#bc8cff', '#f0883e', '#3fb950', '#58a6ff', '#f85149', '#d29922', '#79c0ff', '#ff9bce', '#a5d6ff', '#7ee787'];
function getExtColor(ext) {
  const idx = EXTS_LIST.indexOf(ext);
  return EXT_PALETTE[idx % EXT_PALETTE.length] || themeColor('muted');
}

const extensionPickers = {};
const extensionPickerRegistry = {};

function ensureExtensionPicker(scope) {
  if (!extensionPickers[scope]) extensionPickers[scope] = new Set(EXTS_LIST);
  return extensionPickers[scope];
}

function isExtActiveInScope(scope, ext) {
  return ensureExtensionPicker(scope).has(ext);
}

function registerExtensionPicker(scope, containerId, rebuildFnNames) {
  extensionPickerRegistry[scope] = { containerId, rebuildFnNames: Array.isArray(rebuildFnNames) ? rebuildFnNames : [rebuildFnNames] };
  ensureExtensionPicker(scope);
}

function renderExtensionPicker(scope) {
  const reg = extensionPickerRegistry[scope];
  if (!reg) return;
  const container = document.getElementById(reg.containerId);
  if (!container) return;
  const active = ensureExtensionPicker(scope);
  const key = 'ext-' + scope;
  container.innerHTML = renderDropdownFilter({
    key,
    icon: DROPDOWN_ICONS.depot,
    label: 'Расширения',
    searchPlaceholder: 'Поиск расширения…',
    items: EXTS_LIST,
    itemText: (e) => '.' + e,
    isActive: (e) => active.has(e),
    activeCount: active.size,
    itemExtraHtml: (e) => `<div class="dpi-dot" style="background:${getExtColor(e)}"></div>`,
    onSearchExpr: `onExtensionSearch('${scope}', this.value)`,
    onSelectAllExpr: `extensionSelectAll('${scope}')`,
    onItemClickExpr: (e) => `extensionToggle('${scope}','${e}')`,
  });
  const state = ensurePopState(key);
  if (state.open) {
    document.getElementById('pop-' + key)?.classList.add('on');
    document.getElementById('btn-' + key)?.classList.add('open');
  }
}

function onExtensionSearch(scope, value) {
  handleDropdownFilterSearch('ext-' + scope, value, () => renderExtensionPicker(scope));
}

function extensionRebuild(scope) {
  const reg = extensionPickerRegistry[scope];
  if (!reg) return;
  reg.rebuildFnNames.forEach((fnName) => {
    if (typeof window[fnName] === 'function') window[fnName]();
  });
}

function extensionToggle(scope, ext) {
  const set = ensureExtensionPicker(scope);
  if (set.has(ext)) set.delete(ext);
  else set.add(ext);
  renderExtensionPicker(scope);
  if (typeof showBriefLoadingOverlay === 'function') {
    showBriefLoadingOverlay('Обновляем…');
    setTimeout(() => { extensionRebuild(scope); hideBriefLoadingOverlay(); }, 20);
  } else {
    extensionRebuild(scope);
  }
}

function extensionSelectAll(scope) {
  extensionPickers[scope] = new Set(EXTS_LIST);
  renderExtensionPicker(scope);
  extensionRebuild(scope);
}
const DROPDOWN_ICONS = {
  person: '<path d="M10.5 5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm.061 3.073a4 4 0 10-5.123 0 6.004 6.004 0 00-3.431 5.142.75.75 0 001.498.07 4.5 4.5 0 018.99 0 .75.75 0 101.498-.07 6.005 6.005 0 00-3.432-5.142z"/>',
  depot: '<path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z"/>',
  workspace: '<path d="M2 2.75A.75.75 0 012.75 2h10.5a.75.75 0 010 1.5H13v9.75A1.75 1.75 0 0111.25 15h-6.5A1.75 1.75 0 013 13.25V3.5h-.25A.75.75 0 012 2.75zM4.5 3.5v9.75c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25V3.5h-7z"/>',
};
