import React from 'react';
import { Globe, MessageCircle, Camera, Play, Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-20 pb-10 border-t border-slate-800">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-16">
          
          {/* Brand & Info */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center mb-6">
              <img src="/logo-light.svg" alt="StocksLab Logo" className="h-8 w-auto object-contain" />
            </Link>
            <p className="text-slate-400 mb-8 max-w-sm leading-relaxed">
              Empowering traders with advanced tools, fast execution, and access to global markets. Trade smarter, not harder.
            </p>
            <div className="flex space-x-4 mb-8">
              <a href="https://twitter.com/stockslab" target="_blank" rel="noopener noreferrer" aria-label="Follow Stocks Lab on Twitter" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-colors">
                <MessageCircle size={18} />
              </a>
              <a href="https://linkedin.com/company/stockslab" target="_blank" rel="noopener noreferrer" aria-label="Follow Stocks Lab on LinkedIn" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-colors">
                <Globe size={18} />
              </a>
              <a href="https://youtube.com/stockslab" target="_blank" rel="noopener noreferrer" aria-label="Follow Stocks Lab on YouTube" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-colors">
                <Play size={18} />
              </a>
              <a href="https://instagram.com/stockslab" target="_blank" rel="noopener noreferrer" aria-label="Follow Stocks Lab on Instagram" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-colors">
                <Camera size={18} />
              </a>
            </div>
            <div className="flex space-x-4">
              <Link to="/register" className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-md transition-all text-center">
                Start Trading
              </Link>
              <Link to="/register" className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-6 py-2.5 rounded-lg font-medium transition-all text-center">
                Create Account
              </Link>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold mb-6">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/why-us" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/why-us" className="hover:text-primary transition-colors">Why Choose Us</Link></li>
              <li><Link to="/compare" className="text-primary font-medium hover:text-white transition-colors">Compare Competitors</Link></li>
              <li><Link to="/affiliate" className="hover:text-primary transition-colors">Affiliate Program</Link></li>
              <li><Link to="/referral" className="hover:text-primary transition-colors">Referral Program</Link></li>
              <li><Link to="/calculator" className="hover:text-primary transition-colors">Trading Calculator</Link></li>
              <li><Link to="/news" className="hover:text-primary transition-colors">Blog & News</Link></li>
              <li><Link to="/careers" className="hover:text-primary transition-colors">Careers</Link></li>
            </ul>
          </div>
          
          {/* Products */}
          <div>
            <h4 className="text-white font-bold mb-6">Products</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/markets/nse" className="hover:text-primary transition-colors">Equities & F&O</Link></li>
              <li><Link to="/markets/mcx" className="hover:text-primary transition-colors">Commodities (MCX)</Link></li>
              <li><Link to="/markets/forex" className="hover:text-primary transition-colors">Currency</Link></li>
              <li><Link to="/markets/us-stocks" className="hover:text-primary transition-colors">US Stocks</Link></li>
              <li><Link to="/trading/margin" className="hover:text-primary transition-colors">Margin Trading</Link></li>
              <li><Link to="/trading/equity" className="hover:text-primary transition-colors">Equity Trading</Link></li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h4 className="text-white font-bold mb-6">Contact Support</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start space-x-3">
                <Mail size={18} className="text-primary mt-0.5" />
                <span>support@stockslab.live</span>
              </li>
              <li className="flex items-start space-x-3">
                <Phone size={18} className="text-primary mt-0.5" />
                <span>1800-123-4567<br/><span className="text-xs text-slate-500">(Mon-Fri, 9AM-6PM)</span></span>
              </li>
              <li className="flex items-start space-x-3">
                <MapPin size={18} className="text-primary mt-0.5" />
                <span>12th Floor, Financial District, Cyber City, Hyderabad - 500081</span>
              </li>
            </ul>
          </div>

        </div>
        
        {/* Footer Bottom */}
        <div className="pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p>© {new Date().getFullYear()} Stocks Lab Securities Pvt. Ltd. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link to="/legal/terms-conditions" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/legal/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
        
        {/* Disclaimer */}
        <div className="mt-8 text-xs text-slate-500 leading-relaxed text-center font-medium bg-slate-800/50 p-4 rounded-lg">
          Trading involves risk. This platform provides simulated trading and does not execute real market trades.
        </div>
      </div>
    </footer>
  );
}
