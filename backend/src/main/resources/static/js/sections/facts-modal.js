

const STRIPE_COLORS={sg:'#3fb950',sb:'#58a6ff',so:'#f0883e',sp:'#bc8cff',sr:'#f85149',sy:'#d29922',sm:'#484f58'};

function openFdm(cfg){
  document.getElementById('fdmStripe').style.background=STRIPE_COLORS[cfg.stripe]||'#484f58';
  document.getElementById('fdmLabel').textContent=cfg.label||'';
  document.getElementById('fdmVal').innerHTML=cfg.val||'';
  document.getElementById('fdmSub').innerHTML=cfg.sub||'';
  document.getElementById('fdmBody').innerHTML=cfg.body||'';
  document.getElementById('fdmOverlay').classList.add('on');
  document.body.style.overflow='hidden';
}
function closeFdm(e){
  if(e&&e.target!==document.getElementById('fdmOverlay'))return;
  document.getElementById('fdmOverlay').classList.remove('on');
  document.body.style.overflow='';
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('fdmOverlay').classList.remove('on');document.body.style.overflow='';}});

function fdmStats(pairs){
  return `<div class="fdm-stat-row">${pairs.map(([v,l])=>`<div class="fdm-stat"><div class="fdm-stat-v">${v}</div><div class="fdm-stat-l">${l}</div></div>`).join('')}</div>`;
}
function fdmSec(title, html){
  return `<div class="fdm-sec"><div class="fdm-sec-title">${title}</div>${html}</div>`;
}
function fdmFileList(files){
  return `<div class="fdm-file-list-scroll">${files.map(f=>`<div class="fdm-file-row">
    <span class="fdm-file-act ${f.act||'edit'}">${f.act||'edit'}</span>
    <span class="fdm-file-path">${f.path}</span>
    <span class="fdm-file-ext">.${f.ext||'?'}</span>
    ${f.extra?`<span class="fdm-file-extra">${f.extra}</span>`:''}
  </div>`).join('')}</div>`;
}
function fdmTags(tags){
  const colors={uasset:'#bc8cff',umap:'#58a6ff',cpp:'#3fb950',h:'#3fb950',png:'#f0883e',fbx:'#d29922',wav:'#f85149',mat:themeColor('muted'),blueprint:'#bc8cff',uproject:'#58a6ff'};
  return `<div class="fdm-tag-row">${tags.map(t=>{const ext=t.replace('.','');const c=colors[ext]||themeColor('muted');return`<span style="display:inline-block;padding:3px 9px;border-radius:4px;font-size:11px;font-family:var(--mono);background:${c}22;border:1px solid ${c};color:${c}">${t}</span>`;}).join('')}</div>`;
}
function fdmHourChart(hours, color){
  const mx=Math.max(...hours,1);
  return `<div class="fdm-hour-bars">${hours.map((v,h)=>`<div class="fdm-hbar">
    <div class="fdm-hbar-b" style="height:${Math.max(2,Math.round(v/mx*52))}px;background:${v?color+'99':'var(--border2)'}"></div>
    <div class="fdm-hbar-l">${h%6===0?String(h).padStart(2,'0'):''}</div>
  </div>`).join('')}</div>`;
}
function fdmRankTable(rows){
  return `<div class="fdm-rank-table">${rows.map((r,i)=>`<div class="fdm-rank-row${r.highlight?' highlight':''}">
    <span class="fdm-rank-pos">${i+1}</span>
    <span class="fdm-rank-dot" style="background:${r.color||'var(--muted)'}"></span>
    <span class="fdm-rank-label">${r.label}</span>
    <span class="fdm-rank-value">${r.value}</span>
    ${r.sub?`<span class="fdm-rank-sub">${r.sub}</span>`:''}
  </div>`).join('')}</div>`;
}
function fdmFilesOf(d, ext){ return d.allFileEvents.filter(f=>f.ext===ext); }
function authorColorOf(name){ const u=USERS.find(x=>x.name===name); return u?u.color:'var(--muted)'; }

