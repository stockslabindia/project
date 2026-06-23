import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, AlertCircle, Clock, FileText, RotateCcw } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function EODSettlement() {
  const [status, setStatus] = useState('idle'); // idle, running, completed
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDetail, setReportDetail] = useState(null);

  const openReportDetail = (report) => {
    setReportDetail(report);
    setShowReportModal(true);
  };

  useEffect(() => {
    adminApi.getEodReports()
      .then(res => setReports(res.reports || []))
      .catch(console.error);
  }, [status]);

  const steps = [
    { id: 1, name: 'Halt Trading Services', status: status === 'completed' ? 'done' : status === 'running' ? 'done' : 'pending' },
    { id: 2, name: 'Fetch EOD Prices from Exchange', status: status === 'completed' ? 'done' : status === 'running' ? 'running' : 'pending' },
    { id: 3, name: 'Calculate Mark-to-Market (M2M)', status: status === 'completed' ? 'done' : 'pending' },
    { id: 4, name: 'Apply Penalties & Swap Fees', status: status === 'completed' ? 'done' : 'pending' },
    { id: 5, name: 'Ledger Settlement & Balances', status: status === 'completed' ? 'done' : 'pending' },
    { id: 6, name: 'Generate Settlement Reports', status: status === 'completed' ? 'done' : 'pending' },
  ];

  const handleStart = async () => {
     if (window.confirm('Start EOD settlement process? Trading will be halted during this process.')) {
       setStatus('running');
       try {
         const res = await adminApi.runEodSettlement();
         setCurrentReport(res.report);
         setStatus('completed');
         openReportDetail(res.report);
       } catch (err) {
         console.error('Failed to run EOD', err);
         alert('EOD Settlement Failed. Check logs.');
         setStatus('idle');
       }
     }
  };

  const handleReset = () => {
    if (window.confirm('Reset settlement process? This will allow you to run it again.')) {
      setStatus('idle');
      setCurrentReport(null);
    }
  };

  const showCurrentReport = () => {
    if (!currentReport) return;
    openReportDetail(currentReport);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EOD / Settlement Processing</h1>
          <p className="text-sm text-gray-500 mt-1">End-of-day wizard for M2M, auto-debit/credit, and ledger settlement.</p>
        </div>
        <div className="flex gap-3">
          {status === 'completed' && (
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
         <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
            <div>
               <h2 className="text-lg font-bold text-gray-900">Settlement Cycle: {new Date().toLocaleDateString()}</h2>
               <p className="text-sm text-gray-500">Status: {status === 'idle' ? 'Ready to Start' : status === 'running' ? 'Processing...' : 'Completed successfully'}</p>
            </div>
            {status === 'idle' && (
               <button onClick={handleStart} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm transition-all">
                  <Play className="w-5 h-5 fill-current" />
                  Start EOD Process
               </button>
            )}
            {status === 'running' && (
               <button disabled className="flex items-center gap-2 px-6 py-3 bg-blue-400 text-white rounded-lg font-medium cursor-wait shadow-sm transition-all">
                  <Clock className="w-5 h-5 animate-spin" />
                  Processing...
               </button>
            )}
            {status === 'completed' && (
               <button onClick={showCurrentReport} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-sm transition-all">
                  <CheckCircle2 className="w-5 h-5" />
                  View Settlement Report
               </button>
            )}
         </div>

         <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
            {steps.map((step, index) => (
               <div key={step.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10
                     ${step.status === 'done' ? 'border-green-500 text-green-500' : 
                       step.status === 'running' ? 'border-blue-500 text-blue-500 border-dashed animate-spin-slow' : 
                       'border-gray-300 text-gray-300'}`}>
                     {step.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> : 
                      step.status === 'running' ? <Clock className="w-5 h-5" /> : 
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                  </div>
                  
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                     <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-gray-900">Step {step.id}</div>
                        <div className={`text-xs font-medium px-2 py-1 rounded-full
                           ${step.status === 'done' ? 'bg-green-100 text-green-700' : 
                             step.status === 'running' ? 'bg-blue-100 text-blue-700' : 
                             'bg-gray-100 text-gray-600'}`}>
                           {step.status.toUpperCase()}
                        </div>
                     </div>
                     <div className="text-gray-500 text-sm">{step.name}</div>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {/* Settlement History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-900">Settlement History</h2>
          <span className="text-xs text-gray-500">Log of past EOD cycles</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b border-gray-200 tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold text-center">Clients Settled</th>
                <th className="px-4 py-3 font-semibold text-right">Profit Credited</th>
                <th className="px-4 py-3 font-semibold text-right">Losses Debited</th>
                <th className="px-4 py-3 font-semibold text-right">House Net PNL</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {reports.length === 0 ? (
                <tr><td colSpan="6" className="p-4 text-center text-gray-500">No previous settlement runs logged.</td></tr>
              ) : reports.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-gray-900">{new Date(r.settlement_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center font-bold text-gray-700">{r.total_clients_settled}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">₹{parseFloat(r.total_profit_credited || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">₹{parseFloat(r.total_losses_debited || 0).toLocaleString('en-IN')}</td>
                  <td className={`px-4 py-3 text-right font-bold ${r.total_house_pnl >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {r.total_house_pnl >= 0 ? '+' : ''}₹{parseFloat(r.total_house_pnl || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openReportDetail({
                      totalClients: r.total_clients_settled,
                      profitCredited: parseFloat(r.total_profit_credited || 0),
                      lossesDebited: parseFloat(r.total_losses_debited || 0),
                      brokerageCollected: parseFloat(r.total_swap_charged || 0),
                      settlementId: `STL-${r.settlement_date.replace(/-/g, '')}`,
                      settlementDate: r.settlement_date
                    })} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 border border-blue-200 font-medium">
                      View Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Report Detail Modal */}
      {showReportModal && reportDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-black text-gray-900 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Settlement Report</span>
              <span className="text-xs font-mono text-gray-500 font-normal">{reportDetail.settlementId}</span>
            </h3>
            
            <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              {reportDetail.settlementDate && (
                <div className="flex justify-between text-sm border-b border-gray-200 pb-1.5">
                  <span className="text-gray-500 font-medium">Settlement Date</span>
                  <span className="font-bold text-gray-900">{new Date(reportDetail.settlementDate).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Total Clients Settled</span>
                <span className="font-bold text-gray-900">{reportDetail.totalClients}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Profit Credited</span>
                <span className="font-bold text-green-600">₹{reportDetail.profitCredited.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Losses Debited</span>
                <span className="font-bold text-red-600">₹{reportDetail.lossesDebited.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5">
                <span className="text-gray-500 font-medium">Swap Fees Collected</span>
                <span className="font-bold text-blue-600">₹{reportDetail.brokerageCollected.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5">
                <span className="text-gray-700 font-bold">House Net Revenue</span>
                <span className={`font-black ${(reportDetail.lossesDebited - reportDetail.profitCredited + reportDetail.brokerageCollected) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ₹{(reportDetail.lossesDebited - reportDetail.profitCredited + reportDetail.brokerageCollected).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <button onClick={() => setShowReportModal(false)} className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
              Close Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
