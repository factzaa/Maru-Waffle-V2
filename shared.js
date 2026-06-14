// ============================================================
// Maru Waffle — shared.js
// ใช้ร่วมกันในทุกไฟล์ stock-*.html
// ============================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxM4wS8A69veJY-4YTXJg2nbQKC-AaG88VDLSfp_SHX9SsUf2yhd6xv4ICKJPyVHnLDeg/exec';

// ---- Utilities ----
function fmt(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function baht(n){return '฿'+Math.round(Number(n)||0).toLocaleString('en-US');}
function num(v){const n=parseFloat(v); return isNaN(n)?0:n;}
function escHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

function toast(msg){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2400);
}

// ============================================================
// SWR cache (localStorage) — stale-while-revalidate
// เปิดหน้าซ้ำ → วาดจาก cache ทันที แล้วดึงสดมาอัปเดตเบื้องหลัง
// ============================================================
const SWR_PREFIX = 'maru_swr:';
const SWR_TTL = 5 * 60 * 1000;   // 5 นาที — เก่ากว่านี้ไม่ใช้ cache (กันค้างนาน)

// read action ที่ cache ได้
const SWR_CACHEABLE = {
  getStockBalances:1, getStockItems:1, getHomeDashboard:1, getStockDashboard:1,
  getActivityFeed:1, getDashboardData:1, getExpensesReport:1,
  getAttendReport:1, getAttendStaff:1, getAttendBranches:1, getStockAuditHistory:1
};

// write action → กลุ่ม read ที่ต้องล้าง cache เมื่อบันทึกสำเร็จ
const WRITE_INVALIDATES = {
  addStockWithdraw:  ['getStockBalances','getStockItems','getStockDashboard','getHomeDashboard','getActivityFeed'],
  addStockReceive:   ['getStockBalances','getStockItems','getStockDashboard','getHomeDashboard','getActivityFeed'],
  closeDailyStock:   ['getStockBalances','getStockItems','getStockDashboard','getHomeDashboard','getActivityFeed'],
  addStockAudit:     ['getStockBalances','getStockItems','getStockDashboard','getHomeDashboard','getActivityFeed','getStockAuditHistory'],
  saveStockItem:     ['getStockBalances','getStockItems','getStockDashboard','getHomeDashboard'],
  addStockItem:      ['getStockBalances','getStockItems','getStockDashboard','getHomeDashboard'],
  deleteStockItem:   ['getStockBalances','getStockItems','getStockDashboard','getHomeDashboard'],
  saveMinStockBatch: ['getStockItems','getStockBalances','getStockDashboard','getHomeDashboard'],
  saveDailyReport:   ['getDashboardData','getHomeDashboard','getActivityFeed','getExpensesReport'],
  addBusinessExpense:['getExpensesReport','getHomeDashboard','getActivityFeed'],
  addAttendLog:      ['getAttendReport','getHomeDashboard','getActivityFeed'],
  saveAttendStaff:   ['getAttendStaff','getHomeDashboard'],
  saveAttendBranch:  ['getAttendBranches']
};

function swrKey(action, params){ return SWR_PREFIX + action + ':' + JSON.stringify(params || {}); }
function swrRead(key){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function swrWrite(key, value){
  try{ localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); }
  catch(e){ try{ swrClear(); localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); }catch(e2){} }
}
function swrClear(actionPrefix){
  try{
    const rm = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.indexOf(SWR_PREFIX)===0 && (!actionPrefix || k.indexOf(SWR_PREFIX+actionPrefix)===0)) rm.push(k);
    }
    rm.forEach(function(k){ localStorage.removeItem(k); });
  }catch(e){}
}
function invalidateCache(actions){ (actions||[]).forEach(function(a){ swrClear(a); }); }

