/* iPhone最適化：枠/口座・売買単価・最小単位・取得単価の統一UI、±%セグメント（-5/-1/+1/+5）、
   ロック、100%正規化、銘柄別集計、結果セルの固定表示、共有/コピー（範囲 rows/groups/both） */
(function(){
  "use strict";
  function ready(fn){ if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fn,{once:true}); else fn(); }
  ready(init);

  function init(){
    const $  = (q, el=document) => el.querySelector(q);
    const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
    const stateKey = 'rebalance_state_v4';

    const els = {
      list: $("#assetList"),
      addRow: $("#addRow"),
      calc: $("#calcBtn"),
      newCash: $("#newCash"),
      roundMode: $("#roundMode"),
      totalNow: $("#totalNow"),
      totalTarget: $("#totalTarget"),
      turnover: $("#turnover"),
      residual: $("#residual"),
      resultList: $("#resultList"),
      pctTotal: $("#pctTotal"),
      normalizeBtn: $("#normalizeBtn"),
      groupList: $("#groupList"),
    };

    // ---- state ----
    let ls = loadState();
    let assets = (ls && ls.assets) ? ls.assets.map(patch) : [
      { id: uid(), name: "S&P500投信", account:"積立", now:1000000, targetPct:50, price:0, step:0.0001, cost:0, lock:false },
      { id: uid(), name: "オルカン",   account:"積立", now: 600000, targetPct:30, price:0, step:0.0001, cost:0, lock:false },
      { id: uid(), name: "国内高配当", account:"特別", now: 200000, targetPct:20, price:0, step:1,       cost:0, lock:false },
    ];
    if (els.newCash)   els.newCash.value   = (ls && ls.newCash!=null) ? ls.newCash : 0;
    if (els.roundMode) els.roundMode.value = (ls && ls.roundMode) ? ls.roundMode : 'nearest';

    render();
    wireEvents();
    computeAndRender();

    function patch(a){
      if(a.account==null) a.account="";
      if(a.cost==null) a.cost=0;
      if(a.lock==null) a.lock=false;
      if(a.step==null) a.step=1;
      return a;
    }

    function wireEvents(){
      if (els.addRow) els.addRow.addEventListener('click', () => {
        assets.push({ id: uid(), name: "", account:"", now: 0, targetPct: 0, price: 0, step: 1, cost:0, lock:false });
        render(true); haptic();
      });

      if (els.list) els.list.addEventListener('input', (e) => {
        const row = e.target.closest('.asset-row'); if (!row) return;
        const id = row.dataset.id;
        const a = assets.find(x=>x.id===id); if (!a) return;

        if (e.target.classList.contains('name')) a.name = e.target.value;
        if (e.target.classList.contains('now'))  a.now  = num(e.target.value);
        if (e.target.classList.contains('pct'))  a.targetPct = num(e.target.value);
        if (e.target.classList.contains('lock')) a.lock = !!e.target.checked;

        const adv = row.nextElementSibling && row.nextElementSibling.classList.contains('asset-adv') ? row.nextElementSibling : null;
        if (adv){
          const p = $('.price', adv);   if (p) a.price   = num(p.value);     // 売買単価（時価/基準価額）
          const s = $('.step',  adv);   if (s) a.step    = num(s.value);     // 最小単位
          const ac= $('.account',adv);  if (ac) a.account= ac.value;         // 枠/口座
          const c = $('.cost',  adv);   if (c) a.cost    = num(c.value);     // 取得単価（参考）
        }
        saveState();
      });

      if (els.list) els.list.addEventListener('click', (e) => {
        const del = e.target.closest('.del'); if (!del) return;
        const id = del.dataset.id;
        assets = assets.filter(a=>a.id!==id);
        render(); saveState(); haptic();
      });

      if (els.calc)  els.calc.addEventListener('click', ()=>{ computeAndRender(); haptic(30); });
      if (els.newCash)   els.newCash.addEventListener('input', ()=>saveState());
      if (els.roundMode) els.roundMode.addEventListener('change', ()=>saveState());
      if (els.normalizeBtn) els.normalizeBtn.addEventListener('click', ()=>{ normalizePct(); computeAndRender(); haptic(20); });

      // ％ボタン：-5 / -1 / +1 / +5（クリック/長押し対応）
      let repeatTimer=null;
      const startRepeat=(fn)=>{ stopRepeat(); fn(); repeatTimer=setInterval(fn,120); };
      const stopRepeat=()=>{ if(repeatTimer){ clearInterval(repeatTimer); repeatTimer=null; } };
      ['touchend','touchcancel','mouseup','mouseleave'].forEach(ev=>document.addEventListener(ev, stopRepeat, {passive:true}));

      function onPressStart(root, selector, handler){
        root.addEventListener('touchstart', (e) => {
          const t = e.target.closest(selector); if (!t) return; startRepeat(()=>handler(t)); e.preventDefault();
        }, {passive:false});
        root.addEventListener('mousedown', (e) => {
          const t = e.target.closest(selector); if (!t) return; startRepeat(()=>handler(t)); e.preventDefault();
        });
      }
      if (els.list) onPressStart(els.list, '.nbtn[data-kind="pct"]', (btn)=>{
        const wrap = btn.closest('.nudge'); if (!wrap) return;
        const id = wrap.getAttribute('data-id'); const delta = parseFloat(btn.getAttribute('data-delta'));
        adjustPct(id, delta);
      });

      // 共有/コピー：委任（範囲 rows|groups|both）
      bindClick('#shareBtn,[data-action="share"]', (btn) => {
        const scope = (btn.getAttribute('data-scope') || 'rows').toLowerCase();
        computeAndRender();
        shareSummary(scope);
      });
      bindClick('#copyBtn,[data-action="copy"]', (btn) => {
        const scope = (btn.getAttribute('data-scope') || 'rows').toLowerCase();
        computeAndRender();
        copySummary(scope);
      });
    }

    function render(focusLast=false){
      if (!els.list) return;
      els.list.innerHTML = assets.map(a => rowHTML(a)).join('');
      $$('.asset-adv').forEach(adv=>{
        adv.addEventListener('input', ()=>{
          const id=adv.dataset.id; const a=assets.find(x=>x.id===id); if(!a) return;
          const p=$('.price',adv);   if(p) a.price=num(p.value);
          const s=$('.step',adv);    if(s) a.step =num(s.value);
          const ac=$('.account',adv);if(ac)a.account=ac.value;
          const c=$('.cost',adv);    if(c) a.cost =num(c.value);
          saveState();
        });
      });
      if (focusLast){
        const names=$$('.asset-row .name'); if(names.length) names[names.length-1].focus();
      }
    }

    function rowHTML(a){
      return `
        <div class="asset-row" data-id="${a.id}">
          <div class="cell">
            <div class="colhdr">銘柄名</div>
            <input class="name"  placeholder="例: eMAXIS Slim S&P500" value="${esc(a.name)}" aria-label="銘柄名"/>
          </div>
          <div class="cell">
            <div class="colhdr right">現在額</div>
            <input class="now right"  type="number" inputmode="decimal" step="1"  value="${fmtNum(a.now)}" aria-label="現在評価額(時価合計, 円)"/>
          </div>
          <div class="cell">
            <div class="colhdr right">目標%</div>
            <input class="pct right"  type="number" inputmode="decimal" step="0.1" value="${fmtNum(a.targetPct)}" aria-label="目標比率(%)"/>
          </div>
          <button class="btn del" data-id="${a.id}" aria-label="行を削除">✕</button>
        </div>

        <div class="asset-adv small" data-id="${a.id}">
          <div class="small">
            <label class="lbl">枠/口座</label>
            <input class="account" type="text" placeholder="例: 積立 / 成長 / 特別" value="${esc(a.account||'')}">
          </div>
          <div class="small">
            <label class="lbl">売買単価（時価/基準価額）</label>
            <input class="price" type="number" inputmode="decimal" step="0.0001" value="${a.price||0}" placeholder="0">
          </div>
          <div class="small">
            <label class="lbl">最小単位</label>
            <input class="step" type="number" inputmode="decimal" step="0.0001" value="${a.step!=null?a.step:1}" placeholder="1">
          </div>
          <div class="small">
            <label class="lbl">取得単価（参考）</label>
            <input class="cost" type="number" inputmode="decimal" step="0.0001" value="${a.cost||0}" placeholder="0">
          </div>
          <div class="small">
            <label class="lbl">ロック</label>
            <label class="switch">
              <input type="checkbox" class="lock" ${a.lock?'checked':''}>
              <span class="switch-label">売買しない</span>
            </label>
          </div>

          <!-- ％：-5 / -1 / +1 / +5（等分配置） -->
          <div class="nudge" data-id="${a.id}">
            <button class="nbtn" data-kind="pct" data-delta="-5" aria-label="目標比率を5%下げる">-5%</button>
            <button class="nbtn" data-kind="pct" data-delta="-1" aria-label="目標比率を1%下げる">-1%</button>
            <button class="nbtn" data-kind="pct" data-delta="1"  aria-label="目標比率を1%上げる">+1%</button>
            <button class="nbtn" data-kind="pct" data-delta="5"  aria-label="目標比率を5%上げる">+5%</button>
          </div>
        </div>
      `;
    }


    function adjustPct(id, delta){
      const a=assets.find(x=>x.id===id); if(!a) return;
      a.targetPct = clamp((a.targetPct||0)+delta, 0, 999);
      const row=document.querySelector('.asset-row[data-id="'+cssEscape(id)+'"]');
      if(row){ const inp=row.querySelector('.pct'); if(inp) inp.value=fmtNum(a.targetPct); }
      saveState(); haptic(8); updatePctTotalOnly();
    }

    function normalizePct(){
      const sumPct = sum(assets.map(a=>a.targetPct||0));
      if (sumPct<=0) return;
      const k = 100 / sumPct;
      assets.forEach(a=>{ a.targetPct = (a.targetPct||0) * k; });
      render(); saveState(); updatePctTotalOnly();
    }

    function computeAndRender(){
      const newCash = els.newCash ? num(els.newCash.value) : 0;
      const roundMode = els.roundMode ? els.roundMode.value : 'nearest';

      const totalNow = sum(assets.map(a=>a.now));
      const targetTotal = totalNow + newCash;

      const lockedNow = sum(assets.filter(a=>a.lock).map(a=>a.now));
      const unlocked = assets.filter(a=>!a.lock);
      const unlockedPctSum = sum(unlocked.map(a=>a.targetPct));

      const rows = assets.map(a=>{
        let targetVal;
        if (a.lock || unlockedPctSum<=0){
          targetVal = a.now;
        }else{
          const allocBase = Math.max(0, targetTotal - lockedNow);
          targetVal = allocBase * ((a.targetPct||0) / unlockedPctSum);
        }

        const rawDelta = targetVal - a.now;

        let units=null, unitsRounded=null, deltaRounded=rawDelta;
        if (a.price && a.price>0){
          const step = a.step && a.step>0 ? a.step : 1;
          units = rawDelta / a.price;
          unitsRounded = roundUnits(units, step, roundMode);
          deltaRounded = unitsRounded * a.price;
          if (a.lock) { units=null; unitsRounded=null; deltaRounded=0; }
        }else{
          if (a.lock) deltaRounded = 0;
        }

        return {
          id:a.id, name:a.name, account:a.account,
          now:a.now,
          curPct: totalNow>0 ? (a.now/totalNow*100) : 0,
          tgtPct: (a.targetPct||0),
          rawDelta, deltaRounded,
          units, unitsRounded,
          price:a.price||0,
          lock:a.lock
        };
      });

      // 集計
      const turnover = sum(rows.map(r=>Math.abs(r.deltaRounded)));
      const achievedTotal = totalNow + sum(rows.map(r=>r.deltaRounded));
      const residual = roundJPY(targetTotal - achievedTotal);

      if (els.totalNow)    els.totalNow.textContent    = fmtJPY(totalNow);
      if (els.totalTarget) els.totalTarget.textContent = fmtJPY(targetTotal);
      if (els.turnover)    els.turnover.textContent    = fmtJPY(turnover);
      if (els.residual)    els.residual.textContent    = fmtJPY(residual);
      if (els.resultList)  els.resultList.innerHTML = rows.map(r=>resultRowHTML(r)).join('');

      if (els.groupList){
        const g = groupByName(rows, totalNow);
        els.groupList.innerHTML = g.map(x=>groupRowHTML(x)).join('');
      }

      updatePctTotalOnly();
      saveState();
    }

    function groupByName(rows, totalNow){
      const map = Object.create(null);
      for (let r of rows){
        const key = (r.name||'').trim() || '（名称未設定）';
        if (!map[key]) map[key] = { name:key, now:0, tgtPct:0, delta:0, units:null, unitsAccu:0, unitsAll:true };
        map[key].now += (r.now||0);
        map[key].tgtPct += (r.tgtPct||0);
        map[key].delta += (r.deltaRounded||0);
        if (r.unitsRounded==null){ map[key].unitsAll=false; }
        else { map[key].unitsAccu += r.unitsRounded; }
      }
      const arr = [];
      for (let k in map){
        const m = map[k];
        const curPct = totalNow>0 ? (m.now/totalNow*100) : 0;
        arr.push({
          name:m.name,
          curPct,
          tgtPct:m.tgtPct,
          deltaRounded:m.delta,
          units: m.unitsAll ? m.unitsAccu : null
        });
      }
      return arr;
    }

    function resultRowHTML(r){
      const sign = r.deltaRounded > 0 ? '買' : (r.deltaRounded < 0 ? '売' : '—');
      const unitsStr = (r.units !== null) ? (r.unitsRounded!=null ? r.unitsRounded.toFixed(decimalsFor(r.unitsRounded)) : '—') : '—';
      const lockTag = r.lock ? '（ロック）' : '';
      const acctTag = r.account ? ` <span class="chip">${esc(r.account)}</span>` : '';
      const amtText = `${sign} ${fmtJPY(Math.abs(r.deltaRounded))}`;

      return `
        <div class="r-row">
          <div title="${esc(r.name || '—')}">${esc(r.name || '—')}${acctTag}${lockTag}</div>
          <div class="right num" title="${(r.curPct||0).toFixed(1)}%">${(r.curPct||0).toFixed(1)}%</div>
          <div class="right num" title="${(r.tgtPct||0).toFixed(1)}%">${(r.tgtPct||0).toFixed(1)}%</div>
          <div class="right num" title="${esc(amtText)}">${esc(amtText)}</div>
          <div class="right num" title="${unitsStr}">${unitsStr}</div>
        </div>
      `;
    }

    function groupRowHTML(x){
      const sign = x.deltaRounded > 0 ? '買' : (x.deltaRounded < 0 ? '売' : '—');
      const amtText = `${sign} ${fmtJPY(Math.abs(x.deltaRounded))}`;
      const unitsStr = (x.units!=null) ? x.units.toFixed(decimalsFor(x.units)) : '—';
      return `
        <div class="r-row">
          <div title="${esc(x.name)}">${esc(x.name)}</div>
          <div class="right num" title="${x.curPct.toFixed(1)}%">${x.curPct.toFixed(1)}%</div>
          <div class="right num" title="${(x.tgtPct||0).toFixed(1)}%">${(x.tgtPct||0).toFixed(1)}%</div>
          <div class="right num" title="${esc(amtText)}">${esc(amtText)}</div>
          <div class="right num" title="${unitsStr}">${unitsStr}</div>
        </div>
      `;
    }

    function updatePctTotalOnly(){
      if (!els.pctTotal) return;
      const sumPct = sum(assets.map(a=>a.targetPct||0));
      els.pctTotal.textContent = (Math.round(sumPct*10)/10) + '%';
      if (sumPct>99.9 && sumPct<100.1) els.pctTotal.classList.remove('bad');
      else els.pctTotal.classList.add('bad');
    }

    // 共有/コピー：委任ヘルパ
    function bindClick(selector, handler){
      document.addEventListener('click', (e)=>{
        const t = e.target.closest(selector);
        if(!t) return;
        e.preventDefault();
        handler(t);
      }, {passive:false});
    }

    // 共有テキスト生成（scope: rows | groups | both）
    function genSummaryText(scope='rows'){
      const totalNow = sum(assets.map(a => a.now));
      const newCash  = els.newCash ? num(els.newCash.value) : 0;

      const header = [
        `リバランス案`,
        `現状総額: ¥${fmtJPY(totalNow)}`,
        `新規入出金: ¥${fmtJPY(newCash)}`,
        `合計%: ${(() => {
          const s = sum(assets.map(a=>a.targetPct||0));
          return (Math.round(s*10)/10)+'%';
        })()}`
      ].join(' / ');

      const lines = [header];

      if (scope === 'rows' || scope === 'both'){
        const rows = Array.from(document.querySelectorAll('#resultList .r-row')).map(el=>{
          const name  = el.children[0]?.textContent.trim() || '—';
          const cur   = el.children[1]?.textContent.trim() || '';
          const tgt   = el.children[2]?.textContent.trim() || '';
          const amt   = el.children[3]?.textContent.trim() || '';
          const units = el.children[4]?.textContent.trim() || '';
          return `- ${name}: 現在${cur} → 目標${tgt} | ${amt}${(units && units!=='—') ? `（${units}口/株）` : ''}`;
        });
        if (rows.length){
          lines.push('', '［行別］', ...rows);
        }
      }

      if (scope === 'groups' || scope === 'both'){
        const rows = Array.from(document.querySelectorAll('#groupList .r-row')).map(el=>{
          const name  = el.children[0]?.textContent.trim() || '—';
          const cur   = el.children[1]?.textContent.trim() || '';
          const tgt   = el.children[2]?.textContent.trim() || '';
          const amt   = el.children[3]?.textContent.trim() || '';
          const units = el.children[4]?.textContent.trim() || '';
          return `- ${name}: 現在${cur} → 目標${tgt} | ${amt}${(units && units!=='—') ? `（${units}口/株）` : ''}`;
        });
        if (rows.length){
          lines.push('', '［銘柄別］', ...rows);
        }
      }

      return lines.join('\n');
    }

    async function shareSummary(scope='rows'){
      const text = genSummaryText(scope);
      if (navigator.share){
        try{
          await navigator.share({ text, title: 'リバランス案' });
          toast('共有ダイアログを開きました');
          return;
        }catch(_){ /* キャンセル等 → コピーにフォールバック */ }
      }
      await copyToClipboard(text);
      toast('共有非対応 → テキストをコピーしました');
    }

    async function copySummary(scope='rows'){
      const text = genSummaryText(scope);
      await copyToClipboard(text);
      toast('コピーしました');
    }

    async function copyToClipboard(text){
      try{
        await navigator.clipboard.writeText(text);
      }catch{
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try{ document.execCommand('copy'); } finally { ta.remove(); }
      }
      haptic(8);
    }

    function toast(msg){
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = msg;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.classList.add('on'); });
      setTimeout(()=>{ el.classList.remove('on'); setTimeout(()=>el.remove(), 200); }, 1400);
    }

    /* helpers */
    function roundUnits(x, step, mode){ const q=x/step; if(mode==='floor')return Math.sign(x)*Math.floor(Math.abs(q))*step; if(mode==='ceil')return Math.sign(x)*Math.ceil(Math.abs(q))*step; return Math.sign(x)*Math.round(Math.abs(q))*step; }
    function decimalsFor(n){ const s=String(n); const i=s.indexOf('.'); return i<0?0:Math.min(6,s.length-i-1); }
    function roundJPY(x){ return Math.round(x); }
    function fmtJPY(n){ return new Intl.NumberFormat('ja-JP').format(Math.round(n||0)); }
    function fmtNum(n){ return Number.isFinite(n) ? n : 0; }
    function sum(a){ return a.reduce((x,y)=>x+(+y||0),0); }
    function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:0; }
    function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function uid(){ return Math.random().toString(36).slice(2,9); }
    function haptic(ms){ if(navigator.vibrate) navigator.vibrate(ms||10); }
    function cssEscape(s){ return String(s).replace(/"/g,'\\"'); }
    function clamp(x,min,max){ return Math.min(max, Math.max(min, x)); }

    function saveState(){
      const st = {
        assets,
        newCash: els.newCash ? num(els.newCash.value) : 0,
        roundMode: els.roundMode ? els.roundMode.value : 'nearest'
      };
      try{ localStorage.setItem(stateKey, JSON.stringify(st)); }catch{}
    }
    function loadState(){
      try{ const raw=localStorage.getItem(stateKey); return raw?JSON.parse(raw):null; }catch{ return null; }
    }
  }
})();
