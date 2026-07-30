import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Search, ArrowUpRight, ArrowDownRight, ShieldCheck, Loader2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function Wallets() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ user_id: '', amount: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total_system_balance: 0,
    pending_withdrawals_amount: 0,
    recent_deposits_amount: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getWalletTransactions();
      setTransactions(data.transactions || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const term = searchQuery.toLowerCase();
    return (
      (tx.id || '').toLowerCase().includes(term) ||
      (tx.user_id || '').toLowerCase().includes(term) ||
      (tx.profiles?.client_id || '').toLowerCase().includes(term) ||
      (tx.profiles?.full_name || '').toLowerCase().includes(term)
    );
  });

  const handleAdjust = async () => {
    if (!formData.user_id || !formData.amount || !formData.note) {
      return alert('All fields are required');
    }
    setSubmitting(true);
    try {
      await adminApi.adjustWallet({ ...formData, type: modalType });
      setShowModal(false);
      setFormData({ user_id: '', amount: '', note: '' });
      fetchTransactions();
    } catch (err) {
      alert(err.message || 'Failed to adjust wallet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Wallet Management</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => { setModalType('deduct'); setShowModal(true); }}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 h-10 px-4 py-2"
          >
            <Minus className="h-4 w-4 mr-2" />
            Deduct Funds
          </button>
          <button 
            onClick={() => { setModalType('add'); setShowModal(true); }}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 h-10 px-4 py-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Funds
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total System Balance</h3>
          <div className="text-3xl font-bold text-gray-900">₹{stats.total_system_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Pending Withdrawals</h3>
            <div className="text-3xl font-bold text-gray-900">₹{stats.pending_withdrawals_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div className="text-sm text-yellow-600 mt-1 font-medium flex items-center">
              <ShieldCheck className="h-4 w-4 mr-1" /> Requires Approval
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">24h Deposits</h3>
          <div className="text-3xl font-bold text-gray-900">₹{stats.recent_deposits_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-medium text-gray-900">Transaction Security Log</h2>
          <div className="relative w-full max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search TX ID or User..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm text-gray-800"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b border-gray-200 tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">Transaction ID</th>
                <th className="px-6 py-3 font-semibold">User ID</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                <th className="px-6 py-3 font-semibold text-right">Amount (INR)</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Admin/Source</th>
                <th className="px-6 py-3 font-semibold">Note</th>
                <th className="px-6 py-3 font-semibold">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">Loading transactions...</td></tr>
              ) : filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900 text-xs">{tx.id}</td>
                  <td 
                    onClick={() => navigate(`/users/${tx.user_id}`)}
                    className="px-6 py-4 text-blue-600 hover:underline cursor-pointer font-medium"
                  >
                    {tx.profiles?.client_id || tx.user_id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center capitalize text-gray-700 text-xs font-medium">
                      {tx.type === 'deposit' ? <ArrowDownRight className="h-4 w-4 mr-1 text-green-500" /> : 
                       tx.type === 'withdrawal' ? <ArrowUpRight className="h-4 w-4 mr-1 text-red-500" /> : 
                       tx.type === 'trade_pnl' ? (
                         tx.amount >= 0 ? <ArrowDownRight className="h-4 w-4 mr-1 text-green-500" /> : <ArrowUpRight className="h-4 w-4 mr-1 text-red-500" />
                       ) : <Plus className="h-4 w-4 mr-1 text-blue-500" />}
                      {tx.type === 'trade_pnl' ? 'Trade P&L' : tx.type}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    <span className={tx.type === 'deposit' || tx.type === 'adjustment' || (tx.type === 'trade_pnl' && tx.amount >= 0) ? 'text-green-600 font-semibold' : ((tx.type === 'withdrawal' || (tx.type === 'trade_pnl' && tx.amount < 0)) ? 'text-red-500 font-semibold' : 'text-gray-900')}>
                      {tx.type === 'deposit' || (tx.type === 'trade_pnl' && tx.amount >= 0) ? '+' : tx.type === 'withdrawal' || (tx.type === 'trade_pnl' && tx.amount < 0) ? '-' : ''}₹{Math.abs(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700">
                      COMPLETED
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-600">
                    {tx.admin_id ? 'Admin' : <span className="text-gray-400">System</span>}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 max-w-[150px] truncate" title={tx.description}>{tx.description}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</td>
                </tr>
              )) : (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${modalType === 'add' ? 'text-green-700' : 'text-red-700'}`}>
                {modalType === 'add' ? 'Manually Add Funds' : 'Manually Deduct Funds'}
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <input type="text" value={formData.user_id} onChange={e => setFormData({...formData, user_id: e.target.value})} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500" placeholder="e.g. SL82491" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (INR)</label>
                <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Security Reason / Note (Required)</label>
                <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500" rows="3" placeholder="Explain why this manual adjustment is necessary..."></textarea>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex gap-2">
                <ShieldCheck className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <p className="text-xs text-yellow-700">This action will be permanently recorded in the audit log under your admin ID.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdjust} disabled={submitting} className={`px-4 py-2 text-white rounded-md text-sm font-medium ${modalType === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}>
                {submitting ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
