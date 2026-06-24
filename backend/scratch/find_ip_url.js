const fs = require('fs');

async function main() {
  const response = await fetch('https://web.stockslab.live/assets/index-BxE43dCS.js');
  const text = await response.text();
  
  console.log('--- Matches for 51.20.248.9 ---');
  // Find strings around the IP
  const regex = /http[s]?:\/\/51\.20\.248\.9:?[0-9]*/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    console.log(match[0]);
    // Also print context around the match
    const start = Math.max(0, match.index - 50);
    const end = Math.min(text.length, match.index + match[0].length + 50);
    console.log('Context:', text.substring(start, end));
    console.log('----------------');
  }
}

main().catch(console.error);
