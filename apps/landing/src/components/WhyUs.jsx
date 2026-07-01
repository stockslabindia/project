import React from 'react';
import { Zap, Shield, Globe, Eye } from 'lucide-react';

export default function WhyUs() {
  const features = [
    {
      icon: <Shield size={24} className="text-primary" />,
      title: "Secure Platform",
      description: "Advanced security protocols to keep your simulated trading environment safe."
    },
    {
      icon: <Eye size={24} className="text-primary" />,
      title: "Transparent System",
      description: "Clear and honest platform mechanics with no hidden surprises."
    },
    {
      icon: <Zap size={24} className="text-primary" />,
      title: "Fast Execution",
      description: "Experience ultra-low latency simulated trading with our fast matching engine."
    },
    {
      icon: <Globe size={24} className="text-primary" />,
      title: "Multi-Market Access",
      description: "Trade Equities, F&O, Commodities, and Currencies from a single unified account."
    }
  ];

  return (
    <section id="why-us" className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">The Best Dabba Trading & Broker Alternative</h2>
          <p className="text-slate-600 text-lg">
            Say goodbye to the frequent downtimes, slippage, and hidden charges of Markettrade and Tradex1. We offer a superior, risk-free simulated stock trading environment built on high-performance technology.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {features.map((feature, idx) => (
            <div 
              key={idx}
              className="p-6 rounded-2xl bg-fintech-gray border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
        
        <div className="text-center">
          <p className="text-sm font-medium text-slate-500 bg-slate-100 inline-block px-4 py-2 rounded-lg">
            This platform is for simulated trading purposes.
          </p>
        </div>
      </div>
    </section>
  );
}
