const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://ubuntu:hunter1234@103.169.67.62:5432/football_hunter',
});

async function checkMatches() {
  try {
    await client.connect();
    
    // Check Live Matches and their last update time
    const resLive = await client.query(`
      SELECT id, name, status, "matchTime", "updatedAt"
      FROM "Match"
      WHERE status = 'Live'
      ORDER BY "updatedAt" ASC
      LIMIT 10
    `);
    console.log('--- Oldest Live Matches ---');
    console.table(resLive.rows);

    // Check Pending Bets
    const resPending = await client.query(`
      SELECT b.id, b.status, b."createdAt", m.name as match_name, m.status as match_status, m."matchTime"
      FROM "Bet" b
      JOIN "Match" m ON b."matchId" = m.id
      WHERE b.status = 'Pending'
      LIMIT 10
    `);
    console.log('\n--- Pending Bets ---');
    console.table(resPending.rows);

    // Total counts
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM "Match" WHERE status = 'Live') as live_matches,
        (SELECT COUNT(*) FROM "Bet" WHERE status = 'Pending') as pending_bets
    `);
    console.log('\nSummary:', counts.rows[0]);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkMatches();
