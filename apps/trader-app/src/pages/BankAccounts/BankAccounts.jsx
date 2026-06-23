import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  User,
  CreditCard,
  Hash,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader,
  Wallet
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { api } from '../../services/api';
import { cn } from '../../utils/helpers';

export default function BankAccounts() {
  const navigate = useNavigate();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null); // stores account ID being deleted
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [methodType, setMethodType] = useState('bank'); // bank or crypto
  const [form, setForm] = useState({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: ''
  });
  const [cryptoForm, setCryptoForm] = useState({
    crypto_coin: 'USDT',
    crypto_address: ''
  });
  
  // Alerts
  const [alert, setAlert] = useState(null);

  const fetchBankAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.getBankAccounts();
      setBankAccounts(res.bankAccounts || []);
    } catch (err) {
      console.error(err);
      showAlert('error', err.message || 'Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleInputChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      let payload = { type: methodType };
      if (methodType === 'crypto') {
        if (!cryptoForm.crypto_address.trim()) {
          showAlert('error', 'Wallet address is required');
          setSubmitLoading(false);
          return;
        }
        payload.crypto_coin = cryptoForm.crypto_coin;
        payload.crypto_address = cryptoForm.crypto_address.trim();
      } else {
        if (!form.bank_name.trim() || !form.account_holder_name.trim() || !form.account_number.trim() || !form.ifsc_code.trim()) {
          showAlert('error', 'All fields are required');
          setSubmitLoading(false);
          return;
        }
        payload.bank_name = form.bank_name.trim();
        payload.account_holder_name = form.account_holder_name.trim();
        payload.account_number = form.account_number.trim();
        payload.ifsc_code = form.ifsc_code.trim().toUpperCase();
      }

      await api.addBankAccount(payload);
      
      showAlert('success', methodType === 'crypto' ? 'Crypto address saved successfully' : 'Bank account added successfully');
      setShowAddModal(false);
      setForm({
        bank_name: '',
        account_holder_name: '',
        account_number: '',
        ifsc_code: ''
      });
      setCryptoForm({
        crypto_coin: 'USDT',
        crypto_address: ''
      });
      setMethodType('bank');
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      showAlert('error', err.message || 'Failed to add payout method');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bank account?')) {
      return;
    }
    
    setDeleteLoading(id);
    try {
      await api.deleteBankAccount(id);
      showAlert('success', 'Bank account deleted successfully');
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      showAlert('error', err.message || 'Failed to delete bank account');
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle">
              <ArrowLeft size={18} className="text-text-primary" />
            </button>
            <h1 className="text-base font-bold text-text-primary">Manage Bank & Crypto Methods</h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-all font-semibold flex items-center gap-1 text-xs"
          >
            <Plus size={14} /> Add Method
          </button>
        </div>
      </header>

      <div className="px-3 space-y-3 pb-6 pt-2 max-w-lg mx-auto">
        {/* Alerts banner */}
        {alert && (
          <div className={cn(
            'flex items-start gap-2.5 rounded-xl p-3 border text-xs font-semibold animate-pulse',
            alert.type === 'success' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-red-950/20 border-red-900/30 text-red-400'
          )}>
            {alert.type === 'success' ? <CheckCircle2 size={15} className="mt-0.5" /> : <AlertCircle size={15} className="mt-0.5" />}
            <span>{alert.message}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Loader className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-bold mt-2">Loading methods...</p>
          </div>
        ) : bankAccounts.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4 bg-surface-2 rounded-2xl border border-border/40">
            <div className="w-12 h-12 bg-surface-3 rounded-full flex items-center justify-center mx-auto mb-3 text-text-muted">
              <Building size={22} />
            </div>
            <h3 className="text-sm font-bold text-text-primary">No Payout Methods Found</h3>
            <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
              Please add a bank account or crypto address. Saved payout options will be available for withdrawal selection.
            </p>
            <Button
              variant="outline-primary"
              size="sm"
              className="mt-4"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={14} className="mr-1.5" /> Add Payout Method
            </Button>
          </div>
        ) : (
          /* Saved Accounts List */
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-0.5">Your Saved Methods</h3>
            
            {bankAccounts.map((acc) => {
              const isCrypto = acc.type === 'crypto';
              
              if (isCrypto) {
                return (
                  <Card key={acc.id} padding="p-4" className="relative border-border/50 hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-grow">
                        <div className="w-9 h-9 rounded-xl bg-surface-3 border border-border/30 flex items-center justify-center text-primary flex-shrink-0">
                          <Wallet size={16} className={acc.crypto_coin === 'BTC' ? 'text-orange-400' : 'text-teal-400'} />
                        </div>
                        <div className="min-w-0 flex-grow">
                          <h4 className="text-sm font-bold text-text-primary truncate">
                            {acc.crypto_coin === 'BTC' ? 'Bitcoin Wallet (BTC)' : 'USDT Wallet (TRC20)'}
                          </h4>
                          <p className="text-[11px] text-text-muted mt-1 truncate bg-surface p-1.5 rounded font-mono font-bold border border-border/20" title={acc.crypto_address}>
                            {acc.crypto_address}
                          </p>
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
                              Crypto Method
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDelete(acc.id)}
                        disabled={deleteLoading === acc.id}
                        className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-red-500/5 transition-colors border border-transparent hover:border-red-500/10 flex-shrink-0 self-center"
                      >
                        {deleteLoading === acc.id ? (
                          <Loader size={14} className="animate-spin text-danger" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </Card>
                );
              }

              return (
                <Card key={acc.id} padding="p-4" className="relative border-border/50 hover:border-primary/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-surface-3 border border-border/30 flex items-center justify-center text-primary flex-shrink-0">
                        <Building size={16} className="text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary truncate">{acc.bank_name}</h4>
                        <p className="text-xs text-text-muted mt-0.5 truncate flex items-center gap-1">
                          <User size={11} className="text-text-muted/60" />
                          {acc.account_holder_name}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-mono font-bold">
                          <div className="flex items-center gap-1 text-text-primary">
                            <CreditCard size={12} className="text-text-muted/60" />
                            <span>A/C: {acc.account_number}</span>
                          </div>
                          <div className="flex items-center gap-1 text-text-secondary">
                            <Hash size={12} className="text-text-muted/60" />
                            <span>IFSC: {acc.ifsc_code}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(acc.id)}
                      disabled={deleteLoading === acc.id}
                      className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-red-500/5 transition-colors border border-transparent hover:border-red-500/10 flex-shrink-0 self-center"
                    >
                      {deleteLoading === acc.id ? (
                        <Loader size={14} className="animate-spin text-danger" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => !submitLoading && setShowAddModal(false)}
        title="Add Payout Method"
      >
        <div className="space-y-4">
          {/* Method Type Toggle */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Select Method Type</label>
            <div className="flex gap-2">
              {['bank', 'crypto'].map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={submitLoading}
                  onClick={() => setMethodType(type)}
                  className={cn(
                    'flex-grow py-2 text-xs font-bold rounded-lg border transition-all text-center',
                    methodType === type
                      ? 'bg-primary text-white border-primary shadow-sm shadow-primary/10'
                      : 'bg-surface-3 text-text-muted border-border/50 hover:bg-surface-2'
                  )}
                >
                  {type === 'bank' ? 'Bank Account' : 'Crypto Address'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {methodType === 'crypto' ? (
              <>
                {/* Crypto Coin Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Select Coin</label>
                  <div className="flex gap-2">
                    {['USDT', 'BTC'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={submitLoading}
                        onClick={() => setCryptoForm(prev => ({ ...prev, crypto_coin: c }))}
                        className={cn(
                          'flex-grow py-2 text-xs font-bold rounded-lg border transition-all text-center',
                          cryptoForm.crypto_coin === c
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-surface-3 text-text-muted border-border/50 hover:bg-surface-2'
                        )}
                      >
                        {c === 'USDT' ? 'USDT (TRC20)' : 'Bitcoin (BTC)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crypto Address Input */}
                <Input
                  label="Crypto Wallet Address"
                  placeholder={cryptoForm.crypto_coin === 'USDT' ? "Enter USDT TRC20 Address" : "Enter BTC Address"}
                  value={cryptoForm.crypto_address}
                  onChange={(e) => setCryptoForm(prev => ({ ...prev, crypto_address: e.target.value }))}
                  disabled={submitLoading}
                  compact
                  required
                />
              </>
            ) : (
              <>
                <Input
                  label="Bank Name"
                  placeholder="e.g. HDFC Bank"
                  value={form.bank_name}
                  onChange={(e) => handleInputChange('bank_name', e.target.value)}
                  disabled={submitLoading}
                  compact
                  required
                />
                <Input
                  label="Account Holder Name"
                  placeholder="Name as in bank record"
                  value={form.account_holder_name}
                  onChange={(e) => handleInputChange('account_holder_name', e.target.value)}
                  disabled={submitLoading}
                  compact
                  required
                />
                <Input
                  label="Account Number"
                  type="text"
                  placeholder="Enter bank account number"
                  value={form.account_number}
                  onChange={(e) => handleInputChange('account_number', e.target.value.replace(/\D/g, ''))}
                  disabled={submitLoading}
                  compact
                  required
                />
                <Input
                  label="IFSC Code"
                  placeholder="11-digit IFSC code"
                  value={form.ifsc_code}
                  onChange={(e) => handleInputChange('ifsc_code', e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                  disabled={submitLoading}
                  compact
                  required
                />
              </>
            )}

            <div className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                fullWidth
                size="md"
                onClick={() => setShowAddModal(false)}
                disabled={submitLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="md"
                disabled={submitLoading}
              >
                {submitLoading ? 'Saving...' : 'Save Method'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
