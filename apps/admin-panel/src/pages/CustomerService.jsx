import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import {
  MessageSquare, User, Send, X, FileText, Paperclip,
  ChevronRight, CheckCircle, RefreshCw, Shield, Wallet,
  TrendingUp, ExternalLink, ArrowRightLeft, Mail, History,
  Search, Eye, ChevronDown
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
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
  const label = status?.replace(/_/g, ' ') || '';
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

// ─── Transfer Chat Modal ───────────────────────────────────────────────────────
function TransferModal({ sessionId, token, onClose, onTransferred }) {
  const [agents, setAgents]     = useState([]);
  const [selected, setSelected] = useState('');
  const [note, setNote]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/support/admin/agents/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setAgents(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token]);

  const submit = async () => {
    if (!selected) { setError('Please select an agent'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/support/admin/sessions/${sessionId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_agent_id: selected, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onTransferred(data);
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-blue-600" />
            <h3 className="font-bold text-gray-900">Transfer Chat</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Select Agent *</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {agents.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Loading agents...</p>
              )}
              {agents.map(agent => {
                const avail = agent.agent_availability?.[0] || agent.agent_availability;
                const isOnline = avail?.is_online;
                const chatCount = avail?.active_chat_count || 0;
                const canTake = isOnline && chatCount < 5;
                return (
                  <label
                    key={agent.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
                      ${selected === agent.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}
                      ${!canTake ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="agent"
                      value={agent.id}
                      checked={selected === agent.id}
                      onChange={() => canTake && setSelected(agent.id)}
                      disabled={!canTake}
                      className="text-blue-600"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
                        <p className="text-xs text-gray-400">{chatCount}/5 chats · {isOnline ? 'Online' : 'Offline'}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Transfer Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for transfer or handover notes..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={submit} disabled={loading || !selected} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Transferring...' : 'Transfer Chat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Post-Chat Email Modal ─────────────────────────────────────────────────────
function PostChatEmailModal({ sessionId, customerEmail, token, onClose }) {
  const TEMPLATES = [
    {
      label: 'Issue Resolved',
      subject: 'Your Support Query Has Been Resolved — StocksLab',
      body: `Dear Customer,

Thank you for contacting StocksLab Support. We are pleased to inform you that your query has been resolved successfully.

If you have any further questions or need additional assistance, please don't hesitate to reach out to us again.

Best regards,
StocksLab Customer Support Team
support@stockslab.live`,
    },
    {
      label: 'Follow-up Required',
      subject: 'Follow-up on Your Support Query — StocksLab',
      body: `Dear Customer,

Thank you for contacting StocksLab Support. We have reviewed your query and our team is working on it.

We will get back to you with an update within 24-48 business hours. We apologize for any inconvenience caused.

Best regards,
StocksLab Customer Support Team
support@stockslab.live`,
    },
    {
      label: 'Ticket Raised',
      body: `Dear Customer,

Thank you for reaching out to StocksLab Support. We have raised a support ticket for your query and our team will be in touch shortly.

You can track the status of your ticket through the app. We appreciate your patience.

Best regards,
StocksLab Customer Support Team
support@stockslab.live`,
      subject: 'Support Ticket Raised — StocksLab',
    },
    {
      label: 'Custom',
      subject: '',
      body: '',
    },
  ];

  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [email, setEmail]     = useState(customerEmail || '');
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [body, setBody]       = useState(TEMPLATES[0].body);
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  const applyTemplate = (idx) => {
    setSelectedTemplate(idx);
    if (TEMPLATES[idx].subject) setSubject(TEMPLATES[idx].subject);
    if (TEMPLATES[idx].body) setBody(TEMPLATES[idx].body);
  };

  const send = async () => {
    if (!email.trim()) { setError('Email address required'); return; }
    if (!subject.trim()) { setError('Subject required'); return; }
    if (!body.trim()) { setError('Message body required'); return; }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/support/admin/sessions/${sessionId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email !== customerEmail ? email : undefined, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-emerald-600" />
            <h3 className="font-bold text-gray-900">Send Follow-up Email</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${result.emailSent ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {result.emailSent
                ? <CheckCircle size={28} className="text-emerald-600" />
                : <Mail size={28} className="text-amber-600" />
              }
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">
                {result.emailSent ? 'Email Sent!' : 'Email Attempted'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {result.emailSent
                  ? `Successfully sent to ${result.to}`
                  : `SMTP not configured. Email logged for ${result.to}.`
                }
              </p>
            </div>
            <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
              Close
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Templates */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Quick Templates</label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                      ${selectedTemplate === i ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* To */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                To {!customerEmail && <span className="text-red-500 font-normal">(no email on file — enter manually)</span>}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="customer@email.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Message *</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none font-mono"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pb-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Skip
              </button>
              <button onClick={send} disabled={sending} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
                <Mail size={14} />
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Chat Window ─────────────────────────────────────────────────────────
function AgentChatWindow({ session, onClose, token, agentName, agentId, socketRef }) {
  const [messages, setMessages]               = useState([]);
  const [inputText, setInputText]             = useState('');
  const [customerProfile, setCustomerProfile] = useState(null);
  const [showTTModal, setShowTTModal]         = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm]   = useState(false);
  const [showEmailModal, setShowEmailModal]   = useState(false);
  const [sessionStatus, setSessionStatus]     = useState(session.status);
  const [ttRaised, setTTRaised]               = useState(null);
  const [pendingEmail, setPendingEmail]       = useState(null);
  const messagesEndRef = useRef(null);

  // File upload refs & states
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File size exceeds 10MB limit.'); return; }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Str = event.target.result;
      try {
        const res = await fetch(`${API_BASE}/support/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ file_base64: base64Str, filename: file.name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload file');
        const messageType = file.type.startsWith('image/') ? 'image' : 'document';
        if (socketRef.current) {
          socketRef.current.emit('support:agent_message', {
            session_id: session.id, message: data.url, message_type: messageType,
          });
        }
        setMessages(prev => [...prev, {
          id: `opt_media_${Date.now()}`, sender_type: 'agent', sender_id: agentId,
          message: data.url, message_type: messageType, agent_name: agentName,
          created_at: new Date().toISOString(),
        }]);
      } catch (err) {
        alert(err.message || 'Failed to upload attachment.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => { alert('Failed to read file.'); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // Load chat history + customer profile
  useEffect(() => {
    const load = async () => {
      try {
        const [custRes, adminMsgRes] = await Promise.all([
          fetch(`${API_BASE}/support/admin/sessions/${session.id}/customer`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/support/admin/sessions/${session.id}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (custRes.ok) setCustomerProfile(await custRes.json());
        if (adminMsgRes.ok) {
          const msgData = await adminMsgRes.json();
          setMessages(Array.isArray(msgData) ? msgData : []);
        }
      } catch { /* silent */ }
    };
    load();
    if (socketRef.current) socketRef.current.emit('support:join_session', { session_id: session.id });
  }, [session.id, token]);

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onMessage = (msg) => {
      if (msg.session_id && msg.session_id !== session.id) return;
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
    };
    const onEnded = ({ session_id, ended_by, customer_email }) => {
      if (session_id === session.id) {
        // Use distinct state so agent-end triggers email modal, user-end does not
        setSessionStatus(ended_by === 'agent' ? 'agent_ended' : 'ended');
        setPendingEmail(customer_email || null);
      }
    };
    const onTransferred = ({ session_id }) => {
      if (session_id === session.id) {
        setSessionStatus('transferred');
      }
    };
    socket.on('support:new_message', onMessage);
    socket.on('support:session_ended', onEnded);
    socket.on('support:chat_transferred', onTransferred);
    return () => {
      socket.off('support:new_message', onMessage);
      socket.off('support:session_ended', onEnded);
      socket.off('support:chat_transferred', onTransferred);
    };
  }, [session.id, socketRef]);

  // Show email modal only when AGENT ends the chat (not when user ends it)
  useEffect(() => {
    if (sessionStatus === 'agent_ended') {
      const t = setTimeout(() => setShowEmailModal(true), 800);
      return () => clearTimeout(t);
    }
  }, [sessionStatus]);

  const sendMessage = () => {
    if (!inputText.trim() || sessionStatus !== 'active') return;
    const text = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, {
      id: `opt_${Date.now()}`, session_id: session.id,
      sender_type: 'agent', sender_id: agentId,
      message: text, message_type: 'text',
      agent_name: agentName, created_at: new Date().toISOString(),
    }]);
    if (socketRef.current) socketRef.current.emit('support:agent_message', { session_id: session.id, message: text });
  };

  const endChat = () => {
    if (socketRef.current) socketRef.current.emit('support:agent_end_chat', { session_id: session.id });
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
            <p className="text-sm font-semibold text-gray-900 truncate">{customer?.full_name || 'Customer'}</p>
            <p className="text-xs text-gray-500 truncate">{session.topic || 'General'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(sessionStatus === 'active') && session.agent_joined_at && <ChatTimer startTime={session.agent_joined_at} />}
          {sessionStatus === 'active' && (
            <>
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                title="Transfer chat to another agent"
              >
                <ArrowRightLeft size={11} /> Transfer
              </button>
              <button
                onClick={() => setShowTTModal(true)}
                className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors"
              >
                <FileText size={11} /> TT
              </button>
              <button
                onClick={() => setShowEndConfirm(true)}
                className="px-2 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
              >
                End
              </button>
            </>
          )}
          {(sessionStatus === 'ended' || sessionStatus === 'agent_ended' || sessionStatus === 'transferred') && (
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
              title="Send follow-up email"
            >
              <Mail size={11} /> Email
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
              const isBot   = msg.sender_type === 'bot';
              const fileUrl = msg.message && (msg.message.startsWith('http') || msg.message.startsWith('data:') || msg.message.startsWith('/'))
                ? (msg.message.startsWith('/') ? `${WS_URL}${msg.message}` : msg.message)
                : `${WS_URL}${msg.message}`;

              const renderContent = () => {
                if (msg.message_type === 'image') {
                  return (
                    <div className="rounded-lg overflow-hidden border border-gray-200 max-w-full">
                      <img src={fileUrl} alt="Attachment" className="max-w-xs max-h-40 object-cover cursor-pointer hover:opacity-90" onClick={() => window.open(fileUrl, '_blank')} />
                    </div>
                  );
                }
                if (msg.message_type === 'document') {
                  const filename = msg.message.split('/').pop() || 'document';
                  return (
                    <a href={fileUrl} target="_blank" rel="noreferrer"
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border font-medium transition-colors
                        ${isAgent ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <FileText size={14} className={isAgent ? 'text-white' : 'text-blue-600'} />
                      <span className="truncate max-w-[120px] underline">{filename}</span>
                    </a>
                  );
                }
                return <p className="whitespace-pre-wrap">{msg.message}</p>;
              };

              return (
                <div key={msg.id || i} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                    ${isAgent ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}
                  >
                    {(isBot || msg.sender_type === 'user') && (
                      <p className="text-[10px] font-semibold mb-0.5 opacity-60">
                        {isBot ? 'Bot' : customer?.full_name || 'Customer'}
                      </p>
                    )}
                    {renderContent()}
                    <p className={`text-[10px] mt-1 ${isAgent ? 'text-white/60' : 'text-gray-400'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            {(sessionStatus === 'ended' || sessionStatus === 'transferred') && (
              <div className="flex justify-center py-2">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <CheckCircle size={12} className="text-emerald-500" />
                  {sessionStatus === 'transferred' ? 'Chat transferred' : 'Chat ended'}
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
            {uploading && (
              <div className="flex items-center gap-2 px-2 pb-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">Uploading...</span>
              </div>
            )}
            {sessionStatus === 'active' ? (
              <div className="flex items-end gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-9 h-9 border border-gray-200 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-50"
                >
                  <Paperclip size={14} />
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  disabled={uploading}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || uploading}
                  className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:bg-blue-700 flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {sessionStatus === 'transferred' ? 'Chat was transferred' : 'Chat ended'}
                </p>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100"
                >
                  <Mail size={12} /> Send Follow-up Email
                </button>
              </div>
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
              <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded font-mono">{customer?.client_id || '—'}</span>
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
          <a href={`/users/${customerProfile?.user?.id}`} target="_blank" rel="noreferrer"
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
            <p className="text-sm text-gray-500">The customer will be notified. You'll be prompted to send a follow-up email.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowEndConfirm(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={endChat} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600">
                End Chat
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

      {/* Transfer Modal */}
      {showTransferModal && (
        <TransferModal
          sessionId={session.id}
          token={token}
          onClose={() => setShowTransferModal(false)}
          onTransferred={() => {
            setSessionStatus('transferred');
            setShowTransferModal(false);
          }}
        />
      )}

      {/* Post-chat Email Modal */}
      {showEmailModal && (
        <PostChatEmailModal
          sessionId={session.id}
          customerEmail={pendingEmail || customer?.email || null}
          token={token}
          onClose={() => { setShowEmailModal(false); onClose(); }}
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
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer</p>
            <p className="text-sm font-semibold text-gray-900">{ticket.customer?.full_name || '—'}</p>
            <p className="text-xs text-gray-500">{ticket.customer?.client_id || ''}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Raised By Agent</p>
            <p className="text-sm text-gray-900">{ticket.raised_by_agent?.name || ticket.raised_by_agent_id}</p>
          </div>
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
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
            <p className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap">{ticket.description}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</p>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {['open','in_progress','pending_approval','resolved'].map(s => (
                <option key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</option>
              ))}
              {isAdmin && <option value="closed">closed</option>}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Add notes for this ticket..."
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => save()} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {isAdmin && status !== 'closed' && (
              <button onClick={() => save('closed')} disabled={saving}
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

// ─── Chat History View Modal ───────────────────────────────────────────────────
function ChatHistoryModal({ session, token, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/support/admin/sessions/${session.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session.id, token]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-lg bg-white h-full overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="font-bold text-gray-900">{session.customer?.full_name || 'Customer'} — Chat Transcript</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-400">{formatDate(session.started_at)}</span>
              {session.agent && <span className="text-xs text-blue-600">Agent: {session.agent.name}</span>}
              <span className="text-xs text-gray-400">Duration: {formatDuration(session.session_duration_seconds)}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && messages.map((msg, i) => {
            if (msg.message_type === 'system' || msg.sender_type === 'system') {
              return (
                <div key={msg.id || i} className="flex justify-center">
                  <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">{msg.message}</span>
                </div>
              );
            }
            const isAgent = msg.sender_type === 'agent';
            const isBot   = msg.sender_type === 'bot';
            return (
              <div key={msg.id || i} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                  ${isAgent ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}
                >
                  {(isBot || msg.sender_type === 'user') && (
                    <p className="text-[10px] font-semibold mb-0.5 opacity-60">
                      {isBot ? 'Bot' : session.customer?.full_name || 'Customer'}
                    </p>
                  )}
                  {isAgent && <p className="text-[10px] font-semibold mb-0.5 opacity-60">{session.agent?.name || 'Agent'}</p>}
                  {msg.message_type === 'image'
                    ? <img src={msg.message.startsWith('/') ? `${WS_URL}${msg.message}` : msg.message} alt="img" className="max-w-xs max-h-40 rounded-lg" />
                    : <p className="whitespace-pre-wrap">{msg.message}</p>
                  }
                  <p className={`text-[10px] mt-1 ${isAgent ? 'text-white/60' : 'text-gray-400'}`}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })}
          {!loading && messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-12">No messages in this session.</p>
          )}
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
  const [incomingChats, setIncomingChats]     = useState([]);
  const [activeChatWindows, setActiveChatWindows] = useState([]);
  const [loadingChats, setLoadingChats]       = useState(false);

  // Tickets state
  const [tickets, setTickets]               = useState([]);
  const [totalTickets, setTotalTickets]     = useState(0);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketFilter, setTicketFilter]     = useState('open');
  const [selectedTicket, setSelectedTicket] = useState(null);

  // History state
  const [history, setHistory]               = useState([]);
  const [historyTotal, setHistoryTotal]     = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch]   = useState('');
  const [historyAgentFilter, setHistoryAgentFilter] = useState('');
  const [allAgents, setAllAgents]           = useState([]);
  const [viewSession, setViewSession]       = useState(null);

  // Transfer notifications
  const [incomingTransfers, setIncomingTransfers] = useState([]);

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
      // Re-join active session rooms on reconnect
      // Note: activeChatWindows is stale here (closure), but loadSessions
      // will refresh and AgentChatWindow useEffect handles join_session per window.
    });

    socket.on('support:incoming_chat', (data) => {
      setIncomingChats(prev => prev.find(c => c.session_id === data.session_id) ? prev : [data, ...prev]);
    });

    socket.on('support:chat_offer_expired', ({ session_id }) => {
      // Remove from incoming list when offer window expires (another agent will be offered)
      setIncomingChats(prev => prev.filter(c => c.session_id !== session_id));
    });

    socket.on('support:chat_taken', ({ session_id }) => {
      setIncomingChats(prev => prev.filter(c => c.session_id !== session_id));
    });

    socket.on('support:chat_accepted', ({ session_id }) => {
      setIncomingChats(prev => prev.filter(c => c.session_id !== session_id));
      loadSessions();
    });

    // Incoming transfer notification
    socket.on('support:incoming_transfer', (data) => {
      setIncomingTransfers(prev => prev.find(t => t.session_id === data.session_id) ? prev : [data, ...prev]);
    });

    socket.on('support:error', ({ message }) => alert(message));

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [token]);

  // ── Load sessions ───────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await fetch(`${API_BASE}/support/admin/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const all = Array.isArray(data) ? data : [];
      setSessions(all);
      setIncomingChats(prev => {
        const waiting = all.filter(s => s.status === 'waiting');
        const merged = waiting.map(s => ({
          session_id: s.id,
          user_name: s.customer?.full_name || 'Customer',
          topic: s.topic || 'General',
          waiting_since: s.started_at,
        }));
        const ids = new Set(merged.map(c => c.session_id));
        return [...merged, ...prev.filter(c => !ids.has(c.session_id))];
      });
      // Only seed activeChatWindows from DB on initial load (when empty)
      // After that, local state is authoritative to avoid wiping open windows
      setActiveChatWindows(prev => {
        if (prev.length > 0) return prev; // don't overwrite already-open windows
        return all.filter(s => s.status === 'active' && s.agent_id === user?.id);
      });
    } catch { /* silent */ }
    setLoadingChats(false);
  }, [token, user?.id]);

  // ── Load tickets ────────────────────────────────────────────────────────────
  const loadTickets = useCallback(async (status = ticketFilter) => {
    setLoadingTickets(true);
    try {
      const res = await fetch(`${API_BASE}/support/admin/tickets?status=${status}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTickets(data.tickets || []);
      setTotalTickets(data.total || 0);
    } catch { /* silent */ }
    setLoadingTickets(false);
  }, [token, ticketFilter]);

  // ── Load history ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async (agentId = historyAgentFilter) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (agentId) params.set('agent_id', agentId);
      const res = await fetch(`${API_BASE}/support/admin/history?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data.sessions || []);
      setHistoryTotal(data.total || 0);
    } catch { /* silent */ }
    setLoadingHistory(false);
  }, [token, historyAgentFilter]);

  // Load agents list for history filter
  const loadAgentsList = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/support/admin/agents/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAllAgents(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, [token, isAdmin]);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { if (activeTab === 'tickets') loadTickets(); }, [activeTab]);
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
      loadAgentsList();
    }
  }, [activeTab]);

  // ── Accept incoming chat ────────────────────────────────────────────────────
  const acceptChat = (incoming) => {
    if (activeChatWindows.length >= 5) { alert('You can only handle 5 chats simultaneously.'); return; }
    if (socketRef.current) socketRef.current.emit('support:accept_chat', { session_id: incoming.session_id });
    const tempSession = {
      id: incoming.session_id, status: 'active',
      topic: incoming.topic, agent_joined_at: new Date().toISOString(),
      customer: { full_name: incoming.user_name },
    };
    setActiveChatWindows(prev => prev.find(s => s.id === incoming.session_id) ? prev : [...prev, tempSession]);
    setIncomingChats(prev => prev.filter(c => c.session_id !== incoming.session_id));
  };

  // ── Accept transferred chat ─────────────────────────────────────────────────
  const acceptTransfer = (transfer) => {
    if (activeChatWindows.length >= 5) { alert('You can only handle 5 chats simultaneously.'); return; }
    if (socketRef.current) socketRef.current.emit('support:accept_transfer', { session_id: transfer.session_id });
    const tempSession = {
      id: transfer.session_id, status: 'active',
      topic: 'Transferred Chat', agent_joined_at: new Date().toISOString(),
      customer: { full_name: transfer.customer_id || 'Customer' },
    };
    setActiveChatWindows(prev => prev.find(s => s.id === transfer.session_id) ? prev : [...prev, tempSession]);
    setIncomingTransfers(prev => prev.filter(t => t.session_id !== transfer.session_id));
    // Load full session info
    setTimeout(loadSessions, 1000);
  };

  const closeChatWindow   = (sessionId) => setActiveChatWindows(prev => prev.filter(s => s.id !== sessionId));
  const handleTicketUpdated = (updated) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    setSelectedTicket(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  };

  // Filtered history
  const filteredHistory = historySearch
    ? history.filter(s =>
        s.customer?.full_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
        s.topic?.toLowerCase().includes(historySearch.toLowerCase()) ||
        s.agent?.name?.toLowerCase().includes(historySearch.toLowerCase())
      )
    : history;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customer Service</h1>
          <p className="text-sm text-gray-500">
            {activeChatWindows.length}/5 active chats · {incomingChats.length} waiting
          </p>
        </div>
        <button
          onClick={() => { loadSessions(); if (activeTab === 'tickets') loadTickets(); if (activeTab === 'history') loadHistory(); }}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Incoming Transfer Notifications */}
      {incomingTransfers.length > 0 && (
        <div className="mb-4 flex-shrink-0 space-y-2">
          {incomingTransfers.map(transfer => (
            <div key={transfer.session_id} className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <ArrowRightLeft size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Chat Transfer from {transfer.from_agent_name}</p>
                  {transfer.note && <p className="text-xs text-gray-500 mt-0.5">Note: {transfer.note}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setIncomingTransfers(prev => prev.filter(t => t.session_id !== transfer.session_id))}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Decline
                </button>
                <button
                  onClick={() => acceptTransfer(transfer)}
                  disabled={activeChatWindows.length >= 5}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  Accept Transfer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4 flex-shrink-0">
        {[
          { id: 'live',    label: 'Live Chats',     badge: incomingChats.length + activeChatWindows.length },
          { id: 'tickets', label: 'Trouble Tickets', badge: null },
          { id: 'history', label: 'Chat History',    badge: null },
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

      {/* ══════════════════ LIVE CHATS TAB ══════════════════ */}
      {activeTab === 'live' && (
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          {/* Left sidebar */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
            {/* Incoming chats */}
            {incomingChats.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 px-1">
                  Incoming ({incomingChats.length})
                </p>
                {incomingChats.map(incoming => (
                  <div key={incoming.session_id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
                        {incoming.user_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{incoming.user_name}</p>
                        <p className="text-xs text-gray-500 truncate">{incoming.topic}</p>
                        <p className="text-[10px] text-amber-600 mt-0.5">Waiting: {timeAgo(incoming.waiting_since)}</p>
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
                    onClick={() => {}}
                    className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 mb-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.customer?.full_name || 'Customer'}</p>
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

          {/* Right: Chat windows */}
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

      {/* ══════════════════ TICKETS TAB ══════════════════ */}
      {activeTab === 'tickets' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            {['open','in_progress','pending_approval','resolved','closed'].map(s => (
              <button
                key={s}
                onClick={() => { setTicketFilter(s); loadTickets(s); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors
                  ${ticketFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400">{totalTickets} total</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingTickets ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle size={28} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No {ticketFilter.replace(/_/g,' ')} tickets</p>
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
                    <tr key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-3 py-2.5"><span className="font-mono text-xs font-bold text-blue-700">{ticket.ticket_number}</span></td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{ticket.customer?.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{ticket.customer?.client_id || ''}</p>
                      </td>
                      <td className="px-3 py-2.5 capitalize text-gray-700">{ticket.category}</td>
                      <td className="px-3 py-2.5"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="px-3 py-2.5 text-gray-600">{ticket.raised_by_agent?.name || '—'}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={ticket.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">{timeAgo(ticket.created_at)}</td>
                      <td className="px-3 py-2.5"><ChevronRight size={14} className="text-gray-400" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ CHAT HISTORY TAB ══════════════════ */}
      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-shrink-0">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search by customer, topic, agent..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {isAdmin && (
              <div className="relative">
                <select
                  value={historyAgentFilter}
                  onChange={e => { setHistoryAgentFilter(e.target.value); loadHistory(e.target.value); }}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                >
                  <option value="">All Agents</option>
                  {allAgents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
            <span className="text-xs text-gray-400 ml-auto">{historyTotal} total sessions</span>
          </div>

          {/* History table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <History size={28} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No chat history found</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {isAdmin ? 'No ended sessions match your filters.' : 'You have no completed chats yet.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    {['Customer','Topic','Agent','Started','Ended By','Duration',''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredHistory.map(session => (
                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{session.customer?.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{session.customer?.client_id || ''}</p>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[180px]">
                        <p className="truncate text-xs">{session.topic || '—'}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs text-gray-700">{session.agent?.name || '—'}</p>
                        <p className="text-[10px] text-gray-400">{session.agent?.email || ''}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{timeAgo(session.started_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize
                          ${session.ended_by === 'user' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {session.ended_by || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{formatDuration(session.session_duration_seconds)}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setViewSession(session)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors"
                        >
                          <Eye size={12} /> View
                        </button>
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

      {/* Chat history transcript viewer */}
      {viewSession && (
        <ChatHistoryModal
          session={viewSession}
          token={token}
          onClose={() => setViewSession(null)}
        />
      )}
    </div>
  );
}
