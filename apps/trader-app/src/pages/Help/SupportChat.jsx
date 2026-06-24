import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, X, MessageSquare, Clock, Plus,
  Send, Bot, User as UserIcon, CheckCircle, AlertCircle,
  Paperclip, FileText, Star
} from 'lucide-react';
import { useTradeStore } from '../../store/useTradeStore';
import { CHAT_SCRIPT, resolveMessage } from './chatScript';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const WS_URL   = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:4000';

// ─── Star Rating Helper Component ──────────────────────────────────────────────
function StarRating({ rating, onRatingChange, size = 24 }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRatingChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform duration-100 active:scale-90 focus:outline-none p-1"
        >
          <Star
            size={size}
            className={`transition-colors duration-150 ${
              star <= (hovered || rating)
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-300 hover:text-amber-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Rating Survey Card ────────────────────────────────────────────────────────
function RatingSurveyCard({ agentName, onSubmit, onSkip }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ rating, comment });
    } catch (err) {
      setError(err.message || 'Failed to submit rating');
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface border border-border/30 rounded-2xl p-5 shadow-md space-y-4 max-w-sm mx-auto my-4 text-center">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-text-primary">How did we do?</h4>
        <p className="text-xs text-text-muted">
          Please rate your chat experience with <span className="font-semibold text-text-primary">{agentName}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <StarRating rating={rating} onRatingChange={setRating} size={28} />

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add feedback / comments (optional)..."
          rows={3}
          maxLength={500}
          className="w-full bg-background border border-border/40 rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none"
        />

        {error && <p className="text-[10px] text-red-500">{error}</p>}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-2 border border-border/50 rounded-xl text-xs font-semibold text-text-primary hover:bg-background/80 transition-colors"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={rating === 0 || submitting}
            className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/95 disabled:opacity-40 transition-all"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Rated Display Component ───────────────────────────────────────────────────
function RatedDisplay({ rating, comment }) {
  return (
    <div className="bg-surface/50 border border-border/20 rounded-2xl p-4 max-w-sm mx-auto my-4 text-center space-y-2">
      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Your Rating</p>
      <div className="flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
          />
        ))}
      </div>
      {comment && (
        <p className="text-xs text-text-primary italic bg-background/50 rounded-xl px-3 py-2 border border-border/10 inline-block max-w-full whitespace-pre-wrap">
          "{comment}"
        </p>
      )}
    </div>
  );
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StatusBadge({ status }) {
  const map = {
    active:  { label: 'Active',  cls: 'bg-green-100 text-green-700' },
    waiting: { label: 'Waiting', cls: 'bg-amber-100 text-amber-700' },
    ended:   { label: 'Ended',   cls: 'bg-gray-100 text-gray-500'   },
  };
  const cfg = map[status] || map.ended;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Ticket Status Item ────────────────────────────────────────────────────────
function TicketItem({ ticket }) {
  const priorityColor = {
    low: 'text-gray-500', medium: 'text-blue-600',
    high: 'text-amber-600', urgent: 'text-red-600',
  };
  return (
    <div className="border border-border/30 rounded-xl p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-primary">{ticket.ticket_number}</span>
        <span className={`text-xs font-semibold capitalize ${priorityColor[ticket.priority]}`}>
          {ticket.priority}
        </span>
      </div>
      <p className="text-sm text-text-primary capitalize">{ticket.category}</p>
      <p className="text-xs text-text-muted line-clamp-2">{ticket.description}</p>
      <div className="flex items-center justify-between">
        <StatusBadge status={ticket.status} />
        <span className="text-[10px] text-text-muted">{formatTime(ticket.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, myName }) {
  if (msg.sender_type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-text-muted bg-surface/60 px-3 py-1 rounded-full border border-border/20">
          {msg.message}
        </span>
      </div>
    );
  }

  const isUser  = msg.sender_type === 'user';
  const isBot   = msg.sender_type === 'bot';
  const isAgent = msg.sender_type === 'agent';

  // Construct absolute file url if relative
  const fileUrl = msg.message && (msg.message.startsWith('http') || msg.message.startsWith('data:'))
    ? msg.message
    : `${WS_URL}${msg.message}`;

  const renderBubbleContent = () => {
    if (msg.message_type === 'image') {
      return (
        <div className={`rounded-2xl overflow-hidden border border-border/30 max-w-full
          ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
          <img
            src={fileUrl}
            alt="Uploaded attachment"
            className="max-w-xs max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(fileUrl, '_blank')}
          />
        </div>
      );
    }

    if (msg.message_type === 'document') {
      const filename = msg.message.split('/').pop() || 'document';
      return (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm border font-medium transition-colors
            ${isUser
              ? 'bg-primary text-white border-primary rounded-tr-sm hover:bg-primary/95'
              : 'bg-surface text-text-primary border-border/30 rounded-tl-sm hover:bg-surface/80'
            }`}
        >
          <FileText size={16} className={isUser ? 'text-white' : 'text-primary'} />
          <span className="truncate max-w-[150px] underline">{filename}</span>
          <span className="text-[10px] opacity-75">(open)</span>
        </a>
      );
    }

    return (
      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
        ${isUser
          ? 'bg-primary text-white rounded-tr-sm'
          : 'bg-surface border border-border/30 text-text-primary rounded-tl-sm'
        }`}>
        {msg.message}
      </div>
    );
  };

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-1
          ${isBot ? 'bg-primary/10' : 'bg-emerald-100'}`}>
          {isBot
            ? <Bot size={14} className="text-primary" />
            : <UserIcon size={14} className="text-emerald-600" />}
        </div>
      )}

      <div className={`max-w-[78%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender label */}
        {isAgent && (
          <span className="text-[10px] text-text-muted ml-1">{msg.agent_name || 'Agent'}</span>
        )}
        {isBot && (
          <span className="text-[10px] text-text-muted ml-1">Customer Support</span>
        )}
        {isUser && myName && (
          <span className="text-[10px] text-text-muted mr-1">{myName}</span>
        )}

        {/* Content */}
        {renderBubbleContent()}

        {/* Time */}
        <span className="text-[10px] text-text-muted px-1">{formatTime(msg.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Option Pills ──────────────────────────────────────────────────────────────
function OptionPills({ options, onSelect, disabled }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => !disabled && onSelect(opt)}
          disabled={disabled}
          className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors
            ${disabled
              ? 'border-border/20 text-text-muted/40 cursor-not-allowed'
              : 'border-border/60 text-text-primary hover:bg-primary hover:text-white hover:border-primary active:scale-95'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chat Timer ───────────────────────────────────────────────────────────────
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
  return (
    <span className="text-xs text-text-muted flex items-center gap-1">
      <Clock size={11} /> {m}:{s}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function SupportChat() {
  const navigate = useNavigate();
  const { user } = useTradeStore();
  // Token is stored in localStorage by the api service as 'tradex_access_token'
  const token = localStorage.getItem('tradex_access_token');
  const userName = user?.full_name || user?.name || 'You';

  // Tabs: 'home' | 'conversations'
  const [activeTab, setActiveTab] = useState('home');

  // Conversation history (past sessions)
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Active chat state
  const [chatView, setChatView] = useState(null); // null | 'bot' | 'live' | 'history'
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentNode, setCurrentNode] = useState(null);
  const [pillsDisabled, setPillsDisabled] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [agentName, setAgentName] = useState(null);
  const [agentJoinedAt, setAgentJoinedAt] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [userTickets, setUserTickets] = useState([]);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [sessionRating, setSessionRating] = useState(null);
  const [sessionComment, setSessionComment] = useState(null);
  const [rated, setRated] = useState(false);
  const [agentId, setAgentId] = useState(null);
  const [requestedLiveAgent, setRequestedLiveAgent] = useState(false);


  // Bot transcript accumulator (for sending to backend)
  const botTranscriptRef = useRef([]);

  // Socket ref
  const socketRef = useRef(null);

  // File upload refs & states
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Str = event.target.result;
      try {
        const res = await fetch(`${API_BASE}/support/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            file_base64: base64Str,
            filename: file.name
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload file');

        const messageType = file.type.startsWith('image/') ? 'image' : 'document';

        if (socketRef.current) {
          socketRef.current.emit('support:user_message', {
            session_id: sessionId,
            message: data.url,
            message_type: messageType
          });
        }

        const optimisticMsg = {
          id: `opt_media_${Date.now()}`,
          sender_type: 'user',
          message: data.url,
          message_type: messageType,
          created_at: new Date().toISOString(),
          _optimistic: true
        };
        setMessages(prev => [...prev, optimisticMsg]);
      } catch (err) {
        alert(err.message || 'Failed to upload attachment.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      alert('Failed to read file.');
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  // Scroll ref
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ── Load session history ────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/support/sessions/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setSessionsLoading(false);
  }, [token]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const socket = io(`${WS_URL}/support`, {
      auth: { token, role: 'user' },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      // If we have an active session, rejoin the room
      if (sessionId) {
        socket.emit('support:join_session', { session_id: sessionId });
      }
    });

    socket.on('support:session_started', ({ agent_name, agent_joined_at, agent_id }) => {
      setAgentName(agent_name);
      setAgentId(agent_id);
      setAgentJoinedAt(agent_joined_at);
      setSessionStatus('active');
      setPillsDisabled(true);
      // Add system message
      const systemMsg = {
        id: Date.now(),
        sender_type: 'system',
        message: `${agent_name} has joined the chat.`,
        message_type: 'system',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, systemMsg]);
    });

    socket.on('support:chat_transferred', ({ to_agent_name, to_agent_id }) => {
      setAgentName(to_agent_name);
      setAgentId(to_agent_id);
    });

    socket.on('support:new_message', (msg) => {
      setMessages(prev => {
        // Avoid duplicates (if saved via REST + socket)
        if (prev.find(m => m.id === msg.id)) return prev;
        
        // If it's a user message, look for matching optimistic message to replace
        if (msg.sender_type === 'user') {
          const optIdx = prev.findIndex(m => 
            m.id && 
            m.id.toString().startsWith('opt_') && 
            m.message === msg.message && 
            m.sender_type === 'user'
          );
          if (optIdx !== -1) {
            const next = [...prev];
            next[optIdx] = msg;
            return next;
          }
        }
        
        return [...prev, msg];
      });
    });

    socket.on('support:session_ended', ({ ended_by }) => {
      setSessionStatus('ended');
      const systemMsg = {
        id: Date.now(),
        sender_type: 'system',
        message: ended_by === 'agent' ? 'Agent has ended the chat.' : 'You ended the chat.',
        message_type: 'system',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, systemMsg]);
      loadSessions();
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [token, sessionId]);

  // ── Start new bot conversation ──────────────────────────────────────────────
  const startNewChat = () => {
    botTranscriptRef.current = [];
    setMessages([]);
    setInputText('');
    setPillsDisabled(false);
    setSessionId(null);
    setSessionStatus(null);
    setAgentName(null);
    setAgentJoinedAt(null);
    setSelectedTopic(null);
    setChatView('bot');
    setActiveTab('home');
    setSessionRating(null);
    setSessionComment(null);
    setRated(false);
    setAgentId(null);
    setRequestedLiveAgent(false);

    // Show the main menu
    const node = CHAT_SCRIPT.main_menu;
    const greeting = {
      id: 'bot_greeting',
      sender_type: 'bot',
      message: resolveMessage(node.message, user),
      message_type: 'options',
      options: node.options,
      created_at: new Date().toISOString(),
    };
    setMessages([greeting]);
    setCurrentNode(node);
  };

  // ── Handle bot option selection ──────────────────────────────────────────────
  const handleOptionSelect = async (option) => {
    if (pillsDisabled) return;
    setPillsDisabled(true);

    // Add user's choice as a message
    const userMsg = {
      id: `user_${Date.now()}`,
      sender_type: 'user',
      message: option.label,
      message_type: 'text',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    botTranscriptRef.current.push({ role: 'user', text: option.label });

    const nextNodeId = option.next;
    const nextNode   = CHAT_SCRIPT[nextNodeId];
    if (!nextNode) return;

    // Track topic for agent
    if (option.topic) setSelectedTopic(option.topic);

    await new Promise(r => setTimeout(r, 400)); // brief "typing" delay

    // Special actions
    if (nextNode.action === 'SHOW_TICKETS') {
      // Fetch and display the user's tickets
      try {
        const res = await fetch(`${API_BASE}/support/tickets/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tickets = await res.json();
        setUserTickets(tickets);

        const botMsg = {
          id: `bot_${Date.now()}`,
          sender_type: 'bot',
          message: tickets.length === 0
            ? 'You have no trouble tickets yet.'
            : `You have ${tickets.length} ticket(s):`,
          message_type: 'text',
          tickets,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, botMsg]);

        // Add back to main menu options
        setTimeout(() => {
          const menuMsg = {
            id: `bot_menu_${Date.now()}`,
            sender_type: 'bot',
            message: 'What else can I help you with?',
            message_type: 'options',
            options: [{ label: 'Main Menu', next: 'main_menu' }],
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, menuMsg]);
          setCurrentNode({ options: [{ label: 'Main Menu', next: 'main_menu' }] });
          setPillsDisabled(false);
        }, 300);
      } catch {
        setPillsDisabled(false);
      }
      return;
    }

    if (nextNode.action === 'REQUEST_AGENT') {
      const botMsg = {
        id: `bot_${Date.now()}`,
        sender_type: 'bot',
        message: nextNode.message,
        message_type: 'text',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMsg]);
      botTranscriptRef.current.push({ role: 'bot', text: nextNode.message });

      // Create session via REST
      try {
        const topicLabel = option.topic || selectedTopic || 'General';
        const res = await fetch(`${API_BASE}/support/sessions/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            topic: topicLabel,
            bot_transcript: botTranscriptRef.current,
          }),
        });
        const data = await res.json();
        setSessionId(data.session_id);
        setSessionStatus(data.status);
        setChatView('live');
        setRequestedLiveAgent(true);

        // Join socket room + broadcast to agents
        if (socketRef.current) {
          socketRef.current.emit('support:join_session', { session_id: data.session_id });
          socketRef.current.emit('support:request_agent', {
            session_id: data.session_id,
            user_name: userName,
            topic: topicLabel,
          });
        }
      } catch (err) {
        const errMsg = {
          id: `err_${Date.now()}`,
          sender_type: 'system',
          message: 'Failed to connect. Please try again.',
          message_type: 'system',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
        setPillsDisabled(false);
      }
      return;
    }

    // Normal navigation — show the next bot node
    const botMsg = {
      id: `bot_${Date.now()}`,
      sender_type: 'bot',
      message: resolveMessage(nextNode.message, user),
      message_type: nextNode.options ? 'options' : 'text',
      options: nextNode.options,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, botMsg]);
    botTranscriptRef.current.push({ role: 'bot', text: nextNode.message });
    setCurrentNode(nextNode);
    setPillsDisabled(false);
  };

  // ── Send a live message (when agent has joined or in bot/waiting phase) ────
  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');

    // Case 1: In 'bot' view (no session created yet)
    if (chatView === 'bot' && !sessionId) {
      const userMsg = {
        id: `user_${Date.now()}`,
        sender_type: 'user',
        message: text,
        message_type: 'text',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      botTranscriptRef.current.push({ role: 'user', text: text });

      try {
        const res = await fetch(`${API_BASE}/support/sessions/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            topic: 'AI Support',
            bot_transcript: botTranscriptRef.current,
          }),
        });
        const data = await res.json();
        setSessionId(data.session_id);
        setSessionStatus(data.status);
        setChatView('live');

        if (socketRef.current) {
          socketRef.current.emit('support:join_session', { session_id: data.session_id });
          socketRef.current.emit('support:user_message', {
            session_id: data.session_id,
            message: text,
          });
        }
      } catch (err) {
        const errMsg = {
          id: `err_${Date.now()}`,
          sender_type: 'system',
          message: 'Failed to connect. Please try again.',
          message_type: 'system',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
      }
      return;
    }

    // Case 2: In 'live' view, and session is either 'waiting' or 'active'
    if (sessionId && (sessionStatus === 'active' || sessionStatus === 'waiting')) {
      // Optimistic UI
      const optimisticMsg = {
        id: `opt_${Date.now()}`,
        sender_type: 'user',
        message: text,
        message_type: 'text',
        created_at: new Date().toISOString(),
        _optimistic: true,
      };
      setMessages(prev => [...prev, optimisticMsg]);

      if (socketRef.current) {
        socketRef.current.emit('support:user_message', {
          session_id: sessionId,
          message: text,
        });
      }
    }
  };

  const connectToLiveAgent = () => {
    if (!sessionId) return;
    setRequestedLiveAgent(true);
    if (socketRef.current) {
      socketRef.current.emit('support:request_agent', {
        session_id: sessionId,
        user_name: userName,
        topic: selectedTopic || 'General Inquiry',
      });
    }
  };

  // ── End chat ─────────────────────────────────────────────────────────────────
  const endChat = async () => {
    setEnding(true);
    try {
      if (sessionId && socketRef.current) {
        socketRef.current.emit('support:user_end_chat', { session_id: sessionId });
      }
      setSessionStatus('ended');
      setShowEndConfirm(false);
      await loadSessions();
    } catch { /* silent */ }
    setEnding(false);
  };

  // ── Load history session ──────────────────────────────────────────────────
  const openHistorySession = async (session) => {
    setChatView('history');
    setMessages([]);
    setSessionStatus(session.status);
    setAgentJoinedAt(session.agent_joined_at);
    setAgentName(session.agent_name || 'Agent');
    setAgentId(session.agent_id);
    setSessionId(session.id);
    setSessionRating(session.rating);
    setSessionComment(session.rating_comment);
    setRated(!!session.rating);

    try {
      const res = await fetch(`${API_BASE}/support/sessions/${session.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages || []);

      // If session is still active or waiting, resume it
      if (session.status === 'active' || session.status === 'waiting') {
        setSessionId(session.id);
        setSessionStatus(session.status);
        setChatView('live');
        if (session.status === 'waiting') {
          setRequestedLiveAgent(session.topic !== 'AI Support');
        }
        if (socketRef.current) {
          socketRef.current.emit('support:join_session', { session_id: session.id });
        }
      }
    } catch { /* silent */ }
  };

  const handleRatingSubmit = async ({ rating, comment }) => {
    try {
      const res = await fetch(`${API_BASE}/support/sessions/${sessionId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rating, rating_comment: comment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit rating');
      
      setSessionRating(rating);
      setSessionComment(comment);
      setRated(true);
      
      loadSessions();
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">

      {/* ── Global Header (when no chat open) ──────────────────────────────── */}
      {!chatView && (
        <header className="bg-primary safe-top flex-shrink-0">
          <div className="max-w-lg mx-auto flex items-center gap-3 px-3 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-white">Stocks Lab Support</h1>
              <p className="text-xs text-white/70">We are here to help you!</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-lg mx-auto flex border-t border-white/10">
            {[{ id: 'home', label: 'Home' }, { id: 'conversations', label: 'Conversation' }].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (tab.id === 'conversations') loadSessions(); }}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors
                  ${activeTab === tab.id
                    ? 'text-white border-b-2 border-white'
                    : 'text-white/50 hover:text-white/70'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>
      )}

      {/* ── Chat Header (when chat is open) ──────────────────────────────────── */}
      {chatView && (
        <header className="bg-primary safe-top shadow-sm flex-shrink-0">
          <div className="max-w-lg mx-auto flex items-center gap-3 px-3 py-3">
            <button
              onClick={() => {
                if (sessionStatus === 'active') {
                  setShowEndConfirm(true);
                } else {
                  setChatView(null);
                  setActiveTab('conversations');
                  loadSessions();
                }
              }}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                {agentName
                  ? <UserIcon size={14} className="text-white" />
                  : <Bot size={14} className="text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {agentName || 'Customer Support'}
                </p>
                <p className="text-[10px] text-white/70 truncate">
                  {agentName ? 'I can help you with any of your queries' : 'Automated support'}
                </p>
              </div>
            </div>
            {/* Timer when agent has joined */}
            {agentJoinedAt && sessionStatus === 'active' && (
              <ChatTimer startTime={agentJoinedAt} />
            )}
            {/* Talk to Human Agent button */}
            {sessionStatus === 'waiting' && !requestedLiveAgent && (
              <button
                onClick={connectToLiveAgent}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 active:scale-95 flex-shrink-0"
              >
                <UserIcon size={12} />
                Talk to Human
              </button>
            )}
            {/* End chat button when active or waiting */}
            {(sessionStatus === 'active' || sessionStatus === 'waiting') && (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title="End Chat"
              >
                <X size={15} className="text-white" />
              </button>
            )}
          </div>
        </header>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          HOME TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!chatView && activeTab === 'home' && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Blue hero area */}
          <div className="bg-primary h-40 flex-shrink-0" />

          {/* Chat with us card */}
          <div className="px-4 -mt-6">
            <button
              onClick={startNewChat}
              className="w-full bg-white rounded-2xl shadow-lg border border-border/10 flex items-center gap-3 px-4 py-4 hover:shadow-xl transition-shadow active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare size={20} className="text-primary" />
              </div>
              <span className="flex-1 text-left text-base font-semibold text-gray-800">
                Chat with us now
              </span>
              <ArrowLeft size={16} className="text-gray-400 rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CONVERSATIONS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!chatView && activeTab === 'conversations' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {sessionsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-20">
              <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-4">
                <MessageSquare size={36} className="text-text-muted/40" />
              </div>
              <p className="text-base font-semibold text-text-primary mb-1">No previous conversation</p>
              <p className="text-sm text-text-muted">Start a new chat to get help</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => openHistorySession(session)}
                  className="w-full text-left bg-surface border border-border/30 rounded-2xl px-4 py-3 hover:bg-surface/80 transition-colors active:scale-[0.99] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary line-clamp-1">
                      {session.topic || 'Support Chat'}
                    </p>
                    <StatusBadge status={session.status} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Clock size={10} />
                    <span>{formatTime(session.started_at)}</span>
                    {session.session_duration_seconds && (
                      <span>· {formatDuration(session.session_duration_seconds)}</span>
                    )}
                    {session.rating && (
                      <span className="flex items-center gap-0.5 text-amber-500 font-semibold ml-auto bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                        ★ {session.rating}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* New conversation button */}
          <div className="p-4 flex-shrink-0">
            <button
              onClick={startNewChat}
              className="w-full bg-primary text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.99] transition-all"
            >
              <Plus size={16} />
              New conversation
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CHAT VIEW (bot / live / history)
      ══════════════════════════════════════════════════════════════════════════ */}
      {chatView && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {messages.map((msg, i) => {
              // Render ticket list items inline
              if (msg.tickets && msg.tickets.length > 0) {
                return (
                  <div key={msg.id || i} className="space-y-2">
                    <MessageBubble msg={{ ...msg, tickets: undefined }} myName={userName} />
                    {msg.tickets.map(t => <TicketItem key={t.id} ticket={t} />)}
                  </div>
                );
              }
              return (
                <div key={msg.id || i}>
                  <MessageBubble msg={msg} myName={userName} />
                  {/* Render option pills right after the bot message that carries them */}
                  {msg.sender_type === 'bot' && msg.options && (
                    <div className="ml-9 mt-1">
                      <OptionPills
                        options={msg.options}
                        onSelect={handleOptionSelect}
                        disabled={pillsDisabled || sessionStatus === 'active' || sessionStatus === 'ended'}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Waiting for agent indicator */}
            {sessionStatus === 'waiting' && requestedLiveAgent && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-amber-700">Connecting to an agent...</span>
                </div>
              </div>
            )}

            {/* Ended indicator */}
            {sessionStatus === 'ended' && (
              <div className="flex justify-center py-2">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <CheckCircle size={12} className="text-emerald-500" />
                  Chat ended
                </div>
              </div>
            )}

            {/* Rating Survey / Display when ended */}
            {sessionStatus === 'ended' && agentName && (
              rated ? (
                sessionRating ? (
                  <RatedDisplay rating={sessionRating} comment={sessionComment} />
                ) : (
                  <div className="text-center py-2 text-xs text-text-muted italic">
                    Feedback skipped
                  </div>
                )
              ) : (
                <RatingSurveyCard
                  agentName={agentName}
                  onSubmit={handleRatingSubmit}
                  onSkip={() => setRated(true)}
                />
              )
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-border/30 px-3 py-3 bg-background safe-bottom">
            {uploading && (
              <div className="flex items-center gap-2 px-2 pb-2">
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-text-muted">Uploading attachment...</span>
              </div>
            )}
            {(sessionStatus === 'active' || sessionStatus === 'waiting' || chatView === 'bot') ? (
              <div className="flex items-end gap-2">
                {sessionStatus === 'active' && (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-10 h-10 border border-border/40 bg-surface rounded-xl flex items-center justify-center text-text-muted hover:bg-surface/85 transition-colors disabled:opacity-50"
                      title="Attach media or document"
                    >
                      <Paperclip size={16} />
                    </button>
                  </>
                )}
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={sessionStatus === 'active' ? "Type a message..." : "Ask AI Assistant or type a message..."}
                  disabled={uploading}
                  className="flex-1 bg-surface border border-border/40 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || uploading}
                  className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            ) : sessionStatus === 'ended' ? (
              <div className="text-center">
                {(!agentName || rated) ? (
                  <button
                    onClick={startNewChat}
                    className="text-primary text-sm font-semibold hover:underline"
                  >
                    Start new conversation
                  </button>
                ) : (
                  <p className="text-xs text-text-muted/60 py-1 italic font-medium">
                    Please submit your rating above to continue
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-text-muted/60 py-1">
                Choose an option above
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── End Chat Confirmation Modal ──────────────────────────────────────── */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-background rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-base font-bold text-text-primary">End Chat?</p>
                <p className="text-sm text-text-muted">This will close the current conversation.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 border border-border/50 rounded-xl text-sm font-semibold text-text-primary hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={endChat}
                disabled={ending}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {ending ? 'Ending...' : 'End Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
