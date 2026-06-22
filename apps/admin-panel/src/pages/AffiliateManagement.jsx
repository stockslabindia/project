import { useState, useEffect, useCallback } from 'react';
import {
  Users2, TrendingUp, Gift, Settings, BarChart3, Plus, Edit3, RefreshCw,
  CheckCircle, XCircle, Clock, DollarSign, Percent, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Save, Play, Camera, Globe, Send,
  AlertTriangle, Loader2, Search, Filter, Star, Award, Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = {
  get: (path) => {
    const token = localStorage.getItem('admin_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/api/admin${path}`, { credentials: 'include', headers }).then(r => r.json());
  },
  put: (path, body) => {
    const token = localStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/api/admin${path}`, { method: 'PUT', credentials: 'include', headers, body: JSON.stringify(body) }).then(r => r.json());
  },
  post: (path, body) => {
    const token = localStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/api/admin${path}`, { method: 'POST', credentials: 'include', headers, body: JSON.stringify(body) }).then(r => r.json());
  },
};


const PLATFORM_ICONS = { youtube: Play, instagram: Camera, twitter: Globe, telegram: Send, website: Globe, other: Globe };
const STATUS_COLORS = { active: 'bg-emerald-100 text-emerald-700', paused: 'bg-amber-100 text-amber-700', banned: 'bg-red-100 text-red-700' };
const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'settings', label: 'Referral Settings', icon: Settings },
  { id: 'affiliates', label: 'Affiliates', icon: Users2 },
  { id: 'commissions', label: 'Commission Ledger', icon: DollarSign },
  { id: 'bonuslog', label: 'Bonus Log', icon: Gift },
];

function StatCard({ label, value, sub, color = 'indigo', icon: Icon }) {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600', emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600', rose: 'from-rose-500 to-rose-600',
    blue: 'from-blue-500 to-blue-600', purple: 'from-purple-500 to-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 group">
      {checked
        ? <ToggleRight className="w-9 h-9 text-emerald-500 group-hover:text-emerald-600 transition-colors" />
        : <ToggleLeft className="w-9 h-9 text-gray-400 group-hover:text-gray-500 transition-colors" />}
      <span className={`text-sm font-semibold ${checked ? 'text-emerald-600' : 'text-gray-500'}`}>{label}</span>
    </button>
  );
}

