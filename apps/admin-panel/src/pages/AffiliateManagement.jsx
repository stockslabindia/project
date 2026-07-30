import { useState, useEffect, useCallback } from 'react';
import {
  Users2, TrendingUp, Settings, BarChart3, Plus, Edit3, RefreshCw,
  CheckCircle, XCircle, Clock, DollarSign, Save, Play, Camera, Globe, Send,
  AlertTriangle, Loader2, Search, Filter, Star, Award, Zap, Banknote, Eye,
  CreditCard, Calendar, FileText
} from 'lucide-react';

const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const API_BASE = VITE_API_URL.endsWith('/api') ? VITE_API_URL : `${VITE_API_URL}/api`;

const api = {
  get: (path) => {
    const token = localStorage.getItem('admin_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/admin${path}`, { credentials: 'include', headers }).then(r => r.json());
  },
  put: (path, body) => {
    const token = localStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/admin${path}`, { method: 'PUT', credentials: 'include', headers, body: JSON.stringify(body) }).then(r => r.json());
  },
  post: (path, body) => {
    const token = localStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/admin${path}`, { method: 'POST', credentials: 'include', headers, body: JSON.stringify(body) }).then(r => r.json());
  },
};

const PLATFORM_ICONS = { youtube: Play, instagram: Camera, twitter: Globe, telegram: Send, website: Globe, other: Globe };
const STATUS_COLORS = { active: 'bg-emerald-100 text-emerald-700', paused: 'bg-amber-100 text-amber-700', banned: 'bg-red-100 text-red-700' };
const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700',  icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700',    icon: CheckCircle },
  paid:     { label: 'Paid',     color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700',      icon: XCircle },
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'tiers', label: 'Affiliate Tiers', icon: Award },
  { id: 'partners', label: 'Partners', icon: Users2 },
  { id: 'commissions', label: 'Commission Ledger', icon: DollarSign },
  { id: 'payouts', label: 'Payouts & Payout Ledger', icon: Banknote },
];

const fmt = v => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function StatCard({ label, value, sub, color = 'indigo', icon: Icon }) {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600', emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600', rose: 'from-rose-500 to-rose-600',
    blue: 'from-blue-500 to-blue-600', purple: 'from-purple-500 to-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 group cursor-pointer">
      <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 flex items-center ${checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-md ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className={`text-sm font-semibold ${checked ? 'text-emerald-600' : 'text-gray-500'}`}>{label}</span>
    </button>
  );
}

