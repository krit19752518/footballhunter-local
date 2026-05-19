import prisma from '../lib/prisma';

async function main() {
  const bets = await prisma.bet.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { signal: { include: { match: true } } }
  });
  console.log("LAST 10 BETS:");
  bets.forEach((b, idx) => {
    console.log(`${idx+1}. Match: ${b.signal.match.name}`);
    console.log(`   Signal: ${b.signal.message}`);
    console.log(`   Bet Side: ${b.betSide} | Line: ${b.lineAtBet} | Odds: ${b.oddsAtBet}`);
    console.log(`   AutoBet Status: ${b.autoBetStatus} | Error: ${b.autoBetError}`);
    console.log(`   Status: ${b.status} | Net: ${b.netProfit}`);
    console.log(`-----------------------------------------------`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
