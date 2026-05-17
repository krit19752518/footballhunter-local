const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://ubuntu:hunter1234@103.169.67.62:5432/football_hunter',
});

async function cleanDb() {
  try {
    await client.connect();
    
    // Check row counts
    const tables = ['Match', 'Odds', 'OddsHistory', 'Signal', 'Bet', 'RealBetLog'];
    let totalRows = 0;
    
    console.log('--- Checking existing data ---');
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
        const count = parseInt(res.rows[0].count, 10);
        console.log(`Table ${table}: ${count} rows`);
        totalRows += count;
      } catch (err) {
        console.log(`Table ${table}: Error checking or table doesn't exist`);
      }
    }
    
    if (totalRows > 0) {
      console.log('\n--- Data found, proceeding to clear the database ---');
      // Truncate tables with CASCADE to handle foreign keys
      await client.query(`TRUNCATE TABLE "Bet", "Signal", "OddsHistory", "Odds", "Match", "RealBetLog" CASCADE`);
      console.log('✅ All data has been successfully deleted.');
    } else {
      console.log('\n✅ Database is already empty. No data to delete.');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

cleanDb();