// SWR call — onData(data, meta) อาจถูกเรียกได้ถึง 2 ครั้ง: cache ก่อน แล้ว fresh
// คืน Promise(fresh). ถ้า network ล้มแต่มี cache → ใช้ cache ต่อ (ไม่ throw)
function apiSWR(action, params, onData){
  const key = swrKey(action, params);
  const cached = swrRead(key);
  let served = false;
  if(cached && (Date.now() - cached.t) < SWR_TTL){
    served = true;
    try{ onData(cached.v, { fromCache:true, age: Date.now()-cached.t }); }catch(e){}
  }
  return api(action, params).then(function(fresh){
    swrWrite(key, fresh);
    try{ onData(fresh, { fromCache:false }); }
    catch(e){ console.error('apiSWR onData error ['+action+']', e); if(!served) throw e; }
    return fresh;
  }).catch(function(err){
    if(served) return cached.v;   // มี cache อยู่แล้ว — เงียบ ใช้ต่อ
    throw err;                     // ไม่มี cache — ให้ caller จัดการ (โชว์ error)
  });
}


async function api(action, params){
  try{
    const res = await fetch(APPS_SCRIPT_URL, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(Object.assign({action:action}, params||{}))
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    if(data.error) throw new Error(data.error);
    if(WRITE_INVALIDATES[action]) invalidateCache(WRITE_INVALIDATES[action]);
    return data;
  }catch(err){ throw err; }
}

// ---- ICONS ----
const ICON_S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const ICONS = {
  edit:     ICON_S+'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  receipt:  ICON_S+'<path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>',
  dash:     ICON_S+'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  trend:    ICON_S+'<polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
  store:    ICON_S+'<path d="M3 9l2-5h14l2 5"/><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M9 21V12h6v9"/></svg>',
  check:    ICON_S+'<polyline points="20 6 9 17 4 12"/></svg>',
  camera:   ICON_S+'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  image:    ICON_S+'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
};

// ---- Render icons on data-icon attribute ----
function renderIcons(root){
  (root || document).querySelectorAll('[data-icon]').forEach(function(el){
    const name = el.dataset.icon;
    if(ICONS[name] && !el.querySelector('svg')) el.innerHTML = ICONS[name];
  });
}

// ---- Sidebar ----
function bindSidebar(){
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sbBackdrop');
  const ham = document.getElementById('hamburger');
  const cl = document.getElementById('sbClose');
  if(!sb) return;
  function open(){ sb.classList.add('show'); bd.classList.add('show'); }
  function close(){ sb.classList.remove('show'); bd.classList.remove('show'); }
  if(ham) ham.addEventListener('click', open);
  if(cl)  cl.addEventListener('click', close);
  if(bd)  bd.addEventListener('click', close);
}

// ---- Build standard sidebar (เรียกในทุกหน้า — มาร์ค active ตาม attr current) ----
function buildSidebar(currentPage){
  const items = [
    { page:'home',           href:'index.html',           icon:'dash',    label:'🏠 หน้าแรก' },
    { page:'report',         href:'records.html#report',  icon:'edit',    label:'บันทึกรายงานสิ้นวัน' },
    { page:'bizexp',         href:'records.html#bizexp',  icon:'receipt', label:'บันทึกค่าใช้จ่าย' },
    { page:'dash',           href:'records.html#dash',    icon:'dash',    label:'แดชบอร์ดยอดขาย' },
    { page:'expreport',      href:'expenses-report.html', icon:'trend',   label:'รายงานสรุปค่าใช้จ่าย' },
    { group: '📦 สต๊อกสินค้า' },
    { page:'stockDashboard', href:'stock-dashboard.html', icon:'dash',    label:'แดชบอร์ดสต๊อก' },
    { page:'stockView',      href:'stock-view.html',      icon:'store',   label:'ตรวจสต๊อก' },
    { page:'stockWithdraw',  href:'stock-withdraw.html',  icon:'edit',    label:'เบิกของ' },
    { page:'stockReceive',   href:'stock-receive.html',   icon:'receipt', label:'รับของเข้า' },
    { page:'stockClose',     href:'stock-close.html',     icon:'check',   label:'ปิดร้าน (สรุปสต๊อก)' },
    { page:'stockAudit',     href:'stock-audit.html',     icon:'check',   label:'ออดิทสต๊อก' },
    { page:'stockAuditReport', href:'stock-audit-report.html', icon:'trend', label:'ประวัติออดิท' },
    { page:'stockManage',    href:'stock-manage.html',    icon:'edit',    label:'จัดการรายการ' },
    { group: '⏰ เข้า-ออกงาน' },
    { page:'attend',         href:'attend.html',          icon:'check',   label:'บันทึกเข้างาน' },
    { page:'attendReport',   href:'attend-report.html',   icon:'trend',   label:'รายงานเข้า-ออกงาน' },
    { page:'attendSetup',    href:'attend-setup.html',    icon:'edit',    label:'จัดการพนักงาน/สาขา' },
    { page:'payments',       href:'payments.html',        icon:'receipt', label:'💰 การจ่ายเงิน' },
    { page:'assistant',      href:'assistant.html',       icon:'sparkles', label:'🐤 ผู้ช่วยมารุ' },
    { group: '📖 คู่มือ' },
    { page:'manual',         href:'manual.html',          icon:'check',   label:'คู่มือการใช้งาน' },
  ];
  return items.map(function(it){
    if(it.group) return '<div class="sb-group">'+it.group+'</div>';
    const active = it.page === currentPage ? ' active' : '';
    return '<a class="sb-item'+active+'" href="'+it.href+'"><span class="si" data-icon="'+it.icon+'"></span>'+it.label+'</a>';
  }).join('');
}

// ---- Service Worker ----
function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
}

