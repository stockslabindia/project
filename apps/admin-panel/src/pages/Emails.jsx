import { useState, useEffect, useRef } from 'react';
import {
  Mail, Send, Clock, CheckCircle, XCircle, Users, Filter,
  RefreshCw, Eye, ChevronDown, AlertTriangle, Megaphone,
  Wrench, Loader2, Search, BarChart3, Calendar, User
} from 'lucide-react';
import { adminApi } from '../services/adminApi';

// ── Email type configs ──
const EMAIL_TYPES = [
  { value: 'maintenance', label: '🔧 System Maintenance', desc: 'Notify users about scheduled downtime', color: 'amber' },
  { value: 'important_update', label: '📢 Important Update', desc: 'Platform changes, policy updates', color: 'blue' },
  { value: 'custom_bulk', label: '✉️ Custom Email', desc: 'Write your own subject & message', color: 'purple' },
];

const FILTERS = [
  { value: 'all', label: 'All Active Users', icon: '👥' },
  { value: 'kyc_verified', label: 'KYC Verified Only', icon: '✅' },
  { value: 'kyc_pending', label: 'KYC Not Verified', icon: '⏳' },
  { value: 'has_balance', label: 'Users with Balance > ₹0', icon: '💰' },
  { value: 'specific', label: 'Specific Users (by Client ID)', icon: '🎯' },
];

const LOG_TYPES = ['all', 'welcome', 'bank_account_added', 'bank_account_removed', 'deposit_approved', 'deposit_rejected', 'withdrawal_approved', 'withdrawal_rejected', 'kyc_approved', 'kyc_rejected', 'maintenance', 'important_update', 'custom_bulk'];

