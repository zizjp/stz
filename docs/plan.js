// ======== スライド監視・カウンタ・進捗 ========
const deck = document.getElementById('deck');
const slides = Array.from(document.querySelectorAll('.slide'));
const counter = document.getElementById('counter');
const progress = document.getElementById('progress');
const navUp = document.getElementById('navUp');
const navDown = document.getElementById('navDown');

function toIdx(i){
  const clamped = Math.max(0, Math.min(i, slides.length-1));
  slides[clamped].scrollIntoView({behavior:'smooth', block:'start'});
}
if (navUp) navUp.addEventListener('click', ()=> toIdx(currentIndex()-1));
if (navDown) navDown.addEventListener('click', ()=> toIdx(currentIndex()+1));

function currentIndex(){
  let y = deck.scrollTop;
  let h = deck.clientHeight;
  let i = Math.round(y / h);
  return Math.max(0, Math.min(i, slides.length-1));
}

// IntersectionObserverで現在スライドを検出
const obs = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      const i = slides.indexOf(e.target);
      counter.textContent = (i+1) + ' / ' + slides.length;
      const pct = Math.round(((i) / (slides.length-1)) * 100);
      progress.style.setProperty('--pct', pct + '%');
      // チャート遅延初期化
      initChartsFor(e.target.id);
    }
  });
}, { root: deck, threshold: 0.6 });

slides.forEach(s => obs.observe(s));

// ======== 目次（TOC） ========
const toc = document.getElementById('toc');
const tocItems = document.getElementById('tocItems');
const openToc = document.getElementById('openToc');
const closeToc = document.getElementById('closeToc');

function buildToc(){
  tocItems.innerHTML = '';
  slides.forEach((s, i)=>{
    const btn = document.createElement('button');
    btn.className = 'sec';
    btn.innerHTML = `<span class="idx">${String(i+1).padStart(2,'0')}</span><span class="ttl">${s.dataset.title || ''}</span>`;
    btn.addEventListener('click', ()=>{
      toc.style.display = 'none';
      toIdx(i);
    });
    tocItems.appendChild(btn);
  });
}
buildToc();

if (openToc) openToc.addEventListener('click', ()=> toc.style.display='block');
if (closeToc) closeToc.addEventListener('click', ()=> toc.style.display='none');
if (toc) toc.addEventListener('click', (e)=>{ if(e.target === toc) toc.style.display='none'; });

// ======== チャート遅延初期化 ========
const initialized = new Set();
function initChartsFor(slideId){
  if(initialized.has(slideId)) return;
  switch(slideId){
    case 'slide-05': initSlide05(); break;
    case 'slide-06': initSlide06(); break;
    case 'slide-07': initSlide07(); break;
    case 'slide-08': initSlide08(); break;
    case 'slide-10': initSlide10(); break;
    case 'slide-14': initSlide14(); break;
  }
  initialized.add(slideId);
  // レイアウト安定化
  setTimeout(()=> window.dispatchEvent(new Event('resize')), 50);
}

// 初回（1枚目にチャートなし、2枚目以降で随時）
initChartsFor('slide-05');

// ======== Slide 05（ECharts）リスク特性 ========
function initSlide05(){
  const dom = document.getElementById('assetRiskChart');
  if(!dom || !window.echarts) return;
  const chart = echarts.init(dom);
  const categories = ['S&P500','全世界株','国内高配当','FANG+','金ETF','個別株','暗号資産'];
  const candleData = [
    [-25, -10, 15, 30],
    [-25, -10, 15, 30],
    [-20, -8, 10, 25],
    [-30, -15, 20, 40],
    [-15, -5, 8, 20],
    [-40, -15, 20, 45],
    [-80, -30, 40, 90]
  ];
  const meanData = [8.5, 8, 3, 12, 2, 5, 25];

  chart.setOption({
    title:{ text:'リスク・リターン特性', left:'center', textStyle:{ fontSize:13, color:'#2D3748' } },
    tooltip:{
      trigger:'axis', axisPointer:{ type:'shadow' },
      confine:true,
      formatter:(params)=>{
        const c = params.find(p=>p.seriesName==='リスク範囲');
        const m = params.find(p=>p.seriesName==='年率リターン（平均）');
        let out = params[0].axisValueLabel + '<br/>';
        if(c) out += `変動幅: ${c.data[0]}% 〜 ${c.data[3]}%<br/>IQR: ${c.data[1]}% 〜 ${c.data[2]}%<br/>`;
        if(m) out += `平均: ${m.data[1]}%`;
        return out;
      }
    },
    grid:{ left:6, right:6, top:30, bottom:22, containLabel:true },
    xAxis:{ type:'category', data:categories, axisLabel:{ fontSize:10 } },
    yAxis:{ type:'value', min:-100, max:100, axisLabel:{ formatter:'{value}%' } },
    series:[
      { name:'リスク範囲', type:'candlestick', data:candleData,
        itemStyle:{ color:'#0A2463', color0:'#E53E3E', borderColor:'#0A2463', borderColor0:'#E53E3E' } },
      { name:'年率リターン（平均）', type:'scatter',
        data: categories.map((c,i)=>[c, meanData[i]]), symbolSize:8, itemStyle:{ color:'#38A169' } }
    ]
  });
  window.addEventListener('resize', ()=> chart.resize());
}

