# 🚀 คำสั่งด่วน Football Hunter 2

## 📌 วิธีใช้

### 1️⃣ รัน Backend Server
```powershell
.\run-backend.ps1
```
- รันเซิร์ฟเวอร์บ็อท API บน Port 3000
- พิมพ์เอาท์พุตเป็นภาษาไทยได้เต็ม

### 2️⃣ รัน Frontend Server
```powershell
.\run-frontend.ps1
```
- รันเฟรมเวิร์ก Flutter Web บน Port 8080
- เข้าดู: http://localhost:8080

### 3️⃣ ดู Log Test Bot (Real-time)
```powershell
.\view-testbot-log.ps1
```
- ดูบันทึกการทดลอง (testbot.log)
- อัปเดตแบบ Real-time
- กดปุ่ม `CTRL+C` เพื่อหยุด

### 4️⃣ ดู Log Bot จริง (Real-time)
```powershell
.\view-real-bot-log.ps1
```
- ดูบันทึกการแทงจริง (bot.log)
- อัปเดตแบบ Real-time
- กดปุ่ม `CTRL+C` เพื่อหยุด

### 5️⃣ รัน Terminal ทั้ง 3 หน้าต่างพร้อมกัน
```powershell
.\run-all-terminals.ps1
```
- เปิด Backend, Frontend, และ Log Test Bot พร้อมกัน
- ถ้าปรากฏ Error เรื่อง PowerShell Policy ให้รัน:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

## 🔧 คำสั่งเพิ่มเติมใน Backend

```bash
# ไปที่ backend folder
cd backend

# รัน backend ด้วย npm
npm run dev

# ล้างพอร์ต 3000 (ถ้าค้าง)
npm run kill

# ดู log test bot
npm run log:test

# ดู log bot จริง
npm run log:real

# รัน test
npm test

# Build TypeScript
npm run build
```

---

## 📱 Frontend Commands

```bash
# ไปที่ frontend folder
cd frontend

# Build web version
flutter build web

# รัน dev server
flutter web-server

# Clean build
flutter clean
flutter pub get
flutter build web
```

---

## 💡 แนวทางการทำงาน

| Terminal | คำสั่ง | ที่ตั้ง |
|:---:|:---|:---|
| **Terminal 1** | `.\run-backend.ps1` | `Port 3000` |
| **Terminal 2** | `.\run-frontend.ps1` | `Port 8080` |
| **Terminal 3** | `.\view-testbot-log.ps1` | `testbot.log` |
| **Terminal 4** | `.\view-real-bot-log.ps1` | `bot.log` |
| **Emergency** | `cd backend && npm run kill` | ล้างพอร์ต |

---

## ⚙️ ตรวจสอบโครงสร้าง

```
footballhunter2/
├── backend/              ← TypeScript/Node.js
│   ├── src/
│   ├── scripts/
│   ├── prisma/
│   └── package.json
├── frontend/             ← Flutter Web
│   ├── lib/
│   ├── build/web/
│   └── pubspec.yaml
├── run-backend.ps1       ← รัน Backend
├── run-frontend.ps1      ← รัน Frontend
├── view-testbot-log.ps1  ← ดู Log Test
├── view-real-bot-log.ps1 ← ดู Log Real
├── run-all-terminals.ps1 ← รัน ทั้งหมด
└── QUICK-COMMANDS.md     ← ไฟล์นี้
```

---

## 🐛 แก้ไขปัญหา

### ❌ PowerShell เพื่อให้รัน script ไม่ได้

```powershell
# ให้สิทธิ์ให้รัน PowerShell scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ ไฟล์ log ไม่ปรากฏ

- ตรวจสอบว่า Backend รันอยู่แล้ว
- ตรวจสอบว่าไฟล์อยู่ใน: `d:\FootballHunter2\footballhunter2\`

### ❌ Port 3000 หรือ 8080 ค้าง

```powershell
# ล้างพอร์ต
cd backend
npm run kill
```

---

## 📚 อ่านเพิ่มเติม

- [task-tracking.md](task-tracking.md) - สถานะงาน
- [chat-history.md](chat-history.md) - ประวัติการพัฒนา
- [knowledge-footballhunter.md](knowledge-footballhunter.md) - เอกสารระบบ

---

**สร้างเมื่อ:** 23 พฤษภาคม 2026
**ตัวอักษร:** UTF-8 (รองรับภาษาไทย)
