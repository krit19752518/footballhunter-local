import prisma from '../lib/prisma';

async function main() {
  const count = await prisma.realBetLog.count();
  console.log(`Total RealBetLog records in DB: ${count}`);
  const records = await prisma.realBetLog.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(records, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
