const fs = require('fs');

async function main() {
  const response = await fetch('https://web.stockslab.live/assets/index-BxE43dCS.js');
  const text = await response.text();
  
  console.log('--- All URLs in live JS bundle ---');
  // Match http/https and ws/wss URLs
  const regex = /(https?|wss?):\/\/[^\s'\"\`]+/g;
  const matches = text.match(regex) || [];
  const uniqueMatches = Array.from(new Set(matches));
  uniqueMatches.forEach(url => console.log(url));
}

main().catch(console.error);
