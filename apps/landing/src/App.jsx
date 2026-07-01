import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import FloatingChat from './components/FloatingChat';

// Lazy-loaded pages
const Home = lazy(() => import('./pages/Home'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const TradingPage = lazy(() => import('./pages/TradingPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const Register = lazy(() => import('./pages/Register'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const AffiliatePage = lazy(() => import('./pages/AffiliatePage'));
const WhyUsPage = lazy(() => import('./pages/WhyUsPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const CalculatorPage = lazy(() => import('./pages/CalculatorPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const DabbaTradingSEO = lazy(() => import('./pages/blogs/DabbaTradingSEO'));
const Tradex1Review = lazy(() => import('./pages/blogs/Tradex1Review'));
const MarkettradeReview = lazy(() => import('./pages/blogs/MarkettradeReview'));

function App() {
  return (
    <HelmetProvider>
      <Router>
      <div className="min-h-screen bg-fintech-gray font-sans selection:bg-primary selection:text-white">
        <Suspense fallback={
          <div className="min-h-screen bg-fintech-gray flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-slate-300 border-t-primary rounded-full animate-spin"></div>
          </div>
        }>
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="*" element={
              <>
                <Navbar />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/markets/:marketId" element={<MarketPage />} />
                  <Route path="/trading/:tradingId" element={<TradingPage />} />
                  <Route path="/legal/:pageId" element={<LegalPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/affiliate" element={<AffiliatePage />} />
                  <Route path="/why-us" element={<WhyUsPage />} />
                  <Route path="/news" element={<NewsPage />} />
                  <Route path="/referral" element={<ReferralPage />} />
                  <Route path="/careers" element={<CareersPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/faq" element={<FaqPage />} />
                  <Route path="/calculator" element={<CalculatorPage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/blog/what-is-dabba-trading" element={<DabbaTradingSEO />} />
                  <Route path="/blog/tradex1-review" element={<Tradex1Review />} />
                  <Route path="/blog/markettrade-review" element={<MarkettradeReview />} />
                </Routes>
                <Footer />
                <FloatingChat />
              </>
            } />
          </Routes>
        </Suspense>
      </div>
      </Router>
    </HelmetProvider>
  );
}

export default App;
