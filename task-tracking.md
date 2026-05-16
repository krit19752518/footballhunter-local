# Football Hunter - Task Tracking

## 📅 สถานะล่าสุด: 16 พฤษภาคม 2026

### ✅ งานที่เสร็จแล้ว (Completed)
- [x] **Manual Test Bot Interface:** สร้างหน้าทดสอบแยกต่างหาก พร้อมปุ่ม NEXT STEP / STOP TEST
- [x] **Step-by-Step Control:** ระบบหยุดรอคำสั่งผู้ใช้ในทุกขั้นตอนสำคัญของการแทง
- [x] **Isolated Logging:** แยก `testbot.log` ออกจาก `bot.log` โดยสมบูรณ์
- [x] **Smart Cart Detection:** ปรับปรุงการคลิกตระกร้าด้วย Selector, พิกัด และการลบ Overlay
- [x] **Price Matching Fix:** รองรับราคาควบ (0/0.5, 0.5/1) ในระบบเปรียบเทียบราคา
- [x] **Log Data Formatting:** แสดงชื่อลีก, ฝั่งแทง, และราคาใน Log ให้ก๊อปปี้ไปเทสได้ง่าย

### 🚧 กำลังดำเนินการ (In Progress)
- [/] **Stability Testing:** ทดสอบรันบอทต่อเนื่องเพื่อเช็ค Memory Leak ของ Browser
- [/] **Error Handling Fine-tuning:** ปรับปรุงการจัดการ Error กรณีเว็บโหลดช้าผิดปกติ

### 🚀 ก้าวต่อไป (Next Steps)
1. **VPS Deployment:** เตรียม Config สำหรับการรันบน Ubuntu Server ด้วย PM2
2. **Auto-Restart Strategy:** เขียน Script สำหรับรีสตาร์ทบอทอัตโนมัติหาก Browser ค้าง
3. **Multi-Instance Support:** (Optional) ศึกษาการรันบอทหลาย Browser Context พร้อมกัน

---
*หมายเหตุ: ข้อมูลการแก้ไขหลักอยู่ที่ [chat-history.md](chat-history.md)*
