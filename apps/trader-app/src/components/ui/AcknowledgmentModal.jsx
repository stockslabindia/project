import { useState, useEffect } from 'react';
import { AlertTriangle, CheckSquare, Square, ShieldCheck } from 'lucide-react';

export default function AcknowledgmentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('tradex_risk_acknowledged');
    if (!dismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleAgree = () => {
    if (!agreed) return;
    localStorage.setItem('tradex_risk_acknowledged', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={22} className="text-amber-500" />
            <h2 className="text-xl font-bold text-gray-900">Acknowledgment</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-[15px] text-gray-700 leading-relaxed text-center">
            CFDs are complex and risky products. Trading on margin is highly risky – you can lose all of the funds you invest. Make sure you understand these risks and that CFDs are suitable for you before trading.
          </p>

          {/* Warning box */}
          <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <p className="text-[14px] text-amber-700 font-semibold text-center leading-relaxed">
              <span className="mr-1">⚠️</span> Important: Please read and understand this risk disclosure before proceeding with CFD trading.
            </p>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 mt-5 cursor-pointer select-none group" onClick={() => setAgreed(!agreed)}>
            <div className="mt-0.5 flex-shrink-0">
              {agreed ? (
                <CheckSquare size={20} className="text-blue-600" />
              ) : (
                <Square size={20} className="text-gray-400 group-hover:text-gray-500 transition-colors" />
              )}
            </div>
            <span className="text-[14px] text-gray-700 leading-snug">
              I have read and understood the above-stated CFD Risk Disclosure and acknowledge the same.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={handleAgree}
            disabled={!agreed}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[15px] font-bold transition-all ${
              agreed
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ShieldCheck size={18} />
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
}
