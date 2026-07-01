require('dotenv').config();
const { getFeedStatus } = require('../src/ws/priceEngine');

// Wait for database connection to be established or just wait a bit
setTimeout(() => {
  console.log(JSON.stringify(getFeedStatus(), null, 2));
  process.exit(0);
}, 2000);
