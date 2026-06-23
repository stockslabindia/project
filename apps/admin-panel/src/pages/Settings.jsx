import { useState, useEffect } from 'react';
import { Save, Clock, Loader2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await adminApi.getSettings();
      // data.settings is array of { key, value }
      const settingsMap = {};
      data.settings.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(settings).map(([key, value]) => 
        adminApi.updateSetting(key, value)
      );
      await Promise.all(promises);
      alert('Settings saved successfully!');
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-600 h-8 w-8" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Master Configuration</h1>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center rounded-md text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 h-10 px-6 py-2 shadow-sm">
          {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? 'Saving...' : 'Save Master Config'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Global Trade Risk Parameters</h2>
          <p className="text-sm text-gray-500 mb-6">These settings apply to all clients unless overridden in their specific profile.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Default Max Leverage (x)</label>
                <input type="number" value={settings['default_leverage'] || 100} onChange={e => handleChange('default_leverage', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Max Position Size (₹ Notional)</label>
                <input type="number" value={settings['max_position_size'] || 10000000} onChange={e => handleChange('max_position_size', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Margin Call Alert Level (%)</label>
                <span className="block text-xs text-gray-500 mb-1">Send warning banner to client when margin level falls below this %</span>
                <input type="number" value={settings['margin_call_level'] || 80} onChange={e => handleChange('margin_call_level', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Stop Out / Liquidation Level (%)</label>
                <span className="block text-xs text-gray-500 mb-1">Liquidate when margin falls below this % (Use 0 to liquidate only at 0 Equity)</span>
                <input type="number" value={settings['stop_out_level'] || 50} onChange={e => handleChange('stop_out_level', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-medium" />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Enable Auto-Liquidation Engine</h3>
                  <p className="text-sm text-gray-500 mt-1">If disabled, clients will only receive warning alerts and positions will NOT be automatically closed even at 0 equity.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={settings['auto_liquidation_enabled'] !== 'false'} onChange={e => handleChange('auto_liquidation_enabled', e.target.checked ? 'true' : 'false')} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
        </div>

        <div className="p-6 border-b border-gray-200 bg-orange-50/30">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-bold text-gray-900">Auto-Square Off (Intraday Rules)</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">System will automatically close all open positions at these specified times.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">NSE / BSE Equity</label>
              <input type="time" value={settings['auto_square_off_equity'] || "15:15"} onChange={e => handleChange('auto_square_off_equity', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-orange-500 font-medium text-gray-800" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">F&O Options</label>
              <input type="time" value={settings['auto_square_off_options'] || "15:20"} onChange={e => handleChange('auto_square_off_options', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-orange-500 font-medium text-gray-800" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">MCX / Commodities</label>
              <input type="time" value={settings['auto_square_off_mcx'] || "23:30"} onChange={e => handleChange('auto_square_off_mcx', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-orange-500 font-medium text-gray-800" />
            </div>
          </div>
        </div>

        <div className="p-6 border-b border-gray-200 bg-emerald-50/10">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Crypto Deposit Configuration</h2>
          <p className="text-sm text-gray-500 mb-6">Configure the deposit bonus rate for cryptocurrency payments.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Crypto Deposit Bonus Percentage (%)</label>
              <span className="block text-xs text-gray-500 mb-1">The extra bonus percentage credited to users when depositing via BTC/USDT</span>
              <input 
                type="number" 
                value={settings['crypto_deposit_bonus_pct'] === undefined ? 10 : settings['crypto_deposit_bonus_pct']} 
                onChange={e => handleChange('crypto_deposit_bonus_pct', e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-emerald-500 font-medium text-gray-800" 
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Emergency System Controls</h2>
          <p className="text-sm text-gray-500 mb-6">Master switches for the platform.</p>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Enable Trading Engine</h3>
                <p className="text-sm text-gray-500 mt-1">Allow new orders to be placed and executed.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings['trading_enabled'] === undefined || settings['trading_enabled'] === true || settings['trading_enabled'] === 'true'} onChange={e => handleChange('trading_enabled', e.target.checked ? 'true' : 'false')} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Enable Payouts / Withdrawals</h3>
                <p className="text-sm text-gray-500 mt-1">Allow users to withdraw funds.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings['withdrawals_enabled'] === undefined || settings['withdrawals_enabled'] === true || settings['withdrawals_enabled'] === 'true'} onChange={e => handleChange('withdrawals_enabled', e.target.checked ? 'true' : 'false')} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
