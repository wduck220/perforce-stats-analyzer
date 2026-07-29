

const EXTS_LIST = [];
const DEPOTS = [];
let USERS = [];

function irnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function rnd(a, b) { return Math.random() * (b - a) + a; }
function ha(hex, a) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r},${g},${b},${a})`; }
function blend(cols) { let r = 0, g = 0, b = 0; cols.forEach(c => { r += parseInt(c.slice(1, 3), 16); g += parseInt(c.slice(3, 5), 16); b += parseInt(c.slice(5, 7), 16); }); return `rgb(${Math.round(r / cols.length)},${Math.round(g / cols.length)},${Math.round(b / cols.length)})`; }

const AUTHOR_COLOR_PALETTE = [
  { color: '#3fb950', bg: '#0f2a16' },
  { color: '#58a6ff', bg: '#0c1f3d' },
  { color: '#d29922', bg: '#332508' },
  { color: '#bc8cff', bg: '#241a3d' },
  { color: '#f85149', bg: '#3d1414' },
  { color: '#39c5cf', bg: '#0d2e33' },
  { color: '#f0883e', bg: '#3a2410' },
  { color: '#db61a2', bg: '#3a1830' },
];
function colorForAuthorIndex(i) {
  return AUTHOR_COLOR_PALETTE[i % AUTHOR_COLOR_PALETTE.length];
}

function fmtSizeGB(bytes) { return (bytes / 1e9).toFixed(2) + ' GB'; }

function fmtSizeKB(bytes) {
  const kb = bytes / 1024;
  if (kb > 0 && kb < 1) return kb.toFixed(2) + ' KB';
  return Math.round(kb) + ' KB';
}

function fmtRev(rev) { return '#' + (rev ?? 0); }

let START = new Date();
let END = new Date();
let DAYS_COUNT = 1;
let DAY_DATA = [];

function buildDashboardDataFromRawCommits(rawCommits) {
  if (!rawCommits || !rawCommits.length) {
    console.warn('[data.js] window.RAW_COMMITS пуст или не задан — дашборду нечего показывать. ' +
      'Убедитесь, что перед подключением js/data.js в HTML определён window.RAW_COMMITS.');
    USERS = [];
    DAY_DATA = [];
    return;
  }

  const authorNames = [...new Set(rawCommits.map(c => c.username).filter(Boolean))].sort();
  USERS = authorNames.map((name, i) => {
    const { color, bg } = colorForAuthorIndex(i);
    return { name, color, bg, commits: rawCommits.filter(c => c.username === name).length };
  });
  if (AUTHOR_COLOR_PALETTE.length < authorNames.length) {
    console.warn(`[data.js] Авторов (${authorNames.length}) больше, чем цветов в палитре (${AUTHOR_COLOR_PALETTE.length}) — цвета начнут повторяться.`);
  }

  const depotSet = new Set();
  const extSet = new Set();
  rawCommits.forEach(c => {
    (c.depotNames || []).forEach(d => depotSet.add(d));
    (c.filenames || []).forEach(f => {
      const dot = f.lastIndexOf('.');
      if (dot > 0) extSet.add(f.slice(dot + 1));
    });
  });
  DEPOTS.length = 0; DEPOTS.push(...[...depotSet].sort());
  EXTS_LIST.length = 0; EXTS_LIST.push(...[...extSet].sort());

  const sorted = [...rawCommits].sort((a, b) => new Date(a.date) - new Date(b.date));
  START = new Date(sorted[0].date);
  START.setHours(0, 0, 0, 0);
  END = new Date(sorted[sorted.length - 1].date);
  END.setHours(0, 0, 0, 0);
  DAYS_COUNT = Math.round((END - START) / 86400000) + 1;

  const byDayKey = {};
  sorted.forEach((raw, idx) => {
    const d = new Date(raw.date);
    const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (!byDayKey[dayKey]) byDayKey[dayKey] = [];

    const filenames = raw.filenames || [];
    const sizes = raw.sizes || [];
    const actions = raw.fileActions || [];
    const revisions = raw.fileRevisions || [];
    const totalBytes = sizes.reduce((s, v) => s + (v || 0), 0);

    byDayKey[dayKey].push({

      cl: raw.changeListId != null ? String(raw.changeListId) : `#${idx}`,
      author: raw.username,
      desc: raw.description || '',
      date: d,
      depot: (raw.depotNames || [])[0] || '',
      totalSize: fmtSizeGB(totalBytes),
      sizeGB: totalBytes / 1e9,
      nFiles: filenames.length,
      files: filenames.map((path, fi) => {
        const dot = path.lastIndexOf('.');
        return {
          path,

          action: (actions[fi] || 'edit').toString().toLowerCase(),
          ext: dot > 0 ? path.slice(dot + 1) : '',
          rev: fmtRev(revisions[fi]),
          size: fmtSizeKB(sizes[fi] || 0),
        };
      }),
      workspace: raw.clientId || '',
    });
  });

  DAY_DATA = Array.from({ length: DAYS_COUNT }, (_, i) => {
    const d = new Date(START); d.setDate(d.getDate() + i);
    const dayKey = d.getTime();
    const dayCommits = byDayKey[dayKey] || [];
    const perUser = {};
    USERS.forEach(u => {
      const commits = dayCommits.filter(c => c.author === u.name);
      perUser[u.name] = { count: commits.length, commits };
    });
    return { date: new Date(d), perUser };
  });
}

buildDashboardDataFromRawCommits(window.RAW_COMMITS);
