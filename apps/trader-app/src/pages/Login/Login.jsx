import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTradeStore } from '../../store/useTradeStore';
import { Eye, EyeOff, TrendingUp, ArrowRight, ShieldCheck, Zap, BarChart3, Activity, AlertCircle, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  
  // OTP States
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Micro-interaction states
  const [isHoveringBtn, setIsHoveringBtn] = useState(false);

  const { login, verifyOtp, resendOtp, authLoading } = useTradeStore();
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Floating background elements
  const floatingCards = [
    { id: 1, text: "+$1,240.50", subtext: "NIFTY 50", delay: 0 },
    { id: 2, text: "Execution: 4ms", subtext: "System Latency", delay: 1.5 },
    { id: 3, text: "Trade Executed", subtext: "AAPL @ 185.40", delay: 3 }
  ];

  useEffect(() => {
    // Check if biometric credential save is supported and enabled on this device
    if (window.PasswordCredential && navigator.credentials && localStorage.getItem('tradex_biometric_enabled') === 'true') {
      setBiometricAvailable(true);
    }
  }, []);

  const handleBiometricLogin = async () => {
    if (!navigator.credentials) return;
    try {
      const cred = await navigator.credentials.get({ password: true, mediation: 'required' });
      if (cred) {
        setEmail(cred.id);
        setPassword(cred.password);
        
        setError('');
        const result = await login(cred.id, cred.password);
        if (result.success) {
          navigate('/');
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error('Biometric credential retrieval failed:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const result = await login(email, password);

    if (result.success) {
      // Store credentials on first successful manual login
      if (window.PasswordCredential && navigator.credentials) {
        try {
          let cred;
          try {
            // Standard approach: parse from submitted form element
            cred = new PasswordCredential(e.target);
          } catch (formErr) {
            // Fallback approach: construct programmatically
            cred = new PasswordCredential({
              id: email,
              password: password,
              name: email
            });
          }
          await navigator.credentials.store(cred);
          localStorage.setItem('tradex_biometric_enabled', 'true');
        } catch (err) {
          console.warn('Failed to store credentials:', err);
        }
      }
      navigate('/');
    } else if (result.requires_otp) {
      setUserId(result.user.id);
      setUserPhone(result.user.phone);
      setStep(2);
      handleResendOtp(result.user.id);
    } else {
      setError(result.error);
    }
  };

  const handleResendOtp = async (targetUserId = userId) => {
    if (resendTimer > 0) return;
    setError('');
    if (!targetUserId) return setError('No user ID found');
    
    try {
      const result = await resendOtp(targetUserId);
      if (result.success) {
        setResendTimer(60);
      } else {
        setError(result.error || 'Failed to resend OTP');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setError('Please enter a valid 6-digit OTP');
    setError('');
    
    try {
      const backendResult = await verifyOtp(userId, otp, email, password);
      if (backendResult.success) {
        navigate('/');
      } else {
        setError(backendResult.error || 'Backend verification failed');
      }
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex overflow-hidden">
      
      {/* Left Pane - Presentation (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-950 flex-col justify-center overflow-hidden">
        {/* Dynamic Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-indigo-600/20 blur-[120px]" />
        
        {/* Animated Grid Lines */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSIjMWUzYThhIiBzdHJva2Utd2lkdGg9IjAuNSIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTAgNjBMMjAwIDYwTTAgMEwyMDAgME02MCAwTDYwIDIwME0wIDBMMCAyMDAiLz48L2c+PC9zdmc+')] opacity-20" />

        <div className="relative z-10 px-16 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <span className="text-3xl font-black text-white tracking-tight">Stocks <span className="text-blue-500">Lab</span></span>
            </div>
            
            <h1 className="text-5xl font-bold text-white leading-tight mb-6">
              Next-Gen Trading.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Zero Compromise.
              </span>
            </h1>
            
            <p className="text-lg text-slate-400 leading-relaxed mb-12">
              Join elite traders on India's fastest proprietary simulated trading platform. Experience raw spreads and sub-10ms execution.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-full">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-slate-300">Ultra-Low Latency</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-full">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">Bank-Grade Security</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-full">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-300">Advanced Charting</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Floating Animated Cards */}
        <div className="absolute right-[-10%] top-1/4 w-72 space-y-6">
          {floatingCards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                y: [0, -10, 0]
              }}
              transition={{ 
                opacity: { duration: 0.8, delay: card.delay },
                x: { type: "spring", stiffness: 50, delay: card.delay },
                y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: card.delay }
              }}
              className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-2xl flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-white font-bold text-lg">{card.text}</div>
                <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">{card.subtext}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-24 bg-surface relative z-10">
        
        {/* Mobile Logo */}
        <div className="absolute top-8 left-8 flex lg:hidden items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black text-text-primary">Stocks Lab</span>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {step === 1 ? (
            <>
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-text-primary mb-2">Welcome Back</h2>
                <p className="text-text-muted">Enter your credentials to access your dashboard.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email / Mobile / User ID Input */}
            <motion.div whileTap={{ scale: 0.995 }}>
              <label className="block text-sm font-bold text-text-secondary mb-2">Email, Mobile, or User ID</label>
              <div className="relative group">
                <input 
                  type="text" 
                  name="username"
                  autocomplete="username"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="Enter Email, Mobile, or User ID" 
                  className="w-full px-4 py-3.5 bg-surface-2 border border-border/50 rounded-xl text-base text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all group-hover:border-border" 
                  required 
                />
              </div>
            </motion.div>

            {/* Password Input */}
            <motion.div whileTap={{ scale: 0.995 }}>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-text-secondary">Password</label>
                <a href="#" className="text-sm font-bold text-blue-600 hover:text-blue-700">Forgot?</a>
              </div>
              <div className="relative group">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  name="password"
                  autocomplete="current-password"
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Enter your password" 
                  className="w-full px-4 py-3.5 bg-surface-2 border border-border/50 rounded-xl text-base text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-12 transition-all group-hover:border-border" 
                  required 
                  minLength={6} 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-xl px-4 py-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button 
              type="submit" 
              disabled={authLoading} 
              onHoverStart={() => setIsHoveringBtn(true)}
              onHoverEnd={() => setIsHoveringBtn(false)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-blue-600 text-white font-bold text-base rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all relative overflow-hidden"
            >
              {/* Button Hover Effect (Shine) */}
              <motion.div 
                className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                animate={{ left: isHoveringBtn ? '200%' : '-100%' }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              />

              <div className="relative flex items-center justify-center gap-2">
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <motion.div animate={{ x: isHoveringBtn ? 5 : 0 }}>
                      <ArrowRight className="w-5 h-5" />
                    </motion.div>
                  </>
                )}
              </div>
            </motion.button>

            {biometricAvailable && (
              <div className="mt-4">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-border/30"></div>
                  <span className="flex-shrink mx-4 text-text-muted text-xs font-semibold">OR</span>
                  <div className="flex-grow border-t border-border/30"></div>
                </div>

                <motion.button
                  type="button"
                  onClick={handleBiometricLogin}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 bg-surface-2 border border-border/40 text-text-primary font-bold text-sm rounded-xl hover:bg-surface-3 hover:border-blue-500/30 transition-all flex items-center justify-center gap-2 group"
                >
                  <Fingerprint className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform duration-300" />
                  <span>Log In with Touch ID / Face ID</span>
                </motion.button>
              </div>
            )}
          </form>

          {/* Footer */}
          <p className="text-center text-text-secondary text-sm mt-8">
            Don't have an account?{' '}
            <a href="https://stockslab-landing.onrender.com/register" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
              Create one now
            </a>
          </p>
          </>
          ) : (
          <>
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-text-primary mb-2">Verify Phone</h2>
              <p className="text-text-muted">We've sent a 6-digit OTP to your registered phone number.</p>
            </div>
            
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">One Time Password</label>
                <input 
                  type="text" 
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456" 
                  className="w-full px-4 py-4 rounded-xl border border-border/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-surface-2 text-text-primary text-center text-2xl tracking-[0.5em] font-bold"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-xl px-4 py-3 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button disabled={authLoading || otp.length < 6} className="w-full py-4 bg-blue-600 text-white font-bold text-base rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all relative overflow-hidden flex items-center justify-center gap-2">
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify & Login</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="text-center pt-4">
                <button 
                  type="button" 
                  onClick={() => handleResendOtp()}
                  disabled={resendTimer > 0 || authLoading}
                  className="text-sm font-bold text-text-secondary hover:text-blue-600 disabled:text-text-muted disabled:hover:text-text-muted transition-colors"
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
  );
}
