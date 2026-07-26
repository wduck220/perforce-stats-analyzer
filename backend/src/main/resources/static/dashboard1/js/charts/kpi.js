

(function buildKpiAndRecords(){
  const days=DAY_DATA;
  if (!days.length) {

    ['kv1','kv2','kv3','kv4'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
    ['ks1','ks2','ks3','ks4'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'нет данных'; });
    const footer = document.getElementById('footerInfo');
    if (footer) footer.textContent = 'Нет данных для отображения';
    return;
  }
  let totalSubmits=0,totalFiles=0,totalVolumeGB=0;
  const userCommits={},userFiles={},userVol={},userAnomCount={};
  USERS.forEach(u=>{userCommits[u.name]=0;userFiles[u.name]=0;userVol[u.name]=0;userAnomCount[u.name]=0;});

  const wsCommits={}, wsFiles={}, wsVol={}, wsWeekend={}, wsTotal={};

  window.WORKSPACE_LIST = [...new Set(
    days.flatMap(d => USERS.flatMap(u => (d.perUser[u.name]?.commits || []).map(c => c.workspace)))
  )].filter(Boolean).sort();
  const wsColors = {};
  WORKSPACE_LIST.forEach((ws, i) => { wsColors[ws] = (typeof colorForAuthorIndex === 'function' ? colorForAuthorIndex(i).color : '#7d8590'); });

  let busiestCount=0,busiestDate='';
  const weekdayCount=Array(7).fill(0),weekdayDays=Array(7).fill(0);
  const monthlyCount={};

  days.forEach(d=>{
    const dow=(d.date.getDay()+6)%7;
    weekdayDays[dow]++;
    USERS.forEach(u=>{
      const pu=d.perUser[u.name];
      totalSubmits+=pu.count;
      userCommits[u.name]+=pu.count;
      weekdayCount[dow]+=pu.count;
      pu.commits.forEach(c=>{
        totalFiles+=c.nFiles;
        userFiles[u.name]+=c.nFiles;
        userVol[u.name]+=c.sizeGB;
        totalVolumeGB+=c.sizeGB;

        const ws = c.workspace || 'unknown';
        wsCommits[ws] = (wsCommits[ws] || 0) + 1;
        wsFiles[ws] = (wsFiles[ws] || 0) + (c.nFiles || 0);
        wsVol[ws] = (wsVol[ws] || 0) + (c.sizeGB || 0);
        wsTotal[ws] = (wsTotal[ws] || 0) + 1;
        if (d.date.getDay() === 0 || d.date.getDay() === 6) {
          wsWeekend[ws] = (wsWeekend[ws] || 0) + 1;
        }
      });
    });
    const dayTotal=USERS.reduce((s,u)=>s+d.perUser[u.name].count,0);
    if(dayTotal>busiestCount){busiestCount=dayTotal;busiestDate=d.date.toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'});}
    const mk=d.date.getFullYear()+'-'+(d.date.getMonth()+1);
    monthlyCount[mk]=(monthlyCount[mk]||0)+USERS.reduce((s,u)=>s+d.perUser[u.name].count,0);
  });

  const wsCommitsEntries = Object.entries(wsCommits).sort((a,b)=>b[1]-a[1]);
  const wsVolEntries = Object.entries(wsVol).sort((a,b)=>b[1]-a[1]);

  let wsMaxCLfiles = 0, wsMaxCLname = '', wsMaxCLws = '';
  days.forEach(d=>USERS.forEach(u=>d.perUser[u.name].commits.forEach(c=>{
    const ws = c.workspace || 'unknown';
    if (c.nFiles > wsMaxCLfiles) {
      wsMaxCLfiles = c.nFiles;
      wsMaxCLname = c.cl;
      wsMaxCLws = ws;
    }
  })));

  const wsWeekendPct = {};
  Object.keys(wsCommits).forEach(ws => {
    wsWeekendPct[ws] = wsTotal[ws] ? ((wsWeekend[ws] || 0) / wsTotal[ws] * 100) : 0;
  });
  const wsTopWeekend = Object.entries(wsWeekendPct).sort((a,b)=>b[1]-a[1])[0];

  document.getElementById('kv1').textContent=totalSubmits.toLocaleString('ru');
  document.getElementById('ks1').textContent=`за ${days.length} дней · ср. ${(totalSubmits/days.length).toFixed(1)}/день`;
  document.getElementById('kv2').textContent=USERS.length;
  document.getElementById('ks2').textContent=USERS.map(u=>u.name).join(' · ');
  document.getElementById('kv3').textContent=totalFiles.toLocaleString('ru');
  document.getElementById('ks3').textContent=`${totalFiles.toLocaleString('ru')} событий · медиана 4 / сабмит`;

  const kv4El = document.getElementById('kv4'), ks4El = document.getElementById('ks4');
  if (kv4El) {
    const pyAnomLevel = window.PYTHON_REPORT?.anomalies?.submits;
    if (pyAnomLevel) {
      kv4El.textContent = pyAnomLevel.anomaly_count;
      ks4El.textContent = `${pyAnomLevel.anomaly_pct}% от сабмитов (Python ML)`;
    } else if (typeof computeAnomalies === 'function') {
      const anoms = computeAnomalies();
      kv4El.textContent = anoms.length;
      ks4El.textContent = `${(anoms.length / totalSubmits * 100).toFixed(1)}% от сабмитов (упрощённый JS-расчёт)`;
    } else {
      kv4El.textContent = '—';
      ks4El.textContent = 'нет данных';
    }
  }

  const dFrom=days[0].date, dTo=days[days.length-1].date;
  document.getElementById('footerInfo').textContent=`Сгенерирован ${new Date().toLocaleDateString('ru')} · ${totalSubmits.toLocaleString('ru')} сабмитов`;

  if (typeof renderSparklineSVG === 'function') {
    const weekOf = (d) => { const t = new Date(d); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
    const submitsByWeek = {}, filesByWeek = {};
    days.forEach(d => {
      const wk = weekOf(d.date);
      const daySubmits = USERS.reduce((s, u) => s + d.perUser[u.name].count, 0);
      const dayFiles = USERS.reduce((s, u) => s + d.perUser[u.name].commits.reduce((s2, c) => s2 + c.nFiles, 0), 0);
      submitsByWeek[wk] = (submitsByWeek[wk] || 0) + daySubmits;
      filesByWeek[wk] = (filesByWeek[wk] || 0) + dayFiles;
    });
    const weekKeys = Object.keys(submitsByWeek).sort();
    const submitsSeries = weekKeys.map(k => submitsByWeek[k]);
    const filesSeries = weekKeys.map(k => filesByWeek[k]);

    const spark1 = document.getElementById('kv1spark');
    if (spark1) spark1.innerHTML = renderSparklineSVG(submitsSeries, '#3fb950');
    const spark3 = document.getElementById('kv3spark');
    if (spark3) spark3.innerHTML = renderSparklineSVG(filesSeries, '#f0883e');

    if (typeof renderPeriodDelta === 'function') {
      const mid = Math.floor(weekKeys.length / 2);
      const sum = (arr) => arr.reduce((s, v) => s + v, 0);
      const submitsFirstHalf = sum(submitsSeries.slice(0, mid));
      const submitsSecondHalf = sum(submitsSeries.slice(mid));
      const filesFirstHalf = sum(filesSeries.slice(0, mid));
      const filesSecondHalf = sum(filesSeries.slice(mid));
      if (mid > 0) {
        document.getElementById('ks1').innerHTML += ` · 2-я половина периода к 1-й: ${renderPeriodDelta(submitsSecondHalf, submitsFirstHalf)}`;
        document.getElementById('ks3').innerHTML += ` · 2-я половина периода к 1-й: ${renderPeriodDelta(filesSecondHalf, filesFirstHalf)}`;
      }
    }
  }

  const avgByDow=weekdayCount.map((c,i)=>weekdayDays[i]?c/weekdayDays[i]:0);
  const busiestDow=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][avgByDow.indexOf(Math.max(...avgByDow))];

  const topMonth=Object.entries(monthlyCount).sort((a,b)=>b[1]-a[1])[0];
  const [ty,tm]=topMonth[0].split('-');
  const topMonthName=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][+tm-1]+' '+ty;

  const topVolUser=Object.entries(userVol).sort((a,b)=>b[1]-a[1])[0];
  const topVolColor=USERS.find(u=>u.name===topVolUser[0]).color;

  const topCommitUser=Object.entries(userCommits).sort((a,b)=>b[1]-a[1])[0];
  const topCommitColor=USERS.find(u=>u.name===topCommitUser[0]).color;

  const avgFilesPerUser=Object.entries(userFiles).map(([n,f])=>({n,avg:userCommits[n]?f/userCommits[n]:0}));
  const minAvgFiles=avgFilesPerUser.sort((a,b)=>a.avg-b.avg)[0];

  const weU={};USERS.forEach(u=>{weU[u.name]={we:0,tot:0};});
  days.forEach(d=>{
    const isWE=d.date.getDay()===0||d.date.getDay()===6;
    USERS.forEach(u=>{weU[u.name].tot+=d.perUser[u.name].count;if(isWE)weU[u.name].we+=d.perUser[u.name].count;});
  });
  const topWeUser=Object.entries(weU).sort((a,b)=>(b[1].we/b[1].tot)-(a[1].we/a[1].tot))[0];
  const topWeColor=USERS.find(u=>u.name===topWeUser[0]).color;
  const topWePct=topWeUser[1].tot?((topWeUser[1].we/topWeUser[1].tot)*100).toFixed(0):0;

  let maxCLfiles=0,maxCLname='',maxCLauthor='';
  days.forEach(d=>USERS.forEach(u=>d.perUser[u.name].commits.forEach(c=>{
    if(c.nFiles>maxCLfiles){maxCLfiles=c.nFiles;maxCLname=c.cl;maxCLauthor=u.name;}
  })));
  const maxCLcolor=USERS.find(u=>u.name===maxCLauthor).color;

  let maxCLvol=0,maxCLvolName='',maxCLvolAuthor='';
  days.forEach(d=>USERS.forEach(u=>d.perUser[u.name].commits.forEach(c=>{
    if(c.sizeGB>maxCLvol){maxCLvol=c.sizeGB;maxCLvolName=c.cl;maxCLvolAuthor=u.name;}
  })));
  const maxCLvolColor=USERS.find(u=>u.name===maxCLvolAuthor).color;

  const records=[

    {cls:'green', lbl:'Самый активный автор',   val:`<span style="color:${topCommitColor}">${topCommitUser[0]}</span>`, sub:`${topCommitUser[1].toLocaleString('ru')} сабмитов`},
    {cls:'orange',lbl:'Самый большой объём',    val:`<span style="color:${topVolColor}">${topVolUser[0]}</span>`,    sub:`${topVolUser[1].toFixed(1)} ГБ суммарно`},
    {cls:'blue',  lbl:'Больше всех файлов за раз',val:`<span style="color:${maxCLcolor}">${maxCLname}</span>`,     sub:`${maxCLfiles.toLocaleString('ru')} файлов · ${maxCLauthor}`},
    {cls:'purple',lbl:'Наиболее объёмный сабмит (топ-1)',    val:`<span style="color:${maxCLvolColor}">${maxCLvolName}</span>`, sub:`${maxCLvol.toFixed(2)} ГБ · ${maxCLvolAuthor}`},
    {cls:'yellow',lbl:'Самый загруженный день',  val:busiestDate,                                                   sub:`${busiestCount} сабмитов за день`},
    {cls:'green', lbl:'Наиболее активный день недели',       val:busiestDow,                                                    sub:`самый продуктивный в среднем`},
    {cls:'blue',  lbl:'Наиболее активный месяц',             val:topMonthName,                                                  sub:`${topMonth[1]} сабмитов`},
    {cls:'orange',lbl:'Суммарный объём данных',       val:`${totalVolumeGB.toFixed(1)} ГБ`,                              sub:`${(totalVolumeGB/totalSubmits).toFixed(2)} ГБ / сабмит`},
    {cls:'purple',lbl:'Активность в выходные дни',        val:`<span style="color:${topWeColor}">${topWeUser[0]}</span>`,    sub:`${topWePct}% сабмитов в выходные`},

    {cls:'green', lbl:'Самый активный воркспейс', val:`<span style="color:${wsColors[wsCommitsEntries[0]?.[0]] || themeColor('muted')}">${wsCommitsEntries[0]?.[0] || '—'}</span>`, sub: wsCommitsEntries[0] ? `${wsCommitsEntries[0][1]} сабмитов` : '—'},
    {cls:'orange',lbl:'Воркспейс с самым большим объёмом', val:`<span style="color:${wsColors[wsVolEntries[0]?.[0]] || themeColor('muted')}">${wsVolEntries[0]?.[0] || '—'}</span>`, sub: wsVolEntries[0] ? `${wsVolEntries[0][1].toFixed(1)} ГБ` : '—'},
    {cls:'blue',  lbl:'Самый большой сабмит по файлам в воркспейсе', val:`<span style="color:${wsColors[wsMaxCLws] || themeColor('muted')}">${wsMaxCLws || '—'}</span>`, sub: wsMaxCLname ? `${wsMaxCLfiles.toLocaleString('ru')} файлов · ${wsMaxCLname}` : '—'},
    {cls:'purple',lbl:'Воркспейс с самой высокой долей выходных', val:`<span style="color:${wsColors[wsTopWeekend?.[0]] || themeColor('muted')}">${wsTopWeekend?.[0] || '—'}</span>`, sub: wsTopWeekend ? `${wsTopWeekend[1].toFixed(0)}% сабмитов в выходные` : '—'},
  ];

})();