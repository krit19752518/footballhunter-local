import prisma from '../lib/prisma';

async function main() {
  const restoredBets = await prisma.bet.findMany({
    where: { signalId: { in: ['cmpbfbal903nqpoxslcife6nf', 'cmpbfas7w03fheazrr39m01ej', 'cmpbfsmoe06bhpoxss3kj9c7u'] } },
    include: { signal: { include: { match: true } } }
  });
  console.log("=== STATUS OF RESTORED BETS ===");
  restoredBets.forEach(b => {
    console.log(`Match: ${b.signal.match.name}`);
    console.log(`  Side: ${b.betSide} | Status: ${b.status} | Net: ${b.netProfit}`);
    console.log(`  Match status: ${b.signal.match.status} | Time: ${b.signal.match.matchTime}`);
    console.log(`  Score: ${b.signal.match.scoreHome}-${b.signal.match.scoreAway}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
