import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, Users, DollarSign, Award, Copy, Check, Share2, 
  UserPlus, Library, Landmark, Gift, LogOut, ArrowRight, 
  RotateCw, PlusCircle, Search, Mail, Phone, Calendar, 
  CheckCircle2, AlertCircle, Clock, Ban, Loader2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
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

  useEffect(() => {
    loadStats();
    loadOffers();
  }, [loadStats, loadOffers]);

  useEffect(() => {
    if (activeTab === 'referrals') {
      loadReferrals();
    } else if (activeTab === 'leads') {
      loadLeads();
    }
  }, [activeTab, loadReferrals, loadLeads]);

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
              {offersData?.tiers?.find(t => t.id === user?.tier_id)?.name || 'Standard Affiliate'}
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
                Deposit Revenue Share: <span className="text-emerald-400">{user?.deposit_commission_pct || 3}%</span>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
                <TrendingUp size={13} className="text-blue-400" />
                Trade Share: <span className="text-blue-400">{user?.trade_commission_pct || 0.5}%</span>
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => {
                loadStats();
                if (activeTab === 'referrals') loadReferrals();
                else if (activeTab === 'leads') loadLeads();
              }}
              className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RotateCw size={15} />
            </button>
            <button 
              onClick={() => setActiveTab('leads')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
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
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Upcoming Payout</span>
                    <Clock size={14} className="text-amber-400" />
                  </div>
                  {loadingStats ? (
                    <div className="h-6 w-20 bg-white/5 animate-pulse rounded" />
                  ) : (
                    <p className="text-xl font-extrabold text-amber-400 font-sans">{formatCurrency(stats?.pending_balance)}</p>
                  )}
                  <span className="text-[9px] text-slate-500 mt-1 block">Pending approval</span>
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
                        <th className="px-6 py-4 text-right">Commission Earned</th>
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Bank Details Form */}
              <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Submit Payout Channels</h3>
                  <p className="text-xs text-slate-400 mt-1">Specify your direct Bank Account or UPI details. Admin payouts are settled automatically at the end of each bi-weekly cycle.</p>
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
                      placeholder="e.g. HDFC Bank"
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Account Number</label>
                    <input 
                      type="text" 
                      value={bankForm.bank_account_number}
                      onChange={e => setBankForm(f => ({ ...f, bank_account_number: e.target.value }))}
                      placeholder="e.g. 50100234567890"
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm text-white focus:outline-none placeholder-slate-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Bank IFSC Code</label>
                    <input 
                      type="text" 
                      value={bankForm.bank_ifsc}
                      onChange={e => setBankForm(f => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))}
                      placeholder="e.g. HDFC0001234"
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

              {/* Payout Policy Details */}
              <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark size={16} className="text-emerald-400" />
                  Payout Settlements Policy
                </h3>
                
                <div className="space-y-4 text-xs text-slate-400 leading-relaxed font-medium">
                  <p>
                    StocksLab settles affiliate Backoffice commissions according to a bi-weekly cycle (1st to 15th, and 16th to 30th/31st of every month).
                  </p>

                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                      <div>
                        <h4 className="font-bold text-white text-xs mb-0.5">Autocredit Triggers</h4>
                        <p className="text-[11px]">Once your referred clients deposit funds or close trades, commissions calculate immediately and reflect in your Upcoming / Pending balance.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                      <div>
                        <h4 className="font-bold text-white text-xs mb-0.5">Approval Flow</h4>
                        <p className="text-[11px]">Administrators review the volume for B-Book compliance and clear pending commissions into paid balances directly within 48 hours of cycle end.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                      <div>
                        <h4 className="font-bold text-white text-xs mb-0.5">Direct Transfers</h4>
                        <p className="text-[11px]">Payments are processed directly to your saved UPI ID or Bank account details. Double check entries to avoid routing delays.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[11px] font-semibold leading-normal">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>Minimum threshold for automatic bank settlements is ₹2,000. Balance carries over.</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </section>

      </main>

    </div>
  );
}
