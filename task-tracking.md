# Football Hunter - Task Tracking

## Phase 1: Planning & Architecture

- [ ] Task-101: ออกแบบระบบ (System Architecture), เลือก Tech Stack, ออกแบบ Logic และแบ่ง Tasks การทำงาน

## Phase 2: Backend Development (Data Ingestion & Core API)

- [ ] Task-201: Setup Server & Environment (ติดตั้ง Node.js, PostgreSQL, Redis บน VPS และ Local)
- [ ] Task-202: Project Initialization (Node.js, TypeScript, Express, Prisma ORM) - _[Unit Test: Setup]_
- [ ] Task-203: Database Schema Design (ออกแบบตาราง Match, Odds, Odds History, Signal)
- [ ] Task-204: Implement Data Fetching Service (ดึงข้อมูลจาก API `api.9x5t.com` ด้วย HTTP Request ตาม Payload/Header) - _[Unit Test: Data Fetching/Parsing]_
- [ ] Task-205: Implement State Caching & Comparison (นำข้อมูลใหม่เทียบกับ Redis เพื่อหาอัตราการเปลี่ยนแปลงของราคา หรือ "ราคาไหล") - _[Unit Test: Logic Comparison]_
- [ ] Task-206: Signal Engine (สร้างระบบตรวจสอบเงื่อนไข ถ้าเข้าเงื่อนไขให้บันทึก Signal ลง DB) - _[Unit Test: Signal Rule Engine]_
  - Logic 1: ต่อไหลลงแรง (Strong Favorite Drop)
  - Logic 2: กำแพงขยับ (Line Shift)
  - Logic 3: สูงท้ายเกม (Late Over Goal)
  - Logic 4: บอลรองสวนกลับ (Underdog Value)
  - Logic 5: เตือนภัยราคาหลอก (Fake Drop / Trap)
- [ ] Task-207: Backend API & WebSockets (สร้าง REST API สำหรับดึงประวัติ และ Socket.io สำหรับส่งข้อมูล Real-time ให้ Frontend) - _[Unit Test: API Endpoints]_
- [ ] Task-208: Accuracy Tracking System (สร้าง Logic สำหรับตรวจสอบผลบอลหลังจบเกมเพื่ออัปเดตสถานะความแม่นยำของ Signal Win/Loss)

## Phase 3: Frontend Development (Flutter Web)

- [ ] Task-301: Flutter Project Setup & Base Architecture (กำหนด State Management เช่น Provider/Riverpod และ Routing)
- [ ] Task-302: WebSocket & API Integration (เชื่อมต่อรับข้อมูล Real-time และดึงข้อมูลประวัติจาก Backend)
- [ ] Task-303: Dashboard UI (หน้าแสดงข้อมูลบอลไลฟ์, ไฮไลท์คู่ที่มีการเปลี่ยนแปลงราคาผิดปกติ)
- [ ] Task-304: Signal Alerts UI (หน้าแสดงรายการ Signal พร้อมแจ้งเตือนเมื่อมี Signal ใหม่ให้เข้าแทง)
- [ ] Task-305: Signal Accuracy UI (หน้าแสดงสถิติความแม่นยำของระบบ เพื่อนำข้อมูลไปปรับจูน Logic)

## Phase 4: Deployment & Optimization

- [ ] Task-401: Deploy Backend ไปยัง VPS (103.169.67.62) ด้วย PM2 หรือ Docker
- [ ] Task-402: Deploy Flutter Web Frontend
- [ ] Task-403: Performance Tuning (ปรับแต่ง Database Index, จัดการ Memory Leak)
