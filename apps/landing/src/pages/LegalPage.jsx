import SEO from '../components/SEO';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Navigate, Link } from 'react-router-dom';
import { legalData } from '../data/legalData';
import { ShieldCheck, FileText, ArrowLeft } from 'lucide-react';

export default function LegalPage() {
  const { pageId } = useParams();
  
  // Resolve legacy or sitemap alias URLs
  const resolvedPageId = pageId === 'terms' ? 'terms-conditions' : 
                         pageId === 'privacy' ? 'privacy-policy' : 
                         pageId;
  const data = legalData[resolvedPageId];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pageId]);

  if (!data) {
    return <Navigate to="/" />;
  }

  return (
    <>
      <SEO title={data.title} description={`Review the ${data.title.toLowerCase()} and compliance documentation for Stocks Lab.`} url={`/legal/${resolvedPageId}`} />
      <main className="pt-24 pb-20 bg-slate-50 min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
        
        {/* Back Button */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 text-slate-500 hover:text-primary transition-colors font-medium">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          
          {/* Header */}
          <div className="bg-slate-900 px-8 py-12 relative overflow-hidden text-center sm:text-left">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 flex flex-col sm:flex-row items-center sm:space-x-6"
            >
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner mb-6 sm:mb-0">
                {pageId === 'privacy-policy' ? (
                  <ShieldCheck size={32} className="text-emerald-400" />
                ) : (
                  <FileText size={32} className="text-blue-400" />
                )}
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">
                  {data.title}
                </h1>
                <p className="text-slate-400 font-medium">
                  Last Updated: {data.lastUpdated}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-8 md:p-12 space-y-10">
            {data.sections.map((section, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: idx * 0.1 }}
              >
                <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                  {section.heading}
                </h2>
                
                {section.content && (
                  <p className="text-slate-600 leading-relaxed mb-4 text-lg">
                    {section.content}
                  </p>
                )}
                
                {section.list && (
                  <ul className="space-y-3 mt-4">
                    {section.list.map((item, i) => (
                      <li key={i} className="flex items-start space-x-3 text-slate-600 leading-relaxed">
                        <span className="text-primary font-bold mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </main>
  
    </>
  );
}
