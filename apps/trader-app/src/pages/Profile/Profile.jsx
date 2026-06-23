import { useNavigate } from 'react-router-dom';
import {
  User,
  CreditCard,
  Share2,
  Settings,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
  Copy,
  Check,
  FileText,
  Bell,
  Moon,
  Activity,
  Map,
  Network as NetworkIcon,
  AlertCircle,
  Clock,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useTradeStore } from '../../store/useTradeStore';
import { cn } from '../../utils/helpers';
import { getPushSubscription, subscribeToPush, unsubscribeFromPush, isPushSupported } from '../../utils/pushSubscription';

const MarketStatusIndicator = ({ exchange }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      const now = new Date();
      const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const day = istTime.getDay();
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();
      const timeInMinutes = hours * 60 + minutes;

      if (exchange === 'NSE') {
        if (day === 0 || day === 6) { setIsOpen(false); return; }
        const startMins = 9 * 60 + 15;
        const endMins = 15 * 60 + 30;
        setIsOpen(timeInMinutes >= startMins && timeInMinutes <= endMins);
      } else if (exchange === 'MCX') {
        if (day === 0 || day === 6) { setIsOpen(false); return; }
        const startMins = 9 * 60;
        const endMins = 23 * 60 + 30;
        setIsOpen(timeInMinutes >= startMins && timeInMinutes <= endMins);
      } else if (exchange === 'FOREX') {
        // Forex: Mon 02:30 AM IST to Sat 02:30 AM IST
        if (day === 0) {
          setIsOpen(false);
        } else if (day === 6) {
          setIsOpen(timeInMinutes < 2 * 60 + 30);
        } else if (day === 1) {
          setIsOpen(timeInMinutes >= 2 * 60 + 30);
        } else {
          setIsOpen(true);
        }
      } else if (exchange === 'US') {
        // US Stocks: Mon-Fri 07:00 PM to 01:30 AM IST
        const isSessionStart = (day >= 1 && day <= 5) && (timeInMinutes >= 19 * 60);
        const isSessionEnd = (day >= 2 && day <= 6) && (timeInMinutes < 1 * 60 + 30);
        setIsOpen(isSessionStart || isSessionEnd);
      } else if (exchange === 'CRYPTO') {
        setIsOpen(true);
      } else {
        setIsOpen(true);
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [exchange]);

  return isOpen ? (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-100">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
      <span className="text-sm font-bold text-emerald-700">Open</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-md border border-red-100">
      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
      <span className="text-sm font-bold text-red-700">Closed</span>
    </div>
  );
};

