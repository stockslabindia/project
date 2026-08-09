import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ToggleLeft, ToggleRight, Sliders,
  Bell, Volume2, Moon, Sun,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import { cn } from '../../utils/helpers';
import { getPushSubscription, subscribeToPush, unsubscribeFromPush, isPushSupported } from '../../utils/pushSubscription';

export default function TradingPreferences() {
  const navigate = useNavigate();
  const DEFAULT_SETTINGS = {
    defaultOrderType: 'market',
    soundEffects: true,
    darkMode: (() => {
      try {
        return localStorage.getItem('theme') !== 'light';
      } catch {
        return true;
      }
    })(),
  };

  const [pushActive, setPushActive] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    async function checkPush() {
      if (isPushSupported()) {
        try {
          const sub = await getPushSubscription();
          setPushActive(!!sub && typeof Notification !== 'undefined' && Notification.permission === 'granted');
        } catch (e) {}
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

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('tradex_preferences');
      const base = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
      // sync with actual theme settings
      base.darkMode = localStorage.getItem('theme') !== 'light';
      return base;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('tradex_preferences', JSON.stringify(newSettings));
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  };

  const toggle = (key) => {
    const updated = { ...settings, [key]: !settings[key] };

    if (key === 'darkMode') {
      const isDarkNow = updated.darkMode;
      try {
        localStorage.setItem('theme', isDarkNow ? 'dark' : 'light');
        if (isDarkNow) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (err) {
        console.error('Failed to update theme:', err);
      }
    }

    saveSettings(updated);
  };

  const updateSetting = (key, value) => {
    const updated = { ...settings, [key]: value };
    saveSettings(updated);
  };

  return (
    <div className="">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle">
            <ArrowLeft size={18} className="text-text-primary" />
          </button>
          <h1 className="text-base font-bold text-text-primary">Preferences</h1>
        </div>
      </header>

      <div className="px-3 space-y-2.5 pb-3 pt-2">
        {/* Trading Defaults */}
        <div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">Trading Defaults</h3>
          <Card padding="p-0">
            <div className="divide-y divide-border/20">
              {/* Default Order Type */}
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Sliders size={12} className="text-blue-600" />
                    </div>
                    <p className="text-base font-semibold text-text-primary">Default Order Type</p>
                  </div>
                </div>
                <div className="flex gap-1 ml-9.5">
                  {['market', 'limit', 'stoploss'].map(type => (
                    <button key={type} onClick={() => updateSetting('defaultOrderType', type)}
                      className={cn('flex-1 py-1.5 text-sm font-bold rounded-lg transition-all capitalize',
                        settings.defaultOrderType === type ? 'bg-primary text-white' : 'bg-surface text-text-muted')}>
                      {type === 'stoploss' ? 'Stop Loss' : type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Notifications & Appearance */}
        <div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">App Settings</h3>
          <Card padding="p-0">
            <div className="divide-y divide-border/20">
              {/* Push Notifications */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Bell size={12} className="text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-text-primary">Push Notifications</p>
                  <p className="text-[11px] text-text-muted mt-0.5">SL hit, order filled, margin calls (PWA)</p>
                </div>
                <button 
                  onClick={handlePushToggle} 
                  disabled={pushLoading}
                  className={cn("touch-active-subtle", pushLoading && "opacity-50 cursor-not-allowed")}
                >
                  {pushActive ? <ToggleRight size={26} className="text-emerald-500" /> : <ToggleLeft size={26} className="text-text-muted/40" />}
                </button>
              </div>

              {/* Sound */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center">
                  <Volume2 size={12} className="text-pink-600" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-text-primary">Sound Effects</p>
                </div>
                <button onClick={() => toggle('soundEffects')} className="touch-active-subtle">
                  {settings.soundEffects ? <ToggleRight size={26} className="text-emerald-500" /> : <ToggleLeft size={26} className="text-text-muted/40" />}
                </button>
              </div>

              {/* Theme */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-500/10 flex items-center justify-center">
                  {settings.darkMode ? <Moon size={12} className="text-slate-600" /> : <Sun size={12} className="text-amber-500" />}
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-text-primary">Dark Mode</p>
                </div>
                <button onClick={() => toggle('darkMode')} className="touch-active-subtle">
                  {settings.darkMode ? <ToggleRight size={26} className="text-emerald-500" /> : <ToggleLeft size={26} className="text-text-muted/40" />}
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
