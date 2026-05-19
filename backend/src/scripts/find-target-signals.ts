import prisma from '../lib/prisma';

async function main() {
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { name: { contains: 'Akatemia', mode: 'insensitive' } },
        { name: { contains: 'พุซซ่า', mode: 'insensitive' } },
        { name: { contains: 'Niepolomice', mode: 'insensitive' } },
        { name: { contains: 'เบโร', mode: 'insensitive' } },
        { name: { contains: 'LKS', mode: 'insensitive' } },
        { name: { contains: 'SJK', mode: 'insensitive' } }
      ]
    },
    include: {
      signals: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  console.log("MATCHES & SIGNALS FOUND:");
  console.log(JSON.stringify(matches, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
