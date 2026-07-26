

const DOW_EN_AP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const AP_DOW_RU = { Sunday: 'воскресенье', Monday: 'понедельник', Tuesday: 'вторник', Wednesday: 'среда', Thursday: 'четверг', Friday: 'пятница', Saturday: 'суббота' };
const AP_TIME_RU = { morning: 'утро', afternoon: 'день', evening: 'вечер', night: 'ночь' };
const AP_SIZE_ADJ = { small: 'маленький', medium: 'средний', large: 'большой' };
const AP_DESC_ADJ = { short: 'короткое', medium: 'среднее', long: 'длинное' };
const AP_LEVEL_ADJ = { low: 'редко', medium: 'умеренно часто', high: 'часто' };
const AP_ACTION_RU = { edit: 'правки (edit)', add: 'добавления (add)', delete: 'удаления (delete)' };

function apBucket3(val, sortedAll) {
  const n = sortedAll.length;
  const t1 = sortedAll[Math.floor(n / 3)];
  const t2 = sortedAll[Math.floor((2 * n) / 3)];
  return val <= t1 ? 'small' : val <= t2 ? 'medium' : 'large';
}

let apTransactionsCache = null;

function buildApTransactions() {
  if (apTransactionsCache) return apTransactionsCache;
  const commits = anomAllCommits('apriori');
  const fileCountsSorted = commits.map((c) => c.nFiles).sort((a, b) => a - b);
  const sizesSorted = commits.map((c) => c.sizeGB).sort((a, b) => a - b);
  const avgSizesSorted = commits.map((c) => c.sizeGB / c.nFiles).sort((a, b) => a - b);
  const newRatioOf = (c) => {
    const revs = c.files.map((f) => parseInt(String(f.rev || '#0').replace('#', '')) || 0);
    return revs.length ? revs.filter((r) => r === 1).length / revs.length : 0;
  };
  const newRatiosSorted = commits.map(newRatioOf).sort((a, b) => a - b);
  const uniqueExtOf = (c) => new Set(c.files.map((f) => f.ext)).size;
  const uniqueExtSorted = commits.map(uniqueExtOf).sort((a, b) => a - b);

  const byAuthorSorted = {};
  commits.forEach((c) => { (byAuthorSorted[c.author] || (byAuthorSorted[c.author] = [])).push(c); });
  Object.values(byAuthorSorted).forEach((list) => list.sort((a, b) => a.date - b.date));
  const sinceLastHoursMap = new Map();
  Object.values(byAuthorSorted).forEach((list) => {
    for (let i = 0; i < list.length; i++) {
      const gapH = i === 0 ? null : (list[i].date - list[i - 1].date) / 3600000;
      sinceLastHoursMap.set(list[i], gapH);
    }
  });

  apTransactionsCache = commits.map((c) => {
    const items = [];
    items.push(`user:${c.author}`);
    items.push(`depot:${c.depot.replace(/^\/\//, '').replace(/\/$/, '')}`);
    items.push(`workspace:${c.workspace}`);
    const hour = c.date.getHours();
    const timeCat = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
    items.push(`time:${timeCat}`);
    items.push(`weekday:${DOW_EN_AP[c.date.getDay()]}`);
    items.push(`file_count:${apBucket3(c.nFiles, fileCountsSorted)}`);
    items.push(`total_size:${apBucket3(c.sizeGB, sizesSorted)}`);
    items.push(`avg_size:${apBucket3(c.sizeGB / c.nFiles, avgSizesSorted)}`);
    items.push(`desc:${c.desc.length < 15 ? 'short' : c.desc.length < 28 ? 'medium' : 'long'}`);
    items.push(`new_ratio:${apBucket3(newRatioOf(c), newRatiosSorted)}`);
    items.push(`unique_ext:${apBucket3(uniqueExtOf(c), uniqueExtSorted)}`);

    const sinceLastH = sinceLastHoursMap.get(c);
    if (sinceLastH !== null && sinceLastH !== undefined) {
      const sinceCat = sinceLastH < 1 ? '<1h' : sinceLastH < 6 ? '1-6h' : sinceLastH < 24 ? '6-24h' : '>24h';
      items.push(`since_last:${sinceCat}`);
    }

    const extCounts = {};
    c.files.forEach((f) => { extCounts[f.ext] = (extCounts[f.ext] || 0) + 1; });
    Object.entries(extCounts).forEach(([ext, cnt]) => {
      const ratio = cnt / c.nFiles;
      const level = ratio > 0.5 ? 'high' : ratio > 0.15 ? 'medium' : 'low';
      items.push(`ext:${ext}:${level}`);
    });

    const actCounts = {};
    c.files.forEach((f) => { actCounts[f.action] = (actCounts[f.action] || 0) + 1; });
    const topAct = Object.entries(actCounts).sort((a, b) => b[1] - a[1])[0];
    if (topAct) {
      const ratio = topAct[1] / c.nFiles;
      const level = ratio > 0.7 ? 'high' : ratio > 0.4 ? 'medium' : 'low';
      items.push(`action:${topAct[0]}:${level}`);
    }
    return items;
  });
  return apTransactionsCache;
}

