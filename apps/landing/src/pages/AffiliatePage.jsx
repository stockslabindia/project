import SEO from '../components/SEO';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, DollarSign, Gift, ArrowRight } from 'lucide-react';

export default function AffiliatePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const affiliateSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Stocks Lab Affiliate Program",
    "description": "Join the Stocks Lab Partner Network and earn competitive commissions by referring new traders.",
    "provider": {
      "@type": "Organization",
      "name": "Stocks Lab",
      "url": "https://stockslab.live"
    }
  };

  return (
    <>
      <SEO 
        title="Affiliate Program" 
        description="Join the Trade Smarter Affiliate Program and earn high commissions by referring new traders." 
        url="/affiliate" 
        schema={affiliateSchema}
      />
      <main className="pt-20 pb-20 bg-slate-50 min-h-screen">
        
        {/* Hero Section */}
        <section className="relative py-24 lg:py-32 bg-slate-900 text-white overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-[10%] -left-[10%] w-[60%] h-[70%] rounded-full bg-primary/20 blur-[120px]" />
            <div className="absolute bottom-[0%] -right-[10%] w-[50%] h-[60%] rounded-full bg-purple-600/20 blur-[100px]" />
          </div>

          <motion.div 
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-[10%] top-[20%] opacity-10 hidden lg:block"
          >
            <Users size={300} />
          </motion.div>

          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl mx-auto"
            >
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-purple-300 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase mb-8">
                <Gift size={16} />
                <span>Partner Program</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold mb-6 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-primary">
                Become a Stocks Lab Affiliate
              </h1>
              <p className="text-xl md:text-2xl text-slate-300 leading-relaxed max-w-3xl mx-auto font-light mb-10">
                Passionate traders in your audience? Submit your details below and discover best-in-class benefits & commissions. Join our thriving network & start earning today!
              </p>
              <button 
                onClick={() => document.getElementById('apply').scrollIntoView({ behavior: 'smooth' })}
                className="bg-primary hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:-translate-y-1 transition-all mx-auto flex items-center justify-center space-x-2"
              >
                <span>Apply Now</span>
                <ArrowRight size={20} />
              </button>
            </motion.div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Why Partner With Us?</h2>
              <p className="text-lg text-slate-600">We offer one of the most competitive affiliate programs in the financial industry, designed to maximize your earning potential.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-xl hover:border-primary/20 transition-all group"
              >
                <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <DollarSign size={28} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">High Commissions</h3>
                <p className="text-slate-600 leading-relaxed">Earn lucrative CPA and revenue share models. The more active traders you bring, the higher your reward tier.</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-xl hover:border-primary/20 transition-all group"
              >
                <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp size={28} className="text-primary" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Real-Time Tracking</h3>
                <p className="text-slate-600 leading-relaxed">Access an advanced affiliate portal to track your clicks, conversions, and commissions in real-time with full transparency.</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-xl hover:border-primary/20 transition-all group"
              >
                <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Users size={28} className="text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Marketing Support</h3>
                <p className="text-slate-600 leading-relaxed">Get access to premium marketing materials, banners, landing pages, and a dedicated affiliate manager to help you scale.</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Application Form */}
        <section id="apply" className="py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100"
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Apply for Partnership</h2>
                <p className="text-slate-500 font-medium">Fill out the details below and our affiliate team will review your application.</p>
              </div>

              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">First Name *</label>
                    <input type="text" placeholder="John" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Last Name *</label>
                    <input type="text" placeholder="Doe" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email Address *</label>
                    <input type="email" placeholder="john@example.com" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Phone Number *</label>
                    <input type="tel" placeholder="+1 234 567 890" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Primary Traffic Source *</label>
                  <input type="url" placeholder="Website URL, YouTube Channel, or Social Media Link" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white" required />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Estimated Monthly Audience / Traffic</label>
                  <select className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary outline-none bg-slate-50 text-slate-700 font-medium">
                    <option>Less than 10,000</option>
                    <option>10,000 - 50,000</option>
                    <option>50,000 - 100,000</option>
                    <option>100,000+</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button className="w-full bg-primary hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:-translate-y-1 transition-all">
                    Submit Application
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </section>

      </main>
    </>
  );
}
