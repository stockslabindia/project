import SEO from '../components/SEO';
import React, { useState, useEffect } from 'react';
import { Calculator, IndianRupee, ArrowRight, Percent, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function CalculatorPage() {
  const [assetClass, setAssetClass] = useState('equity');
  const [price, setPrice] = useState('1000');
  const [quantity, setQuantity] = useState('100');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const marginMultipliers = {
    equity: 5,     // 5x
    options: 1,    // 1x (Usually premium needs full margin, but selling gets leverage)
    futures: 10,   // 10x
    forex: 500,    // 500x
    commodity: 20  // 20x
  };

  const leverage = marginMultipliers[assetClass];
  
  // Calculations
  const numPrice = parseFloat(price) || 0;
  const numQty = parseFloat(quantity) || 0;
  
  const totalValue = numPrice * numQty;
  const marginRequired = totalValue / leverage;
  const leveragePercentage = (1 / leverage) * 100;

  const calculatorSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Stocks Lab Margin Calculator",
    "description": "Calculate exact margin requirements across all asset classes before you trade with up to 500x leverage.",
    "applicationCategory": "FinancialApplication",
    "operatingSystem": "All",
    "browserRequirements": "Requires HTML5. Requires JavaScript.",
    "provider": {
      "@type": "Organization",
      "name": "Stocks Lab",
      "url": "https://stockslab.live"
    }
  };

  return (
    <>
      <SEO 
        title="Trading Calculator" 
        description="Calculate your potential profits, margins, and pip values with our advanced trading calculator." 
        url="/calculator" 
        schema={calculatorSchema}
      />
      <main className="pt-20 pb-20 bg-slate-50 min-h-screen">
        
        {/* Hero Section */}
        <section className="relative py-20 lg:py-28 bg-slate-900 text-white overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-[50%] h-[100%] rounded-full bg-blue-600/20 blur-[120px]" />
          </div>

          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-[10%] top-[20%] opacity-10 hidden lg:block"
          >
            <Calculator size={200} />
          </motion.div>

          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-blue-300 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase mb-8">
                <Percent size={16} />
                <span>Smart Tools</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Margin Calculator
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed mb-10 max-w-2xl mx-auto">
                Calculate exact margin requirements across all asset classes before you trade. Trade higher volumes with a fraction of the capital.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Calculator Section */}
        <section className="py-16 -mt-10 relative z-20">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col md:flex-row">
              
              {/* Input Controls */}
              <div className="flex-1 p-8 md:p-12 bg-white border-b md:border-b-0 md:border-r border-slate-100">
                <h3 className="text-2xl font-bold text-slate-900 mb-8">Trade Details</h3>
                
                <div className="space-y-6">
                  {/* Asset Class Selector */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Asset Class</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'equity', label: 'Equity Intraday' },
                        { id: 'futures', label: 'Index Futures' },
                        { id: 'options', label: 'Options' },
                        { id: 'commodity', label: 'Commodity' },
                        { id: 'forex', label: 'Global Forex' }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={() => setAssetClass(item.id)}
                          className={`py-2 px-3 text-sm font-medium rounded-xl border transition-all ${
                            assetClass === item.id 
                            ? 'bg-primary text-white border-primary shadow-md shadow-blue-500/20' 
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Input */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Current Price / Strike</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <IndianRupee size={16} className="text-slate-400" />
                      </div>
                      <input 
                        type="number" 
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Quantity Input */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Quantity (Lots / Shares)</label>
                    <input 
                      type="number" 
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Results Panel */}
              <div className="flex-1 p-8 md:p-12 bg-slate-50 relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
                
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-8">Margin Requirement</h3>
                
                <div className="space-y-6">
                  <div>
                    <p className="text-slate-500 mb-1">Total Trade Value</p>
                    <p className="text-3xl font-bold text-slate-800">
                      {totalValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  <div className="w-full h-px bg-slate-200"></div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-slate-500 mb-1">Leverage Provided</p>
                      <p className="text-xl font-bold text-primary">{leverage}x</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 mb-1">Margin Percentage</p>
                      <p className="text-xl font-bold text-emerald-600">{leveragePercentage.toFixed(2)}%</p>
                    </div>
                  </div>

                  <div className="w-full h-px bg-slate-200"></div>

                  <div className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-blue-500/20 relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 opacity-10">
                      <Calculator size={100} className="transform translate-x-1/4 translate-y-1/4" />
                    </div>
                    <p className="text-blue-200 font-medium mb-1">Margin Required to Trade</p>
                    <p className="text-4xl md:text-5xl font-black mb-2">
                      {marginRequired.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-blue-300 flex items-center space-x-1 mt-4">
                      <Info size={14} />
                      <span>Based on standard intraday conditions.</span>
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 text-center">
                  <Link to="/register" className="w-full bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-bold shadow-xl transition-all flex items-center justify-center space-x-2 group">
                    <span>Fund Account & Trade</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>

              </div>
            </div>
          </div>
        </section>
        
      </main>
    </>
  );
}
