import prisma from '../lib/prisma';

async function main() {
  console.log("Checking RealBetLog records...");
  const logs = await prisma.realBetLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log("Total RealBetLog records found in DB:", await prisma.realBetLog.count());
  console.log(JSON.stringify(logs, null, 2));

  console.log("\\nChecking Bet records with autoBetStatus = 'Executed'...");
  const executedBets = await prisma.bet.findMany({
    where: { autoBetStatus: 'Executed' },
    include: {
      signal: {
        include: {
          match: true
        }
      }
    },
    take: 3,
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(executedBets, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
