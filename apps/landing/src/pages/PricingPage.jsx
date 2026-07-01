import SEO from '../components/SEO';
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, ShieldCheck, Zap, Percent } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import CTA from '../components/CTA';

export default function PricingPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const pricingPlans = [
    {
      title: "Equity Delivery",
      price: "₹0",
      subtitle: "per executed order",
      features: ["Zero brokerage for long-term investments", "No hidden DP charges on buying", "Free access to fundamental data"],
      color: "from-emerald-400 to-emerald-600",
      icon: <ShieldCheck size={24} className="text-white" />
    },
    {
      title: "Intraday & F&O",
      price: "₹0",
      subtitle: "absolutely free forever",
      features: ["Zero flat fees per executed order", "Access to 500x margin", "Free Advanced Charting (TradingView)"],
      color: "from-blue-500 to-blue-700",
      popular: true,
      icon: <Zap size={24} className="text-white" />
    }
  ];

  const comparisonData = [
    { feature: "Account Opening Fee", tradex: "Free", traditional: "₹500 - ₹1000" },
    { feature: "Annual Maintenance (AMC)", tradex: "₹0 (First Year)", traditional: "₹300 - ₹500/year" },
    { feature: "Equity Delivery Brokerage", tradex: "₹0", traditional: "0.3% to 0.5%" },
    { feature: "Intraday & F&O Brokerage", tradex: "₹0", traditional: "0.03% to 0.05% or Flat ₹20" },
    { feature: "Call & Trade Charges", tradex: "₹0", traditional: "₹100+ per order" },
    { feature: "Hidden Fees", tradex: "None", traditional: "High" }
  ];

  const pricingSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Stocks Lab Trading Account",
    "description": "High performance simulated and live-data trading platform in India with zero brokerage.",
    "image": "https://stockslab.live/og-image.png",
    "brand": {
      "@type": "Brand",
      "name": "Stocks Lab"
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "INR",
      "lowPrice": "0",
      "highPrice": "0",
      "offerCount": "2",
      "offers": [
        {
          "@type": "Offer",
          "name": "Equity Delivery Plan",
          "price": "0",
          "priceCurrency": "INR",
          "availability": "https://schema.org/InStock"
        },
        {
          "@type": "Offer",
          "name": "Intraday & F&O Plan",
          "price": "0",
          "priceCurrency": "INR",
          "availability": "https://schema.org/InStock"
        }
      ]
    }
  };

  return (
    <>
      <SEO 
        title="Pricing & Fees" 
        description="Transparent pricing with zero hidden fees. Compare our competitive spreads and commissions." 
        url="/pricing" 
        schema={pricingSchema}
      />
      <main className="pt-20 pb-10 min-h-screen bg-slate-50">
        {/* Hero Section */}
        <section className="relative py-24 lg:py-32 bg-slate-900 text-white overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[70%] rounded-full bg-blue-600/20 blur-[120px]" />
          </div>
          
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider mb-8">
                <Percent size={16} />
                <span>Transparent Pricing</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Pay Less. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Trade More.</span>
              </h1>
              <p className="text-xl text-slate-300 mb-10 leading-relaxed">
                We pioneered the discount broking model in India. Now, we are making it even better. Absolutely zero hidden charges.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-16 -mt-16 relative z-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {pricingPlans.map((plan, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className={`bg-white rounded-3xl shadow-xl border overflow-hidden relative ${plan.popular ? 'border-primary shadow-blue-500/20 md:-mt-8 md:mb-8' : 'border-slate-200'}`}
                >
                  {plan.popular && (
                    <div className="bg-primary text-white text-center py-2 text-sm font-bold tracking-wider uppercase">
                      Most Popular
                    </div>
                  )}
                  
                  <div className={`p-8 bg-gradient-to-br ${plan.color} relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full"></div>
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-6">
                      {plan.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.title}</h3>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-5xl font-black text-white">{plan.price}</span>
                    </div>
                    <p className="text-white/80 mt-2 font-medium">{plan.subtitle}</p>
                  </div>

                  <div className="p-8">
                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start space-x-3">
                          <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                          <span className="text-slate-700 font-medium">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/register" className={`w-full py-4 rounded-xl font-bold text-center block transition-all ${plan.popular ? 'bg-primary hover:bg-blue-700 text-white shadow-lg' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>
                      Open Free Account
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Stocks Lab vs Traditional Brokers</h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  See how much you save on every trade when you switch to India's most transparent brokerage.
                </p>
              </div>

              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-6 text-slate-500 font-bold uppercase tracking-wider text-sm border-b border-slate-200">Charges & Fees</th>
                        <th className="p-6 text-primary font-black text-xl border-b border-slate-200 bg-blue-50/50 w-1/3 text-center">Stocks Lab</th>
                        <th className="p-6 text-slate-500 font-bold uppercase tracking-wider text-sm border-b border-slate-200 text-center">Traditional Brokers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparisonData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 text-slate-800 font-medium">{row.feature}</td>
                          <td className="p-6 text-center font-bold text-emerald-600 bg-blue-50/30">
                            <div className="flex items-center justify-center space-x-2">
                              {row.tradex === 'None' || row.tradex === 'Free' ? <CheckCircle size={18} className="text-emerald-500" /> : null}
                              <span>{row.tradex}</span>
                            </div>
                          </td>
                          <td className="p-6 text-center text-slate-500">
                            <div className="flex items-center justify-center space-x-2">
                              {row.traditional === 'High' ? <XCircle size={18} className="text-red-400" /> : null}
                              <span>{row.traditional}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CTA />
      </main>
    </>
  );
}
