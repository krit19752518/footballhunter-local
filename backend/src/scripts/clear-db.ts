import prisma from '../lib/prisma';
import 'dotenv/config';

async function main() {
  console.log('🧹 กำลังเริ่มล้างข้อมูลแบบถอนรากถอนโคน (Truncate Cascade)...');
  
  try {
    // ใช้คำสั่ง SQL Native ของ Postgres เพื่อล้างตารางทั้งหมดและตารางที่เกี่ยวข้อง (CASCADE)
    // การใช้ TRUNCATE จะเร็วกว่า deleteMany และ CASCADE จะช่วยเคลียร์ FK ให้โดยอัตโนมัติ
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "Match", "Odds", "OddsHistory", "Signal", "Bet", "RealBetLog" 
      RESTART IDENTITY CASCADE;
    `);
    
    console.log('✅ ล้างฐานข้อมูลสำเร็จ!');
  } catch (e) {
    console.error('❌ เกิดข้อผิดพลาดขณะล้างฐานข้อมูล:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();