import SEO from '../components/SEO';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, ArrowRight, Zap, Shield, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ComparePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const features = [
    { name: 'Execution Speed', us: '< 10ms', competitor: '> 150ms' },
    { name: 'Uptime', us: '99.99%', competitor: '95.00%' },
    { name: 'Hidden Fees', us: 'None', competitor: 'High' },
    { name: 'Multi-Market Access', us: 'Yes (All in one)', competitor: 'No (Separate apps)' },
    { name: 'Withdrawal Time', us: 'Instant', competitor: '24-48 Hours' },
    { name: 'UI / UX', us: 'Modern & Clean', competitor: 'Outdated & Clunky' },
    { name: 'Customer Support', us: '24/7 Priority', competitor: 'Slow / Email only' }
  ];

  const compareSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Stocks Lab",
    "description": "The best broker and trading platform in India. A superior alternative to Tradex1 and Markettrade with sub-10ms execution latency.",
    "brand": {
      "@type": "Brand",
      "name": "Stocks Lab"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "INR"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "12540"
    }
  };

  return (
    <>
      <SEO 
        title="Compare Stocks Lab vs Tradex1 & Markettrade" 
        description="See why Stocks Lab is rated the best broker in India. Compare our features, execution speed, and fees against Tradex1 and Markettrade." 
        url="/compare" 
        schema={compareSchema}
      />
      
      <main className="pt-20 pb-20 bg-slate-50 min-h-screen">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-28 bg-slate-900 text-white overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-[50%] h-[100%] rounded-full bg-primary/20 blur-[120px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[60%] rounded-full bg-blue-600/20 blur-[100px]" />
          </div>

          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                The Best Alternative to <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">Tradex1</span> & <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">Markettrade</span>
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed mb-10">
                Stop losing money to slow execution and hidden fees. See why thousands of Indian traders are switching to Stocks Lab for a superior trading experience.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Feature Comparison</h2>
              <p className="text-slate-600 text-lg">We let our platform speak for itself.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
              <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200 p-6 items-center">
                <div className="font-bold text-slate-500 uppercase tracking-wider text-sm">Feature</div>
                <div className="font-bold text-primary text-xl text-center">Stocks Lab</div>
                <div className="font-bold text-slate-400 text-xl text-center">Tradex1 / Markettrade</div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {features.map((feature, idx) => (
                  <div key={idx} className="grid grid-cols-3 p-6 items-center hover:bg-slate-50 transition-colors">
                    <div className="font-semibold text-slate-800">{feature.name}</div>
                    <div className="text-center font-bold text-emerald-600 flex items-center justify-center space-x-2">
                      <Check size={20} className="text-emerald-500" />
                      <span>{feature.us}</span>
                    </div>
                    <div className="text-center font-medium text-slate-500 flex items-center justify-center space-x-2">
                      <X size={20} className="text-red-400" />
                      <span>{feature.competitor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="py-10 bg-white">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-2xl bg-blue-50/50 border border-blue-100 text-center">
                <div className="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">Institutional Speed</h3>
                <p className="text-slate-600">No more requotes or slippage. Our matching engine handles thousands of orders per second flawlessly.</p>
              </div>
              <div className="p-8 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">100% Transparent</h3>
                <p className="text-slate-600">What you see is what you get. Zero hidden account maintenance or software charges.</p>
              </div>
              <div className="p-8 rounded-2xl bg-purple-50/50 border border-purple-100 text-center">
                <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <TrendingUp size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">Built for India</h3>
                <p className="text-slate-600">Rated as the best broker platform in India with seamless UPI and instant bank withdrawals.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Ready to make the switch?</h2>
            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
              Join the fastest growing community of traders who have already moved away from outdated platforms.
            </p>
            <Link to="/register" className="inline-flex items-center space-x-2 bg-primary hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:-translate-y-1 transition-all text-lg">
              <span>Open Your Account Now</span>
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
