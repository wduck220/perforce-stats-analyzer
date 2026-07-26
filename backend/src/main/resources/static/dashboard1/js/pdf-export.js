

function pdfNewDoc(title) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc._cursorY = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 40, doc._cursorY);
  doc._cursorY += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Perforce Analytics / burgettakeout / ' + new Date().toISOString().slice(0, 19).replace('T', ' '), 40, doc._cursorY);
  doc._cursorY += 24;
  return doc;
}

function pdfEnsureSpace(doc, neededHeight) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (doc._cursorY + neededHeight > pageHeight - 30) {
    doc.addPage();
    doc._cursorY = 40;
  }
}

function pdfAddSectionTitle(doc, text) {
  pdfEnsureSpace(doc, 34);

  doc.setFillColor(240, 136, 62);
  doc.rect(40, doc._cursorY - 10, 3, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(text, 48, doc._cursorY);
  doc.setFont('helvetica', 'normal');
  doc._cursorY += 18;
}

function pdfHexToRgb(hex) {
  if (!hex || hex[0] !== '#') return [125, 133, 144];
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function pdfAnyColorToRgb(color) {
  if (!color) return [125, 133, 144];
  if (color[0] === '#') return pdfHexToRgb(color);
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  return [125, 133, 144];
}

function pdfDrawChipRow(doc, label, items, indent, showCount) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxX = pageWidth - 40;
  let x = 40 + (indent || 0);
  doc.setFontSize(7.5);
  if (label || showCount) {
    const onCount = items.filter((i) => !i.excl).length;
    const countStr = showCount ? `(${onCount}/${items.length}) ` : '';
    const fullLabel = `${label || ''}${countStr}`;
    doc.setTextColor(90, 90, 90);
    doc.text(fullLabel, x, doc._cursorY);
    x += doc.getTextWidth(fullLabel) + 4;
  }
  items.forEach((item) => {
    const textW = doc.getTextWidth(item.name) + (item.excl ? doc.getTextWidth(' (excl.)') : 0);
    const chipW = 10 + textW + 10;
    if (x + chipW > maxX) { doc._cursorY += 12; x = 40 + (indent || 0) + (label ? doc.getTextWidth(label) + 6 : 0); }
    const rgb = pdfHexToRgb(item.color);
    doc.setFillColor(item.excl ? 210 : rgb[0], item.excl ? 210 : rgb[1], item.excl ? 210 : rgb[2]);
    doc.circle(x + 2, doc._cursorY - 2.5, 2, 'F');
    doc.setTextColor(item.excl ? 170 : 60, item.excl ? 170 : 60, item.excl ? 170 : 60);
    doc.text(item.name + (item.excl ? ' (excl.)' : ''), x + 7, doc._cursorY);
    x += chipW;
  });
  doc._cursorY += 12;
  doc.setTextColor(20, 20, 20);
  return doc._cursorY;
}

function pdfAddPeriodInfo(doc, scope) {
  if (typeof daysForBlock !== 'function') return;
  const days = daysForBlock(scope);
  if (!days || !days.length) return;
  const from = days[0].date, to = days[days.length - 1].date;
  const fmt = (d) => d.toISOString().slice(0, 10);
  pdfEnsureSpace(doc, 12);
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text(`Period: ${fmt(from)} — ${fmt(to)} (${days.length} days)`, 40, doc._cursorY);
  doc._cursorY += 12;
  doc.setTextColor(20, 20, 20);
}

function pdfAddFilterSummary(doc, scope, hasTree) {
  const authorRows = [];
  if (hasTree && typeof USERS !== 'undefined') {
    USERS.forEach((u) => {
      const authorOn = typeof isAuthorActiveInScope === 'function' ? isAuthorActiveInScope(scope, u.name) : true;
      const ownedWs = typeof workspacesOwnedBy === 'function' ? workspacesOwnedBy(u.name) : [];
      const wp = typeof workspacePickers !== 'undefined' ? workspacePickers[scope] : null;
      const wsItems = ownedWs.map((ws) => ({
        name: ws,
        color: typeof getWorkspaceColor === 'function' ? getWorkspaceColor(ws) : '#7d8590',
        excl: !(authorOn && (!wp || wp.active.has(ws))),
      }));
      authorRows.push({ author: { name: u.name, color: u.color, excl: !authorOn }, wsItems });
    });
  }
  let depotItems = [];
  if (typeof DEPOT_LIST !== 'undefined' && typeof depotPickers !== 'undefined' && depotPickers[scope]) {
    const dp = depotPickers[scope];
    depotItems = DEPOT_LIST.map((d) => ({
      name: d.label,
      color: typeof getDepotColor === 'function' ? getDepotColor(d.key) : '#7d8590',
      excl: !dp.active.has(d.key),
    }));
  }

  let extItems = [];
  if (typeof EXTS_LIST !== 'undefined' && typeof extensionPickers !== 'undefined' && extensionPickers[scope]) {
    const ep = extensionPickers[scope];
    extItems = EXTS_LIST.map((ext) => ({ name: '.' + ext, color: '#7d8590', excl: !ep.has(ext) }));
  }
  if (!authorRows.length && !depotItems.length && !extItems.length) return;

  pdfEnsureSpace(doc, (authorRows.length + 3) * 13 + 10);
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text('Active filters:', 40, doc._cursorY);
  doc._cursorY += 12;
  authorRows.forEach((row) => {
    pdfDrawChipRow(doc, null, [row.author], 0);
    if (row.wsItems.length) pdfDrawChipRow(doc, null, row.wsItems, 12, true);
  });
  if (depotItems.length) pdfDrawChipRow(doc, 'Depots: ', depotItems, 0, true);
  if (extItems.length) pdfDrawChipRow(doc, 'Extensions: ', extItems, 0, true);
  doc._cursorY += 6;
  doc.setTextColor(20, 20, 20);
}

function pdfAddTable(doc, headers, rows, columnStyles) {
  if (!rows || !rows.length) return;
  pdfEnsureSpace(doc, 50);
  doc.autoTable({
    startY: doc._cursorY,
    head: headers ? [headers] : undefined,
    body: rows,
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 4, overflow: 'linebreak', lineColor: [230, 230, 230], lineWidth: 0.5 },
    headStyles: { font: 'helvetica', fillColor: [33, 38, 45], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [247, 248, 249] },
    columnStyles: columnStyles || undefined,
    margin: { left: 40, right: 40 },
    theme: 'striped',
  });
  doc._cursorY = doc.lastAutoTable.finalY + 20;
}

function pdfOpaqueColors(value) {
  if (Array.isArray(value)) return value.map(pdfOpaqueColors);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k in value) out[k] = pdfOpaqueColors(value[k]);
    return out;
  }
  if (typeof value === 'string' && /^rgba\(/.test(value)) {

    return value.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/, (m, r, g, b, a) => {
      const boosted = Math.min(1, parseFloat(a) * 4);
      return `rgba(${r},${g},${b},${boosted})`;
    });
  }
  return value;
}

function pdfTranslateChartText(data) {
  const tr = (s) => (typeof translateLabel === 'function' ? translateValueSubstrings(translateLabel(String(s))) : s);
  const out = { ...data };
  if (Array.isArray(out.labels)) out.labels = out.labels.map(tr);
  if (Array.isArray(out.datasets)) {
    out.datasets = out.datasets.map((ds) => (ds && ds.label ? { ...ds, label: tr(ds.label) } : ds));
  }
  return out;
}

function pdfWrapAxisCallbacks(scales) {
  if (!scales) return scales;
  const out = {};
  for (const axisKey in scales) {
    const axis = scales[axisKey];
    if (!axis) { out[axisKey] = axis; continue; }
    let updated = axis;
    if (axis.ticks && typeof axis.ticks.callback === 'function') {
      const origCb = axis.ticks.callback;
      updated = { ...updated, ticks: { ...axis.ticks, callback: function (...args) { return translateValueSubstrings(String(origCb.apply(this, args))); } } };
    }
    if (axis.title && axis.title.text) {
      updated = { ...updated, title: { ...axis.title, text: translateValueSubstrings(String(axis.title.text)) } };
    }
    out[axisKey] = updated;
  }
  return out;
}

