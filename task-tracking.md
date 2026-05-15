# Football Hunter - Project Tracking

## Phase 1: Planning & Setup
- [x] Task-101: ออกแบบระบบ (System Architecture)
- [x] Task-102: วิเคราะห์โครงสร้าง API (GetList 1-3, statistical)

### 🟢 สถานะล่าสุด (15 พฤษภาคม 2569 - 21:30)
1. **Full Auto Bet Flow สมบูรณ์ 100%:**
   - ค้นหาลีก/คู่บอล -> เลือกราคา -> เปิดตระกร้า -> **กรอกเงิน 10 บาท (Keypad Mode)** -> กดพนัน -> ปิด Modal -> ย้อนกลับหน้าแรก
   - ระบบมีความเสถียรสูงด้วยการหน่วงเวลา 2 วินาทีในทุกขั้นตอน (Stability Waits)
2. **Robust Navigation & Interaction:**
   - ใช้ระบบ **Coordinate Click (พิกัดพิกเซล)** และ **Symbol ID** สำหรับปุ่มย้อนกลับและปุ่มปิด
   - ระบบ **Auto-Clear Overlays** ลบเลเยอร์ที่บังหน้าจอออกอัตโนมัติก่อนเริ่มคลิกปุ่มสำคัญ
   - ระบบ **Smart Slip Detection** ตรวจจับการเปิดตระกร้าอัตโนมัติ ป้องกันการคลิกซ้ำจนตระกร้าปิด
3. **กำลังพัฒนา (In Progress):**
   - **VPS Deployment:** การรันระบบด้วย PM2 บนเซิร์ฟเวอร์

### 🚀 ก้าวต่อไป:
- ทดสอบรันยาวๆ 24 ชั่วโมงเพื่อดูความนิ่งของ Browser Memory
- เตรียมไฟล์ Config สำหรับ PM2

## Phase 2: Backend Development (Node.js + Prisma)
- [x] Task-201: Setup PostgreSQL บน VPS
- [x] Task-202: Project Initialization (Node.js, TypeScript, Express, Prisma ORM)
- [x] Task-203: Database Schema Design (Match, Odds, OddsHistory, Signal)
- [x] Task-204: Implement Data Fetching Service (Axios + Headers จาก getlist_header.md)
- [x] Task-205: Implement State Caching & Comparison (เปรียบเทียบราคาปัจจุบันกับราคาใน DB)
- [x] Task-206: Signal Engine (สร้างระบบตรวจสอบเงื่อนไข)
  - Logic 1: ต่อไหลแรง (Strong Favorite Drop) - ราคาฝั่งทีมต่อลดลงอย่างรวดเร็ว
  - Logic 2: ขยับกำแพง (Line Shift) - แต้มต่อมีการขยับข้ามระดับ
  - Logic 3: สูงท้ายเกม (Late Over Goal) - ลุ้นประตูสุดท้ายช่วงนาทีที่ 70+
  - Logic 4: รองสวนกระแส (Underdog Value) - ทีมรองที่ราคาดูคุ้มค่ากว่าความเสี่ยง
  - Logic 5: ราคาหลอก (Fake Drop / Trap) - เตือนภัยราคาที่ไหลสวนทางกับสถิติในสนาม
- [x] Task-207: Backend API & WebSockets (Socket.io สำหรับส่งข้อมูล Real-time)
- [x] Task-208: Accuracy Tracking System (ตรวจสอบผลบอลหลังจบเกม)

## Phase 3: Frontend Development (Flutter Web)
- [x] Task-301: Flutter Project Setup & Base Architecture
- [x] Task-302: WebSocket & API Integration
- [x] Task-303: Dashboard UI (หน้าแสดงข้อมูลบอลไลฟ์)
- [x] Task-304: Signal Alerts UI (หน้าแสดงรายการ Signal)
- [x] Task-305: Signal Accuracy UI (หน้าแสดงสถิติความแม่นยำของระบบ)

- [ ] Task-402: Performance Tuning (Redis Cache สำหรับข้อมูลที่ดึงบ่อย)
- [ ] Task-403: Alert System Integration (Line Notify / Telegram Bot)
