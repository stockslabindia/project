import SEO from '../components/SEO';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, MapPin, Phone, MessageCircle, Send, Globe } from 'lucide-react';

export default function ContactPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Contact Stocks Lab",
    "description": "Get in touch with the Stocks Lab support team, available 24/7 for any trading or account inquiries.",
    "url": "https://stockslab.live/contact",
    "mainEntity": {
      "@type": "Organization",
      "name": "Stocks Lab",
      "url": "https://stockslab.live",
      "logo": "https://stockslab.live/favicon.svg",
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "telephone": "+91-97697-68500",
          "contactType": "customer service",
          "areaServed": "IN",
          "availableLanguage": ["English", "Hindi"]
        }
      ],
      "address": [
        {
          "@type": "PostalAddress",
          "streetAddress": "333, Pali Pathar, Khar West",
          "addressLocality": "Mumbai",
          "addressRegion": "Maharashtra",
          "postalCode": "400052",
          "addressCountry": "IN"
        },
        {
          "@type": "PostalAddress",
          "streetAddress": "Pjazza Mifsud Bonnici",
          "addressLocality": "Marsascala",
          "addressCountry": "MT"
        }
      ]
    }
  };

  return (
    <>
      <SEO 
        title="Contact Us" 
        description="Get in touch with our 24/7 support team for any trading or account inquiries." 
        url="/contact" 
        schema={contactSchema}
      />
      <main className="pt-20 pb-20 bg-slate-50 min-h-screen">
        
        {/* Hero Section */}
        <section className="relative py-20 lg:py-28 bg-slate-900 text-white overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-[50%] h-[100%] rounded-full bg-blue-600/20 blur-[120px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[60%] rounded-full bg-emerald-500/20 blur-[100px]" />
          </div>

          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
            className="absolute -right-20 -top-20 opacity-5 hidden lg:block"
          >
            <Globe size={400} />
          </motion.div>

          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium mb-6">
                <MessageCircle size={16} />
                <span>We're Here to Help</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Get in Touch
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed">
                Have questions, need trading assistance, or want to discuss partnership opportunities? Our expert support team is available 24/7.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Main Content */}
        <section className="container mx-auto px-4 md:px-6 -mt-10 relative z-20">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            
            {/* Contact Information Cards */}
            <div className="w-full lg:w-5/12 space-y-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
              >
                <h3 className="text-2xl font-bold text-slate-900 mb-8">Contact Details</h3>
                
                <div className="space-y-8">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center shrink-0">
                      <Phone size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Call Us Directly</p>
                      <a href="tel:+919769768500" className="text-lg font-medium text-slate-800 hover:text-primary transition-colors">+91 97697 68500</a>
                      <p className="text-sm text-slate-500 mt-1">Available Mon-Fri, 9am to 6pm</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center shrink-0">
                      <Mail size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Email Support</p>
                      <a href="mailto:info@markettrade.live" className="text-lg font-medium text-slate-800 hover:text-primary transition-colors">info@markettrade.live</a>
                      <p className="text-sm text-slate-500 mt-1">We aim to reply within 2 hours</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
              >
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Global Offices</h3>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <MapPin className="text-emerald-500 shrink-0 mt-1" size={24} />
                    <div>
                      <p className="font-bold text-slate-800">India HQ</p>
                      <p className="text-slate-600 leading-relaxed mt-1">333, Pali Pathar, Khar West,<br/>Mumbai, Maharashtra 400052</p>
                    </div>
                  </div>
                  
                  <div className="w-full h-px bg-slate-100"></div>

                  <div className="flex items-start space-x-4">
                    <MapPin className="text-emerald-500 shrink-0 mt-1" size={24} />
                    <div>
                      <p className="font-bold text-slate-800">European Branch</p>
                      <p className="text-slate-600 leading-relaxed mt-1">Pjazza Mifsud Bonnici,<br/>Marsascala, Malta</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Contact Form */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full lg:w-7/12 bg-white rounded-2xl p-8 md:p-12 shadow-xl shadow-slate-200/50 border border-slate-100"
            >
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Send us a Message</h2>
              <p className="text-slate-500 mb-8 font-medium">Fill out the form below and we'll get back to you shortly.</p>

              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">First Name</label>
                    <input 
                      type="text" 
                      placeholder="John" 
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Last Name</label>
                    <input 
                      type="text" 
                      placeholder="Doe" 
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="john.doe@example.com" 
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Subject</label>
                  <select className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white text-slate-700 font-medium">
                    <option>General Inquiry</option>
                    <option>Trading Assistance</option>
                    <option>Partnership/Affiliate</option>
                    <option>Account Support</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Message</label>
                  <textarea 
                    rows="5"
                    placeholder="How can we help you?" 
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white resize-none"
                  ></textarea>
                </div>

                <button className="w-full bg-primary hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:-translate-y-1 transition-all flex items-center justify-center space-x-2">
                  <span>Send Message</span>
                  <Send size={18} />
                </button>
              </form>
            </motion.div>

          </div>
        </section>

      </main>
    </>
  );
}
