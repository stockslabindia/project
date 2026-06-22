import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Users, DollarSign, BarChart3, ShieldCheck, 
  HelpCircle, Mail, Lock, Loader2, ArrowRight, TrendingUp 
} from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: DollarSign,
      title: "Up to 7% Revenue Share",
      desc: "Earn high-percentage commission on client deposits and continuous trade volume.",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    },
    {
      icon: BarChart3,
      title: "Real-time CRM & Leads",
      desc: "Instantly submit, track, and monitor customer conversions and client activity.",
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
    },
    {
      icon: Users,
      title: "Direct YouTube & Telegram Links",
      desc: "Generate tracking URLs to redirect followers directly to registration and lock in attribution.",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20"
    },
    {
      icon: ShieldCheck,
      title: "Secure Backoffice Portal",
      desc: "Withdraw earnings to UPI/Bank accounts securely with transparent automated ledger tracking.",
      color: "text-teal-400 bg-teal-500/10 border-teal-500/20"
    }
  ];

  return (
    <div className="min-h-screen w-full bg-[#090D1A] bg-mesh-gradient flex flex-col justify-between relative overflow-hidden">
      
      {/* Background glowing elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-blue-500/10 rounded-full blur-[130px] animate-pulse-glow" />

      {/* Navbar Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <span className="text-lg font-black tracking-wider text-white font-sans uppercase">Stocks<span className="text-emerald-400">Lab</span></span>
            <span className="block text-[9px] text-emerald-400/70 uppercase tracking-widest font-bold -mt-1 font-sans">Partner Network</span>
          </div>
        </div>
        <a href="mailto:support@stockslab.live" className="text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1">
          <HelpCircle size={14} /> Contact Support
        </a>
      </header>

      {/* Main Hero Grid */}
      <main className="w-full max-w-7xl mx-auto px-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10 py-8">
        
        {/* Left Side: Welcoming Content */}
        <section className="lg:col-span-7 flex flex-col justify-center space-y-8 lg:pr-6 text-left">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
              ★ OFFICIAL AFFILIATE &amp; IB PARTNER HUB
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight font-sans tracking-tight">
              Grow Your Audience.<br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400 bg-clip-text text-transparent">
                Earn Exponential Rewards.
              </span>
            </h1>
            <p className="text-base text-slate-400 max-w-xl font-medium">
              StocksLab welcomes premium signal providers, YouTubers, sub-brokers, and financial influencers. Access institutional-grade commission rates, instant payouts, and dynamic dashboards.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="glass-panel p-4 rounded-xl flex gap-3.5 items-start hover:border-slate-800 transition-colors">
                  <div className={`p-2 rounded-lg border ${b.color} flex-shrink-0`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-0.5">{b.title}</h3>
                    <p className="text-xs text-slate-400 leading-normal">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Side: Central Glassmorphic Login Hero */}
        <section className="lg:col-span-5 flex justify-center items-center w-full">
          <div className="glass-panel glass-panel-glow w-full max-w-[420px] rounded-2xl p-8 relative animate-float">
            
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-tr-2xl pointer-events-none" />
            
            <div className="text-center mb-6">
              <h2 className="text-xl font-extrabold text-white tracking-tight">Partner Sign In</h2>
              <p className="text-xs text-slate-400 mt-1">Enter your admin-provided credentials to access your dashboard</p>
            </div>

            {error && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-xs font-semibold mb-4 leading-normal flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5 font-bold">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@example.com"
                    required
                    disabled={loading}
                    className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600 disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Authenticating Partner...
                  </>
                ) : (
                  <>
                    Sign In to Backoffice
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center border-t border-slate-900 z-10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-[11px] text-slate-500 font-medium">
          © {new Date().getFullYear()} StocksLab India Inc. All rights reserved.
        </p>
        <div className="flex gap-4 text-[11px] text-slate-500 font-medium">
          <a href="#" className="hover:text-slate-300">Privacy Policy</a>
          <span>·</span>
          <a href="#" className="hover:text-slate-300">Terms of Use</a>
          <span>·</span>
          <a href="#" className="hover:text-slate-300">Affiliate Agreement</a>
        </div>
      </footer>

    </div>
  );
}
