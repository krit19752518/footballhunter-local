# แผนการดำเนินงาน (Implementation Plan)
## 1. Live Score Verification (ตรวจสอบสกอร์สดก่อนวางเดิมพัน)
ป้องกันปัญหาสกอร์ขยับก่อนการวางเดิมพันจริงเพื่อแก้ปัญหา "กำไรทิพย์"
- **ระบบหลังบ้าน (Backend):** 
  - บันทึกสกอร์ ณ จังหวะออกสัญญาณลงฟิลด์ `value` ในตาราง `Signal` เช่น `"0-0"`
  - เมื่อบอทเปิดหน้าวางเดิมพันสำเร็จ จะทำการดึงสกอร์สดล่าสุดบนบราวเซอร์ด้วย Playwright มาเปรียบเทียบ
  - หากสกอร์สดเปลี่ยนไปแล้ว (เช่น เป็น `1-0`) บอทจะทำการกดยกเลิกบิลทันที และบันทึกสถานะเป็น `Failed` พร้อมระบุสาเหตุ ป้องกันยอดเงินคงเหลือไม่ตรงกับเว็บจริง
  
## 2. Real-Time Website Balance (ดึงยอดเงินสดคงเหลือจริงในเว็บมาแสดง)
ดึงยอดเครดิตล่าสุดจากบัญชี Bet5688q ของคุณแสดงบนหน้าสรุปผลของบอททันที
- **บอทดึงยอดเงิน (Playwright):** คอยสแกนและดึงยอดเงินจากหน้าบราวเซอร์จริงเมื่อระบบทำงานหรือทุก 30 วินาที
- **สร้าง API:** เปิดช่องทาง `/browser/balance` บน Backend เพื่อเสิร์ฟข้อมูลเงินในกระเป๋าเว็บจริง
- **หน้าจอแดชบอร์ด (Flutter Web):** แสดงยอดเงินคงเหลือจริงในเว็บเป็นสีเหลืองเด่นสง่าในกล่อง **Real Bot** ถัดจากยอดแทงรวม

---

## ขั้นตอนที่ต้องแก้ไขไฟล์ในโปรเจกต์:

### [Backend]
1. **[signal.service.ts](file:///c:/FootballHunter2/backend/src/services/signal.service.ts)**
   - เพิ่มคำสั่งเก็บสกอร์สดเมื่อเกิด Signal ในฟิลด์ `value`
2. **[browser.service.ts](file:///c:/FootballHunter2/backend/src/services/browser.service.ts)**
   - เพิ่มฟังก์ชัน `extractLiveScore` ดึงผลบอลปัจจุบันจากหน้าเว็บ
   - เพิ่มฟังก์ชัน `getActualBalance` ดึงยอดเงินสดสะสมคงเหลือจริงบนหน้าบราวเซอร์
   - ปรับปรุง `executeTask` ให้เปรียบเทียบสกอร์ และแทงยกเลิกเมื่อสกอร์ขยับ
3. **[index.ts](file:///c:/FootballHunter2/backend/src/index.ts)**
   - เพิ่ม GET endpoint `/browser/balance`

### [Frontend (Flutter)]
4. **[api_service.dart](file:///c:/FootballHunter2/frontend/lib/services/api_service.dart)**
   - เพิ่มฟังก์ชัน `getActualBalance` ดึงยอดเงินจาก API หลังบ้าน
5. **[bet_history_screen.dart](file:///c:/FootballHunter2/frontend/lib/screens/bet_history_screen.dart)**
   - ดึงข้อมูลเงินสดสดใหม่แสดงคู่กับยอดเดิมพันและแสดงสถิติกำไรขาดทุนจริงในเว็บ