export default function Emails() {
  const [activeTab, setActiveTab] = useState('compose');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [form, setForm] = useState({
    type: 'important_update',
    subject: '',
    title: '',
    message: '',
    ctaText: '',
    ctaUrl: '',
    filter: { type: 'all' },
    specificIds: '',
  });

  useEffect(() => {
    if (activeTab === 'campaigns') fetchCampaigns();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const data = await adminApi.getEmailCampaigns();
      setCampaigns(data.campaigns || []);
    } catch (e) { console.error(e); }
    finally { setCampaignsLoading(false); }
  };

  const fetchLogs = async (type = logFilter) => {
    setLogsLoading(true);
    try {
      const params = type !== 'all' ? `&type=${type}` : '';
      const data = await adminApi.getEmailLogs(params);
      setLogs(data.logs || []);
    } catch (e) { console.error(e); }
    finally { setLogsLoading(false); }
  };

  const handleSend = async () => {
    if (!form.subject.trim() || !form.title.trim() || !form.message.trim()) {
      alert('Please fill in Subject, Title, and Message.');
      return;
    }
    if (!confirm(`Send "${form.subject}" to ${form.filter.type === 'all' ? 'all active users' : form.filter.type} users?`)) return;

    setSending(true);
    setSendResult(null);
    try {
      const filter = form.filter.type === 'specific'
        ? { type: 'specific', ids: form.specificIds.split(',').map(s => s.trim()).filter(Boolean) }
        : { type: form.filter.type };

      const result = await adminApi.sendBulkEmail({
        type: form.type,
        subject: form.subject,
        title: form.title,
        message: form.message,
        ctaText: form.ctaText || undefined,
        ctaUrl: form.ctaUrl || undefined,
        filter,
      });
      setSendResult({ success: true, ...result });
      setForm(f => ({ ...f, subject: '', title: '', message: '', ctaText: '', ctaUrl: '' }));
    } catch (e) {
      setSendResult({ success: false, error: e.message });
    } finally {
      setSending(false);
    }
  };

  const selectedType = EMAIL_TYPES.find(t => t.value === form.type);

  // ── Preview HTML ──
  const previewHtml = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#f1f5f9;padding:20px;border-radius:12px;">
      <div style="background:#0f172a;border-radius:10px 10px 0 0;padding:20px 24px;display:flex;align-items:center;gap:12px;">
        <div style="width:32px;height:32px;background:#1a56db;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:16px;">S</div>
        <span style="font-size:18px;font-weight:800;color:#fff;">StocksLab India</span>
      </div>
      <div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0;border-top:none;">
        <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:14px;font-weight:700;color:#1e40af;">
          ${form.type === 'maintenance' ? '🔧' : form.type === 'important_update' ? '📢' : '✉️'} ${form.title || 'Email Title Preview'}
        </div>
        <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px;">Hi <strong>[User Name]</strong>,</p>
        <div style="font-size:14px;color:#374151;line-height:1.8;white-space:pre-line;margin-bottom:20px;">${form.message || 'Your message will appear here...'}</div>
        ${form.ctaText ? `<div style="text-align:center;margin:20px 0;"><a style="display:inline-block;background:#1a56db;color:#fff;padding:12px 28px;border-radius:7px;font-weight:700;text-decoration:none;font-size:14px;">${form.ctaText} →</a></div>` : ''}
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:16px 24px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">StocksLab India · stockslab.live · support@stockslab.live</p>
      </div>
    </div>`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Center</h1>
          <p className="text-sm text-gray-500 mt-1">Send bulk emails and view email delivery logs.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Resend API Connected
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent', value: logs.filter(l => l.status === 'sent').length || '—', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Failed', value: logs.filter(l => l.status === 'failed').length || '—', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Campaigns', value: campaigns.length || '—', icon: Megaphone, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Email Types', value: '12', icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} border border-${color.split('-')[1]}-200 rounded-xl p-4`}>
            <div className={`${color} flex items-center gap-2 text-xs font-bold uppercase mb-1`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </div>
            <div className={`text-2xl font-black ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 flex">
          {[
            { id: 'compose', label: '✉️ Compose', icon: Send },
            { id: 'campaigns', label: '📋 Campaigns', icon: BarChart3 },
            { id: 'logs', label: '📊 Email Logs', icon: Clock },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════ COMPOSE TAB ═══════════════ */}
        {activeTab === 'compose' && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Form */}
              <div className="space-y-5">

                {/* Email Type */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Email Type</label>
                  <div className="grid grid-cols-1 gap-2">
                    {EMAIL_TYPES.map(t => (
                      <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                          form.type === t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}>
                        <div className="text-xl">{t.label.split(' ')[0]}</div>
                        <div>
                          <div className="text-sm font-700 font-bold text-gray-900">{t.label.slice(3)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
                        </div>
                        {form.type === t.value && <CheckCircle className="h-4 w-4 text-blue-600 ml-auto mt-0.5 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient Filter */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    <Filter className="inline h-3.5 w-3.5 mr-1" />Recipients
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {FILTERS.map(f => (
                      <button key={f.value} onClick={() => setForm(prev => ({ ...prev, filter: { type: f.value } }))}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                          form.filter.type === f.value ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}>
                        <span>{f.icon}</span>
                        <span className="text-sm">{f.label}</span>
                        {form.filter.type === f.value && <CheckCircle className="h-3.5 w-3.5 text-blue-600 ml-auto" />}
                      </button>
                    ))}
                  </div>
                  {form.filter.type === 'specific' && (
                    <div className="mt-2">
                      <textarea
                        rows={2}
                        placeholder="Enter Client IDs separated by commas (e.g. SL00001, SL00002)"
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                        value={form.specificIds}
                        onChange={e => setForm(f => ({ ...f, specificIds: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Subject Line</label>
                  <input type="text" placeholder="e.g. Important: Scheduled Maintenance on June 25"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Email Title <span className="text-gray-400 normal-case font-normal">(shown large in email)</span></label>
                  <input type="text" placeholder="e.g. Scheduled Maintenance: June 25, 2026"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Message</label>
                  <textarea rows={5} placeholder="Write your message here..."
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                </div>

                {/* CTA Button (optional) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">CTA Button <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Button label (e.g. View Platform)"
                      className="w-1/2 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                      value={form.ctaText}
                      onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))} />
                    <input type="text" placeholder="URL (e.g. https://stockslab.live)"
                      className="w-1/2 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                      value={form.ctaUrl}
                      onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))} />
                  </div>
                </div>

                {/* Send Result */}
                {sendResult && (
                  <div className={`p-3 rounded-lg border text-sm font-medium ${
                    sendResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {sendResult.success
                      ? `✅ Success! ${sendResult.queued} emails queued for delivery.`
                      : `❌ Failed: ${sendResult.error}`}
                  </div>
                )}

                {/* Send Button */}
                <button onClick={handleSend} disabled={sending || !form.subject || !form.title || !form.message}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm">
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Bulk Email</>}
                </button>
              </div>

              {/* Right: Live Preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Eye className="inline h-3.5 w-3.5 mr-1" />Live Preview
                  </label>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Updates as you type</span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shadow-inner" style={{ height: '620px' }}>
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ CAMPAIGNS TAB ═══════════════ */}
        {activeTab === 'campaigns' && (
          <div>
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm text-gray-500">{campaigns.length} campaigns total</p>
              <button onClick={fetchCampaigns} className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-800">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="text-[11px] font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200 tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">Subject</th>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Filter</th>
                    <th className="px-5 py-3 text-right">Recipients</th>
                    <th className="px-5 py-3 text-right">Sent</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaignsLoading ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading campaigns...</td></tr>
                  ) : campaigns.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No campaigns sent yet. Use Compose to send your first bulk email.</td></tr>
                  ) : campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900 max-w-[200px] truncate">{c.subject}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 capitalize">
                          {c.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 capitalize">{c.recipient_filter?.type?.replace('_', ' ') || 'all'}</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-700">{c.total_recipients}</td>
                      <td className="px-5 py-3 text-right font-bold text-green-700">{c.total_sent}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          c.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200'
                          : c.status === 'sending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                        }`}>{c.status}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════ LOGS TAB ═══════════════ */}
        {activeTab === 'logs' && (
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex flex-wrap gap-1.5">
                {['all', 'welcome', 'deposit_approved', 'deposit_rejected', 'withdrawal_approved', 'withdrawal_rejected', 'kyc_approved', 'kyc_rejected', 'maintenance', 'important_update', 'custom_bulk'].map(type => (
                  <button key={type} onClick={() => { setLogFilter(type); fetchLogs(type); }}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                      logFilter === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}>
                    {type === 'all' ? 'All' : type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              <button onClick={() => fetchLogs(logFilter)} className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-800 ml-auto">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="text-[11px] font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200 tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">Recipient</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Subject</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logsLoading ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading logs...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No email logs found.</td></tr>
                  ) : logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-bold text-gray-900 text-xs">{log.profiles?.full_name || '—'}</div>
                        <div className="text-[10px] text-blue-600">{log.profiles?.client_id || ''}</div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600 max-w-[180px] truncate">{log.email_to}</td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200 capitalize">
                          {log.type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600 max-w-[200px] truncate">{log.subject || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          log.status === 'sent' ? 'bg-green-50 text-green-700 border-green-200'
                          : log.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}>
                          {log.status}
                        </span>
                        {log.error_message && (
                          <div className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate" title={log.error_message}>
                            {log.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {new Date(log.sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
