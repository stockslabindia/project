import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, HelpCircle, MessageCircle, Phone, Mail,
  ChevronDown, ChevronRight, ExternalLink, Search, Book,
  FileText, Headphones,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import { cn } from '../../utils/helpers';


const faqs = [
  {
    q: 'How do I deposit funds into my account?',
    a: 'You can add funds via UPI, NEFT, IMPS, or bank transfer from the Funds & Withdrawals section in your profile. UPI deposits are instant, while bank transfers may take up to 1 hour.',
  },
  {
    q: 'What are the trading hours?',
    a: 'NSE/BSE: 9:15 AM – 3:30 PM IST\nMCX: 9:00 AM – 11:30 PM IST\nForex: 24/5 (Sunday 5 PM – Friday 5 PM EST)\nUS Markets: 7:00 PM – 1:30 AM IST',
  },
  {
    q: 'How is margin calculated?',
    a: 'Margin = Trade Value / Leverage. For example, a ₹1,00,000 trade with 5x leverage requires ₹20,000 margin. Margin requirements vary by instrument and market conditions.',
  },
  {
    q: 'How do I withdraw my profits?',
    a: 'Navigate to Profile → Funds & Withdrawals → Withdraw. Enter the amount and confirm. Withdrawals are processed within 24 hours to your registered bank account.',
  },
  {
    q: 'What is the referral program?',
    a: 'Invite friends using your unique referral code. You earn commissions (10-25%) on their trading fees depending on your tier. Track earnings in Profile → Refer & Earn.',
  },
  {
    q: 'How do I reset my password?',
    a: 'Go to Profile → Security → Change Password. Enter your current password and set a new one. We recommend enabling 2FA for added security.',
  },
  {
    q: 'What instruments can I trade?',
    a: 'We offer NSE/BSE Stocks, NIFTY/BANKNIFTY F&O, MCX Commodities, Forex pairs, Precious Metals (Gold, Silver), and more. Check the Markets tab for all available instruments.',
  },
];

export default function Help() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFaqs = searchQuery
    ? faqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : faqs;

  return (
    <div className="">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle">
            <ArrowLeft size={18} className="text-text-primary" />
          </button>
          <h1 className="text-base font-bold text-text-primary">Help & Support</h1>
        </div>
      </header>

      <div className="px-3 space-y-2.5 pb-3 pt-2">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search help articles..."
            className="w-full bg-surface border border-border/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
          />
        </div>

        {/* Quick Contact */}
        <div className="grid grid-cols-2 gap-1.5">
          <Card padding="p-3" className="text-center cursor-pointer hover:bg-surface/80 transition-colors" onClick={() => navigate('/support-chat')}>
            <div className="w-8 h-8 mx-auto bg-blue-500/10 rounded-lg flex items-center justify-center mb-1.5">
              <MessageCircle size={14} className="text-blue-600" />
            </div>
            <p className="text-base font-bold text-text-primary">Live Chat</p>
            <p className="text-[11px] text-text-muted mt-0.5">24/7 Support</p>
          </Card>
          <Card padding="p-3" className="text-center cursor-pointer hover:bg-surface/80 transition-colors" onClick={() => window.location.href = 'mailto:support@stockslab.live'}>
            <div className="w-8 h-8 mx-auto bg-violet-500/10 rounded-lg flex items-center justify-center mb-1.5">
              <Mail size={14} className="text-violet-600" />
            </div>
            <p className="text-base font-bold text-text-primary">Email</p>
            <p className="text-[11px] text-text-muted mt-0.5">support@stockslab.live</p>
          </Card>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">Quick Links</h3>
          <Card padding="p-0">
            <div className="divide-y divide-border/20">
              {[
                { icon: Book, label: 'Trading Guide', subtitle: 'Learn the basics of trading', color: 'text-blue-600 bg-blue-500/10' },
                { icon: FileText, label: 'Fee Schedule', subtitle: 'Brokerage & other charges', color: 'text-emerald-600 bg-emerald-500/10' },
                { icon: Headphones, label: 'Raise a Ticket', subtitle: 'Report issues or complaints', color: 'text-amber-600 bg-amber-500/10', action: () => navigate('/client-tickets') },
              ].map(item => (
                <button 
                  key={item.label} 
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface/30 transition-colors touch-active-subtle"
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.color)}>
                    <item.icon size={14} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-base font-semibold text-text-primary">{item.label}</p>
                    <p className="text-sm text-text-muted mt-0.5">{item.subtitle}</p>
                  </div>
                  <ChevronRight size={14} className="text-text-muted/50" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* FAQs */}
        <div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">
            Frequently Asked Questions ({filteredFaqs.length})
          </h3>
          <Card padding="p-0">
            <div className="divide-y divide-border/20">
              {filteredFaqs.map((faq, i) => (
                <div key={i}>
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface/30 transition-colors touch-active-subtle"
                  >
                    <div className="w-5 h-5 bg-surface rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <HelpCircle size={11} className="text-primary" />
                    </div>
                    <p className="flex-1 text-base font-semibold text-text-primary leading-relaxed">{faq.q}</p>
                    <ChevronDown
                      size={14}
                      className={cn('text-text-muted/60 flex-shrink-0 mt-0.5 transition-transform', expandedFaq === i && 'rotate-180')}
                    />
                  </button>
                  {expandedFaq === i && (
                    <div className="px-3 pb-3 pl-10">
                      <p className="text-base text-text-secondary leading-relaxed whitespace-pre-line">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
