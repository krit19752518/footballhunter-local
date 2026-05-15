const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://ubuntu:hunter1234@103.169.67.62:5432/football_hunter',
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ DB CONNECTION SUCCESSFUL');
    const res = await client.query('SELECT NOW()');
    console.log('✅ Server time:', res.rows[0].now);
  } catch (err) {
    console.error('❌ DB CONNECTION FAILED:', err.message);
  } finally {
    await client.end();
  }
}

testConnection();