function buildFdmCfg(key){
  const d = computeFactsData();
  if(!d) return null;

  if (key.indexOf('mf_depot_spec_')===0){
    const author = key.slice('mf_depot_spec_'.length);
    const x = d.depotSpecialization.find(v=>v.author===author);
    if(!x) return null;
    return { label:'Депо-специализация — '+author, val:x.depot, sub:x.pct.toFixed(0)+'% сабмитов автора', stripe:'sb',
      body:`<div style="font-size:12px;color:var(--muted);line-height:1.6">${x.pct<40?'Распределение по депо у этого автора почти равномерное — выраженной специализации нет.':`Автор <strong style="color:${authorColorOf(author)}">${author}</strong> заметно чаще работает в депо <strong style="color:var(--text)">${x.depot}</strong>, чем в остальных.`}</div>` };
  }
  if (key.indexOf('author_hours_')===0){
    const author = key.slice('author_hours_'.length);
    const u = d.users.find(x=>x.name===author); if(!u) return null;
    return { label:'Часовая активность — '+author, val:String(u.favHour).padStart(2,'0')+':00', sub:u.hours[u.favHour]+' сабмитов в этот час', stripe:'sm',
      body:fdmSec('Сабмиты по часам суток',fdmHourChart(u.hours, u.color)) };
  }
  if (key.indexOf('author_exts_')===0){
    const author = key.slice('author_exts_'.length);
    const u = d.users.find(x=>x.name===author); if(!u) return null;
    const total = Object.values(u.extCounts).reduce((s,v)=>s+v,0)||1;
    const ranking = Object.entries(u.extCounts).sort((a,b)=>b[1]-a[1]);
    return { label:'Профиль расширений — '+author, val:'.'+ranking[0][0], sub:((ranking[0][1]/total)*100).toFixed(0)+'% файлов автора', stripe:'sm',
      body:fdmSec('Все типы файлов автора',fdmRankTable(ranking.map(([ext,cnt])=>({label:'.'+ext,value:fmtNum(cnt),sub:((cnt/total)*100).toFixed(0)+'%'})))) };
  }
  if (key.indexOf('anl_cluster_')===0){
    const idx = parseInt(key.slice('anl_cluster_'.length), 10);
    const sample = d.commits.length>400 ? d.commits.filter((_,i)=>i%Math.ceil(d.commits.length/400)===0) : d.commits;
    const points = sample.map(c=>[c.nFiles, c.sizeGB*1000]);
    const km = typeof alKMeans==='function' ? alKMeans(points) : null;
    if(!km || !km.centers[idx]) return null;
    const members = sample.filter((_,i)=>km.labels[i]===idx);
    const total = km.labels.filter(l=>l===idx).length;
    const byAuthor={}; members.forEach(c=>{byAuthor[c.author]=(byAuthor[c.author]||0)+1;});
    return { label:'Кластер '+(idx+1), val:total+' сабмитов', sub:((total/km.labels.length)*100).toFixed(0)+'% выборки', stripe:'sb',
      body:fdmStats([[km.centers[idx][0].toFixed(1),'Ср. файлов (центр)'],[(km.centers[idx][1]/1000).toFixed(2)+' ГБ','Ср. объём (центр)'],[km.k,'Всего кластеров'],[km.silhouette.toFixed(2),'Силуэт разделения']])+
           fdmSec('Кто чаще всего попадает в этот кластер',fdmRankTable(Object.entries(byAuthor).sort((a,b)=>b[1]-a[1]).map(([a,c])=>({label:a,value:c,color:authorColorOf(a)}))))+
           fdmSec('Примеры сабмитов из кластера (топ-15)',fdmRankTable(members.slice(0,15).map(c=>({label:c.cl,value:c.author,sub:c.totalSize,color:authorColorOf(c.author)})))) };
  }
  if (key==='busiest_dom'){
    const counts=Array(32).fill(0); d.commits.forEach(c=>counts[c.date.getDate()]++);
    const best = counts.indexOf(Math.max(...counts));
    return { label:'Самое активное число месяца', val:best+' число', sub:counts[best]+' сабмитов (сумма по всем месяцам)', stripe:'sg',
      body:fdmSec('Все числа месяца (1-31)',fdmRankTable(counts.map((c,day)=>({label:day,value:c,highlight:day===best})).filter(x=>x.label>0).sort((a,b)=>b.value-a.value).slice(0,15)))+
           `<div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6">В отличие от «Самого загруженного дня» (одна конкретная дата), здесь — какое число месяца в среднем самое активное независимо от месяца/года (например, может быть связано с дедлайнами конца месяца).</div>` };
  }
  if (key==='ft_unique_types'){
    return { label:'Уникальных типов файлов', val:d.extArr.length, sub:'', stripe:'sg',
      body:fdmSec('Все типы файлов проекта',fdmRankTable([...d.extArr].sort((a,b)=>b.count-a.count).map((e,i)=>({label:'.'+e.ext,value:fmtNum(e.count)+' файл.',sub:e.pct.toFixed(1)+'%',highlight:i===0})))) };
  }
  if (key==='ft_max_pause_ext'){
    if(!d.extByMaxGap.length) return null;
    const top = d.extByMaxGap[0];
    return { label:'Расширение с макс. паузами', val:'.'+top[0], sub:top[1].toFixed(0)+' дн.', stripe:'sb',
      body:fdmSec('Рейтинг по максимальной паузе между правками',fdmRankTable(d.extByMaxGap.map(([ext,days],i)=>({label:'.'+ext,value:days.toFixed(0)+' дн.',highlight:i===0}))))+
           `<div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6">Самый долгий разрыв между двумя последовательными правками файлов этого типа — признак редко трогаемой, но не забытой области кода/контента.</div>` };
  }
  if (key==='ft_coldest_file'){
    if(!d.hotspotArr.length) return null;
    const coldest = d.hotspotArr[d.hotspotArr.length-1];
    const coldFiles = d.hotspotArr.filter(([,c])=>c===coldest[1]).slice(0,15);
    return { label:'Файл, который трогали реже всех', val:coldest[0], sub:coldest[1]+' раз', stripe:'sm',
      body:fdmSec('Другие файлы с той же минимальной частотой (топ-15)',fdmRankTable(coldFiles.map(([name,c])=>({label:name,value:c+' раз'}))))+
           `<div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6">Это противоположность «файла-хотспота» — не про то, когда его последний раз трогали (см. «Дольше всего не трогали»), а про то, что его вообще трогали меньше всех.</div>` };
  }

  if (key.indexOf('ft_detail_')===0){
    const ext = key.slice('ft_detail_'.length);
    const e = d.extArr.find(x=>x.ext===ext); if(!e) return null;
    const files = fdmFilesOf(d, ext).sort((a,b)=>b.date-a.date).slice(0,30);
    const byAuthor={}; fdmFilesOf(d,ext).forEach(f=>{byAuthor[f.author]=(byAuthor[f.author]||0)+1;});
    return { label:'.'+ext, val:fmtNum(e.count)+' файлов', sub:e.pct.toFixed(1)+'% от всех файловых событий', stripe: BINARY_EXTS.has(ext)?'sp':'sm',
      body:fdmStats([[e.sizeGB.toFixed(2)+' ГБ','Суммарный объём'],[e.avgSizeMB.toFixed(1)+' МБ','Средний размер'],[BINARY_EXTS.has(ext)?'Binary':'Text','Категория']])+
           fdmSec('Кто чаще всего использует',fdmRankTable(Object.entries(byAuthor).sort((a,b)=>b[1]-a[1]).map(([a,c])=>({label:a,value:c,color:authorColorOf(a)}))))+
           fdmSec('Последние файлы (топ-30 по дате)',fdmFileList(files.map(f=>({act:f.action,path:f.path,ext:f.ext,extra:f.author+' · '+fmtDateRu(f.date)})))) };
  }

  const AUTHOR_METRIC_META = {
    commits: { label:'Сабмиты', fmt:(u)=>fmtNum(u.commits), sort:(a,b)=>b.commits-a.commits, sub:(u)=>u.pct.toFixed(0)+'%' },
    files: { label:'Файлы', fmt:(u)=>fmtNum(u.files), sort:(a,b)=>b.files-a.files, sub:(u)=>u.avgFiles.toFixed(1)+' в среднем' },
    vol: { label:'Объём', fmt:(u)=>u.vol.toFixed(2)+' ГБ', sort:(a,b)=>b.vol-a.vol },
    gbPerCommit: { label:'ГБ / сабмит', fmt:(u)=>u.gbPerCommit.toFixed(3), sort:(a,b)=>b.gbPerCommit-a.gbPerCommit },
    weekendPct: { label:'В выходные', fmt:(u)=>u.weekendPct.toFixed(0)+'%', sort:(a,b)=>b.weekendPct-a.weekendPct },
    avgGap: { label:'Ср. пауза', fmt:(u)=>u.avgGap.toFixed(1)+' ч', sort:(a,b)=>a.avgGap-b.avgGap },
    streak: { label:'Макс. стрик', fmt:(u)=>u.streak+' дн.', sort:(a,b)=>b.streak-a.streak },
    newRatioPct: { label:'Новых файлов', fmt:(u)=>u.newRatioPct.toFixed(0)+'%', sort:(a,b)=>b.newRatioPct-a.newRatioPct },
    maxPause: { label:'Макс. личная пауза', fmt:(u)=>u.maxPauseDays.toFixed(1)+' дн.', sort:(a,b)=>b.maxPauseDays-a.maxPauseDays },
  };
  if (key.indexOf('author_rank_')===0){
    const metric = key.slice('author_rank_'.length);
    const meta = AUTHOR_METRIC_META[metric]; if(!meta) return null;
    const rows = [...d.users].sort(meta.sort);
    return { label:meta.label+' — рейтинг авторов', val:meta.fmt(rows[0]), sub:rows[0].name, stripe:'sg',
      body:fdmSec('Все авторы',fdmRankTable(rows.map((u,i)=>({label:u.name,value:meta.fmt(u),sub:meta.sub?meta.sub(u):undefined,highlight:i===0,color:u.color})))) };
  }
  if (key.indexOf('ws_exts_')===0){
    const wsName = key.slice('ws_exts_'.length);
    const w = d.workspaces.find(x=>x.name===wsName); if(!w) return null;
    const commits = d.commits.filter(c=>c.workspace===wsName);
    const extCounts={}; commits.forEach(c=>c.files.forEach(f=>{extCounts[f.ext]=(extCounts[f.ext]||0)+1;}));
    const total = Object.values(extCounts).reduce((s,v)=>s+v,0)||1;
    const ranking = Object.entries(extCounts).sort((a,b)=>b[1]-a[1]);
    return { label:'Профиль расширений — '+wsName, val:'.'+ranking[0][0], sub:((ranking[0][1]/total)*100).toFixed(0)+'% файлов воркспейса', stripe:'sm',
      body:fdmSec('Все типы файлов воркспейса',fdmRankTable(ranking.map(([ext,cnt])=>({label:'.'+ext,value:fmtNum(cnt),sub:((cnt/total)*100).toFixed(0)+'%'})))) };
  }

  const WS_METRIC_META = {
    count: { label:'Сабмиты', fmt:(w)=>fmtNum(w.count), sort:(a,b)=>b.count-a.count, sub:(w)=>w.stats.share+'%' },
    vol: { label:'Объём', fmt:(w)=>w.stats.vol.toFixed(2)+' ГБ', sort:(a,b)=>b.stats.vol-a.stats.vol },
    avgFiles: { label:'Ср. файлов/сабмит', fmt:(w)=>w.stats.avgFiles.toFixed(1), sort:(a,b)=>b.stats.avgFiles-a.stats.avgFiles },
    gbPerCommit: { label:'ГБ / сабмит', fmt:(w)=>w.stats.gbPerCommit.toFixed(3), sort:(a,b)=>b.stats.gbPerCommit-a.stats.gbPerCommit },
    weekendPct: { label:'В выходные', fmt:(w)=>w.stats.weekendPct.toFixed(0)+'%', sort:(a,b)=>b.stats.weekendPct-a.stats.weekendPct },
    avgGap: { label:'Ср. пауза', fmt:(w)=>w.stats.avgGap+' ч', sort:(a,b)=>a.stats.avgGap-b.stats.avgGap },
    streak: { label:'Макс. стрик', fmt:(w)=>w.stats.streak+' дн.', sort:(a,b)=>b.stats.streak-a.stats.streak },
    newRatio: { label:'Новых файлов', fmt:(w)=>w.stats.newRatio+'%', sort:(a,b)=>b.stats.newRatio-a.stats.newRatio },
  };
  if (key.indexOf('ws_rank_')===0){
    const metric = key.slice('ws_rank_'.length);
    const meta = WS_METRIC_META[metric]; if(!meta) return null;
    const rows = [...d.workspaces].sort(meta.sort);
    return { label:meta.label+' — рейтинг воркспейсов', val:meta.fmt(rows[0]), sub:rows[0].name, stripe:'sb',
      body:fdmSec('Все воркспейсы',fdmRankTable(rows.map((w,i)=>({label:w.name,value:meta.fmt(w),sub:meta.sub?meta.sub(w):undefined,highlight:i===0,color:w.owner?authorColorOf(w.owner):undefined})))) };
  }

  const DEPOT_METRIC_META = {
    vol: { label:'Объём', fmt:(x)=>x.vol.toFixed(2)+' ГБ', sort:(a,b)=>b.vol-a.vol },
    submits: { label:'Сабмиты', fmt:(x)=>fmtNum(x.submits), sort:(a,b)=>b.submits-a.submits, sub:(x)=>x.pct.toFixed(0)+'%' },
    files: { label:'Файлы', fmt:(x)=>fmtNum(x.files), sort:(a,b)=>b.files-a.files },
    avgSizeMB: { label:'Ср. размер файла', fmt:(x)=>x.avgSizeMB.toFixed(1)+' МБ', sort:(a,b)=>b.avgSizeMB-a.avgSizeMB },
    newRatioPct: { label:'Новых файлов', fmt:(x)=>x.newRatioPct.toFixed(0)+'%', sort:(a,b)=>b.newRatioPct-a.newRatioPct },
    uniqueAuthors: { label:'Авторов', fmt:(x)=>x.uniqueAuthors, sort:(a,b)=>b.uniqueAuthors-a.uniqueAuthors },
  };
  if (key.indexOf('depot_rank_')===0){
    const metric = key.slice('depot_rank_'.length);
    const meta = DEPOT_METRIC_META[metric]; if(!meta) return null;
    const rows = [...d.depots].sort(meta.sort);
    return { label:meta.label+' — рейтинг депо', val:meta.fmt(rows[0]), sub:rows[0].name, stripe:'so',
      body:fdmSec('Все депо',fdmRankTable(rows.map((x,i)=>({label:x.name,value:meta.fmt(x),sub:meta.sub?meta.sub(x):undefined,highlight:i===0})))) };
  }
  if (key.indexOf('depot_top_author_')===0){
    const depotName = key.slice('depot_top_author_'.length);
    const commits = d.commits.filter(c=>c.depot.replace(/^\/\//,'').replace(/\/$/,'')===depotName);
    const byAuthor={}; commits.forEach(c=>{byAuthor[c.author]=(byAuthor[c.author]||0)+1;});
    const rows = Object.entries(byAuthor).sort((a,b)=>b[1]-a[1]);
    return { label:'Авторы в депо '+depotName, val:rows[0][0], sub:((rows[0][1]/commits.length)*100).toFixed(0)+'%', stripe:'so',
      body:fdmSec('Все авторы этого депо',fdmRankTable(rows.map(([a,c],i)=>({label:a,value:c+' сабм.',sub:((c/commits.length)*100).toFixed(0)+'%',highlight:i===0,color:authorColorOf(a)})))) };
  }
  if (key.indexOf('depot_trend_')===0){
    const depotName = key.slice('depot_trend_'.length);
    const dep = d.depots.find(x=>x.name===depotName); if(!dep) return null;
    return { label:'Динамика — '+depotName, val:dep.trend, sub:`${dep.firstHalfCount} → ${dep.secondHalfCount} сабм.`, stripe: dep.trend==='растёт'?'sg':dep.trend==='снижается'?'sr':'sm',
      body:`<div style="font-size:12px;color:var(--muted);line-height:1.6">Сравнение 1-й и 2-й половины периода по числу сабмитов в этом депо: <strong style="color:var(--text)">${dep.firstHalfCount}</strong> → <strong style="color:var(--text)">${dep.secondHalfCount}</strong>.</div>` };
  }

  const configs = {

    'leader_submits':(()=>{ const rows=[...d.leaderboard].sort((a,b)=>b.n-a.n); const top=rows[0];
      return { label:'Лидер по сабмитам',val:top.name,sub:top.n+' сабмитов · '+top.pct.toFixed(1)+'%',stripe:'sg',
        body:fdmSec('Рейтинг по числу сабмитов',fdmRankTable(rows.map((r,i)=>({label:r.name,value:r.n+' сабм.',sub:r.pct.toFixed(0)+'%',highlight:i===0,color:r.color})))) }; })(),
    'leader_weight':(()=>{ const rows=[...d.leaderboard].sort((a,b)=>b.vol-a.vol); const top=rows[0]; const total=rows.reduce((s,r)=>s+r.vol,0);
      return { label:'Лидер по весу (объёму)',val:top.name,sub:top.vol.toFixed(2)+' ГБ',stripe:'sb',
        body:fdmSec('Рейтинг по суммарному объёму',fdmRankTable(rows.map((r,i)=>({label:r.name,value:r.vol.toFixed(2)+' ГБ',sub:((r.vol/total)*100).toFixed(0)+'%',highlight:i===0,color:r.color})))) }; })(),
    'leader_files':(()=>{ const rows=[...d.leaderboard].sort((a,b)=>b.files-a.files); const top=rows[0]; const total=rows.reduce((s,r)=>s+r.files,0);
      return { label:'Лидер по числу файлов',val:top.name,sub:fmtNum(top.files)+' файлов',stripe:'so',
        body:fdmSec('Рейтинг по суммарному числу файлов',fdmRankTable(rows.map((r,i)=>({label:r.name,value:fmtNum(r.files)+' файл.',sub:((r.files/total)*100).toFixed(0)+'%',highlight:i===0,color:r.color})))) }; })(),

    'top_size':(()=>{ const c=[...d.commits].sort((a,b)=>b.sizeGB-a.sizeGB)[0];
      return { label:'Наиболее объёмный сабмит',val:c.totalSize,sub:c.cl+' · '+c.author+' · '+fmtDateTimeRu(c.date),stripe:'sr',
        body:fdmSec('Параметры сабмита',fdmStats([[c.totalSize,'Размер'],[fmtNum(c.nFiles)+' файл.','Файлов'],[new Set(c.files.map(f=>f.ext)).size+' типов','Уникальных типов'],[c.cl,'Номер'],[c.author,'Автор'],[fmtDateTimeRu(c.date),'Дата'],[c.workspace,'Воркспейс']]))+
             fdmSec('Файлы (первые 30 из '+c.nFiles+')',fdmFileList(c.files.slice(0,30).map(f=>({act:f.action,path:f.path,ext:f.ext,extra:f.rev+' · '+f.size}))))+
             fdmSec('Типы файлов в сабмите',fdmTags([...new Set(c.files.map(f=>'.'+f.ext))])) }; })(),
    'top_files':(()=>{ const c=[...d.commits].sort((a,b)=>b.nFiles-a.nFiles)[0];
      return { label:'Рекорд файлов за раз',val:fmtNum(c.nFiles)+' файлов',sub:c.cl+' · '+c.author,stripe:'so',
        body:fdmSec('Параметры сабмита',fdmStats([[fmtNum(c.nFiles),'Файлов'],[c.totalSize,'Объём'],[new Set(c.files.map(f=>f.ext)).size+' типов','Типов'],[c.cl,'Номер'],[c.author,'Автор'],[fmtDateTimeRu(c.date),'Дата'],[c.workspace,'Воркспейс']]))+
             fdmSec('Примеры файлов (первые 30)',fdmFileList(c.files.slice(0,30).map(f=>({act:f.action,path:f.path,ext:f.ext,extra:f.rev})))) }; })(),
    'top_diverse':(()=>{ const c=[...d.commits].sort((a,b)=>new Set(b.files.map(f=>f.ext)).size-new Set(a.files.map(f=>f.ext)).size)[0]; const exts=[...new Set(c.files.map(f=>f.ext))];
      return { label:'Самый разнообразный сабмит',val:exts.length+' типов файлов',sub:c.cl+' · '+c.author,stripe:'sb',
        body:fdmSec('Параметры сабмита',fdmStats([[exts.length,'Уник. типов'],[fmtNum(c.nFiles),'Файлов'],[c.totalSize,'Объём'],[c.cl,'Номер'],[c.author,'Автор'],[fmtDateTimeRu(c.date),'Дата']]))+
             fdmSec('Все типы в сабмите',fdmTags(exts.map(e=>'.'+e)))+
             fdmSec('Файлы',fdmFileList(c.files.slice(0,30).map(f=>({act:f.action,path:f.path,ext:f.ext})))) }; })(),
    'top_desc':(()=>{ const c=d.longestDesc;
      return { label:'Самое длинное описание',val:c.desc.length+' символов',sub:c.cl+' · '+c.author,stripe:'sm',
        body:fdmSec('Сабмит',fdmStats([[c.desc.length+' симв.','Длина описания'],[c.cl,'Номер'],[c.author,'Автор'],[fmtDateTimeRu(c.date),'Дата'],[fmtNum(c.nFiles),'Файлов'],[c.totalSize,'Объём']]))+
             fdmSec('Текст описания',`<div style="background:var(--bg);border:1px solid var(--border2);border-radius:4px;padding:12px 14px;font-size:12px;font-family:var(--mono);color:var(--text);line-height:1.6;">${c.desc}</div>`) }; })(),
    'min_desc':(()=>{ const c=d.shortestDesc;
      return { label:'Самое короткое описание',val:c.desc.length+' символов',sub:c.cl+' · '+c.author,stripe:'sm',
        body:fdmSec('Сабмит',fdmStats([[c.desc.length+' симв.','Длина описания'],[c.cl,'Номер'],[c.author,'Автор'],[fmtDateTimeRu(c.date),'Дата'],[fmtNum(c.nFiles),'Файлов'],[c.totalSize,'Объём']]))+
             fdmSec('Текст описания',`<div style="background:var(--bg);border:1px solid var(--border2);border-radius:4px;padding:12px 14px;font-size:12px;font-family:var(--mono);color:var(--red);">${c.desc}</div>`) }; })(),
    'top_rev':(()=>{ const revByFile={}; let best=null;
      d.allFileEvents.forEach(f=>{ const rev=parseRev(f.rev); const nm=f.path.split('/').pop();
        if(!revByFile[nm]||rev>revByFile[nm].rev) revByFile[nm]={rev,path:f.path,ext:f.ext,cl:f.cl,author:f.author,date:f.date};
        if(!best||rev>best.rev) best={rev,path:f.path,ext:f.ext,cl:f.cl,author:f.author,date:f.date}; });
      if(!best) return null;
      const ranking=Object.values(revByFile).sort((a,b)=>b.rev-a.rev).slice(0,10);
      return { label:'Максимальная ревизия файла',val:'rev '+best.rev,sub:best.path.split('/').pop()+' · '+best.author,stripe:'sp',
        body:fdmSec('Файл',fdmStats([['#'+best.rev,'Ревизия'],[best.cl,'CL последней правки'],[best.author,'Автор последней правки'],[fmtDateTimeRu(best.date),'Дата'],['.'+best.ext,'Тип']]))+
             fdmSec('Путь',`<div style="background:var(--bg);border:1px solid var(--border2);border-radius:4px;padding:10px 12px;font-size:11.5px;font-family:var(--mono);color:var(--text);word-break:break-all;">${best.path}</div>`)+
             fdmSec('Рейтинг файлов по ревизии (топ-10)',fdmRankTable(ranking.map((f,i)=>({label:f.path.split('/').pop(),value:'#'+f.rev,sub:f.author,highlight:i===0,color:authorColorOf(f.author)}))))+
             `<div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.6">Высокая ревизия означает файл правился много раз — показатель «горячего» файла.</div>` }; })(),
    'top_new_ratio':(()=>{ let best=null,bestR=-1;
      d.commits.forEach(c=>{ if(!c.files.length) return; const nf=c.files.filter(f=>parseRev(f.rev)===1); const r=nf.length/c.files.length; if(r>bestR){bestR=r;best={c,r,newFiles:nf};} });
      if(!best) return null; const c=best.c;
      return { label:'Наибольшая доля новых файлов',val:'new_ratio = '+best.r.toFixed(2),sub:c.cl+' · '+c.author+' · '+best.newFiles.length+' файлов',stripe:'sg',
        body:fdmSec('Сабмит',fdmStats([[best.r.toFixed(2),'new_ratio'],[best.newFiles.length+' из '+c.files.length,'Новых файлов'],[c.cl,'Номер'],[c.author,'Автор'],[fmtDateTimeRu(c.date),'Дата'],[c.totalSize,'Объём']]))+
             fdmSec('Новые файлы (rev=1)',fdmFileList(best.newFiles.map(f=>({act:f.action,path:f.path,ext:f.ext,extra:f.size})))) }; })(),
    'busiest_day':(()=>{ if(!d.bestDay && !d.dayEntries.length) return null;
      const entries=[...d.dayEntries].sort((a,b)=>b[1].length-a[1].length); const [dayKey,list]=entries[0];
      const byAuthorCount={}; list.forEach(c=>{byAuthorCount[c.author]=(byAuthorCount[c.author]||0)+1;});
      const breakdown=Object.entries(byAuthorCount).sort((a,b)=>b[1]-a[1]).map(([a,n])=>({author:a,n,color:authorColorOf(a)}));
      const vol=list.reduce((s,c)=>s+c.sizeGB,0), files=list.reduce((s,c)=>s+c.nFiles,0);
      return { label:'Самый загруженный день',val:fmtDateRu(new Date(dayKey)),sub:list.length+' сабмитов за день',stripe:'sy',
        body:fdmSec('Статистика дня',fdmStats([[list.length,'Сабмитов'],[fmtDateRu(new Date(dayKey)),'Дата'],[WEEKDAY_RU[new Date(dayKey).getDay()],'День недели'],[(list.length/d.commits.length*100).toFixed(1)+'%','От всех сабмитов'],[vol.toFixed(2)+' ГБ','Объём'],[files+' шт.','Файлов']]))+
             fdmSec('Точный разбор по авторам',fdmRankTable(breakdown.map((b,i)=>({label:b.author,value:b.n+' сабм.',sub:((b.n/list.length)*100).toFixed(0)+'%',highlight:i===0,color:b.color}))))+
             fdmSec('Все сабмиты этого дня',fdmRankTable(list.map(c=>({label:c.cl,value:c.author,sub:c.totalSize,color:authorColorOf(c.author)})))) }; })(),
    'busiest_month':(()=>{ if(!d.busiestMonth) return null; const [mk,list]=d.busiestMonth;
      const byAuthorCount={}; list.forEach(c=>{byAuthorCount[c.author]=(byAuthorCount[c.author]||0)+1;});
      return { label:'Самый активный месяц',val:MONTH_RU[+mk.split('-')[1]]+' '+mk.split('-')[0],sub:list.length+' сабмитов',stripe:'sg',
        body:fdmSec('Разбор по авторам',fdmRankTable(Object.entries(byAuthorCount).sort((a,b)=>b[1]-a[1]).map(([a,n])=>({label:a,value:n+' сабм.',color:authorColorOf(a)})))) }; })(),

    'time_peak_hour':(()=>{ const byAuthorAtHour={}; d.commits.filter(c=>c.date.getHours()===d.peakHour).forEach(c=>{byAuthorAtHour[c.author]=(byAuthorAtHour[c.author]||0)+1;});
      return { label:'Пиковый час',val:String(d.peakHour).padStart(2,'0')+':00',sub:d.hourCounts[d.peakHour]+' сабмитов',stripe:'sg',
        body:fdmSec('Все сабмиты по часам',fdmHourChart(d.hourCounts,'#58a6ff'))+
             fdmSec('Кто чаще всего работает в этот час',fdmRankTable(Object.entries(byAuthorAtHour).sort((a,b)=>b[1]-a[1]).map(([a,n])=>({label:a,value:n,color:authorColorOf(a)})))) }; })(),
    'time_peak_weekday':(()=>{ const idx=d.weekdayCounts.indexOf(Math.max(...d.weekdayCounts));
      return { label:'Пиковый день недели',val:WEEKDAY_RU[idx],sub:d.weekdayCounts[idx]+' сабмитов',stripe:'so',
        body:fdmSec('Распределение по дням недели',fdmRankTable(WEEKDAY_RU.map((w,i)=>({label:w,value:d.weekdayCounts[i]+' сабм.',highlight:i===idx})).sort((a,b)=>parseInt(b.value)-parseInt(a.value)))) }; })(),

    'ft_top_freq':(()=>{ const e=[...d.extArr].sort((a,b)=>b.count-a.count)[0];
      return { label:'Самый частый тип',val:'.'+e.ext,sub:fmtNum(e.count)+' файлов',stripe:'sb',
        body:fdmSec('Топ-10 по частоте',fdmRankTable([...d.extArr].sort((a,b)=>b.count-a.count).slice(0,10).map((x,i)=>({label:'.'+x.ext,value:fmtNum(x.count),sub:x.pct.toFixed(1)+'%',highlight:i===0})))) }; })(),
    'ft_top_size':(()=>{ const e=[...d.extArr].sort((a,b)=>b.sizeGB-a.sizeGB)[0];
      return { label:'Наибольший суммарный объём',val:'.'+e.ext,sub:e.sizeGB.toFixed(2)+' ГБ',stripe:'so',
        body:fdmSec('Топ-10 по объёму',fdmRankTable([...d.extArr].sort((a,b)=>b.sizeGB-a.sizeGB).slice(0,10).map((x,i)=>({label:'.'+x.ext,value:x.sizeGB.toFixed(2)+' ГБ',highlight:i===0})))) }; })(),
    'ft_top_avg':(()=>{ const e=[...d.extArr].sort((a,b)=>b.avgSizeMB-a.avgSizeMB)[0];
      return { label:'Самый тяжёлый в среднем',val:'.'+e.ext,sub:e.avgSizeMB.toFixed(2)+' МБ/файл',stripe:'sr',
        body:fdmSec('Топ-10 по среднему размеру',fdmRankTable([...d.extArr].sort((a,b)=>b.avgSizeMB-a.avgSizeMB).slice(0,10).map((x,i)=>({label:'.'+x.ext,value:x.avgSizeMB.toFixed(2)+' МБ',highlight:i===0})))) }; })(),
    'ft_binary':(()=>{ const rows=d.extArr.filter(e=>BINARY_EXTS.has(e.ext)).sort((a,b)=>b.count-a.count);
      return { label:'Binary файлов',val:d.binaryCount,sub:((d.binaryCount/d.totalExtEvents)*100).toFixed(1)+'%',stripe:'sp',
        body:fdmSec('Какие типы попали в Binary',fdmRankTable(rows.map(e=>({label:'.'+e.ext,value:fmtNum(e.count),sub:e.pct.toFixed(1)+'%'}))))+
             `<div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6">Binary — не подлежат построчному diff (ассеты, модели, звук, изображения).</div>` }; })(),
    'ft_text':(()=>{ const rows=d.extArr.filter(e=>!BINARY_EXTS.has(e.ext)).sort((a,b)=>b.count-a.count);
      return { label:'Text файлов',val:d.textCount,sub:((d.textCount/d.totalExtEvents)*100).toFixed(1)+'%',stripe:'sm',
        body:fdmSec('Какие типы попали в Text',fdmRankTable(rows.map(e=>({label:'.'+e.ext,value:fmtNum(e.count),sub:e.pct.toFixed(1)+'%'}))))+
             `<div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6">Text — код и конфиги, поддерживают построчный diff и merge.</div>` }; })(),
    'ft_biggest_files':(()=>({ label:'Самый большой файл',val:d.biggestFiles[0].path.split('/').pop(),sub:(d.biggestFiles[0].sizeKB/1024).toFixed(1)+' МБ',stripe:'sr',
        body:fdmSec('Топ-10 самых больших файлов',fdmRankTable(d.biggestFiles.map((f,i)=>({label:f.path.split('/').pop(),value:(f.sizeKB/1024).toFixed(1)+' МБ',sub:f.author,highlight:i===0,color:authorColorOf(f.author)})))) }))(),
    'ft_smallest_files':(()=>({ label:'Самый маленький файл',val:d.smallestFiles[0].path.split('/').pop(),sub:d.smallestFiles[0].sizeKB.toFixed(0)+' КБ',stripe:'sm',
        body:fdmSec('Топ-10 самых маленьких файлов',fdmRankTable(d.smallestFiles.map((f,i)=>({label:f.path.split('/').pop(),value:f.sizeKB.toFixed(0)+' КБ',sub:f.author,highlight:i===0,color:authorColorOf(f.author)})))) }))(),
    'ft_oldest_files':(()=>({ label:'Дольше всего не трогали',val:d.oldestTouched[0].name,sub:'с '+fmtDateRu(d.oldestTouched[0].date),stripe:'so',
        body:fdmSec('Топ-10 давно не тронутых (по последней правке)',fdmRankTable(d.oldestTouched.map((f,i)=>({label:f.name,value:fmtDateRu(f.date),sub:f.author,highlight:i===0,color:authorColorOf(f.author)})))) }))(),
    'ft_newest_files':(()=>({ label:'Тронут совсем недавно',val:d.newestTouched[0].name,sub:fmtDateRu(d.newestTouched[0].date),stripe:'sg',
        body:fdmSec('Топ-10 самых недавних правок',fdmRankTable(d.newestTouched.map((f,i)=>({label:f.name,value:fmtDateRu(f.date),sub:f.author,highlight:i===0,color:authorColorOf(f.author)})))) }))(),
    'ft_diverse_author':(()=>{ const top=d.diverseAuthor[0];
      return { label:'Самый разнообразный автор',val:top.name,sub:top.uniqueExt+' разных типов',stripe:'sp',
        body:fdmSec('Рейтинг по разнообразию типов файлов',fdmRankTable(d.diverseAuthor.map((a,i)=>({label:a.name,value:a.uniqueExt+' типов',highlight:i===0,color:a.color})))) }; })(),

    'mf_first_submit':(()=>({ label:'Первый сабмит за весь период',val:fmtDateTimeRu(d.first.date),sub:d.first.author+' · '+d.first.cl,stripe:'sg',
        body:fdmSec('Сабмит',fdmStats([[d.first.cl,'CL'],[d.first.author,'Автор'],[fmtDateTimeRu(d.first.date),'Дата'],[fmtNum(d.first.nFiles),'Файлов'],[d.first.totalSize,'Объём'],[d.first.workspace,'Воркспейс']]))+
             fdmSec('Файлы',fdmFileList(d.first.files.map(f=>({act:f.action,path:f.path,ext:f.ext,extra:f.rev+' · '+f.size})))) }))(),
    'mf_last_submit':(()=>({ label:'Последний сабмит за весь период',val:fmtDateTimeRu(d.last.date),sub:d.last.author+' · '+d.last.cl,stripe:'sb',
        body:fdmSec('Сабмит',fdmStats([[d.last.cl,'CL'],[d.last.author,'Автор'],[fmtDateTimeRu(d.last.date),'Дата'],[fmtNum(d.last.nFiles),'Файлов'],[d.last.totalSize,'Объём'],[d.last.workspace,'Воркспейс']]))+
             fdmSec('Файлы',fdmFileList(d.last.files.map(f=>({act:f.action,path:f.path,ext:f.ext,extra:f.rev+' · '+f.size})))) }))(),
    'mf_silence':(()=>{ if(!d.maxGapStart) return null;
      return { label:'Самая долгая тишина',val:d.maxGapDays.toFixed(1)+' дн.',sub:fmtDateRu(d.maxGapStart.date)+' → '+fmtDateRu(d.maxGapEnd.date),stripe:'so',
        body:fdmSec('Границы паузы',fdmStats([[d.maxGapStart.cl,'Последний CL до тишины'],[d.maxGapStart.author,'Автор'],[fmtDateTimeRu(d.maxGapStart.date),'Дата'],[d.maxGapEnd.cl,'Первый CL после'],[d.maxGapEnd.author,'Автор'],[fmtDateTimeRu(d.maxGapEnd.date),'Дата']])) }; })(),
    'mf_streak':(()=>({ label:'Командный стрик',val:d.teamStreak+' дн. подряд',sub:d.teamStreakEnd?('закончился '+fmtDateRu(d.teamStreakEnd)):'',stripe:'sg',
        body:`<div style="font-size:12px;color:var(--muted);line-height:1.6">Самая длинная последовательность календарных дней подряд, где хотя бы один автор совершил хотя бы один сабмит — ${d.teamStreak} дней.</div>` }))(),
    'mf_round_cl':(()=>{ if(!d.roundCls.length) return null;
      return { label:'Круглые номера CL',val:d.roundCls.length+' шт.',sub:'кратно 1000',stripe:'sb',
        body:fdmSec('Все найденные',fdmRankTable(d.roundCls.map(c=>({label:c.cl,value:c.author,sub:fmtDateRu(c.date)})))) }; })(),
    'mf_freq_desc':(()=>{ const matching=d.commits.filter(c=>c.desc===d.topDesc[0]);
      return { label:'Самое частое описание',val:'«'+d.topDesc[0]+'»',sub:d.topDesc[1]+' раз',stripe:'sr',
        body:fdmSec('Где встречается ('+matching.length+' сабмитов)',fdmRankTable(matching.slice(0,20).map(c=>({label:c.cl,value:c.author,sub:fmtDateRu(c.date),color:authorColorOf(c.author)})))) }; })(),
    'mf_best_day':(()=>{ if(!d.bestDay) return null; const bd=d.bestDay;
      return { label:'Самый продуктивный день команды',val:fmtDateRu(new Date(bd.key)),sub:bd.vol.toFixed(2)+' ГБ',stripe:'sg',
        body:fdmSec('Статистика дня',fdmStats([[bd.list.length,'Сабмитов'],[bd.vol.toFixed(2)+' ГБ','Объём'],[bd.files,'Файлов']]))+
             fdmSec('Все сабмиты этого дня',fdmRankTable(bd.list.map(c=>({label:c.cl,value:c.author,sub:c.totalSize,color:authorColorOf(c.author)})))) }; })(),
    'mf_dense_day':(()=>{ if(!d.densestDay) return null;
      const dayCommits=d.commits.filter(c=>c.date.toISOString().slice(0,10)===d.densestDay.key).sort((a,b)=>a.date-b.date);
      return { label:'День максимальной плотности',val:fmtDateRu(new Date(d.densestDay.key)),sub:d.densestGapH.toFixed(1)+' ч между авторами',stripe:'sb',
        body:fdmSec('Хронология дня',fdmRankTable(dayCommits.map(c=>({label:c.date.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})+' · '+c.cl,value:c.author,color:authorColorOf(c.author)})))) }; })(),
    'mf_diverse_day':(()=>{ if(!d.diverseDay) return null;
      return { label:'Самый разнообразный день',val:d.diverseCount+' типов файлов',sub:fmtDateRu(new Date(d.diverseDay.key)),stripe:'sb',
        body:fdmSec('Все типы за этот день',fdmTags(d.diverseDay.exts.map(e=>'.'+e)))+
             fdmSec('Сабмиты этого дня',fdmRankTable(d.diverseDay.list.map(c=>({label:c.cl,value:c.author,sub:new Set(c.files.map(f=>f.ext)).size+' типов',color:authorColorOf(c.author)})))) }; })(),
    'mf_hotspot':(()=>{ const top=d.hotspotArr[0]; if(!top) return null;
      const occurrences=[]; d.commits.forEach(c=>c.files.forEach(f=>{ if(f.path.split('/').pop()===top[0]) occurrences.push({cl:c.cl,author:c.author,date:c.date,action:f.action,rev:f.rev}); }));
      return { label:'Файл-хотспот',val:top[0],sub:top[1]+' упоминаний',stripe:'so',
        body:fdmSec('Где встречается ('+occurrences.length+' раз)',fdmRankTable(occurrences.slice(0,20).map(o=>({label:o.cl,value:o.action+' · '+o.rev,sub:fmtDateRu(o.date),color:authorColorOf(o.author)})))) }; })(),

    'anl_anomalies_list':(()=>{ const all=typeof computeAnomalies==='function'?computeAnomalies():[];
      if(!all.length) return null;
      return { label:'Все аномалии',val:all.length,sub:((all.length/d.commits.length)*100).toFixed(1)+'% от сабмитов',stripe:'sr',
        body:fdmSec('Список (топ-20 по числу сработавших методов)',fdmRankTable(all.slice(0,20).map(r=>({label:r.commit.cl,value:r.commit.author,sub:r.votes+'/4 методов',color:authorColorOf(r.commit.author)})))) }; })(),
  };

  return configs[key]||null;
}
