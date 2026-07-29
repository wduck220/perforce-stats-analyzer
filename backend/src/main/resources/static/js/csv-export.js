

function csvEscape(val) {
  const s = String(val ?? '').replace(/\s+/g, ' ').trim();
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCSV(filename, rows) {
  const content = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportBarTableToCSV(tableId, filename, headers) {
  const tableEl = document.getElementById(tableId);
  if (!tableEl) return;

  const rows = [headers];
  tableEl.querySelectorAll('tbody tr, tr:not(thead tr)').forEach((tr) => {
    if (tr.closest('thead')) return;
    const cells = [...tr.children]
      .filter((td) => td.innerText.trim().length > 0)
      .map((td) => translateValueSubstrings(td.innerText.replace(/\s*\n\s*/g, ' | ').trim()));
    if (cells.length) rows.push(cells);
  });
  if (rows.length < 2) { alert('Нет данных для экспорта — таблица пуста.'); return; }
  downloadCSV(filename, rows);
}

function exportCorrelationsToCSV(containerId, filename) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const rows = [];
  const statCards = container.querySelectorAll('.corr-stat-card');
  if (statCards.length) {
    rows.push(['— Statistics —']);
    rows.push(['Metric', 'Mean', 'Std', 'Median', 'Q25–Q75']);
    statCards.forEach((card) => {
      const titleRaw = card.querySelector('.corr-stat-card-title')?.innerText.trim() || ''; const title = translateLabel(titleRaw);
      const cells = [...card.querySelectorAll('.corr-stat-cell')].map((c) => translateValueSubstrings(c.querySelector('.corr-stat-v')?.innerText.trim() || ''));
      rows.push([title, ...cells]);
    });
    rows.push([]);
  }
  const corrRows = container.querySelectorAll('.corr-row');
  if (corrRows.length) {
    rows.push(['— Correlations —']);
    rows.push(['Pair', 'r / V']);
    corrRows.forEach((row) => {

      const cells = [...row.children]
        .filter((c) => !c.classList.contains('corr-row-bar') && !c.classList.contains('corr-row-badge') && c.innerText.trim().length > 0)
        .map((c, i) => {
          const text = c.innerText.replace(/\s*\n\s*/g, ' | ').trim();
          if (i === 0) return text.split('×').map((part) => translateLabel(part.trim())).join(' × ');
          return translateValueSubstrings(text);
        });
      if (cells.length) rows.push(cells);
    });
  }
  if (!rows.length) { alert('Нет данных для экспорта.'); return; }
  downloadCSV(filename, rows);
}

const CSV_HEADER_TRANSLATIONS = {

  'Обзор': 'Overview', 'Лидеры': 'Leaders', 'Рекорды': 'Records', 'Сводка': 'Summary', 'Ещё рекорды': 'More Records',
  'Авторы': 'Authors', 'Специализация по авторам': 'Author Specialization',
  'Депо': 'Depot', 'Сравнение депо': 'Depot Comparison', 'Воркспейсы': 'Workspaces',
  'Паттерны времени': 'Time Patterns', 'Аналитика': 'Analytics',
  'Кластеры': 'Clusters', 'Аномалии': 'Anomalies', 'Характерные типы': 'Characteristic types',
  'Горячие файлы': 'Hot Files', 'Холодные файлы': 'Cold Files', 'Новые файлы': 'New Files',
  'Горячие': 'Hot', 'Холодные': 'Cold', 'Новые': 'New',
  'Статистика распределений': 'Distribution Statistics', 'Типы файлов': 'File Types',
  'Рекорды по файлам': 'File Records', 'Все типы': 'All Types', 'Ещё по файлам': 'More File Stats',

  'Вс': 'Sun', 'Пн': 'Mon', 'Вт': 'Tue', 'Ср': 'Wed', 'Чт': 'Thu', 'Пт': 'Fri', 'Сб': 'Sat',

  'Автор': 'Author', 'Авт.': 'Author', 'Файлов': 'Files', 'Файл': 'File',
  'Размер': 'Size', 'Дата': 'Date', 'Признак': 'Signal', 'Активность': 'Activity',
  'Изм./Rev.': 'Edits/Rev', 'Ревизий': 'Revisions', 'КБ': 'KB',
  'Дн.': 'Days', 'Изм./д': 'Edits/day', 'Риск': 'Risk',
  'Ср. файлов': 'Avg files', 'Стд. файлов': 'Std files', 'Всего файлов': 'Total files',
  'Ср. объём, ГБ': 'Avg volume, GB', 'Стд. объёма': 'Std volume', 'Всего объём, ГБ': 'Total volume, GB',
  'Сабмитов': 'Submits', 'Сабмиты': 'Submits', 'Активных дней': 'Active days', 'Разных авторов': 'Unique authors',
  'Методы': 'Methods', 'День': 'Day', 'Депо': 'Depot', 'Воркспейс': 'Workspace',

  'Binary файлов': 'Binary files', 'Text файлов': 'Text files',
  'Автор с макс. аномалиями': 'Author with most anomalies', 'Авторов': 'Authors',
  'Больше всего данных': 'Most data', 'Больше всего сабмитов': 'Most submits', 'Больше новых файлов': 'More new files',
  'В выходные': 'On weekends', 'Воркспейсов': 'Workspaces', 'Всего аномалий': 'Total anomalies',
  'Всего сабмитов': 'Total submits', 'ГБ / сабмит': 'GB / submit', 'Главный признак': 'Top signal',
  'День максимальной плотности': 'Densest day', 'День с макс. аномалий': 'Day with most anomalies',
  'Динамика': 'Trend', 'Дольше всего не трогали': 'Untouched longest',
  'Командный стрик': 'Team streak', 'Круглые номера CL': 'Round CL numbers',
  'Лидер по весу (объёму)': 'Leader by weight (volume)', 'Лидер по сабмитам': 'Leader by submits', 'Лидер по числу файлов': 'Leader by file count',
  'Любимый тип': 'Favorite type', 'Любимый час': 'Favorite hour',
  'Макс. личная пауза автора': 'Max personal pause', 'Макс. стрик': 'Max streak',
  'Максимальная доля новых файлов': 'Max new-files share', 'Максимальная ревизия файла': 'Max file revision',
  'Наиболее объёмный сабмит': 'Largest submit', 'Наибольший суммарный объём': 'Largest total volume',
  'Новых файлов': 'New files', 'Объём': 'Volume', 'Основное депо': 'Main depot', 'Основной автор': 'Main author',
  'Первый сабмит': 'First submit', 'Период': 'Period', 'Пиковый день недели': 'Peak weekday', 'Пиковый час': 'Peak hour',
  'Последний сабмит': 'Last submit', 'Работа в выходные': 'Weekend activity', 'Разработчиков': 'Developers',
  'Расширение с макс. паузами': 'Extension with longest pauses', 'Рекорд файлов за раз': 'Record files at once',
  'Самая долгая тишина': 'Longest silence', 'Самое активное число месяца': 'Most active day-of-month',
  'Самое длинное описание': 'Longest description', 'Самое короткое описание': 'Shortest description', 'Самое частое описание': 'Most frequent description',
  'Самый большой файл': 'Biggest file', 'Самый загруженный день': 'Busiest day', 'Самый маленький файл': 'Smallest file',
  'Самый продуктивный день команды': 'Most productive team day', 'Самый разнообразный автор': 'Most diverse author',
  'Самый разнообразный день': 'Most diverse day', 'Самый разнообразный сабмит': 'Most diverse submit',
  'Самый тихий (но не нулевой) час': 'Quietest (non-zero) hour', 'Самый тяжёлый в среднем': 'Heaviest on average', 'Самый тяжёлый средний': 'Heaviest average',
  'Самый частый тип': 'Most frequent type', 'Ср. пауза': 'Avg pause', 'Ср. размер файла': 'Avg file size', 'Ср. файлов/сабмит': 'Avg files/submit',
  'Средний сабмит': 'Avg submit', 'Суммарный объём': 'Total volume', 'Тренд по периоду': 'Period trend',
  'Тронут совсем недавно': 'Touched very recently', 'Уникальных типов файлов': 'Unique file types',
  'Файл, который трогали реже всех': 'Least-touched file', 'Файл-хотспот': 'File hotspot', 'Чаще всего меняют': 'Changed most often',
  'Аномалий': 'Anomalies', 'Макс. streak': 'Max streak',

  'Число файлов в сабмите': 'Files per submit', 'Уникальных типов файлов в сабмите': 'Unique types per submit',
  'Объём сабмита': 'Submit volume', 'Средний размер файла': 'Avg file size', 'Длина описания': 'Description length',
  'Доля новых файлов (rev=1)': 'New files share (rev=1)', 'Часов с предыдущего сабмита автора': 'Hours since author\u2019s previous submit',

  'Число файлов': 'File count', 'Объём': 'Volume', 'Час сабмита': 'Submit hour', 'Необычные типы файлов': 'Unusual file types',

  'Объём, ГБ': 'Volume, GB', 'Средний размер файла, МБ': 'Avg file size, MB', 'Средний размер файла': 'Avg file size',
  'Депо × Расширение': 'Depot × Extension', 'Расширение (Крамера V)': 'Extension (Cramér\u2019s V)',
};

const CSV_HEADER_TRANSLATIONS_LOWER = {};
Object.keys(CSV_HEADER_TRANSLATIONS).forEach((k) => { CSV_HEADER_TRANSLATIONS_LOWER[k.toLowerCase()] = CSV_HEADER_TRANSLATIONS[k]; });
function translateLabel(text) {
  const s = String(text);

  const exact = CSV_HEADER_TRANSLATIONS[s] || CSV_HEADER_TRANSLATIONS_LOWER[s.toLowerCase()];
  if (exact) return exact;
  const bySubstring = translateValueSubstrings(s);
  return bySubstring !== s ? bySubstring : text;
}
function translateCsvHeaderRow(row) {
  return row.map((cell) => translateLabel(cell));
}

function wordRe(word, flags) {
  return new RegExp(`(?<=^|\\s|[(«])${word}(?=$|\\s|[).,;:»%])`, flags || 'gi');
}
const CSV_SUBSTRING_TRANSLATIONS = [

  [wordRe('янв\\.'), 'Jan'], [wordRe('февр\\.'), 'Feb'], [wordRe('мар\\.'), 'Mar'], [wordRe('апр\\.'), 'Apr'],
  [wordRe('мая'), 'May'], [wordRe('июн\\.'), 'Jun'], [wordRe('июл\\.'), 'Jul'], [wordRe('авг\\.'), 'Aug'],
  [wordRe('сент\\.'), 'Sep'], [wordRe('окт\\.'), 'Oct'], [wordRe('нояб\\.'), 'Nov'], [wordRe('дек\\.'), 'Dec'],
  [wordRe('Скользящее среднее'), 'Moving average'],
  [wordRe('Верхняя граница нормы'), 'Upper normal bound'], [wordRe('Нижняя граница нормы'), 'Lower normal bound'],
  [wordRe('Аномальный день'), 'Anomalous day'],
  [wordRe('Правила'), 'Rules'],
  [wordRe('Совпадений'), 'Matches'],
  [wordRe('Сравнение'), 'Comparison'],
  [/Кластер (\d+)/gi, 'Cluster $1'],
  [/Самое сильное правило/gi, 'Strongest rule'], [/Самое частое правило/gi, 'Most frequent rule'], [/Самое уверенное правило/gi, 'Most confident rule'],
  [/\/д\b/g, '/day'],

  [wordRe('\\(ни один по отдельности\\)'), '(none individually)'],
  [wordRe('всё время'), 'all time'],
  [wordRe('часы с предыдущего'), 'hours since previous'],
  [wordRe('закончился'), 'ended'],
  [wordRe('кратно'), 'multiple of'],
  [wordRe('встречается'), 'occurs'], [wordRe('дословно'), 'verbatim'],
  [wordRe('разных типов файлов'), 'unique file types'], [wordRe('разных типов'), 'unique types'],
  [wordRe('типов файлов'), 'file types'], [wordRe('типов сразу'), 'types at once'], [wordRe('типов'), 'types'],
  [wordRe('разрыв'), 'gap'],
  [wordRe('последний раз'), 'last touched'],
  [wordRe('дн\\.\\s*макс\\.\\s*пауза между правками'), 'd. max pause between edits'],
  [wordRe('не найден'), 'not found'],
  [wordRe('(\\d[\\d\\s]*)\\s+раз'), '$1 times'],
  [wordRe('встретился всего'), 'occurred only'],
  [wordRe('шт\\.'), 'pcs'], [wordRe('символов'), 'characters'],
  [wordRe('число'), 'day-of-month'],
  [wordRe('сумма по всем месяцам'), 'sum across all months'],
  [wordRe('файловых событий'), 'file events'], [wordRe('упоминаний'), 'mentions'],
  [wordRe('сработал в'), 'triggered in'],
  [wordRe('сабм\\.'), 'submits'],
  [wordRe('1-я/2-я половина периода'), '1st/2nd half of period'], [wordRe('1-я/2-я половина'), '1st/2nd half'],
  [wordRe('растёт'), 'growing'], [wordRe('снижается'), 'declining'], [wordRe('рост'), 'growth'], [wordRe('спад'), 'decline'],
  [wordRe('файл(?!ов|а|ы)'), 'file'],
  [wordRe('подтверждены'), 'confirmed by'], [wordRe('пограничные'), 'borderline'],
  [wordRe('методами'), 'methods'], [wordRe('методом'), 'method'],
  [wordRe('дн\\.\\s*подряд'), 'days in a row'], [wordRe('дн\\.'), 'd.'], [wordRe('дней'), 'days'], [wordRe('дня'), 'days'],
  [wordRe('ч\\.'), 'h.'], [/(\d)\s*ч(?=$|\s|[).,;])/g, '$1 h'],
  [wordRe('мин\\.'), 'min.'], [wordRe('сек\\.'), 'sec.'],
  [wordRe('ГБ'), 'GB'], [wordRe('МБ'), 'MB'], [wordRe('КБ'), 'KB'],
  [wordRe('всех'), 'all'],
  [wordRe('сабмитов'), 'submits'], [wordRe('сабмита'), 'submit'], [wordRe('файлов'), 'files'], [wordRe('файла'), 'file'],
  [wordRe('пар'), 'pairs'], [wordRe('раз\\s+вместе'), 'times together'],
  [wordRe('Не\\s+удалось'), 'Failed'], [wordRe('Нет\\s+данных'), 'No data'], [wordRe('Недостаточно\\s+данных'), 'Not enough data'],
  [wordRe('очень\\s+слабая'), 'very weak'], [wordRe('слабая'), 'weak'], [wordRe('умеренная'), 'moderate'], [wordRe('сильная'), 'strong'],
  [wordRe('выше'), 'above'], [wordRe('ниже'), 'below'],
  [wordRe('растёт'), 'rising'], [wordRe('затихает'), 'fading'], [wordRe('стабильно'), 'stable'],
  [wordRe('авт\\.'), 'auth.'],

  [wordRe('и'), 'and'], [wordRe('за'), 'over'], [wordRe('с'), 'from'], [wordRe('по'), 'to'],
  [wordRe('из'), 'of'], [wordRe('от'), 'of'],
];

