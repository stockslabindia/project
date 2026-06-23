import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Clock, AlertTriangle, ArrowUpRight, IndianRupee, Filter, Eye, Ban, RefreshCw } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function WithdrawalApprovals() {
  const [activeTab, setActiveTab] = useState('pending');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedWd, setSelectedWd] = useState(null);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('Insufficient free margin');
  const [rejectNotes, setRejectNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total_pending_amount: 0,
    total_pending_count: 0,
    total_flagged_count: 0,
    approved_today_amount: 0,
    approved_today_count: 0
  });
  const [settings, setSettings] = useState({
    withdrawal_auto_approve_limit: 10000,
    withdrawal_min_hold_hours: 24,
    first_withdrawal_hold_hours: 72,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getWithdrawals(activeTab === 'all' ? '' : activeTab);
      setWithdrawals(data.withdrawals || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch withdrawals', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await adminApi.getSettings();
      const sMap = {};
      (data.settings || []).forEach(s => {
        if (s.key in settings) {
          try { sMap[s.key] = JSON.parse(s.value); } catch { sMap[s.key] = s.value; }
        }
      });
      setSettings(prev => ({ ...prev, ...sMap }));
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await Promise.all(
        Object.entries(settings).map(([k, v]) => adminApi.updateSetting(k, Number(v)))
      );
      alert('Withdrawal rules updated successfully!');
      fetchSettings();
    } catch (err) {
      alert('Failed to update rules: ' + (err.message || err));
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [activeTab]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleApprove = async () => {
    try {
      await adminApi.approveWithdrawal(selectedWd.id);
      setShowApproveModal(false);
      setSelectedWd(null);
      fetchWithdrawals();
    } catch (err) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleReject = async () => {
    try {
      const combinedReason = rejectReason === 'Other'
        ? (rejectNotes || 'Rejected by admin')
        : `${rejectReason}${rejectNotes ? ` - ${rejectNotes}` : ''}`;
      await adminApi.rejectWithdrawal(selectedWd.id, combinedReason);
      setShowRejectModal(false);
      setSelectedWd(null);
      setRejectNotes('');
      fetchWithdrawals();
    } catch (err) {
      alert(err.message || 'Rejection failed');
    }
  };

  const filtered = withdrawals.filter(wd => {
    const term = searchQuery.toLowerCase();
    return (
      (wd.id || '').toLowerCase().includes(term) ||
      (wd.profiles?.full_name || '').toLowerCase().includes(term) ||
      (wd.profiles?.client_id || '').toLowerCase().includes(term)
    );
  });

  const totalPending = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0);
  const totalFlagged = withdrawals.filter(w => w.status === 'flagged').length;


  const toggleBulk = (id) => {
    setBulkSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    flagged: { label: 'Flagged', color: 'bg-red-100 text-red-700 border-red-200' },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-200' },
    rejected: { label: 'Rejected', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Withdrawal Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">Review, approve, or reject client payout requests.</p>
        </div>
        <div className="flex gap-2">
          {bulkSelected.length > 0 && (
            <button 
              onClick={async () => {
                if (!window.confirm(`Are you sure you want to approve ${bulkSelected.length} withdrawals in batch?`)) {
                  return;
                }
                setLoading(true);
                let successCount = 0;
                let failCount = 0;
                for (const id of bulkSelected) {
                  try {
                    await adminApi.approveWithdrawal(id);
                    successCount++;
                  } catch (err) {
                    console.error(`Failed to approve withdrawal ${id}:`, err);
                    failCount++;
                  }
                }
                alert(`Bulk approval complete. Approved: ${successCount}, Failed: ${failCount}`);
                setBulkSelected([]);
                fetchWithdrawals();
              }}
              className="inline-flex items-center justify-center rounded-md text-sm font-bold bg-green-600 text-white hover:bg-green-700 h-10 px-4 py-2 shadow-sm"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Bulk Approve ({bulkSelected.length})
            </button>
          )}
          <button 
            onClick={fetchWithdrawals} 
            className="inline-flex items-center justify-center rounded-md text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 h-10 px-4 py-2 shadow-sm hover:border-gray-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-5 rounded-lg border shadow-sm ${stats.total_pending_amount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
          <div className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
            {stats.total_pending_amount > 0 && <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />}
            Pending Payouts
          </div>
          <div className="text-xl font-black text-yellow-700">₹{stats.total_pending_amount.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-gray-500 mt-1">{stats.total_pending_count} requests</div>
        </div>
        <div className={`p-5 rounded-lg border shadow-sm ${stats.total_flagged_count > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
            {stats.total_flagged_count > 0 && <AlertTriangle className="h-3 w-3 text-red-500" />}
            Flagged
          </div>
          <div className="text-xl font-black text-red-600">{stats.total_flagged_count}</div>
          <div className="text-[10px] text-gray-500 mt-1">Requires manual review</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">Approved Today</div>
          <div className="text-xl font-black text-green-600">₹{stats.approved_today_amount.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-gray-500 mt-1">{stats.approved_today_count} payouts processed</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">Avg. Processing Time</div>
          <div className="text-xl font-black text-gray-900">2.4 hrs</div>
          <div className="text-[10px] text-gray-500 mt-1">Target: &lt;4 hours</div>
        </div>
      </div>

      {/* Withdrawal Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center px-4 py-3 gap-4">
          <nav className="flex space-x-2 overflow-x-auto">
            {['pending', 'flagged', 'approved', 'rejected', 'all'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`capitalize px-3 py-1.5 font-medium text-sm rounded-md transition-colors whitespace-nowrap ${
                  activeTab === tab ? 'bg-white shadow-sm text-blue-700 border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}>
                {tab}
              </button>
            ))}
          </nav>
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by client or WD ID..." 
              className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800" 
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b border-gray-200 tracking-wider">
              <tr>
                <th className="px-3 py-3 font-semibold w-8">
                  <input 
                    type="checkbox" 
                    checked={filtered.length > 0 && filtered.every(wd => bulkSelected.includes(wd.id))}
                    onChange={() => {
                      const selectableIds = filtered.filter(wd => wd.status === 'pending' || wd.status === 'flagged').map(wd => wd.id);
                      const allSelected = selectableIds.every(id => bulkSelected.includes(id));
                      if (allSelected) {
                        setBulkSelected(prev => prev.filter(id => !selectableIds.includes(id)));
                      } else {
                        setBulkSelected(prev => [...new Set([...prev, ...selectableIds])]);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                  />
                </th>
                <th className="px-4 py-3 font-semibold">WD ID</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Bank</th>
                <th className="px-4 py-3 font-semibold text-right">Balance</th>
                <th className="px-4 py-3 font-semibold text-center">Positions</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map(wd => (
                <tr key={wd.id} className={`hover:bg-gray-50 ${wd.status === 'flagged' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-3 py-3">
                    {(wd.status === 'pending' || wd.status === 'flagged') && (
                      <input type="checkbox" checked={bulkSelected.includes(wd.id)} onChange={() => toggleBulk(wd.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900 text-xs">{wd.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{wd.profiles?.full_name}</div>
                    <div className="text-[10px] text-blue-600 font-medium">{wd.profiles?.client_id}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-black text-gray-900">₹{wd.amount.toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded uppercase">{wd.method}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-600">
                    {wd.method === 'upi' ? (
                      <div>
                        <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.5 rounded mr-1">UPI</span>
                        <span className="font-mono text-gray-700">{wd.upi_id || 'N/A'}</span>
                      </div>
                    ) : wd.method === 'crypto' ? (
                      <div className="space-y-0.5">
                        <div className="font-bold text-gray-800 flex items-center gap-1">
                          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded uppercase">Crypto</span>
                          {wd.bank_name}
                        </div>
                        <div className="text-[11px] font-mono text-gray-600 max-w-[200px] truncate" title={wd.account_number}>
                          Address: {wd.account_number}
                        </div>
                      </div>
                    ) : (
                      wd.bank_name ? (
                        <div className="space-y-0.5">
                          <div className="font-bold text-gray-800">{wd.bank_name}</div>
                          <div className="text-[11px] font-mono text-gray-600">
                            A/C: {wd.account_number} | IFSC: {wd.ifsc_code}
                          </div>
                          {wd.metadata?.account_holder_name && (
                            <div className="text-[10px] text-gray-500 font-semibold bg-blue-50 px-1 py-0.5 rounded inline-block">
                              Holder: {wd.metadata.account_holder_name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                    ₹{((wd.balance_at_request !== null && wd.balance_at_request !== undefined) 
                      ? parseFloat(wd.balance_at_request) 
                      : (wd.profiles?.wallets?.[0]?.balance || 0)).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-gray-700">
                    {wd.open_positions_count !== null && wd.open_positions_count !== undefined ? wd.open_positions_count : '0'}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${statusConfig[wd.status]?.color || statusConfig.pending.color}`}>
                        {statusConfig[wd.status]?.label || 'Pending'}
                      </span>
                      {wd.reject_reason && (
                        <div className="text-[9px] text-gray-500 mt-1">{wd.reject_reason}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(wd.status === 'pending' || wd.status === 'flagged') ? (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setSelectedWd(wd); setShowApproveModal(true); }}
                          className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded hover:bg-green-100 border border-green-200 inline-flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Approve
                        </button>
                        <button onClick={() => { setSelectedWd(wd); setShowRejectModal(true); }}
                          className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded hover:bg-red-100 border border-red-200 inline-flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Thresholds */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Auto-Approval Rules</h2>
          <button
            type="submit"
            disabled={savingSettings}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold disabled:bg-gray-400 shadow-sm transition-colors"
          >
            {savingSettings ? 'Saving...' : 'Save Rules'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Auto-approve up to (₹)</label>
            <input
              type="number"
              value={settings.withdrawal_auto_approve_limit}
              onChange={e => setSettings(prev => ({ ...prev, withdrawal_auto_approve_limit: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-medium bg-white text-gray-900 text-sm focus:outline-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">Withdrawals below this amount are approved instantly</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Min Payout Hold Hours</label>
            <input
              type="number"
              value={settings.withdrawal_min_hold_hours}
              onChange={e => setSettings(prev => ({ ...prev, withdrawal_min_hold_hours: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-medium bg-white text-gray-900 text-sm focus:outline-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">Hours to delay regular withdrawal processing</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">First Payout Hold Hours</label>
            <input
              type="number"
              value={settings.first_withdrawal_hold_hours}
              onChange={e => setSettings(prev => ({ ...prev, first_withdrawal_hold_hours: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 font-medium bg-white text-gray-900 text-sm focus:outline-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">Hours to hold the very first withdrawal request of a client</p>
          </div>
        </div>
      </form>

      {/* Approve Modal */}
      {showApproveModal && selectedWd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Approve Withdrawal</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Client</span><span className="font-bold">{selectedWd.profiles?.client_id} — {selectedWd.profiles?.full_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Amount</span><span className="font-black text-green-700">₹{selectedWd.amount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-sm items-start border-t border-green-150 pt-2">
                <span className="text-gray-600 flex-shrink-0">Payout Details</span>
                <span className="font-bold text-right text-xs">
                  {selectedWd.method === 'upi' ? (
                    `UPI: ${selectedWd.upi_id || 'N/A'}`
                  ) : selectedWd.method === 'crypto' ? (
                    <div className="space-y-0.5">
                      <div className="font-black text-blue-700">Crypto ({selectedWd.bank_name})</div>
                      <div className="font-mono text-gray-750 break-all select-all">Address: {selectedWd.account_number}</div>
                    </div>
                  ) : (
                    selectedWd.bank_name ? (
                      <div className="space-y-0.5">
                        <div className="font-black">{selectedWd.bank_name}</div>
                        <div className="font-mono text-gray-600">A/C: {selectedWd.account_number}</div>
                        <div className="font-mono text-gray-600">IFSC: {selectedWd.ifsc_code}</div>
                        {selectedWd.metadata?.account_holder_name && (
                          <div className="text-[11px] text-gray-500 mt-1 bg-white px-1 py-0.5 rounded inline-block border border-gray-100">Holder: {selectedWd.metadata.account_holder_name}</div>
                        )}
                      </div>
                    ) : 'N/A'
                  )}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowApproveModal(false)} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleApprove} className="flex-1 py-2 rounded-lg bg-green-600 text-sm font-bold text-white hover:bg-green-700 shadow-sm">Confirm & Process</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedWd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Withdrawal — {selectedWd.id.slice(0, 8)}</h3>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">Rejection Reason</label>
              <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm font-medium mb-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="Insufficient free margin">Insufficient free margin</option>
                <option value="Suspicious activity">Suspicious activity</option>
                <option value="KYC not verified">KYC not verified</option>
                <option value="Bank details mismatch">Bank details mismatch</option>
                <option value="Other">Other</option>
              </select>
              <textarea 
                rows={2} 
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="Additional notes..." 
                className="w-full border border-gray-300 rounded p-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" 
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowRejectModal(false); setRejectNotes(''); }} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleReject} className="flex-1 py-2 rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-700 shadow-sm">Reject Withdrawal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
