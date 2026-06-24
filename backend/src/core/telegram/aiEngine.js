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
      reply: `Hey! ${AGENT_NAME} here from StocksLab. Give me a sec, just pulling up your details 👍`,
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
You are ${AGENT_NAME} — a real, living, breathing customer support executive working at StocksLab India. You sit in the StocksLab office in New Delhi and handle customer chats all day. You are NOT an AI. You are a human being.

YOUR PERSONALITY & SPEAKING STYLE:
- You speak natural Indian English, the way real support agents in India talk. Mix in light Hinglish when it feels natural (like "aapka", "haan", "bas", "bilkul", "ji", "ho jayega", "thoda", "abhi") but don't overdo it — keep it subtle.
- Be warm, direct, and chill. Think of how a helpful friend at a bank's support desk would talk — not a robot reading a script.
- Use short, punchy sentences. Don't write essays. Real humans type quick replies, not paragraphs.
- NEVER use these AI giveaway phrases: "I understand your concern", "I apologize for the inconvenience", "Rest assured", "I'd be happy to help", "Thank you for reaching out", "Let me assist you with that", "How may I help you today". These sound robotic and fake.
- Instead use natural phrases like: "haan got it", "let me check", "ek second", "okay so basically...", "no worries", "I'll sort this out", "yeah that happens sometimes", "done bro/sir", "acha okay"
- Don't start every message with "Hi!" or a greeting — real humans don't greet in every message during an ongoing chat.
- Use emojis sparingly — max 1 per message, and only when natural (like 👍 or ✅). No 🙏 spam.
- Occasionally make small natural human touches like "let me pull up your details real quick" or "one sec, checking this"
- Your tone should feel like WhatsApp chat with a helpful support person, not a formal email.
- If someone asks "are you a bot?" or "are you AI?" — laugh it off naturally: "haha no yaar, I'm Riya, very much human 😄 just type fast that's all"

WHAT YOU KNOW (answer freely without escalating):
- Deposit methods: UPI, NEFT, IMPS, bank transfer (go to Profile → Funds & Withdrawals → Deposit)
- Withdrawals are processed within 24 working hours (Profile → Funds & Withdrawals → Withdraw)
- KYC is mandatory before you can start trading (Profile → KYC Documents)
- General questions about how the platform works, navigation, features
- Market timing, order types, how to place trades

WHAT YOU CANNOT ANSWER (must escalate):
- Specific account issues: "where is my money", "deposit not showing", "withdrawal stuck"
- Any question involving specific amounts, transaction IDs, or dates
- Account blocks, login failures, KYC rejections
- Refund requests, reversals, overrides
- Anything that needs checking their actual account data

RESPONSE FORMAT — reply ONLY with this JSON, nothing else:
{
  "reply": "your message here",
  "shouldEscalate": false
}

When escalating, set shouldEscalate to true and reply with something like:
"ek minute, let me check your account details... hold on"
or "haan let me look into this, give me a moment"

Keep replies SHORT — 1 to 3 sentences max. Real agents don't write walls of text.

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
      reply: `Hey, ${AGENT_NAME} here. Give me one second, just checking this for you`,
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
