import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, RefreshCw, AlertTriangle, FileText, IndianRupee, Download, Upload, Check, Copy } from 'lucide-react';
import { adminApi } from '../services/adminApi';

function PaymentMethodCard({ method, onSave }) {
  const isCrypto = method.slot === 3;
  const [upiId, setUpiId] = useState(method.upi_id || '');
  const [bankName, setBankName] = useState(method.bank_name || '');
  const [accountName, setAccountName] = useState(method.account_name || '');
  const [accountNumber, setAccountNumber] = useState(method.account_number || '');
  const [ifscCode, setIfscCode] = useState(method.ifsc_code || '');
  const [instructions, setInstructions] = useState(method.instructions || '');
  const [isActive, setIsActive] = useState(method.is_active);
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [qrCodeName, setQrCodeName] = useState('');

  // Crypto state hooks
  const [btcAddress, setBtcAddress] = useState(method.btc_address || '');
  const [btcQrCodeBase64, setBtcQrCodeBase64] = useState('');
  const [btcQrCodeName, setBtcQrCodeName] = useState('');
  const [usdtAddress, setUsdtAddress] = useState(method.usdt_address || '');
  const [usdtQrCodeBase64, setUsdtQrCodeBase64] = useState('');
  const [usdtQrCodeName, setUsdtQrCodeName] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    setUpiId(method.upi_id || '');
    setBankName(method.bank_name || '');
    setAccountName(method.account_name || '');
    setAccountNumber(method.account_number || '');
    setIfscCode(method.ifsc_code || '');
    setInstructions(method.instructions || '');
    setIsActive(method.is_active);
    setBtcAddress(method.btc_address || '');
    setUsdtAddress(method.usdt_address || '');
    setQrCodeBase64('');
    setQrCodeName('');
    setBtcQrCodeBase64('');
    setBtcQrCodeName('');
    setUsdtQrCodeBase64('');
    setUsdtQrCodeName('');
  }, [method]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrCodeName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrCodeBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBtcFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setBtcQrCodeName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBtcQrCodeBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUsdtFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUsdtQrCodeName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUsdtQrCodeBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      let payload = {};
      if (isCrypto) {
        payload = {
          btc_address: btcAddress,
          usdt_address: usdtAddress,
          instructions,
          is_active: isActive,
          btc_qr_code_url: method.btc_qr_code_url,
          usdt_qr_code_url: method.usdt_qr_code_url
        };
        if (btcQrCodeBase64) {
          payload.btc_qr_code_base64 = btcQrCodeBase64;
        }
        if (usdtQrCodeBase64) {
          payload.usdt_qr_code_base64 = usdtQrCodeBase64;
        }
      } else {
        payload = {
          upi_id: upiId,
          bank_name: bankName,
          account_name: accountName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          instructions,
          is_active: isActive,
          qr_code_url: method.qr_code_url
        };
        if (qrCodeBase64) {
          payload.qr_code_base64 = qrCodeBase64;
        }
      }
      await onSave(method.slot, payload);
      setSaveMessage({ type: 'success', text: 'Saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const getFullUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const apiBaseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : 'http://localhost:4000';
    return `${apiBaseUrl}${path}`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <h3 className="text-sm font-bold text-gray-900">
          {method.slot === 1 ? 'Bank 1 Channel' : method.slot === 2 ? 'Bank 2 Channel' : 'Crypto Deposit Channel'}
        </h3>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ml-2 text-xs font-bold text-gray-700">{isActive ? 'Active' : 'Offline'}</span>
        </label>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        {isCrypto ? (
          <>
            {/* BTC QR Code */}
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 bg-gray-50 border border-gray-200 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                {btcQrCodeBase64 ? (
                  <img src={btcQrCodeBase64} alt="New BTC QR" className="h-full w-full object-contain" />
                ) : method.btc_qr_code_url ? (
                  <img src={getFullUrl(method.btc_qr_code_url)} alt="BTC QR Code" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-gray-400 text-center px-1">No BTC QR</span>
                )}
              </div>
              <div className="flex-grow">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">BTC QR Code Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBtcFileChange}
                  className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            {/* BTC Address */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Bitcoin (BTC) Address</label>
              <input
                type="text"
                value={btcAddress}
                onChange={(e) => setBtcAddress(e.target.value)}
                placeholder="e.g. 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                className="w-full border border-gray-300 rounded px-2.5 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              />
            </div>

            {/* USDT QR Code */}
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 bg-gray-50 border border-gray-200 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                {usdtQrCodeBase64 ? (
                  <img src={usdtQrCodeBase64} alt="New USDT QR" className="h-full w-full object-contain" />
                ) : method.usdt_qr_code_url ? (
                  <img src={getFullUrl(method.usdt_qr_code_url)} alt="USDT QR Code" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-gray-400 text-center px-1">No USDT QR</span>
                )}
              </div>
              <div className="flex-grow">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">USDT TRC20 QR Code Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUsdtFileChange}
                  className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            {/* USDT Address */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">USDT TRC20 Address</label>
              <input
                type="text"
                value={usdtAddress}
                onChange={(e) => setUsdtAddress(e.target.value)}
                placeholder="e.g. TXxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full border border-gray-300 rounded px-2.5 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              />
            </div>
          </>
        ) : (
          <>
            {/* QR Code */}
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 bg-gray-50 border border-gray-200 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                {qrCodeBase64 ? (
                  <img src={qrCodeBase64} alt="New QR" className="h-full w-full object-contain" />
                ) : method.qr_code_url ? (
                  <img src={getFullUrl(method.qr_code_url)} alt="QR Code" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-gray-400 text-center px-1">No QR Code</span>
                )}
              </div>
              <div className="flex-grow">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">QR Code Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            {/* UPI ID */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. trading@upi"
                className="w-full border border-gray-300 rounded px-2.5 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              />
            </div>

            {/* Bank details grid */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Holder Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Holder Name"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account Number"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  placeholder="IFSC Code"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
            </div>
          </>
        )}

        {/* Instructions */}
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">User Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            placeholder={isCrypto ? "Instructions for Crypto deposits..." : "Transfer instructions..."}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
          />
        </div>

        {/* Message Alert */}
        {saveMessage && (
          <div className={`text-[11px] font-semibold p-1.5 rounded ${saveMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {saveMessage.text}
          </div>
        )}

        {/* Action Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-blue-600 border border-transparent rounded text-xs font-bold text-white hover:bg-blue-700 focus:outline-none disabled:bg-gray-400 transition-colors shadow-sm"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

export default function DepositApprovals() {
  const [activeTab, setActiveTab] = useState('pending');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedDep, setSelectedDep] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('UTR not found / Invalid');
  const [rejectNotes, setRejectNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [stats, setStats] = useState({
    total_pending_amount: 0,
    total_pending_count: 0,
    approved_today_amount: 0,
    approved_today_count: 0
  });

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getDeposits(activeTab === 'all' ? '' : activeTab);
      setDeposits(data.deposits || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch deposits', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPaymentMethods();
      setPaymentMethods(data.paymentMethods || []);
    } catch (err) {
      console.error('Failed to fetch payment methods', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'configure') {
      fetchPaymentMethods();
    } else {
      fetchDeposits();
    }
  }, [activeTab]);

  const handleSavePaymentMethod = async (slot, payload) => {
    await adminApi.updatePaymentMethod(slot, payload);
    fetchPaymentMethods();
  };

  const handleApprove = async () => {
    try {
      await adminApi.approveDeposit(selectedDep.id);
      setShowApproveModal(false);
      setSelectedDep(null);
      fetchDeposits();
    } catch (err) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleReject = async () => {
    try {
      const combinedReason = rejectReason === 'Other' 
        ? (rejectNotes || 'Rejected by admin') 
        : `${rejectReason}${rejectNotes ? ` - ${rejectNotes}` : ''}`;
      await adminApi.rejectDeposit(selectedDep.id, combinedReason);
      setShowRejectModal(false);
      setSelectedDep(null);
      setRejectNotes('');
      fetchDeposits();
    } catch (err) {
      alert(err.message || 'Rejection failed');
    }
  };

  const filtered = deposits.filter(dep => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = (
      (dep.utr_number || '').toLowerCase().includes(term) ||
      (dep.profiles?.full_name || '').toLowerCase().includes(term) ||
      (dep.profiles?.client_id || '').toLowerCase().includes(term)
    );

    if (methodFilter === 'all') return matchesSearch;

    const depMethod = (dep.method || '').toLowerCase();
    if (methodFilter === 'bank_1') {
      return matchesSearch && (depMethod === 'bank 1' || depMethod.includes('bank 1'));
    }
    if (methodFilter === 'bank_2') {
      return matchesSearch && (depMethod === 'bank 2' || depMethod.includes('bank 2'));
    }
    if (methodFilter === 'btc') {
      return matchesSearch && (depMethod === 'btc' || depMethod.includes('btc') || depMethod.includes('(btc)'));
    }
    if (methodFilter === 'usdt') {
      return matchesSearch && (depMethod === 'usdt' || depMethod.includes('usdt') || depMethod.includes('(usdt)'));
    }
    return matchesSearch;
  });

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    flagged: { label: 'Flagged', color: 'bg-red-100 text-red-700 border-red-200' },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-200' },
    rejected: { label: 'Rejected', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  };

  const totalPending = deposits.filter(d => d.status === 'pending').reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deposit Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">Verify bank transfers, match UTR numbers, and approve incoming funds.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => activeTab === 'configure' ? fetchPaymentMethods() : fetchDeposits()} 
            className="inline-flex items-center justify-center rounded-md text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 h-10 px-4 py-2 hover:border-gray-400 transition-colors shadow-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-5 rounded-lg border shadow-sm ${stats.total_pending_amount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">Pending Deposits</div>
          <div className="text-xl font-black text-yellow-700">₹{stats.total_pending_amount.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">Approved Today</div>
          <div className="text-xl font-black text-green-600">₹{stats.approved_today_amount.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">Processing Time</div>
          <div className="text-xl font-black text-gray-900">&lt; 15 mins</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">API Auto-Match</div>
          <div className="text-xl font-black text-blue-600">85%</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center px-4 py-3 gap-4">
          <nav className="flex space-x-2 overflow-x-auto">
            {['pending', 'flagged', 'approved', 'rejected', 'configure', 'all'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`capitalize px-3 py-1.5 font-medium text-sm rounded-md transition-colors whitespace-nowrap ${
                  activeTab === tab ? 'bg-white shadow-sm text-blue-700 border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}>
                {tab === 'configure' ? 'Configure Channels' : tab}
              </button>
            ))}
          </nav>
          {activeTab !== 'configure' && (
            <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-2">
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="block w-full sm:w-auto border border-gray-300 rounded-md text-sm py-1.5 px-3 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 font-bold"
              >
                <option value="all">All Channels</option>
                <option value="bank_1">Bank 1</option>
                <option value="bank_2">Bank 2</option>
                <option value="btc">BTC</option>
                <option value="usdt">USDT</option>
              </select>
              <div className="relative w-full sm:max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by UTR or Client..." 
                  className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800" 
                />
              </div>
            </div>
          )}
        </div>

        {activeTab === 'configure' ? (
          <div className="p-6 bg-gray-50">
            {loading ? (
              <div className="text-center py-12 text-sm text-gray-500">Loading payment methods...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {paymentMethods.map(method => (
                  <PaymentMethodCard
                    key={method.id}
                    method={method}
                    onSave={handleSavePaymentMethod}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b border-gray-200 tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Deposit ID</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold">Method & UTR</th>
                  <th className="px-4 py-3 font-semibold">Proof</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filtered.map(dep => (
                  <tr key={dep.id} className={`hover:bg-gray-50 ${dep.status === 'flagged' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 font-bold text-gray-900 text-xs">{dep.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{dep.profiles?.full_name}</div>
                      <div className="text-[10px] text-blue-600 font-medium">{dep.profiles?.client_id}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-black text-green-700">+₹{dep.amount.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-700">{dep.utr_number || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{dep.method}</div>
                    </td>
                    <td className="px-4 py-3">
                      {dep.proof_url ? (
                        <button
                          onClick={() => {
                            const apiBaseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : 'http://localhost:4000';
                            const fullUrl = dep.proof_url.startsWith('http') ? dep.proof_url : `${apiBaseUrl}${dep.proof_url}`;
                            window.open(fullUrl, '_blank');
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-bold inline-flex items-center gap-1 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded"
                        >
                          <FileText className="h-3 w-3" /> View Receipt
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">No Screenshot</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${statusConfig[dep.status]?.color || statusConfig.pending.color}`}>
                          {statusConfig[dep.status]?.label || 'Pending'}
                        </span>
                        {dep.reject_reason && <div className="text-[9px] text-gray-500 mt-1">{dep.reject_reason}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(dep.status === 'pending' || dep.status === 'flagged') ? (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setSelectedDep(dep); setShowApproveModal(true); }}
                            className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded hover:bg-green-100 border border-green-200 inline-flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Approve
                          </button>
                          <button onClick={() => { setSelectedDep(dep); setShowRejectModal(true); }}
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
        )}
      </div>

      {showApproveModal && selectedDep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Approve Deposit</h3>
            <p className="text-sm text-gray-600 mb-4">Funds will be instantly credited to the user's wallet.</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Client</span><span className="font-bold text-gray-900">{selectedDep.profiles?.full_name || 'N/A'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Amount</span><span className="font-black text-green-700">₹{selectedDep.amount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Method</span><span className="font-bold text-gray-950">{selectedDep.method || 'N/A'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">UTR / Ref</span><span className="font-bold text-gray-950">{selectedDep.utr_number || 'N/A'}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowApproveModal(false)} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleApprove} className="flex-1 py-2 rounded-lg bg-green-600 text-sm font-bold text-white hover:bg-green-700 shadow-sm">Credit Wallet</button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selectedDep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Deposit</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Client</span><span className="font-bold text-gray-900">{selectedDep.profiles?.full_name || 'N/A'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Amount</span><span className="font-bold text-red-700">₹{selectedDep.amount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Method</span><span className="font-bold text-gray-950">{selectedDep.method || 'N/A'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">UTR / Ref</span><span className="font-bold text-gray-950">{selectedDep.utr_number || 'N/A'}</span></div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">Rejection Reason</label>
              <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm font-medium mb-2 bg-white text-gray-900">
                <option value="UTR not found / Invalid">UTR not found / Invalid</option>
                <option value="Third-party deposit not allowed">Third-party deposit not allowed</option>
                <option value="Amount mismatch">Amount mismatch</option>
                <option value="Fraudulent receipt">Fraudulent receipt</option>
                <option value="Other">Other</option>
              </select>
              <textarea 
                rows={2} 
                value={rejectNotes} 
                onChange={e => setRejectNotes(e.target.value)} 
                placeholder="Additional notes / reasons..." 
                className="w-full border border-gray-300 rounded p-2 text-sm bg-white text-gray-900" 
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowRejectModal(false); setRejectNotes(''); }} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleReject} className="flex-1 py-2 rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-700">Reject Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
