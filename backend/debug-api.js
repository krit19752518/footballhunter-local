const { ApiService } = require('./dist/services/api.service');

async function debugApi() {
  console.log('Fetching matches...');
  const data = await ApiService.fetchMatches();
  if (data.success && data.data.records && data.data.records.length > 0) {
    console.log('Fetched', data.data.records.length, 'records.');
    // Find a record that has 'mg' (odds)
    const recordWithOdds = data.data.records.find(r => r.mg && r.mg.length > 0);
    if (recordWithOdds) {
      console.log('\nFound record with mg (odds):', recordWithOdds.name);
      console.log('mg field:', JSON.stringify(recordWithOdds.mg, null, 2).substring(0, 1000));
    } else {
      console.log('\nNO records have the "mg" field! Looking at the first record:');
      console.log(JSON.stringify(data.data.records[0], null, 2).substring(0, 1000));
    }
  } else {
    console.log('Failed or empty', data);
  }
}

debugApi();
