

const DEPOT_LIST = DEPOTS.map((depot) => ({
  key: depot,
  label: depot.replace(/^\/\//, '').replace(/\/$/, ''),
}));

const DEPOT_PALETTE = ['#e3b341', '#79c0ff', '#ff9bce', '#56d364', '#bc8cff', themeColor('muted')];

const depotColorOverrides = {};

function getDepotColor(depotKey) {
  if (depotColorOverrides[depotKey]) return depotColorOverrides[depotKey];
  const index = DEPOTS.indexOf(depotKey);
  return DEPOT_PALETTE[index % DEPOT_PALETTE.length] || themeColor('muted');
}

function setDepotColorOverride(depotKey, hex) {
  depotColorOverrides[depotKey] = hex;
}

const depotPickers = {};

function createDepotPicker(pickerId, onChange) {
  depotPickers[pickerId] = {
    active: new Set(DEPOTS),
    onChange,
  };
  return depotPickers[pickerId];
}

function depotCommitsFor(pickerId, dayObj, userName) {
  const depotPicker = depotPickers[pickerId];
  const wsPicker = workspacePickers[pickerId];
  let commits = dayObj.perUser[userName].commits;

  if (depotPicker && depotPicker.active.size < DEPOTS.length) {
    commits = commits.filter((c) => depotPicker.active.has(c.depot));
  }
  if (wsPicker && wsPicker.active.size < WORKSPACE_LIST.length) {
    commits = commits.filter((c) => wsPicker.active.has(c.workspace));
  }
  return commits;
}

function depotCountFor(pickerId, dayObj, userName) {
  return depotCommitsFor(pickerId, dayObj, userName).length;
}

function depotAllCommits(pickerId, days) {
  const out = [];
  (days || filteredDays()).forEach((day) => {
    USERS.forEach((u) => depotCommitsFor(pickerId, day, u.name).forEach((c) => out.push(c)));
  });
  return out;
}

function renderDepotPicker(pickerId) {
  const picker = depotPickers[pickerId];
  const container = document.getElementById('df_' + pickerId);
  if (!picker || !container) return;

  const key = 'depot-' + pickerId;
  container.innerHTML = renderDropdownFilter({
    key,
    icon: DROPDOWN_ICONS.depot,
    label: 'Депо',
    searchPlaceholder: 'Поиск депо…',
    items: DEPOT_LIST,
    itemText: (d) => d.label,
    isActive: (d) => picker.active.has(d.key),
    activeCount: picker.active.size,
    itemExtraHtml: (d) => `<div class="dpi-dot" style="background:${getDepotColor(d.key)}"></div>`,
    onSearchExpr: `onDepotFilterSearch('${pickerId}', this.value)`,
    onSelectAllExpr: `depotToggleAll('${pickerId}')`,
    onItemClickExpr: (d) => `depotToggleOne('${pickerId}','${d.key}')`,
  });

  const state = ensurePopState(key);
  if (state.open) {
    document.getElementById('pop-' + key)?.classList.add('on');
    document.getElementById('btn-' + key)?.classList.add('open');
  }

  refreshPrintSummaryFor(pickerId);
}

function onDepotFilterSearch(pickerId, value) {
  handleDropdownFilterSearch('depot-' + pickerId, value, () => renderDepotPicker(pickerId));
}

function initDepotPickerDOM(pickerId, _label) {
  renderDepotPicker(pickerId);
}

function depotToggleAll(pickerId) {
  const picker = depotPickers[pickerId];
  if (!picker) return;
  picker.active = new Set(DEPOTS);
  renderDepotPicker(pickerId);
  picker.onChange?.();
}

function depotToggleOne(pickerId, depotKey) {
  const picker = depotPickers[pickerId];
  if (!picker) return;

  if (picker.active.has(depotKey)) {
    picker.active.delete(depotKey);
  } else {
    picker.active.add(depotKey);
    if (picker.active.size === DEPOTS.length) {
      picker.active = new Set(DEPOTS);
    }
  }

  renderDepotPicker(pickerId);

  if (typeof showBriefLoadingOverlay === 'function') {
    showBriefLoadingOverlay('Обновляем…');
    setTimeout(() => { picker.onChange?.(); hideBriefLoadingOverlay(); }, 20);
  } else {
    picker.onChange?.();
  }
}
