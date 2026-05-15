import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database...');
  
  // ลบข้อมูลโดยไล่จากตารางที่มี Foreign Key ก่อน
  await prisma.bet.deleteMany({});
  await prisma.signal.deleteMany({});
  await prisma.realBetLog.deleteMany({});
  await prisma.oddsHistory.deleteMany({});
  await prisma.odds.deleteMany({});
  await prisma.match.deleteMany({});
  
  console.log('✅ Database cleaned successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error cleaning database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
