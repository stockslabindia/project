import { useState, useEffect } from 'react';
import { ShieldBan, Lock, Search, Save, UserX, ToggleLeft, ToggleRight, AlertTriangle, Loader2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';

const DEFAULT_RESTRICTIONS = {
  login: true,
  trading: true,
  withdrawals: true,
  mcx: false,
  options: true,
  leverage_multiplier: 1.0,
  max_order_value: 500000
};

export default function ClientRestrictions() {
  const [searchQuery, setSearchQuery] = useState('SL84110');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allRestrictions, setAllRestrictions] = useState([]);
  
  const [restrictions, setRestrictions] = useState(DEFAULT_RESTRICTIONS);
  const [currentId, setCurrentId] = useState(null);

  useEffect(() => {
    fetchRestrictions();
  }, []);

  const fetchRestrictions = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getCrmModule('client-restrictions');
      const data = res.client_restrictions || [];
      setAllRestrictions(data);
      
      const found = data.find(r => r.client_id === searchQuery);
      if (found) {
        setRestrictions(found);
        setCurrentId(found.id);
      } else {
        setRestrictions(DEFAULT_RESTRICTIONS);
        setCurrentId(null);
      }
    } catch (err) {
      console.error('Failed to fetch client restrictions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const found = allRestrictions.find(r => r.client_id === searchQuery);
    if (found) {
      setRestrictions(found);
      setCurrentId(found.id);
    } else {
      setRestrictions(DEFAULT_RESTRICTIONS);
      setCurrentId(null);
    }
  };

  const toggle = (key) => setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));

  const saveConfig = async () => {
    if (!searchQuery) return alert('Enter a Client ID');
    try {
      setSaving(true);
      const payload = {
        client_id: searchQuery,
        login: restrictions.login,
        trading: restrictions.trading,
        withdrawals: restrictions.withdrawals,
        options: restrictions.options,
        mcx: restrictions.mcx,
        leverage_multiplier: parseFloat(restrictions.leverage_multiplier || 1.0),
        max_order_value: parseInt(restrictions.max_order_value || 500000)
      };
      
      if (currentId) {
        await adminApi.updateCrmModule('client-restrictions', currentId, payload);
        alert('Config updated successfully!');
      } else {
        const res = await adminApi.updateCrmModule('client-restrictions', 'new', payload);
        setCurrentId(res.data?.id || null);
        alert('Config created successfully!');
      }
      await fetchRestrictions();
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('Failed to save client configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Restrictions</h1>
          <p className="text-sm text-gray-500 mt-1">Apply specific blocks, segment bans, or custom limits to individual accounts.</p>
        </div>
        <button onClick={saveConfig} disabled={saving} className="inline-flex items-center justify-center rounded-md text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 h-10 px-6 py-2 shadow-sm disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? 'Saving...' : 'Save Client Config'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">Search Client ID</label>
        <div className="flex gap-2">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-blue-500 ring-1 ring-blue-500 rounded-md text-base font-bold bg-blue-50 focus:outline-none"
            />
          </div>
          <button onClick={handleSearch} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 text-sm font-medium">Load</button>
        </div>
        
        {loading ? (
          <div className="mt-4 flex items-center text-gray-500 p-4"><Loader2 className="w-5 h-5 animate-spin mr-2"/> Loading...</div>
        ) : (
          <div className="mt-4 flex items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
              <UserX className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{searchQuery || 'No Client Selected'}</h2>
              <p className="text-sm text-gray-500">Manage restrictions for this specific ID</p>
            </div>
            <div className="ml-auto">
              <span className={`px-3 py-1 rounded text-xs font-bold uppercase border ${currentId ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {currentId ? 'Custom Config Exists' : 'Using Global Defaults'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-600" />
            <h3 className="font-bold text-gray-900">Account Level Access</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <div className="text-sm font-bold text-gray-900">Login Access</div>
                <div className="text-xs text-gray-500">Allow user to log into the terminal</div>
              </div>
              <button onClick={() => toggle('login')}>
                {restrictions.login ? <ToggleRight className="h-8 w-8 text-green-500" /> : <ToggleLeft className="h-8 w-8 text-gray-300" />}
              </button>
            </div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <div className="text-sm font-bold text-gray-900">Trading Access</div>
                <div className="text-xs text-gray-500">Allow placing new orders</div>
              </div>
              <button onClick={() => toggle('trading')}>
                {restrictions.trading ? <ToggleRight className="h-8 w-8 text-green-500" /> : <ToggleLeft className="h-8 w-8 text-gray-300" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-gray-900">Withdrawals</div>
                <div className="text-xs text-gray-500">Allow requesting payouts</div>
              </div>
              <button onClick={() => toggle('withdrawals')}>
                {restrictions.withdrawals ? <ToggleRight className="h-8 w-8 text-green-500" /> : <ToggleLeft className="h-8 w-8 text-gray-300" />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-red-500" />
            <h3 className="font-bold text-gray-900">Segment Blocks</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <div className="text-sm font-bold text-gray-900">F&O Options Trading</div>
                <div className="text-xs text-gray-500">Enable/disable option buying/selling</div>
              </div>
              <button onClick={() => toggle('options')}>
                {restrictions.options ? <ToggleRight className="h-8 w-8 text-green-500" /> : <ToggleLeft className="h-8 w-8 text-gray-300" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-gray-900 text-red-600">MCX Commodities</div>
                <div className="text-xs text-gray-500">Enable/disable MCX segment</div>
              </div>
              <button onClick={() => toggle('mcx')}>
                {restrictions.mcx ? <ToggleRight className="h-8 w-8 text-green-500" /> : <ToggleLeft className="h-8 w-8 text-gray-300" />}
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h3 className="font-bold text-gray-900">Custom Risk Overrides</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Leverage Multiplier</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  step="0.1"
                  value={restrictions.leverage_multiplier}
                  onChange={(e) => setRestrictions(prev => ({...prev, leverage_multiplier: parseFloat(e.target.value)}))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-bold" 
                />
                <span className="text-sm text-gray-500 font-medium">x of Global Segment Margin</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">E.g., 0.5 means client gets half the normal leverage.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Max Single Order Value (₹)</label>
              <input 
                type="number" 
                value={restrictions.max_order_value}
                onChange={(e) => setRestrictions(prev => ({...prev, max_order_value: parseInt(e.target.value)}))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-bold" 
              />
              <p className="text-xs text-gray-500 mt-1">Block orders exceeding this notional value.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
