import SEO from '../components/SEO';
import React, { useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle, BarChart3, Globe2, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { useParams, Navigate, Link } from 'react-router-dom';
import { marketsData } from '../data/marketsData';
import CTA from '../components/CTA';

export default function MarketPage() {
  const { marketId: rawMarketId } = useParams();
  
  // Resolve legacy / sitemap parameter aliases
  const marketId = rawMarketId === 'stocks' ? 'nse' : 
                   rawMarketId === 'commodities' ? 'mcx' : 
                   rawMarketId;
  const data = marketsData[marketId];
  const chartContainer = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [marketId]);

  useEffect(() => {
    if (!data || !chartContainer.current) return;

    // Map marketId to a default TradingView symbol
    const symbolMap = {
      'nse': 'BSE:SENSEX',
      'mcx': 'MCX:GOLD1!',
      'forex': 'FX:EURUSD',
      'us-stocks': 'NASDAQ:AAPL',
      'mutual-funds': 'BSE:NIFTY'
    };

    const symbol = symbolMap[marketId] || 'NASDAQ:AAPL';

    // Clear existing script if any
    chartContainer.current.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = `
      {
        "autosize": true,
        "symbol": "${symbol}",
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "light",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "backgroundColor": "rgba(255, 255, 255, 1)",
        "gridColor": "rgba(241, 245, 249, 1)",
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "container_id": "tradingview_${marketId}"
      }`;
    chartContainer.current.appendChild(script);
  }, [marketId, data]);

  if (!data) {
    return <Navigate to="/" />;
  }

  const marketSchema = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "name": data.title,
    "description": data.description,
    "provider": {
      "@type": "Organization",
      "name": "Stocks Lab",
      "url": "https://stockslab.live"
    }
  };

  return (
    <>
      <SEO 
        title={data.title} 
        description={data.description} 
        url={`/markets/${marketId}`} 
        schema={marketSchema}
      />
      <main className="pt-20 pb-10">
        {/* Hero Section */}
        <section className="relative py-24 lg:py-36 bg-slate-900 text-white overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[70%] rounded-full bg-blue-600/20 blur-[120px]" />
            <div className="absolute bottom-[10%] -left-[10%] w-[40%] h-[50%] rounded-full bg-indigo-600/20 blur-[100px]" />
          </div>
          
          {/* Floating background icons */}
          <motion.div 
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-[10%] top-[20%] opacity-10 hidden lg:block"
          >
            <BarChart3 size={200} />
          </motion.div>
          
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium mb-6">
                <Globe2 size={16} />
                <span>Global Markets</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
                {data.title}
              </h1>
              <p className="text-xl text-slate-300 mb-10 leading-relaxed max-w-2xl">
                {data.description}
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link to="/" className="bg-primary hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-medium shadow-lg shadow-blue-500/20 hover:-translate-y-1 transition-all flex items-center justify-center space-x-2">
                  <span>Start Trading</span>
                  <ArrowRight size={18} />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Intro Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-6">{data.intro.heading}</h2>
                {data.intro.paragraphs.map((p, i) => (
                  <p key={i} className="text-slate-600 text-lg mb-4 leading-relaxed">{p}</p>
                ))}
              </div>
              <div className="bg-fintech-gray p-8 rounded-2xl border border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-6">Why Choose Us for {data.shortName}?</h3>
                <ul className="space-y-4">
                  {data.features.map((feature, i) => (
                    <li key={i} className="flex items-start space-x-3">
                      <CheckCircle className="text-primary mt-1 shrink-0" size={20} />
                      <div>
                        <span className="font-bold text-slate-800 block">{feature.title}</span>
                        <span className="text-slate-600 text-sm">{feature.desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Live Chart Section */}
        <section className="py-12 bg-slate-50 border-y border-slate-200">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="text-primary" size={24} />
                  <span>Live Advanced Chart</span>
                </h2>
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span>Real-Time Data</span>
                </div>
              </div>
              
              {/* Chart Container */}
              <div className="w-full h-[600px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div className="tradingview-widget-container h-full w-full" ref={chartContainer}>
                  <div className="tradingview-widget-container__widget h-full w-full" id={`tradingview_${marketId}`}></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Detailed Content */}
        <section className="py-20 bg-slate-50 border-y border-slate-200">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-4xl mx-auto space-y-12">
              {data.contentBlocks.map((block, i) => (
                <div key={i}>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">{block.heading}</h2>
                  <p className="text-slate-600 text-lg leading-relaxed">{block.content}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs */}
        {data.faqs && data.faqs.length > 0 && (
          <section className="py-20 bg-white">
            <div className="container mx-auto px-4 md:px-6">
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
              </div>
              <div className="max-w-3xl mx-auto space-y-6">
                {data.faqs.map((faq, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{faq.q}</h3>
                    <p className="text-slate-600">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <CTA />
      </main>
    </>
  );
}