function pdfCapturePrintableChart(canvasId) {
  const chart = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
  if (!chart) return null;
  const srcCanvas = document.getElementById(canvasId);
  const tmpCanvas = document.createElement('canvas');

  const isPieLike = chart.config.type === 'pie' || chart.config.type === 'doughnut';

  const logicalWidth = isPieLike ? Math.max(320, srcCanvas.getBoundingClientRect().width || srcCanvas.width) : (srcCanvas.getBoundingClientRect().width || srcCanvas.width);
  const logicalHeight = isPieLike ? Math.max(220, srcCanvas.getBoundingClientRect().height || srcCanvas.height) : (srcCanvas.getBoundingClientRect().height || srcCanvas.height);
  const hasMultipleDatasets = Array.isArray(chart.config.data.datasets) && chart.config.data.datasets.length > 1;
  const needsLegend = hasMultipleDatasets || isPieLike;
  const legendExtraHeight = needsLegend ? 50 : 0;
  tmpCanvas.style.width = logicalWidth + 'px';
  tmpCanvas.style.height = (logicalHeight + legendExtraHeight) + 'px';
  tmpCanvas.style.position = 'fixed';
  tmpCanvas.style.left = '-9999px';
  document.body.appendChild(tmpCanvas);

  const printOptions = Object.assign({}, chart.config.options, {
    responsive: false, animation: false, maintainAspectRatio: false, devicePixelRatio: 3,
  });
  if (printOptions.scales) printOptions.scales = pdfWrapAxisCallbacks(printOptions.scales);
  printOptions.plugins = Object.assign({}, printOptions.plugins, {

    legend: needsLegend
      ? { display: true, position: 'bottom', labels: { color: '#333', font: { size: 11 }, boxWidth: 12 } }
      : { display: false },
  });
  const printConfig = {
    type: chart.config.type,
    data: pdfOpaqueColors(pdfTranslateChartText(chart.config.data)),
    options: printOptions,
  };

  const whiteBgPlugin = { id: 'pdfWhiteBg', beforeDraw: (c) => {
    const ctx = c.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  } };

  let imgData = null;
  try {
    const tmpChart = new Chart(tmpCanvas, { ...printConfig, plugins: [whiteBgPlugin] });
    imgData = tmpCanvas.toDataURL('image/png', 1.0);
    tmpChart.destroy();
  } catch (e) {  }
  document.body.removeChild(tmpCanvas);
  if (!imgData) return null;

  return { imgData, width: logicalWidth, height: logicalHeight + legendExtraHeight };
}

function pdfAddChartImage(doc, canvasId, title) {
  const canvas = document.getElementById(canvasId);
  const chart = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
  if (!canvas || !chart || !canvas.width || !canvas.height) return false;
  const captured = pdfCapturePrintableChart(canvasId);
  let imgData, effectiveWidth, effectiveHeight;
  if (captured) {
    imgData = captured.imgData;
    effectiveWidth = captured.width;
    effectiveHeight = captured.height;
  } else {
    try { imgData = canvas.toDataURL('image/png', 1.0); } catch (e) { return false; }
    effectiveWidth = canvas.width;
    effectiveHeight = canvas.height;
  }
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - 80;
  const imgHeight = Math.min(300, maxWidth * (effectiveHeight / effectiveWidth));
  const imgWidth = imgHeight * (effectiveWidth / effectiveHeight);
  pdfEnsureSpace(doc, imgHeight + (title ? 34 : 16));
  if (title) pdfAddSectionTitle(doc, title);
  doc.addImage(imgData, 'PNG', 40, doc._cursorY, imgWidth, imgHeight);
  doc._cursorY += imgHeight + 20;
  return true;
}

function pdfSave(doc, filename) {
  doc.save(filename.endsWith('.pdf') ? filename : filename + '.pdf');
}

function pdfFromHtmlTable(title, tableId, filename, chartCanvasId, scope, hasTree) {
  const tableEl = document.getElementById(tableId);
  if (!tableEl) return;
  const trs = [...tableEl.querySelectorAll('tr')];
  if (!trs.length) { alert('Нет данных для экспорта.'); return; }
  const headers = [...trs[0].children].map((td) => translateCsvHeaderRow([td.innerText.replace(/\s*\n\s*/g, ' ').trim()])[0]);
  const rows = trs.slice(1).map((tr) => [...tr.children].map((td) => translateValueSubstrings(td.innerText.replace(/\s*\n\s*/g, ' ').trim())));
  const doc = pdfNewDoc(title);
  if (scope) { pdfAddPeriodInfo(doc, scope); pdfAddFilterSummary(doc, scope, !!hasTree); }
  if (chartCanvasId) pdfAddChartImage(doc, chartCanvasId);
  pdfAddTable(doc, headers, rows);
  pdfSave(doc, filename);
}

