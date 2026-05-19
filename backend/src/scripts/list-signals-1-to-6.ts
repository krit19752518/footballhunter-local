import prisma from '../lib/prisma';

async function main() {
  const signals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { match: true }
  });
  console.log("LAST 6 SIGNALS:");
  signals.forEach((sig, idx) => {
    console.log(`${idx+1}. Match: ${sig.match.name} | League: ${sig.match.leagueName}`);
    console.log(`   Signal ID: ${sig.id}`);
    console.log(`   Logic: ${sig.logicType} | Msg: ${sig.message}`);
    console.log(`   Created At: ${sig.createdAt.toISOString()}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