const CSV_HEADER_PHRASES_BY_LENGTH = Object.keys(CSV_HEADER_TRANSLATIONS).sort((a, b) => b.length - a.length);
function translateValueSubstrings(text) {
  let s = String(text ?? '');
  const trimmed = s.trim();
  CSV_HEADER_PHRASES_BY_LENGTH.forEach((phrase) => {
    if (phrase.length <= 3) {

      if (trimmed === phrase) s = CSV_HEADER_TRANSLATIONS[phrase];
    } else if (s.includes(phrase)) {
      s = s.split(phrase).join(CSV_HEADER_TRANSLATIONS[phrase]);
    }
  });
  CSV_SUBSTRING_TRANSLATIONS.forEach(([re, rep]) => { s = s.replace(re, rep); });
  return s;
}

function exportHtmlTableToCSV(tableEl, filename) {
  if (typeof tableEl === 'string') tableEl = document.getElementById(tableEl);
  if (!tableEl) return;
  const rows = [];
  tableEl.querySelectorAll('tr').forEach((tr, i) => {
    const cells = [...tr.children].map((td) => {
      const raw = td.innerText.replace(/\s*\n\s*/g, ' ').trim();

      return i === 0 ? raw : translateValueSubstrings(raw);
    });
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) { alert('Нет данных для экспорта — таблица пуста.'); return; }
  rows[0] = translateCsvHeaderRow(rows[0]);
  downloadCSV(filename, rows);
}

function exportDivRowsToCSV(containerSelector, rowSelector, filename, header) {
  const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
  if (!container) return;
  const rowEls = container.querySelectorAll(rowSelector);
  if (!rowEls.length) { alert('Нет данных для экспорта.'); return; }
  const rows = header ? [header] : [];
  rowEls.forEach((rowEl) => {
    const cells = [...rowEl.children].map((c) => translateValueSubstrings(c.innerText.replace(/\s*\n\s*/g, ' ').trim()));
    if (cells.length) rows.push(cells);
  });
  downloadCSV(filename, rows);
}

function exportFactsSectionedToCSV(containerSelector, filename) {
  const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
  if (!container) return;
  const sectionTitles = container.querySelectorAll('.fr-sec-title');
  if (!sectionTitles.length) { exportCardsToCSV(container, filename); return; }
  const rows = [];
  sectionTitles.forEach((titleEl) => {
    const sectionName = translateLabel(titleEl.innerText.trim());
    const cards = [];
    let node = titleEl.nextElementSibling;
    while (node && !node.classList.contains('fr-sec-title')) {
      cards.push(...node.querySelectorAll('.fc'));
      node = node.nextElementSibling;
    }
    if (!cards.length) return;
    rows.push(['— ' + sectionName + ' —']);
    rows.push(['Metric', 'Value', 'Note']);
    cards.forEach((c) => {
      const label = c.querySelector('.fc-label')?.innerText.trim() || '';
      const val = translateValueSubstrings(c.querySelector('.fc-val')?.innerText.trim() || '');
      const sub = translateValueSubstrings(c.querySelector('.fc-sub')?.innerText.trim() || '');
      rows.push([translateLabel(label), val, sub]);
    });
    rows.push([]);
  });
  if (!rows.length) { alert('Нет карточек для экспорта.'); return; }
  downloadCSV(filename, rows);
}

function exportCardsToCSV(containerSelector, filename) {
  const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
  if (!container) return;
  const cards = container.querySelectorAll('.fc');
  if (!cards.length) { alert('Нет карточек для экспорта.'); return; }
  const rows = [['Metric', 'Value', 'Note']];
  cards.forEach((c) => {
    const label = c.querySelector('.fc-label')?.innerText.trim() || '';
    const val = translateValueSubstrings(c.querySelector('.fc-val')?.innerText.trim() || '');
    const sub = translateValueSubstrings(c.querySelector('.fc-sub')?.innerText.trim() || '');
    rows.push([translateLabel(label), val, sub]);
  });
  downloadCSV(filename, rows);
}

function exportUserCardsToCSV(containerSelector, filename) {
  const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
  if (!container) return;
  const cards = container.querySelectorAll('.ucard');
  if (!cards.length) { alert('Нет карточек для экспорта.'); return; }

  const metricLabels = [...cards[0].querySelectorAll('.ustat')].map((el) => translateLabel(el.querySelector('.ustat-l')?.innerText.trim() || ''));
  const rows = [['Name', 'Share, %', ...metricLabels]];
  cards.forEach((card) => {
    const name = card.querySelector('.un')?.innerText.trim() || '';
    const share = (card.querySelector('.ur')?.innerText.match(/[\d.]+/) || [''])[0];
    const values = [...card.querySelectorAll('.ustat')].map((el) => translateValueSubstrings(el.querySelector('.ustat-v')?.innerText.trim() || ''));
    rows.push([name, share, ...values]);
  });
  downloadCSV(filename, rows);
}

function exportCurrentAuthorFilesToCSV() {
  const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
  const u = fd && typeof currentModalUser !== 'undefined' ? fd.users.find((x) => x.name === currentModalUser) : null;
  if (!u) { alert('Не удалось определить текущего автора.'); return; }
  const rows = [['File', 'Changes']];
  u.topFiles.forEach((f) => rows.push([f.file, f.count]));
  downloadCSV('author_files_' + u.name + '.csv', rows);
}

const WEEKDAY_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function translateTimeLabels(labels, gran) {
  if (gran === 'dow') return WEEKDAY_EN_SHORT;
  if (gran === 'month') return MONTH_EN_SHORT;
  return labels;
}

function exportCurrentAuthorActivityToCSV() {
  const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
  const u = fd && typeof currentModalUser !== 'undefined' ? fd.users.find((x) => x.name === currentModalUser) : null;
  if (!u) { alert('Не удалось определить текущего автора.'); return; }
  const gran = window.authorTimeGran || 'hour';
  const fieldName = (typeof AUTHOR_TIME_GRAN_META !== 'undefined' && AUTHOR_TIME_GRAN_META[gran]) ? AUTHOR_TIME_GRAN_META[gran].field : 'Hour';
  const { labels, values } = computeAuthorTimeBuckets(u, gran);
  const enLabels = translateTimeLabels(labels, gran);
  const rows = [[fieldName, 'Submits']];
  enLabels.forEach((lbl, i) => rows.push([lbl, values[i]]));
  downloadCSV('author_activity_' + u.name + '_' + gran + '.csv', rows);
}

function exportAuthorsFilesToCSV() {
  const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
  if (!fd || !fd.users.length) { alert('Нет данных по авторам для экспорта.'); return; }
  const rows = [['Author', 'File', 'Changes']];
  fd.users.forEach((u) => {
    u.topFiles.forEach((f) => rows.push([u.name, f.file, f.count]));
  });
  downloadCSV('authors_files.csv', rows);
}

function exportAuthorsActivityToCSV() {
  const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
  if (!fd || !fd.users.length) { alert('Нет данных по авторам для экспорта.'); return; }
  const gran = window.authorTimeGran || 'hour';
  const fieldName = (typeof AUTHOR_TIME_GRAN_META !== 'undefined' && AUTHOR_TIME_GRAN_META[gran]) ? AUTHOR_TIME_GRAN_META[gran].field : 'Hour';
  const rows = [['Author', fieldName, 'Submits']];
  fd.users.forEach((u) => {
    const { labels, values } = computeAuthorTimeBuckets(u, gran);
    const enLabels = translateTimeLabels(labels, gran);
    enLabels.forEach((lbl, i) => rows.push([u.name, lbl, values[i]]));
  });
  downloadCSV('authors_activity_' + gran + '.csv', rows);
}

function exportAuthorsFullToCSV() {
  const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
  if (!fd || !fd.users.length) { alert('Нет данных по авторам для экспорта.'); return; }
  const anomsAll = typeof computeAnomalies === 'function' ? computeAnomalies() : [];
  const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const header = [
    'Author', 'Submits', 'Files changed', 'Total volume (GB)', 'Avg files/submit',
    'Avg gap (h)', 'Anomalous submits', 'Max streak (days)', 'Weekend %',
    'Avg submit size (MB)', 'Median size (MB)', 'Avg revisions', 'New files %', 'Workspaces',
    'Peak hour', 'Peak weekday', 'Most frequent type', 'Max pause without submits (days)',
    'Biggest submit', 'Biggest submit CL', 'Most files in one submit', 'Most files submit CL',
    'Longest description (chars)', 'Longest description CL',
    'Most diverse submit (types)', 'Most diverse submit CL',
    'Max file revision', 'Max revision file', 'Anomalous submits %',
  ];
  const rows = [header];

  fd.users.forEach((u) => {
    const myAnoms = anomsAll.filter((r) => r.commit.author === u.name);
    const list = u.list;
    const bySize = [...list].sort((a, b) => b.sizeGB - a.sizeGB)[0];
    const byFiles = [...list].sort((a, b) => b.nFiles - a.nFiles)[0];
    const byDescLen = [...list].sort((a, b) => b.desc.length - a.desc.length)[0];
    const byDiverse = [...list].sort((a, b) => new Set(b.files.map((f) => f.ext)).size - new Set(a.files.map((f) => f.ext)).size)[0];
    let maxRev = 0, maxRevFile = null;
    list.forEach((c) => c.files.forEach((f) => { const rv = parseRev(f.rev); if (rv > maxRev) { maxRev = rv; maxRevFile = f; } }));

    rows.push([
      u.name, u.commits, u.files, u.vol.toFixed(2), u.avgFiles.toFixed(1),
      u.avgGap.toFixed(1), myAnoms.length, u.streak, u.weekendPct.toFixed(0),
      u.avgSizeMB.toFixed(1), u.medSizeMB.toFixed(1), u.avgRev.toFixed(1), u.newRatioPct.toFixed(1), u.workspaces.join(' | '),
      String(u.favHour).padStart(2, '0') + ':00', WEEKDAY_EN[u.favDow], u.favExt ? '.' + u.favExt : '', u.maxPauseDays.toFixed(1),
      bySize.totalSize, bySize.cl, byFiles.nFiles, byFiles.cl,
      byDescLen.desc.length, byDescLen.cl,
      new Set(byDiverse.files.map((f) => f.ext)).size, byDiverse.cl,
      maxRevFile ? maxRevFile.rev : '', maxRevFile ? maxRevFile.path.split('/').pop() : '',
      (myAnoms.length / u.commits * 100).toFixed(1) + '%',
    ]);
  });
  downloadCSV('authors_full.csv', rows);
}

function exportHeatmapToCSV() {
  const days = daysForBlock('heatmap');
  const rows = [['Date', 'Author', 'Submits', 'Files', 'Volume (GB)']];
  days.forEach((d) => {
    USERS.forEach((u) => {
      const pu = d.perUser[u.name];
      if (!pu || !pu.commits || !pu.commits.length) return;
      const files = pu.commits.reduce((s, c) => s + c.nFiles, 0);
      const vol = pu.commits.reduce((s, c) => s + c.sizeGB, 0);
      rows.push([d.date.toISOString().slice(0, 10), u.name, pu.commits.length, files, vol.toFixed(3)]);
    });
  });
  if (rows.length === 1) { alert('Нет данных для экспорта в текущем периоде.'); return; }
  downloadCSV('heatmap.csv', rows);
}

async function exportAllHotFilesTabs() {
  const originalTab = hfTab;
  const tabs = ['hot', 'churn', 'cold', 'new'];
  let count = 0;
  for (const t of tabs) {
    hfTab = t;
    buildHotFiles();
    await new Promise((r) => setTimeout(r, 30));
    const tableEl = document.getElementById('hfTable');
    const rows = [];
    tableEl.querySelectorAll('tr').forEach((tr) => {
      const cells = [...tr.children].map((td) => translateValueSubstrings(td.innerText.replace(/\s*\n\s*/g, ' ').trim()));
      if (cells.length) rows.push(cells);
    });
    if (rows.length > 1) { rows[0] = translateCsvHeaderRow(rows[0]); downloadCSV('hot_files_' + t + '.csv', rows); count++; await new Promise((r) => setTimeout(r, 200)); }
  }
  hfTab = originalTab;
  buildHotFiles();
  if (!count) alert('Не нашлось данных ни на одной вкладке Hot Files.');
}

async function exportAllBusFactorViews() {
  const originalView = bfView;
  const views = ['impact', 'depots', 'files', 'ownership', 'bytype', 'handoff'];
  let count = 0;
  for (const v of views) {
    bfView = v;
    try {
      const files = bfFilteredFiles();
      const threshold = window.bfFilters?.threshold ?? 80;
      const isWs = window.bfDimension === 'workspace';
      let rows = null;
      if (v === 'impact') {
        const impacts = isWs ? bfImpactForWorkspace(files, threshold) : bfImpactFor(files, threshold);
        rows = [[isWs ? 'Workspace' : 'Author', 'Files (risk)', '% of project']];
        impacts.forEach((i) => rows.push([isWs ? i.ws : i.user.name, i.soloFiles, i.pct + '%']));
      } else if (v === 'depots') {
        const groups = [...new Set(files.map((f) => f.depot))];
        rows = [['Depot', 'Files', 'With 1 ' + (isWs ? 'workspace' : 'author'), 'With 2+', 'Avg']];
        groups.forEach((name) => {
          const gFiles = files.filter((f) => f.depot === name);
          const dimKey = isWs ? 'workspaceCount' : 'authorCount';
          const single = gFiles.filter((f) => f[dimKey] === 1).length;
          const avgA = gFiles.reduce((s, f) => s + f[dimKey], 0) / gFiles.length;
          rows.push([name, gFiles.length, single, gFiles.length - single, avgA.toFixed(2)]);
        });
      } else if (v === 'files') {
        const dimKey = isWs ? 'workspaceCount' : 'authorCount';
        const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
        const solo = files.filter((f) => f[dimKey] === 1);
        rows = [['File', domKey === 'dominantWorkspace' ? 'Workspace' : 'Author', 'Edits']];
        solo.forEach((f) => rows.push([f.path.split('/').pop(), f[domKey], f.totalEdits]));
      } else if (v === 'ownership') {
        const top = [...files].sort((a, b) => b.totalEdits - a.totalEdits).slice(0, window.bfTopN.ownership);
        rows = [['File', 'Edits', isWs ? 'Workspaces (share)' : 'Authors (share)']];
        top.forEach((f) => {
          const breakdown = (isWs ? f.workspaces : f.authors).map(([name, cnt]) => `${name}: ${Math.round(cnt / f.totalEdits * 100)}%`).join(' | ');
          rows.push([f.path.split('/').pop(), f.totalEdits, breakdown]);
        });
      } else if (v === 'bytype') {
        const dimKey = isWs ? 'workspaceCount' : 'authorCount';
        const exts = [...new Set(files.map((f) => f.ext))];
        rows = [['Type', 'Avg ' + (isWs ? 'workspaces' : 'authors'), '% with 1', 'Files']];
        exts.forEach((ext) => {
          const eFiles = files.filter((f) => f.ext === ext);
          const avgA = eFiles.reduce((s, f) => s + f[dimKey], 0) / eFiles.length;
          const singlePct = Math.round(eFiles.filter((f) => f[dimKey] === 1).length / eFiles.length * 100);
          rows.push(['.' + ext, avgA.toFixed(2), singlePct + '%', eFiles.length]);
        });
      } else if (v === 'handoff') {
        const dimKey = isWs ? 'workspaceCount' : 'authorCount';
        const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
        const evKey = isWs ? 'workspace' : 'author';
        const allDates = files.flatMap((f) => f.events.map((e) => e.date));
        const midDate = allDates.sort((a, b) => a - b)[Math.floor(allDates.length / 2)];
        rows = [['File', 'Status', isWs ? 'Workspace' : 'Author']];
        files.forEach((f) => {
          const before = new Set(f.events.filter((e) => e.date < midDate).map((e) => e[evKey]));
          const after = new Set(f.events.filter((e) => e.date >= midDate).map((e) => e[evKey]));
          const joined = [...after].some((a) => !before.has(a));
          if (f[dimKey] > 1 && joined) rows.push([f.path.split('/').pop(), 'knowledge spreading', f[domKey]]);
          else if (f[dimKey] === 1) rows.push([f.path.split('/').pop(), 'risk — single owner', f[domKey]]);
        });
      }
      if (rows && rows.length > 1) { downloadCSV('busfactor_' + v + '.csv', rows); count++; await new Promise((r) => setTimeout(r, 200)); }
    } catch (e) {  }
  }
  bfView = originalView;
  if (typeof buildBusFactor === 'function') buildBusFactor();
  if (!count) alert('Не нашлось данных ни в одном из видов Bus Factor.');
}

function exportBusFactorToCSV() {
  const files = bfFilteredFiles();
  const threshold = window.bfFilters?.threshold ?? 80;
  const isWs = window.bfDimension === 'workspace';
  let rows;

  if (bfView === 'impact') {
    const impacts = isWs ? bfImpactForWorkspace(files, threshold) : bfImpactFor(files, threshold);
    rows = [[isWs ? 'Workspace' : 'Author', 'Files (risk)', '% of project']];
    impacts.forEach((i) => rows.push([isWs ? i.ws : i.user.name, i.soloFiles, i.pct + '%']));
  } else if (bfView === 'files') {
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
    const solo = files.filter((f) => f[dimKey] === 1);
    rows = [['File', isWs ? 'Workspace' : 'Author', 'Edits']];
    solo.forEach((f) => rows.push([f.path.split('/').pop(), f[domKey], f.totalEdits]));
  } else if (bfView === 'depots') {
    const groups = [...new Set(files.map((f) => f.depot))];
    rows = [['Depot', 'Files', 'With 1 ' + (isWs ? 'workspace' : 'author'), 'With 2+', 'Avg']];
    groups.forEach((name) => {
      const gFiles = files.filter((f) => f.depot === name);
      const dimKey = isWs ? 'workspaceCount' : 'authorCount';
      const single = gFiles.filter((f) => f[dimKey] === 1).length;
      const avgA = gFiles.reduce((s, f) => s + f[dimKey], 0) / gFiles.length;
      rows.push([name, gFiles.length, single, gFiles.length - single, avgA.toFixed(2)]);
    });
  } else if (bfView === 'ownership') {
    const top = [...files].sort((a, b) => b.totalEdits - a.totalEdits).slice(0, window.bfTopN.ownership);
    rows = [['File', 'Edits', isWs ? 'Workspaces (share)' : 'Authors (share)']];
    top.forEach((f) => {
      const breakdown = (isWs ? f.workspaces : f.authors).map(([name, cnt]) => `${name}: ${Math.round(cnt / f.totalEdits * 100)}%`).join(' | ');
      rows.push([f.path.split('/').pop(), f.totalEdits, breakdown]);
    });
  } else if (bfView === 'bytype') {
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const exts = [...new Set(files.map((f) => f.ext))];
    rows = [['Type', 'Avg ' + (isWs ? 'workspaces' : 'authors'), '% with 1', 'Files']];
    exts.forEach((ext) => {
      const eFiles = files.filter((f) => f.ext === ext);
      const avgA = eFiles.reduce((s, f) => s + f[dimKey], 0) / eFiles.length;
      const singlePct = Math.round(eFiles.filter((f) => f[dimKey] === 1).length / eFiles.length * 100);
      rows.push(['.' + ext, avgA.toFixed(2), singlePct + '%', eFiles.length]);
    });
  } else if (bfView === 'handoff') {
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
    const evKey = isWs ? 'workspace' : 'author';
    const allDates = files.flatMap((f) => f.events.map((e) => e.date));
    const midDate = allDates.sort((a, b) => a - b)[Math.floor(allDates.length / 2)];
    rows = [['File', 'Status', isWs ? 'Workspace' : 'Author']];
    files.forEach((f) => {
      const before = new Set(f.events.filter((e) => e.date < midDate).map((e) => e[evKey]));
      const after = new Set(f.events.filter((e) => e.date >= midDate).map((e) => e[evKey]));
      const joined = [...after].some((a) => !before.has(a));
      if (f[dimKey] > 1 && joined) rows.push([f.path.split('/').pop(), 'knowledge spreading', f[domKey]]);
      else if (f[dimKey] === 1) rows.push([f.path.split('/').pop(), 'risk — single owner', f[domKey]]);
    });
  } else {
    alert('Неизвестный вид Bus Factor.');
    return;
  }

  if (rows.length < 2) { alert('Нет данных для экспорта при текущих фильтрах.'); return; }
  downloadCSV('busfactor_' + bfView + '.csv', rows);
}

function exportApRulesToCSV(filename) {
  const rules = typeof computeApRules === 'function' ? computeApRules() : [];
  if (!rules.length) { alert('Нет правил для экспорта.'); return; }
  const rows = [['If', 'Then', 'Support', 'Confidence', 'Lift']];
  rules.forEach((r) => rows.push([r.ant.join(' + '), r.cons.join(' + '), (r.sup * 100).toFixed(1) + '%', (r.conf * 100).toFixed(1) + '%', r.lift.toFixed(2)]));
  downloadCSV(filename, rows);
}

function exportAnomBreakdownToCSV(containerId, filename, headers) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const rows = [];
  const summary = container.querySelector('.anom-method-summary');
  if (summary) {
    rows.push(['Summary', '']);
    [...summary.children].forEach((span) => rows.push([translateValueSubstrings(span.innerText.replace(/\s*\n\s*/g, ' ').trim()), '']));
    rows.push([]);
  }
  const rowEls = container.querySelectorAll('.anom-breakdown-row');
  if (rowEls.length) {
    rows.push(headers);
    rowEls.forEach((rowEl) => {
      const cells = [...rowEl.children]
        .filter((c) => c.innerText.trim().length > 0)
        .map((c) => translateValueSubstrings(c.innerText.replace(/\s*\n\s*/g, ' ').trim()));
      if (cells.length) rows.push(cells);
    });
  }
  if (!rows.length) { alert('Нет данных для экспорта — блок пуст при текущих фильтрах.'); return; }
  downloadCSV(filename, rows);
}

