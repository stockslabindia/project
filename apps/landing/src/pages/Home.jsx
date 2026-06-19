import SEO from '../components/SEO';
import { Helmet } from 'react-helmet-async';
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
  return (
    <>
      <SEO title="Trade Smarter | Best Broker in India" description="Experience lightning-fast execution and real-time market data. The #1 alternative to Tradex1 and Markettrade." url="/" />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialService",
            "name": "Stocks Lab",
            "description": "The best broker and trading platform in India. Superior alternative to Tradex1 and Markettrade.",
            "url": "https://stockslab.live",
            "areaServed": "IN",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "ratingCount": "12540"
            }
          })}
        </script>
      </Helmet>
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
