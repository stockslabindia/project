import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, AlertTriangle, ShieldCheck, Building2, ChevronDown } from 'lucide-react';

const DEPT_OPTIONS = [
  { value: 'admin', label: 'Admin Panel', desc: 'Full platform access', color: 'from-blue-500 to-blue-700' },
  { value: 'finance', label: 'Finance Department', desc: 'Wallets, P&L, settlements', color: 'from-emerald-500 to-emerald-700' },
  { value: 'customer_service', label: 'Customer Service', desc: 'Support, KYC, clients', color: 'from-purple-500 to-purple-700' },
];

export default function AdminLogin() {
  const { login, failedAttempts, lockoutUntil } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLockedOut = lockoutUntil && Date.now() < lockoutUntil;
  const selectedDept = DEPT_OPTIONS.find(d => d.value === department);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));

    const result = await login(email, password, department);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedDept.color} shadow-lg shadow-blue-500/30 mb-4 transition-all duration-300`}>
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div className="flex justify-center mb-1">
            <img src="/logo-light.svg" alt="StocksLab Logo" className="h-9 w-auto object-contain" />
          </div>
          <p className="text-blue-300/70 text-sm mt-1 font-medium">Management Console</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Sign in to Console</h2>
            <p className="text-sm text-blue-200/50 mt-1">Select your department and authenticate.</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Lockout Banner */}
          {isLockedOut && (
            <div className="mb-4 flex items-start gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
              <Lock className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-orange-300">Account Temporarily Locked</p>
                <p className="text-xs text-orange-300/70 mt-1">Too many failed attempts. Please wait 5 minutes.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Department Selector */}
            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">Department</label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300/40 z-10" />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                  disabled={isLockedOut}
                  style={{ colorScheme: 'dark' }}
                >
                  {DEPT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value} className="bg-slate-800 text-white">
                      {d.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300/40 pointer-events-none" />
              </div>
              <p className="text-xs text-blue-200/30 mt-1">{selectedDept.desc}</p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@stockslab.live"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-300/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  disabled={isLockedOut}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300/40" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-300/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  disabled={isLockedOut}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300/40 hover:text-blue-300/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Failed Attempts */}
            {failedAttempts > 0 && failedAttempts < 5 && !isLockedOut && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${i <= failedAttempts ? 'bg-red-400' : 'bg-white/10'}`} />
                  ))}
                </div>
                <span className="text-xs text-red-300/70">{5 - failedAttempts} attempts left</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || isLockedOut}
              className={`w-full py-2.5 bg-gradient-to-r ${selectedDept.color} text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authenticating...
                </span>
              ) : `Sign In to ${selectedDept.label}`}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <p className="text-xs text-blue-200/30">
              Protected by brute-force lockout &amp; session expiry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
