import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, Eye, EyeOff,
  AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { api } from '../../services/api';

export default function Security() {
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const handlePasswordChange = async () => {
    setPwError(null);
    setPwSuccess(false);

    if (!currentPw || !newPw || !confirmPw) {
      setPwError('All fields are required');
      return;
    }
    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match');
      return;
    }

    setPwLoading(true);
    try {
      await api.changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwSuccess(false);
      }, 2000);
    } catch (err) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle">
            <ArrowLeft size={18} className="text-text-primary" />
          </button>
          <h1 className="text-base font-bold text-text-primary">Security</h1>
        </div>
      </header>

      <div className="px-3 space-y-2.5 pb-3 pt-2">
        {/* Password */}
        <div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">Authentication</h3>
          <Card padding="p-0">
            <div className="divide-y divide-border/20">
              {/* Change Password */}
              <button
                onClick={() => { setShowPasswordModal(true); setPwError(null); setPwSuccess(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-surface/30 transition-colors touch-active-subtle"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Lock size={14} className="text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-base font-semibold text-text-primary">Change Password</p>
                  <p className="text-sm text-text-muted mt-0.5">Keep your account secure</p>
                </div>
                <Badge variant="warning">Update</Badge>
              </button>
            </div>
          </Card>
        </div>

        {/* Security Tips */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200/50 rounded-lg p-2.5">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-amber-700">Security Tips</p>
            <ul className="text-sm text-amber-600 mt-1 space-y-0.5">
              <li>• Never share your password or OTP with anyone</li>
              <li>• Use a strong password with at least 8 characters</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password">
        <div className="space-y-3">
          {pwSuccess && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/50 rounded-lg p-2.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <p className="text-sm font-bold text-emerald-700">Password updated successfully!</p>
            </div>
          )}
          {pwError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200/50 rounded-lg p-2.5">
              <AlertTriangle size={14} className="text-red-600" />
              <p className="text-sm font-bold text-red-700">{pwError}</p>
            </div>
          )}
          <div>
            <label className="block text-base font-bold text-text-muted uppercase tracking-wider mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter current password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full bg-surface border border-border/50 rounded-xl px-3 py-2.5 text-base text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all pr-10"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showPassword ? <EyeOff size={16} className="text-text-muted" /> : <Eye size={16} className="text-text-muted" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-base font-bold text-text-muted uppercase tracking-wider mb-1">New Password</label>
            <input
              type="password"
              placeholder="Enter new password (min 8 chars)"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full bg-surface border border-border/50 rounded-xl px-3 py-2.5 text-base text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-base font-bold text-text-muted uppercase tracking-wider mb-1">Confirm New Password</label>
            <input
              type="password"
              placeholder="Re-enter new password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full bg-surface border border-border/50 rounded-xl px-3 py-2.5 text-base text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" fullWidth size="md" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              fullWidth
              size="md"
              onClick={handlePasswordChange}
              disabled={pwLoading}
            >
              {pwLoading ? <Loader2 size={16} className="animate-spin" /> : 'Update Password'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
