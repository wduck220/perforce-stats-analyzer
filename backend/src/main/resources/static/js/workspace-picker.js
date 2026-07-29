

const WORKSPACE_LIST = (() => {
  const set = new Set();
  DAY_DATA.forEach((day) => {
    USERS.forEach((u) => {
      day.perUser[u.name].commits.forEach((c) => {
        if (c.workspace) set.add(c.workspace);
      });
    });
  });
  return Array.from(set).sort();
})();

function tintColor(hex, percent) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (channel) => Math.round(channel + (255 - channel) * percent);
  return '#' + [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const workspaceColorOverrides = {};

function setWorkspaceColorOverride(workspaceName, hex) {
  workspaceColorOverrides[workspaceName] = hex;
}

function getWorkspaceColor(workspaceName) {
  if (workspaceColorOverrides[workspaceName]) return workspaceColorOverrides[workspaceName];
  const owner = WORKSPACE_OWNER[workspaceName];
  const ownerUser = USERS.find((u) => u.name === owner);
  if (!ownerUser) return themeColor('muted');

  const siblings = workspacesOwnedBy(owner);
  const indexAmongSiblings = siblings.indexOf(workspaceName);
  const tint = [0.25, 0.45, 0.65][indexAmongSiblings] ?? 0.65;
  return tintColor(ownerUser.color, tint);
}

function scopeAuthorActiveSet(scope) {
  if (scope === 'heatmap') return typeof activeUsers !== 'undefined' ? activeUsers : null;
  if (scope === 'dist') return typeof avgActiveUsers !== 'undefined' ? avgActiveUsers : null;
  if (scope === 'trend') return typeof trendActiveUsers !== 'undefined' ? trendActiveUsers : null;
  if (scope === 'bar') return (typeof barActiveUsers !== 'undefined' && barActiveUsers) || null;
  if (typeof authorTreeStates !== 'undefined' && authorTreeStates[scope]) return authorTreeStates[scope];
  return null;
}

function visibleWorkspacesForScope(scope) {
  const wsPicker = typeof workspacePickers !== 'undefined' ? workspacePickers[scope] : null;
  const authorSet = scopeAuthorActiveSet(scope);
  return (window.WORKSPACE_LIST || []).filter((ws) => {
    if (wsPicker && !wsPicker.active.has(ws)) return false;
    if (authorSet && !authorSet.has(WORKSPACE_OWNER[ws])) return false;
    return true;
  });
}

const WORKSPACE_OWNER = (() => {
  const owner = {};
  DAY_DATA.forEach((day) => {
    USERS.forEach((u) => {
      day.perUser[u.name].commits.forEach((c) => {
        if (c.workspace) owner[c.workspace] = u.name;
      });
    });
  });
  return owner;
})();

function workspacesOwnedBy(userName) {
  return WORKSPACE_LIST.filter((ws) => WORKSPACE_OWNER[ws] === userName);
}

window.WORKSPACE_LIST = WORKSPACE_LIST;

const workspacePickers = {};

function createWorkspacePicker(pickerId, onChange) {
  workspacePickers[pickerId] = {
    active: new Set(WORKSPACE_LIST),
    onChange,
  };
  return workspacePickers[pickerId];
}

function workspaceCommitsFor(pickerId, dayObj, userName) {
  const picker = workspacePickers[pickerId];
  const allCommits = dayObj.perUser[userName].commits;
  if (!picker || picker.active.size === WORKSPACE_LIST.length) return allCommits;
  return allCommits.filter((c) => picker.active.has(c.workspace));
}

function workspaceCountFor(pickerId, dayObj, userName) {
  return workspaceCommitsFor(pickerId, dayObj, userName).length;
}

function workspaceAllCommits(pickerId, days) {
  const out = [];
  (days || filteredDays()).forEach((day) => {
    USERS.forEach((u) => workspaceCommitsFor(pickerId, day, u.name).forEach((c) => out.push(c)));
  });
  return out;
}

function renderWorkspacePicker(pickerId) {
  const picker = workspacePickers[pickerId];
  const container = document.getElementById('ws_' + pickerId);
  if (!picker || !container) return;

  const key = 'ws-' + pickerId;
  container.innerHTML = renderDropdownFilter({
    key,
    icon: DROPDOWN_ICONS.workspace,
    label: 'Воркспейс',
    searchPlaceholder: 'Поиск воркспейса…',
    items: WORKSPACE_LIST,
    itemText: (ws) => ws,
    isActive: (ws) => picker.active.has(ws),
    activeCount: picker.active.size,
    itemExtraHtml: (ws) => `<div class="dpi-dot" style="background:${getWorkspaceColor(ws)}"></div>`,
    onSearchExpr: `onWorkspaceFilterSearch('${pickerId}', this.value)`,
    onSelectAllExpr: `workspaceToggleAll('${pickerId}')`,
    onItemClickExpr: (ws) => `workspaceToggleOne('${pickerId}','${ws}')`,
  });

  const state = ensurePopState(key);
  if (state.open) {
    document.getElementById('pop-' + key)?.classList.add('on');
    document.getElementById('btn-' + key)?.classList.add('open');
  }

  refreshPrintSummaryFor(pickerId);
}

function onWorkspaceFilterSearch(pickerId, value) {
  handleDropdownFilterSearch('ws-' + pickerId, value, () => renderWorkspacePicker(pickerId));
}

function initWorkspacePickerDOM(pickerId, _label) {
  renderWorkspacePicker(pickerId);
}

function workspaceToggleAll(pickerId) {
  const picker = workspacePickers[pickerId];
  if (!picker) return;
  picker.active = new Set(WORKSPACE_LIST);
  renderWorkspacePicker(pickerId);
  picker.onChange?.();
}

function workspaceToggleOne(pickerId, workspaceName) {
  const picker = workspacePickers[pickerId];
  if (!picker) return;

  if (picker.active.has(workspaceName)) {
    picker.active.delete(workspaceName);
  } else {
    picker.active.add(workspaceName);
    if (picker.active.size === WORKSPACE_LIST.length) {
      picker.active = new Set(WORKSPACE_LIST);
    }
  }

  renderWorkspacePicker(pickerId);
  if (typeof showBriefLoadingOverlay === 'function') {
    showBriefLoadingOverlay('Обновляем…');
    setTimeout(() => { picker.onChange?.(); hideBriefLoadingOverlay(); }, 20);
  } else {
    picker.onChange?.();
  }
}
