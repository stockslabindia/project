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

/**
 * Generates a helpful chatbot response for support chats.
 * @param {Array<{sender_type: string, message: string}>} history 
 * @param {string} userMessage 
 * @returns {Promise<string>} Gemini's response
 */
const generateResponse = async (history, userMessage) => {
  if (!genAI) {
    return "I'm sorry, my AI support features are offline. Please click the 'Connect to Agent' button to speak with a human support representative.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Format conversation history
    const formattedHistory = (history || []).map(msg => {
      const role = msg.sender_type === 'user' ? 'Customer' : msg.sender_type === 'bot' ? 'AI Assistant' : 'Human Agent';
      return `${role}: ${msg.message}`;
    }).join('\n');

    const prompt = `
You are the official AI Support Assistant for StocksLab India, a premier trading and investment platform.
Your goal is to help users with their questions professionally, concisely, and politely.

Platform Information:
- Users can deposit funds using UPI, NEFT, IMPS, or bank transfer (Profile -> Funds & Withdrawals -> Deposit).
- Users can withdraw funds (Profile -> Funds & Withdrawals -> Withdraw). Withdrawals are processed within 24 hours.
- KYC is mandatory for trading. Users can submit KYC in the Profile section.
- If users have issues with specific deposits/withdrawals, tell them to check their status or connect to a live agent.

Guidelines:
- Keep responses friendly but very brief.
- Use clear bullet points or short paragraphs where appropriate.
- If the user asks to speak to a human or needs live agent assistance, politely guide them to click the "Transfer to Live Agent" button at the top/bottom of the chat screen.
- Do not make up balance amounts or transactions. Tell them to check their dashboard or connect to an agent.

Conversation History:
${formattedHistory}
Customer: ${userMessage}

AI Assistant:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('[AI] Chatbot response generation failed:', err);
    return "I'm having trouble processing that right now. Please try again or click 'Connect to Agent' to reach our support team.";
  }
};

module.exports = {
  analyzeSentiment,
  generateResponse
};

