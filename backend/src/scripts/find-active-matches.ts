import prisma from '../lib/prisma';

async function main() {
  const liveMatches = await prisma.match.findMany({
    where: { status: 'Live' },
    orderBy: { updatedAt: 'desc' },
    take: 20
  });
  console.log("LIVE MATCHES IN DB:");
  console.log(JSON.stringify(liveMatches, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
