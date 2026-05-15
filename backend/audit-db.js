const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditDatabase() {
  console.log('--- Database Audit ---');
  
  // 1. เช็คจำนวนบอลสด
  const liveCount = await prisma.match.count({ where: { status: 'Live' } });
  console.log(`Total Live Matches in DB: ${liveCount}`);

  // 2. เช็คเวลาอัปเดตล่าสุด (ว่าข้อมูลสดไหม)
  const latestUpdate = await prisma.match.findFirst({
    where: { status: 'Live' },
    orderBy: { updatedAt: 'desc' }
  });
  console.log(`Latest Match Update: ${latestUpdate ? latestUpdate.updatedAt : 'N/A'}`);

  // 3. ดูประวัติราคาของ 10 คู่ล่าสุดที่อัปเดต
  const sampleMatches = await prisma.match.findMany({
    where: { status: 'Live' },
    take: 10,
    orderBy: { updatedAt: 'desc' },
    include: { 
      odds: { 
        where: { type: 'HDP' },
        include: { history: { take: 5, orderBy: { createdAt: 'desc' } } }
      } 
    }
  });

  console.log('\n--- Recent 10 Matches Status ---');
  sampleMatches.forEach(m => {
    const hdp = m.odds[0];
    const historyCount = hdp ? hdp.history.length : 0;
    const lastPrice = hdp && hdp.history[0] ? hdp.history[0].homeOdds : 'N/A';
    console.log(`Match: ${m.name} | Updated: ${m.updatedAt.toLocaleTimeString()} | History Pts: ${historyCount} | Current Price: ${lastPrice}`);
  });

  await prisma.$disconnect();
}

auditDatabase();
