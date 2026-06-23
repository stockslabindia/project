import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ArrowDownToLine, Clock, CheckCircle2, XCircle,
  IndianRupee, Shield, AlertCircle, Loader2, Copy, Upload, Check,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useTradeStore } from '../../store/useTradeStore';
import { formatCurrency, cn } from '../../utils/helpers';
import { api } from '../../services/api';

export default function WalletPage() {
  const navigate = useNavigate();
  const { wallet, walletTransactions, positions, submitDeposit, submitWithdrawal, depositLoading, withdrawLoading, user } = useTradeStore();
  const [activeInfoTab, setActiveInfoTab] = useState('info');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState('');
  const [screenshotName, setScreenshotName] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [copiedField, setCopiedField] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [cryptoCoin, setCryptoCoin] = useState('USDT');

  const bal = wallet?.balance || 0;
  const availMargin = wallet?.availableMargin || 0;
  const usedMargin = wallet?.usedMargin || 0;
  const unrealizedPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const equity = bal + unrealizedPnl;
  const equityPct = usedMargin > 0 ? ((equity / usedMargin) * 100).toFixed(2) : '0.00';

  const displayTransactions = walletTransactions.filter(
    (tx) => tx.type === 'deposit' || tx.type === 'withdrawal'
  );

  const fetchPaymentMethods = async () => {
    try {
      const data = await api.getPaymentMethods();
      setPaymentMethods(data.paymentMethods || []);
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchBankAccounts = async () => {
    setBankAccountsLoading(true);
    try {
      const data = await api.getBankAccounts();
      const accounts = data.bankAccounts || [];
      setBankAccounts(accounts);
      if (accounts.length > 0) {
        setSelectedBankAccountId(accounts[0].id);
      } else {
        setSelectedBankAccountId('');
      }
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err);
    } finally {
      setBankAccountsLoading(false);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openModal = (type) => {
    if (type === 'withdraw') {
      const status = user?.kycStatus || user?.kyc_status;
      if (status !== 'verified') {
        if (status === 'pending') {
          alert('Your KYC verification is currently pending review. Withdrawals will be enabled once your KYC is approved.');
        } else if (status === 'rejected') {
          alert('Your KYC verification was rejected. Please resubmit your KYC documents to enable withdrawals.');
          navigate('/kyc/submit');
        } else {
          alert('KYC verification is required to initiate withdrawals. Please complete your KYC verification first.');
          navigate('/kyc/submit');
        }
        return;
      }
    }
    setModalType(type);
    setAmount('');
    setUtrNumber('');
    setScreenshotBase64('');
    setScreenshotName('');
    setSelectedSlot(1);
    setCopiedField(null);
    setSubmitResult(null);
    setShowModal(true);
    if (type === 'deposit') {
      fetchPaymentMethods();
    } else if (type === 'withdraw') {
      fetchBankAccounts();
    }
  };

  const handleSubmit = async () => {
    setSubmitResult(null);
    if (modalType === 'deposit') {
      const depositAmount = Number(amount);
      if (!depositAmount || depositAmount < 500) {
        setSubmitResult({ type: 'error', message: 'Minimum deposit is ₹500 INR' });
        return;
      }
      if (!utrNumber.trim()) {
        setSubmitResult({ type: 'error', message: 'UTR number is required' });
        return;
      }
      if (!screenshotBase64) {
        setSubmitResult({ type: 'error', message: 'Screenshot receipt is required' });
        return;
      }

      let methodName = '';
      let depositMetadata = {};

      if (selectedSlot === 3) {
        methodName = `Crypto (${cryptoCoin})`;
        depositMetadata = { crypto_coin: cryptoCoin };
      } else {
        const selectedMethod = paymentMethods.find(m => m.slot === selectedSlot);
        const bankName = selectedMethod?.bank_name || 'UPI';
        methodName = `Bank ${selectedSlot} (${bankName})`;
      }

      const result = await submitDeposit(
        depositAmount,
        utrNumber,
        screenshotBase64,
        selectedSlot,
        methodName,
        depositMetadata
      );

      if (result.success) {
        setSubmitResult({ type: 'success', message: 'Successful! Please wait to get your payment verified.' });
        setTimeout(() => { setShowModal(false); setSubmitResult(null); }, 3500);
      } else {
        setSubmitResult({ type: 'error', message: result.error || 'Deposit failed' });
      }
    } else {
      // Validate withdrawal amount
      if (Number(amount) > availMargin) {
        setSubmitResult({ type: 'error', message: `Cannot withdraw more than available margin (${formatCurrency(availMargin)})` });
        return;
      }
      if (Number(amount) < 500) {
        setSubmitResult({ type: 'error', message: 'Minimum withdrawal amount is ₹500' });
        return;
      }
      if (!selectedBankAccountId) {
        setSubmitResult({ type: 'error', message: 'Please add and select a bank account first' });
        return;
      }
      const result = await submitWithdrawal({ amount: Number(amount), bank_account_id: selectedBankAccountId });
      if (result.success) {
        setSubmitResult({ type: 'success', message: 'Withdrawal request submitted!' });
        setTimeout(() => { setShowModal(false); setSubmitResult(null); }, 2500);
      } else {
        setSubmitResult({ type: 'error', message: result.error || 'Withdrawal failed' });
      }
    }
  };

  const statusConfig = {
    completed: { icon: CheckCircle2, label: 'Completed', color: 'text-emerald-500' },
    approved: { icon: CheckCircle2, label: 'Completed', color: 'text-emerald-500' },
    pending: { icon: Clock, label: 'Pending', color: 'text-amber-500' },
    rejected: { icon: XCircle, label: 'Rejected', color: 'text-red-500' },
  };

  const formatTxType = (type) => {
    const map = {
      deposit: 'Deposit', withdrawal: 'Withdrawal', trade_pnl: 'Trade P&L',
      commission: 'Commission', swap_fee: 'Swap Fee', bonus: 'Bonus',
      adjustment: 'Adjustment', refund: 'Refund',
    };
    return map[type] || type;
  };

  const infoItems = [
    { label: 'Balance', value: formatCurrency(bal) },
    { label: 'Available Margin', value: formatCurrency(availMargin) },
    { label: 'Unrealized P&L', value: formatCurrency(unrealizedPnl), color: unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500' },
    { label: 'Blocked Margin', value: formatCurrency(usedMargin) },
    { label: 'Equity', value: formatCurrency(equity) },
    { label: 'Margin Level', value: equityPct === '--' ? '--' : `${equityPct}%` },
  ];

  return (
    <div className="bg-surface min-h-full">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-text-primary">Funds</h1>
        <p className="text-sm text-text-muted mt-1">Manage your trading account funds</p>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4 flex gap-3">
        <button
          onClick={() => openModal('withdraw')}
          className="flex items-center gap-2 px-5 py-2.5 bg-surface-3 border border-border rounded-lg text-text-primary font-semibold text-sm hover:bg-surface-2 transition-colors"
        >
          <ArrowDownToLine size={16} className="text-blue-400" />
          Withdraw
        </button>
        <button
          onClick={() => openModal('deposit')}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 rounded-lg text-white font-semibold text-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus size={16} />
          Add Funds
        </button>
      </div>

      {/* Info / Transactions Tabs */}
      <div className="px-4 pb-2">
        <div className="bg-surface-2 rounded-xl border border-border overflow-hidden">
          {/* Tab Bar */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveInfoTab('info')}
              className={cn(
                'flex-1 py-3 text-sm font-semibold text-center transition-colors relative',
                activeInfoTab === 'info' ? 'text-blue-500' : 'text-text-muted'
              )}
            >
              Info
              {activeInfoTab === 'info' && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveInfoTab('transactions')}
              className={cn(
                'flex-1 py-3 text-sm font-semibold text-center transition-colors relative',
                activeInfoTab === 'transactions' ? 'text-blue-500' : 'text-text-muted'
              )}
            >
              Transactions
              {activeInfoTab === 'transactions' && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeInfoTab === 'info' ? (
            <div className="divide-y divide-border">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-[14px] text-text-muted">{item.label}</span>
                  <span className={cn('text-[14px] font-semibold tabular-nums', item.color || 'text-text-primary')}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {displayTransactions.length > 0 ? (
                <div className="divide-y divide-border">
                  {displayTransactions.map((tx) => {
                    const credit = tx.amount > 0;
                    const status = tx.status || 'completed';
                    const config = statusConfig[status] || statusConfig.completed;
                    const StatusIcon = config.icon;
                    return (
                      <div key={tx.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[13px] font-semibold text-text-primary">{formatTxType(tx.type)}</p>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {new Date(tx.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-[13px] font-bold tabular-nums', 
                              tx.amount > 0 ? 'text-emerald-400' : (tx.type === 'withdrawal' || tx.type === 'trade_pnl' ? 'text-red-400' : 'text-text-primary')
                            )}>
                              {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                            </p>
                            <div className={cn('flex items-center gap-1 justify-end mt-0.5', config.color)}>
                              <StatusIcon size={10} />
                              <span className="text-[10px] font-semibold">{config.label}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Clock size={24} className="mx-auto text-text-muted/30 mb-2" />
                  <p className="text-sm text-text-muted">No transactions yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deposit/Withdraw Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalType === 'deposit' ? 'Add Funds' : 'Withdraw Funds'}>
        <div className="space-y-4">
          <div className="bg-surface-2 rounded-xl p-3 border border-border/40">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Available Balance</span>
              <span className="font-bold text-text-primary">{formatCurrency(bal)}</span>
            </div>
          </div>

          {modalType === 'deposit' && (
            <>
              {/* Option Tabs */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Select Deposit Option</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((slot) => {
                    const method = paymentMethods.find(m => m.slot === slot);
                    const isActive = method ? method.is_active : false;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setSubmitResult(null);
                        }}
                        className={cn(
                          'flex-grow py-2 text-xs font-bold rounded-lg border transition-all text-center flex flex-col items-center justify-center gap-0.5',
                          selectedSlot === slot
                            ? 'bg-primary text-white border-primary shadow-sm shadow-primary/10'
                            : 'bg-surface-3 text-text-muted border-border/50 hover:bg-surface-2'
                        )}
                      >
                        <span>{slot === 1 ? 'Bank 1' : slot === 2 ? 'Bank 2' : 'Crypto'}</span>
                        {!isActive && (
                          <span className="text-[9px] text-red-500 font-medium">(Down)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display payment details of selected slot */}
              {(() => {
                const currentMethod = paymentMethods.find(m => m.slot === selectedSlot);
                if (!currentMethod) {
                  return (
                    <div className="text-center py-4 bg-surface rounded-xl border border-border/40 text-xs text-text-muted">
                      Loading payment details...
                    </div>
                  );
                }

                if (!currentMethod.is_active) {
                  return (
                    <div className="text-center py-4 bg-red-950/20 rounded-xl border border-red-900/30 text-xs text-red-400">
                      ⚠️ This payment option is currently offline. Please try another Option slot.
                    </div>
                  );
                }

                if (selectedSlot === 3) {
                  return (
                    <div className="space-y-4 p-3 bg-surface-2 rounded-xl border border-border/40">
                      {currentMethod.instructions && (
                        <p className="text-xs text-text-muted leading-relaxed mb-2 bg-surface p-2 rounded-lg border border-border/30 text-center">
                          {currentMethod.instructions}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {/* BTC Card */}
                        <div className="bg-surface-3 p-3 rounded-lg border border-border/30 flex flex-col items-center space-y-2">
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Bitcoin (BTC)</span>
                          {currentMethod.btc_qr_code_url ? (
                            <div className="flex flex-col items-center justify-center p-1.5 bg-white rounded-lg w-28 h-28">
                              <img
                                src={currentMethod.btc_qr_code_url.startsWith('http') ? currentMethod.btc_qr_code_url : `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:4000'}${currentMethod.btc_qr_code_url}`}
                                alt="BTC QR Code"
                                className="w-24 h-24 object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-28 h-28 border border-dashed border-border/40 rounded-lg flex items-center justify-center text-[10px] text-text-muted">
                              No QR Code
                            </div>
                          )}
                          <div className="w-full text-center min-w-0">
                            <span className="text-[9px] text-text-muted block font-semibold uppercase">BTC Address</span>
                            <span className="text-xs font-mono font-bold text-text-primary block truncate px-1" title={currentMethod.btc_address}>
                              {currentMethod.btc_address || 'Not Configured'}
                            </span>
                            {currentMethod.btc_address && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentMethod.btc_address, 'btc_address')}
                                className="mt-1 px-1.5 py-0.5 text-[9px] bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-all font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedField === 'btc_address' ? <Check size={8} /> : <Copy size={8} />}
                                {copiedField === 'btc_address' ? 'Copied' : 'Copy'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* USDT TRC20 Card */}
                        <div className="bg-surface-3 p-3 rounded-lg border border-border/30 flex flex-col items-center space-y-2">
                          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">USDT (TRC20)</span>
                          {currentMethod.usdt_qr_code_url ? (
                            <div className="flex flex-col items-center justify-center p-1.5 bg-white rounded-lg w-28 h-28">
                              <img
                                src={currentMethod.usdt_qr_code_url.startsWith('http') ? currentMethod.usdt_qr_code_url : `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:4000'}${currentMethod.usdt_qr_code_url}`}
                                alt="USDT QR Code"
                                className="w-24 h-24 object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-28 h-28 border border-dashed border-border/40 rounded-lg flex items-center justify-center text-[10px] text-text-muted">
                              No QR Code
                            </div>
                          )}
                          <div className="w-full text-center min-w-0">
                            <span className="text-[9px] text-text-muted block font-semibold uppercase">USDT Address</span>
                            <span className="text-xs font-mono font-bold text-text-primary block truncate px-1" title={currentMethod.usdt_address}>
                              {currentMethod.usdt_address || 'Not Configured'}
                            </span>
                            {currentMethod.usdt_address && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentMethod.usdt_address, 'usdt_address')}
                                className="mt-1 px-1.5 py-0.5 text-[9px] bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-all font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedField === 'usdt_address' ? <Check size={8} /> : <Copy size={8} />}
                                {copiedField === 'usdt_address' ? 'Copied' : 'Copy'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 p-3 bg-surface-2 rounded-xl border border-border/40">
                    {currentMethod.instructions && (
                      <p className="text-xs text-text-muted leading-relaxed mb-2 bg-surface p-2 rounded-lg border border-border/30">
                        {currentMethod.instructions}
                      </p>
                    )}

                    {/* QR Code */}
                    {currentMethod.qr_code_url && (
                      <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-lg mx-auto w-36 h-36">
                        <img
                          src={currentMethod.qr_code_url.startsWith('http') ? currentMethod.qr_code_url : `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:4000'}${currentMethod.qr_code_url}`}
                          alt={`QR Code Slot ${selectedSlot}`}
                          className="w-32 h-32 object-contain"
                        />
                      </div>
                    )}

                    {/* UPI ID */}
                    {currentMethod.upi_id && (
                      <div className="flex items-center justify-between p-2.5 bg-surface-3 rounded-lg border border-border/30">
                        <div className="overflow-hidden mr-2">
                          <span className="text-[10px] text-text-muted block font-semibold uppercase">UPI ID</span>
                          <span className="text-xs font-mono font-bold text-text-primary block truncate">{currentMethod.upi_id}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(currentMethod.upi_id, 'upi_id')}
                          className="px-2 py-1 text-[10px] bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-all font-semibold flex items-center gap-1 flex-shrink-0"
                        >
                          {copiedField === 'upi_id' ? <Check size={10} /> : <Copy size={10} />}
                          {copiedField === 'upi_id' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {/* Bank Details */}
                    {(currentMethod.bank_name || currentMethod.account_number) && (
                      <div className="bg-surface-3 p-2.5 rounded-lg border border-border/30 space-y-2 text-xs">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block border-b border-border/20 pb-1">Bank Transfer Details</span>
                        
                        {currentMethod.bank_name && (
                          <div className="flex justify-between items-center">
                            <span className="text-text-muted">Bank Name</span>
                            <span className="font-semibold text-text-primary">{currentMethod.bank_name}</span>
                          </div>
                        )}
                        {currentMethod.account_name && (
                          <div className="flex justify-between items-center">
                            <span className="text-text-muted">Account Holder</span>
                            <span className="font-semibold text-text-primary">{currentMethod.account_name}</span>
                          </div>
                        )}
                        {currentMethod.account_number && (
                          <div className="flex justify-between items-center">
                            <span className="text-text-muted">Account Number</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-text-primary font-mono">{currentMethod.account_number}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentMethod.account_number, 'acc_num')}
                                className="text-primary hover:text-primary-hover"
                              >
                                {copiedField === 'acc_num' ? <Check size={10} /> : <Copy size={10} />}
                              </button>
                            </div>
                          </div>
                        )}
                        {currentMethod.ifsc_code && (
                          <div className="flex justify-between items-center">
                            <span className="text-text-muted">IFSC Code</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-text-primary font-mono">{currentMethod.ifsc_code}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentMethod.ifsc_code, 'ifsc')}
                                className="text-primary hover:text-primary-hover"
                              >
                                {copiedField === 'ifsc' ? <Check size={10} /> : <Copy size={10} />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* Bank Accounts select for withdrawals */}
          {modalType === 'withdraw' && (
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                Select Bank Account <span className="text-red-500">*</span>
              </label>
              {bankAccountsLoading ? (
                <div className="flex items-center gap-2 py-2 px-3 bg-surface-2 rounded-xl border border-border/40 text-xs text-text-muted">
                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Loading saved accounts...</span>
                </div>
              ) : bankAccounts.length === 0 ? (
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-center space-y-2">
                  <p className="text-xs text-red-400 font-semibold leading-relaxed">
                    No saved bank accounts found. You must add an account before applying for withdrawal.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      navigate('/bank-accounts');
                    }}
                    className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 text-[11px] font-bold rounded-lg hover:bg-primary/30 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    Add Bank Account
                  </button>
                </div>
              ) : (
                <select
                  value={selectedBankAccountId}
                  onChange={(e) => setSelectedBankAccountId(e.target.value)}
                  className="w-full bg-surface border border-border/50 rounded-xl px-3 py-2 text-sm font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all cursor-pointer"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.account_number.slice(-4)} ({acc.account_holder_name})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Amount (₹) <span className="text-red-500">* (Min 500)</span>
            </label>
            <div className="relative">
              <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount (Min ₹500)"
                className="w-full bg-surface border border-border/50 rounded-xl pl-8 pr-4 py-2 text-sm font-bold text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-1">
            {(modalType === 'deposit' ? [500, 1000, 5000, 10000, 25000] : [5000, 10000, 25000, 50000, 100000]).map(q => (
              <button key={q} onClick={() => setAmount(String(q))}
                className={cn('flex-1 py-1.5 text-xs font-bold rounded-lg transition-all',
                  Number(amount) === q ? 'bg-primary text-white' : 'bg-surface-3 text-text-muted hover:bg-surface-2 border border-border/40')}>
                {q >= 100000 ? '₹1L' : q >= 1000 ? `₹${q/1000}K` : `₹${q}`}
              </button>
            ))}
          </div>

          {modalType === 'deposit' && (
            <>
              {/* Coin selection for Crypto (Slot 3) */}
              {selectedSlot === 3 && (
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                    Which asset did you deposit? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {['USDT', 'BTC'].map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => {
                          setCryptoCoin(coin);
                        }}
                        className={cn(
                          'flex-grow py-2 text-xs font-bold rounded-lg border transition-all text-center',
                          cryptoCoin === coin
                            ? 'bg-primary text-white border-primary shadow-sm shadow-primary/10'
                            : 'bg-surface-3 text-text-muted border-border/50 hover:bg-surface-2'
                        )}
                      >
                        {coin === 'USDT' ? 'Tether (USDT TRC20)' : 'Bitcoin (BTC)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* UTR Input */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  {selectedSlot === 3 ? 'Transaction Hash / TxID' : 'UTR / Transaction Ref Number'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder={selectedSlot === 3 ? "Enter transaction hash / ID" : "Enter 12-digit UTR/Ref"}
                  className="w-full bg-surface border border-border/50 rounded-xl px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
                  required
                />
              </div>

              {/* Screenshot Receipt Upload */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Upload Receipt Screenshot <span className="text-red-500">*</span></label>
                <label className="flex flex-col items-center justify-center border border-dashed border-border hover:border-primary/60 bg-surface rounded-xl p-3.5 cursor-pointer transition-all">
                  <Upload size={18} className="text-text-muted mb-1" />
                  <span className="text-xs text-text-muted font-medium truncate max-w-full text-center px-2">
                    {screenshotName || "Choose Screenshot Image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setScreenshotName(file.name);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setScreenshotBase64(reader.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    required
                  />
                </label>
              </div>

              <div className="flex items-start gap-2 bg-blue-950/20 rounded-lg p-2.5 border border-blue-900/30">
                <Shield size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-300">Submit your transaction details. Admin will verify manual receipt and credit funds shortly.</p>
              </div>
            </>
          )}

          {submitResult && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg p-2.5 border text-xs font-semibold',
              submitResult.type === 'success' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-red-950/20 border-red-900/30 text-red-400'
            )}>
              {submitResult.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              <span>{submitResult.message}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" fullWidth size="md" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button
              variant={modalType === 'deposit' ? 'success' : 'danger'}
              fullWidth
              size="md"
              disabled={
                !amount || 
                Number(amount) <= 0 || 
                depositLoading || 
                withdrawLoading ||
                (modalType === 'deposit' && (Number(amount) < 500 || !utrNumber.trim() || !screenshotBase64)) ||
                (modalType === 'withdraw' && (Number(amount) < 500 || !selectedBankAccountId))
              }
              onClick={handleSubmit}
            >
              {(depositLoading || withdrawLoading) && <Loader2 size={13} className="mr-1.5 animate-spin" />}
              {modalType === 'deposit' ? 'Submit Deposit' : `Withdraw ${amount ? formatCurrency(Number(amount)) : ''}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
