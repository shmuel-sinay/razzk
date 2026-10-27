/** מערכת העיצוב: משתנים, רכיבים, מצב כהה, ונייד. בלי תלות בספריות או פונטים חיצוניים. */
export const CSS = String.raw`
:root{
  --bg:#f3f5f9; --card:#fff; --ink:#18212f; --muted:#667085; --line:#e4e8ef; --soft:#f7f9fc;
  --brand:#1d3a73; --brand-2:#2c57a8; --brand-ink:#fff; --gold:#b8892b; --gold-soft:#fbf3e1;
  --ok:#157f4b; --ok-soft:#e5f5ec; --warn:#a85d00; --warn-soft:#fff2dc; --bad:#b3261e; --bad-soft:#fdeceb;
  --radius:14px; --shadow:0 1px 2px rgba(16,24,40,.06),0 4px 14px rgba(16,24,40,.06);
  --font:"Segoe UI","Heebo","Assistant","Noto Sans Hebrew",system-ui,-apple-system,Arial,sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){
  --bg:#0f1521; --card:#171f2e; --ink:#e8edf6; --muted:#98a2b8; --line:#26314a; --soft:#1b2437;
  --brand:#6f9bff; --brand-2:#8bb0ff; --brand-ink:#0b1220; --gold:#e2b657; --gold-soft:#2a2414;
  --ok:#52d192; --ok-soft:#12291f; --warn:#f0b35a; --warn-soft:#2c2112; --bad:#ff8c84; --bad-soft:#2d1717;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 6px 18px rgba(0,0,0,.3);}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--font);-webkit-font-smoothing:antialiased}
a{color:var(--brand);text-decoration:none} a:hover{text-decoration:underline}
h1{font-size:26px;margin:0 0 4px;letter-spacing:-.2px} h2{font-size:20px;margin:0 0 10px} h3{font-size:16px;margin:0 0 8px}
.muted,small{color:var(--muted)} .sp{flex:1}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}

/* ───── מעטפת ניהול ───── */
.shell{display:grid;grid-template-columns:248px 1fr;min-height:100vh}
.side{background:linear-gradient(180deg,#14284f,#0f1d3a);color:#dfe7f7;padding:18px 12px;position:sticky;top:0;height:100vh;overflow:auto}
.brand{display:flex;gap:10px;align-items:center;padding:6px 10px 18px;color:#fff;font-weight:700;font-size:17px}
.brand i{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#d9b25c,#9a6f1b);display:grid;place-items:center;font-style:normal;color:#1a1204}
.side nav a{display:flex;gap:10px;align-items:center;color:#cfd9ef;padding:10px 12px;border-radius:10px;margin-bottom:2px;font-size:15px}
.side nav a:hover{background:rgba(255,255,255,.08);text-decoration:none;color:#fff}
.side nav a.on{background:rgba(255,255,255,.14);color:#fff;font-weight:600}
.side nav svg{width:19px;height:19px;flex:none;opacity:.9}
.side .grp{font-size:12px;color:#8fa2c8;margin:16px 12px 6px;letter-spacing:.4px}
.main{padding:26px 30px 60px;min-width:0}
.top{display:flex;gap:12px;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap}
.top .sp{flex:1}
.burger{display:none}
@media (max-width:900px){
  .shell{grid-template-columns:1fr}
  .side{position:static;height:auto;display:none;padding:10px}
  #nav-toggle:checked~.shell .side{display:block}
  .burger{display:inline-flex;margin:10px 14px 0;cursor:pointer;background:var(--card);padding:8px 14px;border-radius:10px;box-shadow:var(--shadow)}
  .main{padding:16px 14px 50px}
}
#nav-toggle{display:none}

/* ───── כרטיסים וטבלאות ───── */
.card{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;margin-bottom:16px;border:1px solid var(--line)}
.card.flat{box-shadow:none}
.card.ok{background:var(--ok-soft);border-color:transparent} .card.warn{background:var(--warn-soft);border-color:transparent}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:18px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow)}
.kpi b{display:block;font-size:30px;line-height:1.1;margin-top:4px} .kpi span{color:var(--muted);font-size:14px}
.tablewrap{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:auto}
table{width:100%;border-collapse:collapse}
th{background:var(--soft);color:var(--muted);font-weight:600;font-size:13px;text-align:right;padding:11px 14px;white-space:nowrap;position:sticky;top:0}
td{padding:12px 14px;border-top:1px solid var(--line);vertical-align:middle;text-align:right;font-size:15px}
tr:hover td{background:color-mix(in srgb,var(--soft) 70%,transparent)}
td small{display:block}
.who{display:flex;gap:10px;align-items:center} .who small{display:block}
.acts{display:flex;gap:6px;flex-wrap:wrap;max-width:200px}
.av{width:38px;height:38px;border-radius:50%;background:var(--gold-soft);color:var(--gold);display:grid;place-items:center;font-weight:700;flex:none}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:13px;font-weight:600;background:var(--soft);color:var(--muted);white-space:nowrap}
.badge.ok{background:var(--ok-soft);color:var(--ok)} .badge.warn{background:var(--warn-soft);color:var(--warn)}
.badge.bad{background:var(--bad-soft);color:var(--bad)} .badge.brand{background:color-mix(in srgb,var(--brand) 14%,transparent);color:var(--brand)}
.days{display:inline-flex;gap:3px} .days i{font-style:normal;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:12px;background:var(--soft);color:var(--muted)}
.days i.on{background:var(--brand);color:var(--brand-ink)}
.stars{color:#e2a817;letter-spacing:1px;white-space:nowrap} .stars s{color:var(--line);text-decoration:none}
.toolbar{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center} .toolbar form.row{flex:1;min-width:260px;flex-wrap:nowrap} .toolbar form.row input{flex:1;max-width:none !important}

/* ───── כפתורים ───── */
button,.btn{font:inherit;font-weight:600;cursor:pointer;border:0;border-radius:11px;padding:10px 18px;background:var(--brand);color:var(--brand-ink);display:inline-flex;gap:8px;align-items:center;justify-content:center;transition:transform .05s,box-shadow .15s,background .15s;text-decoration:none}
button:hover,.btn:hover{background:var(--brand-2);text-decoration:none;box-shadow:0 4px 14px rgba(29,58,115,.25)} button:active,.btn:active{transform:translateY(1px)}
button.ghost,.btn.ghost{background:transparent;color:var(--brand);box-shadow:inset 0 0 0 1.5px var(--line)} button.ghost:hover,.btn.ghost:hover{background:var(--soft);box-shadow:inset 0 0 0 1.5px var(--brand)}
button.d,.btn.d{background:var(--bad-soft);color:var(--bad)} button.d:hover{background:var(--bad);color:#fff}
button.sm,.btn.sm{padding:6px 12px;font-size:14px;border-radius:9px}
.btn.big{padding:18px 22px;font-size:19px;width:100%;margin-bottom:12px;border-radius:16px}
.btn.gold{background:var(--gold);color:#fff} .btn.green{background:var(--ok);color:#fff}
form.inline{display:inline}

/* ───── שדות ───── */
.fld{margin:0 0 16px} .fld>label,.lbl{display:block;font-weight:600;font-size:14px;margin-bottom:6px}
.fld .hint{font-size:13px;color:var(--muted);margin-top:4px}
input[type=text],input[type=number],input[type=date],input[type=tel],input[type=search],select,textarea{width:100%;font:inherit;color:var(--ink);background:var(--card);border:1.5px solid var(--line);border-radius:11px;padding:11px 13px;transition:border .15s,box-shadow .15s;min-height:46px}
textarea{min-height:92px;resize:vertical}
input:focus,select:focus,textarea:focus{outline:0;border-color:var(--brand-2);box-shadow:0 0 0 4px color-mix(in srgb,var(--brand-2) 18%,transparent)}
input[readonly]{background:var(--soft);color:var(--muted)}
.touched:invalid{border-color:var(--bad)}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-bottom:16px} .grid .fld{margin:0}
.sec{margin:6px 0 20px} .sec>h3{display:flex;gap:8px;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--line);margin-bottom:14px}
.sec>h3 svg{width:20px;height:20px;color:var(--gold)}

/* סגנון/תפקיד/אזור כמקטעים */
.seg{display:flex;gap:8px;flex-wrap:wrap}
.seg label{position:relative;cursor:pointer}
.seg input{position:absolute;opacity:0;inset:0}
.seg span{display:block;padding:10px 16px;border-radius:11px;border:1.5px solid var(--line);background:var(--card);font-weight:600;font-size:15px;transition:.15s}
.seg input:checked+span{background:var(--brand);border-color:var(--brand);color:var(--brand-ink);box-shadow:0 3px 10px rgba(29,58,115,.25)}
.seg input:focus-visible+span{outline:3px solid color-mix(in srgb,var(--brand-2) 40%,transparent)}
.seg.cards label{flex:1 1 150px} .seg.cards span{padding:14px 16px;font-weight:600}
.seg.cards small{display:block;font-weight:400;opacity:.8;margin-top:2px}
.pills{display:flex;gap:7px;flex-wrap:wrap} .pills label{position:relative;cursor:pointer}
.pills input{position:absolute;opacity:0;inset:0}
.pills span{display:grid;place-items:center;min-width:52px;height:46px;padding:0 12px;border-radius:12px;border:1.5px solid var(--line);background:var(--card);font-weight:700;transition:.15s}
.pills input:checked+span{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.switch{display:inline-flex;gap:10px;align-items:center;cursor:pointer;user-select:none}
.switch input{appearance:none;width:44px;height:26px;border-radius:999px;background:var(--line);position:relative;transition:.2s;cursor:pointer;min-height:0;padding:0;border:0}
.switch input:after{content:"";position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px #0003}
.switch input:checked{background:var(--ok)} .switch input:checked:after{right:21px}
.checks{display:flex;gap:18px;flex-wrap:wrap}

/* בורר שעה */
.ts{display:inline-flex;align-items:center;gap:6px;direction:ltr;background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:4px 8px}
.ts:focus-within{border-color:var(--brand-2);box-shadow:0 0 0 4px color-mix(in srgb,var(--brand-2) 18%,transparent)}
.ts select{border:0;padding:8px 4px;min-height:38px;width:auto;font-size:17px;font-weight:600;background:transparent;box-shadow:none !important;text-align:center;appearance:none;-webkit-appearance:none;cursor:pointer}
.ts b{color:var(--muted)}
.win{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;background:var(--soft);border-radius:12px;margin-bottom:8px}
.win .to{color:var(--muted)} .win.hide{display:none}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.chip{padding:6px 12px;border-radius:999px;background:var(--gold-soft);color:var(--gold);font-weight:600;font-size:14px;cursor:pointer;border:0}
.chip:hover{background:var(--gold);color:#fff}

/* שדה סכום וסטפר */
.money{display:flex;align-items:center;background:var(--card);border:1.5px solid var(--line);border-radius:11px;overflow:hidden}
.money input{border:0;box-shadow:none !important;text-align:center;font-weight:700;font-size:18px;min-height:46px}
.money button{border-radius:0;background:var(--soft);color:var(--ink);padding:0 16px;min-height:46px;box-shadow:none !important;font-size:20px}
.money em{font-style:normal;padding:0 12px;color:var(--muted);font-weight:700}

/* השלמה אוטומטית */
.combo{position:relative}
.combo .dd{position:absolute;inset-inline:0;top:calc(100% + 4px);background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(16,24,40,.18);max-height:260px;overflow:auto;z-index:30;display:none}
.combo .dd.open{display:block}
.combo .dd div{padding:10px 14px;cursor:pointer} .combo .dd div.on,.combo .dd div:hover{background:var(--soft)}
.combo .dd mark{background:var(--gold-soft);color:var(--gold);border-radius:3px;padding:0 1px}
.combo .dd .empty{color:var(--muted);cursor:default}

/* כוכבי דירוג */
.rate{display:inline-flex;flex-direction:row-reverse;gap:2px}
.rate input{display:none} .rate label{font-size:30px;color:var(--line);cursor:pointer;line-height:1}
.rate input:checked~label,.rate label:hover,.rate label:hover~label{color:#e2a817}

/* אשף שלבים */
.wiz{max-width:720px;margin:0 auto}
.steps{display:flex;gap:6px;margin:0 0 18px;counter-reset:s}
.steps li{list-style:none;flex:1;text-align:center;font-size:13px;color:var(--muted);position:relative;padding-top:34px}
.steps li:before{counter-increment:s;content:counter(s);position:absolute;top:0;inset-inline:0;margin:auto;width:28px;height:28px;border-radius:50%;background:var(--line);color:var(--muted);display:grid;place-items:center;font-weight:700;font-size:14px}
.steps li.on:before{background:var(--brand);color:var(--brand-ink)} .steps li.done:before{content:"✓";background:var(--ok);color:#fff}
.steps li.on{color:var(--ink);font-weight:600}
.bar{height:6px;background:var(--line);border-radius:99px;overflow:hidden;margin-bottom:16px} .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--brand),var(--gold));width:0;transition:width .3s}
.js .step{display:none} .js .step.on{display:block;animation:fade .25s}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.nav2{display:flex;gap:10px;margin-top:18px}.nav2 .sp{flex:1}
.err{color:var(--bad);font-size:14px;margin-top:6px;display:none} .err.on{display:block}

/* ציבורי */
.pub-top{background:linear-gradient(135deg,#14284f,#27498f);color:#fff;padding:18px 20px}
.pub-top div{max-width:860px;margin:0 auto;display:flex;gap:12px;align-items:center;font-weight:700;font-size:19px}
.pub-top i{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#d9b25c,#9a6f1b);display:grid;place-items:center;font-style:normal;color:#1a1204}
.pub-main{max-width:860px;margin:22px auto;padding:0 16px 60px}
.hero{text-align:center;padding:34px 10px 24px} .hero h1{font-size:32px} .hero p{color:var(--muted);font-size:18px;max-width:520px;margin:8px auto 24px}
.offer{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}
.offer .price{font-size:26px;font-weight:800;color:var(--brand)}
.score{font-size:12px;color:var(--muted)}
@media (max-width:620px){.offer{grid-template-columns:auto 1fr}.offer .act{grid-column:1/-1}.steps li{font-size:11px}}
.toast{position:fixed;bottom:22px;inset-inline:0;margin:auto;width:max-content;max-width:92vw;background:#12233f;color:#fff;padding:12px 20px;border-radius:12px;box-shadow:0 10px 30px #0006;z-index:99;animation:fade .3s}
.hp{position:absolute;left:-9999px;height:0;overflow:hidden}
.empty-state{text-align:center;padding:40px 10px;color:var(--muted)}
`;

