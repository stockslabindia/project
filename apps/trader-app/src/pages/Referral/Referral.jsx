import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Copy, Check, Users, Gift, Star, Loader2,
  Clock, Share2, MessageCircle, ChevronRight, AlertCircle,
  TrendingUp, Zap,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useTradeStore } from '../../store/useTradeStore';
import { formatCurrency, cn } from '../../utils/helpers';
import { api } from '../../services/api';

export default function Referral() {
  const navigate = useNavigate();
  const { user } = useTradeStore();
  const [copiedField, setCopiedField] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [bonusHistory, setBonusHistory] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, histData] = await Promise.all([
          api.getReferralStats().catch(() => null),
          api.getReferralBonusHistory().catch(() => null),
        ]);
        if (statsData && !statsData.error) setStats(statsData);
        if (histData && !histData.error) setBonusHistory(histData);
      } catch (err) {
        console.error('Failed to load referral data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const referralCode = stats?.referral_code || user?.referralCode || user?.referral_code || '';
  const referralLink = referralCode ? `https://stockslab.live/register?ref=${referralCode}` : '';

  const handleCopy = (text, field) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Join me on StocksLab and start trading! Use my referral code *${referralCode}* to get a signup bonus!\n\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const tiers = stats?.tiers || [];
  const currentTier = stats?.current_tier;
  const referrals = stats?.referrals || [];
  const totalEarned = stats?.stats?.total_earned || 0;
  const activeReferrals = stats?.stats?.active_referrals || 0;
  const pendingBonus = stats?.signup_bonus_pending;
  const creditedBonus = stats?.signup_bonus_credited;

  // Only show paused screen when stats is explicitly loaded AND the flag is explicitly false.
  // If stats is null (API failed/loading), don't treat it as "paused" — that's a network error, not an admin action.
  if (stats !== null && stats?.referral_program_active === false && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mb-4">
          <Gift size={28} className="text-text-muted/40" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">Referral Program Paused</h2>
        <p className="text-sm text-text-muted mt-2">The referral program is temporarily paused. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle">
            <ArrowLeft size={18} className="text-text-primary" />
          </button>
          <h1 className="text-base font-bold text-text-primary">Refer &amp; Earn</h1>
        </div>
      </header>

      <div className="px-3 space-y-2.5 pb-6 pt-2">

        {/* Pending Bonus Banner */}
        {pendingBonus && (
          <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-400">Signup Bonus Pending!</p>
              <p className="text-xs text-amber-400/70 mt-0.5">{pendingBonus.message}</p>
            </div>
            <span className="font-extrabold text-amber-400 tabular-nums text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              +{formatCurrency(pendingBonus.referee_bonus)}
            </span>
          </div>
        )}

        {creditedBonus && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3">
            <Check size={16} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-400">Signup Bonus Credited!</p>
              <p className="text-xs text-emerald-400/70">+{formatCurrency(creditedBonus.referee_bonus)} added to your bonus wallet</p>
            </div>
          </div>
        )}

        {/* Hero Card */}
        <Card padding="p-0" className="overflow-hidden">
          <div className="bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 p-4 text-white relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/5 rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Gift size={18} />
                <span className="text-base text-white/70 uppercase tracking-wider font-bold">Your Referral Code</span>
              </div>
              {loading ? (
                <div className="h-8 w-32 bg-white/20 rounded-lg animate-pulse mb-3" />
              ) : (
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xl font-extrabold tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {referralCode || '—'}
                  </p>
                  {referralCode && (
                    <button onClick={() => handleCopy(referralCode, 'code')}
                      className="p-1.5 bg-white/15 rounded-lg hover:bg-white/25 transition-colors">
                      {copiedField === 'code' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                <div>
                  <p className="text-white/60 text-xs">Deposit comm.</p>
                  <p className="font-bold">{stats?.config?.deposit_commission_pct ?? '—'}%</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Trade comm.</p>
                  <p className="font-bold">{stats?.config?.trade_commission_pct ?? '—'}%</p>
                </div>
                {stats?.config?.turnover_multiplier && (
                  <div>
                    <p className="text-white/60 text-xs">Bonus turnover</p>
                    <p className="font-bold">{stats.config.turnover_multiplier}x</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-3 gap-1.5">
            {[1,2,3].map(i => <div key={i} className="bg-surface-2 rounded-xl h-16 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            <Card padding="p-2.5">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Earned</p>
              <p className="text-sm font-extrabold text-emerald-400 tabular-nums mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {formatCurrency(totalEarned)}
              </p>
            </Card>
            <Card padding="p-2.5">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Active</p>
              <p className="text-sm font-extrabold text-text-primary tabular-nums mt-0.5">{activeReferrals}</p>
            </Card>
            <Card padding="p-2.5">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Tier</p>
              <p className="text-sm font-extrabold mt-0.5" style={{ color: currentTier?.display_color || '#6366F1' }}>
                {currentTier?.name || '—'}
              </p>
            </Card>
          </div>
        )}

        {/* Share Link */}
        {referralCode && (
          <Card padding="p-3">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Share Your Link</p>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 bg-surface rounded-lg px-3 py-2 text-xs text-text-secondary font-medium truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {referralLink}
              </div>
              <button onClick={() => handleCopy(referralLink, 'link')}
                className={cn('px-3 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0', copiedField === 'link' ? 'bg-emerald-500 text-white' : 'bg-primary text-white')}>
                {copiedField === 'link' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button onClick={handleShareWhatsApp}
              className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600/15 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-600/25 transition-colors">
              <MessageCircle size={13} />Share on WhatsApp
            </button>
          </Card>
        )}

        {/* Commission Tiers */}
        {tiers.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">Commission Tiers</h3>
            <div className={cn('grid gap-1.5', tiers.length <= 4 ? 'grid-cols-4' : 'grid-cols-2')}>
              {tiers.map((tier) => (
                <Card key={tier.id} padding="p-2" className={cn('text-center border-2 transition-all', currentTier?.id === tier.id ? 'border-primary/30 bg-primary/5' : 'border-transparent')}>
                  <div className="w-6 h-6 mx-auto rounded-full flex items-center justify-center mb-1" style={{ background: tier.display_color }}>
                    <Star size={10} className="text-white" />
                  </div>
                  <p className="text-xs font-bold text-text-primary">{tier.name}</p>
                  <p className="text-[10px] text-primary font-bold mt-0.5">{tier.deposit_commission_pct}%</p>
                  <p className="text-[9px] text-text-muted">{tier.min_referrals}+ refs</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Bonus History */}
        {bonusHistory?.as_referrer?.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">Bonus History</h3>
            <Card padding="p-0">
              <div className="divide-y divide-border/20">
                {bonusHistory.as_referrer.slice(0, 5).map((e) => (
                  <div key={e.id} className="px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-text-primary">{e.referee_name}</p>
                      <p className="text-xs text-text-muted">{new Date(e.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      {e.bonus_amount > 0 && (
                        <p className="text-sm font-extrabold text-emerald-400 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          +{formatCurrency(e.bonus_amount)}
                        </p>
                      )}
                      <Badge variant={e.status === 'credited' ? 'success' : 'warning'}>{e.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Referred Users */}
        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">
            Your Referrals ({stats?.stats?.total_referrals || 0})
          </h3>
          {loading ? (
            <Card className="py-8 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-text-muted" />
            </Card>
          ) : referrals.length > 0 ? (
            <Card padding="p-0">
              <div className="divide-y divide-border/20">
                {referrals.map((ref) => (
                  <div key={ref.id} className="px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">
                        {(ref.name || '?').charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">{ref.name}</p>
                        <p className="text-xs text-text-muted">Joined {ref.joined} · {ref.trades} trades</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {ref.earned > 0 && (
                        <p className="text-sm font-extrabold text-emerald-400 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          +{formatCurrency(ref.earned)}
                        </p>
                      )}
                      <Badge variant={ref.status === 'active' ? 'success' : 'warning'}>{ref.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="py-8 text-center">
              <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center mx-auto mb-2">
                <Users size={22} className="text-text-muted/50" />
              </div>
              <p className="text-sm font-semibold text-text-secondary">No Referrals Yet</p>
              <p className="text-xs text-text-muted mt-0.5">Share your code above to start earning!</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