function pdfFromBarTable(title, tableId, headers, filename, chartCanvasId, scope, hasTree) {
  const tableEl = document.getElementById(tableId);
  if (!tableEl) return;
  const rows = [];
  tableEl.querySelectorAll('tbody tr, tr:not(thead tr)').forEach((tr) => {
    if (tr.closest('thead')) return;
    const cells = [...tr.children]
      .filter((td) => td.innerText.trim().length > 0)
      .map((td) => translateValueSubstrings(td.innerText.replace(/\s*\n\s*/g, ' | ').trim()));
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) { alert('Нет данных для экспорта.'); return; }
  const doc = pdfNewDoc(title);
  if (scope) { pdfAddPeriodInfo(doc, scope); pdfAddFilterSummary(doc, scope, !!hasTree); }
  if (chartCanvasId) {
    pdfAddChartImage(doc, chartCanvasId);
  } else {

    const valueIdx = rows[0].length - 1;
    const numericRows = rows.filter((r) => !isNaN(parseFloat(r[valueIdx])));
    if (numericRows.length) {
      pdfAddSectionTitle(doc, 'Chart');
      const maxVal = Math.max(...numericRows.map((r) => parseFloat(r[valueIdx]) || 0), 1);
      pdfAddBarViz(doc, numericRows.slice(0, 20), 0, valueIdx, maxVal);
    }
  }
  pdfAddTable(doc, headers, rows);
  pdfSave(doc, filename);
}

function pdfFromDivRows(title, containerSel, rowSel, headers, filename, scope, hasTree) {
  const container = document.querySelector(containerSel);
  if (!container) return;
  const rowEls = container.querySelectorAll(rowSel);
  if (!rowEls.length) { alert('Нет данных для экспорта.'); return; }
  const rows = [];
  rowEls.forEach((rowEl) => {
    const cells = [...rowEl.children]
      .filter((c) => c.innerText.trim().length > 0)
      .map((c) => translateValueSubstrings(c.innerText.replace(/\s*\n\s*/g, ' ').trim()));
    if (cells.length) rows.push(cells);
  });
  const doc = pdfNewDoc(title);
  if (scope) { pdfAddPeriodInfo(doc, scope); pdfAddFilterSummary(doc, scope, !!hasTree); }

  const valueIdx = rows.length ? rows[0].length - 1 : -1;
  const withPct = rows.map((r) => {
    const m = String(r[valueIdx]).match(/([\d.]+)\s*%/);
    return m ? parseFloat(m[1]) : null;
  });
  if (valueIdx >= 0 && withPct.some((v) => v !== null)) {
    pdfAddSectionTitle(doc, 'Chart');
    const barRows = rows.filter((_, i) => withPct[i] !== null).map((r, i) => [r[0], withPct.filter((v) => v !== null)[i]]);
    pdfAddBarViz(doc, barRows.slice(0, 20), 0, 1, 100);
  }
  pdfAddTable(doc, headers, rows);
  pdfSave(doc, filename);
}

function pdfFromCards(title, containerSel, filename) {
  const container = document.querySelector(containerSel);
  if (!container) return;
  const cards = container.querySelectorAll('.fc');
  if (!cards.length) { alert('Нет карточек для экспорта.'); return; }
  const rows = [...cards].map((c) => [
    translateLabel(c.querySelector('.fc-label')?.innerText.trim() || ''),
    translateValueSubstrings(c.querySelector('.fc-val')?.innerText.trim() || ''),
    translateValueSubstrings(c.querySelector('.fc-sub')?.innerText.trim() || ''),
  ]);
  const doc = pdfNewDoc(title);
  pdfAddTable(doc, ['Metric', 'Value', 'Note'], rows);
  pdfSave(doc, filename);
}

function pdfChartToTableRows(canvasId) {
  const chart = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
  if (!chart) return null;
  const { labels, datasets } = chart.data;
  if (!datasets || !datasets.length) return null;
  const isScatterLike = datasets[0].data && datasets[0].data.length && typeof datasets[0].data[0] === 'object' && !Array.isArray(datasets[0].data[0]);
  let headers, rows;
  if (isScatterLike) {
    const xTitle = translateValueSubstrings(chart.options?.scales?.x?.title?.text || 'X');
    const yTitle = translateValueSubstrings(chart.options?.scales?.y?.title?.text || 'Y');
    headers = ['Series', xTitle, yTitle];
    rows = [];
    datasets.forEach((ds) => (ds.data || []).forEach((pt) => rows.push([translateValueSubstrings(ds.label || ''), pt.x, pt.y])));
  } else {
    headers = ['', ...datasets.map((ds) => translateValueSubstrings(ds.label || ''))];
    rows = (labels || []).map((lbl, i) => [translateValueSubstrings(String(lbl)), ...datasets.map((ds) => ds.data[i] ?? '')]);
  }
  return rows.length ? { headers, rows } : null;
}

function pdfFromChart(title, canvasId, filename, scope, hasTree) {
  const doc = pdfNewDoc(title);
  if (scope) { pdfAddPeriodInfo(doc, scope); pdfAddFilterSummary(doc, scope, !!hasTree); }
  const added = pdfAddChartImage(doc, canvasId);
  if (!added) { alert('График сейчас не отрисован — нечего экспортировать.'); return; }

  const tableData = pdfChartToTableRows(canvasId);
  if (tableData) { pdfAddSectionTitle(doc, 'Data'); pdfAddTable(doc, tableData.headers, tableData.rows); }
  pdfSave(doc, filename);
}

const PDF_ALL_CHARTS = [
  ['avgChart', 'Distribution', 'dist', true],
  ['weekChart', 'Trend over time', 'trend', true],
  ['userBarChart', 'Authors - Comparison', 'bar', true],
  ['scatterChart', 'Authors - Scatter', 'scatter', true],
  ['authorClusterChart', 'Authors - Clustering', 'authorcluster', true],
  ['fileStackChart', 'Files - Extensions', 'filestack', false],
  ['fileClusterChart', 'Files - Clustering', 'filecluster', false],
  ['fileCorrelChart', 'Files - Correlations', 'filecorrel', false],
  ['anomChart', 'Anomalies', 'anomalies', false],
  ['apChart', 'Apriori', 'apriori', false],
  ['tlChart', 'Timeline', null, false],
  ['hfChurnChart', 'Hot Files - Churn (selected file)', 'hotfiles', false],
];

async function exportAllToPDF() {
  const doc = pdfNewDoc('Perforce Analytics - Full Report');
  const exporters = typeof collectAllExporters === 'function' ? collectAllExporters() : [];
  const resultsByFile = {};
  exporters.forEach((getResult) => {
    let result;
    try { result = getResult(); } catch (e) { result = null; }
    if (result && result.rows && result.rows.length > 1) resultsByFile[result.filename] = result;
  });
  const ROW_CAP = 20;
  const addTableIfFound = (filename, sectionTitle) => {
    const r = resultsByFile[filename];
    if (!r) return;
    if (sectionTitle) pdfAddSectionTitle(doc, sectionTitle);

    const isSectionMarker = (row) => row.length === 1 && /^—.*—$/.test(row[0]);
    if (r.rows.some(isSectionMarker)) {
      let i = 0;
      while (i < r.rows.length) {
        if (isSectionMarker(r.rows[i])) {
          const subTitle = r.rows[i][0].replace(/^—\s*|\s*—$/g, '');
          i++;
          const header = r.rows[i]; i++;
          const body = [];
          while (i < r.rows.length && !isSectionMarker(r.rows[i]) && r.rows[i].length) { body.push(r.rows[i]); i++; }
          if (body.length) { pdfAddSectionTitle(doc, subTitle); pdfAddTable(doc, header, body.slice(0, ROW_CAP)); }
        } else { i++; }
      }
      return;
    }
    const total = r.rows.length - 1;
    pdfAddTable(doc, r.rows[0], r.rows.slice(1, 1 + ROW_CAP));
    if (total > ROW_CAP) {
      doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
      doc.text(`Showing top ${ROW_CAP} of ${total} rows — full data available via CSV export.`, 40, doc._cursorY);
      doc._cursorY += 16;
    }
  };
  const addChartSection = (canvasId, title, scope, hasTree) => {
    pdfAddSectionTitle(doc, title);
    const added = pdfAddChartImage(doc, canvasId);
    if (scope) { pdfAddPeriodInfo(doc, scope); pdfAddFilterSummary(doc, scope, hasTree); }
    const tableData = pdfChartToTableRows(canvasId);
    if (tableData) pdfAddTable(doc, tableData.headers, tableData.rows.slice(0, ROW_CAP));
    if (!added && !tableData) { doc.setFontSize(8); doc.setTextColor(140, 140, 140); doc.text('Not currently rendered.', 40, doc._cursorY); doc._cursorY += 14; }
  };

  pdfAddSectionTitle(doc, 'Heatmap');
  pdfAddPeriodInfo(doc, 'heatmap');
  pdfAddFilterSummary(doc, 'heatmap', false);
  pdfAddHeatmapGrid(doc);

  addChartSection('avgChart', 'Distribution', 'dist', true);
  addChartSection('weekChart', 'Trend', 'trend', true);

  pdfAddSectionTitle(doc, 'Authors');
  addTableIfFound('authors_full.csv', 'Cards');
  pdfAddSectionTitle(doc, 'Share (donut)');
  pdfAddChartImage(doc, 'authorDonutChart');
  addChartSection('authorClusterChart', 'Clustering', 'authorcluster', true);
  addChartSection('userBarChart', 'Comparison', 'bar', true);
  addChartSection('scatterChart', 'Scatter', 'scatter', true);

  pdfAddSectionTitle(doc, 'Files');
  addTableIfFound('files_top.csv', 'Top Files');
  addChartSection('fileStackChart', 'Extensions', 'filestack', false);
  addTableIfFound('files_cooccurrence.csv', 'Co-occurrence');
  addTableIfFound('files_clustering.csv', 'Clustering (by type)');
  addChartSection('fileClusterChart', 'Clustering (chart)', 'filecluster', false);
  addChartSection('fileCorrelChart', 'Correlations', 'filecorrel', false);

  pdfAddSectionTitle(doc, 'Anomalies');
  pdfAddPeriodInfo(doc, 'anomalies');
  pdfAddChartImage(doc, 'anomChart');
  addTableIfFound('anomalies_submits.csv', null);
  addTableIfFound('anomalies_share_by_group.csv', 'Share by Group');
  addTableIfFound('anomalies_feature_combos.csv', 'Feature Combos');
  addTableIfFound('anomalies_method_agreement.csv', 'Method Agreement');
  addTableIfFound('anomalies_top_differing_features.csv', 'Top Differing Features');

  pdfAddSectionTitle(doc, 'Apriori');
  pdfAddPeriodInfo(doc, 'apriori');
  pdfAddChartImage(doc, 'apChart');
  addTableIfFound('apriori_rules.csv', null);

  pdfAddSectionTitle(doc, 'Facts');
  Object.keys(resultsByFile).filter((f) => f.startsWith('facts_')).forEach((f) => addTableIfFound(f, f.replace('facts_', '').replace('.csv', '')));

  pdfAddSectionTitle(doc, 'Bus Factor');
  pdfAddPeriodInfo(doc, 'busfactor');
  pdfAddFilterSummary(doc, 'busfactor', true);
  ['impact', 'depots', 'files', 'ownership', 'bytype', 'handoff'].forEach((v) => {
    const { headers, rows } = typeof bfViewToTableData === 'function' ? bfViewToTableData(v) : { headers: [], rows: [] };
    if (!rows.length) return;
    pdfAddSectionTitle(doc, v.charAt(0).toUpperCase() + v.slice(1));
    if (v === 'impact') {
      const maxRisk = Math.max(...rows.map((r) => parseFloat(r[1]) || 0), 1);
      pdfAddBarViz(doc, rows.slice(0, 15), 0, 1, maxRisk);
    }
    if (v === 'handoff') {
      const spreading = rows.filter((r) => r[1] === 'knowledge spreading').length;
      const risk = rows.filter((r) => r[1].includes('risk')).length;
      const isWs = window.bfDimension === 'workspace';
      pdfAddTwoBoxSummary(doc, spreading, 'files — knowledge already spreading', risk, `files — still touched by one ${isWs ? 'workspace' : 'person'} only`);
    }
    pdfAddTable(doc, headers, rows.slice(0, ROW_CAP));
  });

  addChartSection('tlChart', 'Timeline', 'timeline', false);

  pdfAddSectionTitle(doc, 'Hot Files & Churn');
  pdfAddPeriodInfo(doc, 'hotfiles');
  pdfAddFilterSummary(doc, 'hotfiles', false);
  if (typeof buildHotFiles === 'function' && !window._hfFiles) buildHotFiles();
  ['hot', 'churn', 'cold', 'new'].forEach((t) => {
    const data = typeof hfTabToComprehensiveRows === 'function' ? hfTabToComprehensiveRows(t) : null;
    if (!data || !data.rows.length) return;
    pdfAddSectionTitle(doc, translateLabel(HF_CFG[t].title));
    pdfAddTable(doc, data.headers, data.rows.slice(0, ROW_CAP), { 0: { cellWidth: 180 } });
  });
  addChartSection('hfChurnChart', 'Churn (selected file)', null, false);

  pdfSave(doc, 'perforce_analytics_full_report.pdf');
}

function pdfAddVerticalBarChart(doc, title, labels, values, colorHex) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const chartW = pageWidth - 80, chartH = 70;
  const barGap = 2, barW = Math.max(2, (chartW - (labels.length - 1) * barGap) / labels.length);
  const maxV = Math.max(...values, 1);
  pdfEnsureSpace(doc, chartH + 24 + (title ? 14 : 0));
  if (title) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 40); doc.text(title, 40, doc._cursorY); doc.setFont('helvetica', 'normal'); doc._cursorY += 12; }
  const baseY = doc._cursorY + chartH;
  const rgb = pdfAnyColorToRgb(colorHex);
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  values.forEach((v, i) => {
    const h = Math.max(1, (v / maxV) * chartH);
    doc.rect(40 + i * (barW + barGap), baseY - h, barW, h, 'F');
  });
  doc._cursorY = baseY + 4;
  doc.setFontSize(6); doc.setTextColor(120, 120, 120);

  const step = labels.length > 16 ? 2 : 1;
  labels.forEach((lbl, i) => {
    if (i % step !== 0) return;
    doc.text(String(lbl), 40 + i * (barW + barGap), doc._cursorY + 6, { maxWidth: barW * step + barGap });
  });
  doc._cursorY += 12;
  doc.setTextColor(20, 20, 20);
}

