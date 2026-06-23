const fs = require('fs');
const transcriptPath = 'C:/Users/HP/.gemini/antigravity-ide/brain/cc8633ff-747a-48db-bac6-002954d824bd/.system_generated/logs/transcript.jsonl';
const fileContent = fs.readFileSync(transcriptPath, 'utf8');
const lines = fileContent.trim().split('\n');

for (const line of lines) {
  if (line.includes('"step_index":466')) {
    const obj = JSON.parse(line);
    fs.writeFileSync('C:/Users/HP/Desktop/Trading Company Project/backend/scratch/subagent_content.txt', obj.content);
    console.log('Written to subagent_content.txt');
  }
}