function ConfigInput({ label, value, onChange, suffix = '', prefix = '', type = 'number', step = '0.01' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400 transition-all">
        {prefix && <span className="text-gray-400 text-sm font-semibold">{prefix}</span>}
        <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-bold text-gray-900 focus:outline-none min-w-0" />
        {suffix && <span className="text-gray-400 text-sm font-semibold">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── OVERVIEW TAB ───────────────────────────────────────────
function OverviewTab({ overview }) {
  if (!overview) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  const fmt = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Referrals" value={overview.total_referrals || 0} sub="Users referred" icon={Users2} color="indigo" />
        <StatCard label="Active Affiliates" value={overview.total_affiliates_active || 0} sub="Partners" icon={Star} color="purple" />
        <StatCard label="Referral Commissions" value={fmt(overview.total_referral_commissions)} sub="Total credited" icon={TrendingUp} color="emerald" />
        <StatCard label="Pending Payouts" value={fmt(overview.pending_affiliate_payouts)} sub="Affiliate earnings" icon={Clock} color="amber" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Bonuses" value={overview.pending_bonus_events || 0} sub="Awaiting 1st deposit" icon={Gift} color="rose" />
        <StatCard label="Bonuses Credited" value={overview.credited_bonus_events || 0} sub="Signup bonuses paid" icon={CheckCircle} color="emerald" />
        <StatCard label="Affiliate Deposit Comm." value={fmt(overview.total_affiliate_deposit_commissions)} sub="From deposits" icon={DollarSign} color="blue" />
        <StatCard label="Affiliate Trade Comm." value={fmt(overview.total_affiliate_trade_commissions)} sub="From trades" icon={Zap} color="indigo" />
      </div>
    </div>
  );
}

// ─── REFERRAL SETTINGS TAB ──────────────────────────────────
function SettingsTab({ onRefresh }) {
  const [config, setConfig] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([api.get('/referrals/config'), api.get('/referrals/tiers')]).then(([c, t]) => {
      if (c.config) setConfig(c.config);
      if (t.tiers) setTiers(t.tiers);
    });
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const r = await api.put('/referrals/config', config);
      if (r.config) { setConfig(r.config); setMsg('Saved successfully!'); }
      else setMsg(r.error || 'Failed to save');
    } finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const saveTier = async (tier) => {
    const r = await api.put(`/referrals/tiers/${tier.id}`, tier);
    if (r.tier) { setTiers(ts => ts.map(t => t.id === tier.id ? r.tier : t)); setEditingTier(null); }
  };

  if (!config) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Global Program Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-gray-900">Program Configuration</h3>
            <p className="text-sm text-gray-500 mt-0.5">All changes apply to future events only</p>
          </div>
          <div className="flex items-center gap-4">
            <Toggle checked={config.referral_program_active} onChange={v => setConfig(c => ({ ...c, referral_program_active: v }))} label="Referral" />
            <Toggle checked={config.affiliate_program_active} onChange={v => setConfig(c => ({ ...c, affiliate_program_active: v }))} label="Affiliate" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <ConfigInput label="Referral 1st Deposit Commission" value={config.referral_deposit_commission_pct} onChange={v => setConfig(c => ({ ...c, referral_deposit_commission_pct: v }))} suffix="%" />
          <ConfigInput label="Bonus Turnover Multiplier" value={config.bonus_turnover_multiplier} onChange={v => setConfig(c => ({ ...c, bonus_turnover_multiplier: v }))} suffix="x" step="0.5" />
          <ConfigInput label="Affiliate Default Deposit %" value={config.affiliate_default_deposit_pct} onChange={v => setConfig(c => ({ ...c, affiliate_default_deposit_pct: v }))} suffix="%" />
          <ConfigInput label="Affiliate Default Trade %" value={config.affiliate_default_trade_pct} onChange={v => setConfig(c => ({ ...c, affiliate_default_trade_pct: v }))} suffix="%" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveConfig} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
          {msg && <span className={`text-sm font-semibold ${msg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
        </div>
      </div>

      {/* Referral Tiers */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Referral Tiers</h3>
          <p className="text-sm text-gray-500 mt-0.5">Commission rates increase with more active referrals</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Tier', 'Min Refs', 'Max Refs', 'Deposit %', 'Active', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tiers.map(tier => (
              <tr key={tier.id} className="hover:bg-gray-50 transition-colors">
                {editingTier?.id === tier.id ? (
                  <>
                    <td className="px-4 py-3"><input value={editingTier.name} onChange={e => setEditingTier(t => ({ ...t, name: e.target.value }))} className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                    <td className="px-4 py-3"><input type="number" value={editingTier.min_referrals} onChange={e => setEditingTier(t => ({ ...t, min_referrals: e.target.value }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                    <td className="px-4 py-3"><input type="number" value={editingTier.max_referrals || ''} onChange={e => setEditingTier(t => ({ ...t, max_referrals: e.target.value || null }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="∞" /></td>
                    <td className="px-4 py-3"><input type="number" step="0.01" value={editingTier.deposit_commission_pct} onChange={e => setEditingTier(t => ({ ...t, deposit_commission_pct: e.target.value }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                    <td className="px-4 py-3"><input type="checkbox" checked={editingTier.is_active} onChange={e => setEditingTier(t => ({ ...t, is_active: e.target.checked }))} /></td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => saveTier(editingTier)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Save</button>
                      <button onClick={() => setEditingTier(null)} className="text-xs font-semibold text-gray-400 hover:text-gray-600">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 font-semibold text-gray-800"><span className="w-3 h-3 rounded-full" style={{ background: tier.display_color }} />{tier.name}</span></td>
                    <td className="px-4 py-3 text-gray-600">{tier.min_referrals}</td>
                    <td className="px-4 py-3 text-gray-600">{tier.max_referrals ?? '∞'}</td>
                    <td className="px-4 py-3"><span className="font-bold text-indigo-600">{tier.deposit_commission_pct}%</span></td>
                    <td className="px-4 py-3">{tier.is_active ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                    <td className="px-4 py-3"><button onClick={() => setEditingTier({ ...tier })} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Edit3 className="w-3 h-3" />Edit</button></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── AFFILIATES TAB ──────────────────────────────────────────
function AffiliatesTab() {
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name:'', email:'', phone:'', platform:'youtube', channel_url:'', subscriber_count:'', affiliate_code:'', deposit_commission_pct:'3', trade_commission_pct:'0.5', notes:'', password:'' });
  const [editForm, setEditForm] = useState({ name:'', email:'', phone:'', platform:'youtube', channel_url:'', subscriber_count:'', deposit_commission_pct:'3', trade_commission_pct:'0.5', tier_id:'', notes:'', password:'' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [tiers, setTiers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, t] = await Promise.all([api.get('/affiliates'), api.get('/affiliate-tiers')]);
    setAffiliates(r.affiliates || []);
    setTiers(t.tiers || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    const r = await api.post('/affiliates', form);
    setSaving(false);
    if (r.affiliate) { setShowCreate(false); setForm({ name:'', email:'', phone:'', platform:'youtube', channel_url:'', subscriber_count:'', affiliate_code:'', deposit_commission_pct:'3', trade_commission_pct:'0.5', notes:'', password:'' }); load(); setMsg('Affiliate created!'); }
    else setMsg(r.error || 'Failed');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleUpdate = async () => {
    setSaving(true);
    const r = await api.put(`/affiliates/${editingId}`, editForm);
    setSaving(false);
    if (r.affiliate) {
      setEditingId(null);
      setEditForm({ name:'', email:'', phone:'', platform:'youtube', channel_url:'', subscriber_count:'', deposit_commission_pct:'3', trade_commission_pct:'0.5', tier_id:'', notes:'', password:'' });
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
  const fmt = v => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search affiliates..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-sm font-semibold ${msg.includes('created') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />Add Affiliate
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">Add New Affiliate</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['Full Name', 'name', 'text'], ['Email', 'email', 'email'], ['Phone', 'phone', 'text'], ['Channel URL', 'channel_url', 'text']].map(([label, key, type]) => (
                <div key={key} className={key === 'channel_url' ? 'col-span-2' : ''}>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Platform</label>
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  {['youtube','instagram','twitter','telegram','website','other'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Subscribers</label>
                <input type="number" value={form.subscriber_count} onChange={e => setForm(f => ({ ...f, subscriber_count: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Affiliate Code *</label>
                <input type="text" value={form.affiliate_code} onChange={e => setForm(f => ({ ...f, affiliate_code: e.target.value.toUpperCase() }))}
                  placeholder="YT-JOHNDOE" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tier</label>
                <select value={form.tier_id || ''} onChange={e => setForm(f => ({ ...f, tier_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="">Select tier</option>
                  {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Deposit Commission %</label>
                <input type="number" step="0.1" value={form.deposit_commission_pct} onChange={e => setForm(f => ({ ...f, deposit_commission_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Trade Commission %</label>
                <input type="number" step="0.1" value={form.trade_commission_pct} onChange={e => setForm(f => ({ ...f, trade_commission_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Login Password</label>
                <input type="password" value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Manually set a login password for the affiliate" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Internal Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name || !form.email || !form.affiliate_code}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Affiliate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">Edit Affiliate Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['Full Name', 'name', 'text'], ['Email', 'email', 'email'], ['Phone', 'phone', 'text'], ['Channel URL', 'channel_url', 'text']].map(([label, key, type]) => (
                <div key={key} className={key === 'channel_url' ? 'col-span-2' : ''}>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{label}</label>
                  <input type={type} value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Platform</label>
                <select value={editForm.platform} onChange={e => setEditForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  {['youtube','instagram','twitter','telegram','website','other'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Subscribers</label>
                <input type="number" value={editForm.subscriber_count} onChange={e => setEditForm(f => ({ ...f, subscriber_count: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Affiliate Code (Read-Only)</label>
                <input type="text" value={affiliates.find(a => a.id === editingId)?.affiliate_code || ''} readOnly disabled
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tier</label>
                <select value={editForm.tier_id || ''} onChange={e => setEditForm(f => ({ ...f, tier_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="">Select tier</option>
                  {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Deposit Commission %</label>
                <input type="number" step="0.1" value={editForm.deposit_commission_pct} onChange={e => setEditForm(f => ({ ...f, deposit_commission_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Trade Commission %</label>
                <input type="number" step="0.1" value={editForm.trade_commission_pct} onChange={e => setEditForm(f => ({ ...f, trade_commission_pct: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Change Login Password</label>
                <input type="password" value={editForm.password || ''} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter new password to change, or leave blank to keep same" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Internal Notes</label>
                <textarea rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setEditingId(null); setEditForm(null); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleUpdate} disabled={saving || !editForm.name || !editForm.email}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Affiliates Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Affiliate', 'Platform', 'Code', 'Deposit %', 'Trade %', 'Users', 'Earned', 'Pending', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(aff => {
                  const PIcon = PLATFORM_ICONS[aff.platform] || Globe;
                  return (
                    <tr key={aff.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">{aff.name}</p>
                          <p className="text-xs text-gray-400">{aff.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3"><PIcon className="w-4 h-4 text-gray-400" /></td>
                      <td className="px-4 py-3"><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold">{aff.affiliate_code}</span></td>
                      <td className="px-4 py-3 font-bold text-indigo-600">{aff.deposit_commission_pct}%</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{aff.trade_commission_pct}%</td>
                      <td className="px-4 py-3 font-semibold text-gray-700">{aff.referred_users_count || 0}</td>
                      <td className="px-4 py-3 font-semibold text-gray-700">{fmt(aff.total_earnings)}</td>
                      <td className="px-4 py-3"><span className="font-bold text-amber-600">{fmt(aff.pending_balance)}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${STATUS_COLORS[aff.status]}`}>{aff.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {aff.status === 'active'
                            ? <button onClick={() => handleStatusChange(aff.id, 'paused')} className="text-xs text-amber-600 hover:text-amber-800 font-semibold">Pause</button>
                            : <button onClick={() => handleStatusChange(aff.id, 'active')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold">Activate</button>}
                          <button onClick={() => {
                            setEditingId(aff.id);
                            setEditForm({
                              name: aff.name || '',
                              email: aff.email || '',
                              phone: aff.phone || '',
                              platform: aff.platform || 'youtube',
                              channel_url: aff.channel_url || '',
                              subscriber_count: aff.subscriber_count || '0',
                              deposit_commission_pct: aff.deposit_commission_pct || '3',
                              trade_commission_pct: aff.trade_commission_pct || '0.5',
                              tier_id: aff.tier_id || '',
                              notes: aff.notes || '',
                              password: ''
                            });
                          }} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">Edit</button>
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

  const fmt = v => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const STATUS_MAP = { pending: 'bg-amber-100 text-amber-700', included_in_payout: 'bg-blue-100 text-blue-700', paid: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-gray-100 text-gray-500' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={type} onChange={e => setType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
          <option value="">All Types</option>
          <option value="deposit">Deposit</option>
          <option value="trade">Trade</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="included_in_payout">In Payout</option>
          <option value="paid">Paid</option>
        </select>
        <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Affiliate', 'Referred User', 'Type', 'Source Amount', 'Rate', 'Commission', 'Date', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {commissions.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><span className="font-semibold text-gray-800">{c.affiliate_accounts?.name}</span><br /><span className="font-mono text-xs text-gray-400">{c.affiliate_accounts?.affiliate_code}</span></td>
                    <td className="px-4 py-3"><span className="text-gray-700">{c.profiles?.full_name}</span><br /><span className="text-xs text-gray-400">{c.profiles?.client_id}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.commission_type === 'deposit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{c.commission_type}</span></td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{fmt(c.source_amount)}</td>
                    <td className="px-4 py-3 text-gray-500">{c.commission_pct}%</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{fmt(c.commission_amount)}</td>
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

// ─── BONUS LOG TAB ───────────────────────────────────────────
function BonusLogTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 100 });
    if (status) params.set('status', status);
    const r = await api.get(`/referrals/bonus-events?${params}`);
    setEvents(r.events || []);
    setTotal(r.total || 0);
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const STATUS_MAP = { pending: 'bg-amber-100 text-amber-700', credited: 'bg-emerald-100 text-emerald-700', expired: 'bg-gray-100 text-gray-500', cancelled: 'bg-red-100 text-red-600' };
  const fmt = v => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
            <option value="">All Status</option>
            <option value="pending">Pending (awaiting 1st deposit)</option>
            <option value="credited">Credited</option>
            <option value="expired">Expired</option>
          </select>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-500">{total} total events</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Referrer', 'New User', 'Code Used', 'Referrer Bonus', 'User Bonus', 'Status', 'Signup Date', 'Credited On'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><span className="font-semibold text-gray-800">{e.referrer?.full_name}</span><br /><span className="text-xs text-gray-400">{e.referrer?.client_id}</span></td>
                    <td className="px-4 py-3"><span className="text-gray-700">{e.referee?.full_name}</span><br /><span className="text-xs text-gray-400">{e.referee?.client_id}</span></td>
                    <td className="px-4 py-3"><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">{e.referral_code}</span></td>
                    <td className="px-4 py-3 font-bold text-indigo-600">{fmt(e.bonus_referrer_amount)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{fmt(e.bonus_referee_amount)}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_MAP[e.status] || ''}`}>{e.status}</span></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.credited_at ? new Date(e.credited_at).toLocaleDateString('en-IN') : <span className="text-amber-500 font-semibold">Pending</span>}</td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No bonus events found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────
export default function AffiliateManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOverview = useCallback(async () => {
    setRefreshing(true);
    const r = await api.get('/referrals/overview');
    setOverview(r);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users2 className="w-7 h-7 text-indigo-600" />
            Referral &amp; Affiliates
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage referral programs, affiliate partners, tiers, and reward settings</p>
        </div>
        <button onClick={loadOverview} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
        {activeTab === 'settings' && <SettingsTab onRefresh={loadOverview} />}
        {activeTab === 'affiliates' && <AffiliatesTab />}
        {activeTab === 'commissions' && <CommissionsTab />}
        {activeTab === 'bonuslog' && <BonusLogTab />}
      </div>
    </div>
  );
}
