require('dotenv').config();
const { redisClient } = require('../src/redis/client');

async function run() {
  console.log('Connecting to Redis...');
  const keysBefore = await redisClient.keys('instruments:*');
  console.log('Keys before:', keysBefore);
  
  const res = await redisClient.del('instruments:active_list');
  console.log('Deleted instruments:active_list:', res);
  
  const keysAfter = await redisClient.keys('instruments:*');
  console.log('Keys after:', keysAfter);
  
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