function pdfAddTwoBoxSummary(doc, greenN, greenLabel, redN, redLabel) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxW = (pageWidth - 80 - 10) / 2, boxH = 44;
  pdfEnsureSpace(doc, boxH + 14);
  const y = doc._cursorY;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(40, y, boxW, boxH, 3, 3, 'FD');
  doc.roundedRect(40 + boxW + 10, y, boxW, boxH, 3, 3, 'FD');

  const arrowX = 40 + boxW - 34, arrowY = y + 12;
  doc.setDrawColor(63, 185, 80); doc.setFillColor(63, 185, 80);
  doc.setLineWidth(1.2);
  doc.line(arrowX, arrowY, arrowX + 18, arrowY);
  doc.triangle(arrowX + 18, arrowY - 3, arrowX + 18, arrowY + 3, arrowX + 24, arrowY, 'F');
  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.setTextColor(63, 185, 80); doc.text(String(greenN), 50, y + 22);
  doc.setTextColor(248, 81, 73); doc.text(String(redN), 50 + boxW + 10, y + 22);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(doc.splitTextToSize(greenLabel, boxW - 20), 50, y + 34);
  doc.text(doc.splitTextToSize(redLabel, boxW - 20), 50 + boxW + 10, y + 34);
  doc._cursorY = y + boxH + 14;
  doc.setTextColor(20, 20, 20);
}

function bfViewToTableData(view) {
  const files = bfFilteredFiles();
  const threshold = window.bfFilters?.threshold ?? 80;
  const isWs = window.bfDimension === 'workspace';
  let headers, rows;
  if (view === 'impact') {
    const impacts = isWs ? bfImpactForWorkspace(files, threshold) : bfImpactFor(files, threshold);
    headers = [isWs ? 'Workspace' : 'Author', 'Files (risk)', '% of project'];
    rows = impacts.map((i) => [isWs ? i.ws : i.user.name, i.soloFiles, i.pct + '%']);
  } else if (view === 'depots') {
    const groups = [...new Set(files.map((f) => f.depot))];
    headers = ['Depot', 'Files', 'With 1 ' + (isWs ? 'workspace' : 'author'), 'With 2+', 'Avg'];
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    rows = groups.map((name) => {
      const gFiles = files.filter((f) => f.depot === name);
      const single = gFiles.filter((f) => f[dimKey] === 1).length;
      const avgA = gFiles.reduce((s, f) => s + f[dimKey], 0) / gFiles.length;
      return [name, gFiles.length, single, gFiles.length - single, avgA.toFixed(2)];
    });
  } else if (view === 'files') {
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
    headers = ['File', isWs ? 'Workspace' : 'Author', 'Edits'];
    rows = files.filter((f) => f[dimKey] === 1).sort((a, b) => b.totalEdits - a.totalEdits).map((f) => [f.path, f[domKey], f.totalEdits]);
  } else if (view === 'ownership') {
    const top = [...files].sort((a, b) => b.totalEdits - a.totalEdits).slice(0, window.bfTopN?.ownership || 20);
    headers = ['File', 'Edits', isWs ? 'Workspaces (share)' : 'Authors (share)'];
    rows = top.map((f) => {
      const breakdown = (isWs ? f.workspaces : f.authors).map(([name, cnt]) => `${name}: ${Math.round(cnt / f.totalEdits * 100)}%`).join(' | ');
      return [f.path.split('/').pop(), f.totalEdits, breakdown];
    });
  } else if (view === 'bytype') {
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const exts = [...new Set(files.map((f) => f.ext))];
    headers = ['Type', 'Avg ' + (isWs ? 'workspaces' : 'authors'), '% with 1', 'Files'];
    rows = exts.map((ext) => {
      const eFiles = files.filter((f) => f.ext === ext);
      const avgA = eFiles.reduce((s, f) => s + f[dimKey], 0) / eFiles.length;
      const singlePct = Math.round(eFiles.filter((f) => f[dimKey] === 1).length / eFiles.length * 100);
      return ['.' + ext, avgA.toFixed(2), singlePct + '%', eFiles.length];
    });
  } else {
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
    const evKey = isWs ? 'workspace' : 'author';
    const allDates = files.flatMap((f) => f.events.map((e) => e.date));
    const midDate = allDates.sort((a, b) => a - b)[Math.floor(allDates.length / 2)];
    headers = ['File', 'Status', isWs ? 'Workspace' : 'Author'];
    rows = [];
    files.forEach((f) => {
      const before = new Set(f.events.filter((e) => e.date < midDate).map((e) => e[evKey]));
      const after = new Set(f.events.filter((e) => e.date >= midDate).map((e) => e[evKey]));
      const joined = [...after].some((a) => !before.has(a));
      if (f[dimKey] > 1 && joined) rows.push([f.path.split('/').pop(), 'knowledge spreading', f[domKey]]);
      else if (f[dimKey] === 1) rows.push([f.path.split('/').pop(), 'risk — single owner', f[domKey]]);
    });
  }
  return { headers, rows };
}

