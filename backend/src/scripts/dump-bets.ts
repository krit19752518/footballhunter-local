import prisma from '../lib/prisma';

async function main() {
  const bets = await prisma.bet.findMany({
    orderBy: { createdAt: 'desc' },
    include: { signal: { include: { match: true } } }
  });
  console.log(`Total Bet records: ${bets.length}`);
  console.log(JSON.stringify(bets, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
