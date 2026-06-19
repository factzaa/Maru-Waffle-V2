# 📋 บันทึกความคืบหน้า — Maru Waffle App (ย้ายไป Supabase)

> อัปเดตล่าสุด: 19 มิ.ย. 2026
> เก็บไฟล์นี้ไว้ใน repo `Maru-Waffle-V2` (เช่นชื่อ `PROGRESS.md`) จะได้เปิดต่อจากเครื่องไหนก็ได้

---

## 🎯 เป้าหมายรวม
ย้ายแอปจัดการร้าน Maru Waffle จาก **Google Apps Script + Google Sheet** ไปเก็บข้อมูลที่ **Supabase** (PostgreSQL + Storage)
เหตุผล: แก้ปัญหาอัปรูปไม่เสถียร, เร็วขึ้น, เสถียรขึ้น, และ **เลิกใช้ Apps Script**

หลักการทำงาน (สำคัญมาก):
- ยังเป็น **PWA บน GitHub Pages** เหมือนเดิม (ไม่เอาขึ้น App Store)
- ทำเป็นโปรเจกต์แยก **V2** (`Maru-Waffle-V2`) ทำคู่ขนานกับ V1 production ที่พนักงานใช้อยู่ — **ห้ามกระทบ V1**
- พัฒนา V2 ให้ครบก่อน แล้วค่อยสลับพนักงานมาใช้
- ยังไม่ต้องมีระบบล็อกอินเต็มรูปแบบ (เก็บความสะดวกพนักงานไว้) — ข้อมูลอ่อนไหว (เงินเดือน/บัญชี/PIN) ค่อยทำ owner-passcode + Edge Function ทีหลัง

---

## 🌐 ข้อมูลระบบ

**Repos**
- V1 production: `factzaa/Maru-Waffle` (ยังใช้ Apps Script — พนักงานใช้จริงทุกวัน **อย่าแตะ**)
- V2 ใหม่: `factzaa/Maru-Waffle-V2` → https://factzaa.github.io/Maru-Waffle-V2/

**Supabase**
- Project URL: `https://sfdahyvekfcxoprkshko.supabase.co`
- Publishable key (ใส่ในหน้าเว็บได้ ปลอดภัย): `sb_publishable_632DkQ4uOHjIGWr-_c7hCA_WgFHe3jT`
- ⚠️ **service_role / secret key**: ห้ามใส่ในหน้าเว็บ/repo เด็ดขาด — และเคยหลุดในภาพหน้าจอ ควรกด **Reset** ที่ Settings → API
- ตาราง: 11 ตาราง (sales, expenses, stock_*, attend_*, staff, branches, config ฯลฯ)
- มี view `staff_safe` สำหรับข้อมูลพนักงานแบบปลอดภัย (PDPA — เปิดเฉพาะ name/nickname/position/branch/active...)

---

## ✅ ทำเสร็จแล้ว

1. **ฟีเจอร์การตลาด (ผู้ช่วยมารุ)** 3 เฟส — แคปชั่น + แต่งรูป Canvas + สร้างรูป AI (Nano Banana) — เสร็จบน V1
2. **เสียงภาษาไทย** ของมารุบน Windows — ติดตั้งแล้ว
3. **อัปรูปบิล**: เพิ่มย่อรูป + Google Drive fallback (บน V1)
4. **ย้ายข้อมูล Sheet → Supabase** — ครบทุกตาราง
5. **ฝั่งอ่าน (read) ย้ายมา Supabase** ผ่าน `shared.js` (SB_ACTIONS ~13 actions): dashboard, home, stock balances, expenses report ฯลฯ
6. **🔥 ตัดหน้า records.html ขาดจาก Apps Script สมบูรณ์** (งานล่าสุด — ทดสอบผ่านแล้ว)

---

## 🔧 วิธีที่ใช้ตัด records.html (สำคัญ — ใช้เป็นแม่แบบหน้าอื่นได้)

ปัญหา: `records.html` เป็นหน้า **standalone** — มี `api()` ของตัวเอง ยิงตรงไป Apps Script และ **ไม่โหลด shared.js** (เลย route ไป Supabase ไม่ได้)

