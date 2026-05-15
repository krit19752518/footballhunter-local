const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCurrentSignals() {
  console.log('--- Manual Signal Check ---');
  const matches = await prisma.match.findMany({
    where: { status: 'Live' },
    include: { 
      odds: { 
        where: { type: 'HDP' },
        include: { 
          history: { orderBy: { createdAt: 'desc' }, take: 20 } 
        } 
      } 
    }
  });

  console.log(`Checking ${matches.length} live matches...`);
  
  const candidates = [];

  for (const match of matches) {
    for (const odds of match.odds) {
      const history = odds.history;
      if (history.length < 2) continue;

      const current = history[0];
      const oldest = history[history.length - 1];
      const diff = (oldest.homeOdds || 0) - (current.homeOdds || 0);

      if (Math.abs(diff) > 0.01) {
        candidates.push({
          match: match.name,
          time: match.matchTime,
          line: odds.line,
          oldOdds: oldest.homeOdds,
          newOdds: current.homeOdds,
          diff: diff.toFixed(3),
          historyPoints: history.length
        });
      }
    }
  }

  // เรียงลำดับตามตัวที่ไหลแรงที่สุด
  candidates.sort((a, b) => b.diff - a.diff);

  console.table(candidates.slice(0, 15));
  
  if (candidates.length === 0) {
    console.log('No matches with price movement found in history.');
  }

  await prisma.$disconnect();
}

checkCurrentSignals();