/** התנהגות בצד הלקוח: השלמה אוטומטית, אשף שלבים, בוחרי שעה, סכום, טלפונים ועוד. */
export const JS = String.raw`
(function(){
document.documentElement.classList.add('js');
var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function norm(s){return String(s||'').replace(/[֑-ׇ"'\-\s.,()]/g,'').replace(/קרית/g,'קריית')}

/* השלמה אוטומטית (ערים ושכונות) */
function combo(inp){
  var wrap=document.createElement('div');wrap.className='combo';inp.parentNode.insertBefore(wrap,inp);wrap.appendChild(inp);
  var dd=document.createElement('div');dd.className='dd';wrap.appendChild(dd);
  inp.setAttribute('autocomplete','off');
  var kind=inp.getAttribute('data-combo'), list=[], cityEl=null, cur=-1, loaded='';
  function source(){
    if(kind==='cities'){return window.__CITIES__||[];}
    return list;
  }
  function render(){
    var q=norm(inp.value), items=source().filter(function(x){return !q||norm(x).indexOf(q)>-1}).slice(0,60);
    dd.innerHTML=items.length?items.map(function(x,i){
      var t=esc(x);return '<div data-v="'+t+'" class="'+(i===cur?'on':'')+'">'+t+'</div>';}).join(''):'<div class="empty">'+(kind==='hoods'&&!source().length?'אין שכונות ברשימה לעיר זו — אפשר להקליד חופשי':'לא נמצא — אפשר להקליד חופשי')+'</div>';
    dd.classList.add('open');
  }
  function pick(v){inp.value=v;dd.classList.remove('open');inp.dispatchEvent(new Event('change',{bubbles:true}));}
  inp.addEventListener('focus',function(){loadHoods();render()});
  inp.addEventListener('input',function(){cur=-1;render()});
  inp.addEventListener('keydown',function(e){
    var it=$$('div[data-v]',dd);
    if(e.key==='ArrowDown'){cur=Math.min(cur+1,it.length-1);render();e.preventDefault()}
    else if(e.key==='ArrowUp'){cur=Math.max(cur-1,0);render();e.preventDefault()}
    else if(e.key==='Enter'&&cur>-1&&it[cur]){pick(it[cur].getAttribute('data-v'));e.preventDefault()}
    else if(e.key==='Escape'){dd.classList.remove('open')}
  });
  dd.addEventListener('mousedown',function(e){var t=e.target.closest('div[data-v]');if(t){pick(t.getAttribute('data-v'));e.preventDefault()}});
  document.addEventListener('click',function(e){if(!wrap.contains(e.target))dd.classList.remove('open')});
  function loadHoods(){
    if(kind!=='hoods')return;
    cityEl=cityEl||$('[name="'+inp.getAttribute('data-city')+'"]');
    var c=cityEl?cityEl.value.trim():''; if(!c||c===loaded)return; loaded=c;
    fetch('/api/neighborhoods?city='+encodeURIComponent(c)).then(function(r){return r.json()}).then(function(j){list=j.items||[];if(dd.classList.contains('open'))render()}).catch(function(){});
  }
  if(kind==='hoods'){var ce=$('[name="'+inp.getAttribute('data-city')+'"]');if(ce){ce.addEventListener('change',loadHoods);ce.addEventListener('blur',loadHoods);} loadHoods();}
}
$$('input[data-combo]').forEach(combo);

/* חלונות שעות: הוספה, קיצורים */
$$('[data-addwin]').forEach(function(b){b.addEventListener('click',function(){var h=$('.win.hide',b.closest('.sec,form'));if(h){h.classList.remove('hide');if(!$('.win.hide',b.closest('.sec,form')))b.style.display='none'}})});
$$('[data-preset]').forEach(function(b){b.addEventListener('click',function(e){
  e.preventDefault();var p=b.getAttribute('data-preset').split('-'), rows=$$('.win',b.closest('.sec,form'));
  var row=rows.filter(function(r){var h=$('select[name$="_h"]',r);return h&&!h.value&&!r.classList.contains('hide')})[0]||rows[0];
  row.classList.remove('hide');
  var sels=$$('select',row);function set(a,v){var t=v.split(':');a[0].value=t[0];a[1].value=t[1]}
  set([sels[0],sels[1]],p[0]);set([sels[2],sels[3]],p[1]);
})});

/* סכום עם כפתורי + / - */
$$('.money').forEach(function(m){var i=$('input',m);$$('button',m).forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();
  var step=parseInt(b.getAttribute('data-step'),10)||0, v=(parseInt(i.value,10)||0)+step;i.value=Math.max(0,v);i.dispatchEvent(new Event('input',{bubbles:true}))})})});

/* טלפון: ספרות בלבד */
$$('input[type=tel]').forEach(function(i){i.addEventListener('input',function(){var p=i.selectionStart;i.value=i.value.replace(/[^\d\-+ ]/g,'')});});

/* תאריך עברי לצד הלועזי */
$$('input[type=date][data-heb]').forEach(function(i){
  var out=document.createElement('div');out.className='hint';i.parentNode.appendChild(out);
  function u(){if(!i.value){out.textContent='';return}try{out.textContent=new Intl.DateTimeFormat('he-u-ca-hebrew',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(i.value+'T12:00:00'))}catch(e){}}
  i.addEventListener('change',u);u();});

/* אשף שלבים */
$$('form[data-wizard]').forEach(function(f){
  var steps=$$('.step',f), ol=$('.steps',f), bar=$('.bar i',f), idx=0;
  function show(n){idx=n;steps.forEach(function(s,i){s.classList.toggle('on',i===n)});
    if(ol)$$('li',ol).forEach(function(li,i){li.classList.toggle('on',i===n);li.classList.toggle('done',i<n)});
    if(bar)bar.style.width=((n+1)/steps.length*100)+'%';
    $$('[data-back]',f).forEach(function(b){b.style.visibility=n?'visible':'hidden'});
    $$('[data-next]',f).forEach(function(b){b.style.display=n<steps.length-1?'':'none'});
    $$('[data-submit]',f).forEach(function(b){b.style.display=n===steps.length-1?'':'none'});
    window.scrollTo({top:Math.max(0,f.getBoundingClientRect().top+window.scrollY-20),behavior:'smooth'});}
  function valid(){var s=steps[idx], ok=true;
    $$('input,select,textarea',s).forEach(function(el){if(ok&&el.willValidate&&!el.checkValidity()){el.reportValidity();ok=false}});
    if(ok)$$('[data-min-checked]',s).forEach(function(g){var n=parseInt(g.getAttribute('data-min-checked'),10);
      var err=$('.err',g.parentNode)||g;if($$('input:checked',g).length<n){ok=false;var e=$('.err',g.parentNode);if(e)e.classList.add('on');g.scrollIntoView({block:'center'})}else{var e2=$('.err',g.parentNode);if(e2)e2.classList.remove('on')}});
    if(ok)$$('[data-need-window]',s).forEach(function(g){var any=$$('.win',g).some(function(r){var h=$$('select',r);return h[0].value&&h[1].value&&h[2].value&&h[3].value});
      var e=$('.err',g.parentNode);if(!any){ok=false;if(e)e.classList.add('on');g.scrollIntoView({block:'center'})}else if(e)e.classList.remove('on')});
    return ok}
  $$('[data-next]',f).forEach(function(b){b.addEventListener('click',function(){if(valid())show(Math.min(idx+1,steps.length-1))})});
  $$('[data-back]',f).forEach(function(b){b.addEventListener('click',function(){show(Math.max(idx-1,0))})});
  f.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.tagName==='INPUT'&&idx<steps.length-1){e.preventDefault();if(valid())show(idx+1)}});
  f.addEventListener('submit',function(e){if(!valid())e.preventDefault()});
  show(0);
});

/* סינון מהיר בטבלאות */
$$('input[data-filter]').forEach(function(i){var t=$(i.getAttribute('data-filter'));i.addEventListener('input',function(){var q=norm(i.value);
  $$('tbody tr',t).forEach(function(r){r.style.display=!q||norm(r.textContent).indexOf(q)>-1?'':'none'})})});

/* סימון שדה לא תקין רק אחרי שנגעו בו */
$$('input,select,textarea').forEach(function(el){el.addEventListener('blur',function(){el.classList.add('touched')})});
/* הודעת הצלחה */
if(/[?&]saved=1/.test(location.search)){var t=document.createElement('div');t.className='toast';t.textContent='✓ נשמר בהצלחה';document.body.appendChild(t);setTimeout(function(){t.remove()},2600)}
/* כוכבי דירוג: מציגים ערך נבחר */
})();
`;
