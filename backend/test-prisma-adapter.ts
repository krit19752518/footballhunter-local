import prisma from './src/lib/prisma';

async function main() {
  try {
    console.log('Testing Prisma with Adapter...');
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('✅ Connection Successful:', result);
    
    const matchCount = await prisma.match.count();
    console.log('✅ Match count:', matchCount);
  } catch (error) {
    console.error('❌ Connection Failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit();
  }
}

main();