// ---- Receipt picker (bottom sheet) — ใช้ร่วม ----
// usage: setReceiptHandler(function(file){ ... }); openReceiptSheet();
let _rcptHandler = null;
function setReceiptHandler(fn){ _rcptHandler = fn; }
function openReceiptSheet(){ document.getElementById('rcptSheet').classList.add('show'); }
function closeReceiptSheet(){ document.getElementById('rcptSheet').classList.remove('show'); }
function bindReceiptSheet(){
  const sheet = document.getElementById('rcptSheet'); if(!sheet) return;
  document.getElementById('rcptCancel').addEventListener('click', closeReceiptSheet);
  sheet.addEventListener('click', function(e){ if(e.target===sheet) closeReceiptSheet(); });
  document.getElementById('rcptCam').addEventListener('click', function(){
    closeReceiptSheet();
    document.getElementById('rcptInputCam').click();
  });
  document.getElementById('rcptAlb').addEventListener('click', function(){
    closeReceiptSheet();
    document.getElementById('rcptInputAlb').click();
  });
  document.getElementById('rcptInputCam').addEventListener('change', function(){
    if(_rcptHandler && this.files[0]) _rcptHandler(this.files[0]);
    this.value = '';
  });
  document.getElementById('rcptInputAlb').addEventListener('change', function(){
    if(_rcptHandler && this.files[0]) _rcptHandler(this.files[0]);
    this.value = '';
  });
  // icons
  setTimeout(function(){
    const camIc = document.querySelector('#rcptCam .oc');
    const albIc = document.querySelector('#rcptAlb .oc');
    if(camIc) camIc.innerHTML = ICONS.camera;
    if(albIc) albIc.innerHTML = ICONS.image;
  }, 30);
}