function exportAnomaliesFullToCSV() {
  const all = typeof computeAnomalies === 'function' ? computeAnomalies() : [];
  if (!all.length) { alert('Нет аномалий для экспорта (при текущих фильтрах/периоде).'); return; }
  const featureKeys = all[0].features.map((f) => f.key);
  const methodKeys = all[0].methods.map((m) => m.key);
  const header = [
    'CL', 'Author', 'Date', 'Depot', 'Workspace', 'Description', 'Files',
    'Method votes', 'Top signal',
    ...featureKeys.flatMap((k) => [k + '_actual', k + '_typical']),
    ...methodKeys.map((k) => k + '_active'),
  ];
  const rows = [header];
  all.forEach((r) => {
    const row = [
      r.commit.cl, r.commit.author, r.commit.date.toISOString().slice(0, 19).replace('T', ' '),
      r.commit.depot.replace(/^\/\//, '').replace(/\/$/, ''), r.commit.workspace, r.commit.desc,
      r.commit.files.map((f) => f.path.split('/').pop()).join(' | '),
      r.votes + '/4', translateLabel(r.topSignal?.label || ''),
    ];
    r.features.forEach((f) => row.push(
      f.fmt ? translateValueSubstrings(f.fmt(f.actual)) : f.actual,
      f.fmt ? translateValueSubstrings(f.fmt(f.typical)) : f.typical,
    ));
    r.methods.forEach((m) => row.push(m.active ? 'yes' : 'no'));
    rows.push(row);
  });
  downloadCSV('anomalies_full.csv', rows);
}

function exportChartToCSV(canvasId, filename) {
  const chart = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
  if (!chart) { alert('График сейчас не отрисован — нечего экспортировать.'); return; }
  const { labels, datasets } = chart.data;
  if (!datasets || !datasets.length) { alert('Нет данных для экспорта.'); return; }
  const isScatterLike = datasets[0].data && datasets[0].data.length && typeof datasets[0].data[0] === 'object' && !Array.isArray(datasets[0].data[0]);
  let rows;
  if (isScatterLike) {

    const xTitle = translateValueSubstrings(chart.options?.scales?.x?.title?.text || 'X');
    const yTitle = translateValueSubstrings(chart.options?.scales?.y?.title?.text || 'Y');
    rows = [['Series', xTitle, yTitle]];
    datasets.forEach((ds) => (ds.data || []).forEach((pt) => rows.push([translateValueSubstrings(ds.label || ''), pt.x, pt.y])));
  } else {
    rows = [['', ...datasets.map((ds) => translateValueSubstrings(ds.label || ''))]];
    (labels || []).forEach((lbl, i) => rows.push([translateValueSubstrings(String(lbl)), ...datasets.map((ds) => ds.data[i] ?? '')]));
  }
  downloadCSV(filename, rows);
}

function csvExportBtnHtml(onclick, label) {
  return `<button class="csv-export-btn" onclick="${onclick}" title="Экспортировать в CSV">
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/><path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/></svg>
    ${label || 'CSV'}
  </button>`;
}

async function exportAuthorCardsBundleToCSV() {
  let count = 0;
  try { exportAuthorsFullToCSV(); count++; } catch (e) {}
  await new Promise((r) => setTimeout(r, 200));
  try { exportAuthorsFilesToCSV(); count++; } catch (e) {}
  await new Promise((r) => setTimeout(r, 200));
  try { exportAuthorsActivityToCSV(); count++; } catch (e) {}
  if (!count) alert('Не нашлось данных по авторам для экспорта.');
}

async function exportAllAuthorsToCSV() {
  let count = 0;
  const tryExport = (fn) => { try { const r = fn(); if (r) { downloadCSV(r.filename, r.rows); count++; } } catch (e) {} };

  try { exportAuthorsFullToCSV(); count++; } catch (e) {}
  try { exportAuthorsFilesToCSV(); count++; } catch (e) {}
  try { exportAuthorsActivityToCSV(); count++; } catch (e) {}

  const chartExport2 = (canvasId, name) => {
    const chart = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
    if (!chart) return null;
    const { labels, datasets } = chart.data;
    if (!datasets || !datasets.length) return null;
    const isScatterLike = datasets[0].data && datasets[0].data.length && typeof datasets[0].data[0] === 'object' && !Array.isArray(datasets[0].data[0]);
    let rows;
    if (isScatterLike) {
      const xTitle = translateValueSubstrings(chart.options?.scales?.x?.title?.text || 'X');
      const yTitle = translateValueSubstrings(chart.options?.scales?.y?.title?.text || 'Y');
      rows = [['Series', xTitle, yTitle]];
      datasets.forEach((ds) => (ds.data || []).forEach((pt) => rows.push([translateValueSubstrings(ds.label || ''), pt.x, pt.y])));
    } else {
      rows = [['', ...datasets.map((ds) => translateValueSubstrings(ds.label || ''))]];
      (labels || []).forEach((lbl, i) => rows.push([translateValueSubstrings(String(lbl)), ...datasets.map((ds) => ds.data[i] ?? '')]));
    }
    return rows.length > 1 ? { filename: name + '.csv', rows } : null;
  };
  for (const [id, name] of [['authorClusterChart', 'authors_clustering'], ['userBarChart', 'authors_comparison'], ['scatterChart', 'authors_scatter']]) {
    tryExport(() => chartExport2(id, name));
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!count) alert('Не нашлось данных ни в одном из под-разделов Авторов.');
}

function exportEntityPivotToCSV(containerSelector, filename, entityColLabel) {
  const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
  if (!container) return;
  const sections = container.querySelectorAll('.fuser-section');
  if (!sections.length) { alert('Нет данных для экспорта.'); return; }
  const metricLabels = [...sections[0].querySelectorAll('.fc')].map((c) => translateLabel(c.querySelector('.fc-label')?.innerText.trim() || ''));
  const rows = [[entityColLabel || 'Entity', ...metricLabels]];
  sections.forEach((sec) => {
    const name = sec.querySelector('.fuser-name')?.innerText.trim() || '';
    const values = [...sec.querySelectorAll('.fc')].map((c) => translateValueSubstrings(c.querySelector('.fc-val')?.innerText.trim() || ''));
    rows.push([name, ...values]);
  });
  downloadCSV(filename, rows);
}

function exportActiveFactsTab() {
  const active = document.querySelector('.frpanel.on') || document.querySelector('.frpanel');
  if (!active) { alert('Нет активной вкладки.'); return; }
  const name = active.id.replace('frpanel-', '');
  if (name === 'overview') { alert('«Рекорды» — одноразовые факты, не таблица. Экспорт для этой вкладки намеренно не сделан.'); return; }

  if (name === 'statistics') {
    const statCards = active.querySelectorAll('.corr-stat-card');
    if (!statCards.length) { alert('Нет данных статистики для экспорта.'); return; }
    const rows = [['Metric', 'Count', 'Mean', 'Std', 'Median', 'Q25–75', 'IQR', 'Skew', 'Kurtosis', 'CV', 'Min', 'Max']];
    statCards.forEach((card) => {
      const titleRaw = card.querySelector('.corr-stat-card-title')?.innerText.trim() || ''; const title = translateLabel(titleRaw);
      const cells = [...card.querySelectorAll('.corr-stat-cell')].map((c) => translateValueSubstrings(c.querySelector('.corr-stat-v')?.innerText.trim() || ''));
      rows.push([title, ...cells]);
    });
    downloadCSV('facts_statistics.csv', rows);
    return;
  }
  const entityLabels = { users: 'Author', depots: 'Depot', workspaces: 'Workspace' };
  if (entityLabels[name]) {
    exportEntityPivotToCSV(active, 'facts_' + name + '.csv', entityLabels[name]);
    return;
  }
  exportFactsSectionedToCSV(active, 'facts_' + name + '.csv');
}

function collectAllExporters() {
  const list = [];
  const tableExport = (id, name, forcedHeader) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const rows = [];
    el.querySelectorAll('tr').forEach((tr, i) => {
      const cells = [...tr.children]
        .filter((td) => td.innerText.trim().length > 0)
        .map((td) => {
          const raw = td.innerText.replace(/\s*\n\s*/g, ' | ').trim();
          return (i === 0 && !forcedHeader) ? raw : translateValueSubstrings(raw);
        });
      if (cells.length) rows.push(cells);
    });
    if (rows.length < 1) return null;
    if (forcedHeader) rows.unshift(forcedHeader);
    else rows[0] = translateCsvHeaderRow(rows[0]);
    return rows.length > 1 ? { filename: name + '.csv', rows } : null;
  };
  const divRowsExport = (containerSel, rowSel, name, header) => {
    const container = document.querySelector(containerSel);
    if (!container) return null;
    const rowEls = container.querySelectorAll(rowSel);
    if (!rowEls.length) return null;
    const rows = header ? [header] : [];
    rowEls.forEach((rowEl) => {
      const cells = [...rowEl.children].map((c) => translateValueSubstrings(c.innerText.replace(/\s*\n\s*/g, ' ').trim()));
      if (cells.length) rows.push(cells);
    });
    return rows.length > (header ? 1 : 0) ? { filename: name + '.csv', rows } : null;
  };
  const cardsExport = (containerSel, name) => {
    const container = document.querySelector(containerSel);
    if (!container) return null;
    const cards = container.querySelectorAll('.fc');
    if (!cards.length) return null;
    const rows = [['Metric', 'Value', 'Note']];
    cards.forEach((c) => {
      const label = c.querySelector('.fc-label')?.innerText.trim() || '';
      rows.push([
        translateLabel(label),
        translateValueSubstrings(c.querySelector('.fc-val')?.innerText.trim() || ''),
        translateValueSubstrings(c.querySelector('.fc-sub')?.innerText.trim() || ''),
      ]);
    });
    return { filename: name + '.csv', rows };
  };
  const sectionedCardsExport = (containerSel, name) => {
    const container = document.querySelector(containerSel);
    if (!container) return null;
    const sectionTitles = container.querySelectorAll('.fr-sec-title');
    if (!sectionTitles.length) return cardsExport(containerSel, name);
    const rows = [];
    sectionTitles.forEach((titleEl) => {
      const sectionName = translateLabel(titleEl.innerText.trim());
      const cards = [];
      let node = titleEl.nextElementSibling;
      while (node && !node.classList.contains('fr-sec-title')) { cards.push(...node.querySelectorAll('.fc')); node = node.nextElementSibling; }
      if (!cards.length) return;
      rows.push(['— ' + sectionName + ' —']);
      rows.push(['Metric', 'Value', 'Note']);
      cards.forEach((c) => rows.push([
        translateLabel(c.querySelector('.fc-label')?.innerText.trim() || ''),
        translateValueSubstrings(c.querySelector('.fc-val')?.innerText.trim() || ''),
        translateValueSubstrings(c.querySelector('.fc-sub')?.innerText.trim() || ''),
      ]));
      rows.push([]);
    });
    return rows.length ? { filename: name + '.csv', rows } : null;
  };
  const entityPivotExport = (containerSel, name, entityColLabel) => {
    const container = document.querySelector(containerSel);
    if (!container) return null;
    const sections = container.querySelectorAll('.fuser-section');
    if (!sections.length) return null;
    const metricLabels = [...sections[0].querySelectorAll('.fc')].map((c) => translateLabel(c.querySelector('.fc-label')?.innerText.trim() || ''));
    const rows = [[entityColLabel, ...metricLabels]];
    sections.forEach((sec) => {
      const name2 = sec.querySelector('.fuser-name')?.innerText.trim() || '';
      const values = [...sec.querySelectorAll('.fc')].map((c) => translateValueSubstrings(c.querySelector('.fc-val')?.innerText.trim() || ''));
      rows.push([name2, ...values]);
    });
    return { filename: name + '.csv', rows };
  };

  list.push(() => tableExport('extTable', 'files_top', ['Category', 'Value']));
  list.push(() => tableExport('cooccurTable', 'files_cooccurrence', ['Combination', 'Times together']));
  list.push(() => tableExport('fileClusterTable', 'files_clustering', ['Category', 'Value']));
  list.push(() => tableExport('anomalyBody', 'anomalies_submits', ['CL', 'Author', 'Files', 'Size', 'Date', 'Signal']));
  list.push(() => tableExport('anomAggregateBody', 'anomalies_aggregate'));
  list.push(() => tableExport('hfTbody', 'hot_files', ['#', 'File', 'Author', 'Activity', 'Metric']));
  list.push(() => {
    const days = daysForBlock('heatmap');
    const rows = [['Date', 'Author', 'Submits', 'Files', 'Volume (GB)']];
    days.forEach((d) => USERS.forEach((u) => {
      const pu = d.perUser[u.name];
      if (!pu || !pu.commits || !pu.commits.length) return;
      rows.push([d.date.toISOString().slice(0, 10), u.name, pu.commits.length, pu.commits.reduce((s, c) => s + c.nFiles, 0), pu.commits.reduce((s, c) => s + c.sizeGB, 0).toFixed(3)]);
    }));
    return rows.length > 1 ? { filename: 'heatmap.csv', rows } : null;
  });
  const authorsFullExport = () => {
    const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
    if (!fd || !fd.users.length) return null;
    const anomsAll = typeof computeAnomalies === 'function' ? computeAnomalies() : [];
    const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const header = [
      'Author', 'Submits', 'Files changed', 'Total volume (GB)', 'Avg files/submit',
      'Avg gap (h)', 'Anomalous submits', 'Max streak (days)', 'Weekend %',
      'Avg submit size (MB)', 'Median size (MB)', 'Avg revisions', 'New files %', 'Workspaces',
      'Peak hour', 'Peak weekday', 'Most frequent type', 'Max pause without submits (days)',
      'Biggest submit', 'Biggest submit CL', 'Most files in one submit', 'Most files submit CL',
      'Longest description (chars)', 'Longest description CL',
      'Most diverse submit (types)', 'Most diverse submit CL',
      'Max file revision', 'Max revision file', 'Anomalous submits %',
    ];
    const rows = [header];
    fd.users.forEach((u) => {
      const myAnoms = anomsAll.filter((r) => r.commit.author === u.name);
      const list = u.list;
      const bySize = [...list].sort((a, b) => b.sizeGB - a.sizeGB)[0];
      const byFiles = [...list].sort((a, b) => b.nFiles - a.nFiles)[0];
      const byDescLen = [...list].sort((a, b) => b.desc.length - a.desc.length)[0];
      const byDiverse = [...list].sort((a, b) => new Set(b.files.map((f) => f.ext)).size - new Set(a.files.map((f) => f.ext)).size)[0];
      let maxRev = 0, maxRevFile = null;
      list.forEach((c) => c.files.forEach((f) => { const rv = parseRev(f.rev); if (rv > maxRev) { maxRev = rv; maxRevFile = f; } }));
      rows.push([
        u.name, u.commits, u.files, u.vol.toFixed(2), u.avgFiles.toFixed(1),
        u.avgGap.toFixed(1), myAnoms.length, u.streak, u.weekendPct.toFixed(0),
        u.avgSizeMB.toFixed(1), u.medSizeMB.toFixed(1), u.avgRev.toFixed(1), u.newRatioPct.toFixed(1), u.workspaces.join(' | '),
        String(u.favHour).padStart(2, '0') + ':00', WEEKDAY_EN[u.favDow], u.favExt ? '.' + u.favExt : '', u.maxPauseDays.toFixed(1),
        bySize.totalSize, bySize.cl, byFiles.nFiles, byFiles.cl,
        byDescLen.desc.length, byDescLen.cl,
        new Set(byDiverse.files.map((f) => f.ext)).size, byDiverse.cl,
        maxRevFile ? maxRevFile.rev : '', maxRevFile ? maxRevFile.path.split('/').pop() : '',
        (myAnoms.length / u.commits * 100).toFixed(1) + '%',
      ]);
    });
    return { filename: 'authors_full.csv', rows };
  };

  list.push(() => authorsFullExport());
  list.push(() => {
    const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
    if (!fd || !fd.users.length) return null;
    const rows = [['Author', 'File', 'Changes']];
    fd.users.forEach((u) => u.topFiles.forEach((f) => rows.push([u.name, f.file, f.count])));
    return { filename: 'authors_files.csv', rows };
  });
  list.push(() => {
    const fd = typeof computeFactsData === 'function' ? computeFactsData() : null;
    if (!fd || !fd.users.length) return null;
    const gran = window.authorTimeGran || 'hour';
    const fieldName = (typeof AUTHOR_TIME_GRAN_META !== 'undefined' && AUTHOR_TIME_GRAN_META[gran]) ? AUTHOR_TIME_GRAN_META[gran].field : 'Hour';
    const rows = [['Author', fieldName, 'Submits']];
    fd.users.forEach((u) => {
      const { labels, values } = computeAuthorTimeBuckets(u, gran);
      const enLabels = translateTimeLabels(labels, gran);
      enLabels.forEach((lbl, i) => rows.push([u.name, lbl, values[i]]));
    });
    return { filename: 'authors_activity_' + gran + '.csv', rows };
  });
  list.push(() => entityPivotExport('#frpanel-users', 'facts_authors', 'Author'));
  list.push(() => entityPivotExport('#frpanel-depots', 'facts_depots', 'Depot'));
  list.push(() => entityPivotExport('#frpanel-workspaces', 'facts_workspaces', 'Workspace'));
  list.push(() => sectionedCardsExport('#frpanel-time', 'facts_time'));
  list.push(() => sectionedCardsExport('#frpanel-filetypes', 'facts_filetypes'));
  list.push(() => divRowsExport('#bfRight', '.bf-file-row', 'busfactor_' + bfView));
  list.push(() => divRowsExport('#aprioriList', '.rule', 'apriori_rules'));
  list.push(() => divRowsExport('#anomGroupBreakdown', '.anom-breakdown-row', 'anomalies_share_by_group', ['Group', 'Count (Share)']));
  list.push(() => divRowsExport('#anomBreakdown', '.anom-breakdown-row', 'anomalies_feature_combos', ['Combination', 'Count (Share)']));
  list.push(() => divRowsExport('#anomMethodBreakdown', '.anom-breakdown-row', 'anomalies_method_agreement', ['Method pair', 'Count (Share)']));
  list.push(() => divRowsExport('#anomTopDiffFeatures', '.anom-breakdown-row', 'anomalies_top_differing_features', ['Feature', 'Value']));
  list.push(() => divRowsExport('#anomAggCombos', '.anom-breakdown-row', 'anomalies_agg_feature_combos', ['Combination', 'Count (Share)']));
  list.push(() => divRowsExport('#anomAggMethods', '.anom-breakdown-row', 'anomalies_agg_method_agreement', ['Method pair', 'Count (Share)']));
  list.push(() => divRowsExport('#anomAggTopDiff', '.anom-breakdown-row', 'anomalies_agg_top_differing_features', ['Feature', 'Value']));
  list.push(() => divRowsExport('#anomDaysRate', '.anom-breakdown-row', 'anomalies_days_rate', ['Day/Month', 'Share']));

  const chartExport = (canvasId, name) => {
    const chart = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
    if (!chart) return null;
    const { labels, datasets } = chart.data;
    if (!datasets || !datasets.length) return null;
    const isScatterLike = datasets[0].data && datasets[0].data.length && typeof datasets[0].data[0] === 'object' && !Array.isArray(datasets[0].data[0]);
    let rows;
    if (isScatterLike) {
      const xTitle = translateValueSubstrings(chart.options?.scales?.x?.title?.text || 'X');
      const yTitle = translateValueSubstrings(chart.options?.scales?.y?.title?.text || 'Y');
      rows = [['Series', xTitle, yTitle]];
      datasets.forEach((ds) => (ds.data || []).forEach((pt) => rows.push([translateValueSubstrings(ds.label || ''), pt.x, pt.y])));
    } else {
      rows = [['', ...datasets.map((ds) => translateValueSubstrings(ds.label || ''))]];
      (labels || []).forEach((lbl, i) => rows.push([translateValueSubstrings(String(lbl)), ...datasets.map((ds) => ds.data[i] ?? '')]));
    }
    return rows.length > 1 ? { filename: name + '.csv', rows } : null;
  };
  list.push(() => chartExport('avgChart', 'distribution'));
  list.push(() => chartExport('weekChart', 'trend'));
  list.push(() => chartExport('userBarChart', 'authors_comparison'));
  list.push(() => chartExport('scatterChart', 'authors_scatter'));
  list.push(() => chartExport('authorClusterChart', 'authors_clustering'));
  list.push(() => chartExport('tlChart', 'timeline'));
  return list;
}

async function exportAllToCSV() {
  const exporters = collectAllExporters();
  let count = 0;
  for (const getResult of exporters) {
    let result;
    try { result = getResult(); } catch (e) { result = null; }
    if (!result) continue;
    downloadCSV(result.filename, result.rows);
    count++;
    await new Promise((r) => setTimeout(r, 220));
  }
  if (!count) alert('Не нашлось ни одного датасета с данными для экспорта — попробуйте на других вкладках/фильтрах.');
}