const AP_MIN_ITEM_SUPPORT = 0.03;
let apRulesCache = null;

function invalidateApRulesCache() {
  apTransactionsCache = null;
  apRulesCache = null;
}

function computeApRules() {
  if (apRulesCache) return apRulesCache;
  const transactions = buildApTransactions();
  const n = transactions.length;
  if (!n) { apRulesCache = []; return apRulesCache; }

  const itemCounts = {};
  transactions.forEach((t) => { [...new Set(t)].forEach((i) => { itemCounts[i] = (itemCounts[i] || 0) + 1; }); });
  const frequentItems = new Set(Object.keys(itemCounts).filter((i) => itemCounts[i] / n >= AP_MIN_ITEM_SUPPORT));

  const pairCounts = {};
  transactions.forEach((t) => {
    const filtered = [...new Set(t)].filter((i) => frequentItems.has(i));
    for (let i = 0; i < filtered.length; i++) {
      for (let j = 0; j < filtered.length; j++) {
        if (i === j) continue;
        const key = filtered[i] + '\u0001' + filtered[j];
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  });

  const rules = [];
  Object.keys(pairCounts).forEach((key) => {
    const [a, b] = key.split('\u0001');
    const supAB = pairCounts[key] / n;
    if (supAB < AP_MIN_ITEM_SUPPORT) return;
    const supA = itemCounts[a] / n;
    const supB = itemCounts[b] / n;
    const conf = supAB / supA;
    const lift = supB > 0 ? conf / supB : 0;
    if (lift <= 1.05) return;
    rules.push({ ant: [a], cons: [b], sup: supAB, conf, lift });
  });

  rules.sort((a, b) => b.lift - a.lift);
  apRulesCache = rules.slice(0, 150);
  return apRulesCache;
}

function apItemToPhrase(item) {
  const parts = item.split(':');
  const type = parts[0];
  if (type === 'user') return `автор — ${parts[1]}`;
  if (type === 'depot') return `депо ${parts[1]}`;
  if (type === 'workspace') return `воркспейс ${parts[1]}`;
  if (type === 'time') return `время суток — ${AP_TIME_RU[parts[1]] || parts[1]}`;
  if (type === 'weekday') return `день недели — ${AP_DOW_RU[parts[1]] || parts[1]}`;
  if (type === 'file_count') return `${AP_SIZE_ADJ[parts[1]]} число файлов в сабмите`;
  if (type === 'total_size') return `${AP_SIZE_ADJ[parts[1]]} объём сабмита`;
  if (type === 'avg_size') return `${AP_SIZE_ADJ[parts[1]]} средний размер файла`;
  if (type === 'desc') return `${AP_DESC_ADJ[parts[1]]} описание сабмита`;
  if (type === 'new_ratio') return `${AP_SIZE_ADJ[parts[1]]} доля абсолютно новых файлов`;
  if (type === 'unique_ext') return `${AP_SIZE_ADJ[parts[1]]} разнообразие типов файлов`;
  if (type === 'since_last') return `с предыдущего сабмита этого автора прошло ${parts[1]}`;
  if (type === 'ext') return `.${parts[1]}-файлы встречаются ${AP_LEVEL_ADJ[parts[2]]}`;
  if (type === 'action') return `${AP_ACTION_RU[parts[1]] || parts[1]} встречаются ${AP_LEVEL_ADJ[parts[2]]}`;
  return item;
}

function apRuleSentence(r) {
  const antText = r.ant.map(apItemToPhrase).join(' и ');
  const consText = r.cons.map(apItemToPhrase).join(' и ');
  return `Если ${antText} — то, скорее всего, ${consText}`;
}

window.apViewMode = 'functional';
window.apSortBy = 'lift';
let apUserExpanded = null;
let apFuncExpanded = null;
function toggleApFuncTranslate(idx) {
  apFuncExpanded = apFuncExpanded === idx ? null : idx;
  renderApriori();
}
let apChartInst = null;

function setApViewMode(mode) {
  window.apViewMode = mode;
  document.querySelectorAll('.ap-view-tab').forEach((btn) => {
    btn.classList.toggle('on', btn.getAttribute('data-mode') === mode);
  });
  document.getElementById('aprioriList').style.display = mode === 'functional' ? '' : 'none';
  document.getElementById('aprioriListUser').style.display = mode === 'user' ? '' : 'none';
}

const AP_SORT_CRITERIA_META = {
  lift: 'Lift',
  conf: 'Confidence',
  sup: 'Support',
};
window.apSortCriteria = ['lift'];

function renderApSortList() {
  const list = document.getElementById('apSortList');
  const addSelect = document.getElementById('apSortAdd');
  if (!list || !addSelect) return;

  list.innerHTML = window.apSortCriteria.map((key, i) => `
    <div class="ap-sort-chip">
      <span class="ap-sort-chip-rank">${i + 1}</span>
      <span class="ap-sort-chip-name">${AP_SORT_CRITERIA_META[key]}</span>
      <button class="ap-sort-chip-btn" onclick="apMoveSortCriterion('${key}', -1)" ${i === 0 ? 'disabled' : ''} title="Выше">↑</button>
      <button class="ap-sort-chip-btn" onclick="apMoveSortCriterion('${key}', 1)" ${i === window.apSortCriteria.length - 1 ? 'disabled' : ''} title="Ниже">↓</button>
      <button class="ap-sort-chip-btn ap-sort-chip-remove" onclick="apRemoveSortCriterion('${key}')" title="Убрать">×</button>
    </div>`).join('') || '<span style="color:var(--muted);font-size:11px">Нет активных критериев — порядок будет как в данных</span>';

  const remaining = Object.keys(AP_SORT_CRITERIA_META).filter((k) => !window.apSortCriteria.includes(k));
  addSelect.innerHTML = '<option value="">+ добавить критерий</option>' + remaining.map((k) => `<option value="${k}">${AP_SORT_CRITERIA_META[k]}</option>`).join('');
  addSelect.disabled = remaining.length === 0;
}

function apAddSortCriterion(key) {
  if (!key || window.apSortCriteria.includes(key)) return;
  window.apSortCriteria.push(key);
  renderApSortList();
  renderApriori();
}

function apRemoveSortCriterion(key) {
  window.apSortCriteria = window.apSortCriteria.filter((k) => k !== key);
  renderApSortList();
  renderApriori();
}

function apMoveSortCriterion(key, dir) {
  const idx = window.apSortCriteria.indexOf(key);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= window.apSortCriteria.length) return;
  [window.apSortCriteria[idx], window.apSortCriteria[newIdx]] = [window.apSortCriteria[newIdx], window.apSortCriteria[idx]];
  renderApSortList();
  renderApriori();
}

function toggleApUserRule(idx) {
  apUserExpanded = apUserExpanded === idx ? null : idx;
  renderApriori();
}

function apScrollToRule(idx) {
  const mode = window.apViewMode || 'functional';
  const id = mode === 'functional' ? `ap-rule-func-${idx}` : `ap-rule-user-${idx}`;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('ap-rule-flash');
  setTimeout(() => el.classList.remove('ap-rule-flash'), 1400);
  if (mode === 'user' && apUserExpanded !== idx) {
    apUserExpanded = idx;
    renderApriori();
    setTimeout(() => {
      const el2 = document.getElementById(id);
      if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }
}

function apClampField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (id === 'apMax') {
    const allRules = computeApRules();
    let minLift = parseFloat(document.getElementById('apLift').value); if (isNaN(minLift) || minLift < 0) minLift = 0;
    let confPct = parseFloat(document.getElementById('apConf').value); if (isNaN(confPct) || confPct < 0) confPct = 0; if (confPct > 100) confPct = 100;
    let supPct = parseFloat(document.getElementById('apSup').value); if (isNaN(supPct) || supPct < 0) supPct = 0; if (supPct > 100) supPct = 100;
    const matched = allRules.filter((r) => r.lift >= minLift && r.conf >= (confPct / 100) && r.sup >= (supPct / 100));
    let maxN = parseInt(el.value, 10);
    if (isNaN(maxN) || maxN < 1) maxN = matched.length ? 1 : 0;
    if (maxN > matched.length) maxN = matched.length;
    el.value = String(maxN);
    if (matched.length > 0) el.max = String(matched.length);
  } else if (id === 'apLift') {
    let v = parseFloat(el.value);
    if (isNaN(v) || v < 0) v = 0;
    el.value = String(v);
  } else {
    let v = parseFloat(el.value);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 100) v = 100;
    el.value = String(v);
  }
  renderApriori();
}

const AP_AXIS_META = {
  sup: { label: 'Support, %', get: (r) => +(r.sup * 100).toFixed(1) },
  conf: { label: 'Confidence, %', get: (r) => +(r.conf * 100).toFixed(1) },
  lift: { label: 'Lift', get: (r) => +r.lift.toFixed(2) },
};
window.apChartAxisX = 'sup';
window.apChartAxisY = 'conf';
let apChartLastKey = null;

function setApChartAxis(axis, key) {
  if (axis === 'x') window.apChartAxisX = key;
  else window.apChartAxisY = key;
  apChartLastKey = null;
  renderApChart(window.apLastFiltered || []);
}

function renderApChart(filtered) {
  window.apLastFiltered = filtered;
  const canvas = document.getElementById('apChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const axisX = window.apChartAxisX || 'sup';
  const axisY = window.apChartAxisY || 'conf';
  const sigKey = axisX + '|' + axisY + '|' + filtered.map((r) => r.ant.join(',') + '>' + r.cons.join(',')).join(';');
  if (sigKey === apChartLastKey && apChartInst) return;
  apChartLastKey = sigKey;

  if (apChartInst) apChartInst.destroy();
  const metaX = AP_AXIS_META[axisX];
  const metaY = AP_AXIS_META[axisY];
  const colorOf = (lift) => (lift > 2.5 ? '#f85149' : lift > 1.5 ? '#d29922' : '#58a6ff');
  apChartInst = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Правила',
        data: filtered.map((r) => ({ x: metaX.get(r), y: metaY.get(r) })),
        backgroundColor: filtered.map((r) => colorOf(r.lift) + 'aa'),
        borderColor: filtered.map((r) => colorOf(r.lift)),
        pointRadius: filtered.map((r) => Math.min(11, 4 + r.lift * 1.4)),
        pointHoverRadius: filtered.map((r) => Math.min(14, 6 + r.lift * 1.4)),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        apScrollToRule(elements[0].index);
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {

          callbacks: {
            title: () => '',
            label: (ctx) => {
              const r = filtered[ctx.dataIndex];
              return [apRuleSentence(r), `sup ${(r.sup * 100).toFixed(0)}% · conf ${(r.conf * 100).toFixed(0)}% · lift ${r.lift.toFixed(1)}`];
            },
            afterLabel: () => 'клик — найти в списке',
          },
        },
      },
      scales: {
        x: { title: { display: true, text: metaX.label, color: themeColor('muted'), font: { size: 10 } }, grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') } },
        y: { title: { display: true, text: metaY.label, color: themeColor('muted'), font: { size: 10 } }, grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') } },
      },
    },
  });
}

