import { useState, useEffect, useCallback } from 'react';
import {
  Users2, TrendingUp, Gift, Settings, BarChart3, Plus, Edit3, RefreshCw,
  CheckCircle, XCircle, Clock, DollarSign, Save, Loader2, Filter, Award
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
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'settings', label: 'Referral Settings', icon: Settings },
  { id: 'tiers', label: 'Referral Tiers', icon: Award },
  { id: 'bonuslog', label: 'Bonus Log', icon: Gift },
];

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
  const fmt = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Referrals" value={overview.total_referrals || 0} sub="Users signed up with code" icon={Users2} color="indigo" />
        <StatCard label="Pending Rewards" value={overview.pending_bonus_events || 0} sub="Awaiting first deposit" icon={Clock} color="amber" />
        <StatCard label="Rewards Credited" value={overview.credited_bonus_events || 0} sub="Signup bonuses paid" icon={CheckCircle} color="emerald" />
        <StatCard label="Referral Commissions" value={fmt(overview.total_referral_commissions)} sub="Trader trade commissions paid" icon={TrendingUp} color="blue" />
      </div>
    </div>
  );
}

// ─── REFERRAL SETTINGS TAB ──────────────────────────────────
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
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Referral Program Configuration</h3>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Settings for normal client refer &amp; earn program</p>
        </div>
        <Toggle checked={config.referral_program_active} onChange={v => setConfig(c => ({ ...c, referral_program_active: v }))} label="Referral Program Status" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ConfigInput label="Referrer Signup Bonus" value={config.signup_bonus_referrer} onChange={v => setConfig(c => ({ ...c, signup_bonus_referrer: v }))} prefix="₹" />
        <ConfigInput label="Referee Signup Bonus" value={config.signup_bonus_referee} onChange={v => setConfig(c => ({ ...c, signup_bonus_referee: v }))} prefix="₹" />
        <ConfigInput label="Bonus Turnover Multiplier" value={config.bonus_turnover_multiplier} onChange={v => setConfig(c => ({ ...c, bonus_turnover_multiplier: v }))} suffix="x" step="0.5" />
        <ConfigInput label="Default First Deposit Commission" value={config.referral_deposit_commission_pct} onChange={v => setConfig(c => ({ ...c, referral_deposit_commission_pct: v }))} suffix="%" />
        <ConfigInput label="Default Trade Commission Rate" value={config.referral_trade_commission_pct} onChange={v => setConfig(c => ({ ...c, referral_trade_commission_pct: v }))} suffix="%" />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={saveConfig} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
        {msg && <span className={`text-sm font-semibold ${msg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
      </div>
    </div>
  );
}

// ─── REFERRAL TIERS TAB ──────────────────────────────────────
function TiersTab() {
  const [tiers, setTiers] = useState([]);
  const [editingTier, setEditingTier] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await api.get('/referrals/tiers');
    if (r.tiers) setTiers(r.tiers);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveTier = async (tier) => {
    const r = await api.put(`/referrals/tiers/${tier.id}`, tier);
    if (r.tier) { setTiers(ts => ts.map(t => t.id === tier.id ? r.tier : t)); setEditingTier(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-800">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Referral Reward Tiers</h3>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Commission rates automatically increase as users complete more active referrals</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800">
          <tr>
            {['Tier Name', 'Min Referrals', 'Max Referrals', 'Deposit Comm %', 'Trade Comm %', 'Active', 'Actions'].map(h => (
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
                  <td className="px-6 py-4"><input type="number" value={editingTier.min_referrals} onChange={e => setEditingTier(t => ({ ...t, min_referrals: e.target.value }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm bg-transparent dark:border-gray-700 dark:text-white" /></td>
                  <td className="px-6 py-4"><input type="number" value={editingTier.max_referrals || ''} onChange={e => setEditingTier(t => ({ ...t, max_referrals: e.target.value || null }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm bg-transparent dark:border-gray-700 dark:text-white" placeholder="∞" /></td>
                  <td className="px-6 py-4"><input type="number" step="0.01" value={editingTier.deposit_commission_pct} onChange={e => setEditingTier(t => ({ ...t, deposit_commission_pct: e.target.value }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm bg-transparent dark:border-gray-700 dark:text-white" /></td>
                  <td className="px-6 py-4"><input type="number" step="0.01" value={editingTier.trade_commission_pct} onChange={e => setEditingTier(t => ({ ...t, trade_commission_pct: e.target.value }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm bg-transparent dark:border-gray-700 dark:text-white" /></td>
                  <td className="px-6 py-4"><input type="checkbox" checked={editingTier.is_active} onChange={e => setEditingTier(t => ({ ...t, is_active: e.target.checked }))} /></td>
                  <td className="px-6 py-4 flex gap-2">
                    <button onClick={() => saveTier(editingTier)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Save</button>
                    <button onClick={() => setEditingTier(null)} className="text-xs font-semibold text-gray-400 hover:text-gray-600">Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-white"><span className="w-3 h-3 rounded-full" style={{ background: tier.display_color }} />{tier.name}</span></td>
                  <td className="px-6 py-4">{tier.min_referrals}</td>
                  <td className="px-6 py-4">{tier.max_referrals ?? '∞'}</td>
                  <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{tier.deposit_commission_pct}%</td>
                  <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{tier.trade_commission_pct}%</td>
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
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-gray-900 dark:border-gray-800 dark:text-white">
            <option value="">All Status</option>
            <option value="pending">Pending (awaiting 1st deposit)</option>
            <option value="credited">Credited</option>
            <option value="expired">Expired</option>
          </select>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{total} total events</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  {['Referrer', 'New User', 'Code Used', 'Referrer Bonus', 'User Bonus', 'Status', 'Signup Date', 'Credited On'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                {events.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-850/50 transition-colors">
                    <td className="px-4 py-3"><span className="font-semibold text-gray-800 dark:text-white">{e.referrer?.full_name}</span><br /><span className="text-xs text-gray-400">{e.referrer?.client_id}</span></td>
                    <td className="px-4 py-3"><span className="text-gray-700 dark:text-gray-200">{e.referee?.full_name}</span><br /><span className="text-xs text-gray-400">{e.referee?.client_id}</span></td>
                    <td className="px-4 py-3"><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold dark:bg-indigo-900/30 dark:text-indigo-400">{e.referral_code}</span></td>
                    <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{fmt(e.bonus_referrer_amount)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{fmt(e.bonus_referee_amount)}</td>
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
export default function ReferralManagement() {
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-white">
            <Gift className="w-7 h-7 text-indigo-600" />
            Refer &amp; Earn (Traders)
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Configure global signup bonus milestones and monitor client referrals logs</p>
        </div>
        <button onClick={loadOverview} disabled={refreshing}
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
        {activeTab === 'settings' && <SettingsTab onRefresh={loadOverview} />}
        {activeTab === 'tiers' && <TiersTab />}
        {activeTab === 'bonuslog' && <BonusLogTab />}
      </div>
    </div>
  );
}
