import prisma from '../lib/prisma';

async function main() {
  console.log("=== SCANNING FOR TARGET MATCHES ===");
  const targetIds = [4666277, 4666278, 4666286];
  const matches = await prisma.match.findMany({
    where: { id: { in: targetIds } },
    include: { signals: true }
  });

  for (const m of matches) {
    console.log(`Match ID: ${m.id} | ${m.name}`);
    console.log(`  League: ${m.leagueName}`);
    console.log(`  Signals count: ${m.signals.length}`);
    for (const s of m.signals) {
      console.log(`    Signal ID: ${s.id}`);
      console.log(`    Logic: ${s.logicType}`);
      console.log(`    Msg: ${s.message}`);
      console.log(`    Value: ${s.value}`);
      console.log(`    Created: ${s.createdAt.toISOString()}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
