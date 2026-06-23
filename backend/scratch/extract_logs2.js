const fs = require('fs');

const transcriptPath = 'C:/Users/HP/.gemini/antigravity-ide/brain/cc8633ff-747a-48db-bac6-002954d824bd/.system_generated/logs/transcript.jsonl';
const fileContent = fs.readFileSync(transcriptPath, 'utf8');
const lines = fileContent.trim().split('\n');

for (const line of lines) {
  if (line.includes('"step_index":466')) {
    const obj = JSON.parse(line);
    // Find all occurrences of capture_browser_console_logs in the actions
    const content = obj.content;
    console.log('--- FOUND SUBAGENT RESPONSE CONTENT LENGTH:', content.length);
    // Let's search for "capture_browser_console_logs" inside content
    const subLines = content.split('\n');
    let printing = false;
    let count = 0;
    for (let i = 0; i < subLines.length; i++) {
      if (subLines[i].includes('capture_browser_console_logs')) {
        console.log(`\n=== Found capture_browser_console_logs at action line ${i} ===`);
        printing = true;
        count = 0;
      }
      if (printing) {
        console.log(subLines[i]);
        count++;
        if (count > 25) {
          printing = false;
          console.log('...truncated...');
        }
      }
    }
  }
}
