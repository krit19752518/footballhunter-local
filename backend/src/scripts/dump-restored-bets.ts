import prisma from '../lib/prisma';

async function main() {
  console.log("=== CHECKING RESTORED BETS ===");
  const restoredBets = await prisma.bet.findMany({
    where: { signalId: { startsWith: 'sig_restore_' } },
    include: { signal: { include: { match: true } } }
  });
  console.log(JSON.stringify(restoredBets, null, 2));

  console.log("=== CHECKING CURRENT ACTIVE REALBETLOGS ===");
  const realBets = await prisma.realBetLog.findMany({
    where: { status: 'Executed' },
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(realBets, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
