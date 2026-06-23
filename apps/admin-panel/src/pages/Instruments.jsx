import { useState, useEffect } from 'react';
import { Plus, Edit2, Play, Pause, Sliders, ShieldAlert, Ban, Loader2, X } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function Instruments() {
  const [instruments, setInstruments] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInst, setSelectedInst] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add script state
  const [newScript, setNewScript] = useState({
    symbol: '',
    name: '',
    segment: 'nse_equity',
    instrument_type: 'equity',
    lot_size: 1,
    tick_size: 0.05,
    margin_required: 10,
    base_spread: 0.05,
    trading_enabled: true,
    is_active: true
  });

  // Advanced config state
  const [configSpread, setConfigSpread] = useState('');
  const [configLotSize, setConfigLotSize] = useState('');
  const [configRestriction, setConfigRestriction] = useState('none');

  useEffect(() => {
    fetchInstruments();
  }, []);

  const fetchInstruments = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getInstruments();
      setInstruments(data.instruments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (inst) => {
    const newStatus = inst.is_active ? false : true;
    try {
      await adminApi.updateInstrument(inst.id, { is_active: newStatus });
      setInstruments(instruments.map(i => 
        i.id === inst.id ? { ...i, is_active: newStatus } : i
      ));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const openConfig = (inst) => {
    setSelectedInst(inst);
    setConfigSpread(inst.base_spread);
    setConfigLotSize(inst.lot_size);

    let rest = 'none';
    if (inst.trading_enabled === false) rest = 'block_all';
    else if (inst.buy_enabled === false) rest = 'block_buy';
    else if (inst.sell_enabled === false) rest = 'block_sell';
    setConfigRestriction(rest);
    
    setShowConfig(true);
  };

  const handleSaveConfig = async () => {
    try {
      let buyEnabled = true;
      let sellEnabled = true;
      let tradingEnabled = true;
      
      if (configRestriction === 'block_all') {
        buyEnabled = false;
        sellEnabled = false;
        tradingEnabled = false;
      } else if (configRestriction === 'block_buy') {
        buyEnabled = false;
        sellEnabled = true;
        tradingEnabled = true;
      } else if (configRestriction === 'block_sell') {
        buyEnabled = true;
        sellEnabled = false;
        tradingEnabled = true;
      }

      await adminApi.updateInstrument(selectedInst.id, {
        base_spread: parseFloat(configSpread) || 0,
        lot_size: parseInt(configLotSize) || 1,
        buy_enabled: buyEnabled,
        sell_enabled: sellEnabled,
        trading_enabled: tradingEnabled
      });

      setShowConfig(false);
      fetchInstruments();
      alert('Script configurations updated successfully!');
    } catch (err) {
      alert('Failed to update script configurations: ' + err.message);
    }
  };

  const handleCreateScript = async () => {
    if (!newScript.symbol || !newScript.name) return alert('Symbol and Name are required');
    try {
      await adminApi.createInstrument({
        symbol: newScript.symbol.toUpperCase(),
        name: newScript.name,
        segment: newScript.segment,
        instrument_type: newScript.instrument_type,
        lot_size: parseInt(newScript.lot_size) || 1,
        tick_size: parseFloat(newScript.tick_size) || 0.05,
        margin_required: parseFloat(newScript.margin_required) || 10,
        base_spread: parseFloat(newScript.base_spread) || 0.05,
        trading_enabled: newScript.trading_enabled,
        is_active: newScript.is_active
      });

      setShowAddModal(false);
      setNewScript({
        symbol: '',
        name: '',
        segment: 'nse_equity',
        instrument_type: 'equity',
        lot_size: 1,
        tick_size: 0.05,
        margin_required: 10,
        base_spread: 0.05,
        trading_enabled: true,
        is_active: true
      });
      fetchInstruments();
      alert('Script added successfully!');
    } catch (err) {
      alert('Failed to add script: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Script Master (Instruments)</h1>
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Script
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b border-gray-200 tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">Symbol / Segment</th>
                <th className="px-6 py-3 font-semibold text-right">CMP (INR)</th>
                <th className="px-6 py-3 font-semibold text-center">Lot Size</th>
                <th className="px-6 py-3 font-semibold text-right">Spread / Edge</th>
                <th className="px-6 py-3 font-semibold">Trade Status</th>
                <th className="px-6 py-3 text-right font-semibold">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="animate-spin h-5 w-5 text-gray-500" /> Loading scripts...
                    </div>
                  </td>
                </tr>
              ) : instruments.map((inst) => (
                <tr key={inst.id} className="hover:bg-blue-50/50 group">
                  <td className="px-6 py-3">
                    <div className="font-bold text-gray-900">{inst.symbol}</div>
                    <div className="text-[10px] text-gray-500 uppercase">{inst.instrument_type} ({inst.segment})</div>
                  </td>
                  <td className="px-6 py-3 text-right font-medium text-gray-900">
                    ₹{(inst.last_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-center font-medium text-gray-600 bg-gray-50/50">{inst.lot_size}</td>
                  <td className="px-6 py-3 text-right text-gray-600 font-bold">{inst.base_spread}%</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                      inst.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {inst.is_active ? 'active' : 'paused'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openConfig(inst)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Adjust Spread & Restrictions">
                        <Sliders className="h-4 w-4" />
                      </button>
                      <button onClick={() => openConfig(inst)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors" title="Edit Master Data">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <div className="w-px h-6 bg-gray-200 mx-1"></div>
                      {inst.is_active ? (
                        <button onClick={() => toggleStatus(inst)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Emergency Pause Trading">
                          <Pause className="h-4 w-4" />
                        </button>
                      ) : (
                        <button onClick={() => toggleStatus(inst)} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors" title="Resume Trading">
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Control Modal */}
      {showConfig && selectedInst && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Script Control: {selectedInst.symbol}</h3>
              </div>
              <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Spread Edge (%)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                  value={configSpread}
                  onChange={e => setConfigSpread(e.target.value)}
                />
                <p className="text-[10px] text-gray-500 mt-1">Broker edge added to the raw market feed.</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Lot Size Multiplier</label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                  value={configLotSize}
                  onChange={e => setConfigLotSize(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Trade Restrictions</label>
                <select 
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium bg-white"
                  value={configRestriction}
                  onChange={e => setConfigRestriction(e.target.value)}
                >
                  <option value="none">Allow Buy & Sell (Normal)</option>
                  <option value="block_buy">Block Fresh Buys (Square-off Only)</option>
                  <option value="block_sell">Block Fresh Shorting</option>
                  <option value="block_all">Pause Entire Script</option>
                </select>
              </div>

              <div className="bg-red-50 border border-red-200 rounded p-3 mt-4">
                <div className="flex items-start gap-2">
                  <Ban className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-800 font-medium">
                    Restricting buys forces clients to only square off existing positions. Used when broker exposure is too high.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button onClick={() => setShowConfig(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveConfig} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-bold shadow-sm">
                Apply Script Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Script Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add New Trading Script</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Symbol (e.g. INFOSYS)</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded p-2 text-sm uppercase focus:ring-blue-500 font-medium" 
                    value={newScript.symbol}
                    onChange={e => setNewScript({...newScript, symbol: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Script Name</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                    value={newScript.name}
                    onChange={e => setNewScript({...newScript, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Segment</label>
                  <select 
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium bg-white"
                    value={newScript.segment}
                    onChange={e => setNewScript({...newScript, segment: e.target.value})}
                  >
                    <option value="nse_equity">NSE Equity</option>
                    <option value="bse_equity">BSE Equity</option>
                    <option value="fo_futures">F&O Futures</option>
                    <option value="fo_options">F&O Options</option>
                    <option value="mcx">MCX Commodities</option>
                    <option value="forex">Forex</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Instrument Type</label>
                  <select 
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium bg-white"
                    value={newScript.instrument_type}
                    onChange={e => setNewScript({...newScript, instrument_type: e.target.value})}
                  >
                    <option value="equity">Equity</option>
                    <option value="futures">Futures</option>
                    <option value="options">Options</option>
                    <option value="commodity">Commodity</option>
                    <option value="currency">Currency</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Lot Size</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                    value={newScript.lot_size}
                    onChange={e => setNewScript({...newScript, lot_size: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tick Size</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                    value={newScript.tick_size}
                    onChange={e => setNewScript({...newScript, tick_size: parseFloat(e.target.value) || 0.05})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Margin Required (%)</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                    value={newScript.margin_required}
                    onChange={e => setNewScript({...newScript, margin_required: parseFloat(e.target.value) || 10})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Base Spread Edge (%)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                  value={newScript.base_spread}
                  onChange={e => setNewScript({...newScript, base_spread: parseFloat(e.target.value) || 0.05})}
                />
              </div>

              <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newScript.trading_enabled}
                    onChange={e => setNewScript({...newScript, trading_enabled: e.target.checked})}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-gray-700">Trading Enabled</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newScript.is_active}
                    onChange={e => setNewScript({...newScript, is_active: e.target.checked})}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-gray-700">Active Master List</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateScript} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-bold shadow-sm">
                Create Script
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
