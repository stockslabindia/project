import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, Users, DollarSign, Award, Copy, Check, Share2, 
  UserPlus, Library, Landmark, Gift, LogOut, ArrowRight, 
  RotateCw, PlusCircle, Search, Mail, Phone, Calendar, 
  CheckCircle2, AlertCircle, Clock, Ban, Loader2, Megaphone, QrCode, Download, Sparkles
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function Dashboard() {
  const { user, logout, updateProfileLocally } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // States for API data
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [offersData, setOffersData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [payouts, setPayouts] = useState([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);

  // Lead Submission Form State
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadMsg, setLeadMsg] = useState({ text: '', type: '' });

  // Bank Info Form State
  const [bankForm, setBankForm] = useState({
    bank_name: user?.bank_name || '',
    bank_account_number: user?.bank_account_number || '',
    bank_ifsc: user?.bank_ifsc || '',
    upi_id: user?.upi_id || ''
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankMsg, setBankMsg] = useState({ text: '', type: '' });

  // Token helper
  const getHeaders = () => {
    const token = localStorage.getItem('affiliate_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Load Dashboard Data
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/stats`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadReferrals = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/referrals`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReferrals(data.referrals || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/leads`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  const loadOffers = useCallback(async () => {
    setLoadingOffers(true);
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/offers`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOffersData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOffers(false);
    }
  }, []);

  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState('');

  const handleRequestPayout = async () => {
    setRequestingPayout(true);
    setPayoutMsg('');
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/request-payout`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setPayoutMsg(`✓ ${data.message}`);
        loadStats();
        loadPayouts();
      } else {
        setPayoutMsg(`❌ ${data.error || 'Failed to submit payout request'}`);
      }
    } catch (e) {
      setPayoutMsg(`❌ ${e.message}`);
    } finally {
      setRequestingPayout(false);
      setTimeout(() => setPayoutMsg(''), 5000);
    }
  };

  const loadPayouts = useCallback(async () => {
    setLoadingPayouts(true);
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/payouts`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPayouts(false);
    }
  }, []);

  const [commissions, setCommissions] = useState([]);
  const [loadingComms, setLoadingComms] = useState(false);

  const loadCommissions = useCallback(async () => {
    setLoadingComms(true);
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/commission-history`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCommissions(data.commissions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComms(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadOffers();
  }, [loadStats, loadOffers]);

  useEffect(() => {
    if (activeTab === 'referrals') {
      loadReferrals();
      loadCommissions();
    } else if (activeTab === 'leads') {
      loadLeads();
    } else if (activeTab === 'bank') {
      loadPayouts();
    }
  }, [activeTab, loadReferrals, loadCommissions, loadLeads, loadPayouts]);

  // Sync bank form with user context
  useEffect(() => {
    if (user) {
      setBankForm({
        bank_name: user.bank_name || '',
        bank_account_number: user.bank_account_number || '',
        bank_ifsc: user.bank_ifsc || '',
        upi_id: user.upi_id || ''
      });
    }
  }, [user]);

  // Copy Referral Code & Links
  const referralLink = user ? `https://stockslab.live/register?ref=${user.affiliate_code}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user?.affiliate_code || '');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Partnering with StocksLab! Register your dabba trading account with my code *${user?.affiliate_code}* to claim your signup rewards:\n\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Submit Lead
  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadForm.name || (!leadForm.phone && !leadForm.email)) {
      setLeadMsg({ text: 'Name and at least one contact method is required', type: 'error' });
      return;
    }
    setLeadSubmitting(true);
    setLeadMsg({ text: '', type: '' });
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/leads`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(leadForm)
      });
      const data = await res.json();
      if (res.ok) {
        setLeadMsg({ text: 'Customer lead submitted successfully!', type: 'success' });
        setLeadForm({ name: '', email: '', phone: '', notes: '' });
        loadLeads();
        loadStats(); // refresh total leads counts
      } else {
        setLeadMsg({ text: data.error || 'Failed to submit lead', type: 'error' });
      }
    } catch (e) {
      setLeadMsg({ text: 'Error contacting server', type: 'error' });
    } finally {
      setLeadSubmitting(false);
    }
  };

  // Save Bank details
  const handleBankSubmit = async (e) => {
    e.preventDefault();
    setBankSaving(true);
    setBankMsg({ text: '', type: '' });
    try {
      const res = await fetch(`${API_BASE}/affiliates/dashboard/bank-info`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(bankForm)
      });
      const data = await res.json();
      if (res.ok) {
        setBankMsg({ text: 'Payout details saved successfully!', type: 'success' });
        if (data.affiliate) {
          updateProfileLocally(data.affiliate);
        }
      } else {
        setBankMsg({ text: data.error || 'Failed to save bank details', type: 'error' });
      }
    } catch (e) {
      setBankMsg({ text: 'Error contacting server', type: 'error' });
    } finally {
      setBankSaving(false);
    }
  };

  const formatCurrency = (val) => {
    return '₹' + parseFloat(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  return (
    <div className="min-h-screen bg-[#090D1A] bg-mesh-gradient text-slate-200">
      
      {/* Top Banner Header */}
      <header className="sticky top-0 z-25 glass-panel border-b border-white/5 py-4 px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider uppercase text-white">StocksLab</h1>
            <span className="block text-[8px] text-emerald-400 font-bold uppercase tracking-widest -mt-0.5">Partner Backoffice</span>
          </div>
        </div>

        {/* User profile actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-xs font-bold text-white">{user?.name}</p>
            <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
              Dabba Partner
            </p>
          </div>
          <button 
            onClick={logout}
            className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Top welcome dashboard box */}
        <section className="glass-panel p-6 rounded-2xl border border-white/5 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <h2 className="text-2xl font-black text-white">Welcome back, {user?.name}!</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Track your earnings, submit leads, and grab affiliate referral materials to onboard more traders onto StocksLab.
            </p>
            <div className="flex flex-wrap gap-3 mt-4 text-xs font-bold text-slate-300">
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
                <Gift size={13} className="text-emerald-400" />
                Deposit Revenue Share: <span className="text-emerald-400">{user?.deposit_commission_pct || 15}% (Max ₹5,000/dep)</span>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
                <TrendingUp size={13} className="text-blue-400" />
                Weekly Net Loss Share: <span className="text-blue-400">{user?.net_loss_share_pct || 10}%</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => {
                loadStats();
                if (activeTab === 'referrals') loadReferrals();
                else if (activeTab === 'leads') loadLeads();
                else if (activeTab === 'bank') loadPayouts();
              }}
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RotateCw size={15} />
            </button>
            <button 
              onClick={() => setActiveTab('bank')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              <DollarSign size={15} />
              Request Payout ({formatCurrency(stats?.pending_balance)})
            </button>
            <button 
              onClick={() => setActiveTab('leads')}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <UserPlus size={15} />
              Submit Lead
            </button>
          </div>
        </section>

        {/* Tab navigation */}
        <div className="border-b border-white/5 mb-6 flex gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Partner Dashboard', icon: Library },
            { id: 'referrals', label: 'Referred Traders', icon: Users },
            { id: 'leads', label: 'Leads CRM', icon: UserPlus },
            { id: 'promo', label: 'Promo & Banners Kit', icon: Megaphone },
            { id: 'bank', label: 'Payout / Bank Info', icon: Landmark }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab.id 
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/[0.02]' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB CONTENTS */}
        <section>
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              
              {/* KPIs Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                
                <div className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Earned</span>
                    <DollarSign size={14} className="text-emerald-400" />
                  </div>
                  {loadingStats ? (
                    <div className="h-6 w-20 bg-white/5 animate-pulse rounded" />
                  ) : (
                    <p className="text-xl font-extrabold text-white font-sans">{formatCurrency(stats?.total_earnings)}</p>
                  )}
                  <span className="text-[9px] text-slate-500 mt-1 block">Lifetime credited</span>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Upcoming Payout</span>
                    <Clock size={14} className="text-amber-400" />
                  </div>
                  {loadingStats ? (
                    <div className="h-6 w-20 bg-white/5 animate-pulse rounded" />
                  ) : (
                    <div>
                      <p className="text-xl font-extrabold text-amber-400 font-sans">{formatCurrency(stats?.pending_balance)}</p>
                      <div className="mt-1 flex items-center justify-between text-[9px]">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Next Settlement:</span>
                        <span className="text-emerald-400 font-mono font-extrabold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {(() => {
                            const today = new Date();
                            const day = today.getDate();
                            let daysLeft = 0;
                            if (day <= 15) daysLeft = 15 - day;
                            else {
                              const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                              daysLeft = lastDay - day;
                            }
                            return `${daysLeft} days left`;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                  <span className="text-[9px] text-slate-500 mt-1 block">Bi-weekly cycle (15th &amp; 30th)</span>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Paid</span>
                    <CheckCircle2 size={14} className="text-blue-400" />
                  </div>
                  {loadingStats ? (
                    <div className="h-6 w-20 bg-white/5 animate-pulse rounded" />
                  ) : (
                    <p className="text-xl font-extrabold text-blue-400 font-sans">{formatCurrency(stats?.total_paid)}</p>
                  )}
                  <span className="text-[9px] text-slate-500 mt-1 block">Transferred to account</span>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Referred Users</span>
                    <Users size={14} className="text-purple-400" />
                  </div>
                  {loadingStats ? (
                    <div className="h-6 w-20 bg-white/5 animate-pulse rounded" />
                  ) : (
                    <p className="text-xl font-extrabold text-white font-sans">
                      {stats?.active_referrals || 0}<span className="text-xs font-bold text-slate-500">/{stats?.total_referrals || 0} active</span>
                    </p>
                  )}
                  <span className="text-[9px] text-slate-500 mt-1 block">Traders onboarded</span>
                </div>

                <div className="glass-panel col-span-2 lg:col-span-1 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Submitted Leads</span>
                    <UserPlus size={14} className="text-teal-400" />
                  </div>
                  {loadingStats ? (
                    <div className="h-6 w-20 bg-white/5 animate-pulse rounded" />
                  ) : (
                    <p className="text-xl font-extrabold text-white font-sans">{stats?.total_leads || 0}</p>
                  )}
                  <span className="text-[9px] text-slate-500 mt-1 block">Customer leads pending</span>
                </div>

              </div>

              {/* ── Weekly Net Loss Share Breakdown Widget ── */}
              <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 to-slate-900/40 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Sparkles size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Current Week Loss Share Estimate</h3>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Live Running</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Calculated every Sunday midnight on referred traders' net closed trading results (10% Loss Share).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 bg-slate-900/60 p-3 px-4 rounded-xl border border-white/5 w-full md:w-auto justify-between md:justify-end">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Traders Net Closed P&L</span>
                      <span className={`text-sm font-extrabold font-mono ${(stats?.current_week_traders_net_pnl || 0) <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(stats?.current_week_traders_net_pnl || 0) <= 0 ? '-' : '+'}{formatCurrency(Math.abs(stats?.current_week_traders_net_pnl || 0))}
                      </span>
                    </div>

                    <div className="h-8 w-px bg-white/10" />

                    <div>
                      <span className="text-[9px] text-emerald-400 block uppercase font-bold tracking-wider">Estimated Earnings ({stats?.net_loss_share_pct || 10}%)</span>
                      <span className="text-base font-black font-mono text-emerald-400">{formatCurrency(stats?.current_week_loss_share_estimate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Promo materials links grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Promo Link Materials Box */}
                <div className="md:col-span-7 glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Your Referral Link &amp; Code</h3>
                    <p className="text-xs text-slate-400">Share this unique URL or code on YouTube description, Telegram group, or website banner.</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 flex justify-between items-center">
                      <div className="truncate pr-3">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Custom Tracking URL</span>
                        <code className="text-xs text-slate-300 font-mono select-all">{referralLink}</code>
                      </div>
                      <button 
                        onClick={handleCopyLink}
                        className={`p-2 rounded-lg text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                          copiedLink ? 'bg-emerald-500 text-white' : 'bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 flex justify-between items-center">
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Referral Code</span>
                        <code className="text-sm text-emerald-400 font-bold font-mono tracking-wider">{user?.affiliate_code}</code>
                      </div>
                      <button 
                        onClick={handleCopyCode}
                        className={`p-2 rounded-lg text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                          copiedCode ? 'bg-emerald-500 text-white' : 'bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleShareWhatsApp}
                    className="w-full py-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Share2 size={14} /> Share Directly on WhatsApp
                  </button>
                </div>

                {/* Offer Banners Sidebox */}
                <div className="md:col-span-5 glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Award size={16} className="text-emerald-400" />
                      Active Commission Offers
                    </h3>
                    <p className="text-xs text-slate-400">Current running rewards config for StocksLab affiliates.</p>
                  </div>

                  {loadingOffers ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-10 bg-white/5 rounded-lg" />
                      <div className="h-10 bg-white/5 rounded-lg" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {offersData?.offers?.map((offer) => (
                        <div key={offer.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-slate-800 transition-colors">
                          <div className="flex justify-between items-center mb-1">
                            <h4 className="text-xs font-bold text-white">{offer.title}</h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-black tracking-wider">
                              {offer.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-normal">{offer.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* REFERRED TRADERS TAB */}
          {activeTab === 'referrals' && (
            <div className="space-y-8">
              
              {/* Traders List Card */}
              <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Traders Referred Using Your Link</h3>
                    <p className="text-xs text-slate-400 mt-1">Real-time statistics of user accounts linked to your affiliate code.</p>
                  </div>
                </div>

                {loadingRefs ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                    <p className="text-xs text-slate-500 mt-2">Fetching trader accounts...</p>
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-sm text-slate-500">No referred traders found yet.</p>
                    <p className="text-xs text-slate-600 mt-1">Traders will show up here once they complete registration using your code.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Client ID / Name</th>
                          <th className="px-6 py-4">Joined Date</th>
                          <th className="px-6 py-4 text-center">Trades Placed</th>
                          <th className="px-6 py-4 text-right">Total Commission Earned</th>
                          <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {referrals.map(ref => (
                          <tr key={ref.id} className="hover:bg-white/[0.01] transition-colors text-slate-300">
                            <td className="px-6 py-4">
                              <span className="font-bold text-white block">{ref.name}</span>
                              <span className="font-mono text-[10px] text-slate-500">{ref.client_id || 'Pending UID'}</span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {new Date(ref.joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-300">
                              {ref.trades}
                            </td>
                            <td className="px-6 py-4 text-right font-extrabold text-emerald-400 font-mono">
                              {formatCurrency(ref.earned)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                                ref.status === 'active' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {ref.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detailed Itemized Commission Breakdown Table */}
              <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <DollarSign size={16} className="text-emerald-400" />
                      Itemized Earnings Breakdown Log
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Detailed record showing exactly which trader deposited, deposit amount, and your 15% revenue share credited.</p>
                  </div>
                </div>

                {loadingComms ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                    <p className="text-xs text-slate-500 mt-2">Loading itemized commission breakdown...</p>
                  </div>
                ) : commissions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-xs text-slate-500">No commission records generated yet.</p>
                    <p className="text-[11px] text-slate-600 mt-1">Commissions generate automatically whenever referred traders make deposits or complete trading cycles.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Date &amp; Time</th>
                          <th className="px-6 py-4">Traders Name / UID</th>
                          <th className="px-6 py-4">Commission Type</th>
                          <th className="px-6 py-4 text-right">Deposit / Source Amount</th>
                          <th className="px-6 py-4 text-right">Share Pct</th>
                          <th className="px-6 py-4 text-right">Your Earnings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {commissions.map(c => (
                          <tr key={c.id} className="hover:bg-white/[0.01] transition-colors text-slate-300">
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {new Date(c.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-white block">{c.trader_name}</span>
                              <span className="font-mono text-[10px] text-slate-500">{c.client_id}</span>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-300">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold uppercase">
                                {c.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-300">
                              {c.source_amount > 0 ? formatCurrency(c.source_amount) : '—'}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-emerald-400 font-bold">
                              {c.commission_pct}%
                            </td>
                            <td className="px-6 py-4 text-right font-extrabold text-emerald-400 font-mono text-base">
                              +{formatCurrency(c.commission_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}


          {/* LEADS CRM TAB */}
          {activeTab === 'leads' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Side: Submit Lead Form */}
              <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Submit New Lead</h3>
                  <p className="text-xs text-slate-400 mt-1">Submit customer details manually to have administrators follow up and lock in commission attribution.</p>
                </div>

                {leadMsg.text && (
                  <div className={`px-4 py-3 rounded-xl text-xs font-semibold leading-normal flex items-start gap-2 ${
                    leadMsg.type === 'success' 
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' 
                      : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                  }`}>
                    <span>{leadMsg.type === 'success' ? '✓' : '⚠️'}</span>
                    <span>{leadMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Customer Name *</label>
                    <input 
                      type="text" 
                      required
                      value={leadForm.name}
                      onChange={e => setLeadForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Phone Number</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="tel" 
                        value={leadForm.phone}
                        onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="9876543210"
                        className="w-full glass-input pl-9 pr-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Email Address</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="email" 
                        value={leadForm.email}
                        onChange={e => setLeadForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="rajesh@gmail.com"
                        className="w-full glass-input pl-9 pr-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Additional Notes</label>
                    <textarea 
                      rows={3}
                      value={leadForm.notes}
                      onChange={e => setLeadForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Interested in index trading, looking to start with ₹50k..."
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {leadSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Submitting Lead...
                      </>
                    ) : (
                      <>
                        Submit Customer Lead
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right Side: Leads Tracking CRM Table */}
              <div className="lg:col-span-8 glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Submitted Leads Tracking</h3>
                    <p className="text-xs text-slate-400 mt-1">Review status conversions and follow-up updates from support staff.</p>
                  </div>
                </div>

                {loadingLeads ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                    <p className="text-xs text-slate-500 mt-2">Loading submitted leads CRM...</p>
                  </div>
                ) : leads.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-sm text-slate-500">No leads submitted yet.</p>
                    <p className="text-xs text-slate-600 mt-1">Submit customer info in the left pane to seed leads.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Customer Details</th>
                          <th className="px-6 py-4">Date Submitted</th>
                          <th className="px-6 py-4">Notes</th>
                          <th className="px-6 py-4 text-center">CRM Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {leads.map(lead => (
                          <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors text-slate-300">
                            <td className="px-6 py-4">
                              <span className="font-bold text-white block">{lead.name}</span>
                              <span className="block text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                {lead.phone && <span>📞 {lead.phone}</span>}
                                {lead.phone && lead.email && <span>·</span>}
                                {lead.email && <span>✉ {lead.email}</span>}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400 max-w-[200px] truncate" title={lead.notes}>
                              {lead.notes || '—'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                                lead.status === 'converted' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : lead.status === 'lost' 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                  : lead.status === 'new' 
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {lead.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* BANK INFO TAB */}
          {activeTab === 'bank' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Bank Details Form */}
                <div className="lg:col-span-6 glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Save Payout Channels</h3>
                    <p className="text-xs text-slate-400 mt-1">Specify your direct Bank Account or UPI details for manual admin payouts.</p>
                  </div>

                  {bankMsg.text && (
                    <div className={`px-4 py-3 rounded-xl text-xs font-semibold leading-normal flex items-start gap-2 ${
                      bankMsg.type === 'success' 
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' 
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    }`}>
                      <span>{bankMsg.type === 'success' ? '✓' : '⚠️'}</span>
                      <span>{bankMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleBankSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">UPI ID (Preferred)</label>
                      <input 
                        type="text" 
                        value={bankForm.upi_id}
                        onChange={e => setBankForm(f => ({ ...f, upi_id: e.target.value }))}
                        placeholder="e.g. partner@upi"
                        className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600"
                      />
                    </div>

                    <div className="border-t border-white/5 pt-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      OR Bank Transfer Info
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Bank Name</label>
                      <input 
                        type="text" 
                        value={bankForm.bank_name}
                        onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))}
                        placeholder="e.g. ICICI Bank"
                        className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Account Number</label>
                      <input 
                        type="text" 
                        value={bankForm.bank_account_number}
                        onChange={e => setBankForm(f => ({ ...f, bank_account_number: e.target.value }))}
                        placeholder="e.g. 123456789012"
                        className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Bank IFSC Code</label>
                      <input 
                        type="text" 
                        value={bankForm.bank_ifsc}
                        onChange={e => setBankForm(f => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))}
                        placeholder="e.g. ICIC0000123"
                        className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600 font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={bankSaving}
                      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {bankSaving ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Saving Payout Info...
                        </>
                      ) : (
                        <>
                          Save Payout Channels
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Request Payout Action Card & Manual Policy */}
                <div className="lg:col-span-6 space-y-6">
                  
                  {/* Request Payout Action Card */}
                  <div className="glass-panel p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-950 space-y-5 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-white uppercase tracking-wider">Request Payout Withdrawal</h3>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">Instant Request</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Submit payout request to admin. Payment will be transferred manually to your saved account/UPI.
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-950/90 p-5 rounded-2xl border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block">Unclaimed Pending Balance</span>
                        <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">{formatCurrency(stats?.pending_balance)}</span>
                      </div>

                      <button
                        onClick={handleRequestPayout}
                        disabled={requestingPayout || (stats?.pending_balance || 0) <= 0}
                        className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-emerald-500/25 cursor-pointer transition-all active:scale-95"
                      >
                        {requestingPayout ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                        Submit Claim Request
                      </button>
                    </div>

                    {payoutMsg && (
                      <div className={`p-3.5 rounded-xl text-xs font-semibold ${payoutMsg.startsWith('✓') ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}`}>
                        {payoutMsg}
                      </div>
                    )}
                  </div>

                  {/* Payout Policy Details */}
                  <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Landmark size={16} className="text-emerald-400" />
                      Manual Payout Settlement Policy
                    </h3>
                    
                    <div className="space-y-4 text-xs text-slate-400 leading-relaxed font-medium">
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                        <div className="flex items-start gap-2.5">
                          <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                          <div>
                            <h4 className="font-bold text-white text-xs mb-0.5">Submit Claim</h4>
                            <p className="text-[11px]">Click "Submit Claim Request" above to send your pending earnings claim directly to the Admin Panel.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                          <div>
                            <h4 className="font-bold text-white text-xs mb-0.5">Admin Review &amp; Payment</h4>
                            <p className="text-[11px]">Admin reviews your saved UPI ID or Bank account details and manually transfers funds to your bank.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                          <div>
                            <h4 className="font-bold text-white text-xs mb-0.5">UTR &amp; Email Confirmation</h4>
                            <p className="text-[11px]">Once approved by Admin, you will receive an automated email notification with the UTR transaction number.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* Payout History Table */}
              <div className="lg:col-span-12 glass-panel rounded-2xl border border-white/5 overflow-hidden mt-2">
                <div className="p-6 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Payout History</h3>
                  <p className="text-xs text-slate-400 mt-1">Status and UTR details for all bi-weekly settlements.</p>
                </div>

                {loadingPayouts ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                    <p className="text-xs text-slate-500 mt-2">Loading payouts...</p>
                  </div>
                ) : payouts.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-xs text-slate-500">No payout records found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Settlement Period</th>
                          <th className="px-6 py-4">Requested Date</th>
                          <th className="px-6 py-4 text-right">Amount</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4">Payment Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {payouts.map(p => (
                          <tr key={p.id} className="hover:bg-white/[0.01] transition-colors text-slate-300">
                            <td className="px-6 py-4 text-xs font-bold text-white">
                              {p.period_start && p.period_end ? (
                                <>
                                  {new Date(p.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(p.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </>
                              ) : (
                                'Custom Ad-hoc Payout'
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {new Date(p.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-right font-extrabold text-white font-mono">
                              {formatCurrency(p.total_amount)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                                p.status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : p.status === 'approved'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : p.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {p.status === 'paid' ? (
                                <div>
                                  <span className="font-mono text-white font-bold block">{p.payment_reference || 'UTR—N/A'}</span>
                                  {p.payment_date && (
                                    <span className="text-[10px] text-slate-500 block">
                                      Settled on {new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              ) : p.status === 'rejected' ? (
                                <span className="text-rose-400 font-medium italic">{p.notes || 'No rejection notes'}</span>
                              ) : (
                                <span className="text-slate-500 italic">Processing settlement...</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PROMO & BANNERS KIT TAB ── */}
          {activeTab === 'promo' && (
            <div className="space-y-8">
              
              {/* Header banner */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Megaphone size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white uppercase tracking-wider">Marketing &amp; Promotional Kit</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Ready-to-use high-converting scripts, banners, and copy for Telegram, WhatsApp, and Social Media.</p>
                  </div>
                </div>
              </div>

              {/* Promotional Copy Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Copy 1: Telegram Channel Post */}
                <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">Telegram Post</span>
                      <span className="text-[10px] text-slate-500 font-medium">High Conversion</span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2">🚀 Live Trading &amp; Deposit Offer Post</h4>
                    <div className="bg-slate-950/80 rounded-xl p-3 border border-white/5 text-xs text-slate-300 font-mono space-y-2 leading-relaxed select-all">
                      <p>🚀 Trade Indian Stocks, F&amp;O, &amp; Indices on StocksLab!</p>
                      <p>✨ 10% Instant Deposit Bonus on your 1st Deposit up to ₹3,500.</p>
                      <p>⚡ Zero Slippage execution, 200x Leverage, and Instant Bank Withdrawals.</p>
                      <p>👉 Join now using link: {referralLink}</p>
                      <p>Use Referral Code: <b>{user?.affiliate_code}</b></p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`🚀 Trade Indian Stocks, F&O, & Indices on StocksLab!\n✨ 10% Instant Deposit Bonus on your 1st Deposit up to ₹3,500.\n⚡ Zero Slippage execution, 200x Leverage, and Instant Bank Withdrawals.\n👉 Join now using link: ${referralLink}\nUse Referral Code: ${user?.affiliate_code}`);
                      alert('Copied Telegram copy to clipboard!');
                    }}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Copy size={13} /> Copy Telegram Template
                  </button>
                </div>

                {/* Copy 2: WhatsApp Group Invite */}
                <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">WhatsApp Invite</span>
                      <span className="text-[10px] text-slate-500 font-medium">Direct Message</span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2">📲 Short WhatsApp Group Broadcast</h4>
                    <div className="bg-slate-950/80 rounded-xl p-3 border border-white/5 text-xs text-slate-300 font-mono space-y-2 leading-relaxed select-all">
                      <p>Hey! I am using StocksLab for trading F&amp;O and Commodity with high leverage and quick payouts.</p>
                      <p>Sign up using my link to get a 10% cash bonus on deposit!</p>
                      <p>Link: {referralLink}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`Hey! I am using StocksLab for trading F&O and Commodity with high leverage and quick payouts.\nSign up using my link to get a 10% cash bonus on deposit!\nLink: ${referralLink}`);
                      alert('Copied WhatsApp text!');
                    }}
                    className="w-full py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Share2 size={13} /> Copy WhatsApp Template
                  </button>
                </div>

              </div>

              {/* QR Code Card */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">In-Person Signups</span>
                  <h4 className="text-base font-bold text-white">Your Custom Partner QR Code</h4>
                  <p className="text-xs text-slate-400 max-w-md">Clients can scan this QR code directly with any phone camera to open your signup link instantly.</p>
                </div>

                <div className="bg-white p-3 rounded-2xl flex flex-col items-center gap-2 border-4 border-emerald-500/30 shadow-xl">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(referralLink)}`}
                    alt="Partner QR Code"
                    className="w-32 h-32"
                  />
                  <span className="text-[10px] font-extrabold text-slate-900 font-mono tracking-wider">{user?.affiliate_code}</span>
                </div>
              </div>

            </div>
          )}

        </section>

      </main>

    </div>
  );
}
