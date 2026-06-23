const fs = require('fs');
const content = fs.readFileSync('C:/Users/HP/Desktop/Trading Company Project/backend/scratch/subagent_content.txt', 'utf8');

// Find all occurrences of capture_browser_console_logs in the text
const regex = /capture_browser_console_logs[\s\S]*?"logs":\s*(\[[\s\S]*?\])/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log('--- FOUND LOGS ---');
  try {
    const logs = JSON.parse(match[1]);
    console.log(JSON.stringify(logs, null, 2));
  } catch (e) {
    console.log(match[1].slice(0, 1000));
  }
}