function renderApriori() {
  const lpWrap = document.getElementById('lpWrap_apriori');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('apriori', 'renderApriori');
  const liftInput = document.getElementById('apLift');
  const confInput = document.getElementById('apConf');
  const supInput = document.getElementById('apSup');
  const maxInput = document.getElementById('apMax');

  let minLift = parseFloat(liftInput.value);
  if (isNaN(minLift) || minLift < 0) minLift = 0;

  let confPct = parseFloat(confInput.value);
  if (isNaN(confPct) || confPct < 0) confPct = 0;
  if (confPct > 100) confPct = 100;

  let supPct = parseFloat(supInput.value);
  if (isNaN(supPct) || supPct < 0) supPct = 0;
  if (supPct > 100) supPct = 100;

  const minConf = confPct / 100;
  const minSup = supPct / 100;

  const allRules = computeApRules();
  const matched = allRules.filter((r) => r.lift >= minLift && r.conf >= minConf && r.sup >= minSup);

  let maxN = parseInt(maxInput.value, 10);
  if (isNaN(maxN) || maxN < 1) maxN = matched.length ? 1 : 0;
  if (maxN > matched.length) maxN = matched.length;

  const criteria = window.apSortCriteria && window.apSortCriteria.length ? window.apSortCriteria : ['lift'];
  matched.sort((a, b) => {
    for (const key of criteria) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }
    return 0;
  });
  const filtered = matched.slice(0, maxN);

  document.getElementById('apCount').textContent = `показано ${filtered.length} из ${allRules.length}`;

  if (!filtered.length) {
    document.getElementById('aprioriList').innerHTML = '<div style="padding:16px 14px;color:var(--muted);font-size:12px">Нет правил, удовлетворяющих фильтрам</div>';
    document.getElementById('aprioriListUser').innerHTML = '<div style="padding:16px 14px;color:var(--muted);font-size:12px">Нет правил, удовлетворяющих фильтрам</div>';
    if (apChartInst) { apChartInst.destroy(); apChartInst = null; }
    return;
  }

  document.getElementById('aprioriList').innerHTML = filtered.map((r, i) => `
    <div class="rule" id="ap-rule-func-${i}" onclick="toggleApFuncTranslate(${i})" style="cursor:pointer;flex-wrap:wrap">
      <span>${r.ant.map((a) => `<span class="badge bp" style="margin-right:3px">${a}</span>`).join('')}</span>
      <span class="rule-arrow">→</span>
      <span>${r.cons.map((c) => `<span class="badge bb" style="margin-right:3px">${c}</span>`).join('')}</span>
      <div class="rule-m">
        <span class="rule-mi">sup <span>${(r.sup * 100).toFixed(0)}%</span></span>
        <span class="rule-mi">conf <span>${(r.conf * 100).toFixed(0)}%</span></span>
        <span class="rule-mi">lift <span>${r.lift.toFixed(1)}</span></span>
      </div>
      ${apFuncExpanded === i ? `<div class="rule-translate" onclick="event.stopPropagation()">${apRuleSentence(r)}</div>` : ''}
    </div>`).join('');

  document.getElementById('aprioriListUser').innerHTML = filtered.map((r, i) => {
    const isOpen = apUserExpanded === i;
    return `
    <div class="ap-user-rule${isOpen ? ' open' : ''}" id="ap-rule-user-${i}" onclick="toggleApUserRule(${i})">
      <div class="ap-user-sentence">${apRuleSentence(r)}</div>
      ${isOpen ? `
      <div class="ap-user-detail">
        <div class="ap-user-detail-row"><b>Частота (support): ${(r.sup * 100).toFixed(0)}%</b> — так часто это сочетание встречается в данных в целом (учитываются не только сами сабмиты, а все их характеристики — автор, депо, воркспейс, время, объём, типы файлов и т.д.).</div>
        <div class="ap-user-detail-row"><b>Уверенность (confidence): ${(r.conf * 100).toFixed(0)}%</b> — если условие выполняется, с такой вероятностью выполняется и следствие.</div>
        <div class="ap-user-detail-row"><b>Сила связи (lift): ${r.lift.toFixed(1)}</b> — связь в ${r.lift.toFixed(1)}× сильнее, чем если бы события были независимы (1.0 — совпадение случайно, чем больше — тем меньше похоже на случайность).</div>
      </div>` : ''}
    </div>`;
  }).join('');

  renderApChart(filtered);
}

if (document.getElementById('aprioriList')) {
  renderApSortList();
  renderApriori();
}
