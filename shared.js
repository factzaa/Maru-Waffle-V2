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
    { page:'stockManage',    href:'stock-manage.html',    icon:'edit',    label:'จัดการรายการ' },
    { group: '⏰ เข้า-ออกงาน' },
    { page:'attend',         href:'attend.html',          icon:'check',   label:'บันทึกเข้างาน' },
    { page:'attendReport',   href:'attend-report.html',   icon:'trend',   label:'รายงานเข้า-ออกงาน' },
    { page:'attendSetup',    href:'attend-setup.html',    icon:'edit',    label:'จัดการพนักงาน/สาขา' },
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
    + '<div class="toast" id="toast"></div>';
  document.body.insertAdjacentHTML('afterbegin', html);
  renderIcons();
  bindSidebar();
  bindReceiptSheet();
}
