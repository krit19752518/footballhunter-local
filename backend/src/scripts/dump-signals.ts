import prisma from '../lib/prisma';

async function main() {
  const signals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: { match: true }
  });
  console.log(JSON.stringify(signals, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
