const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('[AI] Warning: GEMINI_API_KEY is not set. AI features are disabled.');
}

/**
 * Analyzes the sentiment of a support message to detect anger or frustration.
 * @param {string} text 
 * @returns {Promise<boolean>} true if high priority (angry), false otherwise.
 */
const analyzeSentiment = async (text) => {
  if (!genAI) return false;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
      Analyze the following customer support message.
      Determine if the customer is extremely angry, frustrated, threatening, or complaining about a critical failure (like missing money).
      Respond with exactly one word: "YES" if it is high priority, or "NO" if it is a normal question or mild frustration.

      Message: "${text}"
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim().toUpperCase();

    return responseText === 'YES';
  } catch (err) {
    console.error('[AI] Sentiment analysis failed:', err);
    return false; // Default to normal priority on error
  }
};

module.exports = {
  analyzeSentiment
};
