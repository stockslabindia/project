require('dotenv').config();
const { pubClient, subClient, redisClient } = require('../src/redis/client');

console.log('redisClient.options.enableOfflineQueue:', redisClient.options.enableOfflineQueue);
console.log('pubClient.options.enableOfflineQueue:', pubClient.options.enableOfflineQueue);
console.log('subClient.options.enableOfflineQueue:', subClient.options.enableOfflineQueue);
process.exit(0);
