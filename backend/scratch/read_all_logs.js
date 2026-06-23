const fs = require('fs');
const transcriptPath = 'C:/Users/HP/.gemini/antigravity-ide/brain/cc8633ff-747a-48db-bac6-002954d824bd/.system_generated/logs/transcript.jsonl';
const fileContent = fs.readFileSync(transcriptPath, 'utf8');
const lines = fileContent.trim().split('\n');

for (let idx = 0; idx < lines.length; idx++) {
  const line = lines[idx];
  if (line.includes('capture_browser_console_logs')) {
    console.log(`\n=== Found capture_browser_console_logs call at line ${idx} ===`);
    // Let's parse this line
    try {
      const obj = JSON.parse(line);
      console.log('Tool call arguments:', JSON.stringify(obj.tool_calls || obj.arguments || obj, null, 2).slice(0, 500));
    } catch(e) {}
    
    // The next few lines should contain the execution result
    for (let j = 1; j <= 5; j++) {
      if (idx + j < lines.length) {
        const nextLine = lines[idx + j];
        try {
          const nextObj = JSON.parse(nextLine);
          if (nextObj.source === 'SYSTEM' || nextObj.type === 'CAPTURE_BROWSER_CONSOLE_LOGS' || nextObj.content) {
            console.log(`Result (offset +${j}):`, nextObj.content ? nextObj.content.slice(0, 2000) : nextObj);
            break;
          }
        } catch(e) {}
      }
    }
  }
}