function pdfAddBarViz(doc, rows, labelIdx, valueIdx, maxValue) {
  if (!rows.length) return;
  const pageWidth = doc.internal.pageSize.getWidth();

  const labelColW = 150, barStartX = 40 + labelColW, valueColW = 50;
  const barMaxWidth = pageWidth - 40 - barStartX - valueColW - 10;
  const barHeight = 10, rowGap = 4;
  pdfEnsureSpace(doc, rows.length * (barHeight + rowGap) + 10);
  doc.setFontSize(8);
  rows.forEach((row) => {
    const label = String(row[labelIdx]);
    const val = parseFloat(row[valueIdx]) || 0;
    const w = maxValue > 0 ? Math.min(barMaxWidth, (val / maxValue) * barMaxWidth) : 0;
    doc.setTextColor(60, 60, 60);
    doc.text(label.length > 26 ? label.slice(0, 24) + '…' : label, 40, doc._cursorY + barHeight - 2, { maxWidth: labelColW - 6 });
    doc.setFillColor(240, 136, 62);
    doc.rect(barStartX, doc._cursorY, Math.max(2, w), barHeight, 'F');
    doc.setTextColor(120, 120, 120);
    const valStr = String(row[valueIdx]);
    doc.text(valStr.length > 14 ? valStr.slice(0, 12) + '…' : valStr, barStartX + Math.max(2, w) + 4, doc._cursorY + barHeight - 2);
    doc._cursorY += barHeight + rowGap;
  });
  doc._cursorY += 6;
  doc.setTextColor(20, 20, 20);
}

function exportBusFactorToPDF() {
  const doc = pdfNewDoc('Bus Factor - ' + bfView);
  pdfAddPeriodInfo(doc, 'busfactor');
  pdfAddFilterSummary(doc, 'busfactor', true);
  const { headers, rows } = bfViewToTableData(bfView);

  if (bfView === 'impact' && rows.length) {
    pdfAddSectionTitle(doc, 'Impact');
    const maxRisk = Math.max(...rows.map((r) => parseFloat(r[1]) || 0), 1);
    pdfAddBarViz(doc, rows, 0, 1, maxRisk);
  }
  if (bfView === 'handoff' && rows.length) {
    const spreading = rows.filter((r) => r[1] === 'knowledge spreading').length;
    const risk = rows.filter((r) => r[1].includes('risk')).length;
    const isWs = window.bfDimension === 'workspace';
    pdfAddTwoBoxSummary(doc, spreading, `files — knowledge already spreading`, risk, `files — still touched by one ${isWs ? 'workspace' : 'person'} only`);
  }
  const CAP = 60;
  const total = rows.length;
  pdfAddTable(doc, headers, rows.slice(0, CAP));
  if (total > CAP) {
    doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
    doc.text(`Showing top ${CAP} of ${total} rows — full data available via CSV export.`, 40, doc._cursorY);
  }
  pdfSave(doc, 'busfactor_' + bfView + '.pdf');
}

function exportAllBusFactorViewsToPDF() {
  const views = ['impact', 'depots', 'files', 'ownership', 'bytype', 'handoff'];
  const originalView = bfView;
  const doc = pdfNewDoc('Bus Factor - All Views');
  pdfAddPeriodInfo(doc, 'busfactor');
  pdfAddFilterSummary(doc, 'busfactor', true);
  const CAP = 30;
  views.forEach((v) => {
    bfView = v;
    const { headers, rows } = bfViewToTableData(v);
    if (!rows.length) return;
    pdfAddSectionTitle(doc, v.charAt(0).toUpperCase() + v.slice(1));
    if (v === 'impact') {
      const maxRisk = Math.max(...rows.map((r) => parseFloat(r[1]) || 0), 1);
      pdfAddBarViz(doc, rows.slice(0, 15), 0, 1, maxRisk);
    }
    if (v === 'handoff') {
      const spreading = rows.filter((r) => r[1] === 'knowledge spreading').length;
      const risk = rows.filter((r) => r[1].includes('risk')).length;
      const isWs = window.bfDimension === 'workspace';
      pdfAddTwoBoxSummary(doc, spreading, `files — knowledge already spreading`, risk, `files — still touched by one ${isWs ? 'workspace' : 'person'} only`);
    }
    pdfAddTable(doc, headers, rows.slice(0, CAP));
    if (rows.length > CAP) {
      doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
      doc.text(`Showing top ${CAP} of ${rows.length} rows — full data available via CSV export.`, 40, doc._cursorY);
      doc._cursorY += 16;
    }
  });
  bfView = originalView;
  pdfSave(doc, 'busfactor_all_views.pdf');
}

function exportAnomaliesToPDF() {
  const doc = pdfNewDoc('Anomalies');
  pdfAddPeriodInfo(doc, 'anomalies');
  pdfAddFilterSummary(doc, 'anomalies', false);
  pdfAddChartImage(doc, 'anomChart', 'Anomaly Trend');
  const all = typeof computeAnomalies === 'function' ? computeAnomalies() : [];
  if (!all.length) { pdfSave(doc, 'anomalies.pdf'); return; }
  const CAP = 60;

  pdfAddSectionTitle(doc, 'Flagged Submits');
  const headers = ['CL', 'Author', 'Date', 'Depot', 'Workspace', 'Files', 'Volume (GB)', 'Votes', 'Top signal'];
  const rows = all.slice(0, CAP).map((r) => {
    const fileFeature = r.features.find((f) => f.key === 'file_count');
    const volFeature = r.features.find((f) => f.key === 'total_size');
    return [
      r.commit.cl, r.commit.author, r.commit.date.toISOString().slice(0, 10), r.commit.depot, r.commit.workspace,
      fileFeature ? fileFeature.actual : '', volFeature ? volFeature.actual.toFixed(2) : '',
      r.votes + '/4', translateLabel(r.topSignal?.label || ''),
    ];
  });
  pdfAddTable(doc, headers, rows);
  if (all.length > CAP) {
    doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
    doc.text(`Showing top ${CAP} of ${all.length} anomalies — full data available via CSV export.`, 40, doc._cursorY);
    doc._cursorY += 16;
  }

  pdfAddSectionTitle(doc, 'Method & Feature Detail');
  const methodKeys = all[0].methods.map((m) => m.key);
  const detailHeaders = ['CL', ...methodKeys, 'Top feature (actual vs typical)'];
  const detailRows = all.slice(0, CAP).map((r) => {
    const top = r.features.find((f) => f.key === r.topSignal?.key) || r.features[0];
    const topStr = top ? `${top.fmt ? top.fmt(top.actual) : top.actual} vs ${top.fmt ? top.fmt(top.typical) : top.typical}` : '';
    return [r.commit.cl, ...r.methods.map((m) => (m.active ? 'yes' : 'no')), translateValueSubstrings(topStr)];
  });
  pdfAddTable(doc, detailHeaders, detailRows);

  pdfSave(doc, 'anomalies.pdf');
}

function exportFactsEntityToPDF(tabName, entityLabel) {
  const panel = document.getElementById('frpanel-' + tabName);
  if (!panel) return;
  const sections = panel.querySelectorAll('.fuser-section');
  if (!sections.length) { alert('Нет данных для экспорта.'); return; }
  const metricLabels = [...sections[0].querySelectorAll('.fc')].map((c) => translateLabel(c.querySelector('.fc-label')?.innerText.trim() || ''));
  const rows = [...sections].map((sec) => {
    const name = sec.querySelector('.fuser-name')?.innerText.trim() || '';
    const values = [...sec.querySelectorAll('.fc')].map((c) => translateValueSubstrings(c.querySelector('.fc-val')?.innerText.trim() || ''));
    return [name, ...values];
  });
  const doc = pdfNewDoc('Facts - ' + entityLabel);
  pdfAddTable(doc, [entityLabel, ...metricLabels], rows);
  pdfSave(doc, 'facts_' + tabName + '.pdf');
}

function exportHotFilesToPDF() {
  const data = hfTabToComprehensiveRows(hfTab);
  if (!data || !data.rows.length) { alert('Нет данных для экспорта.'); return; }
  const doc = pdfNewDoc('Hot Files and Churn - ' + translateLabel(HF_CFG[hfTab].title));
  pdfAddPeriodInfo(doc, 'hotfiles');
  pdfAddFilterSummary(doc, 'hotfiles', false);
  pdfAddTable(doc, data.headers, data.rows.slice(0, 60), { 0: { cellWidth: 180 } });
  if (data.rows.length > 60) {
    doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
    doc.text(`Showing top 60 of ${data.rows.length} rows — full data available via CSV export.`, 40, doc._cursorY);
  }
  pdfSave(doc, 'hot_files_' + hfTab + '.pdf');
}

