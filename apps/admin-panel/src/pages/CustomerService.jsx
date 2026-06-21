import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import {
  MessageSquare, Clock, User, Send, X, FileText,
  ChevronRight, AlertTriangle, CheckCircle, Circle,
  RefreshCw, Phone, Shield, Wallet, TrendingUp,
  MoreVertical, ExternalLink
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const WS_URL   = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:4000';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function PriorityBadge({ priority }) {
  const map = {
    low:    'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high:   'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${map[priority] || map.medium}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    waiting:          'bg-amber-100 text-amber-700',
    active:           'bg-green-100 text-green-700',
    ended:            'bg-gray-100 text-gray-500',
    open:             'bg-red-100 text-red-700',
    in_progress:      'bg-blue-100 text-blue-700',
    pending_approval: 'bg-purple-100 text-purple-700',
    resolved:         'bg-emerald-100 text-emerald-700',
    closed:           'bg-gray-100 text-gray-500',
  };
  const label = status?.replace('_', ' ') || '';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {label}
    </span>
  );
}

// ─── Chat Timer ────────────────────────────────────────────────────────────────
function ChatTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  return <span className="font-mono text-sm text-gray-600">{m}:{s}</span>;
}

// ─── Raise TT Modal ────────────────────────────────────────────────────────────
function RaiseTTModal({ sessionId, customerName, token, onClose, onRaised }) {
  const [form, setForm] = useState({ category: 'deposit', priority: 'medium', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.description.trim()) { setError('Description is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/support/admin/sessions/${sessionId}/tt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRaised(data);
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-amber-600" />
            <h3 className="font-bold text-gray-900">Raise Trouble Ticket</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Customer</p>
            <p className="text-sm font-semibold text-gray-900">{customerName}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 capitalize"
            >
              {['deposit','withdrawal','trading','kyc','account','other'].map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Priority *</label>
            <select
              value={form.priority}
              onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {['low','medium','high','urgent'].map(p => (
                <option key={p} value={p} className="capitalize">{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe the issue in detail..."
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={submit} disabled={loading} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-60">
              {loading ? 'Raising...' : 'Raise TT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Chat Window ─────────────────────────────────────────────────────────
function AgentChatWindow({ session, onClose, token, agentName, agentId, socketRef }) {
  const [messages, setMessages]         = useState([]);
  const [inputText, setInputText]       = useState('');
  const [customerProfile, setCustomerProfile] = useState(null);
  const [showTTModal, setShowTTModal]   = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(session.status);
  const [ttRaised, setTTRaised]         = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // Load chat history + customer profile
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const [msgRes, custRes] = await Promise.all([
          fetch(`${API_BASE}/support/sessions/${session.id}/messages`,
            { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/support/admin/sessions/${session.id}/customer`,
            { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        // Note: agent uses admin token, but session messages endpoint checks ownership.
        // The admin route returns messages for any session.
        const custData = await custRes.json();
        setCustomerProfile(custData);

        // Fetch messages via admin-specific endpoint
        const adminMsgRes = await fetch(
          `${API_BASE}/support/admin/sessions/${session.id}/messages`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (adminMsgRes.ok) {
          const msgData = await adminMsgRes.json();
          setMessages(Array.isArray(msgData) ? msgData : []);
        }
      } catch { /* silent */ }
    };
    loadHistory();

    // Join socket room
    if (socketRef.current) {
      socketRef.current.emit('support:join_session', { session_id: session.id });
    }
  }, [session.id, token]);

  // Listen for socket events for THIS session
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onMessage = (msg) => {
      if (msg.session_id !== session.id && !msg.session_id) return;
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const onEnded = ({ session_id }) => {
      if (session_id === session.id) setSessionStatus('ended');
    };

    socket.on('support:new_message', onMessage);
    socket.on('support:session_ended', onEnded);
    return () => {
      socket.off('support:new_message', onMessage);
      socket.off('support:session_ended', onEnded);
    };
  }, [session.id, socketRef]);

  const sendMessage = () => {
    if (!inputText.trim() || sessionStatus !== 'active') return;
    const text = inputText.trim();
    setInputText('');

    // Optimistic
    const opt = {
      id: `opt_${Date.now()}`, session_id: session.id,
      sender_type: 'agent', sender_id: agentId,
      message: text, message_type: 'text',
      agent_name: agentName, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, opt]);

    if (socketRef.current) {
      socketRef.current.emit('support:agent_message', {
        session_id: session.id, message: text,
      });
    }
  };

  const endChat = () => {
    if (socketRef.current) {
      socketRef.current.emit('support:agent_end_chat', { session_id: session.id });
    }
    setSessionStatus('ended');
    setShowEndConfirm(false);
  };

  const customer = customerProfile?.user;
  const wallet   = customerProfile?.wallet;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-blue-700">
            {customer?.full_name?.charAt(0) || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {customer?.full_name || 'Customer'}
            </p>
            <p className="text-xs text-gray-500 truncate">{session.topic || 'General'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {sessionStatus === 'active' && session.agent_joined_at && (
            <ChatTimer startTime={session.agent_joined_at} />
          )}
          {sessionStatus === 'active' && (
            <button
              onClick={() => setShowTTModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              <FileText size={12} /> Raise TT
            </button>
          )}
          {sessionStatus === 'active' && (
            <button
              onClick={() => setShowEndConfirm(true)}
              className="px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
            >
              End Chat
            </button>
          )}
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Messages pane */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => {
              if (msg.message_type === 'system' || msg.sender_type === 'system') {
                return (
                  <div key={msg.id || i} className="flex justify-center">
                    <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                      {msg.message}
                    </span>
                  </div>
                );
              }
              const isAgent = msg.sender_type === 'agent';
              const isUser  = msg.sender_type === 'user';
              const isBot   = msg.sender_type === 'bot';
              return (
                <div key={msg.id || i} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                    ${isAgent
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}>
                    {(isBot || isUser) && (
                      <p className="text-[10px] font-semibold mb-0.5 opacity-60">
                        {isBot ? 'Bot' : customer?.full_name || 'Customer'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isAgent ? 'text-white/60' : 'text-gray-400'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            {sessionStatus === 'ended' && (
              <div className="flex justify-center py-2">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <CheckCircle size={12} className="text-emerald-500" /> Chat ended
                </span>
              </div>
            )}
            {ttRaised && (
              <div className="flex justify-center py-1">
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  TT {ttRaised.ticket_number} raised
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-gray-100 px-3 py-2.5">
            {sessionStatus === 'active' ? (
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:bg-blue-700 flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400 py-1">Chat ended</p>
            )}
          </div>
        </div>

        {/* Customer info sidebar */}
        <div className="w-52 flex-shrink-0 border-l border-gray-100 overflow-y-auto bg-gray-50/50 p-3 space-y-3 text-xs">
          <p className="font-bold text-gray-700 text-[11px] uppercase tracking-wider">Customer Info</p>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-gray-600">
              <User size={11} className="flex-shrink-0" />
              <span className="truncate font-medium">{customer?.full_name || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded font-mono">
                {customer?.client_id || '—'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield size={11} className="flex-shrink-0 text-gray-400" />
              <span className={`capitalize text-[10px] font-semibold
                ${customer?.kyc_status === 'verified' ? 'text-emerald-600'
                  : customer?.kyc_status === 'pending' ? 'text-amber-600'
                  : 'text-red-500'}`}>
                KYC {customer?.kyc_status || 'unknown'}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-2 space-y-1.5">
            <p className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">Balance</p>
            <div className="flex items-center gap-1.5 text-gray-700">
              <Wallet size={11} className="flex-shrink-0 text-blue-500" />
              <span className="font-bold">₹{wallet?.balance?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-2 space-y-1.5">
            <p className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">Positions</p>
            <div className="flex items-center gap-1.5 text-gray-700">
              <TrendingUp size={11} className="flex-shrink-0 text-emerald-500" />
              <span>{customerProfile?.open_positions || 0} open</span>
            </div>
          </div>

          {customerProfile?.recent_transactions?.length > 0 && (
            <div className="border-t border-gray-200 pt-2 space-y-1.5">
              <p className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">Recent Txns</p>
              {customerProfile.recent_transactions.slice(0, 3).map((txn, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="capitalize text-gray-600 truncate">{txn.type}</span>
                  <span className={`font-semibold ${txn.type === 'deposit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    ₹{txn.amount?.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <a
            href={`/users/${customerProfile?.user?.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-[11px] font-semibold border-t border-gray-200 pt-2"
          >
            <ExternalLink size={10} /> View Full Profile
          </a>
        </div>
      </div>

      {/* End Chat Confirm */}
      {showEndConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 rounded-xl">
          <div className="bg-white rounded-xl p-5 shadow-xl w-64 space-y-3">
            <p className="font-bold text-gray-900">End this chat?</p>
            <p className="text-sm text-gray-500">The customer will be notified.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowEndConfirm(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={endChat} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600">
                End
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raise TT Modal */}
      {showTTModal && (
        <RaiseTTModal
          sessionId={session.id}
          customerName={customer?.full_name || 'Customer'}
          token={token}
          onClose={() => setShowTTModal(false)}
          onRaised={(tt) => setTTRaised(tt)}
        />
      )}
    </div>
  );
}

// ─── Ticket Detail Panel ──────────────────────────────────────────────────────
function TicketDetailPanel({ ticket, token, isAdmin, onClose, onUpdated }) {
  const [notes, setNotes]   = useState(ticket.admin_notes || '');
  const [status, setStatus] = useState(ticket.status);
  const [saving, setSaving] = useState(false);

  const save = async (newStatus) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/support/admin/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus || status, admin_notes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdated(data);
      if (newStatus) setStatus(newStatus);
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">{ticket.ticket_number}</p>
            <StatusBadge status={ticket.status} />
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Customer */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer</p>
            <p className="text-sm font-semibold text-gray-900">{ticket.customer?.full_name || '—'}</p>
            <p className="text-xs text-gray-500">{ticket.customer?.client_id || ''}</p>
          </div>

          {/* Agent */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Raised By Agent</p>
            <p className="text-sm text-gray-900">{ticket.raised_by_agent?.name || ticket.raised_by_agent_id}</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Category</p>
              <p className="text-sm capitalize text-gray-900">{ticket.category}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Priority</p>
              <PriorityBadge priority={ticket.priority} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Created</p>
              <p className="text-xs text-gray-700">{timeAgo(ticket.created_at)}</p>
            </div>
            {ticket.closed_at && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Closed</p>
                <p className="text-xs text-gray-700">{timeAgo(ticket.closed_at)}</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
            <p className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>

          {/* Status (editable for all) */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</p>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {['open','in_progress','pending_approval','resolved'].map(s => (
                <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
              ))}
              {isAdmin && <option value="closed">closed</option>}
            </select>
          </div>

          {/* Admin Notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes for this ticket..."
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => save()}
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {isAdmin && status !== 'closed' && (
              <button
                onClick={() => save('closed')}
                disabled={saving}
                className="flex-1 py-2.5 bg-gray-700 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
              >
                Close TT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CustomerService PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CustomerService() {
  const { user } = useAuth();
  const token = localStorage.getItem('admin_token');
  const isAdmin = user?.role === 'Super Admin' || user?.department === 'admin';

  // Tabs
  const [activeTab, setActiveTab] = useState('live');

  // Live chat state
  const [sessions, setSessions]               = useState([]);
  const [incomingChats, setIncomingChats]     = useState([]); // waiting, not yet accepted
  const [activeChatWindows, setActiveChatWindows] = useState([]); // sessions this agent accepted
  const [loadingChats, setLoadingChats]       = useState(false);

  // Tickets state
  const [tickets, setTickets]                 = useState([]);
  const [totalTickets, setTotalTickets]       = useState(0);
  const [loadingTickets, setLoadingTickets]   = useState(false);
  const [ticketFilter, setTicketFilter]       = useState('open');
  const [selectedTicket, setSelectedTicket]   = useState(null);

  // Socket
  const socketRef = useRef(null);

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const socket = io(`${WS_URL}/support`, {
      auth: { token, role: 'agent' },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('[CustomerService] Support socket connected');
      // Rejoin any active session rooms
      activeChatWindows.forEach(s => {
        socket.emit('support:join_session', { session_id: s.id });
      });
    });

    // Incoming chat request from a user
    socket.on('support:incoming_chat', (data) => {
      setIncomingChats(prev => {
        if (prev.find(c => c.session_id === data.session_id)) return prev;
        return [data, ...prev];
      });
    });

    // Another agent accepted a chat — remove from incoming list
    socket.on('support:chat_taken', ({ session_id }) => {
      setIncomingChats(prev => prev.filter(c => c.session_id !== session_id));
    });

    // Agent accepted this chat (our own accept confirmation)
    socket.on('support:chat_accepted', ({ session_id, customer_id }) => {
      setIncomingChats(prev => prev.filter(c => c.session_id !== session_id));
      // Add to active windows
      loadSessions();
    });

    socket.on('support:error', ({ message }) => {
      alert(message);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [token]);

  // ── Load sessions ────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await fetch(`${API_BASE}/support/admin/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const all = Array.isArray(data) ? data : [];
      setSessions(all);

      // Waiting sessions = incoming (if not already accepted by any agent)
      setIncomingChats(prev => {
        const waiting = all.filter(s => s.status === 'waiting');
        const merged = waiting.map(s => ({
          session_id: s.id,
          user_name: s.customer?.full_name || 'Customer',
          topic: s.topic || 'General',
          waiting_since: s.started_at,
        }));
        // Keep existing incoming chats that may have arrived via socket before DB update
        const ids = new Set(merged.map(c => c.session_id));
        const extra = prev.filter(c => !ids.has(c.session_id));
        return [...merged, ...extra];
      });

      // Restore active windows this agent has
      const myActive = all.filter(s => s.status === 'active' && s.agent_id === user?.id);
      setActiveChatWindows(myActive);
    } catch { /* silent */ }
    setLoadingChats(false);
  }, [token, user?.id]);

  // ── Load tickets ─────────────────────────────────────────────────────────────
  const loadTickets = useCallback(async (status = ticketFilter) => {
    setLoadingTickets(true);
    try {
      const res = await fetch(
        `${API_BASE}/support/admin/tickets?status=${status}&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setTickets(data.tickets || []);
      setTotalTickets(data.total || 0);
    } catch { /* silent */ }
    setLoadingTickets(false);
  }, [token, ticketFilter]);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { if (activeTab === 'tickets') loadTickets(); }, [activeTab]);

  // Accept incoming chat
  const acceptChat = (incoming) => {
    if (activeChatWindows.length >= 5) {
      alert('You can only handle 5 chats simultaneously.');
      return;
    }
    if (socketRef.current) {
      socketRef.current.emit('support:accept_chat', { session_id: incoming.session_id });
    }
    // Optimistically add to windows (will be confirmed by socket + DB reload)
    const tempSession = {
      id: incoming.session_id,
      status: 'active',
      topic: incoming.topic,
      agent_joined_at: new Date().toISOString(),
      customer: { full_name: incoming.user_name },
    };
    setActiveChatWindows(prev => {
      if (prev.find(s => s.id === incoming.session_id)) return prev;
      return [...prev, tempSession];
    });
    setIncomingChats(prev => prev.filter(c => c.session_id !== incoming.session_id));
  };

  const closeChatWindow = (sessionId) => {
    setActiveChatWindows(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleTicketUpdated = (updated) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    setSelectedTicket(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customer Service</h1>
          <p className="text-sm text-gray-500">
            {activeChatWindows.length}/5 active chats ·{' '}
            {incomingChats.length} waiting
          </p>
        </div>
        <button
          onClick={() => { loadSessions(); loadTickets(); }}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4 flex-shrink-0">
        {[
          { id: 'live',    label: 'Live Chats',     badge: incomingChats.length + activeChatWindows.length },
          { id: 'tickets', label: 'Trouble Tickets', badge: null },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-2.5 text-sm font-semibold transition-colors border-b-2
              ${activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════ LIVE CHATS TAB ════════════════════ */}
      {activeTab === 'live' && (
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          {/* Left sidebar: incoming + active list */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">

            {/* Incoming chats */}
            {incomingChats.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 px-1">
                  Incoming ({incomingChats.length})
                </p>
                {incomingChats.map(incoming => (
                  <div
                    key={incoming.session_id}
                    className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2 space-y-2 animate-pulse-once"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
                        {incoming.user_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{incoming.user_name}</p>
                        <p className="text-xs text-gray-500 truncate">{incoming.topic}</p>
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          Waiting: {timeAgo(incoming.waiting_since)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => acceptChat(incoming)}
                      disabled={activeChatWindows.length >= 5}
                      className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeChatWindows.length >= 5 ? 'Max reached' : 'Accept Chat'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Active chats */}
            {activeChatWindows.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2 px-1">
                  Your Active ({activeChatWindows.length}/5)
                </p>
                {activeChatWindows.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {/* window already shown */}}
                    className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 mb-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {s.customer?.full_name || 'Customer'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{s.topic}</p>
                      </div>
                      {s.agent_joined_at && <ChatTimer startTime={s.agent_joined_at} />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {incomingChats.length === 0 && activeChatWindows.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <MessageSquare size={28} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No active chats</p>
                <p className="text-xs text-gray-300 mt-0.5">Waiting for customers...</p>
              </div>
            )}
          </div>

          {/* Right: Chat windows grid */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {activeChatWindows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare size={24} className="text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-sm">Accept a chat to start</p>
                </div>
              </div>
            ) : (
              <div className={`h-full grid gap-3 ${
                activeChatWindows.length === 1 ? 'grid-cols-1' :
                activeChatWindows.length === 2 ? 'grid-cols-2' :
                activeChatWindows.length <= 4 ? 'grid-cols-2 grid-rows-2' :
                'grid-cols-3'
              }`}>
                {activeChatWindows.map(session => (
                  <div key={session.id} className="relative min-h-0">
                    <AgentChatWindow
                      session={session}
                      token={token}
                      agentName={user?.name || 'Agent'}
                      agentId={user?.id}
                      socketRef={socketRef}
                      onClose={() => closeChatWindow(session.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════ TICKETS TAB ══════════════════════════ */}
      {activeTab === 'tickets' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            {['open','in_progress','pending_approval','resolved','closed'].map(s => (
              <button
                key={s}
                onClick={() => { setTicketFilter(s); loadTickets(s); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors
                  ${ticketFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400">{totalTickets} total</span>
          </div>

          {/* Tickets table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingTickets ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle size={28} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No {ticketFilter} tickets</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    {['TT #','Customer','Category','Priority','Raised By','Status','Created',''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map(ticket => (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs font-bold text-blue-700">{ticket.ticket_number}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{ticket.customer?.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{ticket.customer?.client_id || ''}</p>
                      </td>
                      <td className="px-3 py-2.5 capitalize text-gray-700">{ticket.category}</td>
                      <td className="px-3 py-2.5"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="px-3 py-2.5 text-gray-600">{ticket.raised_by_agent?.name || '—'}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={ticket.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">{timeAgo(ticket.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <ChevronRight size={14} className="text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Ticket detail panel */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          token={token}
          isAdmin={isAdmin}
          onClose={() => setSelectedTicket(null)}
          onUpdated={handleTicketUpdated}
        />
      )}
    </div>
  );
}
