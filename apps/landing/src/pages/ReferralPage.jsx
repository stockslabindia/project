import SEO from '../components/SEO';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Share2, Wallet, Gift, ArrowRight, CheckCircle2, Copy, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ReferralPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const steps = [
    {
      icon: <Share2 size={24} className="text-blue-500" />,
      title: "Share Your Link",
      desc: "Get your unique referral link from your dashboard and share it with friends via WhatsApp, social media, or email."
    },
    {
      icon: <Users size={24} className="text-purple-500" />,
      title: "Friends Join & Trade",
      desc: "Your friends sign up using your link and start executing their first trades on our zero-latency platform."
    },
    {
      icon: <Wallet size={24} className="text-emerald-500" />,
      title: "Earn Lifetime Rewards",
      desc: "You earn a massive 20% revenue share from their trading fees for life. Payouts are credited instantly to your wallet."
    }
  ];

  return (
    <>
      <SEO title="Referral Program" description="Invite friends to Trade Smarter and earn rewards for every successful referral." url="/referral" />
    <main className="pt-20 pb-20 bg-slate-50 min-h-screen">
      
      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[10%] -left-[10%] w-[60%] h-[70%] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute bottom-[-10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-emerald-500/20 blur-[100px]" />
        </div>

        <motion.div 
          animate={{ scale: [1, 1.05, 1], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[5%] top-[10%] opacity-10 hidden lg:block"
        >
          <Gift size={350} />
        </motion.div>

        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-blue-300 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase mb-8">
              <Users size={16} />
              <span>Refer & Earn Program</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold mb-6 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-primary">
              Invite Friends. <br />Earn Together.
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 leading-relaxed max-w-3xl mx-auto font-light mb-10">
              Share the ultimate trading experience. Give your friends advanced trading tools and earn a <strong className="text-white">20% lifetime revenue share</strong> on every trade they make.
            </p>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-2 rounded-2xl max-w-2xl mx-auto flex flex-col sm:flex-row items-center">
              <div className="flex-1 w-full px-4 py-3 text-left">
                <p className="text-xs text-blue-300 uppercase font-bold tracking-wider mb-1">Your Referral Link</p>
                <p className="text-white font-mono truncate">https://stockslab.live/ref/LOGIN_TO_VIEW</p>
              </div>
              <Link to="/register" className="w-full sm:w-auto bg-primary hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl transition-all flex items-center justify-center space-x-2 mt-2 sm:mt-0">
                <Copy size={18} />
                <span>Get My Link</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How The Referral Program Works</h2>
            <p className="text-lg text-slate-600">Three simple steps to start building your passive income stream.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative max-w-5xl mx-auto">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-24 left-1/6 right-1/6 h-0.5 bg-slate-100 z-0"></div>
            
            {steps.map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="relative z-10 flex flex-col items-center text-center group"
              >
                <div className="w-20 h-20 bg-white border-4 border-slate-50 rounded-full flex items-center justify-center shadow-xl shadow-slate-200/50 mb-6 group-hover:border-primary/20 group-hover:scale-110 transition-all duration-300">
                  {step.icon}
                </div>
                <div className="bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold absolute top-14 -right-2 md:right-auto md:left-1/2 md:translate-x-6 shadow-md border-2 border-white z-20">
                  {idx + 1}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Rewards Highlight */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-primary rounded-3xl p-8 md:p-12 shadow-2xl shadow-blue-500/20 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 md:w-2/3 mb-8 md:mb-0">
              <h3 className="text-3xl md:text-4xl font-bold mb-4">Unlimited Earning Potential</h3>
              <p className="text-blue-100 text-lg leading-relaxed mb-6">
                Unlike other platforms that cap your earnings or limit payouts to a few months, our referral program offers a <strong className="text-white">lifetime revenue share</strong>. As long as your referred friends are trading, you are earning.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center space-x-3">
                  <CheckCircle2 className="text-emerald-400" size={20} />
                  <span>No cap on the number of friends you can refer</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle2 className="text-emerald-400" size={20} />
                  <span>Instant daily payouts directly to your trading wallet</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle2 className="text-emerald-400" size={20} />
                  <span>Transparent tracking dashboard for all your referrals</span>
                </li>
              </ul>
            </div>
            
            <div className="relative z-10 md:w-1/3 flex justify-center">
              <div className="w-48 h-48 bg-white/10 backdrop-blur-md rounded-full border-8 border-white/20 flex flex-col items-center justify-center shadow-2xl">
                <span className="text-5xl font-black text-white mb-1">20%</span>
                <span className="text-sm uppercase tracking-widest font-bold text-blue-200">For Life</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Ready to Start Earning?</h2>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">Log in to your account to get your unique referral link and start building your network today.</p>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link to="/register" className="w-full sm:w-auto bg-primary hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:-translate-y-1 transition-all flex items-center justify-center space-x-2">
              <span>Create Account</span>
              <ArrowRight size={18} />
            </Link>
            <a href="https://web.stockslab.live/login" className="w-full sm:w-auto bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-bold shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex items-center justify-center space-x-2">
              <LogOut size={18} />
              <span>Log In to Dashboard</span>
            </a>
          </div>
        </div>
      </section>

    </main>
  
    </>
  );
}
