==========================================================
  v2: ทำให้ "หน้าเดิม" ดึงข้อมูลจาก Supabase
  แก้ shared.js จุดเดียว — action getDashboardData จะดึงจาก Supabase
  (action อื่นยังวิ่งไป Apps Script ตามเดิม → ย้ายทีละตัวได้ ไม่พังทั้งระบบ)
  ⚠️ แก้เฉพาะ repo v2 เท่านั้น ห้ามแก้ production
==========================================================

วิธีแก้: เปิด shared.js ใน repo v2 → กด Ctrl+F หาข้อความ "ก่อน" → วางทับด้วย "หลัง"

----------------------------------------------------------
ก่อน:
----------------------------------------------------------
async function api(action, params){
  try{
    const res = await fetch(APPS_SCRIPT_URL, {

----------------------------------------------------------
หลัง:
----------------------------------------------------------
// ===== Supabase data layer (v2) — ดึง/คำนวณบางหน้าจาก Supabase แทน Apps Script =====
const SB_URL = 'https://sfdahyvekfcxoprkshko.supabase.co';
const SB_KEY = 'sb_publishable_632DkQ4uOHjIGWr-_c7hCA_WgFHe3jT';
const SB_CH = [
  { key:'cash', label:'เงินสด', group:'store' },
  { key:'transfer', label:'เงินโอน', group:'store' },
  { key:'thaihelp', label:'ไทยช่วยไทย', group:'store' },
  { key:'lineman', label:'LineMan', group:'delivery' },
  { key:'grab', label:'Grab', group:'delivery' },
  { key:'shopee', label:'ShopeeFood', group:'delivery' },
  { key:'robinhood', label:'Robinhood', group:'delivery' }
];
async function sbFetch(path){
  const res = await fetch(SB_URL + '/rest/v1/' + path, { headers:{ apikey:SB_KEY, Authorization:'Bearer ' + SB_KEY } });
  if(!res.ok) throw new Error('Supabase ' + res.status + ': ' + (await res.text()).slice(0,150));
  return res.json();
}
function sbFmtD(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

// คำนวณเหมือน getDashboardData เดิมทุกอย่าง (คืนรูปแบบเดียวกันเป๊ะ)
async function sbGetDashboardData(p){
  const start = p.start, end = p.end;
  const sD = new Date(start + 'T00:00:00'), eD = new Date(end + 'T00:00:00');
  const days = Math.round((eD - sD) / 86400000) + 1;
  const prevEnd = new Date(sD.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
  const prevStartStr = sbFmtD(prevStart), prevEndStr = sbFmtD(prevEnd);

  const [salesRows, expRows] = await Promise.all([
    sbFetch('sales?select=sale_date,total,cash,transfer,thaihelp,lineman,grab,shopee,robinhood,cash_diff&order=sale_date.asc'),
    sbFetch('expenses?select=exp_date,item,amount')
  ]);

  const chanTotal = {}; SB_CH.forEach(function(c){ chanTotal[c.key] = 0; });
  const byDay = {}, byDow = [0,0,0,0,0,0,0], byDowCnt = [0,0,0,0,0,0,0];
  let totalSales=0, cash=0, transfer=0, thaihelp=0, delivery=0, dayCount=0, prevTotal=0, cashDiff=0;

  salesRows.forEach(function(r){
    const d = r.sale_date, dayTotal = Number(r.total) || 0;
    if(d >= start && d <= end){
      totalSales += dayTotal; dayCount++;
      byDay[d] = dayTotal;
      var di = new Date(d + 'T00:00:00').getDay(); byDow[di] += dayTotal; byDowCnt[di]++;
      cashDiff += Number(r.cash_diff) || 0;
      SB_CH.forEach(function(c){
        const v = Number(r[c.key]) || 0; chanTotal[c.key] += v;
        if(c.group === 'store'){ if(c.key==='cash') cash+=v; else if(c.key==='transfer') transfer+=v; else if(c.key==='thaihelp') thaihelp+=v; }
        else delivery += v;
      });
    } else if(d >= prevStartStr && d <= prevEndStr) prevTotal += dayTotal;
  });

  let totalExpenses = 0; const expByCat = {};
  expRows.forEach(function(r){
    const d = r.exp_date;
    if(d >= start && d <= end){ const a = Number(r.amount)||0; totalExpenses += a; const c = r.item || 'อื่นๆ'; expByCat[c] = (expByCat[c]||0) + a; }
  });

  const byDayArr = Object.keys(byDay).sort().map(function(k){ return { date:k, total:byDay[k] }; });
  const byChannelArr = SB_CH.map(function(c){ return { label:c.label, total:chanTotal[c.key] }; })
    .filter(function(o){ return o.total > 0; }).sort(function(a,b){ return b.total - a.total; });
  const expByCatArr = Object.keys(expByCat).map(function(k){ return { category:k, total:expByCat[k] }; })
    .sort(function(a,b){ return b.total - a.total; });

  let bestDay = null;
  byDayArr.forEach(function(o){ if(!bestDay || o.total > bestDay.total) bestDay = o; });
  const dowNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  function dowAvg(i){ return byDowCnt[i] > 0 ? byDow[i]/byDowCnt[i] : 0; }
  let bestDowIdx = 0; for(let i=1;i<7;i++){ if(dowAvg(i) > dowAvg(bestDowIdx)) bestDowIdx = i; }

  return {
    range:{ start:start, end:end },
    summary:{
      totalSales:totalSales, cash:cash, transfer:transfer, thaihelp:thaihelp, delivery:delivery,
      totalExpenses:totalExpenses, netProfit: totalSales - totalExpenses,
      dayCount:dayCount, avgPerDay: dayCount ? totalSales/dayCount : 0,
      prevTotal:prevTotal, growth: prevTotal > 0 ? ((totalSales - prevTotal)/prevTotal*100) : null,
      bestDay:bestDay, bestDow: byDayArr.length ? dowNames[bestDowIdx] : null,
      bestDowAvg: byDayArr.length ? Math.round(dowAvg(bestDowIdx)) : 0, cashDiff:cashDiff
    },
    byChannel: byChannelArr, byDay: byDayArr, byDow: byDow, byDowCount: byDowCnt, dowNames: dowNames, expByCat: expByCatArr
  };
}

// รายชื่อ action ที่ย้ายมา Supabase แล้ว (ค่อยเพิ่มทีละตัว)
const SB_ACTIONS = { getDashboardData: sbGetDashboardData };

async function api(action, params){
  if(SB_ACTIONS[action]){ return SB_ACTIONS[action](params || {}); }   // ← ดึงจาก Supabase
  try{
    const res = await fetch(APPS_SCRIPT_URL, {

----------------------------------------------------------
(ส่วนที่เหลือของ api() ปล่อยไว้เหมือนเดิม — ไม่ต้องแก้)
----------------------------------------------------------


==========================================================
หลังแก้:
- อัป shared.js เข้า repo v2 → commit
- bump CACHE_VERSION ใน sw.js ของ v2 (เปลี่ยนเลขอะไรก็ได้ให้ต่าง) หรือ hard refresh (Ctrl+Shift+R)
- เปิดหน้า records.html ของ v2 → แท็บ "แดชบอร์ดยอดขาย"
  จะใช้ UI เดิมทุกอย่าง แต่ข้อมูลมาจาก Supabase (เร็วขึ้น ไม่รอ cold start)

หมายเหตุ:
- action อื่น (getConfig ฯลฯ) ยังวิ่งไป Apps Script เดิม = หน้ายังทำงานครบ
- ⚠️ ยังอย่ากด "บันทึก/เขียนข้อมูล" จาก v2 เพราะ write ยังไปลงชีต production
  (เราจะย้าย action เขียนทีหลัง พร้อม policy + ความปลอดภัย)
==========================================================