function exportApRulesToPDF() {
  const rules = typeof computeApRules === 'function' ? computeApRules() : [];
  if (!rules.length) { alert('Нет правил для экспорта.'); return; }
  const doc = pdfNewDoc('Apriori - Association Rules');
  pdfAddPeriodInfo(doc, 'apriori');
  pdfAddFilterSummary(doc, 'apriori', false);
  pdfAddChartImage(doc, 'apChart', 'Support × Confidence');
  pdfAddSectionTitle(doc, 'Rules');
  const rows = rules.map((r) => [r.ant.join(' + '), r.cons.join(' + '), (r.sup * 100).toFixed(1) + '%', (r.conf * 100).toFixed(1) + '%', r.lift.toFixed(2)]);
  pdfAddTable(doc, ['If', 'Then', 'Support', 'Confidence', 'Lift'], rows);
  pdfSave(doc, 'apriori_rules.pdf');
}

function exportActiveFactsTabToPDF() {
  const active = document.querySelector('.frpanel.on') || document.querySelector('.frpanel');
  if (!active) return;
  const name = active.id.replace('frpanel-', '');
  const entityLabels = { users: 'Author', depots: 'Depot', workspaces: 'Workspace' };
  if (entityLabels[name]) { exportFactsEntityToPDF(name, entityLabels[name]); return; }
  alert('PDF-экспорт для этой вкладки Facts пока не подключён — используйте CSV.');
}

function pdfAddHeatmapGrid(doc) {
  if (typeof cellColor !== 'function' || typeof selectedYear === 'undefined') return;
  const year = selectedYear;
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const startMonday = new Date(jan1);
  startMonday.setDate(jan1.getDate() - ((jan1.getDay() + 6) % 7));
  const endSunday = new Date(dec31);
  endSunday.setDate(dec31.getDate() + (6 - ((dec31.getDay() + 6) % 7)));

  const weeks = [];
  const cursor = new Date(startMonday);
  while (cursor <= endSunday) {
    const week = [];
    for (let i = 0; i < 7; i++) { const day = new Date(cursor); day.setDate(cursor.getDate() + i); week.push(day); }
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
  }

  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthSpans = [];
  let lastMonth = -1, span = 0, spanStart = 0;
  weeks.forEach((week, weekIndex) => {
    const labelDate = week.find((d) => d >= jan1 && d <= dec31) || week[3];
    const month = labelDate.getMonth();
    if (month !== lastMonth) {
      if (lastMonth >= 0) monthSpans.push({ label: monthNamesShort[lastMonth], span, start: spanStart });
      lastMonth = month; span = 1; spanStart = weekIndex;
    } else span++;
  });
  if (lastMonth >= 0) monthSpans.push({ label: monthNamesShort[lastMonth], span, start: spanStart });

  const dayLookup = {};
  daysForBlock('heatmap').forEach((d) => { dayLookup[d.date.toISOString().slice(0, 10)] = d; });

  const cell = 8, gap = 2, dowLabelW = 20;
  const maxAvailWidth = doc.internal.pageSize.getWidth() - 80 - dowLabelW;
  const weeksToShow = Math.min(weeks.length, Math.floor(maxAvailWidth / (cell + gap)));

  pdfAddSectionTitle(doc, `Activity Grid — ${year}`);
  pdfEnsureSpace(doc, 12 + 7 * (cell + gap) + 20);

  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  monthSpans.forEach((ms) => {
    if (ms.start >= weeksToShow) return;
    const x = 40 + dowLabelW + ms.start * (cell + gap);
    doc.text(ms.label, x, doc._cursorY);
  });
  doc._cursorY += 10;
  const gridTop = doc._cursorY;

  const DOW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
  DOW_LABELS.forEach((lbl, dow) => {
    if (!lbl) return;
    doc.text(lbl, 40, gridTop + dow * (cell + gap) + cell - 1);
  });

  weeks.slice(0, weeksToShow).forEach((week, col) => {
    week.forEach((date, dow) => {
      const withinYear = date >= jan1 && date <= dec31;
      const key = date.toISOString().slice(0, 10);
      const dayObj = withinYear ? dayLookup[key] : undefined;
      const x = 40 + dowLabelW + col * (cell + gap);
      const y = gridTop + dow * (cell + gap);
      const rgb = dayObj ? pdfAnyColorToRgb(cellColor(dayObj)) : [235, 236, 238];
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);

      doc.roundedRect(x, y, cell, cell, 1, 1, 'F');
    });
  });

  doc._cursorY = gridTop + 7 * (cell + gap) + 14;
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const modeLabel = window.hmGroupBy === 'workspaces' ? 'workspace' : window.hmGroupBy === 'depot' ? 'depot' : 'author';
  doc.text(`Colored by ${modeLabel}, same as on screen. ${weeksToShow < weeks.length ? `Showing first ${weeksToShow} of ${weeks.length} weeks (page width) — ` : ''}Full daily detail in the table below.`, 40, doc._cursorY);
  doc._cursorY += 16;
  doc.setTextColor(20, 20, 20);
}

function pdfHeatmapExport() {
  const days = daysForBlock('heatmap');
  if (!days.length) { alert('Нет данных для экспорта в текущем периоде.'); return; }
  const doc = pdfNewDoc('Heatmap');
  pdfAddPeriodInfo(doc, 'heatmap');
  pdfAddFilterSummary(doc, 'heatmap', true);
  pdfAddHeatmapGrid(doc);

  const modeLabel = window.hmGroupBy === 'workspaces' ? 'workspace' : window.hmGroupBy === 'depot' ? 'depot' : 'author';
  doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
  doc.text(`Color key: cell color = ${modeLabel} color (blended if several worked that day, see dots above) · grey = no activity.`, 40, doc._cursorY);
  doc._cursorY += 16;
  doc.setTextColor(20, 20, 20);
  const rows = [];
  days.forEach((d) => USERS.forEach((u) => {
    const pu = d.perUser[u.name];
    if (!pu || !pu.commits || !pu.commits.length) return;
    rows.push([d.date.toISOString().slice(0, 10), u.name, pu.commits.length, pu.commits.reduce((s, c) => s + c.nFiles, 0), pu.commits.reduce((s, c) => s + c.sizeGB, 0).toFixed(3)]);
  }));
  if (!rows.length) { pdfSave(doc, 'heatmap.pdf'); return; }
  pdfAddSectionTitle(doc, 'Daily Detail');
  pdfAddTable(doc, ['Date', 'Author', 'Submits', 'Files', 'Volume (GB)'], rows);
  pdfSave(doc, 'heatmap.pdf');
}

function pdfHeatmapDayExport() {
  const commits = window._drillCommits || [];
  if (!commits.length) { alert('Нет сабмитов для экспорта в этот день.'); return; }
  const rows = [];
  commits.forEach((c) => c.files.forEach((f) => rows.push([c.cl, c.author, c.desc, c.date.toISOString().slice(0, 19).replace('T', ' '), c.depot, c.workspace, f.path, f.action, f.rev, f.size])));
  const dateStr = commits[0].date.toISOString().slice(0, 10);
  const doc = pdfNewDoc('Day - ' + dateStr);
  pdfAddTable(doc, ['CL', 'Author', 'Description', 'Date', 'Depot', 'Workspace', 'File', 'Action', 'Revision', 'Size'], rows);
  pdfSave(doc, 'day_' + dateStr + '.pdf');
}