function ConfigInput({ label, value, onChange, suffix = '', prefix = '', type = 'number', step = '0.01' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide dark:text-gray-400">{label}</label>
      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400 transition-all dark:bg-gray-850 dark:border-gray-800">
        {prefix && <span className="text-gray-400 text-sm font-semibold">{prefix}</span>}
        <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-bold text-gray-900 focus:outline-none min-w-0 dark:text-white" />
        {suffix && <span className="text-gray-400 text-sm font-semibold">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── OVERVIEW TAB ───────────────────────────────────────────
function OverviewTab({ overview }) {
  if (!overview) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Affiliates" value={overview.total_affiliates_active || 0} sub="Partners" icon={Star} color="purple" />
        <StatCard label="Affiliate Deposit Comm." value={fmt(overview.total_affiliate_deposit_commissions)} sub="From deposits" icon={DollarSign} color="blue" />
        <StatCard label="Affiliate Trade Comm." value={fmt(overview.total_affiliate_trade_commissions)} sub="From trades" icon={Zap} color="indigo" />
        <StatCard label="Pending Payouts" value={fmt(overview.pending_affiliate_payouts)} sub="Affiliate Backoffice earnings" icon={Clock} color="amber" />
      </div>
    </div>
  );
}

// ─── AFFILIATE SETTINGS TAB ──────────────────────────────────
function SettingsTab({ onRefresh }) {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/referrals/config').then(c => {
      if (c.config) setConfig(c.config);
    });
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const r = await api.put('/referrals/config', config);
      if (r.config) { setConfig(r.config); setMsg('Saved successfully!'); onRefresh(); }
      else setMsg(r.error || 'Failed to save');
    } finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  if (!config) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Program Configuration</h3>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">All changes apply to future events only</p>
        </div>
        <Toggle checked={config.affiliate_program_active} onChange={v => setConfig(c => ({ ...c, affiliate_program_active: v }))} label="Affiliate Program Status" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ConfigInput label="Deposit Share % (Every Deposit)" value={config.affiliate_deposit_commission_pct ?? 15} onChange={v => setConfig(c => ({ ...c, affiliate_deposit_commission_pct: v }))} suffix="%" />
        <ConfigInput label="Max Cap per Deposit (INR)" value={config.affiliate_deposit_commission_cap ?? 5000} onChange={v => setConfig(c => ({ ...c, affiliate_deposit_commission_cap: v }))} prefix="₹" />
        <ConfigInput label="Weekly Net Loss Share %" value={config.affiliate_net_loss_share_pct ?? 10} onChange={v => setConfig(c => ({ ...c, affiliate_net_loss_share_pct: v }))} suffix="%" />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide dark:text-gray-400">Affiliate Payout Schedule</label>
          <select value={config.affiliate_payout_cycle || 'biweekly'} onChange={e => setConfig(c => ({ ...c, affiliate_payout_cycle: e.target.value }))}
            className="w-full bg-transparent border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all dark:border-gray-850 dark:text-white dark:bg-gray-900">
            <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={saveConfig} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </button>
        {msg && <span className={`text-sm font-semibold ${msg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
      </div>
    </div>
  );
}

// ─── AFFILIATE TIERS TAB ──────────────────────────────────────
function TiersTab() {
  const [tiers, setTiers] = useState([]);
  const [editingTier, setEditingTier] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await api.get('/affiliate-tiers');
    if (r.tiers) setTiers(r.tiers);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveTier = async (tier) => {
    const r = await api.put(`/affiliate-tiers/${tier.id}`, tier);
    if (r.tier) { setTiers(ts => ts.map(t => t.id === tier.id ? r.tier : t)); setEditingTier(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-800">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Partner Level Tiers</h3>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Commission structures based on minimum referred client counts</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800">
          <tr>
            {['Tier', 'Min Referred Users', 'Deposit Comm %', 'Trade Comm %', 'Active', 'Actions'].map(h => (
              <th key={h} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
          {tiers.map(tier => (
            <tr key={tier.id} className="hover:bg-gray-50 dark:hover:bg-gray-850/50 transition-colors">
              {editingTier?.id === tier.id ? (
                <>
                  <td className="px-6 py-4"><input value={editingTier.name} onChange={e => setEditingTier(t => ({ ...t, name: e.target.value }))} className="w-28 border border-gray-300 rounded px-2 py-1 text-sm bg-transparent dark:border-gray-700 dark:text-white" /></td>
                  <td className="px-6 py-4"><input type="number" value={editingTier.min_referred_users} onChange={e => setEditingTier(t => ({ ...t, min_referred_users: e.target.value }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm bg-transparent dark:border-gray-700 dark:text-white" /></td>
                  <td className="px-6 py-4"><input type="number" step="0.01" value={editingTier.default_deposit_pct} onChange={e => setEditingTier(t => ({ ...t, default_deposit_pct: e.target.value }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm bg-transparent dark:border-gray-700 dark:text-white" /></td>
                  <td className="px-6 py-4"><input type="number" step="0.01" value={editingTier.default_trade_pct} onChange={e => setEditingTier(t => ({ ...t, default_trade_pct: e.target.value }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm bg-transparent dark:border-gray-700 dark:text-white" /></td>
                  <td className="px-6 py-4"><input type="checkbox" checked={editingTier.is_active} onChange={e => setEditingTier(t => ({ ...t, is_active: e.target.checked }))} /></td>
                  <td className="px-6 py-4 flex gap-2">
                    <button onClick={() => saveTier(editingTier)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Save</button>
                    <button onClick={() => setEditingTier(null)} className="text-xs font-semibold text-gray-400 hover:text-gray-600">Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-white"><span className="w-3 h-3 rounded-full" style={{ background: tier.display_color }} />{tier.name}</span></td>
                  <td className="px-6 py-4">{tier.min_referred_users}</td>
                  <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{tier.default_deposit_pct}%</td>
                  <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{tier.default_trade_pct}%</td>
                  <td className="px-6 py-4">{tier.is_active ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                  <td className="px-6 py-4"><button onClick={() => setEditingTier({ ...tier })} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Edit3 className="w-3 h-3" />Edit</button></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── PARTNERS TAB ───────────────────────────────────────────
function PartnersTab({ affiliates, tiers, loading, load, msg, setMsg }) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name:'', email:'', phone:'', platform:'youtube', channel_url:'', subscriber_count:'', affiliate_code:'', deposit_commission_pct:'15', deposit_commission_cap:'5000', net_loss_share_pct:'10', notes:'', password:'' });
  const [editForm, setEditForm] = useState({ name:'', email:'', phone:'', platform:'youtube', channel_url:'', subscriber_count:'', deposit_commission_pct:'15', deposit_commission_cap:'5000', net_loss_share_pct:'10', tier_id:'', notes:'', password:'' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    const r = await api.post('/affiliates', form);
    setSaving(false);
    if (r.affiliate) {
      setShowCreate(false);
      setForm({ name:'', email:'', phone:'', platform:'youtube', channel_url:'', subscriber_count:'', affiliate_code:'', deposit_commission_pct:'15', deposit_commission_cap:'5000', net_loss_share_pct:'10', notes:'', password:'' });
      load();
      setMsg('Affiliate created!');
    } else setMsg(r.error || 'Failed');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleUpdate = async () => {
    setSaving(true);
    const r = await api.put(`/affiliates/${editingId}`, editForm);
    setSaving(false);
    if (r.affiliate) {
      setEditingId(null);
      setEditForm({ name:'', email:'', phone:'', platform:'youtube', channel_url:'', subscriber_count:'', deposit_commission_pct:'15', deposit_commission_cap:'5000', net_loss_share_pct:'10', tier_id:'', notes:'', password:'' });
      load();
      setMsg('Affiliate updated!');
    } else {
      setMsg(r.error || 'Failed to update');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleStatusChange = async (id, status) => {
    await api.put(`/affiliates/${id}`, { status });
    load();
  };

  const filtered = affiliates.filter(a => !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.affiliate_code?.includes(search.toUpperCase()) || a.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search affiliates..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-900 dark:border-gray-800 dark:text-white" />
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-sm font-semibold ${msg.includes('created') || msg.includes('updated') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer">
            <Plus className="w-4 h-4" />Add Affiliate
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add New Affiliate Partner</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['Full Name', 'name', 'text'], ['Email (Login ID)', 'email', 'email'], ['Phone', 'phone', 'text'], ['Channel URL', 'channel_url', 'text']].map(([label, key, type]) => (
                <div key={key} className={key === 'channel_url' ? 'col-span-2' : ''}>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Platform</label>
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white">
                  {['youtube','instagram','twitter','telegram','website','other'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Subscribers</label>
                <input type="number" value={form.subscriber_count} onChange={e => setForm(f => ({ ...f, subscriber_count: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Affiliate Code *</label>
                <input type="text" value={form.affiliate_code} onChange={e => setForm(f => ({ ...f, affiliate_code: e.target.value.toUpperCase() }))}
                  placeholder="YT-JOHNDOE" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Tier</label>
                <select value={form.tier_id || ''} onChange={e => setForm(f => ({ ...f, tier_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white">
                  <option value="">Select tier</option>
                  {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Deposit Share %</label>
                <input type="number" step="0.1" value={form.deposit_commission_pct} onChange={e => setForm(f => ({ ...f, deposit_commission_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Max Cap per Deposit (₹)</label>
                <input type="number" value={form.deposit_commission_cap} onChange={e => setForm(f => ({ ...f, deposit_commission_cap: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Weekly Net Loss Share %</label>
                <input type="number" step="0.1" value={form.net_loss_share_pct} onChange={e => setForm(f => ({ ...f, net_loss_share_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Login Password *</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Set account login password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Internal Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name || !form.email || !form.affiliate_code || !form.password}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Partner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Partner Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['Full Name', 'name', 'text'], ['Email', 'email', 'email'], ['Phone', 'phone', 'text'], ['Channel URL', 'channel_url', 'text']].map(([label, key, type]) => (
                <div key={key} className={key === 'channel_url' ? 'col-span-2' : ''}>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">{label}</label>
                  <input type={type} value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Platform</label>
                <select value={editForm.platform} onChange={e => setEditForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white">
                  {['youtube','instagram','twitter','telegram','website','other'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Subscribers</label>
                <input type="number" value={editForm.subscriber_count} onChange={e => setEditForm(f => ({ ...f, subscriber_count: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Affiliate Code (Read-Only)</label>
                <input type="text" value={affiliates.find(a => a.id === editingId)?.affiliate_code || ''} readOnly disabled
                  className="w-full border border-gray-200 bg-gray-50 dark:bg-gray-850/50 dark:border-gray-800 rounded-lg px-3 py-2 text-sm font-mono text-gray-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Tier</label>
                <select value={editForm.tier_id || ''} onChange={e => setEditForm(f => ({ ...f, tier_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white">
                  <option value="">Select tier</option>
                  {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Deposit Share %</label>
                <input type="number" step="0.1" value={editForm.deposit_commission_pct} onChange={e => setEditForm(f => ({ ...f, deposit_commission_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Max Cap per Deposit (₹)</label>
                <input type="number" value={editForm.deposit_commission_cap} onChange={e => setEditForm(f => ({ ...f, deposit_commission_cap: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Weekly Net Loss Share %</label>
                <input type="number" step="0.1" value={editForm.net_loss_share_pct} onChange={e => setEditForm(f => ({ ...f, net_loss_share_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Change Login Password</label>
                <input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Leave blank to keep current password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Internal Notes</label>
                <textarea rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none dark:bg-gray-850 dark:border-gray-850 dark:text-white" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setEditingId(null); setEditForm(null); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={handleUpdate} disabled={saving || !editForm.name || !editForm.email}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partners Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  {['Affiliate', 'Platform', 'Code', 'Deposit %', 'Max Cap', 'Loss Share %', 'Users', 'Earned', 'Pending', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                {filtered.map(aff => {
                  const PIcon = PLATFORM_ICONS[aff.platform] || Globe;
                  return (
                    <tr key={aff.id} className="hover:bg-gray-50 dark:hover:bg-gray-850/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{aff.name}</p>
                          <p className="text-xs text-gray-400">{aff.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3"><PIcon className="w-4 h-4 text-gray-400" /></td>
                      <td className="px-4 py-3"><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold dark:bg-indigo-900/30 dark:text-indigo-400">{aff.affiliate_code}</span></td>
                      <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{aff.deposit_commission_pct || 15}%</td>
                      <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300">{fmt(aff.deposit_commission_cap || 5000)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{aff.net_loss_share_pct || 10}%</td>
                      <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">{aff.referred_users_count || 0}</td>
                      <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">{fmt(aff.total_earnings)}</td>
                      <td className="px-4 py-3"><span className="font-bold text-amber-600 dark:text-amber-400">{fmt(aff.pending_balance)}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${STATUS_COLORS[aff.status]}`}>{aff.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {aff.status === 'active'
                            ? <button onClick={() => handleStatusChange(aff.id, 'paused')} className="text-xs text-amber-600 hover:text-amber-800 font-semibold cursor-pointer">Pause</button>
                            : <button onClick={() => handleStatusChange(aff.id, 'active')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold cursor-pointer">Activate</button>}
                          <button onClick={() => {
                            setEditingId(aff.id);
                            setEditForm({
                              name: aff.name || '',
                              email: aff.email || '',
                              phone: aff.phone || '',
                              platform: aff.platform || 'youtube',
                              channel_url: aff.channel_url || '',
                              subscriber_count: aff.subscriber_count || '0',
                              deposit_commission_pct: aff.deposit_commission_pct || '15',
                              deposit_commission_cap: aff.deposit_commission_cap || '5000',
                              net_loss_share_pct: aff.net_loss_share_pct || '10',
                              tier_id: aff.tier_id || '',
                              notes: aff.notes || '',
                              password: ''
                            });
                          }} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">Edit</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">No affiliates found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMMISSION LEDGER TAB ───────────────────────────────────
function CommissionsTab() {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set('commission_type', type);
    if (status) params.set('status', status);
    const r = await api.get(`/affiliate-commissions?${params}`);
    setCommissions(r.commissions || []);
    setLoading(false);
  }, [type, status]);

  useEffect(() => { load(); }, [load]);

  const STATUS_MAP = { pending: 'bg-amber-100 text-amber-700', included_in_payout: 'bg-blue-100 text-blue-700', paid: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-gray-100 text-gray-500' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={type} onChange={e => setType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-900 dark:border-gray-800 dark:text-white">
          <option value="">All Types</option>
          <option value="deposit">Deposit</option>
          <option value="trade">Trade</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-900 dark:border-gray-800 dark:text-white">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="included_in_payout">In Payout</option>
          <option value="paid">Paid</option>
        </select>
        <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 dark:bg-gray-850 dark:border-gray-800">
                <tr>
                  {['Affiliate', 'Referred User', 'Type', 'Source Amount', 'Rate', 'Commission', 'Date', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                {commissions.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-850/50 transition-colors">
                    <td className="px-4 py-3"><span className="font-semibold text-gray-800 dark:text-white">{c.affiliate_accounts?.name}</span><br /><span className="font-mono text-xs text-gray-400">{c.affiliate_accounts?.affiliate_code}</span></td>
                    <td className="px-4 py-3"><span className="text-gray-700 dark:text-gray-200">{c.profiles?.full_name}</span><br /><span className="text-xs text-gray-400">{c.profiles?.client_id}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.commission_type === 'deposit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{c.commission_type}</span></td>
                    <td className="px-4 py-3 font-semibold">{fmt(c.source_amount)}</td>
                    <td className="px-4 py-3 text-gray-500">{c.commission_pct}%</td>
                    <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{fmt(c.commission_amount)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_MAP[c.status] || ''}`}>{c.status?.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}
                {commissions.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No commissions found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAYOUTS SUB-COMPONENTS ──────────────────────────────────
function PayModal({ payout, onClose, onDone }) {
  const [form, setForm] = useState({ payment_method: 'bank_transfer', payment_reference: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!form.payment_reference) { setError('Payment reference is required'); return; }
    setSaving(true);
    const r = await api.post(`/affiliate-payouts/${payout.id}/pay`, form);
    setSaving(false);
    if (r.message) { onDone(); onClose(); }
    else setError(r.error || 'Failed to mark as paid');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirm Affiliate Settlement</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{payout.affiliate_accounts?.name} — {fmt(payout.total_amount)}</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">⚠ This will deduct ₹{parseFloat(payout.total_amount || 0).toFixed(2)} from the partner's Backoffice pending balance. Check info carefully.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Settlement Method</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-gray-850 dark:border-gray-800 dark:text-white">
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="upi">UPI Transfer</option>
              <option value="other">Other Settlement</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">UTR / Transaction Reference ID *</label>
            <input value={form.payment_reference} onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))}
              placeholder="Enter UTR transaction ID reference"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-gray-850 dark:border-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Settled On Date</label>
            <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-gray-850 dark:border-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Settlement Notes (optional)</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none dark:bg-gray-850 dark:border-gray-800 dark:text-white" />
          </div>
        </div>

        {error && <p className="text-sm text-red-500 font-semibold">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button onClick={handlePay} disabled={saving}
            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Confirm Paid
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ payoutId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/affiliate-payouts/${payoutId}`).then(r => { setData(r); setLoading(false); });
  }, [payoutId]);

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
    </div>
  );

  const { payout, commissions } = data || {};
  const cfg = STATUS_CONFIG[payout?.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Payout Settlement Statement</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{payout?.affiliate_accounts?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold cursor-pointer">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-850 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-xs"><span className="text-gray-500 dark:text-gray-400">Affiliate</span><span className="font-semibold text-gray-850 dark:text-white">{payout?.affiliate_accounts?.name}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500 dark:text-gray-400">Code</span><span className="font-mono text-indigo-600 font-bold dark:text-indigo-400">{payout?.affiliate_accounts?.affiliate_code}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500 dark:text-gray-400">Settlement Period</span><span className="font-semibold text-gray-850 dark:text-white">{fmtDate(payout?.period_start)} – {fmtDate(payout?.period_end)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500 dark:text-gray-400">Events Included</span><span className="font-semibold text-gray-850 dark:text-white">{payout?.commission_count} events</span></div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-850 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-xs"><span className="text-gray-500 dark:text-gray-400">Total Amount</span><span className="font-bold text-xl text-emerald-600 dark:text-emerald-400">{fmt(payout?.total_amount)}</span></div>
              <div className="flex justify-between text-xs items-center"><span className="text-gray-500 dark:text-gray-400">Status</span><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span></div>
              {payout?.payment_reference && <>
                <div className="flex justify-between text-xs"><span className="text-gray-500 dark:text-gray-400">Method</span><span className="font-semibold text-gray-850 dark:text-white capitalize">{payout.payment_method?.replace('_', ' ')}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500 dark:text-gray-400">UTR / Ref ID</span><span className="font-mono text-[10px] text-gray-850 dark:text-white font-bold">{payout.payment_reference}</span></div>
              </>}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Commissions Breakdown</h4>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    {['Type', 'Source Amt', 'Rate', 'Commission', 'Date'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-bold text-gray-500 uppercase dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-gray-700 dark:text-slate-300">
                  {(commissions || []).map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-850/50">
                      <td className="px-3 py-2"><span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${c.commission_type === 'deposit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{c.commission_type}</span></td>
                      <td className="px-3 py-2 font-semibold">{fmt(c.source_amount)}</td>
                      <td className="px-3 py-2 text-gray-500">{c.commission_pct}%</td>
                      <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{fmt(c.commission_amount)}</td>
                      <td className="px-3 py-2 text-gray-500">{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePayoutModal({ affiliates, onClose, onDone }) {
  const [form, setForm] = useState({ affiliate_id: '', period_start: '', period_end: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.affiliate_id || !form.period_start || !form.period_end) { setError('All fields required'); return; }
    setSaving(true);
    const r = await api.post('/affiliate-payouts', form);
    setSaving(false);
    if (r.payout) { onDone(); onClose(); }
    else setError(r.error || 'Failed to create payout request');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create Partner Payout Request</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Collects all pending commissions for the selected partner and date range into a single claim.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Select Affiliate Partner *</label>
            <select value={form.affiliate_id} onChange={e => setForm(f => ({ ...f, affiliate_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-800 dark:text-white">
              <option value="">Select partner</option>
              {affiliates.filter(a => a.status === 'active').map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.affiliate_code}) — Pending: {fmt(a.pending_balance)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Period Start *</label>
              <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block dark:text-gray-400">Period End *</label>
              <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-850 dark:border-gray-800 dark:text-white" />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 font-semibold">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate Request
          </button>
        </div>
      </div>
    </div>
  );
}

function PayoutsTab({ affiliates, loadOverview }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewId, setViewId] = useState(null);
  const [payingPayout, setPayingPayout] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [msg, setMsg] = useState('');
  const [total, setTotal] = useState(0);

  const notify = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 100 });
    if (statusFilter) params.set('status', statusFilter);
    const r = await api.get(`/affiliate-payouts?${params}`);
    setPayouts(r.payouts || []);
    setTotal(r.total || 0);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    setActionLoading(id + '_approve');
    const r = await api.post(`/affiliate-payouts/${id}/approve`, {});
    setActionLoading(null);
    if (r.message) { notify('✓ Payout approved'); load(); loadOverview(); }
    else notify(r.error || 'Failed');
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setActionLoading(id + '_reject');
    const r = await api.post(`/affiliate-payouts/${id}/reject`, { reason });
    setActionLoading(null);
    if (r.message) { notify('Payout rejected'); load(); loadOverview(); }
  };

  const pending = payouts.filter(p => p.status === 'pending');
  const approved = payouts.filter(p => p.status === 'approved');
  const paid = payouts.filter(p => p.status === 'paid');
  const pendingTotal = pending.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
  const approvedTotal = approved.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
  const paidTotal = paid.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Partner Payout settlements</h3>
          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Generate, approve, and confirm payout cycles for affiliate Backoffice settlements</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-sm font-semibold ${msg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer">
            <Plus className="w-4 h-4" />New Payout Request
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div>
            <p className="text-xs font-bold text-gray-500 uppercase dark:text-gray-400">Pending Review</p>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(pendingTotal)}</p>
          <p className="text-[10px] text-gray-400 mt-1">{pending.length} requests awaiting authorization</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-blue-600" /></div>
            <p className="text-xs font-bold text-gray-500 uppercase dark:text-gray-400">Approved (Pending Transfer)</p>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(approvedTotal)}</p>
          <p className="text-[10px] text-gray-400 mt-1">{approved.length} requests ready for execution</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><Banknote className="w-4 h-4 text-emerald-600" /></div>
            <p className="text-xs font-bold text-gray-500 uppercase dark:text-gray-400">Total Settled (Paid)</p>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(paidTotal)}</p>
          <p className="text-[10px] text-gray-400 mt-1">{paid.length} payouts completed</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {['', 'pending', 'approved', 'paid', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors capitalize cursor-pointer ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {s || 'All'}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{total} requests</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 dark:bg-gray-850 dark:border-gray-800">
                <tr>
                  {['Affiliate', 'Period', 'Commissions', 'Amount', 'Status', 'Requested', 'Reference', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                {payouts.map(p => {
                  const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  const isActioning = actionLoading?.startsWith(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-850/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 dark:text-white">{p.affiliate_accounts?.name}</p>
                        <p className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{p.affiliate_accounts?.affiliate_code}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        <span className="text-xs">{fmtDate(p.period_start)} – {fmtDate(p.period_end)}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-center">{p.commission_count}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white text-base">{fmt(p.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDate(p.requested_at)}</td>
                      <td className="px-4 py-3">
                        {p.payment_reference
                          ? <span className="font-mono text-xs text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded">{p.payment_reference}</span>
                          : <span className="text-gray-405 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => setViewId(p.id)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer">
                            <Eye className="w-3 h-3" />View
                          </button>
                          {p.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(p.id)} disabled={isActioning}
                                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-semibold px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50 cursor-pointer">
                                {actionLoading === p.id + '_approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Approve
                              </button>
                              <button onClick={() => handleReject(p.id)} disabled={isActioning}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 cursor-pointer">
                                <XCircle className="w-3 h-3" />Reject
                              </button>
                            </>
                          )}
                          {p.status === 'approved' && (
                            <button onClick={() => setPayingPayout(p)}
                              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-850 font-bold px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 transition-colors cursor-pointer">
                                <Banknote className="w-3 h-3" />Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {payouts.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Banknote className="w-10 h-10 text-gray-200 dark:text-gray-800" />
                      <p className="text-slate-400 text-sm font-semibold">No settlements requests found</p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewId && <DetailModal payoutId={viewId} onClose={() => setViewId(null)} />}
      {payingPayout && <PayModal payout={payingPayout} onClose={() => setPayingPayout(null)} onDone={() => { load(); loadOverview(); }} />}
      {showCreate && <CreatePayoutModal affiliates={affiliates} onClose={() => setShowCreate(false)} onDone={() => { load(); loadOverview(); }} />}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────
export default function AffiliateManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [affiliates, setAffiliates] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const [o, a, t] = await Promise.all([
      api.get('/referrals/overview'),
      api.get('/affiliates'),
      api.get('/affiliate-tiers')
    ]);
    setOverview(o);
    setAffiliates(a.affiliates || []);
    setTiers(t.tiers || []);
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-white">
            <Users2 className="w-7 h-7 text-indigo-600" />
            Affiliate Partners (IB Network)
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Onboard sub-brokers/influencers, review trade commission logs, and approve settlements</p>
        </div>
        <button onClick={loadData} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors cursor-pointer dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab.id ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab overview={overview} />}
        {activeTab === 'settings' && <SettingsTab onRefresh={loadData} />}
        {activeTab === 'tiers' && <TiersTab />}
        {activeTab === 'partners' && <PartnersTab affiliates={affiliates} tiers={tiers} loading={loading} load={loadData} msg={msg} setMsg={setMsg} />}
        {activeTab === 'commissions' && <CommissionsTab />}
        {activeTab === 'payouts' && <PayoutsTab affiliates={affiliates} loadOverview={loadData} />}
      </div>
    </div>
  );
}
