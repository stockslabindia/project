const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('[AI] Warning: GEMINI_API_KEY is not set. AI features are disabled.');
}

// ── Agent Persona ─────────────────────────────────────────────────────────────
const AGENT_NAME = process.env.AI_AGENT_NAME || 'Riya';

/**
 * Analyzes the sentiment of a support message to detect anger or frustration.
 * @param {string} text
 * @returns {Promise<boolean>} true if high priority (angry), false otherwise.
 */
const analyzeSentiment = async (text) => {
  if (!genAI) return false;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
    return false;
  }
};

/**
 * Generates a human-persona support response as "Riya from StocksLab".
 * Riya acts like a real human agent — she never reveals she is an AI unless 
 * directly asked. Returns a structured object with the reply and whether the
 * query needs escalation to the admin.
 *
 * @param {Array<{sender_type: string, message: string}>} history  - Recent chat messages
 * @param {string} userMessage                                       - The latest user message
 * @returns {Promise<{ reply: string, shouldEscalate: boolean }>}
 */
const generateAgentResponse = async (history, userMessage) => {
  if (!genAI) {
    return {
      reply: `Hi! I'm ${AGENT_NAME} from StocksLab Support. I'm having a bit of trouble right now — please hold on while I look into this for you. 🙏`,
      shouldEscalate: true,
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const formattedHistory = (history || []).map(msg => {
      if (msg.sender_type === 'user') return `Customer: ${msg.message}`;
      if (msg.sender_type === 'bot')  return `${AGENT_NAME}: ${msg.message}`;
      if (msg.sender_type === 'agent') return `${AGENT_NAME}: ${msg.message}`;
      return null;
    }).filter(Boolean).join('\n');

    const prompt = `
You are ${AGENT_NAME}, a professional and friendly human customer support executive at StocksLab India — a premier online trading and investment platform in India.

IMPORTANT RULES:
- You ARE a real human support agent. Never say you are an AI, chatbot, or virtual assistant.
- If a customer asks "are you a bot?" or "are you human?", respond naturally like "Yes, I'm ${AGENT_NAME}, your dedicated support executive!"
- Be warm, empathetic, concise, and professional. Use "I" naturally.
- Do NOT make up any account-specific information (balances, transaction IDs, amounts, dates).
- If a customer asks about a SPECIFIC transaction, withdrawal status, missing deposit, account block, PAN/KYC verification status, or any issue that requires checking their actual account data — you MUST escalate.

ESCALATION TRIGGERS (set shouldEscalate: true when any of these apply):
- "where is my money", "my deposit not showing", "my withdrawal not received"
- Specific amounts, transaction IDs, or dates related to a problem
- "my account is blocked", "login issue", "KYC rejected", "can't trade"
- Requests for manual refund, reversal, or override
- Anything you cannot resolve with general information

Platform Information (you CAN answer these without escalating):
- Deposit methods: UPI, NEFT, IMPS, bank transfer (Profile → Funds & Withdrawals → Deposit)
- Withdrawals processed within 24 working hours (Profile → Funds & Withdrawals → Withdraw)
- KYC is mandatory for trading (Profile → KYC Documents)
- General trading questions, platform navigation, FAQs

RESPONSE FORMAT — reply with valid JSON only, no markdown:
{
  "reply": "Your message to the customer here",
  "shouldEscalate": false
}

If shouldEscalate is true, set reply to a warm holding message like:
"Please hold on a moment! Let me pull up your account details and check this for you. I'll be right back! 🙏"

Conversation so far:
${formattedHistory}
Customer: ${userMessage}
${AGENT_NAME}:`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Parse JSON — strip markdown fences if Gemini wraps it
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      reply: parsed.reply || `Hi! I'm looking into this for you, please hold on. 🙏`,
      shouldEscalate: parsed.shouldEscalate === true,
    };
  } catch (err) {
    console.error('[AI] generateAgentResponse failed:', err);
    // On parse/API error, be safe — send a hold message and escalate
    return {
      reply: `Hi! I'm ${AGENT_NAME}. I'm looking into your query — please give me just a moment! 🙏`,
      shouldEscalate: true,
    };
  }
};

/**
 * Takes the admin's plain-text instruction and rephrases it as a professional,
 * warm response from Riya that can be sent directly to the customer.
 *
 * @param {string} adminRawText   - Admin's plain language instruction, e.g. "tell him deposit processing, done in 2 hrs"
 * @param {string} customerContext - Last few messages for coherence
 * @returns {Promise<string>}     - Polished reply ready to send to the customer
 */
const rephraseAsAgent = async (adminRawText, customerContext = '') => {
  if (!genAI) {
    // Fallback: just clean up the admin text slightly
    return adminRawText;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are ${AGENT_NAME}, a professional and friendly human support executive at StocksLab India.

Your manager has given you a quick instruction (in plain/informal language) about what to tell the customer.
Rephrase this instruction as a warm, professional, empathetic message to send to the customer.

Rules:
- Keep it natural and human — don't sound like a robot or formal document
- Stay concise (2-4 sentences max)
- Sign off naturally (you don't need to sign your name every time)
- Do NOT add information that wasn't in the instruction
- Do NOT say things like "As per your query" — keep it conversational

Recent conversation context:
${customerContext}

Manager's instruction: "${adminRawText}"

Write the message to send to the customer (plain text only, no JSON):`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('[AI] rephraseAsAgent failed:', err);
    // On failure, send the admin's raw text as-is
    return adminRawText;
  }
};

module.exports = {
  analyzeSentiment,
  generateAgentResponse,
  rephraseAsAgent,
  AGENT_NAME,
};
