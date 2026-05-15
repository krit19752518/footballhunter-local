const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ DB CONNECTION SUCCESSFUL');
    const res = await prisma.$queryRawUnsafe('SELECT 1 as result');
    console.log('✅ Query test:', res);
  } catch (e) {
    console.error('❌ DB CONNECTION FAILED:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
