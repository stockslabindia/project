/**
 * chatScript.js
 * Bot conversation tree for the customer support chat widget.
 * All issue topics route to REQUEST_AGENT → shows "Connecting to agent..."
 * The backend then auto-connects Riya (Gemini AI) as the agent after ~4 seconds.
 */

export const CHAT_SCRIPT = {
  main_menu: {
    id: 'main_menu',
    message: 'Hey {name}, what can I help you with today?',
    options: [
      { label: 'Deposit',              next: 'deposit_menu' },
      { label: 'Withdrawal',           next: 'withdrawal_menu' },
      { label: 'Check Ticket Status',  next: 'ticket_status' },
      { label: 'Trading Issues',       next: 'trading_menu' },
      { label: 'Account & KYC',        next: 'kyc_menu' },
      { label: 'Others',               next: 'connect_agent', topic: 'General Inquiry' },
    ],
  },

  deposit_menu: {
    id: 'deposit_menu',
    message: 'Please select the type of deposit issue:',
    options: [
      { label: 'Paid amount not added',                            next: 'connect_agent', topic: 'Deposit > Paid amount not added' },
      { label: 'Amount different from requested',                  next: 'connect_agent', topic: 'Deposit > Amount mismatch' },
      { label: 'Paid on old UPI / old QR',                        next: 'connect_agent', topic: 'Deposit > Old UPI/QR' },
      { label: 'Other deposit issue',                              next: 'connect_agent', topic: 'Deposit > Other' },
      { label: '← Back',                                          next: 'main_menu' },
    ],
  },

  withdrawal_menu: {
    id: 'withdrawal_menu',
    message: 'Please select the type of withdrawal issue:',
    options: [
      { label: 'Withdrawal not received',                          next: 'connect_agent', topic: 'Withdrawal > Not received' },
      { label: 'Withdrawal rejected',                              next: 'connect_agent', topic: 'Withdrawal > Rejected' },
      { label: 'Wrong bank account credited',                      next: 'connect_agent', topic: 'Withdrawal > Wrong account' },
      { label: 'Withdrawal pending too long',                      next: 'connect_agent', topic: 'Withdrawal > Pending' },
      { label: 'Other withdrawal issue',                           next: 'connect_agent', topic: 'Withdrawal > Other' },
      { label: '← Back',                                          next: 'main_menu' },
    ],
  },

  trading_menu: {
    id: 'trading_menu',
    message: 'Please select the type of trading issue:',
    options: [
      { label: 'Order not executed',                               next: 'connect_agent', topic: 'Trading > Order not executed' },
      { label: 'Position not closing',                             next: 'connect_agent', topic: 'Trading > Position not closing' },
      { label: 'Margin / leverage issue',                          next: 'connect_agent', topic: 'Trading > Margin issue' },
      { label: 'Wrong P&L shown',                                  next: 'connect_agent', topic: 'Trading > Wrong P&L' },
      { label: 'Stop Loss not triggered',                          next: 'connect_agent', topic: 'Trading > SL issue' },
      { label: 'Other trading issue',                              next: 'connect_agent', topic: 'Trading > Other' },
      { label: '← Back',                                          next: 'main_menu' },
    ],
  },

  kyc_menu: {
    id: 'kyc_menu',
    message: 'Please select the type of account / KYC issue:',
    options: [
      { label: 'KYC rejected',                                     next: 'connect_agent', topic: 'KYC > Rejected' },
      { label: 'KYC pending too long',                             next: 'connect_agent', topic: 'KYC > Pending' },
      { label: 'Login / password issue',                           next: 'connect_agent', topic: 'Account > Login issue' },
      { label: 'Account frozen / restricted',                      next: 'connect_agent', topic: 'Account > Frozen' },
      { label: 'Other account issue',                              next: 'connect_agent', topic: 'Account > Other' },
      { label: '← Back',                                          next: 'main_menu' },
    ],
  },

  ticket_status: {
    id: 'ticket_status',
    message: 'Here are your recent trouble tickets:',
    action: 'SHOW_TICKETS',
  },

  // ── Agent Connect ─────────────────────────────────────────────────────────
  // Shows "Connecting to an agent..." — the backend auto-connects Riya (AI)
  // after ~4 seconds if no real human agent accepts first.
  connect_agent: {
    id: 'connect_agent',
    message: 'Please hold on, connecting you with an agent...',
    action: 'REQUEST_AGENT',
  },
};

/** Resolve {name} placeholder in bot messages */
export function resolveMessage(message, user) {
  return message.replace('{name}', user?.full_name || user?.name || 'there');
}
