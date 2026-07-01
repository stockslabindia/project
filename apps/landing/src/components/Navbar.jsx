import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

const NavDropdown = ({ title, items }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center space-x-1 text-slate-600 hover:text-primary py-2 font-medium transition-colors">
        <span>{title}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 w-48 bg-white border border-slate-100 rounded-lg shadow-xl py-2 z-50">
          {items.map((item, idx) => (
            <Link 
              key={idx} 
              to={item.href || '#'} 
              className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-primary transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const MobileNavDropdown = ({ title, items, closeMenu }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-3 text-slate-600 font-medium border-b border-slate-100"
      >
        <span>{title}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="bg-slate-50 py-2 px-4 space-y-2">
          {items.map((item, idx) => (
            <Link 
              key={idx} 
              to={item.href || '#'} 
              onClick={() => {
                setIsOpen(false);
                if (closeMenu) closeMenu();
              }}
              className="block text-sm text-slate-600 hover:text-primary py-1"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const aboutItems = [
    { label: 'Why Us', href: '/why-us' },
    { label: 'Compare Competitors', href: '/compare' },
    { label: 'Pricing & Fees', href: '/pricing' },
    { label: 'Become Affiliate', href: '/affiliate' },
    { label: 'Privacy Policy', href: '/legal/privacy-policy' },
    { label: 'Terms and Conditions', href: '/legal/terms-conditions' },
    { label: 'Contact Us', href: '/contact' },
  ];

  const marketsItems = [
    { label: 'NSE Futures & Options', href: '/markets/nse' },
    { label: 'MCX', href: '/markets/mcx' },
    { label: 'COMEX', href: '/markets/comex' },
    { label: 'Crypto', href: '/markets/crypto' },
    { label: 'Forex', href: '/markets/forex' },
    { label: 'US Stocks & Indices', href: '/markets/us-stocks' },
  ];

  const tradingItems = [
    { label: 'Intraday Trading', href: '/trading/intraday' },
    { label: 'Equity Trading', href: '/trading/equity' },
    { label: 'Margin Trading', href: '/trading/margin' },
    { label: 'Commodity Trading', href: '/trading/commodity' },
    { label: 'Futures & Options', href: '/trading/futures-options' },
  ];

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'}`}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-xl font-bold text-slate-800">Stocks <span className="text-primary">Lab</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center space-x-6">
            <Link to="/" className="text-slate-600 hover:text-primary font-medium transition-colors">Home</Link>
            <NavDropdown title="About Us" items={aboutItems} />
            <NavDropdown title="Markets" items={marketsItems} />
            <NavDropdown title="Trading" items={tradingItems} />
            <Link to="/news" className="text-slate-600 hover:text-primary font-medium transition-colors">News & Blogs</Link>
            <Link to="/calculator" className="text-slate-600 hover:text-primary font-medium transition-colors">Calculator</Link>
            <Link to="/faq" className="text-slate-600 hover:text-primary font-medium transition-colors">FAQ</Link>
            <Link to="/referral" className="text-slate-600 hover:text-primary font-medium transition-colors">Referral</Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden lg:flex items-center space-x-4">
            <a href="https://web.stockslab.live/login" className="text-slate-600 font-medium hover:text-primary transition-colors">Log In</a>
            <Link to="/register" className="bg-primary hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition-colors">
              Create Account
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden text-slate-800"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white shadow-xl max-h-[calc(100vh-70px)] overflow-y-auto">
          <div className="p-4 flex flex-col space-y-2">
            <Link to="/" className="block py-3 text-slate-600 font-medium border-b border-slate-100">Home</Link>
            <MobileNavDropdown title="About Us" items={aboutItems} closeMenu={() => setMobileMenuOpen(false)} />
            <MobileNavDropdown title="Markets" items={marketsItems} closeMenu={() => setMobileMenuOpen(false)} />
            <MobileNavDropdown title="Trading" items={tradingItems} closeMenu={() => setMobileMenuOpen(false)} />
            <Link to="/news" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-600 font-medium border-b border-slate-100">News & Blogs</Link>
            <Link to="/calculator" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-600 font-medium border-b border-slate-100">Calculator</Link>
            <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-600 font-medium border-b border-slate-100">FAQ</Link>
            <Link to="/referral" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-600 font-medium border-b border-slate-100">Referral</Link>
            
            <div className="pt-4 pb-6 space-y-3">
              <a href="https://web.stockslab.live/login" className="w-full text-center py-3 border border-slate-200 rounded-lg text-slate-700 font-medium block">Log In</a>
              <Link to="/register" className="w-full text-center py-3 bg-primary text-white rounded-lg font-medium block">Create Account</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
