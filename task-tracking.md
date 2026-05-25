# Football Hunter - Task Tracking

## 📅 สถานะล่าสุด: 25 พฤษภาคม 2026

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
- [x] **Signal Win-Rate Optimization:** ปรับปรุงเกณฑ์คัดกรอง (ลด Noise โดยใช้เกณฑ์ราคาไหล 0.15, เพิ่มการกรองสกอร์ผลห่างประตูไม่เกิน 1, กรองปฏิเสธลีกเยาวชน/ลีกหญิง/กระชับมิตร/ทีมสำรอง)
- [x] **Workflow Sync & Auto-Reset UI:** แก้ไขสถานะการสับสวิตช์ Auto-Bet ออฟไลน์อัตโนมัติเมื่อกดเทสบอท และระบบรีเซ็ต Log พับหน้าต่างเก็บทันทีที่เทสคิวว่าง
- [x] **Multi-Instance Setup Guide:** เขียนคู่มือการย้ายโค้ดไปรันเครื่องใหม่ คู่ขนานแยกบัญชีและแยกฐานข้อมูลสำเร็จ ([setup_guide_new_machine.md](setup_guide_new_machine.md))

### 🚧 งานที่กำลังดำเนินการ (In Progress)
- [ ] **Optimized Parameter Evaluation:** ปล่อยให้บอทรันในเครื่อง Local ด้วยข้อมูลเกณฑ์สแกนใหม่ เพื่อรวบรวมสถิติและเปรียบเทียบอัตรา Win Rate และความเสถียร
- [ ] **Multi-Instance Trial:** ดำเนินการย้ายโปรเจกต์ไปรันอีกหนึ่งเครื่องตามคู่มือ และล็อกอินบัญชีอื่นเพื่อตรวจสอบการทำงานคู่ขนาน

### 📋 คำสั่งที่ใช้บ่อย (Cheat Sheet)

| Terminal | หน้าที่ | คำสั่ง |
| :--- | :--- | :--- |
| **Terminal 1** | Backend (API & Bot) | `cd backend` <br> `npm run dev` |
| **Terminal 2** | Frontend (Web UI) | `cd frontend` <br> `flutter run -d web-server --web-port=8080 --release` |
| **Terminal 3** | ดู Log งานจริง (Real) | `Get-Content bot.log -Wait -Tail 50 -Encoding utf8` |
| **Terminal 4** | ดู Log งานเทส (Test) | `Get-Content testbot.log -Wait -Tail 50 -Encoding utf8` |
| **Emergency** | เคลียร์พอร์ต 3000 | `cd backend` <br> `npm run kill` |
| **VPS Deploy** | Deploy งานขึ้น VPS | `cd backend` <br> `npx ts-node scripts/deploy-vps.ts` |
| **Local Clear DB**| ล้าง DB ทั้งหมดบนเครื่อง | `cd backend` <br> `npx ts-node -r dotenv/config manual-cleanup.ts` |

### 🚀 ก้าวต่อไป (Next Steps)
1. **Performance Evaluation:** วิเคราะห์ผลและ Win Rate หลังรันบอทสแกนเกณฑ์แบบละเอียด เพื่อคำนวณกำไรสะสม
2. **Auto-Restart Strategy:** เขียน Script สำหรับรีสตาร์ทบอทอัตโนมัติหาก Browser ค้าง
3. **VPS Sync:** นำโค้ดที่ปรับปรุงความเสถียรและ Logic สแกนตัวจริงขึ้นสู่ VPS 

---
*หมายเหตุ: ข้อมูลการแก้ไขหลักอยู่ที่ [chat-history.md](chat-history.md) และ [walkthrough.md](walkthrough.md)*
