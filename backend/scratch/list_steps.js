const fs = require('fs');
const content = fs.readFileSync('C:/Users/HP/Desktop/Trading Company Project/backend/scratch/subagent_content.txt', 'utf8');

const regex = /### Step (\d+): (\w+)/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`Step ${match[1]}: ${match[2]}`);
}
