# Football Hunter - Task Tracking

## 📅 สถานะล่าสุด: 19 พฤษภาคม 2026

### ✅ งานที่เสร็จแล้ว (Completed)
- [x] **Full-Auto Betting Flow:** ระบบรันต่อเนื่องจนจบงาน และปิดหน้าต่าง Success อัตโนมัติ
- [x] **Keyboard/Keypad Fix:** แก้ไขการกรอกตัวเลข 1, 0 ให้เสถียร 100%
- [x] **Side-Aware Matching:** บอทเลือกฝั่ง Home/Away ได้ถูกต้องแม่นยำขึ้น
- [x] **Isolated Logging:** แยก `testbot.log` ออกจาก `bot.log` โดยสมบูรณ์
- [x] **Port Management Script:** เพิ่ม `npm run kill` เพื่อแก้ปัญหาพอร์ต 3000 ค้าง
- [x] **VPS Deployment & Setup:** รันบอทจริงด้วย PM2 บน Ubuntu VPS เรียบร้อย
- [x] **Active Bets DB Restoration:** กู้คืนข้อมูลการแทงล่าสุดเข้าระบบเรียบร้อย ชนะรวดทั้ง 3 คู่ยอดกำไรเข้ากระเป๋าจริง
- [x] **Score-Parsing Match Clock Exclusion Guard:** กรองโคลอน `:` และบังคับเพิกเฉยสกอร์ > 15 ประตู แก้ปัญหาบอทหลุดแทงได้ 100%
- [x] **Trend-Following Logic Upgrade (HDP Follow-Trend):** เปลี่ยนบอทเป็นโหมด "แทงตามกระแสสัญญาณ" บนระบบจริงบน VPS แล้ว

### 🚧 งานที่กำลังดำเนินการ (In Progress)
- [ ] **24-Hour Trend-Following Trial:** ปล่อยให้บอทรันในโหมดแทงตามน้ำเป็นเวลา 1 วันเพื่อวัดผล Win Rate เปรียบเทียบ
- [ ] **Stress Testing:** ทดสอบรันคิวงานต่อเนื่อง 10+ รายการเพื่อเช็คความเสถียรของ Browser (ดำเนินต่อเนื่อง)

### 📋 คำสั่งที่ใช้บ่อย (Cheat Sheet)

| Terminal | หน้าที่ | คำสั่ง |
| :--- | :--- | :--- |
| **Terminal 1** | Backend (API & Bot) | `cd backend` <br> `npm run dev` |
| **Terminal 2** | Frontend (Web UI) | `cd frontend` <br> `npx http-server build/web -p 8080 -c-1` |
| **Terminal 3** | ดู Log งานจริง (Real) | `Get-Content bot.log -Wait -Tail 50 -Encoding utf8` |
| **Terminal 4** | ดู Log งานเทส (Test) | `Get-Content testbot.log -Wait -Tail 50 -Encoding utf8` |
| **Emergency** | เคลียร์พอร์ต 3000 | `cd backend` <br> `npm run kill` |
| **VPS Deploy** | Deploy งานขึ้น VPS | `cd backend` <br> `npx ts-node scripts/deploy-vps.ts` |
| **VPS DB Status**| เช็คยอดแทงกู้คืนบน VPS| `cd backend` <br> `npx ts-node scripts/query-vps-status.ts` |

### 🚀 ก้าวต่อไป (Next Steps)
1. **Performance Evaluation:** สรุปผลวิจัยและอัตราทำกำไรหลังรันครบ 1 วันเพื่อปรับแต่งเกณฑ์ตรวจจับเพิ่มเติม
2. **Auto-Restart Strategy:** เขียน Script สำหรับรีสตาร์ทบอทอัตโนมัติหาก Browser ค้าง

---
*หมายเหตุ: ข้อมูลการแก้ไขหลักอยู่ที่ [chat-history.md](chat-history.md) และ [walkthrough.md](walkthrough.md)*
