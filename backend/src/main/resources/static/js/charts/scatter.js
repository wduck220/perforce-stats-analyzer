// ═══════════════════════════════════════════════════════════════════════
// SCATTER CHART — раздел "Аномалии" (файлы/размер/час коммита)
// ═══════════════════════════════════════════════════════════════════════
// Раньше этот код жил внутри js/sections/anomalies.js вперемешку с таблицей
// аномалий — два никак не связанных друг с другом виджета делили один файл.
// Сам js/charts/scatter.js при этом существовал, но был пустым файлом,
// который ни разу не подключался через <script src> — то есть был мёртвым
// местом-заглушкой. Теперь код на своём месте, и файл подключён в index.html.
//
// Зависимости: USERS/ha (js/data.js), scatterMode/scatterChartInst (js/state.js), Chart.js.

let _scatterSeed = 999;

/** Простой детерминированный псевдослучайный генератор (LCG) — чтобы demo-данные не менялись между перерисовками. */
function sr() {
  _scatterSeed = (_scatterSeed * 1664525 + 1013904223) & 0xffffffff;
  return (_scatterSeed >>> 0) / 4294967296;
}

const SCATTER_CFG = {
  files_size: {
    x: 'файлов', y: 'ГБ', title: 'Файлов vs Размер', sub: 'каждая точка — сабмит · цвет — автор',
    gen: (u) => Array.from({ length: u.commits }, () => ({
      x: Math.round(sr() * (u.name === 'kruzhka' ? 59 : 149)) + 1,
      y: +(sr() * (u.name === 'kruzhka' ? 3.95 : 6.95) + 0.05).toFixed(2),
    })),
  },
  files_time: {
    x: 'файлов', y: 'час', title: 'Файлов vs Час дня', sub: 'когда делались большие коммиты',
    gen: (u) => Array.from({ length: u.commits }, () => ({
      x: Math.round(sr() * (u.name === 'kruzhka' ? 59 : 149)) + 1,
      y: Math.round(sr() * 23),
    })),
  },
  size_rev: {
    x: 'ГБ', y: 'ревизий', title: 'Размер vs Ревизии', sub: 'зависимость размера от числа ревизий',
    gen: (u) => Array.from({ length: u.commits }, () => ({
      x: +(sr() * (u.name === 'kruzhka' ? 3.95 : 6.95) + 0.05).toFixed(2),
      y: Math.round(sr() * 49) + 1,
    })),
  },
};

function setScatter(mode) {
  scatterMode = mode;
  buildScatter();
}

function buildScatter() {
  const cfg = SCATTER_CFG[scatterMode];
  document.getElementById('scatterTitle').textContent = cfg.title;
  document.getElementById('scatterSub').textContent = cfg.sub;

  if (scatterChartInst) scatterChartInst.destroy();
  scatterChartInst = new Chart('scatterChart', {
    type: 'scatter',
    data: {
      datasets: USERS.map((u) => ({
        label: u.name,
        data: cfg.gen(u),
        backgroundColor: ha(u.color, 0.55),
        pointRadius: 3,
        pointHoverRadius: 5,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { boxWidth: 10, boxHeight: 10, padding: 12, color: themeColor('muted') } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}  ${cfg.x}: ${ctx.parsed.x}  ${cfg.y}: ${ctx.parsed.y}` } },
      },
      scales: {
        x: { title: { display: true, text: cfg.x, font: { size: 11 } }, grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') } },
        y: { title: { display: true, text: cfg.y, font: { size: 11 } }, grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') } },
      },
    },
  });
}