// ---- HTML snippets (sidebar / hamburger / receipt sheet) ----
// เรียก injectShell(currentPage) เพื่อใส่ HTML ส่วน sidebar + hamburger + toast + receipt sheet
function injectShell(currentPage){
  const html = ''
    + '<button class="hamburger" id="hamburger" aria-label="เมนู">'
    +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">'
    +     '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>'
    +   '</svg>'
    + '</button>'
    + '<div class="sidebar-backdrop" id="sbBackdrop"></div>'
    + '<aside class="sidebar" id="sidebar">'
    +   '<div class="sb-head">'
    +     '<img src="icon-192.png" alt="">'
    +     '<div><div class="sb-title">Maru Waffle</div><div class="sb-sub">ระบบบริหารร้าน</div></div>'
    +     '<button class="sb-close" id="sbClose">✕</button>'
    +   '</div>'
    +   '<nav class="sb-nav">' + buildSidebar(currentPage) + '</nav>'
    +   '<div class="sb-foot">🐤 ข้อมูลเก็บใน Google Sheet ของคุณ</div>'
    + '</aside>'
    // Receipt sheet (ใช้เมื่อแนบรูป)
    + '<div class="rcpt-sheet" id="rcptSheet"><div class="panel">'
    +   '<h4>เพิ่มรูปใบบิล</h4>'
    +   '<div class="opt cam" id="rcptCam"><div class="oc"></div><div class="ot"><div class="tt">ถ่ายรูปใหม่</div><div class="sub">ใช้กล้องของอุปกรณ์</div></div></div>'
    +   '<div class="opt alb" id="rcptAlb"><div class="oc"></div><div class="ot"><div class="tt">เลือกจากอัลบั้ม</div><div class="sub">เลือกรูปที่ถ่ายไว้แล้ว</div></div></div>'
    +   '<div class="opt cancel" id="rcptCancel">ยกเลิก</div>'
    + '</div></div>'
    + '<input type="file" accept="image/*" capture="environment" id="rcptInputCam" style="display:none">'
    + '<input type="file" accept="image/*" id="rcptInputAlb" style="display:none">'
    + maruAssistantMarkup(currentPage)
    + '<div class="toast" id="toast"></div>';
  document.body.insertAdjacentHTML('afterbegin', html);
  renderIcons();
  bindSidebar();
  bindReceiptSheet();
  bindMaruAssistant(currentPage);
}

