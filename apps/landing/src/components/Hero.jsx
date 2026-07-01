import React from 'react';
import { ArrowRight, BarChart2, Zap, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Background decoration with animated orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-slate-50">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, -50, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-300/40 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -50, 0],
            y: [0, 50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-300/30 blur-[120px]" 
        />
      </div>

      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Text Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-md border border-blue-100 text-primary px-3 py-1 rounded-full text-sm font-medium mb-6 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span>India's #1 Dabba Trading & Broker Alternative</span>
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Best Stock Broker Alternative</span> in India
            </h1>
            
            <p className="text-lg text-slate-600 mb-4 leading-relaxed">
              Tired of Tradex1 and Markettrade crashing? Switch to Stocks Lab for zero brokerage simulated trading, ultra-fast matching speeds, and a reliable interface built for professional traders.
            </p>

            <p className="text-sm font-bold text-slate-500 mb-8 uppercase tracking-widest">
              Zero Latency • Zero Brokerage • Risk-Free Paper Trading
            </p>
            
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-10">
              <Link to="/register" className="bg-primary hover:bg-blue-700 text-white px-8 py-3.5 rounded-lg font-medium shadow-xl shadow-blue-500/20 hover:-translate-y-1 transition-all flex items-center justify-center space-x-2">
                <span>Start Trading</span>
                <ArrowRight size={18} />
              </Link>
              <Link to="/register" className="bg-white/80 backdrop-blur-md hover:bg-white text-slate-700 border border-slate-200 px-8 py-3.5 rounded-lg font-medium shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex items-center justify-center">
                Create Account
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200">
              <div>
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <Zap size={16} className="text-primary" />
                  <span className="text-sm font-medium">Execution</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">&lt;10ms</div>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <BarChart2 size={16} className="text-primary" />
                  <span className="text-sm font-medium">Uptime</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">99.9%</div>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <Globe size={16} className="text-primary" />
                  <span className="text-sm font-medium">Markets</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">10k+</div>
              </div>
            </div>
          </motion.div>

          {/* Image/Mockup */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative lg:ml-10"
          >
            {/* Abstract UI representation instead of placeholder image */}
            <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white overflow-hidden transform hover:-translate-y-2 transition-transform duration-500">
              {/* Fake App Header */}
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="text-xs font-medium text-slate-500">NIFTY 50 • 22,450.50 <span className="text-profit">+0.85%</span></div>
              </div>
              
              {/* Fake App Body */}
              <div className="p-5 flex space-x-4">
                {/* Watchlist Sidebar */}
                <div className="w-1/3 hidden md:block space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm text-slate-800">{['RELIANCE', 'HDFCBANK', 'TCS', 'INFY'][i-1]}</span>
                        <span className={`text-xs font-medium ${i % 2 === 0 ? 'text-loss' : 'text-profit'}`}>
                          {i % 2 === 0 ? '-1.2%' : '+2.4%'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{[2950.45, 1450.20, 3980.15, 1420.60][i-1]}</div>
                    </div>
                  ))}
                </div>

                {/* Main Chart Area */}
                <div className="flex-1 space-y-4">
                  {/* Fake Chart */}
                  <div className="h-48 bg-slate-50 rounded-lg border border-slate-100 flex items-end relative overflow-hidden px-2 pb-2 space-x-1">
                     {/* Dynamic Bars */}
                     {[...Array(20)].map((_, i) => (
                       <motion.div 
                          key={i} 
                          className={`w-full rounded-t-sm opacity-80 ${i % 3 === 0 ? 'bg-loss' : 'bg-profit'}`} 
                          initial={{ height: "10%" }}
                          animate={{ height: [`${20 + Math.random() * 20}%`, `${40 + Math.random() * 40}%`, `${20 + Math.random() * 20}%`] }}
                          transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
                       />
                     ))}
                     {/* Overlay Line */}
                     <svg className="absolute inset-0 w-full h-full drop-shadow-xl" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d="M0,80 Q10,70 20,60 T40,50 T60,30 T80,40 T100,20" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                     </svg>
                  </div>
                  
                  {/* Order Buttons */}
                  <div className="flex space-x-3">
                    <button className="flex-1 bg-profit text-white py-2 rounded font-medium text-sm">BUY</button>
                    <button className="flex-1 bg-loss text-white py-2 rounded font-medium text-sm">SELL</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-6 top-1/4 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-xl border border-white/50"
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shadow-inner">
                  <ArrowRight size={16} className="text-profit -rotate-45" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Profit</div>
                  <div className="text-sm font-bold text-slate-800">+$450.20</div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -right-6 bottom-1/4 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-xl border border-white/50 hidden md:block"
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shadow-inner">
                   <Zap size={16} className="text-primary" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Execution</div>
                  <div className="text-sm font-bold text-slate-800">4ms</div>
                </div>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </div>

      {/* Infinite Scrolling Marquee Ticker */}
      <div className="absolute bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 py-3 overflow-hidden z-20 flex">
        <motion.div 
          className="flex whitespace-nowrap space-x-8 px-4"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ ease: "linear", duration: 20, repeat: Infinity }}
        >
          {/* Double the array for seamless infinite scroll */}
          {[1, 2].map((group) => (
            <div key={group} className="flex space-x-12 items-center">
              <span className="text-slate-300 font-medium font-mono text-sm">NIFTY <span className="text-profit">22,450.50 (+0.85%)</span></span>
              <span className="text-slate-300 font-medium font-mono text-sm">SENSEX <span className="text-profit">74,210.15 (+0.92%)</span></span>
              <span className="text-slate-300 font-medium font-mono text-sm">BANKNIFTY <span className="text-loss">48,150.80 (-0.15%)</span></span>
              <span className="text-slate-300 font-medium font-mono text-sm">AAPL <span className="text-profit">$175.20 (+1.2%)</span></span>
              <span className="text-slate-300 font-medium font-mono text-sm">TSLA <span className="text-loss">$190.50 (-2.4%)</span></span>
              <span className="text-slate-300 font-medium font-mono text-sm">BTC/USD <span className="text-profit">$68,400 (+5.1%)</span></span>
              <span className="text-slate-300 font-medium font-mono text-sm">GOLD <span className="text-profit">₹68,500 (+0.4%)</span></span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
