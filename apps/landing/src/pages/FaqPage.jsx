import SEO from '../components/SEO';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ChevronDown, MessageSquare, Search, PhoneCall } from 'lucide-react';
import { Link } from 'react-router-dom';

const FaqAccordion = ({ question, answer, isOpen, onClick }) => {
  return (
    <div className="border border-slate-200 rounded-2xl mb-4 overflow-hidden bg-white hover:border-primary/30 transition-colors shadow-sm">
      <button 
        onClick={onClick}
        className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
      >
        <span className={`font-bold text-lg pr-8 transition-colors ${isOpen ? 'text-primary' : 'text-slate-800'}`}>
          {question}
        </span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${isOpen ? 'bg-primary text-white rotate-180' : 'bg-slate-100 text-slate-500'}`}>
          <ChevronDown size={18} />
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const faqs = [
    {
      category: "Getting Started",
      questions: [
        {
          q: "How do I open a trading account?",
          a: "Opening an account is extremely fast and entirely paperless. Simply click on 'Create Account', enter your email and phone number, complete a quick verification, and your account will be activated within 1 minute. No extensive paperwork required."
        },
        {
          q: "What documents are required for registration?",
          a: "You only need basic identification details to get started. For higher deposit limits and specific global markets, you may be prompted to upload standard KYC documents (Government ID & Proof of Address) directly from your dashboard."
        },
        {
          q: "Is there a demo account available?",
          a: "Yes! We offer a Free Demo Account loaded with virtual funds. It perfectly simulates real market conditions, allowing you to practice strategies and get comfortable with our platform before investing real money."
        }
      ]
    },
    {
      category: "Fees & Charges",
      questions: [
        {
          q: "What are your brokerage charges?",
          a: "Zero. We believe you should keep 100% of your profits. We do not charge traditional percentage-based brokerage fees. You only pay standard, transparent clearing/regulatory taxes where applicable."
        },
        {
          q: "Are there any hidden account maintenance fees?",
          a: "Absolutely not. Stocks Lab has no hidden account opening fees, no annual maintenance charges (AMC), and no software usage fees."
        }
      ]
    },
    {
      category: "Trading & Execution",
      questions: [
        {
          q: "How much margin/leverage do you provide?",
          a: "We provide industry-leading margin facilities up to 500x depending on the specific asset class and your account tier. This allows you to trade much higher volumes with lesser capital."
        },
        {
          q: "Which markets can I trade on?",
          a: "Stocks Lab is a unified multi-market platform. From a single dashboard, you can trade Indian Equities (NSE), F&O, Commodities (MCX), Global Forex, Cryptocurrencies, and major US Stocks & Indices."
        }
      ]
    },
    {
      category: "Deposits & Withdrawals",
      questions: [
        {
          q: "How long do withdrawals take?",
          a: "We process withdrawals instantly. Once you initiate a withdrawal request, the funds are usually transferred to your linked bank account via IMPS/NEFT within minutes. There are no arbitrary holding periods."
        },
        {
          q: "What payment methods are supported?",
          a: "We support a wide variety of instant deposit methods including UPI, Net Banking, IMPS/RTGS, and direct wire transfers. Deposits reflect in your trading wallet within seconds."
        }
      ]
    },
    {
      category: "Comparisons",
      questions: [
        {
          q: "What makes Stocks Lab a better alternative to Tradex1?",
          a: "Unlike Tradex1, which often suffers from high latency during volatile hours, Stocks Lab runs on an institutional-grade matching engine ensuring <10ms execution. We also offer superior UI, no hidden charges, and multi-market access from a single unified wallet."
        },
        {
          q: "Why should I switch from Markettrade?",
          a: "Markettrade traders frequently report downtime and delayed withdrawals. Stocks Lab guarantees 99.9% uptime and processes instant IMPS/NEFT withdrawals. We are rated as the best broker platform in India because we prioritize trader experience and transparency."
        }
      ]
    }
  ];

  // Flatten and filter FAQs based on search
  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      faq => 
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
        faq.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.flatMap(cat => cat.questions).map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };

  return (
    <>
      <SEO 
        title="FAQ & Help Center" 
        description="Find answers to common questions about trading, deposits, withdrawals, and account security." 
        url="/faq" 
        schema={faqSchema}
      />
    <main className="pt-20 pb-20 bg-slate-50 min-h-screen">
      
      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-[50%] h-[100%] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[60%] rounded-full bg-purple-600/20 blur-[100px]" />
        </div>

        <motion.div 
          animate={{ rotate: -10, scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[10%] top-[10%] opacity-10 hidden lg:block"
        >
          <HelpCircle size={250} />
        </motion.div>

        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-blue-300 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase mb-8">
              <MessageSquare size={16} />
              <span>Help Center</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed mb-10">
              Everything you need to know about trading with Stocks Lab. Find answers to common questions about accounts, margins, and more.
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="text-slate-400" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search for an answer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-xl placeholder-slate-400 font-medium transition-all"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Accordions */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
              <HelpCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-2xl font-bold text-slate-700 mb-2">No results found</h3>
              <p className="text-slate-500">We couldn't find any answers matching "{searchQuery}". Try different keywords.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {filteredFaqs.map((category, catIdx) => (
                <div key={catIdx}>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center text-sm">
                      {catIdx + 1}
                    </span>
                    <span>{category.category}</span>
                  </h2>
                  <div className="space-y-4">
                    {category.questions.map((faq, qIdx) => {
                      const absoluteIndex = `${catIdx}-${qIdx}`;
                      return (
                        <FaqAccordion 
                          key={absoluteIndex}
                          question={faq.q}
                          answer={faq.a}
                          isOpen={openIndex === absoluteIndex}
                          onClick={() => setOpenIndex(openIndex === absoluteIndex ? null : absoluteIndex)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Still Need Help CTA */}
      <section className="py-10 pb-20">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="bg-primary rounded-3xl p-8 md:p-12 shadow-2xl shadow-blue-500/20 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6">
              <PhoneCall size={32} className="text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 relative z-10">Still have questions?</h2>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto relative z-10">
              Can't find the answer you're looking for? Our dedicated support team is available 24/7 to help you out.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 relative z-10">
              <Link to="/contact" className="bg-white text-primary hover:bg-slate-50 px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all w-full sm:w-auto">
                Contact Support
              </Link>
              <a href="mailto:support@stockslab.live" className="bg-blue-800/50 hover:bg-blue-700/50 backdrop-blur-sm border border-blue-400/30 text-white px-8 py-3.5 rounded-xl font-bold transition-all w-full sm:w-auto">
                Email Us
              </a>
            </div>
          </div>
        </div>
      </section>

    </main>
    </>
  );
}
