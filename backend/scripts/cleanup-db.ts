
import prisma from '../src/lib/prisma';

async function main() {
  console.log('🧹 Starting Database Cleanup (Hardcoded URL)...');
  
  try {
    const deletedBet = await prisma.bet.deleteMany();
    console.log(`- Deleted ${deletedBet.count} records from Bet`);

    const deletedRealBetLog = await prisma.realBetLog.deleteMany();
    console.log(`- Deleted ${deletedRealBetLog.count} records from RealBetLog`);

    const deletedSignal = await prisma.signal.deleteMany();
    console.log(`- Deleted ${deletedSignal.count} records from Signal`);

    const deletedOddsHistory = await prisma.oddsHistory.deleteMany();
    console.log(`- Deleted ${deletedOddsHistory.count} records from OddsHistory`);

    const deletedOdds = await prisma.odds.deleteMany();
    console.log(`- Deleted ${deletedOdds.count} records from Odds`);

    const deletedMatch = await prisma.match.deleteMany();
    console.log(`- Deleted ${deletedMatch.count} records from Match`);

    console.log('✅ Remote Database is now clean!');
  } catch (err: any) {
    console.error('❌ Cleanup Failed:', err.message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
