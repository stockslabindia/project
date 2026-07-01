import SEO from '../components/SEO';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Zap, Globe2, ArrowLeft, ArrowRight, Loader2, Gift, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const TRADER_APP_URL = import.meta.env.VITE_TRADER_APP_URL || 'https://web.stockslab.live';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneCode: '+91',
    phoneNumber: '',
    password: '',
    referralCode: '',
    termsAccepted: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [refFromUrl, setRefFromUrl] = useState(false);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Pre-fill referral code from URL ?ref= query param
  useEffect(() => {
    const refCode = searchParams.get('ref') || searchParams.get('referral') || searchParams.get('code');
    if (refCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode.toUpperCase() }));
      setRefFromUrl(true);
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!formData.termsAccepted) {
      setError('You must accept the Terms & Conditions.');
      return;
    }

    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: `${formData.phoneCode} ${formData.phoneNumber}`.trim(),
          referral_code: formData.referralCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      if (data.requires_otp) {
        setUserId(data.user.id);
        setStep(2);
        setResendTimer(60);
        return;
      }

      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        window.location.href = `${TRADER_APP_URL}/login`; // Redirect to Trader App login
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setError('Please enter a valid 6-digit OTP');
    setError('');
    setLoading(true);
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          otp,
          email: formData.email,
          password: formData.password
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'OTP verification failed');

      setSuccess('Account verified! Redirecting to dashboard...');
      setTimeout(() => {
        window.location.href = `${TRADER_APP_URL}/trade`; // Redirect into trader app directly
      }, 2000);
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError('');
    setLoading(true);
    
    if (!userId) {
      setError('Invalid user ID');
      setLoading(false);
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to resend OTP');

      setResendTimer(60);
      setSuccess('A new OTP has been sent to your phone');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <SEO title="Open an Account" description="Create your trading account in minutes and start trading global markets instantly." url="/register" />
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Side - Branding & Benefits */}
      <div className="hidden lg:flex w-5/12 bg-slate-900 relative flex-col justify-between p-12 overflow-hidden text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-[10%] -right-[20%] w-[60%] h-[60%] rounded-full bg-emerald-500/20 blur-[100px]" />
        </div>

        <div className="relative z-10">
          <Link to="/" className="flex items-center space-x-2 mb-16 inline-block">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-white font-bold text-2xl">S</span>
            </div>
            <span className="text-3xl font-bold text-white tracking-tight">Stocks <span className="text-primary">Lab</span></span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
              Start Your Trading Journey Today
            </h1>
            <p className="text-slate-400 text-lg mb-12 max-w-md">
              Join thousands of traders globally. Get access to advanced tools, deep liquidity, and lightning-fast execution.
            </p>

            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/10">
                  <Globe2 className="text-blue-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Global Markets</h3>
                  <p className="text-slate-400">Trade Stocks, Forex, Commodities, and Cryptos from a single unified account.</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/10">
                  <Zap className="text-amber-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Zero Latency</h3>
                  <p className="text-slate-400">Experience sub-millisecond execution speeds directly connected to top-tier liquidity.</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/10">
                  <ShieldCheck className="text-emerald-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Bank-Grade Security</h3>
                  <p className="text-slate-400">Your funds and data are protected by enterprise-level encryption and strict regulatory compliance.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 text-sm text-slate-500 font-medium">
          © {new Date().getFullYear()} Stocks Lab Securities Pvt. Ltd.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-7/12 flex flex-col justify-start lg:justify-center items-center p-6 pt-24 pb-12 sm:p-12 sm:pt-28 lg:p-20 relative min-h-screen lg:max-h-screen lg:overflow-y-auto">
        <Link to="/" className="absolute top-6 left-6 lg:hidden flex items-center space-x-2 text-slate-600 hover:text-primary transition-colors font-medium">
          <ArrowLeft size={18} />
          <span>Back</span>
        </Link>
        
        <div className="absolute top-6 right-6 lg:top-12 lg:right-12 text-sm sm:text-base z-10 bg-slate-50/80 sm:bg-transparent px-2 py-1 rounded">
          <span className="text-slate-500 font-medium hidden sm:inline">Already have an account? </span>
          <a href={`${TRADER_APP_URL}/login`} className="text-primary font-bold hover:underline">Log in</a>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          {step === 1 ? (
            <>
              <div className="mb-10 text-center lg:text-left mt-6 lg:mt-0">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h2>
                <p className="text-slate-500 font-medium">Please fill in your details to get started.</p>
              </div>

              <form className="space-y-5" onSubmit={handleSignup}>
                {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-200">{error}</div>}
                {success && <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm font-medium border border-green-200">{success}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">First Name</label>
                <input 
                  type="text" 
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Last Name</label>
                <input 
                  type="text" 
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Email Address</label>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john.doe@example.com" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Phone Number</label>
              <div className="flex">
                <select 
                  name="phoneCode"
                  value={formData.phoneCode}
                  onChange={handleChange}
                  className="px-3 py-3 rounded-l-xl border border-slate-200 border-r-0 focus:border-primary outline-none bg-slate-50 text-slate-700 font-medium"
                >
                  <option value="+91">+91</option>
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                  <option value="+971">+971</option>
                </select>
                <input 
                  type="tel" 
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="98765 43210" 
                  className="w-full px-4 py-3 rounded-r-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Password</label>
              <input 
                type="password" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                Referral Code <span className="text-slate-400 font-normal">(Optional)</span>
                {refFromUrl && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={11} /> Applied
                  </span>
                )}
              </label>
              <div className="relative">
                {refFromUrl && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Gift size={16} className="text-emerald-500" />
                  </div>
                )}
                <input 
                  type="text" 
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={(e) => {
                    handleChange(e);
                    if (refFromUrl) setRefFromUrl(false);
                  }}
                  placeholder="Enter code if you have one" 
                  className={`w-full py-3 rounded-xl border outline-none transition-all uppercase font-mono tracking-wider ${
                    refFromUrl
                      ? 'pl-9 pr-4 border-emerald-300 bg-emerald-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-emerald-700'
                      : 'px-4 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white'
                  }`}
                />
              </div>
              {refFromUrl && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <CheckCircle2 size={11} /> Referral code applied from your friend's link!
                </p>
              )}
            </div>

            <div className="flex items-start space-x-3 pt-2">
              <input 
                type="checkbox" 
                id="terms" 
                name="termsAccepted"
                checked={formData.termsAccepted}
                onChange={handleChange}
                className="mt-1 w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <label htmlFor="terms" className="text-sm text-slate-600 leading-relaxed">
                I agree to the <Link to="/legal/terms-conditions" className="text-primary font-bold hover:underline">Terms & Conditions</Link> and <Link to="/legal/privacy-policy" className="text-primary font-bold hover:underline">Privacy Policy</Link>. I confirm I am over 18 years of age.
              </label>
            </div>

            <div className="pt-4">
              <button disabled={loading} className="w-full bg-primary hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:-translate-y-1 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
            
                <div className="text-center pt-6">
                  <p className="text-xs text-slate-400 font-medium">Secured by 256-bit SSL Encryption</p>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="mb-10 text-center lg:text-left mt-6 lg:mt-0">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Verify Phone</h2>
                <p className="text-slate-500 font-medium">We've sent a 6-digit OTP to {formData.phoneCode} {formData.phoneNumber}</p>
              </div>
              <form className="space-y-6" onSubmit={handleVerifyOtp}>
                {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-200">{error}</div>}
                {success && <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm font-medium border border-green-200">{success}</div>}
                
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">One Time Password</label>
                  <input 
                    type="text" 
                    maxLength="6"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456" 
                    className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-slate-50 focus:bg-white text-center text-2xl tracking-[0.5em] font-bold"
                  />
                </div>

                <button disabled={loading || otp.length < 6} className="w-full bg-primary hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:-translate-y-1 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      <span>Verify & Continue</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>

                <div className="text-center pt-4">
                  <button 
                    type="button" 
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || loading}
                    className="text-sm font-bold text-slate-600 hover:text-primary disabled:text-slate-400 disabled:hover:text-slate-400 transition-colors"
                  >
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  
    </>
  );
}
