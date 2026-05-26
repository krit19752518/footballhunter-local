import prisma from './src/lib/prisma';

async function checkStatus() {
  try {
    const liveMatches = await prisma.match.findMany({
      where: { status: 'Live' }
    });
    
    const signals = await prisma.signal.count();
    const odds = await prisma.odds.count();
    const oddsHistory = await prisma.oddsHistory.count();

    console.log(`Total Live Matches: ${liveMatches.length}`);
    console.log(`Total Odds: ${odds}`);
    console.log(`Total Odds History: ${oddsHistory}`);
    console.log(`Total Signals: ${signals}`);
    
    const timeGroups: Record<string, number> = { '0-15': 0, '16-59': 0, '60-75': 0, '76+': 0 };
    liveMatches.forEach(m => {
      const min = parseInt(m.matchTime || '0');
      if (min <= 15) timeGroups['0-15']++;
      else if (min < 60) timeGroups['16-59']++;
      else if (min <= 75) timeGroups['60-75']++;
      else timeGroups['76+']++;
    });
    
    console.log('Match Times Distribution:');
    console.log(timeGroups);
    
  } catch (e: any) {
    console.log('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
checkStatus();