วิธีแก้ที่ได้ผล:
- สร้างไฟล์ **`sb-data.js`** (อยู่ใน outputs / repo) = โค้ด Supabase ทั้งหมดห่อใน IIFE
  - มี 6 actions: `getConfig, getDailyReport, getExpensesReport, getDashboardData, addBusinessExpense, saveDailyReport`
  - มี `window.maruCompressImage` (ย่อรูป/พรีวิว)
  - **เขียนทับ `window.api`** เป็นตัว Supabase ล้วน + override ซ้ำตอน DOMContentLoaded/load/setTimeout (กันโหลดผิดลำดับ)
- ใน `records.html` เพิ่มแค่ 1 บรรทัด: `<script src="sb-data.js"></script>` (วางเหนือ `</body>`)
- รัน SQL เปิดสิทธิ์เขียน: `Supabase_07` (Storage receipts + insert expenses) และ `Supabase_08` (insert/update sales + delete expenses)

ผลทดสอบ (19 มิ.ย. 2026): กดบันทึกค่าใช้จ่ายจริง → เข้า Supabase ✓ ไม่ไป V1 ✓ ลบ test row ได้ ✓

หมายเหตุ: **บันทึกสิ้นวันยังไม่ส่ง LINE** (token ใส่หน้าเว็บไม่ได้ — รอทำ Edge Function)

---

## ⏭️ งานที่ยังเหลือ (ทำต่อจากนี้)

**ลำดับถัดไป — ย้ายหน้าอื่นแบบเดียวกับ records:**
1. ตรวจว่าหน้าไหน standalone (มี api เอง) vs โหลด shared.js: `attend.html`, `stock-*.html`
2. ย้ายฝั่งเขียนที่เหลือไป Supabase + เปิด RLS policy ให้แต่ละอัน:
   - `addStockWithdraw` (เบิกของ), `addStockReceive` (รับเข้า), `closeDailyStock` (ปิดร้านสต๊อก)
   - `addStockAudit`, `saveStockItem`, `addStockItem`, `deleteStockItem`, `saveMinStockBatch`
   - `addAttendLog` (เข้างาน), `saveAttendStaff`, `saveAttendBranch`, `markPaid`
3. **LINE notification** ผ่าน Supabase Edge Function (ย้าย token ไปฝั่ง server) → ทำให้บันทึกสิ้นวันส่งเข้ากลุ่มได้อีกครั้ง
4. ข้อมูลอ่อนไหว (sensitive) ทำ owner-passcode + Edge Function: `getPayrollStatus`, `verifyStaffPin`, `getStaffDetail`
5. ระบบล็อกอิน (ทำทีหลังตามที่คุยไว้)

**งานเก็บกวาด:**
- ลบแถว "ทดสอบ" ที่เคยรั่วเข้า V1 production sheet
- ตรวจ schema ตาราง `branches` ว่า map คอลัมน์ตรง (lat/lng/radius) ไหม
- Reset service_role key ที่ Supabase (เคยหลุด)

---

## 📁 ไฟล์สำคัญใน outputs (เผื่อต้องใช้ซ้ำ)
- `sb-data.js` — ตัว Supabase ของ records (ใช้งานจริงแล้ว)
- `Supabase_07_storage_write_expenses.sql`, `Supabase_08_write_sales.sql` — policy เขียน
- `Supabase_01..06` — สร้างตาราง + ย้ายข้อมูล + RLS + view
- ไฟล์นี้ (`PROGRESS_บันทึกความคืบหน้า.md`)

---

## 👤 ข้อมูลเจ้าของ/สไตล์การทำงาน
- เจ้าของชื่อ **Fact** — ทำงานผ่าน **GitHub web UI เท่านั้น** (ไม่ใช้ terminal)
- ทดสอบบน Android Chrome + desktop PWA
- คุยภาษาไทย, ชอบ **แก้ทีละจุด/ก๊อปวางได้ง่าย** มากกว่าเขียนใหม่ทั้งไฟล์
- ระวัง service worker cache ทำให้ไฟล์เก่าค้าง (ทดสอบใน Incognito)
