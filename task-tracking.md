# Football Hunter - Task Tracking

## 📅 สถานะล่าสุด: 19 พฤษภาคม 2026

### ✅ งานที่เสร็จแล้ว (Completed)
- [x] **Local PostgreSQL & Playwright Setup:** เชื่อมต่อฐานข้อมูลท้องถิ่นและติดตั้งเบราว์เซอร์ Chromium สำเร็จ 100%
- [x] **Full-Auto Betting Flow:** ระบบรันต่อเนื่องจนจบงาน และปิดหน้าต่าง Success อัตโนมัติ
- [x] **Keyboard/Keypad Fix:** แก้ไขการกรอกตัวเลข 1, 0 ให้เสถียร 100%
- [x] **Side-Aware Matching:** บอทเลือกฝั่ง Home/Away ได้ถูกต้องแม่นยำขึ้น
- [x] **Isolated Logging:** แยก `testbot.log` ออกจาก `bot.log` โดยสมบูรณ์
- [x] **Port Management Script:** เพิ่ม `npm run kill` เพื่อแก้ปัญหาพอร์ต 3000 ค้าง
- [x] **Live-Score Verification:** ตรวจจับสกอร์สดและยกเลิกเดิมพันหากสกอร์เปลี่ยน (กันสกอร์ไหล)
- [x] **Real Balance Sync:** ดึงยอดเงินจริงจากเว็บมาแสดงแบบ Real-time พร้อม Auto-refresh หน้า UI 30 วินาที
- [x] **Odds Parsing & Calculation Fix:** แก้ไขการคำนวณราคา Decimal Odds สำหรับบิลที่ชนะ 
- [x] **502 Bad Gateway Handling:** เพิ่มการจัดการ Error 502 จาก External API
- [x] **Safe Betslip Overlay:** นำโค้ดลบ Overlay ของ Betslip ที่ทำให้เกิดปัญหาออกระหว่าง Live Betting
- [x] **Frontend Filters:** กรองรายการ Draw/Void ออกจากช่อง "รอลุ้น" ให้ตรงกับหน้าเว็บจริง

### 🚧 งานที่กำลังดำเนินการ (In Progress)
- [ ] **Stress Testing:** ทดสอบรันคิวงานต่อเนื่อง 10+ รายการเพื่อเช็คความเสถียรของ Browser
- [ ] **Odds Change Handling:** ปรับปรุงระบบให้ข้ามงานทันทีถ้าราคาเปลี่ยนขณะกำลังจะกดแทง (ส่วนของอัตราต่อรอง)

### 📋 คำสั่งที่ใช้บ่อย (Cheat Sheet)

| Terminal | หน้าที่ | คำสั่ง |
| :--- | :--- | :--- |
| **Terminal 1** | Backend (API & Bot) | `cd backend` <br> `npm run dev` |
| **Terminal 2** | Frontend (Web UI) | `cd frontend` <br> `npx http-server build/web -p 8080 -c-1` |
| **Terminal 3** | ดู Log งานจริง (Real) | `cd backend` <br> `npm run log:real` |
| **Terminal 4** | ดู Log งานเทส (Test) | `cd backend` <br> `npm run log:test` |
| **Emergency** | เคลียร์พอร์ต 3000 | `cd backend` <br> `npm run kill` |

### 🚀 ก้าวต่อไป (Next Steps)
1. **VPS Deployment:** นำสคริปต์ `start-pm2.ts` และสคริปต์จัดการ VPS (เช่น DB Cleanup Tools) ไปใช้งานจริงบน Ubuntu Server
2. **Auto-Restart Strategy:** เขียน Script สำหรับรีสตาร์ทบอทอัตโนมัติหาก Browser ค้าง

---
*หมายเหตุ: ข้อมูลการแก้ไขหลักอยู่ที่ [chat-history.md](chat-history.md)*
