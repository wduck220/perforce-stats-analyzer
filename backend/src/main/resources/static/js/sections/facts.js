

const NA = '<span class="fact-nodata">нет данных<span class="fact-badge-na">н/д</span></span>';
function fmtGB(v){ return v.toFixed(2)+' ГБ'; }
function fmtMB(v){ return v.toFixed(1)+' МБ'; }
function fmtNum(n){ return Math.round(n).toLocaleString('ru'); }
function fmtDateRu(d){ return d.toLocaleDateString('ru',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtDateTimeRu(d){ return d.toLocaleString('ru',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function parseSizeKB(sizeStr){ return parseFloat(sizeStr)||0; }
function parseRev(revStr){ return parseInt(String(revStr||'#0').replace('#',''),10)||0; }
const BINARY_EXTS = new Set(['uasset','png','umap','fbx','wav','mat']);
const WEEKDAY_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTH_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function fc(icon,label,val,sub,stripe,detailKey){
  const clickable=!!detailKey;
  const onclick=clickable?`onclick="(function(){var c=buildFdmCfg('${detailKey}');if(c)openFdm(c);})()"` :'';
  return `<div class="fc ${stripe||'sm'}${clickable?' clickable':''}" ${onclick}>
    <div class="fc-label">${label}</div>
    <div class="fc-val">${val}</div>
    ${sub?`<div class="fc-sub">${sub}</div>`:''}
    ${clickable?`<div class="fc-click-hint">подробнее →</div>`:''}
  </div>`;
}
function fcChamp(icon,label,val,sub,stripe,bg,color){
  return `<div class="fc fc-champ ${stripe||'sm'}">
    <div class="fc-champ-av" style="background:${bg||'var(--s2)'};color:${color||'var(--text)'}">${icon}</div>
    <div class="fc-champ-info">
      <div class="fc-label">${label}</div>
      <div class="fc-val big">${val}</div>
      ${sub?`<div class="fc-sub">${sub}</div>`:''}
    </div>
  </div>`;
}
function secTitle(t){ return `<div class="fr-sec-title">${t}</div>`; }
function fcGrid(cards,cols){ return `<div class="fc-grid${cols?` cols${cols}`:''}">${cards.join('')}</div>`; }
function ruleCards(r){
  const ants=r.ant.map(a=>`<span class="fc-ant">${a}</span>`).join(' ');
  const cons=r.cons.map(c=>`<span class="fc-con">${c}</span>`).join(' ');
  return `<div class="fc-rule">${ants}<span class="fc-arrow">→</span>${cons}</div>`;
}
function openAnlRuleModal(idx){
  const r = (window.__anlApRules||[])[idx];
  if(!r || typeof apRuleSentence!=='function') return;
  openFdm({ label:'Ассоциативное правило', val:'lift '+r.lift.toFixed(1), sub:'support '+(r.sup*100).toFixed(1)+'% · confidence '+(r.conf*100).toFixed(0)+'%', stripe:'sb',
    body:`<div class="fdm-sec"><div class="fdm-sec-title">Для пользователя</div><div style="font-size:13px;color:var(--text);line-height:1.6;background:var(--bg);border:1px solid var(--border2);border-radius:6px;padding:12px 14px;">${apRuleSentence(r)}</div></div>
      <div class="fdm-sec"><div class="fdm-sec-title">Метрики</div>${fdmStats([[(r.sup*100).toFixed(1)+'%','Support'],[(r.conf*100).toFixed(0)+'%','Confidence'],[r.lift.toFixed(1),'Lift']])}</div>` });
}

let factsDataCache = null;

function invalidateFactsCache() {
  factsDataCache = null;
}
function computeFactsData(){
  if (factsDataCache) return factsDataCache;
  const commits = (typeof anomAllCommits === 'function' ? anomAllCommits('facts') : []).slice().sort((a,b)=>a.date-b.date);
  if (!commits.length) { factsDataCache = null; return null; }

  const totalVol = commits.reduce((s,c)=>s+c.sizeGB,0);
  const totalFiles = commits.reduce((s,c)=>s+c.nFiles,0);
  const first = commits[0], last = commits[commits.length-1];
  const totalDays = Math.round((last.date-first.date)/86400000);
  const weekendCount = commits.filter(c=>{const dw=c.date.getDay();return dw===0||dw===6;}).length;

  const byDay = {};
  commits.forEach(c=>{ const k=c.date.toISOString().slice(0,10); (byDay[k]||(byDay[k]=[])).push(c); });
  const dayEntries = Object.entries(byDay).sort((a,b)=>new Date(a[0])-new Date(b[0]));

  const byAuthor = {};
  commits.forEach(c=>{ (byAuthor[c.author]||(byAuthor[c.author]=[])).push(c); });
  const users = Object.entries(byAuthor).map(([name,list])=>{
    const u = USERS.find(x=>x.name===name);
    const vol = list.reduce((s,c)=>s+c.sizeGB,0);
    const files = list.reduce((s,c)=>s+c.nFiles,0);
    const weekend = list.filter(c=>{const dw=c.date.getDay();return dw===0||dw===6;}).length;
    const hours = Array(24).fill(0);
    list.forEach(c=>hours[c.date.getHours()]++);
    const favHour = hours.indexOf(Math.max(...hours));
    const extCounts={}; list.forEach(c=>c.files.forEach(f=>{extCounts[f.ext]=(extCounts[f.ext]||0)+1;}));
    const favExt = Object.entries(extCounts).sort((a,b)=>b[1]-a[1])[0];
    const sortedDates=list.map(c=>c.date).sort((a,b)=>a-b);
    const gaps=[]; for(let i=1;i<sortedDates.length;i++) gaps.push((sortedDates[i]-sortedDates[i-1])/3600000);
    const avgGap = gaps.length ? gaps.reduce((s,g)=>s+g,0)/gaps.length : 0;
    const authorDayKeys=[...new Set(list.map(c=>c.date.toISOString().slice(0,10)))].sort();
    let streak=0,best=0; const oneDay=86400000;
    for(let i=0;i<authorDayKeys.length;i++){
      if(i===0||new Date(authorDayKeys[i])-new Date(authorDayKeys[i-1])===oneDay) streak++; else streak=1;
      if(streak>best) best=streak;
    }
    let newFiles=0,revTotal=0,revSum=0; list.forEach(c=>c.files.forEach(f=>{revTotal++; revSum+=parseRev(f.rev); if(parseRev(f.rev)===1) newFiles++;}));
    const depotCounts={}; list.forEach(c=>{const dp=c.depot.replace(/^\/\//,'').replace(/\/$/,'');depotCounts[dp]=(depotCounts[dp]||0)+1;});
    const wsCounts={}; list.forEach(c=>{wsCounts[c.workspace]=(wsCounts[c.workspace]||0)+1;});
    const weekdayCounts=Array(7).fill(0); list.forEach(c=>weekdayCounts[c.date.getDay()]++);
    const favDow = weekdayCounts.indexOf(Math.max(...weekdayCounts));
    let maxPauseDays=0; for(let i=1;i<sortedDates.length;i++){ const gd=(sortedDates[i]-sortedDates[i-1])/86400000; if(gd>maxPauseDays) maxPauseDays=gd; }
    const sizesSorted = list.map(c=>c.sizeGB*1024).sort((a,b)=>a-b);
    const medSizeMB = sizesSorted.length ? sizesSorted[Math.floor(sizesSorted.length/2)] : 0;
    const fileNameCounts={}; list.forEach(c=>c.files.forEach(f=>{const nm=f.path.split('/').pop();fileNameCounts[nm]=(fileNameCounts[nm]||0)+1;}));
    const topFiles = Object.entries(fileNameCounts).sort((a,b)=>b[1]-a[1]).slice(0,200).map(([file,count])=>({file,count}));
    return {
      name, color:u?u.color:'var(--muted)', bg:u?u.bg:'var(--s2)', commits:list.length, list,
      pct:(list.length/commits.length)*100, vol, files, avgFiles:files/list.length,
      gbPerCommit:vol/list.length, weekendPct:(weekend/list.length)*100, hours, favHour, weekdayCounts, favDow,
      favExt: favExt?favExt[0]:null, favExtCount: favExt?favExt[1]:0, avgGap, streak: best, maxPauseDays,
      newRatioPct: revTotal?(newFiles/revTotal)*100:0, avgRev: revTotal?revSum/revTotal:0, extCounts,
      avgSizeMB: (vol*1024)/list.length, medSizeMB,
      topFiles: topFiles.length?topFiles:[{file:'—',count:0}],
      topDepot: Object.entries(depotCounts).sort((a,b)=>b[1]-a[1])[0],
      topWorkspace: Object.entries(wsCounts).sort((a,b)=>b[1]-a[1])[0],
      workspaces: [...new Set(list.map(c=>c.workspace))],
    };
  }).sort((a,b)=>b.commits-a.commits);

  const byDepotRaw = {};
  commits.forEach(c=>{ const dp=c.depot.replace(/^\/\//,'').replace(/\/$/,''); (byDepotRaw[dp]||(byDepotRaw[dp]=[])).push(c); });
  const depots = Object.entries(byDepotRaw).map(([name,list])=>{
    const vol = list.reduce((s,c)=>s+c.sizeGB,0);
    const files = list.reduce((s,c)=>s+c.nFiles,0);
    let newFiles=0,revTotal=0; list.forEach(c=>c.files.forEach(f=>{revTotal++; if(parseRev(f.rev)===1) newFiles++;}));
    const authorCounts={}; list.forEach(c=>{authorCounts[c.author]=(authorCounts[c.author]||0)+1;});
    const topAuthor = Object.entries(authorCounts).sort((a,b)=>b[1]-a[1])[0];
    const sortedDates=list.map(c=>c.date).sort((a,b)=>a-b);
    const half = Math.floor(sortedDates.length/2);
    const firstHalfCount = list.filter(c=>c.date<sortedDates[half]).length;
    const secondHalfCount = list.length-firstHalfCount;
    return {
      name, submits:list.length, pct:(list.length/commits.length)*100, vol, files,
      avgSizeMB: files? (vol*1024/files):0, newRatioPct: revTotal?(newFiles/revTotal)*100:0,
      uniqueAuthors: Object.keys(authorCounts).length, topAuthor,
      trend: secondHalfCount>firstHalfCount*1.15?'растёт':secondHalfCount<firstHalfCount*0.85?'снижается':'стабильно',
      firstHalfCount, secondHalfCount,
    };
  }).sort((a,b)=>b.vol-a.vol);

  const wsList = window.WORKSPACE_LIST||[];
  const workspaces = wsList.map(ws=>{
    const list = commits.filter(c=>c.workspace===ws);
    if(!list.length) return null;
    const s = computeStatsFromCommits(list, commits.length);
    const owner = typeof WORKSPACE_OWNER!=='undefined'?WORKSPACE_OWNER[ws]:null;
    const extCounts={}; list.forEach(c=>c.files.forEach(f=>{extCounts[f.ext]=(extCounts[f.ext]||0)+1;}));
    const topExt = Object.entries(extCounts).sort((a,b)=>b[1]-a[1])[0];
    return { name:ws, owner, stats:s, count:list.length, topExt };
  }).filter(Boolean);

  const hourCounts = Array(24).fill(0);
  const weekdayCounts = Array(7).fill(0);
  commits.forEach(c=>{ hourCounts[c.date.getHours()]++; weekdayCounts[c.date.getDay()]++; });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const quietHours = hourCounts.map((cnt,h)=>({h,c:cnt})).filter(x=>x.c>0).sort((a,b)=>a.c-b.c);
  const byMonth = {};
  commits.forEach(c=>{ const k=c.date.getFullYear()+'-'+String(c.date.getMonth()).padStart(2,'0'); (byMonth[k]||(byMonth[k]=[])).push(c); });
  const monthEntries = Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0]));
  const busiestMonth = [...monthEntries].sort((a,b)=>b[1].length-a[1].length)[0];

  let bestDay=null,bestDayVol=-1;
  dayEntries.forEach(([k,list])=>{ const vol=list.reduce((s,c)=>s+c.sizeGB,0); if(vol>bestDayVol){bestDayVol=vol;bestDay={key:k,list,vol,files:list.reduce((s,c)=>s+c.nFiles,0)};} });
  let densestDay=null,densestGapH=Infinity;
  dayEntries.forEach(([k,list])=>{
    if(list.length<2) return; const auths=new Set(list.map(c=>c.author)); if(auths.size<2) return;
    const sorted=list.slice().sort((a,b)=>a.date-b.date);
    for(let i=1;i<sorted.length;i++){ if(sorted[i].author===sorted[i-1].author) continue;
      const gapH=(sorted[i].date-sorted[i-1].date)/3600000; if(gapH<densestGapH){densestGapH=gapH;densestDay={key:k,authors:[...auths]};} }
  });
  let maxGapMs=0,maxGapStart=null,maxGapEnd=null;
  for(let i=1;i<commits.length;i++){ const g=commits[i].date-commits[i-1].date; if(g>maxGapMs){maxGapMs=g;maxGapStart=commits[i-1];maxGapEnd=commits[i];} }
  let teamStreak=0,teamStreakEnd=null,curStreak=0;
  const sortedDayDates=dayEntries.map(([k])=>new Date(k));
  for(let i=0;i<sortedDayDates.length;i++){ if(i===0||(sortedDayDates[i]-sortedDayDates[i-1])===86400000) curStreak++; else curStreak=1; if(curStreak>teamStreak){teamStreak=curStreak;teamStreakEnd=sortedDayDates[i];} }

  const extStats = {};
  const fileLastSeen = {};
  commits.forEach(c=>c.files.forEach(f=>{
    if(!extStats[f.ext]) extStats[f.ext]={ext:f.ext,count:0,sizeKB:0};
    extStats[f.ext].count++;
    extStats[f.ext].sizeKB += parseSizeKB(f.size);
    const nm=f.path.split('/').pop();
    if(!fileLastSeen[nm]||c.date>fileLastSeen[nm].date) fileLastSeen[nm]={date:c.date,ext:f.ext,path:f.path,cl:c.cl,author:c.author,sizeKB:parseSizeKB(f.size)};
  }));
  const extArr = Object.values(extStats).map(e=>({...e, sizeGB:e.sizeKB/1024/1024, avgSizeMB:(e.sizeKB/e.count)/1024, pct:(e.count/totalFiles)*100}));
  const totalExtEvents = extArr.reduce((s,e)=>s+e.count,0);
  const binaryCount = extArr.filter(e=>BINARY_EXTS.has(e.ext)).reduce((s,e)=>s+e.count,0);
  const textCount = totalExtEvents-binaryCount;

  const allFileEvents = [];
  commits.forEach(c=>c.files.forEach(f=>allFileEvents.push({path:f.path,ext:f.ext,action:f.action,rev:f.rev,sizeKB:parseSizeKB(f.size),cl:c.cl,author:c.author,date:c.date})));
  const biggestFiles = [...allFileEvents].sort((a,b)=>b.sizeKB-a.sizeKB).slice(0,10);
  const smallestFiles = [...allFileEvents].sort((a,b)=>a.sizeKB-b.sizeKB).slice(0,10);

  const lastSeenArr = Object.entries(fileLastSeen).map(([nm,v])=>({name:nm,...v}));
  const oldestTouched = [...lastSeenArr].sort((a,b)=>a.date-b.date).slice(0,10);
  const newestTouched = [...lastSeenArr].sort((a,b)=>b.date-a.date).slice(0,10);

  const extGaps = {};
  Object.keys(extStats).forEach(ext=>{
    const dts = allFileEvents.filter(f=>f.ext===ext).map(f=>f.date).sort((a,b)=>a-b);
    let maxGap=0; for(let i=1;i<dts.length;i++){ const g=(dts[i]-dts[i-1])/86400000; if(g>maxGap) maxGap=g; }
    extGaps[ext]=maxGap;
  });
  const extByMaxGap = Object.entries(extGaps).sort((a,b)=>b[1]-a[1]);
  const extByFreq = extArr.slice().sort((a,b)=>b.count-a.count);

  const diverseAuthor = users.map(u=>({name:u.name,color:u.color,uniqueExt:Object.keys(u.extCounts).length})).sort((a,b)=>b.uniqueExt-a.uniqueExt);

  let diverseDay=null,diverseCount=-1;
  dayEntries.forEach(([k,list])=>{ const exts=new Set(); list.forEach(c=>c.files.forEach(f=>exts.add(f.ext))); if(exts.size>diverseCount){diverseCount=exts.size;diverseDay={key:k,exts:[...exts],list};} });
  const fileNameCounts={}; commits.forEach(c=>c.files.forEach(f=>{const nm=f.path.split('/').pop();fileNameCounts[nm]=(fileNameCounts[nm]||0)+1;}));
  const hotspotArr = Object.entries(fileNameCounts).sort((a,b)=>b[1]-a[1]);

  const shortestDesc = [...commits].sort((a,b)=>a.desc.length-b.desc.length)[0];
  const longestDesc = [...commits].sort((a,b)=>b.desc.length-a.desc.length)[0];
  const descCounts={}; commits.forEach(c=>{descCounts[c.desc]=(descCounts[c.desc]||0)+1;});
  const topDesc = Object.entries(descCounts).sort((a,b)=>b[1]-a[1])[0];

  const roundCls = commits.filter(c=>parseInt(c.cl.replace('#',''),10)%1000===0);

  const byAuthorReal = {}; commits.forEach(c=>{ (byAuthorReal[c.author]||(byAuthorReal[c.author]={n:0,vol:0,files:0})).n++; });
  commits.forEach(c=>{ const a=byAuthorReal[c.author]; a.vol+=c.sizeGB; a.files+=c.nFiles; });
  const leaderboard = Object.entries(byAuthorReal).map(([name,s])=>{ const u=USERS.find(x=>x.name===name); return {name,...s,pct:(s.n/commits.length)*100,color:u?u.color:'var(--muted)'}; });

  const depotSpecialization = users.map(u=>{
    const top = u.topDepot;
    return { author:u.name, depot: top?top[0]:'—', pct: top?(top[1]/u.commits)*100:0 };
  });

  factsDataCache = {
    commits, totalVol, totalFiles, first, last, totalDays, weekendPct:(weekendCount/commits.length)*100,
    dayEntries, users, depots, workspaces, leaderboard, depotSpecialization,
    hourCounts, weekdayCounts, peakHour, quietHours, monthEntries, busiestMonth,
    bestDay, densestDay, densestGapH, maxGapDays: maxGapMs/86400000, maxGapStart, maxGapEnd, teamStreak, teamStreakEnd,
    extArr, totalExtEvents, binaryCount, textCount, biggestFiles, smallestFiles,
    oldestTouched, newestTouched, extByMaxGap, extByFreq, diverseAuthor,
    diverseDay, diverseCount, hotspotArr, shortestDesc, longestDesc, topDesc, roundCls,
    allFileEvents,
  };
  return factsDataCache;
}

function setFrTab(tab){
  document.querySelectorAll('#frTabs .frtab').forEach(b=>b.classList.remove('on'));
  document.querySelector(`#frTabs .frtab[onclick="setFrTab('${tab}')"]`).classList.add('on');
  document.querySelectorAll('.frpanel').forEach(p=>p.classList.remove('on'));
  document.getElementById('frpanel-'+tab).classList.add('on');

  const btn = document.getElementById('btnExportFactsTab');
  if (btn) btn.style.display = tab === 'overview' ? 'none' : '';
  const btnPdf = document.getElementById('btnExportFactsTabPdf');
  if (btnPdf) btnPdf.style.display = ['users', 'depots', 'workspaces'].includes(tab) ? '' : 'none';
}

function renderFrOverview(){
  const d = computeFactsData();
  if(!d){ document.getElementById('frpanel-overview').innerHTML=secTitle('Обзор')+'<div class="fc-sub" style="padding:12px">Нет данных</div>'; return; }

  const bySubmits=[...d.leaderboard].sort((a,b)=>b.n-a.n)[0];
  const byWeight=[...d.leaderboard].sort((a,b)=>b.vol-a.vol)[0];
  const byFiles=[...d.leaderboard].sort((a,b)=>b.files-a.files)[0];

  const champCards=[
    fc('','Лидер по сабмитам',`<span style="color:${bySubmits.color}">${bySubmits.name}</span>`,`${bySubmits.n} сабмитов · ${bySubmits.pct.toFixed(1)}%`,'sg','leader_submits'),
    fc('','Лидер по весу (объёму)',`<span style="color:${byWeight.color}">${byWeight.name}</span>`,`${byWeight.vol.toFixed(2)} ГБ`,'sb','leader_weight'),
    fc('','Лидер по числу файлов',`<span style="color:${byFiles.color}">${byFiles.name}</span>`,`${fmtNum(byFiles.files)} файлов`,'so','leader_files'),
  ];

  const topBySize=[...d.commits].sort((a,b)=>b.sizeGB-a.sizeGB)[0];
  const topByFiles=[...d.commits].sort((a,b)=>b.nFiles-a.nFiles)[0];
  const maxRevFile = [...d.allFileEvents].sort((a,b)=>parseRev(b.rev)-parseRev(a.rev))[0];
  const maxNewRatioCommit = (function(){
    let best=null,bestR=-1;
    d.commits.forEach(c=>{ if(!c.files.length) return; const nf=c.files.filter(f=>parseRev(f.rev)===1).length; const r=nf/c.files.length; if(r>bestR){bestR=r;best={c,r,nf};} });
    return best;
  })();
  const topDiverseCommit = [...d.commits].sort((a,b)=>new Set(b.files.map(f=>f.ext)).size-new Set(a.files.map(f=>f.ext)).size)[0];

  const dayOfMonthCounts = Array(32).fill(0);
  d.commits.forEach(c=>dayOfMonthCounts[c.date.getDate()]++);
  const bestDom = dayOfMonthCounts.indexOf(Math.max(...dayOfMonthCounts));

  const recCards=[
    fc('','Наиболее объёмный сабмит', topBySize.totalSize, topBySize.cl+' · '+topBySize.author, 'sr','top_size'),
    fc('','Рекорд файлов за раз', fmtNum(topByFiles.nFiles)+' файлов', topByFiles.cl+' · '+topByFiles.author, 'so','top_files'),
    fc('','Самый загруженный день', d.bestDay?fmtDateRu(new Date(d.bestDay.key)):NA, d.bestDay?d.bestDay.list.length+' сабмитов':'', 'sy','busiest_day'),
    fc('','Самое активное число месяца', bestDom+' число', dayOfMonthCounts[bestDom]+' сабмитов за всё время (сумма по всем месяцам)', 'sg','busiest_dom'),
    fc('','Максимальная ревизия файла', maxRevFile?'rev '+maxRevFile.rev:NA, maxRevFile?maxRevFile.path.split('/').pop():'', 'sb','top_rev'),
    fc('','Максимальная доля новых файлов', maxNewRatioCommit?'new_ratio = '+maxNewRatioCommit.r.toFixed(2):NA, maxNewRatioCommit?maxNewRatioCommit.nf+' файлов · '+maxNewRatioCommit.c.cl:'', 'sp','top_new_ratio'),
    fc('','Самый разнообразный сабмит', new Set(topDiverseCommit.files.map(f=>f.ext)).size+' типов файлов', topDiverseCommit.cl, 'sb','top_diverse'),
    fc('','Самое длинное описание', d.longestDesc.desc.length+' символов', d.longestDesc.cl, 'sm','top_desc'),
    fc('','Самое короткое описание', d.shortestDesc.desc.length+' символов', d.shortestDesc.cl, 'sm','min_desc'),
  ];

  const sumCards=[
    fc('','Всего сабмитов', fmtNum(d.commits.length), `за ${d.totalDays} дней`, 'sg'),
    fc('','Разработчиков', d.users.length, d.users.map(u=>u.name).join(' · '), 'sb'),
    fc('','Депо', d.depots.length, d.depots.map(x=>x.name).join(', '), 'so'),
    fc('','Воркспейсов', d.workspaces.length, d.workspaces.map(w=>w.name).join(', '), 'sp'),
    fc('','Суммарный объём', fmtGB(d.totalVol), `${fmtNum(d.totalFiles)} файловых событий`, 'sy'),
    fc('','Средний сабмит', (d.totalVol/d.commits.length).toFixed(2)+' ГБ', '', 'sm'),
    fc('','Период', fmtDateRu(d.first.date)+' →', fmtDateRu(d.last.date), 'sm'),
    fc('','Работа в выходные', d.weekendPct.toFixed(1)+'%', 'от всех сабмитов', 'so'),
  ];

  const topPauseAuthor = [...d.users].sort((a,b)=>b.maxPauseDays-a.maxPauseDays)[0];
  const moreCards=[
    fc('','Первый сабмит', fmtDateTimeRu(d.first.date), `${d.first.author} · ${d.first.cl}`, 'sg','mf_first_submit'),
    fc('','Последний сабмит', fmtDateTimeRu(d.last.date), `${d.last.author} · ${d.last.cl}`, 'sb','mf_last_submit'),
    fc('','Самая долгая тишина', d.maxGapDays.toFixed(1)+' дн.', d.maxGapStart?`с ${fmtDateRu(d.maxGapStart.date)} по ${fmtDateRu(d.maxGapEnd.date)}`:'', 'so','mf_silence'),
    fc('','Макс. личная пауза автора', topPauseAuthor.maxPauseDays.toFixed(1)+' дн.', `<span style="color:${topPauseAuthor.color}">${topPauseAuthor.name}</span> · часы с предыдущего сабмита`, 'sp','author_rank_maxPause'),
    fc('','Командный стрик', d.teamStreak+' дн. подряд', d.teamStreakEnd?`закончился ${fmtDateRu(d.teamStreakEnd)}`:'', 'sg','mf_streak'),
    fc('','Круглые номера CL', d.roundCls.length?d.roundCls.slice(0,5).map(c=>c.cl).join(', ')+(d.roundCls.length>5?'…':''):'не найдено', d.roundCls.length?`${d.roundCls.length} шт. кратно 1000`:'', 'sb', d.roundCls.length?'mf_round_cl':undefined),
    fc('','Самое частое описание', `«${d.topDesc[0]}»`, `встречается ${d.topDesc[1]} раз дословно`, 'sr','mf_freq_desc'),
  ];

  document.getElementById('frpanel-overview').innerHTML=
      secTitle('Лидеры') + fcGrid(champCards,2) +
      secTitle('Рекорды') + fcGrid(recCards) +
      secTitle('Сводка') + fcGrid(sumCards) +
      secTitle('Ещё рекорды') + fcGrid(moreCards);
}

function renderFrUsers(){
  const d = computeFactsData();
  const panel = document.getElementById('frpanel-users');
  if(!d){ panel.innerHTML=secTitle('Авторы')+'<div class="fc-sub" style="padding:12px">Нет данных</div>'; return; }
  let html='';
  d.users.forEach(u=>{
    const cards=[
      fc('','Сабмитов', fmtNum(u.commits), `${u.pct.toFixed(1)}% от всех`, 'sg', 'author_rank_commits'),
      fc('','Файлов', fmtNum(u.files), `${u.avgFiles.toFixed(1)} в среднем`, 'sg', 'author_rank_files'),
      fc('','Объём', u.vol.toFixed(2)+' ГБ', '', 'sg', 'author_rank_vol'),
      fc('','ГБ / сабмит', u.gbPerCommit.toFixed(3), '', 'sg', 'author_rank_gbPerCommit'),
      fc('','В выходные', u.weekendPct.toFixed(0)+'%', 'от сабмитов автора', 'sg', 'author_rank_weekendPct'),
      fc('','Любимый час', String(u.favHour).padStart(2,'0')+':00', 'пик сабмитов', 'sg', `author_hours_${u.name}`),
      fc('','Любимый тип', u.favExt?'.'+u.favExt:'—', u.favExt?`${u.favExtCount} файлов`:'', 'sg', `author_exts_${u.name}`),
      fc('','Ср. пауза', u.avgGap.toFixed(1)+' ч', 'между сабмитами', 'sg', 'author_rank_avgGap'),
      fc('','Макс. стрик', u.streak+' дн.', 'подряд с сабмитом', 'sg', 'author_rank_streak'),
      fc('','Новых файлов', u.newRatioPct.toFixed(0)+'%', 'доля rev=1', 'sg', 'author_rank_newRatioPct'),
      fc('','Основное депо', u.topDepot?u.topDepot[0]:'—', u.topDepot?((u.topDepot[1]/u.commits)*100).toFixed(0)+'%':'', 'sg', `mf_depot_spec_${u.name}`),
    ];
    html+=`<div class="fuser-section">
      <div class="fuser-hd" onclick="openAuthorModal('${u.name}')" style="cursor:pointer">
        <div class="fuser-av" style="background:${u.bg};color:${u.color}">${u.name[0].toUpperCase()}</div>
        <span class="fuser-name">${u.name}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:4px">· открыть полный профиль →</span>
      </div>
      ${fcGrid(cards)}
    </div>`;
  });
  panel.innerHTML = secTitle('Авторы') + html;
}

function renderMoreFactsDepotsSection(){
  const d = computeFactsData(); if(!d) return '';
  const cards = d.depotSpecialization.map(x=>{
    const isWeak = x.pct<40;
    return fc('', `Депо-специализация — ${x.author}`, x.depot, isWeak?`${x.pct.toFixed(0)}% — распределение почти равномерное`:`${x.pct.toFixed(0)}% сабмитов автора`, 'sb', `mf_depot_spec_${x.author}`);
  });
  return secTitle('Специализация по авторам') + fcGrid(cards);
}

function renderFrDepots(){
  const d = computeFactsData();
  const panel = document.getElementById('frpanel-depots');
  if(!d){ panel.innerHTML=secTitle('Депо')+'<div class="fc-sub" style="padding:12px">Нет данных</div>'; return; }

  const byVol=[...d.depots].sort((a,b)=>b.vol-a.vol)[0];
  const bySubmits=[...d.depots].sort((a,b)=>b.submits-a.submits)[0];
  const byAvgSize=[...d.depots].sort((a,b)=>b.avgSizeMB-a.avgSizeMB)[0];
  const byNewRatio=[...d.depots].sort((a,b)=>b.newRatioPct-a.newRatioPct)[0];

  const champsCards=[
    fc('','Больше всего данных', byVol.name, `${byVol.vol.toFixed(2)} ГБ`,'so', 'depot_rank_vol'),
    fc('','Больше всего сабмитов', bySubmits.name, `${bySubmits.submits} сабмитов`,'sg', 'depot_rank_submits'),
    fc('','Самый тяжёлый средний', byAvgSize.name, `${byAvgSize.avgSizeMB.toFixed(1)} МБ`,'sr', 'depot_rank_avgSizeMB'),
    fc('','Больше новых файлов', byNewRatio.name, `${byNewRatio.newRatioPct.toFixed(1)}%`,'sp', 'depot_rank_newRatioPct'),
  ];

  const depotCards = d.depots.map(dep=>`<div class="fuser-section">
    <div class="fuser-hd"><span class="fuser-name">${dep.name}</span></div>
    ${fcGrid([
      fc('','Сабмитов', fmtNum(dep.submits), `${dep.pct.toFixed(1)}% от всех`, 'so', 'depot_rank_submits'),
      fc('','Файлов', fmtNum(dep.files), '', 'so', 'depot_rank_files'),
      fc('','Объём', dep.vol.toFixed(2)+' ГБ', '', 'so', 'depot_rank_vol'),
      fc('','Ср. размер файла', dep.avgSizeMB.toFixed(1)+' МБ', '', 'so', 'depot_rank_avgSizeMB'),
      fc('','Новых файлов', dep.newRatioPct.toFixed(0)+'%', 'доля rev=1', 'so', 'depot_rank_newRatioPct'),
      fc('','Авторов', dep.uniqueAuthors, '', 'so', 'depot_rank_uniqueAuthors'),
      fc('','Основной автор', dep.topAuthor?dep.topAuthor[0]:'—', dep.topAuthor?((dep.topAuthor[1]/dep.submits)*100).toFixed(0)+'%':'', 'so', `depot_top_author_${dep.name}`),
      fc('','Динамика', dep.trend, `${dep.firstHalfCount} → ${dep.secondHalfCount} сабм. (1-я/2-я половина периода)`, dep.trend==='растёт'?'sg':dep.trend==='снижается'?'sr':'sm', `depot_trend_${dep.name}`),
    ])}
  </div>`).join('');

  panel.innerHTML=secTitle('Сравнение депо') + fcGrid(champsCards, 2) + depotCards + renderMoreFactsDepotsSection();
}

function renderFrWorkspaces(){
  const d = computeFactsData();
  const panel = document.getElementById('frpanel-workspaces');
  if(!d || !d.workspaces.length){ panel.innerHTML=secTitle('Воркспейсы')+'<div class="fc-sub" style="padding:12px">Нет данных</div>'; return; }
  const stripes=['sg','sb','so','sp','sr','sy'];
  let html='';
  d.workspaces.forEach((w,i)=>{
    const s=w.stats, stripe=stripes[i%stripes.length];
    const ownerUser = w.owner?USERS.find(u=>u.name===w.owner):null;
    const cards=[
      fc('','Сабмитов', fmtNum(w.count), `${s.share}% от всех`, stripe, 'ws_rank_count'),
      fc('','Суммарный объём', s.vol.toFixed(2)+' ГБ', '', stripe, 'ws_rank_vol'),
      fc('','Ср. файлов/сабмит', s.avgFiles.toFixed(1), '', stripe, 'ws_rank_avgFiles'),
      fc('','ГБ / сабмит', s.gbPerCommit.toFixed(3), '', stripe, 'ws_rank_gbPerCommit'),
      fc('','В выходные', s.weekendPct.toFixed(0)+'%', '', stripe, 'ws_rank_weekendPct'),
      fc('','Ср. пауза', s.avgGap+' ч', '', stripe, 'ws_rank_avgGap'),
      fc('','Макс. стрик', s.streak+' дн.', '', stripe, 'ws_rank_streak'),
      fc('','Новых файлов', s.newRatio+'%', '', stripe, 'ws_rank_newRatio'),
      fc('','Любимый тип', w.topExt?'.'+w.topExt[0]:'—', w.topExt?`${w.topExt[1]} файлов`:'', stripe, `ws_exts_${w.name}`),
    ];
    html+=`<div class="fuser-section">
      <div class="fuser-hd">
        <div class="fuser-av" style="background:${ownerUser?ownerUser.bg:'var(--s2)'};color:${ownerUser?ownerUser.color:'var(--text)'}">${w.name[0].toUpperCase()}</div>
        <span class="fuser-name">${w.name}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:4px">· владелец: ${w.owner?`<span style="color:${ownerUser.color}">${w.owner}</span>`:'н/д'}</span>
      </div>
      ${fcGrid(cards)}
    </div>`;
  });
  panel.innerHTML = secTitle('Воркспейсы') + html;
}

function renderFrTime(){
  const d = computeFactsData();
  const panel = document.getElementById('frpanel-time');
  if(!d){ panel.innerHTML=secTitle('Паттерны времени')+'<div class="fc-sub" style="padding:12px">Нет данных</div>'; return; }

  const quiet = d.quietHours[0];
  const half = Math.floor(d.monthEntries.length/2);
  const firstHalf = d.monthEntries.slice(0,half).reduce((s,e)=>s+e[1].length,0);
  const secondHalf = d.monthEntries.slice(half).reduce((s,e)=>s+e[1].length,0);

  const cards=[
    fc('','Пиковый час', String(d.peakHour).padStart(2,'0')+':00', `${d.hourCounts[d.peakHour]} сабмитов`, 'sg', 'time_peak_hour'),
    fc('','Самый тихий (но не нулевой) час', quiet?String(quiet.h).padStart(2,'0')+':00':'—', quiet?`${quiet.c} сабмитов`:'', 'sb'),
    fc('','Пиковый день недели', WEEKDAY_RU[d.weekdayCounts.indexOf(Math.max(...d.weekdayCounts))], `${Math.max(...d.weekdayCounts)} сабмитов`, 'so', 'time_peak_weekday'),
    fc('','Тренд по периоду', secondHalf>firstHalf*1.1?'рост':secondHalf<firstHalf*0.9?'спад':'стабильно', `${firstHalf} → ${secondHalf} сабм. (1-я/2-я половина)`, secondHalf>firstHalf?'sg':'sr'),
    fc('','Самый продуктивный день команды', d.bestDay?fmtDateRu(new Date(d.bestDay.key)):NA, d.bestDay?`${d.bestDay.vol.toFixed(2)} ГБ · ${d.bestDay.files} файлов · ${d.bestDay.list.length} сабмитов`:'', 'sg','mf_best_day'),
    fc('','День максимальной плотности', d.densestDay?fmtDateRu(new Date(d.densestDay.key)):'не найден', d.densestDay?`${d.densestDay.authors.join(' и ')}, разрыв ${d.densestGapH.toFixed(1)} ч`:'', 'sb', d.densestDay?'mf_dense_day':undefined),
  ];
  panel.innerHTML= secTitle('Паттерны времени') + fcGrid(cards);
}

window.frAnalyticsViewMode = 'functional';
function setFrAnalyticsViewMode(mode) {
  window.frAnalyticsViewMode = mode;
  document.querySelectorAll('#frAnalyticsViewTabs .ap-view-tab').forEach((btn) => btn.classList.toggle('on', btn.getAttribute('data-mode') === mode));
  document.getElementById('frAnalyticsFunctional').style.display = mode === 'functional' ? '' : 'none';
  document.getElementById('frAnalyticsUser').style.display = mode === 'user' ? '' : 'none';
}
function renderFrAnalytics(){
  const d = computeFactsData();
  const panel = document.getElementById('frpanel-analytics');
  if(!d){ panel.innerHTML=secTitle('Аналитика')+'<div class="fc-sub" style="padding:12px">Нет данных</div>'; return; }
  try {
    renderFrAnalyticsInner(d, panel);
  } catch(e) {
    panel.innerHTML = secTitle('Аналитика') + `<div class="fc-sub" style="padding:12px;color:var(--red)">Ошибка при расчёте: ${e.message}</div>`;
  }
}
function renderFrAnalyticsInner(d, panel){
  const sample = d.commits.length>400 ? d.commits.filter((_,i)=>i%Math.ceil(d.commits.length/400)===0) : d.commits;
  const points = sample.map(c=>[c.nFiles, c.sizeGB*1000]);
  const km = typeof alKMeans==='function' ? alKMeans(points) : null;
  let clusterCards=[];
  if(km){
    const counts={}; km.labels.forEach(l=>counts[l]=(counts[l]||0)+1);
    const totalPts=km.labels.length;
    const palette=['sg','sb','so','sp','sr','sy'];
    clusterCards = km.centers.map((center,i)=>fc('',`Кластер ${i+1}`, (counts[i]||0)+' сабм.', `${(((counts[i]||0)/totalPts)*100).toFixed(0)}% · ~${center[0].toFixed(1)} файлов, ~${(center[1]/1000).toFixed(2)} ГБ`, palette[i%6], `anl_cluster_${i}`));
  }

  const allAnoms = typeof computeAnomalies==='function' ? computeAnomalies() : [];
  const anomPct = (allAnoms.length/d.commits.length)*100;
  const featureCounts={}; allAnoms.forEach(r=>r.features.forEach(f=>{if(f.active) featureCounts[f.key]=(featureCounts[f.key]||0)+1;}));
  const topFeature = Object.entries(featureCounts).sort((a,b)=>b[1]-a[1])[0];
  const authorAnomCounts={}; allAnoms.forEach(r=>{authorAnomCounts[r.commit.author]=(authorAnomCounts[r.commit.author]||0)+1;});
  const topAnomAuthor = Object.entries(authorAnomCounts).sort((a,b)=>b[1]-a[1])[0];
  const anomByDay={}; allAnoms.forEach(r=>{const k=r.commit.date.toISOString().slice(0,10);anomByDay[k]=(anomByDay[k]||0)+1;});
  const topAnomDay = Object.entries(anomByDay).sort((a,b)=>b[1]-a[1])[0];

  const pyAnomLevel = window.PYTHON_REPORT && window.PYTHON_REPORT.anomalies ? window.PYTHON_REPORT.anomalies.submits : null;
  const pyAnomCard = pyAnomLevel
    ? fc('', 'Аномалий (Python ML)', pyAnomLevel.anomaly_count, pyAnomLevel.anomaly_pct + '% от ' + pyAnomLevel.total + ' сабмитов', 'sr')
    : fc('', 'Аномалий (Python ML)', '—', 'нет данных от Python-пайплайна', 'sr');

  const anomCards=[
    pyAnomCard,
    fc('','Всего аномалий (упрощённый расчёт)', allAnoms.length, `${anomPct.toFixed(1)}% от сабмитов — свой Z-score/IQR прямо в браузере, посчитано по вашим реальным данным, но другим методом, чем Python`, 'sr','anl_anomalies_list'),
    fc('','Главный признак', topFeature?(ANOM_SIGNAL_LABELS[topFeature[0]]||topFeature[0]):'—', topFeature?`сработал в ${topFeature[1]} из ${allAnoms.length}`:'', 'sr'),
    fc('','Автор с макс. аномалиями', topAnomAuthor?`<span style="color:${(USERS.find(u=>u.name===topAnomAuthor[0])||{}).color}">${topAnomAuthor[0]}</span>`:'—', topAnomAuthor?topAnomAuthor[1]+' шт.':'', 'sr'),
    fc('','День с макс. аномалий', topAnomDay?fmtDateRu(new Date(topAnomDay[0])):'—', topAnomDay?topAnomDay[1]+' шт.':'', 'so'),
  ];

  const apRules = typeof computeApRules==='function' ? computeApRules() : [];
  const bestLift=[...apRules].sort((a,b)=>b.lift-a.lift)[0];
  const bestSup=[...apRules].sort((a,b)=>b.sup-a.sup)[0];
  const bestConf=[...apRules].sort((a,b)=>b.conf-a.conf)[0];
  window.__anlApRules = [bestLift, bestSup, bestConf];
  const apCards = !bestLift ? [] : [
    `<div class="fc so clickable" style="grid-column:span 2" onclick="openAnlRuleModal(0)"><div class="fc-label">Самое сильное правило · lift ${bestLift.lift.toFixed(1)}</div>${ruleCards(bestLift)}<div class="fc-sub">support ${(bestLift.sup*100).toFixed(1)}% · confidence ${(bestLift.conf*100).toFixed(0)}%</div><div class="fc-click-hint">подробнее →</div></div>`,
    `<div class="fc sb clickable" style="grid-column:span 2" onclick="openAnlRuleModal(1)"><div class="fc-label">Самое частое правило · support ${(bestSup.sup*100).toFixed(1)}%</div>${ruleCards(bestSup)}<div class="fc-sub">confidence ${(bestSup.conf*100).toFixed(0)}% · lift ${bestSup.lift.toFixed(1)}</div><div class="fc-click-hint">подробнее →</div></div>`,
    `<div class="fc sg clickable" style="grid-column:span 2" onclick="openAnlRuleModal(2)"><div class="fc-label">Самое уверенное правило · confidence ${(bestConf.conf*100).toFixed(0)}%</div>${ruleCards(bestConf)}<div class="fc-sub">support ${(bestConf.sup*100).toFixed(1)}% · lift ${bestConf.lift.toFixed(1)}</div><div class="fc-click-hint">подробнее →</div></div>`,
  ];

  const userHtml = !bestLift ? '' : `
    <div class="ap-user-rule" style="cursor:default"><div class="ap-user-sentence">
      <b>Кластеры.</b> Сабмиты группируются в ${km?km.k:'несколько'} профиля(ей) поведения по объёму и числу файлов${km?` — силуэт разделения ${km.silhouette.toFixed(2)} (чем ближе к 1, тем чётче группы разделены)`:''}.
    </div></div>
    <div class="ap-user-rule" style="cursor:default"><div class="ap-user-sentence">
      <b>Аномалии.</b> Необычными признаны ${allAnoms.length} сабмитов (${anomPct.toFixed(1)}%) — обычно редкость, не система. Чаще всего выделяются по признаку «${topFeature?(ANOM_SIGNAL_LABELS[topFeature[0]]||topFeature[0]):'—'}».
    </div></div>
    <div class="ap-user-rule" style="cursor:default"><div class="ap-user-sentence">
      <b>Ассоциативные правила.</b> Самая сильная закономерность — если ${bestLift.ant.join(' и ')}, то с высокой вероятностью ${bestLift.cons.join(' и ')} (в ${bestLift.lift.toFixed(1)}× чаще случайного совпадения).
    </div></div>`;

  panel.innerHTML=
      `<div class="ap-view-tabs" id="frAnalyticsViewTabs" style="padding:0;border-bottom:1px solid var(--border);margin-bottom:14px">
        <button class="ap-view-tab on" data-mode="functional" onclick="setFrAnalyticsViewMode('functional')">Функциональный</button>
        <button class="ap-view-tab" data-mode="user" onclick="setFrAnalyticsViewMode('user')">Для пользователя</button>
      </div>
      <div id="frAnalyticsFunctional">` +
      secTitle('Кластеры') + `<button class="csv-export-btn" onclick="exportCardsToCSV('#frAnalyticsClusters','facts_analytics_clusters.csv')">⇩ CSV</button><div id="frAnalyticsClusters">${fcGrid(clusterCards, 2)}</div>` +
      secTitle('Аномалии') + `<button class="csv-export-btn" onclick="exportCardsToCSV('#frAnalyticsAnomalies','facts_analytics_anomalies.csv')">⇩ CSV</button><div id="frAnalyticsAnomalies" class="fc-grid cols3">${anomCards.join('')}</div>` +
      secTitle('Apriori') + `<button class="csv-export-btn" onclick="exportCardsToCSV('#frAnalyticsApriori','facts_analytics_apriori.csv')">⇩ CSV</button><div id="frAnalyticsApriori" class="fc-grid cols3">${apCards.join('')}</div>` +
      `</div><div id="frAnalyticsUser" style="display:none">${userHtml}</div>`;
}

window.frStatViewMode = 'functional';
function setFrStatViewMode(mode) {
  window.frStatViewMode = mode;
  document.querySelectorAll('#frStatViewTabs .ap-view-tab').forEach((btn) => btn.classList.toggle('on', btn.getAttribute('data-mode') === mode));
  document.getElementById('frStatFunctional').style.display = mode === 'functional' ? '' : 'none';
  document.getElementById('frStatUser').style.display = mode === 'user' ? '' : 'none';
}
function renderFrStatistics(){
  const panel = document.getElementById('frpanel-statistics');
  const d = computeFactsData();
  if(!d){ panel.innerHTML=secTitle('Статистика распределений')+'<div class="fc-sub" style="padding:12px">Нет данных</div>'; return; }

  const byAuthorSorted = {};
  d.commits.forEach(c=>{ (byAuthorSorted[c.author]||(byAuthorSorted[c.author]=[])).push(c); });
  Object.values(byAuthorSorted).forEach(list=>list.sort((a,b)=>a.date-b.date));
  const sinceLastMap = new Map();
  Object.values(byAuthorSorted).forEach(list=>{
    for(let i=0;i<list.length;i++){ if(i>0) sinceLastMap.set(list[i], (list[i].date-list[i-1].date)/3600000); }
  });

  const metrics = [
    { key:'file_count', label:'Число файлов в сабмите', unit:'файлов', fmt:(v)=>v.toFixed(1), values:d.commits.map(c=>c.nFiles) },
    { key:'unique_ext_count', label:'Уникальных типов файлов в сабмите', unit:'типов', fmt:(v)=>v.toFixed(2), values:d.commits.map(c=>new Set(c.files.map(f=>f.ext)).size) },
    { key:'total_size', label:'Объём сабмита', unit:'ГБ', fmt:(v)=>v.toFixed(3), values:d.commits.map(c=>c.sizeGB) },
    { key:'avg_size', label:'Средний размер файла', unit:'МБ', fmt:(v)=>(v*1000).toFixed(1), values:d.commits.map(c=>(c.sizeGB/c.nFiles)*1000) },
    { key:'desc_length', label:'Длина описания', unit:'символов', fmt:(v)=>v.toFixed(1), values:d.commits.map(c=>c.desc.length) },
    { key:'new_ratio', label:'Доля новых файлов (rev=1)', unit:'доля', fmt:(v)=>v.toFixed(3), values:d.commits.map(c=>{ const revs=c.files.map(f=>parseRev(f.rev)); return revs.length?revs.filter(r=>r===1).length/revs.length:0; }) },
    { key:'hours_since_last', label:'Часов с предыдущего сабмита автора', unit:'часов', fmt:(v)=>v.toFixed(1), values:d.commits.filter(c=>sinceLastMap.has(c)).map(c=>sinceLastMap.get(c)) },
  ];

  const skewNote = (s) => (Math.abs(s) < 0.3 ? 'почти симметрично' : s > 0 ? 'скошено вправо' : 'скошено влево');
  const kurtNote = (k) => (Math.abs(k) < 0.3 ? 'как у нормального' : k > 0 ? 'тяжёлые хвосты' : 'плоское распределение');

  const cardsHtml = metrics.map((m)=>{
    const s = alFullStats(m.values);
    return `<div class="corr-stat-card">
      <div class="corr-stat-card-title">${m.label}</div>
      <div class="corr-stat-card-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="corr-stat-cell"><span class="corr-stat-k">Count</span><span class="corr-stat-v">${m.values.length}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Mean</span><span class="corr-stat-v">${m.fmt(s.mean)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Std</span><span class="corr-stat-v">${m.fmt(s.std)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Median</span><span class="corr-stat-v">${m.fmt(s.median)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Q25–Q75</span><span class="corr-stat-v">${m.fmt(s.q1)}–${m.fmt(s.q3)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">IQR</span><span class="corr-stat-v">${m.fmt(s.iqr)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Skew</span><span class="corr-stat-v">${s.skew.toFixed(2)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Kurtosis</span><span class="corr-stat-v">${s.kurtosis.toFixed(2)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">CV</span><span class="corr-stat-v">${s.cvPct.toFixed(0)}%</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Min</span><span class="corr-stat-v">${m.fmt(s.min)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Max</span><span class="corr-stat-v">${m.fmt(s.max)}</span></div>
      </div>
    </div>`;
  }).join('');

  const userHtml = metrics.map((m)=>{
    const s = alFullStats(m.values);
    return `<div class="ap-user-rule" style="cursor:default">
      <div class="ap-user-sentence">
        <b>${m.label}</b> — типично около <b>${m.fmt(s.median)} ${m.unit}</b> (половина сабмитов держится в диапазоне <b>${m.fmt(s.q1)}–${m.fmt(s.q3)}</b>), но встречаются и выбросы: в среднем ${m.fmt(s.mean)}, ${skewNote(s.skew)}${Math.abs(s.skew)>=0.3?(s.skew>0?' — то есть изредка попадаются заметно большие значения, которые тянут среднее вверх':' — изредка попадаются заметно меньшие значения'):''}.
        Разброс (std) — ${m.fmt(s.std)}, ${kurtNote(s.kurtosis)}${s.kurtosis>0.3?' — выбросы случаются чаще, чем можно было бы ожидать':''}.
      </div>
    </div>`;
  }).join('');

  panel.innerHTML =
    secTitle('Статистика распределений') +
    `<div class="cs" style="padding:0 2px 10px">Полная описательная статистика по реальным сабмитам — mean/std/медиана/квартили/IQR/min/max, плюс skew (асимметрия) и kurtosis (эксцесс). Набор признаков соответствует тому, что считает реальный <code>statistics_pipeline.py</code> (включая unique_ext_count, new_ratio, hours_since_last).</div>
    <div class="ap-view-tabs" id="frStatViewTabs" style="padding:0;border-bottom:1px solid var(--border);margin-bottom:14px">
      <button class="ap-view-tab on" data-mode="functional" onclick="setFrStatViewMode('functional')">Функциональный</button>
      <button class="ap-view-tab" data-mode="user" onclick="setFrStatViewMode('user')">Для пользователя</button>
    </div>
    <div id="frStatFunctional" class="corr-stat-cards" style="grid-template-columns:repeat(2,1fr)">${cardsHtml}</div>
    <div id="frStatUser" style="display:none">${userHtml}</div>`;
}

function renderFrFiletypes(){
  const d = computeFactsData();
  const panel = document.getElementById('frpanel-filetypes');
  if(!d){ panel.innerHTML=secTitle('Типы файлов')+'<div class="fc-sub" style="padding:12px">Нет данных</div>'; return; }

  const byFreq=[...d.extArr].sort((a,b)=>b.count-a.count);
  const bySize=[...d.extArr].sort((a,b)=>b.sizeGB-a.sizeGB);
  const byAvg=[...d.extArr].sort((a,b)=>b.avgSizeMB-a.avgSizeMB);

  const topCards=[
    fc('','Самый частый тип', '.'+byFreq[0].ext, `${fmtNum(byFreq[0].count)} файлов · ${byFreq[0].pct.toFixed(1)}%`, 'sb','ft_top_freq'),
    fc('','Наибольший суммарный объём', '.'+bySize[0].ext, `${bySize[0].sizeGB.toFixed(2)} ГБ`, 'so','ft_top_size'),
    fc('','Самый тяжёлый в среднем', '.'+byAvg[0].ext, `${byAvg[0].avgSizeMB.toFixed(2)} МБ / файл`, 'sr','ft_top_avg'),
    fc('','Уникальных типов файлов', d.extArr.length, d.extArr.map(e=>'.'+e.ext).join(', '), 'sg','ft_unique_types'),
    fc('','Binary файлов', d.binaryCount, `${((d.binaryCount/d.totalExtEvents)*100).toFixed(1)}%`, 'sp','ft_binary'),
    fc('','Text файлов', d.textCount, `${((d.textCount/d.totalExtEvents)*100).toFixed(1)}%`, 'sm','ft_text'),
  ];

  const allCards = byFreq.map(e=>fc('','.'+e.ext, fmtNum(e.count)+' файлов', `${e.pct.toFixed(1)}% · ${e.sizeGB.toFixed(2)} ГБ · avg ${e.avgSizeMB.toFixed(1)} МБ`, BINARY_EXTS.has(e.ext)?'sp':'sm', `ft_detail_${e.ext}`));

  const diverseTop = d.diverseAuthor[0];
  const bigFile = d.biggestFiles[0], smallFile = d.smallestFiles[0];
  const oldestFile = d.oldestTouched[0], newestFile = d.newestTouched[0];
  const extLongestPause = d.extByMaxGap[0], extMostFreq = d.extByFreq[0];
  const coldestFile = d.hotspotArr[d.hotspotArr.length-1];

  const moreCards=[
    fc('','Самый большой файл', bigFile.path.split('/').pop(), `${(bigFile.sizeKB/1024).toFixed(1)} МБ · .${bigFile.ext}`, 'sr','ft_biggest_files'),
    fc('','Самый маленький файл', smallFile.path.split('/').pop(), `${smallFile.sizeKB.toFixed(0)} КБ · .${smallFile.ext}`, 'sm','ft_smallest_files'),
    fc('','Дольше всего не трогали', oldestFile.name, `последний раз ${fmtDateRu(oldestFile.date)} · .${oldestFile.ext}`, 'so','ft_oldest_files'),
    fc('','Тронут совсем недавно', newestFile.name, `${fmtDateRu(newestFile.date)} · .${newestFile.ext}`, 'sg','ft_newest_files'),
    fc('','Расширение с макс. паузами', extLongestPause?'.'+extLongestPause[0]:'—', extLongestPause?extLongestPause[1].toFixed(0)+' дн. макс. пауза между правками':'', 'sb','ft_max_pause_ext'),
    fc('','Чаще всего меняют', extMostFreq?'.'+extMostFreq.ext:'—', extMostFreq?fmtNum(extMostFreq.count)+' раз':'', 'sg','ft_top_freq'),
    fc('','Самый разнообразный автор', diverseTop?`<span style="color:${diverseTop.color}">${diverseTop.name}</span>`:'—', diverseTop?diverseTop.uniqueExt+' разных типов файлов':'', 'sp','ft_diverse_author'),
    fc('','Самый разнообразный день', d.diverseDay?fmtDateRu(new Date(d.diverseDay.key)):'—', d.diverseDay?`${d.diverseCount} типов сразу`:'', 'sb','mf_diverse_day'),
    fc('','Файл-хотспот', d.hotspotArr[0]?d.hotspotArr[0][0]:'—', d.hotspotArr[0]?`${d.hotspotArr[0][1]} упоминаний`:'', 'so','mf_hotspot'),
    fc('','Файл, который трогали реже всех', coldestFile?coldestFile[0]:'—', coldestFile?`встретился всего ${coldestFile[1]} раз`:'', 'sm','ft_coldest_file'),
  ];

  panel.innerHTML=
      secTitle('Рекорды по файлам') + fcGrid(topCards, 3) +
      secTitle('Все типы') + fcGrid(allCards) +
      secTitle('Ещё по файлам') + fcGrid(moreCards);
}

function rebuildAllFactsTabs() {
  const lpWrap = document.getElementById('lpWrap_facts');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('facts', 'rebuildAllFactsTabs');
  renderFrOverview();
  renderFrUsers();
  renderFrDepots();
  renderFrWorkspaces();
  renderFrTime();
  renderFrAnalytics();
  renderFrStatistics();
  renderFrFiletypes();
}

rebuildAllFactsTabs();