// ===== ผู้ช่วยมารุ: ปุ่มลอย + กล่องแชท + เสียง (Web Speech API ฟรี ไม่กินเครดิต) =====
function maruAssistantMarkup(currentPage){
  if(currentPage === 'assistant') return ''; // หน้าเต็มมีแชทอยู่แล้ว ไม่ต้องมีปุ่มลอยซ้ำ
  return ''
   + '<style id="maruStyle">'
   + '.maru-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;'
   + 'border:0;background:transparent;color:#1A1A1A;font-size:30px;box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer;z-index:900;'
   + 'display:flex;align-items:center;justify-content:center;transition:transform .15s;overflow:hidden;padding:0;}'
   + '.maru-fab img{width:124%;height:124%;object-fit:cover;border-radius:50%;display:block;}'
   + '.maru-fab:active{transform:scale(.92);}'
   + '.maru-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1600;display:none;align-items:flex-end;justify-content:center;}'
   + '.maru-ov.show{display:flex;}'
   + '.maru-panel{background:#FAF8F1;width:100%;max-width:520px;height:78vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -6px 30px rgba(0,0,0,.25);}'
   + '.maru-head{display:flex;align-items:center;gap:8px;padding:13px 15px;background:#FFC629;}'
   + '.maru-title{flex:1;font-family:"Kanit";font-weight:800;font-size:16px;color:#1A1A1A;}'
   + '.maru-spk,.maru-x,.maru-set{border:0;background:rgba(0,0,0,.08);width:34px;height:34px;border-radius:50%;font-size:16px;cursor:pointer;color:#1A1A1A;}'
   + '.maru-cfg{display:none;flex-direction:column;gap:9px;padding:12px 15px;background:#FFF7E0;border-bottom:1px solid #ECE6D6;}'
   + '.maru-cfg.show{display:flex;}'
   + '.maru-cfg .cfg-row{display:flex;align-items:center;gap:10px;font-size:13px;color:#1A1A1A;font-family:"Sarabun";}'
   + '.maru-cfg .cfg-row span{width:62px;flex-shrink:0;}'
   + '.maru-cfg select{flex:1;padding:6px 8px;border:1px solid #ECE6D6;border-radius:8px;font-family:"Sarabun";font-size:13px;background:#fff;}'
   + '.maru-cfg input[type=range]{flex:1;}'
   + '.maru-cfg .cfg-mute{display:flex;align-items:center;gap:7px;font-size:13px;font-family:"Sarabun";color:#1A1A1A;}'
   + '.maru-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;}'
   + '.maru-hi{text-align:center;color:#8A8170;font-size:13px;padding:10px;}'
   + '.maru-b{max-width:84%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;font-family:"Sarabun";}'
   + '.maru-b.me{align-self:flex-end;background:#FFC629;color:#1A1A1A;border-bottom-right-radius:4px;}'
   + '.maru-b.ai{align-self:flex-start;background:#fff;border:1px solid #ECE6D6;color:#1A1A1A;border-bottom-left-radius:4px;}'
   + '.maru-b.er{align-self:center;background:#FEF2F2;color:#B91C1C;font-size:12.5px;text-align:center;}'
   + '.maru-dots{align-self:flex-start;background:#fff;border:1px solid #ECE6D6;border-radius:14px;padding:11px 14px;display:flex;gap:4px;}'
   + '.maru-dots span{width:7px;height:7px;border-radius:50%;background:#C9C1AE;animation:marubz 1.2s infinite;}'
   + '.maru-dots span:nth-child(2){animation-delay:.2s;}.maru-dots span:nth-child(3){animation-delay:.4s;}'
   + '@keyframes marubz{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-4px);}}'
   + '.maru-in{display:flex;gap:7px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));align-items:flex-end;border-top:1px solid #ECE6D6;background:#FAF8F1;}'
   + '.maru-in textarea{flex:1;resize:none;border:1.5px solid #ECE6D6;border-radius:13px;padding:10px 13px;font-family:"Sarabun";font-size:14px;max-height:110px;line-height:1.4;background:#fff;color:#1A1A1A;}'
   + '.maru-in textarea:focus{outline:none;border-color:#FFC629;}'
   + '.maru-mic{width:42px;height:42px;border-radius:50%;border:1.5px solid #ECE6D6;background:#fff;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;}'
   + '.maru-wave{display:inline-flex;align-items:center;gap:2.5px;height:18px;}'
   + '.maru-wave i{width:3px;height:7px;background:#1A1A1A;border-radius:2px;animation:maruwv 1.1s infinite ease-in-out;}'
   + '.maru-wave i:nth-child(2){animation-delay:.15s;}.maru-wave i:nth-child(3){animation-delay:.3s;}.maru-wave i:nth-child(4){animation-delay:.45s;}'
   + '@keyframes maruwv{0%,100%{height:6px;}50%{height:16px;}}'
   + '.maru-mic.rec{background:#FEE2E2;border-color:#FCA5A5;}'
   + '.maru-mic.rec .maru-wave i{background:#DC2626;}'
   + '.maru-send{width:42px;height:42px;border-radius:50%;border:0;background:#1A1A1A;color:#FFC629;font-size:17px;cursor:pointer;flex-shrink:0;}'
   + '.maru-send:disabled{opacity:.4;}'
   + '</style>'
   + '<button class="maru-fab" id="maruFab" aria-label="ผู้ช่วยมารุ"><img src="maru-chick.png" alt="มารุ" onerror="this.replaceWith(document.createTextNode(\'🐤\'))"></button>'
   + '<div class="maru-ov" id="maruOv"><div class="maru-panel">'
   +   '<div class="maru-head"><div class="maru-title">🐤 ผู้ช่วยมารุ</div>'
   +     '<button class="maru-set" id="maruSet" title="ตั้งค่าเสียง">⚙</button>'
   +     '<button class="maru-x" id="maruX">✕</button></div>'
   +   '<div class="maru-cfg" id="maruCfg">'
   +     '<div class="cfg-row"><span>เสียง</span><select id="maruVoiceSel"></select></div>'
   +     '<div class="cfg-row"><span>ความเร็ว</span><input type="range" id="maruRateSel" min="0.7" max="1.4" step="0.1"></div>'
   +     '<label class="cfg-mute"><input type="checkbox" id="maruMuteChk"> ปิดเสียงพูด</label>'
   +   '</div>'
   +   '<div class="maru-msgs" id="maruMsgs"><div class="maru-hi">สวัสดีครับ 🐤 ถามหรือคุยเล่นได้เลย<br>กดไมค์ 🎤 พูดก็ได้นะ</div></div>'
   +   '<div class="maru-in">'
   +     '<button class="maru-mic" id="maruMic" title="พูด"><span class="maru-wave"><i></i><i></i><i></i><i></i></span></button>'
   +     '<textarea id="maruInp" rows="1" placeholder="พิมพ์ หรือกดไมค์พูด..."></textarea>'
   +     '<button class="maru-send" id="maruSend">➤</button>'
   +   '</div>'
   + '</div></div>';
}

