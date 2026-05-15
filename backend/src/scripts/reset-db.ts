import prisma from '../lib/prisma';

async function reset() {
  try {
    console.log('Resetting database...');
    // Order matters due to foreign keys, or use TRUNCATE with CASCADE
    // Note: SQLite doesn't support CASCADE, but this is PostgreSQL
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Bet", "Signal", "OddsHistory", "Odds", "Match", "RealBetLog" CASCADE;');
    console.log('Database reset successful.');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    process.exit(0);
  }
}

reset();