export default function Profile() {
  const { user, logout, fetchProfile } = useTradeStore();
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState(null);
  const [pushActive, setPushActive] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    
    async function checkPush() {
      if (isPushSupported()) {
        try {
          const sub = await getPushSubscription();
          setPushActive(!!sub && Notification.permission === 'granted');
        } catch (e) {
          console.error('Failed checking push subscription state:', e);
        }
      }
    }
    checkPush();
  }, []);

  const handlePushToggle = async () => {
    if (!isPushSupported()) {
      alert('Push notifications are not supported on this browser/device.');
      return;
    }
    setPushLoading(true);
    try {
      if (pushActive) {
        await unsubscribeFromPush();
        setPushActive(false);
      } else {
        await subscribeToPush();
        setPushActive(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to toggle push notifications');
    } finally {
      setPushLoading(false);
    }
  };

  const userName = user?.name || user?.full_name || 'User';
  const userEmail = user?.email || '';
  const clientId = user?.clientId || user?.client_id || '';
  const referralCode = user?.referralCode || user?.referral_code || '';

  const handleCopy = (text, field) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const menuSections = [
    {
      title: 'Account',
      items: [
        { icon: CreditCard, label: 'Funds & Withdrawals', subtitle: 'Manage your wallet', iconColor: 'bg-blue-50 text-blue-600', path: '/wallet' },
        { icon: CreditCard, label: 'Manage Bank & Crypto Methods', subtitle: 'Manage bank & crypto details for payouts', iconColor: 'bg-emerald-50 text-emerald-600', path: '/bank-accounts' },
        { icon: FileText, label: 'Reports & Statements', subtitle: 'Download trade reports', iconColor: 'bg-violet-50 text-violet-600', path: '/reports' },
        { icon: Bell, label: 'Notifications', subtitle: 'Manage alerts & notifications', iconColor: 'bg-amber-50 text-amber-600', path: '/notifications' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: Settings, label: 'Preferences', subtitle: 'Order defaults & app theme', iconColor: 'bg-slate-100 text-slate-600', path: '/preferences' },
        { icon: Shield, label: 'Security', subtitle: 'Change password', iconColor: 'bg-emerald-50 text-emerald-600', path: '/security' },
      ],
    },
  ];

  return (
    <div className="">
      <Header title="Profile" showNotification={false} compact />

      <div className="px-3 space-y-2.5 pb-3">
        {/* User Info Card */}
        <Card padding="p-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-primary rounded-lg flex items-center justify-center text-white text-xl font-bold">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-text-primary">{userName}</h2>
              <p className="text-base text-text-muted mt-0.5 truncate">{userEmail}</p>
              <div className="flex flex-col items-start gap-1.5 mt-1">
                {(user?.kycStatus === 'verified' || user?.kyc_status === 'verified') && (
                  <Badge variant="success">
                    <Shield size={10} className="mr-1" />
                    KYC Verified
                  </Badge>
                )}
                {(user?.kycStatus === 'pending' || user?.kyc_status === 'pending') && (
                  <div className="space-y-1">
                    <Badge variant="warning">
                      <Clock size={10} className="mr-1 animate-pulse" />
                      KYC Pending Review
                    </Badge>
                    <p className="text-[11px] text-text-muted">Documents are being verified by compliance.</p>
                  </div>
                )}
                {(user?.kycStatus === 'rejected' || user?.kyc_status === 'rejected') && (
                  <div className="space-y-1">
                    <Badge variant="danger">
                      <AlertCircle size={10} className="mr-1" />
                      KYC Rejected
                    </Badge>
                    {(user?.kyc_rejected_reason || user?.kycRejectedReason) && (
                      <p className="text-[11px] text-red-400 font-semibold leading-tight">Reason: {user.kyc_rejected_reason || user.kycRejectedReason}</p>
                    )}
                    <button
                      onClick={() => navigate('/kyc/submit')}
                      className="px-2.5 py-1 bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-bold rounded-md hover:bg-red-600/30 transition-colors cursor-pointer"
                    >
                      Re-submit Documents
                    </button>
                  </div>
                )}
                {(user?.kycStatus === 'not_submitted' || user?.kyc_status === 'not_submitted' || !user?.kycStatus) && (
                  <div className="space-y-1">
                    <Badge variant="default" className="bg-surface-3 text-text-muted border border-border">
                      <Shield size={10} className="mr-1" />
                      KYC Not Submitted
                    </Badge>
                    <button
                      onClick={() => navigate('/kyc/submit')}
                      className="px-2.5 py-1 bg-primary text-white text-[10px] font-bold rounded-md hover:bg-primary/95 transition-colors cursor-pointer flex items-center gap-1 shadow-sm shadow-primary/20"
                    >
                      Complete KYC
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Client ID & Referral */}
        <div className="grid grid-cols-2 gap-2">
          <Card padding="p-3">
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">Client ID</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-text-primary" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {clientId}
              </p>
              <button
                onClick={() => handleCopy(clientId, 'clientId')}
                className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle"
              >
                {copiedField === 'clientId' ? (
                  <Check size={12} className="text-emerald-500" />
                ) : (
                  <Copy size={12} className="text-text-muted" />
                )}
              </button>
            </div>
          </Card>
          <Card padding="p-3">
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">Referral Code</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-primary" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {referralCode}
              </p>
              <button
                onClick={() => handleCopy(referralCode, 'referral')}
                className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle"
              >
                {copiedField === 'referral' ? (
                  <Check size={12} className="text-emerald-500" />
                ) : (
                  <Copy size={12} className="text-text-muted" />
                )}
              </button>
            </div>
          </Card>
        </div>

        {/* Help & Support Card */}
        <Card padding="p-3">
          <button
            onClick={() => navigate('/help')}
            className="w-full flex items-center justify-between text-left touch-active-subtle cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <HelpCircle size={16} strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Help & Support</p>
                <p className="text-xs text-text-muted mt-0.5">FAQs & Contact Us</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-text-muted/50" />
          </button>
        </Card>

        {/* Push Notification Card */}
        <Card padding="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Bell size={16} strokeWidth={1.8} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-text-primary">Push Notifications</p>
                <p className="text-xs text-text-muted mt-0.5 text-left">SL hit, order filled, margin calls (PWA)</p>
              </div>
            </div>
            <button 
              onClick={handlePushToggle} 
              disabled={pushLoading}
              className={cn("touch-active-subtle cursor-pointer", pushLoading && "opacity-50 cursor-not-allowed")}
            >
              {pushActive ? (
                <ToggleRight size={28} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={28} className="text-text-muted/40" />
              )}
            </button>
          </div>
        </Card>

        {/* Refer & Earn Card */}
        <Card padding="p-3">
          <button
            onClick={() => navigate('/referral')}
            className="w-full flex items-center justify-between text-left touch-active-subtle cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center flex-shrink-0">
                <Share2 size={16} strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Refer & Earn</p>
                <p className="text-xs text-text-muted mt-0.5">Invite friends, earn rewards</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-text-muted/50" />
          </button>
        </Card>

        {/* Market Status */}
        <div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5 mt-2">
            Market Status
          </h3>
          <Card padding="p-0">
            <div className="divide-y divide-border/20">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Activity size={15} strokeWidth={1.8} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text-primary">NSE / BSE</p>
                    <p className="text-sm text-text-muted mt-0.5">09:15 - 15:30 IST</p>
                  </div>
                </div>
                <MarketStatusIndicator exchange="NSE" />
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Map size={15} strokeWidth={1.8} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text-primary">MCX</p>
                    <p className="text-sm text-text-muted mt-0.5">09:00 - 23:30 IST</p>
                  </div>
                </div>
                <MarketStatusIndicator exchange="MCX" />
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <NetworkIcon size={15} strokeWidth={1.8} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text-primary">Crypto</p>
                    <p className="text-sm text-text-muted mt-0.5">24/7 (Mon-Sun)</p>
                  </div>
                </div>
                <MarketStatusIndicator exchange="CRYPTO" />
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <NetworkIcon size={15} strokeWidth={1.8} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text-primary">Forex</p>
                    <p className="text-sm text-text-muted mt-0.5">Mon 02:30 - Sat 02:30 IST</p>
                  </div>
                </div>
                <MarketStatusIndicator exchange="FOREX" />
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center flex-shrink-0">
                    <Activity size={15} strokeWidth={1.8} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text-primary">US Stocks</p>
                    <p className="text-sm text-text-muted mt-0.5">Mon-Fri 19:00 - 01:30 IST</p>
                  </div>
                </div>
                <MarketStatusIndicator exchange="US" />
              </div>
            </div>
          </Card>
        </div>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <div key={section.title} className="mt-2">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">
              {section.title}
            </h3>
            <Card padding="p-0">
              <div className="divide-y divide-border/20">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => item.path && navigate(item.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface/30 active:bg-surface transition-colors touch-active-subtle"
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        item.iconColor
                      )}>
                        <Icon size={15} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                        <p className="text-sm text-text-muted mt-0.5 truncate">{item.subtitle}</p>
                      </div>
                      <ChevronRight size={14} className="text-text-muted/50 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}

        {/* Logout */}
        <div className="mt-2">
          <Card padding="p-0">
            <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50/50 active:bg-red-50 transition-colors touch-active-subtle rounded-xl">
              <div className="w-8 h-8 bg-red-500/8 rounded-xl flex items-center justify-center">
                <LogOut size={15} className="text-red-500" strokeWidth={1.8} />
              </div>
              <span className="text-sm font-semibold text-red-500">Sign Out</span>
            </button>
          </Card>
        </div>

        {/* App Version */}
        <p className="text-center text-sm text-text-muted/60 py-1 mt-2">
          Stocks Lab v1.0.0 · Built for traders
        </p>
      </div>
    </div>
  );
}
