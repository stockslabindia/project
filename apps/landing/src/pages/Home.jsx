import SEO from '../components/SEO';
import React from 'react';
import Hero from '../components/Hero';
import WhyUs from '../components/WhyUs';
import Markets from '../components/Markets';
import TradingTypes from '../components/TradingTypes';
import Features from '../components/Features';
import Referral from '../components/Referral';
import NewsBlogs from '../components/NewsBlogs';
import FAQ from '../components/FAQ';
import CTA from '../components/CTA';

export default function Home() {
  const financialServiceSchema = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": "Stocks Lab",
    "description": "The best broker and trading platform in India. Superior alternative to Tradex1 and Markettrade.",
    "url": "https://stockslab.live",
    "areaServed": "IN",
    "image": "https://stockslab.live/og-image.png",
    "priceRange": "$$",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "12540"
    }
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Stocks Lab",
    "url": "https://stockslab.live",
    "logo": "https://stockslab.live/favicon.svg",
    "sameAs": [
      "https://twitter.com/stockslab",
      "https://linkedin.com/company/stockslab",
      "https://youtube.com/stockslab",
      "https://instagram.com/stockslab"
    ]
  };

  return (
    <>
      <SEO 
        title="Trade Smarter | Best Broker in India" 
        description="Experience lightning-fast execution and real-time market data. The #1 alternative to Tradex1 and Markettrade." 
        url="/" 
        schemas={[financialServiceSchema, organizationSchema]}
      />
    <main>
      <Hero />
      <WhyUs />
      <Markets />
      <TradingTypes />
      <Features />
      <Referral />
      <NewsBlogs />
      <FAQ />
      <CTA />
    </main>
  
    </>
  );
}
