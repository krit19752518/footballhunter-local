# Football Hunter - Project Tracking

## Phase 1: Planning & Setup
- [x] Task-101: ออกแบบระบบ (System Architecture)
- [x] Task-102: วิเคราะห์โครงสร้าง API (GetList 1-3, statistical)

### 🟢 สถานะล่าสุด (15 พฤษภาคม 2569)
1. **Auto-Bot (Semi-Auto Mode) สมบูรณ์:**
   - ค้นหาลีกและคู่บอลอัตโนมัติ
   - แยก Section (ครึ่งแรก/เต็มเวลา) ได้แม่นยำ
   - คลิกเลือกราคา (Odds) ตรงตาม Signal
   - คลิกเปิดตะกร้า (Bet Slip) อัตโนมัติ
   - ระบบ **Auto-Pause** หยุดตัวเองหลังเปิดตะกร้าเพื่อความปลอดภัย
2. **ปรับจูนความแม่นยำ:**
   - ใช้ Text-Based Search แทน Class Name เพื่อความเสถียร
   - เพิ่มระบบ Retry เมื่อโหลดหน้าเว็บช้า
3. **โครงสร้างโค้ด:**
   - แก้ไข Bug คิวซ้อน (Queue Interval)
   - รองรับภาษาไทยใน Log เต็มรูปแบบ (UTF-8)

### 🚀 ก้าวต่อไป:
- เริ่มทดสอบความแม่นยำในการเลือกราคาจากหลายๆ ลีก
- พัฒนาต่อในส่วนการกรอกจำนวนเงินและยืนยันการแทง (Full Auto)

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
