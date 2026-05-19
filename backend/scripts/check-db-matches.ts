import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import prisma from '../src/lib/prisma';

async function checkMatches() {
  try {
    const totalMatches = await prisma.match.count();
    const liveMatches = await prisma.match.count({ where: { status: 'Live' } });
    const signals = await prisma.signal.count();
    
    console.log('📊 DATABASE STATUS:');
    console.log(`- Total Matches: ${totalMatches}`);
    console.log(`- Live Matches: ${liveMatches}`);
    console.log(`- Total Signals: ${signals}`);

    if (liveMatches > 0) {
      console.log('\n⚽ Sample Live Matches:');
      const samples = await prisma.match.findMany({
        where: { status: 'Live' },
        take: 5
      });
      for (const m of samples) {
        console.log(`  * [ID: ${m.id}] ${m.name} (${m.leagueName})`);
      }
    }
  } catch (err: any) {
    console.error('Error connecting to database:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMatches();
