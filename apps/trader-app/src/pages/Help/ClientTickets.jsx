import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Send, AlertCircle, CheckCircle, Clock,
  ChevronRight, MessageSquare, ShieldAlert, BadgeHelp, HelpCircle
} from 'lucide-react';
import Card from '../../components/ui/Card';
import { api } from '../../services/api';
import { cn } from '../../utils/helpers';

const CATEGORIES = [
  { value: 'deposit', label: 'Deposit Issues' },
  { value: 'withdrawal', label: 'Withdrawal Issues' },
  { value: 'trading', label: 'Trading & Orders' },
  { value: 'kyc', label: 'KYC & Verification' },
  { value: 'account', label: 'Account Settings' },
  { value: 'other', label: 'Other Complaints' }
];

export default function ClientTickets() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('open'); // 'open' or 'closed'
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Creation form state
  const [isCreating, setIsCreating] = useState(false);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load tickets
  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getClientTickets();
      setTickets(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) {
      setError('Please select an issue category');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError('Please describe your issue in at least 10 characters');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.createClientTicket(category, description.trim());
      setSubmitSuccess(true);
      setCategory('');
      setDescription('');
      // Reload tickets
      await fetchTickets();
      setTimeout(() => {
        setSubmitSuccess(false);
        setIsCreating(false);
        setActiveTab('open');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(t => t.status === activeTab);

  const getCategoryLabel = (val) => {
    return CATEGORIES.find(c => c.value === val)?.label || val.toUpperCase();
  };

  const getCategoryColor = (val) => {
    switch (val) {
      case 'deposit': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'withdrawal': return 'text-violet-500 bg-violet-500/10 border-violet-500/20';
      case 'trading': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'kyc': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'account': return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => isCreating ? setIsCreating(false) : navigate('/help')} 
              className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle"
            >
              <ArrowLeft size={18} className="text-text-primary" />
            </button>
            <h1 className="text-base font-bold text-text-primary">
              {isCreating ? 'Create Support Ticket' : 'Support Tickets'}
            </h1>
          </div>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <Plus size={14} />
              <span>Raise Ticket</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 max-w-lg w-full mx-auto space-y-3 pb-8">
        {isCreating ? (
          <Card padding="p-4" className="border border-border/30">
            {submitSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center animate-bounce">
                  <CheckCircle size={28} />
                </div>
                <h3 className="text-base font-bold text-text-primary">Ticket Created!</h3>
                <p className="text-xs text-text-muted">
                  Your ticket has been raised successfully. Support will review it within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Select Issue Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-background border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all cursor-pointer"
                  >
                    <option value="" disabled>-- Choose issue type --</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Describe your issue</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide details about the issue. Include dates, transaction numbers (UTR), or screenshots details to help us investigate faster..."
                    rows={6}
                    maxLength={1000}
                    className="w-full bg-background border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all resize-none"
                  />
                  <div className="text-right text-[10px] text-text-muted">
                    {description.length}/1000 characters
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-start gap-2.5 text-red-500">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    <span className="text-xs font-medium">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/15 hover:bg-primary/95 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Submit Ticket</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </Card>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex bg-surface p-1 rounded-xl border border-border/30">
              <button
                onClick={() => setActiveTab('open')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                  activeTab === 'open'
                    ? "bg-background text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                Open Tickets ({tickets.filter(t => t.status === 'open').length})
              </button>
              <button
                onClick={() => setActiveTab('closed')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                  activeTab === 'closed'
                    ? "bg-background text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                Closed Tickets ({tickets.filter(t => t.status === 'closed').length})
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-start gap-2.5 text-red-500">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span className="text-xs font-medium">{error}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-text-muted">Loading tickets...</span>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
                <div className="w-16 h-16 bg-surface border border-border/30 rounded-2xl flex items-center justify-center text-text-muted">
                  {activeTab === 'open' ? <HelpCircle size={28} /> : <CheckCircle size={28} />}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-text-primary">
                    No {activeTab} tickets
                  </h3>
                  <p className="text-xs text-text-muted max-w-xs mx-auto">
                    {activeTab === 'open' 
                      ? "If you have any issues with deposits, withdrawals or trading, feel free to raise a ticket."
                      : "Closed tickets will appear here once resolved."}
                  </p>
                </div>
                {activeTab === 'open' && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/95 transition-colors"
                  >
                    Raise Your First Ticket
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((ticket) => (
                  <Card key={ticket.id} padding="p-4" className="border border-border/30 hover:border-border/50 transition-colors">
                    <div className="flex items-center justify-between gap-2 border-b border-border/20 pb-2.5 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black tracking-wider text-text-primary bg-surface border border-border/40 px-2 py-0.5 rounded">
                          {ticket.ticket_number}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide",
                          getCategoryColor(ticket.category)
                        )}>
                          {getCategoryLabel(ticket.category)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-text-muted">
                        <Clock size={10} />
                        <span>{formatDate(ticket.created_at)}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                        {ticket.description}
                      </div>

                      {/* Admin Response section */}
                      {ticket.admin_response ? (
                        <div className="bg-surface/60 border border-primary/10 rounded-xl p-3 space-y-1.5 relative overflow-hidden">
                          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
                          <div className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-wider">
                            <MessageSquare size={11} className="text-primary animate-pulse" />
                            <span>Response from Support</span>
                          </div>
                          <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                            {ticket.admin_response}
                          </p>
                        </div>
                      ) : ticket.status === 'open' ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1.5 rounded-lg">
                          <Clock size={11} className="flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                          <span>Our support team is reviewing your ticket (expected within 24h)</span>
                        </div>
                      ) : null}

                      {ticket.status === 'closed' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-1.5 rounded-lg">
                          <CheckCircle size={11} className="flex-shrink-0" />
                          <span>Ticket closed and resolved on {formatDate(ticket.closed_at)}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
