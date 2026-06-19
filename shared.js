==========================================================
  v2 shared.js — ตัวเชื่อม Supabase (data layer)
  ทำให้หน้า index (และแดชบอร์ดยอดขาย) ดึงจาก Supabase
  โดยไม่แตะหน้าตา/เมนูเดิมเลย
  ⚠️ แก้เฉพาะ shared.js ของ repo v2 เท่านั้น
==========================================================

วิธีแก้: เปิด shared.js ของ v2 → Ctrl+F หาข้อความ "ก่อน" → วางทับด้วย "หลัง"
(ถ้าเคยวาง patch getDashboardData รอบก่อนไปแล้ว ให้ลบบล็อกนั้นออกก่อน แล้วใช้อันนี้แทน
 เพราะอันนี้รวมทุกอย่างครบกว่า)

----------------------------------------------------------
ก่อน:
----------------------------------------------------------
async function api(action, params){
  try{
    const res = await fetch(APPS_SCRIPT_URL, {

----------------------------------------------------------
หลัง:
----------------------------------------------------------
// ================= Supabase data layer (v2) =================
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
const SB_DOW = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

async function sbFetch(path){
  const res = await fetch(SB_URL + '/rest/v1/' + path, { headers:{ apikey:SB_KEY, Authorization:'Bearer ' + SB_KEY } });
  if(!res.ok) throw new Error('Supabase ' + res.status + ': ' + (await res.text()).slice(0,150));
  return res.json();
}
function sbFmtD(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function sbDM(s){ const p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function sbTsMs(v){ if(!v) return 0; const t = new Date(v).getTime(); return isNaN(t) ? 0 : t; }
function sbFmtTime(v){
  if(v == null || v === '') return '';
  const s = String(v), m = s.match(/^(\d{1,2}):(\d{2})/);
  if(m) return ('0'+m[1]).slice(-2) + ':' + m[2];
  const d = new Date(s);
  if(!isNaN(d.getTime())) return ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
  return '';
}

// ---- ดึงตารางสต๊อกทั้งหมด (ใช้คำนวณคงเหลือ) ----
async function sbStockTables(){
  const [items, daily, wd, rc] = await Promise.all([
    sbFetch('stock_items?select=*'),
    sbFetch('stock_daily?select=*'),
    sbFetch('stock_withdraw?select=*'),
    sbFetch('stock_receive?select=*')
  ]);
  return { items:items, daily:daily, wd:wd, rc:rc };
}

// ---- คำนวณคงเหลือ = port ของ getStockBalances เดิมเป๊ะ ----
function sbComputeBalances(asOfDate, category, T){
  let itemRows = T.items;
  if(category && category !== 'all') itemRows = itemRows.filter(function(r){ return r.category === category; });
  const items = itemRows.map(function(r){
    return { id:r.item_id, name:r.name, category:r.category, unit:r.unit, mode:r.mode || 'withdraw',
             minStock:Number(r.min_stock)||0, active:r.active !== false };
  });
  const map = {};
  items.forEach(function(it){ map[it.id] = { balance:0, lastClose:null, lastCloseTs:0, todayWithdraw:0, todayReceive:0, dayWithdraw:0, dayReceive:0, prevClose:0 }; });

  const d = T.daily.slice().sort(function(a,b){ return String(b.move_date).localeCompare(String(a.move_date)); });
  const seen = {}, seenPrev = {};
  d.forEach(function(r){
    const id = r.item_id; if(!id || !map[id]) return;
    const dt = r.move_date; if(dt > asOfDate) return;
    if(!seen[id]){ seen[id] = true; map[id].balance = Number(r.balance)||0; map[id].lastClose = dt; map[id].lastCloseTs = sbTsMs(r.created_at); }
    if(dt < asOfDate && !seenPrev[id]){ seenPrev[id] = true; map[id].prevClose = Number(r.balance)||0; }
  });

  T.wd.forEach(function(r){
    const id = r.item_id; if(!map[id]) return;
    const dt = r.move_date; if(dt > asOfDate) return;
    if(dt === asOfDate) map[id].dayWithdraw += Number(r.qty)||0;
    if(map[id].lastClose){
      if(dt < map[id].lastClose) return;
      if(dt === map[id].lastClose){ if(!map[id].lastCloseTs) return; const ts = sbTsMs(r.created_at); if(!ts || ts <= map[id].lastCloseTs) return; }
    }
    map[id].balance -= Number(r.qty)||0;
    if(dt === asOfDate) map[id].todayWithdraw += Number(r.qty)||0;
  });
  T.rc.forEach(function(r){
    const id = r.item_id; if(!map[id]) return;
    const dt = r.move_date; if(dt > asOfDate) return;
    if(dt === asOfDate) map[id].dayReceive += Number(r.qty)||0;
    if(map[id].lastClose){
      if(dt < map[id].lastClose) return;
      if(dt === map[id].lastClose){ if(!map[id].lastCloseTs) return; const ts = sbTsMs(r.created_at); if(!ts || ts <= map[id].lastCloseTs) return; }
    }
    map[id].balance += Number(r.qty)||0;
    if(dt === asOfDate) map[id].todayReceive += Number(r.qty)||0;
  });

  const list = items.map(function(it){
    const b = map[it.id];
    return { id:it.id, name:it.name, category:it.category, unit:it.unit, mode:it.mode, minStock:it.minStock, active:it.active,
      balance: Math.round(b.balance*100)/100, lastClose:b.lastClose,
      todayWithdraw: Math.round(b.todayWithdraw*100)/100, todayReceive: Math.round(b.todayReceive*100)/100,
      dayWithdraw: Math.round(b.dayWithdraw*100)/100, dayReceive: Math.round(b.dayReceive*100)/100,
      prevClose: Math.round(b.prevClose*100)/100,
      lowStock: it.minStock > 0 && b.balance <= it.minStock };
  });
  return { items:list,
    summary:{ total:list.length, lowStock:list.filter(function(x){return x.lowStock&&x.active;}).length, outOfStock:list.filter(function(x){return x.balance<=0&&x.active;}).length },
    asOfDate:asOfDate };
}
async function sbGetStockBalances(p){
  const T = await sbStockTables();
  return sbComputeBalances((p && p.date) || sbFmtD(new Date()), (p && p.category) || 'all', T);
}

// ---- แดชบอร์ดยอดขาย = port ของ getDashboardData เดิม ----
async function sbGetDashboardData(p){
  const start = p.start, end = p.end;
  const sD = new Date(start+'T00:00:00'), eD = new Date(end+'T00:00:00');
  const days = Math.round((eD-sD)/86400000)+1;
  const prevEnd = new Date(sD.getTime()-86400000), prevStart = new Date(prevEnd.getTime()-(days-1)*86400000);
  const prevStartStr = sbFmtD(prevStart), prevEndStr = sbFmtD(prevEnd);
  const [salesRows, expRows] = await Promise.all([
    sbFetch('sales?select=sale_date,total,cash,transfer,thaihelp,lineman,grab,shopee,robinhood,cash_diff&order=sale_date.asc'),
    sbFetch('expenses?select=exp_date,item,amount')
  ]);
  const chanTotal = {}; SB_CH.forEach(function(c){ chanTotal[c.key]=0; });
  const byDay = {}, byDow=[0,0,0,0,0,0,0], byDowCnt=[0,0,0,0,0,0,0];
  let totalSales=0, cash=0, transfer=0, thaihelp=0, delivery=0, dayCount=0, prevTotal=0, cashDiff=0;
  salesRows.forEach(function(r){
    const dd = r.sale_date, dayTotal = Number(r.total)||0;
    if(dd>=start && dd<=end){
      totalSales += dayTotal; dayCount++; byDay[dd] = dayTotal;
      var di = new Date(dd+'T00:00:00').getDay(); byDow[di]+=dayTotal; byDowCnt[di]++;
      cashDiff += Number(r.cash_diff)||0;
      SB_CH.forEach(function(c){ const v=Number(r[c.key])||0; chanTotal[c.key]+=v;
        if(c.group==='store'){ if(c.key==='cash')cash+=v; else if(c.key==='transfer')transfer+=v; else if(c.key==='thaihelp')thaihelp+=v; } else delivery+=v; });
    } else if(dd>=prevStartStr && dd<=prevEndStr) prevTotal += dayTotal;
  });
  let totalExpenses=0; const expByCat={};
  expRows.forEach(function(r){ const dd=r.exp_date; if(dd>=start&&dd<=end){ const a=Number(r.amount)||0; totalExpenses+=a; const c=r.item||'อื่นๆ'; expByCat[c]=(expByCat[c]||0)+a; } });
  const byDayArr = Object.keys(byDay).sort().map(function(k){ return {date:k,total:byDay[k]}; });
  const byChannelArr = SB_CH.map(function(c){ return {label:c.label,total:chanTotal[c.key]}; }).filter(function(o){return o.total>0;}).sort(function(a,b){return b.total-a.total;});
  const expByCatArr = Object.keys(expByCat).map(function(k){ return {category:k,total:expByCat[k]}; }).sort(function(a,b){return b.total-a.total;});
  let bestDay=null; byDayArr.forEach(function(o){ if(!bestDay||o.total>bestDay.total) bestDay=o; });
  function dowAvg(i){ return byDowCnt[i]>0?byDow[i]/byDowCnt[i]:0; }
  let bestDowIdx=0; for(let i=1;i<7;i++){ if(dowAvg(i)>dowAvg(bestDowIdx)) bestDowIdx=i; }
  return { range:{start:start,end:end},
    summary:{ totalSales:totalSales, cash:cash, transfer:transfer, thaihelp:thaihelp, delivery:delivery,
      totalExpenses:totalExpenses, netProfit: totalSales-totalExpenses, dayCount:dayCount, avgPerDay: dayCount?totalSales/dayCount:0,
      prevTotal:prevTotal, growth: prevTotal>0?((totalSales-prevTotal)/prevTotal*100):null,
      bestDay:bestDay, bestDow: byDayArr.length?SB_DOW[bestDowIdx]:null, bestDowAvg: byDayArr.length?Math.round(dowAvg(bestDowIdx)):0, cashDiff:cashDiff },
    byChannel:byChannelArr, byDay:byDayArr, byDow:byDow, byDowCount:byDowCnt, dowNames:SB_DOW, expByCat:expByCatArr };
}

// ---- หน้าแรก = port ของ getHomeDashboard เดิม ----
async function sbGetHomeDashboard(){
  const now = new Date();
  const today = sbFmtD(now), yesterday = sbFmtD(new Date(now.getTime()-86400000)), start7 = sbFmtD(new Date(now.getTime()-6*86400000));
  const [salesRows, expRows, attRows, staffRows, T] = await Promise.all([
    sbFetch('sales?select=sale_date,total'),
    sbFetch('expenses?select=exp_date,item,amount,created_at'),
    sbFetch('attendance?select=att_date,att_time,type,staff_id,name'),
    sbFetch('staff_safe?select=staff_id,active'),
    sbStockTables()
  ]);

  // 1) ยอดขาย 7 วัน
  const salesByDate = {};
  salesRows.forEach(function(r){ const d=r.sale_date; if(d>=start7&&d<=today) salesByDate[d]=(salesByDate[d]||0)+(Number(r.total)||0); });
  const sales7days = [];
  for(let i=6;i>=0;i--){ const d=sbFmtD(new Date(now.getTime()-i*86400000)); sales7days.push({ date:d, dateDM:sbDM(d), sales:salesByDate[d]||0 }); }
  const salesYesterday = salesByDate[yesterday]||0;
  const nonZero = sales7days.filter(function(d){ return d.sales>0; });
  const salesAvg7 = nonZero.length ? nonZero.reduce(function(a,b){return a+b.sales;},0)/nonZero.length : 0;
  const compareYesterdayPct = salesAvg7>0 ? Math.round((salesYesterday-salesAvg7)/salesAvg7*100) : 0;

  // 2) สต๊อก (ใช้ตัวคำนวณคงเหลือเดียวกับทุกหน้า)
  const items = {};
  T.items.forEach(function(r){ if(!r.item_id) return; items[r.item_id]={ id:r.item_id, name:r.name, category:r.category, unit:r.unit, minStock:Number(r.min_stock)||0, mode:r.mode||'withdraw', active:r.active!==false }; });
  const wd7Sum={}, wdSum={}, rcSum={}, wasteSum={};
  T.wd.forEach(function(r){ const id=r.item_id, q=Number(r.qty)||0; if(!id) return; wdSum[id]=(wdSum[id]||0)+q; if(r.move_date>=start7&&r.move_date<=today) wd7Sum[id]=(wd7Sum[id]||0)+q; });
  T.rc.forEach(function(r){ const id=r.item_id, q=Number(r.qty)||0; if(!id) return; rcSum[id]=(rcSum[id]||0)+q; });
  T.daily.forEach(function(r){ const id=r.item_id; if(!id) return; wasteSum[id]=(wasteSum[id]||0)+(Number(r.waste)||0); });
  const balMap = {}; sbComputeBalances(today,'all',T).items.forEach(function(b){ balMap[b.id]=b; });
  let activeCount=0, lowStockCount=0, outOfStockCount=0; const outOfStockItems=[], itemsWithBalance=[];
  Object.keys(items).forEach(function(id){
    const it=items[id]; if(!it.active) return; activeCount++;
    let bal = balMap[id]? balMap[id].balance : ((rcSum[id]||0)-(wdSum[id]||0)-(wasteSum[id]||0));
    bal = Math.round(bal*100)/100;
    const isOut = bal<=0, isLow = !isOut && it.minStock>0 && bal<=it.minStock;
    if(isOut){ outOfStockCount++; outOfStockItems.push({id:id,name:it.name,unit:it.unit}); } else if(isLow) lowStockCount++;
    itemsWithBalance.push({ id:id, name:it.name, unit:it.unit, balance:bal, wd7:wd7Sum[id]||0 });
  });
  const criticalForecast = itemsWithBalance.filter(function(it){ return it.wd7>0&&it.balance>0; })
    .map(function(it){ const avgDaily=it.wd7/7, daysLeft=avgDaily>0?Math.floor(it.balance/avgDaily):999;
      return { name:it.name, balance:it.balance, unit:it.unit, avgDaily:Math.round(avgDaily*10)/10, daysLeft:daysLeft }; })
    .filter(function(f){ return f.daysLeft<=3; }).sort(function(a,b){ return a.daysLeft-b.daysLeft; }).slice(0,5);

  // 3) เข้างานวันนี้
  const inMap={}, outMap={};
  attRows.forEach(function(r){ if(r.att_date!==today) return; const id=r.staff_id, tm=sbFmtTime(r.att_time);
    if(r.type==='in'){ if(!inMap[id]||tm<inMap[id].time) inMap[id]={name:r.name,time:tm}; }
    else if(r.type==='out'){ if(!outMap[id]||tm>outMap[id].time) outMap[id]={name:r.name,time:tm}; } });
  const checkedIn=Object.keys(inMap).length, checkedOut=Object.keys(outMap).length;
  const present=Object.keys(inMap).filter(function(id){ return !outMap[id]; }).map(function(id){ return inMap[id]; });
  const totalStaff = staffRows.filter(function(r){ return r.staff_id && r.active!==false; }).length;

  // 4) ค่าใช้จ่ายวันนี้
  let expensesToday=0, expensesTodayCount=0;
  expRows.forEach(function(r){ if(r.exp_date===today){ expensesToday+=Number(r.amount)||0; expensesTodayCount++; } });

  // 5) ฟีดกิจกรรมวันนี้ (10 อันล่าสุด)
  const activities=[];
  attRows.forEach(function(r){ if(r.att_date!==today) return; const tm=sbFmtTime(r.att_time);
    activities.push({ time:tm, type:r.type==='in'?'attend_in':'attend_out', icon:r.type==='in'?'🟢':'🔴',
      text:r.name+' '+(r.type==='in'?'เช็คอิน':'เช็คเอาท์'), color:r.type==='in'?'#15803D':'#B91C1C', ts:today+' '+tm }); });
  T.wd.forEach(function(r){ if(r.move_date!==today) return; const tm=sbFmtTime(r.move_time);
    activities.push({ time:tm, type:'withdraw', icon:'📤', text:'เบิก '+r.item_name+' x'+r.qty, color:'#C2410C', ts:today+' '+tm }); });
  T.rc.forEach(function(r){ if(r.move_date!==today) return; const tm=sbFmtTime(r.created_at);
    activities.push({ time:tm, type:'receive', icon:'📥', text:'รับเข้า '+r.item_name+' x'+r.qty, color:'#15803D', ts:today+' '+(tm||'z') }); });
  expRows.forEach(function(r){ if(r.exp_date!==today) return; const tm=sbFmtTime(r.created_at);
    activities.push({ time:tm, type:'expense', icon:'🧾', text:'จ่าย '+(r.item||'-')+' ฿'+Math.round(Number(r.amount)||0).toLocaleString('en-US'), color:'#6D28D9', ts:today+' '+(tm||'z') }); });
  activities.sort(function(a,b){ return b.ts.localeCompare(a.ts); });

  return {
    today:today, yesterday:yesterday,
    sales:{ yesterday:salesYesterday, avg7:Math.round(salesAvg7), sales7days:sales7days, compareYesterdayPct:compareYesterdayPct },
    stock:{ total:activeCount, lowStock:lowStockCount, outOfStock:outOfStockCount, outOfStockItems:outOfStockItems.slice(0,5), criticalForecast:criticalForecast },
    attendance:{ total:totalStaff, checkedIn:checkedIn, checkedOut:checkedOut, present:present },
    expenses:{ todayTotal:expensesToday, todayCount:expensesTodayCount },
    activities:activities.slice(0,10)
  };
}

// action ที่ย้ายมา Supabase แล้ว (เพิ่มทีละตัวได้)
const SB_ACTIONS = {
  getHomeDashboard: sbGetHomeDashboard,
  getDashboardData: sbGetDashboardData,
  getStockBalances: sbGetStockBalances
};

async function api(action, params){
  if(SB_ACTIONS[action]){ return SB_ACTIONS[action](params || {}); }   // ← ดึงจาก Supabase
  try{
    const res = await fetch(APPS_SCRIPT_URL, {

----------------------------------------------------------
(ที่เหลือของ api() ปล่อยเหมือนเดิม ไม่ต้องแก้)
----------------------------------------------------------

หลังแก้:
- รัน SQL staff_safe (Supabase_05) ให้เสร็จก่อน
- อัป shared.js เข้า v2 → commit → hard refresh (Ctrl+Shift+R)
- เปิดหน้า index ของ v2 → จะเป็นหน้าตา/เมนูเดิมทุกอย่าง แต่ข้อมูลมาจาก Supabase

ตอนนี้ย้ายแล้ว 3 action: getHomeDashboard, getDashboardData, getStockBalances
→ หน้าที่ทำงานบน Supabase ได้เลย: index, แดชบอร์ดยอดขาย (records), ตรวจสต๊อก (stock-view)
ที่เหลือ (getExpensesReport, getStockDashboard, getAttendReport ฯลฯ) ค่อยเพิ่มทีละตัว
⚠️ ยังอย่ากดปุ่ม "บันทึก" จาก v2 (write ยังไป Apps Script/ชีต production)
