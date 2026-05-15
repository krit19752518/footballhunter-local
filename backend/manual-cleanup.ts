import prisma from './src/lib/prisma';

async function manualCleanup() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  console.log('Cleaning up matches not updated since:', fifteenMinutesAgo.toISOString());

  const allLive = await prisma.match.findMany({
    where: { status: 'Live' },
    select: { id: true, name: true, updatedAt: true }
  });

  console.log(`Current time: ${new Date().toISOString()}`);
  console.log(`fifteenMinutesAgo: ${fifteenMinutesAgo.toISOString()}`);
  console.log(`Found ${allLive.length} live matches total.`);
  
  allLive.forEach(m => {
    console.log(`${m.id} - ${m.updatedAt.toISOString()} - ${m.name}`);
  });

  const toUpdate = await prisma.match.findMany({
    where: {
      status: 'Live',
      updatedAt: { lt: fifteenMinutesAgo }
    }
  });

  console.log(`Found ${toUpdate.length} matches to clean up.`);

  if (toUpdate.length > 0) {
    const res = await prisma.match.updateMany({
      where: {
        status: 'Live',
        updatedAt: { lt: fifteenMinutesAgo }
      },
      data: {
        status: 'Finished',
        matchTime: 'FT'
      }
    });
    console.log(`Updated ${res.count} matches to Finished.`);
  }
}

manualCleanup();
