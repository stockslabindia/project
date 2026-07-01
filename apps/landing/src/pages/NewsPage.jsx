import SEO from '../components/SEO';
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, TrendingUp, Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NewsPage() {
  const container = useRef(null);
  const calendarContainer = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);

    // Initialize TradingView News Widget
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = `
        {
          "feedMode": "all_symbols",
          "isTransparent": false,
          "displayMode": "regular",
          "width": "100%",
          "height": "800",
          "colorTheme": "light",
          "locale": "en"
        }`;
      container.current.appendChild(script);
    }

    // Initialize TradingView Economic Calendar Widget
    if (calendarContainer.current && !calendarContainer.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = `
        {
          "colorTheme": "light",
          "isTransparent": false,
          "width": "100%",
          "height": "600",
          "locale": "en",
          "importanceFilter": "-1,0,1",
          "currencyFilter": "USD,EUR,GBP,JPY,AUD,CAD,CHF,INR"
        }`;
      calendarContainer.current.appendChild(script);
    }
  }, []);

  const blogs = [
    {
      title: "The Truth About Dabba Trading in India & Safer Alternatives",
      excerpt: "Learn what dabba trading is, why it's illegal, and how to use safe, high-performance simulated trading platforms instead.",
      date: "Oct 24, 2026",
      category: "Market Education",
      image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      link: "/blog/what-is-dabba-trading"
    },
    {
      title: "Tradex1 Review 2026: Why Top Traders Are Switching",
      excerpt: "Discover the hidden fees, server latency issues, and why Stocks Lab is considered the best alternative in India.",
      date: "Oct 18, 2026",
      category: "Platform Review",
      image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      link: "/blog/tradex1-review"
    },
    {
      title: "Markettrade Platform Review: Pros, Cons, and Alternatives",
      excerpt: "A detailed review of the Markettrade platform. Find out about its hidden fees, customer service issues, and discover better alternatives.",
      date: "Oct 12, 2026",
      category: "Platform Review",
      image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      link: "/blog/markettrade-review"
    }
  ];

  return (
    <>
      <SEO title="Market News & Analysis" description="Stay updated with the latest market news, economic events, and expert trading analysis." url="/news" />
    <main className="pt-20 pb-20 bg-slate-50 min-h-screen">
      
      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[70%] rounded-full bg-blue-600/20 blur-[120px]" />
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium mb-6">
              <Newspaper size={16} />
              <span>Market Insights & Updates</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              News & Blogs
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed">
              Stay ahead of the market with real-time financial news, expert trading strategies, and in-depth market analysis.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row gap-12">
            
            {/* Live News Feed (Left/Main Column) */}
            <div className="w-full lg:w-7/12 xl:w-8/12">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 flex items-center space-x-3">
                    <TrendingUp className="text-primary" size={32} />
                    <span>Live Market News</span>
                  </h2>
                  <p className="text-slate-500 mt-2">Auto-updating feed of global financial events.</p>
                </div>
                <span className="hidden md:inline-flex items-center space-x-1 text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Live</span>
                </span>
              </div>
              
              {/* TradingView Widget Container */}
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[800px]">
                <div className="tradingview-widget-container" ref={container}>
                  <div className="tradingview-widget-container__widget"></div>
                </div>
              </div>
            </div>

            {/* Proprietary Blogs (Right/Sidebar Column) */}
            <div className="w-full lg:w-5/12 xl:w-4/12">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900">Featured Blogs</h2>
                <p className="text-slate-500 mt-2">Expert guides and trading strategies.</p>
              </div>

              <div className="space-y-8">
                {blogs.map((blog, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white rounded-2xl overflow-hidden shadow-lg shadow-slate-200/40 border border-slate-100 hover:-translate-y-1 hover:shadow-xl transition-all group cursor-pointer block"
                  >
                    <Link to={blog.link} className="block h-full w-full">
                      <div className="h-48 overflow-hidden relative">
                        <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-transparent transition-colors z-10"></div>
                        <img 
                          src={blog.image} 
                          alt={blog.title} 
                          loading="lazy"
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-4 left-4 z-20">
                          <span className="bg-primary/90 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                            {blog.category}
                          </span>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center space-x-2 text-slate-400 text-sm mb-3">
                          <Calendar size={14} />
                          <span>{blog.date}</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-primary transition-colors leading-tight">
                          {blog.title}
                        </h3>
                        <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                          {blog.excerpt}
                        </p>
                        <span className="text-primary font-bold text-sm flex items-center space-x-1 group-hover:space-x-2 transition-all">
                          <span>Read Article</span>
                          <ArrowRight size={16} />
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 text-center bg-slate-100 rounded-2xl p-6 border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-2">Want to write for us?</h4>
                <p className="text-sm text-slate-600 mb-4">We are always looking for expert traders to share their insights.</p>
                <Link to="/contact" className="text-primary font-bold hover:underline">Contact Editorial Team</Link>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Economic Calendar Section */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center space-x-2 text-primary font-bold mb-4">
                <Calendar size={24} />
                <span className="text-xl">Global Economic Calendar</span>
              </div>
              <p className="text-slate-600 text-lg">
                Track market-moving events in real-time. Don't let interest rate decisions or employment data catch you off guard.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden min-h-[600px]">
              <div className="tradingview-widget-container" ref={calendarContainer}>
                <div className="tradingview-widget-container__widget"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  
    </>
  );
}
