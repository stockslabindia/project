const { Telegraf } = require('telegraf');
const bot = new Telegraf('123:abc');
const cb = bot.webhookCallback('/foo');

const req = { url: '/foo', method: 'POST', body: {} };
const res = { end: () => console.log('ended'), statusCode: 200, setHeader: () => {} };

cb(req, res);
console.log('done');
