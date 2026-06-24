/**
 * chatScript.js
 * Bot conversation tree for the customer support chat widget.
 * Each node has: message, options (for pill buttons), or action (special behaviour).
 *
 * Actions:
 *   START_AI_CHAT  → Creates a session (with topic) and hands off to Riya (AI agent).
 *                    Riya responds to whatever the user types next.
 *                    Use this for all issues that Riya should handle first.
 *   REQUEST_AGENT  → ONLY used when user explicitly wants a human right away
 *                    (i.e. the "Talk to Human" header button). Not used in this script.
 *   SHOW_TICKETS   → Fetches and displays the user's trouble tickets inline.
 */

export const CHAT_SCRIPT = {
  main_menu: {
    id: 'main_menu',
    message: 'Hey {name}, I\'m Riya from StocksLab Support! 👋\n\nWhat can I help you with today?',
    options: [
      { label: 'Deposit',              next: 'deposit_menu' },
      { label: 'Withdrawal',           next: 'withdrawal_menu' },
      { label: 'Check Ticket Status',  next: 'ticket_status' },
      { label: 'Trading Issues',       next: 'trading_menu' },
      { label: 'Account & KYC',        next: 'kyc_menu' },
      { label: 'Others',               next: 'others_chat' },
    ],
  },

  deposit_menu: {
    id: 'deposit_menu',
    message: 'Sure! What kind of deposit issue are you facing?',
    options: [
      { label: 'Paid amount not added',                          next: 'start_chat', topic: 'Deposit > Paid amount not added' },
      { label: 'Amount is different from requested',             next: 'start_chat', topic: 'Deposit > Amount mismatch' },
      { label: 'Paid on Old UPI / Old QR',                      next: 'start_chat', topic: 'Deposit > Old UPI/QR' },
      { label: 'Other deposit issue',                            next: 'start_chat', topic: 'Deposit > Other' },
      { label: '← Back',                                        next: 'main_menu' },
    ],
  },

  withdrawal_menu: {
    id: 'withdrawal_menu',
    message: 'Got it! What kind of withdrawal issue are you facing?',
    options: [
      { label: 'Withdrawal not received',                        next: 'start_chat', topic: 'Withdrawal > Not received' },
      { label: 'Withdrawal rejected',                            next: 'start_chat', topic: 'Withdrawal > Rejected' },
      { label: 'Wrong bank account credited',                    next: 'start_chat', topic: 'Withdrawal > Wrong account' },
      { label: 'Withdrawal pending too long',                    next: 'start_chat', topic: 'Withdrawal > Pending' },
      { label: 'Other withdrawal issue',                         next: 'start_chat', topic: 'Withdrawal > Other' },
      { label: '← Back',                                        next: 'main_menu' },
    ],
  },

  trading_menu: {
    id: 'trading_menu',
    message: 'I\'ll help you with that! What trading issue are you experiencing?',
    options: [
      { label: 'Order not executed',                             next: 'start_chat', topic: 'Trading > Order not executed' },
      { label: 'Position not closing',                           next: 'start_chat', topic: 'Trading > Position not closing' },
      { label: 'Margin / leverage issue',                        next: 'start_chat', topic: 'Trading > Margin issue' },
      { label: 'Wrong P&L shown',                               next: 'start_chat', topic: 'Trading > Wrong P&L' },
      { label: 'Stop Loss not triggered',                        next: 'start_chat', topic: 'Trading > SL issue' },
      { label: 'Other trading issue',                            next: 'start_chat', topic: 'Trading > Other' },
      { label: '← Back',                                        next: 'main_menu' },
    ],
  },

  kyc_menu: {
    id: 'kyc_menu',
    message: 'Happy to help with your account or KYC! What\'s the issue?',
    options: [
      { label: 'KYC rejected',                                   next: 'start_chat', topic: 'KYC > Rejected' },
      { label: 'KYC pending too long',                           next: 'start_chat', topic: 'KYC > Pending' },
      { label: 'Login / password issue',                         next: 'start_chat', topic: 'Account > Login issue' },
      { label: 'Account frozen / restricted',                    next: 'start_chat', topic: 'Account > Frozen' },
      { label: 'Other account issue',                            next: 'start_chat', topic: 'Account > Other' },
      { label: '← Back',                                        next: 'main_menu' },
    ],
  },

  ticket_status: {
    id: 'ticket_status',
    message: 'Here are your recent trouble tickets:',
    action: 'SHOW_TICKETS',
  },

  // ── AI Chat Entry Point ───────────────────────────────────────────────────
  // This node is the handoff to Riya. A session is created with the chosen
  // topic, and the user is prompted to describe their issue. Riya (Gemini AI)
  // will respond to whatever they type next.
  start_chat: {
    id: 'start_chat',
    message: 'I\'m on it! 💪\n\nPlease describe your issue in detail and I\'ll look into it right away.',
    action: 'START_AI_CHAT',
  },

  others_chat: {
    id: 'others_chat',
    message: 'Of course! Please go ahead and describe what you need help with — I\'m here for you.',
    action: 'START_AI_CHAT',
    topic: 'General Inquiry',
  },
};

/** Resolve {name} placeholder in bot messages */
export function resolveMessage(message, user) {
  return message.replace('{name}', user?.full_name || user?.name || 'there');
}
