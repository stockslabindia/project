const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    console.log("Testing gemini-2.5-flash with JSON responseMimeType...");
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });
    const result = await model.generateContent("Respond with a JSON object containing key 'status' with value 'OK'");
    console.log("✅ Success:", result.response.text().trim());
  } catch (err) {
    console.log("❌ Failed:", err.message);
  }
}

run();
