const fs = require('fs');
const content = fs.readFileSync('C:/Users/HP/Desktop/Trading Company Project/backend/scratch/subagent_content.txt', 'utf8');

// Find all matches for "capture_browser_console_logs" and print 1000 characters after it
let pos = 0;
while ((pos = content.indexOf('capture_browser_console_logs', pos)) !== -1) {
  console.log('=== MATCH AT POSITION:', pos);
  console.log(content.slice(pos, pos + 2000));
  pos += 'capture_browser_console_logs'.length;
}

// Let's also search for "console" or "error" (case insensitive)
let posErr = 0;
while ((posErr = content.toLowerCase().indexOf('error', posErr)) !== -1) {
  console.log('=== ERROR MATCH AT POSITION:', posErr);
  console.log(content.slice(posErr - 100, posErr + 500));
  posErr += 'error'.length;
}