// ======== Slide 06（Chart.js）ここちゃん配分 ========
function initSlide06(){
  const canvas = document.getElementById('allocationChart06');
  if(!canvas || !window.Chart) return;
  new Chart(canvas.getContext('2d'),{
    type:'pie',
    data:{ labels:['米株','FANG+','全世界株','国内成長/高配','金','暗号','現金'],
      datasets:[{ data:[35,15,10,10,10,10,10],
        backgroundColor:['#3366CC','#DC3912','#FF9900','#109618','#990099','#0099C6','#DD4477'],
        borderColor:'#fff', borderWidth:2 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
  });
}

// ======== Slide 07（Chart.js）NISA内訳 ========
function initSlide07(){
  const canvas = document.getElementById('allocationChart07');
  if(!canvas || !window.Chart) return;
  new Chart(canvas.getContext('2d'),{
    type:'doughnut',
    data:{ labels:['全世界(3万)','FANG+(2万)','S&P500(5万)'], datasets:[{ data:[3,2,5],
      backgroundColor:['#FF9900','#DC3912','#3366CC'], borderColor:'#fff', borderWidth:2 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%', plugins:{ legend:{ position:'bottom' } } }
  });
}

// ======== Slide 08（Chart.js）じぃじ配分（iOS対策込み） ========
function initSlide08(){
  const canvas = document.getElementById('portfolioChart');
  if(!canvas || !window.Chart) return;
  // --- iOS Safari対策：親サイズを確定させてから生成 ---
  const parent = canvas.parentElement;
  canvas.width  = (parent?.clientWidth  || 320);
  canvas.height = (parent?.clientHeight || 280);

  const chart = new Chart(canvas.getContext('2d'),{
    type:'pie',
    data:{ labels:['米株','全世界株','国内高配当','金','暗号','現金'],
      datasets:[{ data:[25,15,20,15,5,20],
        backgroundColor:['#3366CC','#4B9CD3','#2D6E7E','#FFD700','#F4A261','#9FB6CD'],
        borderColor:'#fff', borderWidth:2 }]},
    options:{ responsive:true, maintainAspectRatio:false, animation:false, plugins:{ legend:{ display:false } } }
  });
  requestAnimationFrame(()=> chart.resize());
  setTimeout(()=> chart.resize(), 120);
  window.addEventListener('resize', ()=> chart.resize());
}

// ======== Slide 10（ECharts）資産推移 ========
function initSlide10(){
  const dom = document.getElementById('asset-chart');
  if(!dom || !window.echarts) return;
  const chart = echarts.init(dom);
  const years = ['現在','1年','2年','3年','4年','5年'];
  chart.setOption({
    color:['#2B6CB0','#ED8936'],
    grid:{ left:8, right:8, bottom:8, top:8, containLabel:true },
    xAxis:{ type:'category', boundaryGap:false, data:years, axisLabel:{ fontSize:11 } },
    yAxis:{ type:'value', name:'資産額（万円）', min:0, max:12000, interval:3000, axisLabel:{ fontSize:11 } },
    tooltip:{ trigger:'axis', confine:true },
    series:[
      { name:'ここちゃん（強気）', type:'line', symbol:'none', lineStyle:{ width:0 }, areaStyle:{ color:'rgba(72,187,120,0.25)' }, data:[1600,3500,6000,8500,10500,12000] },
      { name:'ここちゃん（ベース）', type:'line', symbol:'none', lineStyle:{ width:0 }, areaStyle:{ color:'rgba(237,137,54,0.25)' }, data:[1600,3200,5000,6500,7500,8500] },
      { name:'ここちゃん（弱気）', type:'line', symbol:'none', lineStyle:{ width:0 }, areaStyle:{ color:'rgba(229,62,62,0.25)' }, data:[1600,2800,4000,4800,5500,6000] },
      { name:'ここちゃん', type:'line', symbol:'circle', symbolSize:6, itemStyle:{ color:'#2B6CB0' }, lineStyle:{ width:2 }, data:[1600,3200,5000,6500,7500,8500] },
      { name:'じぃじ（強気）', type:'line', symbol:'none', lineStyle:{ width:0 }, areaStyle:{ color:'rgba(72,187,120,0.25)' }, data:[200,1200,2800,4500,5800,7000] },
      { name:'じぃじ（ベース）', type:'line', symbol:'none', lineStyle:{ width:0 }, areaStyle:{ color:'rgba(237,137,54,0.25)' }, data:[200,1000,2200,3200,4000,4500] },
      { name:'じぃじ（弱気）', type:'line', symbol:'none', lineStyle:{ width:0 }, areaStyle:{ color:'rgba(229,62,62,0.25)' }, data:[200,600,1200,1800,2200,2500] },
      { name:'じぃじ', type:'line', symbol:'circle', symbolSize:6, itemStyle:{ color:'#ED8936' }, lineStyle:{ width:2 }, data:[200,1000,2200,3200,4000,4500] },
      { name:'目標', type:'line', symbol:'none', lineStyle:{ type:'dashed', width:2, color:'#2D3748' }, data:years.map(()=>10000) }
    ]
  });
  window.addEventListener('resize', ()=> chart.resize());
}

// ======== Slide 14（ECharts）ウォーターフォール風 ========
function initSlide14(){
  const dom = document.getElementById('waterfall-chart');
  if(!dom || !window.echarts) return;
  const chart = echarts.init(dom);
  chart.setOption({
    title:{ text:'ストレス時の資産別寄与度（%）', left:'center', textStyle:{ fontSize:13, fontWeight:'bold' } },
    tooltip:{ trigger:'axis', axisPointer:{ type:'shadow' }, confine:true, formatter:(p)=> p[0].name + ': ' + p[0].value + '%' },
    grid:{ left:10, right:10, bottom:20, top:30, containLabel:true },
    xAxis:{ type:'category',
      data:['ここちゃん\n開始','暗号','FANG+','米株','国内株','金','現金','ここちゃん\n最終','じぃじ\n開始','暗号','米株','国内\n高配','金','現金','じぃじ\n最終'],
      axisLabel:{ interval:0, fontSize:10, lineHeight:12 } },
    yAxis:{ type:'value', axisLabel:{ formatter:'{value}%' } },
    series:[{
      name:'資産変動', type:'bar', stack:'Total',
      label:{ show:true, position:'inside', fontSize:10,
        formatter:(p)=> (p.dataIndex===0||p.dataIndex===7||p.dataIndex===8||p.dataIndex===14)? p.value+'%' : (p.value>0? '+'+p.value+'%': p.value+'%') },
      itemStyle:{
        color:(p)=>{
          if (p.dataIndex===0 || p.dataIndex===8) return '#0A2463';
          if (p.dataIndex===7 || p.dataIndex===14) return '#E53E3E';
          return p.value < 0 ? '#E53E3E' : '#48BB78';
        }
      },
      data:[ 100,-14,-8,-6,-4,2,0,70, 100,-4,-8,-6,3,0,80 ]
    }]
  });
  window.addEventListener('resize', ()=> chart.resize());
}

// キーボード（デスクトップ閲覧用）
document.addEventListener('keydown', (e)=>{
  if(e.key==='ArrowDown' || e.key==='PageDown') toIdx(currentIndex()+1);
  if(e.key==='ArrowUp' || e.key==='PageUp') toIdx(currentIndex()-1);
});
