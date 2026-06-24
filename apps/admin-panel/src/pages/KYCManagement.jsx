import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Eye, Clock, FileText, ShieldCheck, AlertTriangle, Download, User, Upload, Loader2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function KYCManagement() {
  const [kycQueue, setKycQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchKYC();
  }, []);

  const fetchKYC = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getKycDocuments('all');
      setKycQueue(data.documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await adminApi.verifyKyc(id);
      fetchKYC();
      setShowDetailModal(false);
    } catch (err) {
      alert('Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectReason) return alert('Reason required');
    setSubmitting(true);
    try {
      await adminApi.rejectKyc(selectedKyc.id, rejectReason);
      setShowRejectModal(false);
      setShowDetailModal(false);
      setRejectReason('');
      fetchKYC();
    } catch (err) {
      alert('Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) return alert('No KYC records to export.');
    const headers = ['KYC ID', 'Client Name', 'Client ID', 'Email', 'Document Type', 'Document Number', 'Submitted Date', 'Status'];
    const rows = filtered.map(kyc => [
      kyc.id || '',
      kyc.profiles?.full_name || '',
      kyc.profiles?.client_id || '',
      kyc.profiles?.email || '',
      kyc.document_type || '',
      kyc.document_number || '',
      new Date(kyc.created_at).toLocaleDateString(),
      kyc.status || 'pending'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kyc_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    pending: kycQueue.filter(k => k.status === 'pending').length,
    approved: kycQueue.filter(k => k.status === 'verified').length,
    rejected: kycQueue.filter(k => k.status === 'rejected').length,
    total: kycQueue.length,
  };

  const filtered = kycQueue.filter(k => {
    if (activeTab !== 'all' && k.status !== activeTab) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const name = k.profiles?.full_name?.toLowerCase() || '';
      const email = k.profiles?.email?.toLowerCase() || '';
      const clientId = k.profiles?.client_id?.toLowerCase() || '';
      const docType = k.document_type?.toLowerCase() || '';
      const kycId = k.id?.toLowerCase() || '';
      return name.includes(term) || email.includes(term) || clientId.includes(term) || docType.includes(term) || kycId.includes(term);
    }
    return true;
  });

  const openDetail = (kyc) => {
    setSelectedKyc(kyc);
    setShowDetailModal(true);
  };

  const statusConfig = {
    pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    verified: { label: 'Verified', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC Verification</h1>
          <p className="text-sm text-gray-500 mt-1">Review and approve client identity documents and compliance checks.</p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center justify-center rounded-md text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2">
          <Download className="h-4 w-4 mr-2" />
          Export KYC Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">Total Applications</div>
          <div className="text-2xl font-black text-gray-900">{stats.total}</div>
        </div>
        <div className={`p-5 rounded-lg border shadow-sm ${stats.pending > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
          <div className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
            {stats.pending > 0 && <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />}
            Pending Review
          </div>
          <div className="text-2xl font-black text-yellow-700">{stats.pending}</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">Approved</div>
          <div className="text-2xl font-black text-green-600">{stats.approved}</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">Rejected</div>
          <div className="text-2xl font-black text-red-600">{stats.rejected}</div>
        </div>
      </div>

      {/* KYC Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center px-4 py-3 gap-4">
          <nav className="flex space-x-2">
            {['all', 'pending', 'verified', 'rejected'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`capitalize px-3 py-1.5 font-medium text-sm rounded-md transition-colors ${
                  activeTab === tab ? 'bg-white shadow-sm text-blue-700 border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}>
                {tab === 'verified' ? 'Approved' : tab} {tab !== 'all' && `(${kycQueue.filter(k => tab === 'all' || k.status === tab).length})`}
              </button>
            ))}
          </nav>
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input 
              type="text" 
              placeholder="Search by name, ID, or email..." 
              className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b border-gray-200 tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">KYC ID</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Documents</th>
                <th className="px-4 py-3 font-semibold">Risk Score</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Loading KYC Queue...</td></tr>
              ) : filtered.length > 0 ? filtered.map(kyc => {
                const config = statusConfig[kyc.status] || statusConfig['pending'];
                const StatusIcon = config.icon;
                return (
                  <tr key={kyc.id} className={`hover:bg-gray-50 ${kyc.status === 'pending' ? 'bg-yellow-50/20' : ''}`}>
                    <td className="px-4 py-3 font-bold text-gray-900 text-[10px] uppercase truncate max-w-[80px]" title={kyc.id}>{kyc.id.split('-')[0]}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{kyc.profiles?.full_name}</div>
                      <div className="text-[10px] text-blue-600 font-medium">{kyc.profiles?.client_id}</div>
                      <div className="text-[10px] text-gray-400">{kyc.profiles?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-700">{kyc.document_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-green-50 text-green-700 border-green-200`}>Low</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <Clock className="inline-block h-3 w-3 mr-1" />{new Date(kyc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${config.color}`}>
                        <StatusIcon className="h-3 w-3" /> {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openDetail(kyc)} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" /> Review
                        </button>
                        {kyc.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(kyc.id)} className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded hover:bg-green-100 border border-green-200 inline-flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Approve
                            </button>
                            <button onClick={() => { setSelectedKyc(kyc); setShowRejectModal(true); }}
                              className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded hover:bg-red-100 border border-red-200 inline-flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No KYC documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Review Modal */}
      {showDetailModal && selectedKyc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">KYC Review — {selectedKyc.id}</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Personal Info</h4>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-gray-500">Name</span><span className="text-xs font-bold text-gray-900">{selectedKyc.profiles?.full_name}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-500">Client ID</span><span className="text-xs font-bold text-blue-600">{selectedKyc.profiles?.client_id}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-500">Email</span><span className="text-xs font-bold text-gray-900">{selectedKyc.profiles?.email}</span></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Verification Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-gray-500">Documents</span><span className="text-xs font-bold text-gray-900">{selectedKyc.document_type}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-500">Submitted</span><span className="text-xs font-bold text-gray-900">{new Date(selectedKyc.created_at).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-500">Risk Score</span><span className={`text-xs font-bold text-green-600`}>Low</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-500">Status</span><span className="text-xs font-bold text-gray-900 capitalize">{selectedKyc.status}</span></div>
                </div>
              </div>
            </div>

            {/* Document Previews */}
            <h4 className="text-sm font-bold text-gray-900 mb-3">Uploaded Documents</h4>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {(selectedKyc.document_url ? selectedKyc.document_url.split(',') : []).map((url, i) => {
                const isBack = i === 1;
                const label = `${selectedKyc.document_type === 'aadhaar' ? 'Aadhaar' : selectedKyc.document_type === 'pan' ? 'PAN' : 'Driving Licence'} (${isBack ? 'Back' : 'Front'})`;
                const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : 'http://localhost:4000';
                const imageUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
                
                return (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-600 mb-2">{label}</span>
                    <a href={imageUrl} target="_blank" rel="noreferrer" className="w-full flex justify-center bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-400 transition-colors h-48">
                      <img src={imageUrl} alt={label} className="max-h-full max-w-full object-contain rounded" />
                    </a>
                  </div>
                );
              })}
            </div>

            {/* Admin Notes */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">Admin Notes</label>
              <textarea rows={2} placeholder="Add verification notes..." className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowDetailModal(false)} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50">Close</button>
              {selectedKyc.status === 'pending' && (
                <>
                  <button onClick={() => { setShowDetailModal(false); setShowRejectModal(true); }} className="flex-1 py-2 rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-700">Reject</button>
                  <button onClick={() => handleApprove(selectedKyc.id)} className="flex-1 py-2 rounded-lg bg-green-600 text-sm font-bold text-white hover:bg-green-700">Approve KYC</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedKyc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject KYC — {selectedKyc.profiles?.client_id}</h3>
            <p className="text-sm text-gray-600 mb-4">The user will be notified and can resubmit documents.</p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">Rejection Reason (Required)</label>
              <select onChange={(e) => setRejectReason(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm font-medium mb-2">
                <option value="">Select a reason</option>
                <option value="Document expired">Document expired</option>
                <option value="Blurry / unreadable document">Blurry / unreadable document</option>
                <option value="Name mismatch">Name mismatch</option>
                <option value="Suspicious document">Suspicious document</option>
                <option value="Other">Other</option>
              </select>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Additional notes..." className="w-full border border-gray-300 rounded p-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleReject} disabled={submitting} className="flex-1 py-2 rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
