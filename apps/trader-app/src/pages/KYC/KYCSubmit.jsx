import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import Header from '../../components/layout/Header';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';
import { useTradeStore } from '../../store/useTradeStore';

const compressImage = (base64Str, maxWidth = 1000, maxHeight = 1000, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export default function KYCSubmit() {
  const navigate = useNavigate();
  const { fetchProfile } = useTradeStore();
  const [docType, setDocType] = useState('aadhaar');
  const [docNumber, setDocNumber] = useState('');
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (limit base64 to around 4MB to avoid body-parser limit)
    if (file.size > 4 * 1024 * 1024) {
      setError('File size too large. Please select an image under 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressImage(reader.result);
        if (side === 'front') {
          setFrontImage(compressed);
        } else {
          setBackImage(compressed);
        }
        setError(null);
      } catch (err) {
        setError('Failed to process image.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const clearImage = (side) => {
    if (side === 'front') {
      setFrontImage(null);
    } else {
      setBackImage(null);
    }
  };

  const handleDocTypeChange = (e) => {
    setDocType(e.target.value);
    setFrontImage(null);
    setBackImage(null);
    setDocNumber('');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!frontImage) {
      setError('Please upload the front side of your ID.');
      return;
    }

    if (['aadhaar', 'driving_licence'].includes(docType) && !backImage) {
      setError('Please upload the back side of your ID.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        document_type: docType,
        document_number: docNumber,
        front_image: frontImage,
        back_image: docType !== 'pan' ? backImage : undefined,
      };

      await api.submitKyc(payload);
      await fetchProfile(); // refresh user profile store state
      setSuccess(true);
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit KYC. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDocPlaceholderName = () => {
    if (docType === 'aadhaar') return '12-Digit Aadhaar Number';
    if (docType === 'pan') return '10-Digit PAN Number';
    return 'Driving Licence Number';
  };

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="px-4 py-2 border-b border-border/10 flex items-center gap-3 bg-surface-2">
        <button 
          onClick={() => navigate('/profile')} 
          className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors text-text-secondary cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-base font-bold text-text-primary">Identity Verification (KYC)</span>
      </div>

      <div className="px-4 mt-4 max-w-md mx-auto space-y-4">
        {success ? (
          <Card padding="p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">KYC Submitted Successfully!</h2>
              <p className="text-sm text-text-muted mt-1">Our compliance team will review your application shortly.</p>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card padding="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Select ID Type</label>
                <select 
                  value={docType} 
                  onChange={handleDocTypeChange}
                  className="w-full bg-surface-3 border border-border/50 rounded-xl px-4 py-2.5 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all cursor-pointer"
                >
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="driving_licence">Driving Licence</option>
                  <option value="pan">PAN Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Document Number (Optional)</label>
                <div className="relative">
                  <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder={getDocPlaceholderName()}
                    className="w-full bg-surface-3 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>
            </Card>

            {/* Document Upload Area */}
            <Card padding="p-4 space-y-4">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Upload ID Document</h3>
              
              <div className="grid grid-cols-1 gap-4">
                {/* Front Side */}
                <div>
                  <span className="block text-[11px] font-bold text-text-secondary mb-1">Front Side</span>
                  {frontImage ? (
                    <div className="relative border border-border/40 rounded-xl overflow-hidden bg-surface-3 flex items-center justify-center p-2 group h-40">
                      <img src={frontImage} alt="ID Front Preview" className="max-h-full max-w-full object-contain rounded-lg" />
                      <button 
                        type="button" 
                        onClick={() => clearImage('front')}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-border/40 hover:border-primary/50 rounded-xl p-6 flex flex-col items-center justify-center bg-surface-3/50 hover:bg-surface-3 transition-all cursor-pointer h-40 group text-center">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, 'front')} 
                        className="hidden" 
                      />
                      <Upload size={24} className="text-text-muted group-hover:text-primary transition-colors mb-2" />
                      <span className="text-xs font-bold text-text-primary">Upload Front Image</span>
                      <span className="text-[10px] text-text-muted mt-1">Tap to browse files</span>
                    </label>
                  )}
                </div>

                {/* Back Side (Conditional) */}
                {docType !== 'pan' && (
                  <div>
                    <span className="block text-[11px] font-bold text-text-secondary mb-1">Back Side</span>
                    {backImage ? (
                      <div className="relative border border-border/40 rounded-xl overflow-hidden bg-surface-3 flex items-center justify-center p-2 group h-40">
                        <img src={backImage} alt="ID Back Preview" className="max-h-full max-w-full object-contain rounded-lg" />
                        <button 
                          type="button" 
                          onClick={() => clearImage('back')}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-border/40 hover:border-primary/50 rounded-xl p-6 flex flex-col items-center justify-center bg-surface-3/50 hover:bg-surface-3 transition-all cursor-pointer h-40 group text-center">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileChange(e, 'back')} 
                          className="hidden" 
                        />
                        <Upload size={24} className="text-text-muted group-hover:text-primary transition-colors mb-2" />
                        <span className="text-xs font-bold text-text-primary">Upload Back Image</span>
                        <span className="text-[10px] text-text-muted mt-1">Tap to browse files</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-xl flex items-start gap-2.5">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={loading}
              className="py-3 shadow-md"
            >
              {loading ? 'Submitting...' : 'Submit Documents'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