var maruHistory = [];
var maruBusy = false;
var maruRec = null;

var maruVoices = [];
function maruLoadVoices(){
  try{ maruVoices = (window.speechSynthesis ? speechSynthesis.getVoices() : []) || []; }catch(e){ maruVoices = []; }
}
if(window.speechSynthesis){
  maruLoadVoices();
  speechSynthesis.onvoiceschanged = maruLoadVoices;
}
function maruThaiVoices(){
  // เสียงไทยก่อน ตามด้วยเสียงอื่นที่พูดไทยได้
  var th = maruVoices.filter(function(v){ return /th/i.test(v.lang); });
  return th.length ? th : maruVoices;
}
function maruPlay(text){
  try{
    if(!window.speechSynthesis) return;
    if(localStorage.getItem('maruMute') === '1') return;   // ปิดเสียงไว้
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.rate = parseFloat(localStorage.getItem('maruRate') || '1') || 1;
    var want = localStorage.getItem('maruVoice') || '';
    var list = maruThaiVoices();
    var pick = want ? list.filter(function(v){ return v.name === want; })[0] : list[0];
    if(pick) u.voice = pick;
    speechSynthesis.speak(u);
  }catch(e){}
}

function bindMaruAssistant(currentPage){
  if(currentPage === 'assistant') return;
  var fab = document.getElementById('maruFab');
  var ov = document.getElementById('maruOv');
  var msgs = document.getElementById('maruMsgs');
  var inp = document.getElementById('maruInp');
  var sendB = document.getElementById('maruSend');
  var micB = document.getElementById('maruMic');
  if(!fab || !ov) return;

  fab.addEventListener('click', function(){ ov.classList.add('show'); setTimeout(function(){ inp.focus(); }, 100); });
  document.getElementById('maruX').addEventListener('click', function(){ ov.classList.remove('show'); try{ speechSynthesis.cancel(); }catch(e){} });
  ov.addEventListener('click', function(e){ if(e.target === ov){ ov.classList.remove('show'); try{ speechSynthesis.cancel(); }catch(e){} } });

  // ===== ตั้งค่าเสียง =====
  var setBtn = document.getElementById('maruSet');
  var cfg = document.getElementById('maruCfg');
  var voiceSel = document.getElementById('maruVoiceSel');
  var rateSel = document.getElementById('maruRateSel');
  var muteChk = document.getElementById('maruMuteChk');
  if(!window.speechSynthesis){ if(setBtn) setBtn.style.display='none'; }
  function fillVoices(){
    if(!voiceSel) return;
    var list = maruThaiVoices();
    if(!list.length){ voiceSel.innerHTML = '<option value="">(เสียงเริ่มต้นของเครื่อง)</option>'; return; }
    var saved = localStorage.getItem('maruVoice') || '';
    voiceSel.innerHTML = list.map(function(v){
      var sel = (v.name === saved) ? ' selected' : '';
      return '<option value="'+escHtml(v.name)+'"'+sel+'>'+escHtml(v.name)+' ('+escHtml(v.lang)+')</option>';
    }).join('');
  }
  fillVoices();
  if(window.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', fillVoices);
  if(rateSel) rateSel.value = localStorage.getItem('maruRate') || '1';
  if(muteChk) muteChk.checked = localStorage.getItem('maruMute') === '1';

  if(setBtn) setBtn.addEventListener('click', function(){ cfg.classList.toggle('show'); fillVoices(); });
  if(voiceSel) voiceSel.addEventListener('change', function(){
    localStorage.setItem('maruVoice', voiceSel.value);
    maruPlay('สวัสดีครับ เสียงนี้เป็นยังไงบ้าง');  // ลองฟังเสียงที่เลือก
  });
  if(rateSel) rateSel.addEventListener('change', function(){ localStorage.setItem('maruRate', rateSel.value); });
  if(muteChk) muteChk.addEventListener('change', function(){
    localStorage.setItem('maruMute', muteChk.checked ? '1' : '0');
    if(muteChk.checked){ try{ speechSynthesis.cancel(); }catch(e){} }
  });

  inp.addEventListener('input', function(){ inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,110)+'px'; });
  inp.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); maruSend(); } });
  sendB.addEventListener('click', function(){ maruSend(); });

  // ไมโครโฟน (ถ้าอุปกรณ์รองรับ)
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ micB.style.display='none'; }
  else {
    micB.addEventListener('click', function(){
      if(micB.classList.contains('rec')){ try{ maruRec && maruRec.stop(); }catch(e){} return; }
      try{
        maruRec = new SR();
        maruRec.lang='th-TH'; maruRec.interimResults=false; maruRec.maxAlternatives=1;
        maruRec.onstart=function(){ micB.classList.add('rec'); };
        maruRec.onend=function(){ micB.classList.remove('rec'); };
        maruRec.onerror=function(){ micB.classList.remove('rec'); };
        maruRec.onresult=function(ev){
          var t = ev.results[0][0].transcript;
          inp.value = t;
          maruSend();
        };
        maruRec.start();
      }catch(e){ toast('ใช้ไมค์ไม่ได้บนเครื่องนี้'); }
    });
  }

  function maruAdd(text, cls){
    var hi = msgs.querySelector('.maru-hi'); if(hi) hi.remove();
    var d = document.createElement('div'); d.className='maru-b '+cls; d.textContent=text;
    msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight; return d;
  }
  function maruDots(){ var d=document.createElement('div'); d.className='maru-dots'; d.id='maruDots'; d.innerHTML='<span></span><span></span><span></span>'; msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight; }
  function maruNoDots(){ var d=document.getElementById('maruDots'); if(d) d.remove(); }

  window.maruSend = async function(){
    var text = inp.value.trim();
    if(!text || maruBusy) return;
    maruBusy=true; sendB.disabled=true;
    maruAdd(text,'me'); inp.value=''; inp.style.height='auto';
    maruDots();
    try{
      var r = await api('askAI', { message:text, history:maruHistory });
      maruNoDots();
      if(r.ok){
        maruAdd(r.reply,'ai');
        maruHistory.push({role:'user',text:text});
        maruHistory.push({role:'model',text:r.reply});
        if(maruHistory.length>24) maruHistory = maruHistory.slice(-24);
        maruPlay(r.reply);
      } else {
        maruAdd(r.error || 'ขอโทษครับ ตอบไม่ได้ตอนนี้','er');
      }
    }catch(err){
      maruNoDots(); maruAdd('เชื่อมต่อไม่ได้ ลองใหม่นะครับ','er');
    }
    maruBusy=false; sendB.disabled=false;
  };
}
