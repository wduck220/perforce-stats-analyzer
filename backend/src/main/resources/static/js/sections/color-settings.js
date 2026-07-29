

function rebuildAfterColorChange() {
  if (typeof invalidateFactsCache === 'function') invalidateFactsCache();
  rebuildWholeDashboard();
}

function openColorSettings() {
  buildColorSettingsBody();
  document.getElementById('colorSettingsModal')?.classList.add('on');
}

function closeColorSettings() {
  document.getElementById('colorSettingsModal')?.classList.remove('on');
}

function colorSettingRow(hexValue, label, onChangeExpr) {
  return `
    <div class="color-setting-row">
      <input type="color" value="${hexValue}" onchange="${onChangeExpr}">
      <span>${escapeHtml(label)}</span>
    </div>`;
}

function buildColorSettingsBody() {
  const container = document.getElementById('colorSettingsBody');
  if (!container) return;

  const authorRows = USERS.map((u) =>
    colorSettingRow(u.color, u.name, `setAuthorColorOverride('${u.name.replace(/'/g, "\\'")}', this.value)`)
  ).join('');

  const depotRows = DEPOT_LIST.map((d) =>
    colorSettingRow(getDepotColor(d.key), d.label, `setDepotColorOverride('${d.key}', this.value); rebuildAfterColorChange();`)
  ).join('');

  const wsList = window.WORKSPACE_LIST || [];
  const wsRows = wsList.map((ws) =>
    colorSettingRow(getWorkspaceColor(ws), ws, `setWorkspaceColorOverride('${ws}', this.value); rebuildAfterColorChange();`)
  ).join('');

  container.innerHTML = `
    <div class="color-settings-group">
      <div class="color-settings-title">Авторы</div>
      ${authorRows}
    </div>
    <div class="color-settings-group">
      <div class="color-settings-title">Депо</div>
      ${depotRows}
    </div>
    <div class="color-settings-group">
      <div class="color-settings-title">Воркспейсы</div>
      <div class="color-settings-note">По умолчанию — оттенок цвета автора-владельца (воркспейс "составной" — часть автора); можно задать свой цвет для любого.</div>
      ${wsRows}
    </div>`;
}

function setAuthorColorOverride(name, hex) {
  const user = USERS.find((u) => u.name === name);
  if (!user) return;
  user.color = hex;
  rebuildAfterColorChange();
  buildColorSettingsBody();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeColorSettings();
});