function exportAuthorsFullToPDF() {
  const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
  if (!fd || !fd.users.length) { alert('Нет данных по авторам для экспорта.'); return; }
  const anomsAll = typeof computeAnomalies === 'function' ? computeAnomalies() : [];
  const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const doc = pdfNewDoc('Authors - Full Report');
  pdfAddPeriodInfo(doc, 'cards');
  pdfAddFilterSummary(doc, 'cards', true);

  pdfAddSectionTitle(doc, 'Metrics (Overview + Records)');
  const header = [
    'Author', 'Submits', 'Files', 'Volume (GB)', 'Avg files/submit', 'Avg gap (h)',
    'Anomalous submits', 'Max streak', 'Weekend %', 'Peak hour', 'Peak weekday', 'Most frequent type',
  ];
  const rows = fd.users.map((u) => {
    const myAnoms = anomsAll.filter((r) => r.commit.author === u.name);
    return [
      u.name, u.commits, u.files, u.vol.toFixed(2), u.avgFiles.toFixed(1), u.avgGap.toFixed(1),
      myAnoms.length, u.streak, u.weekendPct.toFixed(0),
      String(u.favHour).padStart(2, '0') + ':00', WEEKDAY_EN[u.favDow], u.favExt ? '.' + u.favExt : '',
    ];
  });
  pdfAddTable(doc, header, rows);

  pdfAddSectionTitle(doc, 'Share (donut)');
  pdfAddChartImage(doc, 'authorDonutChart');

  pdfAddSectionTitle(doc, 'Clustering');
  pdfAddPeriodInfo(doc, 'authorcluster');
  pdfAddFilterSummary(doc, 'authorcluster', true);
  pdfAddChartImage(doc, 'authorClusterChart');
  const clusterData = pdfChartToTableRows('authorClusterChart');
  if (clusterData) pdfAddTable(doc, clusterData.headers, clusterData.rows);

  pdfAddSectionTitle(doc, 'Comparison');
  pdfAddPeriodInfo(doc, 'bar');
  pdfAddFilterSummary(doc, 'bar', true);
  pdfAddChartImage(doc, 'userBarChart');
  const barData = pdfChartToTableRows('userBarChart');
  if (barData) pdfAddTable(doc, barData.headers, barData.rows);

  pdfAddSectionTitle(doc, 'Scatter');
  pdfAddPeriodInfo(doc, 'scatter');
  pdfAddFilterSummary(doc, 'scatter', true);
  pdfAddChartImage(doc, 'scatterChart');
  const scatterData = pdfChartToTableRows('scatterChart');
  if (scatterData) pdfAddTable(doc, scatterData.headers, scatterData.rows);

  pdfAddSectionTitle(doc, 'Top Files');
  const fileRows = [];
  fd.users.forEach((u) => u.topFiles.slice(0, 10).forEach((f) => fileRows.push([u.name, f.file, f.count])));
  pdfAddTable(doc, ['Author', 'File', 'Changes'], fileRows);

  pdfAddSectionTitle(doc, 'Activity (by hour)');
  fd.users.forEach((u) => {
    const { labels, values } = computeAuthorTimeBuckets(u, 'hour');
    pdfAddVerticalBarChart(doc, u.name, labels, values, u.color);
  });
  const fullActRows = [];
  fd.users.forEach((u) => {
    const { labels, values } = computeAuthorTimeBuckets(u, 'hour');
    labels.forEach((lbl, i) => fullActRows.push([u.name, lbl, values[i]]));
  });
  pdfAddTable(doc, ['Author', 'Hour', 'Submits'], fullActRows);

  pdfSave(doc, 'authors_full.pdf');
}

function pdfExportZoomedChart() {

  const sourceId = window._czmSourceCanvasId;
  const mapping = (typeof PDF_ALL_CHARTS !== 'undefined' ? PDF_ALL_CHARTS : []).find((m) => m[0] === sourceId);
  const title = mapping ? mapping[1] : (sourceId || 'Chart');
  const doc = pdfNewDoc(title);

  const scope = mapping ? mapping[2] : null;
  const hasTree = mapping ? mapping[3] : false;
  if (scope) { pdfAddPeriodInfo(doc, scope); pdfAddFilterSummary(doc, scope, hasTree); }
  const added = pdfAddChartImage(doc, 'czmChart');
  if (!added) { alert('Нечего экспортировать — график не открыт.'); return; }
  const tableData = typeof pdfChartToTableRows === 'function' ? pdfChartToTableRows('czmChart') : null;
  if (tableData) { pdfAddSectionTitle(doc, 'Data'); pdfAddTable(doc, tableData.headers, tableData.rows.slice(0, 60)); }

  const baseName = sourceId || 'chart';
  pdfSave(doc, baseName + '.pdf');
}

function exportTimelineToPDF() {
  const chart = typeof Chart !== 'undefined' ? Chart.getChart('tlChart') : null;
  if (!chart) { alert('График Timeline сейчас не отрисован.'); return; }
  const doc = pdfNewDoc('Timeline');
  pdfAddPeriodInfo(doc, 'timeline');
  pdfAddFilterSummary(doc, 'timeline', false);
  pdfAddChartImage(doc, 'tlChart');
  const { labels, datasets } = chart.data;
  if (datasets && datasets.length && labels && labels.length) {
    pdfAddSectionTitle(doc, 'Group Data');
    const headers = ['', ...datasets.map((ds) => translateValueSubstrings(ds.label || ''))];
    const rows = labels.map((lbl, i) => [translateValueSubstrings(String(lbl)), ...datasets.map((ds) => ds.data[i] ?? '')]);
    pdfAddTable(doc, headers, rows);
  } else {
    doc.setFontSize(9); doc.setTextColor(140, 140, 140);
    doc.text('No groups configured - add entities to the Timeline to see data here.', 40, doc._cursorY);
  }
  pdfSave(doc, 'timeline.pdf');
}

function exportAuthorCardsBundleToPDF() {
  const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
  if (!fd || !fd.users.length) { alert('Нет данных по авторам для экспорта.'); return; }
  const doc = pdfNewDoc('Authors - Metrics, Files, Activity');
  const anomsAll = typeof computeAnomalies === 'function' ? computeAnomalies() : [];
  const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  pdfAddSectionTitle(doc, 'Metrics');
  const metricHeader = ['Author', 'Submits', 'Files', 'Volume (GB)', 'Avg files/submit', 'Avg gap (h)', 'Anomalous submits', 'Max streak', 'Weekend %'];
  const metricRows = fd.users.map((u) => {
    const myAnoms = anomsAll.filter((r) => r.commit.author === u.name);
    return [u.name, u.commits, u.files, u.vol.toFixed(2), u.avgFiles.toFixed(1), u.avgGap.toFixed(1), myAnoms.length, u.streak, u.weekendPct.toFixed(0)];
  });
  pdfAddTable(doc, metricHeader, metricRows);

  pdfAddSectionTitle(doc, 'Top Files');
  const fileRows = [];
  fd.users.forEach((u) => u.topFiles.slice(0, 10).forEach((f) => fileRows.push([u.name, f.file, f.count])));
  pdfAddTable(doc, ['Author', 'File', 'Changes'], fileRows);

  pdfAddSectionTitle(doc, 'Activity (by hour)');
  const actRows = [];
  fd.users.forEach((u) => {
    const { labels, values } = computeAuthorTimeBuckets(u, 'hour');
    labels.forEach((lbl, i) => actRows.push([u.name, lbl, values[i]]));
  });
  pdfAddTable(doc, ['Author', 'Hour', 'Submits'], actRows);

  pdfSave(doc, 'authors_metrics_files_activity.pdf');
}

function exportCorrelationsToPDF() {
  const container = document.getElementById('fileCorrelTable');
  if (!container) return;
  const doc = pdfNewDoc('Files - Correlations');
  pdfAddPeriodInfo(doc, 'filecorrel');
  pdfAddChartImage(doc, 'fileCorrelChart');

  const statCards = container.querySelectorAll('.corr-stat-card');
  if (statCards.length) {
    pdfAddSectionTitle(doc, 'Statistics');
    const statRows = [...statCards].map((card) => {
      const title = translateLabel(card.querySelector('.corr-stat-card-title')?.innerText.trim() || '');
      const cells = [...card.querySelectorAll('.corr-stat-cell')].map((c) => translateValueSubstrings(c.querySelector('.corr-stat-v')?.innerText.trim() || ''));
      return [title, ...cells];
    });
    pdfAddTable(doc, ['Metric', 'Mean', 'Std', 'Median', 'Q25–Q75'], statRows);
  }

  const corrRows = container.querySelectorAll('.corr-row');
  if (corrRows.length) {
    pdfAddSectionTitle(doc, 'Correlations');
    const rows = [...corrRows].map((row) => {
      const cells = [...row.children]
        .filter((c) => !c.classList.contains('corr-row-bar') && !c.classList.contains('corr-row-badge') && c.innerText.trim().length > 0)
        .map((c, i) => {
          const text = c.innerText.replace(/\s*\n\s*/g, ' | ').trim();
          if (i === 0) return text.split('×').map((part) => translateLabel(part.trim())).join(' × ');
          return translateValueSubstrings(text);
        });
      return cells;
    }).filter((r) => r.length);
    pdfAddTable(doc, ['Pair', 'r / V'], rows);
  }

  pdfSave(doc, 'files_correlations.pdf');
}

