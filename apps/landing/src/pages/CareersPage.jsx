import SEO from '../components/SEO';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, Clock, ArrowRight, Heart, Zap, Globe, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CareersPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const benefits = [
    {
      icon: <Globe size={24} className="text-blue-500" />,
      title: "Work from Anywhere",
      desc: "We are a remote-first company. Work from the comfort of your home or any of our global hubs."
    },
    {
      icon: <Heart size={24} className="text-pink-500" />,
      title: "Comprehensive Health",
      desc: "Top-tier medical, dental, and vision insurance for you and your dependents."
    },
    {
      icon: <Zap size={24} className="text-yellow-500" />,
      title: "Learning Budget",
      desc: "Annual stipend for courses, books, and conferences to accelerate your career growth."
    },
    {
      icon: <Users size={24} className="text-emerald-500" />,
      title: "Diverse & Inclusive",
      desc: "Join a team of passionate individuals from over 15 different countries and diverse backgrounds."
    }
  ];

  const jobs = [
    {
      title: "Senior Frontend Engineer (React)",
      department: "Engineering",
      location: "Remote / Bengaluru",
      type: "Full-Time",
      link: "#apply"
    },
    {
      title: "Quantitative Analyst - Options",
      department: "Trading Desk",
      location: "Mumbai",
      type: "Full-Time",
      link: "#apply"
    },
    {
      title: "Customer Success Manager",
      department: "Support",
      location: "Remote",
      type: "Full-Time",
      link: "#apply"
    },
    {
      title: "Product Marketing Specialist",
      department: "Marketing",
      location: "Remote / London",
      type: "Full-Time",
      link: "#apply"
    }
  ];

  const jobPostingsSchema = jobs.map(job => ({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": job.title,
    "description": `Join Stocks Lab as a ${job.title} in our ${job.department} department. Experience a remote-first culture, health benefits, and learning budget.`,
    "datePosted": "2026-07-01",
    "validThrough": "2027-01-01",
    "employmentType": "FULL_TIME",
    "hiringOrganization": {
      "@type": "Organization",
      "name": "Stocks Lab",
      "sameAs": "https://stockslab.live"
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": job.location,
        "addressCountry": "IN"
      }
    }
  }));

  return (
    <>
      <SEO 
        title="Careers" 
        description="Join the team building the future of high-performance trading platforms." 
        url="/careers" 
        schemas={jobPostingsSchema}
      />
    <main className="pt-20 pb-20 bg-slate-50 min-h-screen">
      
      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[70%] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-[0%] right-[-10%] w-[40%] h-[60%] rounded-full bg-emerald-500/20 blur-[100px]" />
        </div>

        <motion.div 
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[10%] top-[20%] opacity-10 hidden lg:block"
        >
          <Briefcase size={250} />
        </motion.div>

        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 text-blue-300 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase mb-8">
              <Briefcase size={16} />
              <span>Join Stocks Lab</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold mb-6 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-primary">
              Build the Future of Finance
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 leading-relaxed max-w-3xl mx-auto font-light mb-10">
              We are on a mission to democratize trading globally. Join a team of relentlessly resourceful engineers, designers, and market experts.
            </p>
            <button 
              onClick={() => document.getElementById('open-positions').scrollIntoView({ behavior: 'smooth' })}
              className="bg-primary hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:-translate-y-1 transition-all flex items-center justify-center space-x-2 mx-auto"
            >
              <span>View Open Positions</span>
              <ArrowRight size={20} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Perks & Benefits */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Life at Stocks Lab</h2>
            <p className="text-lg text-slate-600">We take care of our team so they can take care of our traders.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start space-x-6 p-6 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
              >
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{benefit.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{benefit.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section id="open-positions" className="py-20 bg-slate-50">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Open Roles</h2>
            <p className="text-lg text-slate-600">Find your next career-defining opportunity below.</p>
          </div>

          <div className="space-y-6">
            {jobs.map((job, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div>
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary bg-blue-50 px-3 py-1 rounded-full">
                      {job.department}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4 group-hover:text-primary transition-colors">{job.title}</h3>
                  
                  <div className="flex items-center space-x-6 text-slate-500 text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <MapPin size={16} />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock size={16} />
                      <span>{job.type}</span>
                    </div>
                  </div>
                </div>
                
                <Link to="/contact" className="bg-slate-100 hover:bg-primary text-slate-700 hover:text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center space-x-2 md:shrink-0">
                  <span>Apply Now</span>
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 bg-blue-50 border border-blue-100 rounded-3xl p-8 md:p-12 text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Don't see a perfect fit?</h3>
            <p className="text-slate-600 mb-8 max-w-xl mx-auto">We are always looking for exceptional talent. If you believe you belong here, drop us your resume and we'll keep you in mind.</p>
            <Link to="/contact" className="inline-flex items-center space-x-2 bg-white border border-slate-200 text-slate-800 px-8 py-4 rounded-xl font-bold shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
              <span>Send General Application</span>
            </Link>
          </div>
        </div>
      </section>

    </main>
  
    </>
  );
}