function exportFileClusteringToPDF() {
  const doc = pdfNewDoc('Files - Clustering');
  pdfAddPeriodInfo(doc, 'filecluster');
  pdfAddChartImage(doc, 'fileClusterChart');
  const tableEl = document.getElementById('fileClusterTable');
  if (tableEl) {
    const rows = [];
    tableEl.querySelectorAll('tbody tr, tr:not(thead tr)').forEach((tr) => {
      if (tr.closest('thead')) return;
      const cells = [...tr.children]
        .filter((td) => td.innerText.trim().length > 0)
        .map((td) => translateValueSubstrings(td.innerText.replace(/\s*\n\s*/g, ' | ').trim()));
      if (cells.length) rows.push(cells);
    });
    if (rows.length) {
      pdfAddSectionTitle(doc, 'Characteristic Types');
      pdfAddTable(doc, ['Category', 'Value'], rows);
    }
  }
  pdfSave(doc, 'files_clustering.pdf');
}

function hfTabToComprehensiveRows(tabKey) {
  const cfg = HF_CFG[tabKey];
  if (!cfg || !window._hfFiles) return null;
  const files = window._hfFiles.filter(cfg.filter).sort((a, b) => {
    const key = { edits: 'edits', authors: 'authorCount', revisions: 'maxRev', size: 'totalSizeKB', last_edit: 'daysAgo', churn_rate: 'churnRate', refactor: 'refactorScore' }[cfg.sort] || 'edits';
    return cfg.sort === 'last_edit' ? b[key] - a[key] : b[key] - a[key];
  });
  const headers = ['File', 'Edits', 'Authors', 'Max Revision', 'Size (KB)', 'Days Since Edit', 'Churn Rate', 'Refactor Risk', 'Trend'];
  const rows = files.map((f) => [
    f.path, f.edits, f.authorCount, f.maxRev, Math.round(f.totalSizeKB), f.daysAgo, f.churnRate.toFixed(2), f.refactorScore, f.trend,
  ]);
  return { headers, rows };
}

async function exportAllHotFilesTabsToPDF() {
  const doc = pdfNewDoc('Hot Files and Churn - All Tabs');
  pdfAddPeriodInfo(doc, 'hotfiles');
  pdfAddFilterSummary(doc, 'hotfiles', false);
  const tabs = ['hot', 'churn', 'cold', 'new'];
  const originalTab = hfTab;
  hfTab = tabs[0]; buildHotFiles();
  tabs.forEach((t) => {
    const data = hfTabToComprehensiveRows(t);
    if (!data || !data.rows.length) return;
    pdfAddSectionTitle(doc, translateLabel(HF_CFG[t].title));
    pdfAddTable(doc, data.headers, data.rows.slice(0, 30), { 0: { cellWidth: 180 } });
    if (data.rows.length > 30) {
      doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
      doc.text(`Showing top 30 of ${data.rows.length} rows — full data available via CSV export.`, 40, doc._cursorY);
      doc._cursorY += 16;
    }
  });
  hfTab = originalTab; buildHotFiles();
  pdfSave(doc, 'hot_files_all_tabs.pdf');
}

function exportAuthorDonutToPDF() {
  const groupBy = window.authorDonutGroupBy || 'authors';
  const groupLabel = groupBy === 'depot' ? 'Depot' : groupBy === 'workspaces' ? 'Workspace' : 'Author';
  const doc = pdfNewDoc('Authors - Share of Submits (' + groupLabel + ')');
  pdfAddPeriodInfo(doc, 'cards');
  pdfAddFilterSummary(doc, 'cards', true);
  pdfAddChartImage(doc, 'authorDonutChart');
  const tableData = pdfChartToTableRows('authorDonutChart');
  if (tableData) pdfAddTable(doc, [groupLabel, 'Submits'], tableData.rows.map((r) => [r[0], r[1]]));
  pdfSave(doc, 'authors_donut_' + groupBy + '.pdf');
}

function pdfAppendDivRowsSection(doc, title, containerSel, rowSel, headers) {
  const container = document.querySelector(containerSel);
  if (!container) return;
  const rowEls = container.querySelectorAll(rowSel);
  if (!rowEls.length) return;
  const rows = [];
  rowEls.forEach((rowEl) => {
    const cells = [...rowEl.children]
      .filter((c) => c.innerText.trim().length > 0)
      .map((c) => translateValueSubstrings(c.innerText.replace(/\s*\n\s*/g, ' ').trim()));
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) return;
  pdfAddSectionTitle(doc, title);
  const valueIdx = rows[0].length - 1;
  const withPct = rows.map((r) => { const m = String(r[valueIdx]).match(/([\d.]+)\s*%/); return m ? parseFloat(m[1]) : null; });
  if (withPct.some((v) => v !== null)) {
    const barRows = rows.filter((_, i) => withPct[i] !== null).map((r, i) => [r[0], withPct.filter((v) => v !== null)[i]]);
    pdfAddBarViz(doc, barRows.slice(0, 15), 0, 1, 100);
  }
  pdfAddTable(doc, headers, rows);
}

function exportAllAnomaliesToPDF() {
  const doc = pdfNewDoc('Anomalies - Full Report');
  pdfAddPeriodInfo(doc, 'anomalies');
  pdfAddFilterSummary(doc, 'anomalies', false);
  pdfAddChartImage(doc, 'anomChart', 'Anomaly Trend');

  const all = typeof computeAnomalies === 'function' ? computeAnomalies() : [];
  if (all.length) {
    const CAP = 60;
    pdfAddSectionTitle(doc, 'Flagged Submits');
    const headers = ['CL', 'Author', 'Date', 'Depot', 'Workspace', 'Files', 'Volume (GB)', 'Votes', 'Top signal'];
    const rows = all.slice(0, CAP).map((r) => {
      const fileFeature = r.features.find((f) => f.key === 'file_count');
      const volFeature = r.features.find((f) => f.key === 'total_size');
      return [
        r.commit.cl, r.commit.author, r.commit.date.toISOString().slice(0, 10), r.commit.depot, r.commit.workspace,
        fileFeature ? fileFeature.actual : '', volFeature ? volFeature.actual.toFixed(2) : '',
        r.votes + '/4', translateLabel(r.topSignal?.label || ''),
      ];
    });
    pdfAddTable(doc, headers, rows);
    if (all.length > CAP) {
      doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
      doc.text(`Showing top ${CAP} of ${all.length} anomalies — full data available via CSV export.`, 40, doc._cursorY);
      doc._cursorY += 16;
    }

    pdfAddSectionTitle(doc, 'Method & Feature Detail');
    const methodKeys = all[0].methods.map((m) => m.key);
    const detailHeaders = ['CL', ...methodKeys, 'Top feature (actual vs typical)'];
    const detailRows = all.slice(0, CAP).map((r) => {
      const top = r.features.find((f) => f.key === r.topSignal?.key) || r.features[0];
      const topStr = top ? `${top.fmt ? top.fmt(top.actual) : top.actual} vs ${top.fmt ? top.fmt(top.typical) : top.typical}` : '';
      return [r.commit.cl, ...r.methods.map((m) => (m.active ? 'yes' : 'no')), translateValueSubstrings(topStr)];
    });
    pdfAddTable(doc, detailHeaders, detailRows);
  }

  pdfAppendDivRowsSection(doc, 'Share by Group', '#anomGroupBreakdown', '.anom-breakdown-row', ['Group', 'Count (Share)']);
  pdfAppendDivRowsSection(doc, 'Feature Combos', '#anomBreakdown', '.anom-breakdown-row', ['Combination', 'Count (Share)']);
  pdfAppendDivRowsSection(doc, 'Method Agreement', '#anomMethodBreakdown', '.anom-breakdown-row', ['Method pair', 'Count (Share)']);
  pdfAppendDivRowsSection(doc, 'Top Differing Features', '#anomTopDiffFeatures', '.anom-breakdown-row', ['Feature', 'Value']);

  pdfSave(doc, 'anomalies_full_report.pdf');
}
