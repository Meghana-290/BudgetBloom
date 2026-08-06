import React, { useState, useEffect, useRef } from 'react';
import { Wallet, UserProfile } from '../types';
import { addTransaction } from '../dbHelper';
import { X, DollarSign, Calendar, Sparkles, Camera, Upload, RefreshCw, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

interface GlobalTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType: "income" | "expense";
  wallets: Wallet[];
  profile: UserProfile | null;
  currencySymbol: string;
  initialScannerOpen?: boolean;
}

export default function GlobalTransactionModal({
  isOpen,
  onClose,
  initialType,
  wallets,
  profile,
  currencySymbol,
  initialScannerOpen
}: GlobalTransactionModalProps) {
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('');
  const [walletName, setWalletName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Gemini Scanner State Variables
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    storeName: string;
    amount: number;
    category: string;
    date: string;
    paymentMethod?: string;
    notes?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setScanError(null);
    setSuccessMsg(null);
    
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError("Camera access is not supported by your browser or inside this sandbox iframe. Please upload a file of the receipt instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      activeStreamRef.current = stream;
      setIsLiveCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => {
            console.error("Video element play failed:", err);
          });
        }
      }, 150);
    } catch (err: any) {
      console.error("Camera stream initiation failed:", err);
      setScanError("Unable to access camera. Please upload or browse a file of the receipt instead.");
    }
  };

  const stopCamera = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
      }
      stopCamera();
    } catch (err: any) {
      console.error("Error capturing photography from webcam:", err);
      setScanError("Failed to capture photograph frame.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanError(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processReceiptWithAI = async () => {
    if (!capturedImage) return;
    setScanLoading(true);
    setScanError(null);
    setSuccessMsg(null);
    setPreviewData(null);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: capturedImage })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to scan receipt image.");
      }

      const resJson = await response.json();
      if (!resJson.success || !resJson.data) {
        throw new Error("Invalid response received from server-side scanner service.");
      }

      const extracted = resJson.data;
      
      // Auto-fill core form fields internally
      if (extracted.description) setDesc(extracted.description);
      if (extracted.amount) setAmount(extracted.amount.toString());
      if (extracted.date) setDate(extracted.date);
      if (extracted.category) setCategory(extracted.category);
      
      let detectedWallet = 'Cash';
      if (extracted.paymentMethod) {
        const lowercasePM = extracted.paymentMethod.toLowerCase();
        if (lowercasePM.includes('cash')) {
          setWalletName('Cash');
          detectedWallet = 'Cash';
        } else if (lowercasePM.includes('upi')) {
          setWalletName('UPI');
          detectedWallet = 'UPI';
        } else if (lowercasePM.includes('bank') || lowercasePM.includes('account')) {
          setWalletName('Bank Account');
          detectedWallet = 'Bank Account';
        } else if (lowercasePM.includes('debit')) {
          setWalletName('Debit Card');
          detectedWallet = 'Debit Card';
        } else if (lowercasePM.includes('credit') || lowercasePM.includes('card')) {
          setWalletName('Credit Card');
          detectedWallet = 'Credit Card';
        } else if (lowercasePM.includes('wallet')) {
          setWalletName('Wallet');
          detectedWallet = 'Wallet';
        }
      }

      let combinedNotes = "";
      if (extracted.items && extracted.items.length > 0) {
        combinedNotes += `Items: ${extracted.items.join(', ')}`;
      }
      if (extracted.notes) {
        combinedNotes += (combinedNotes ? `\n${extracted.notes}` : extracted.notes);
      }
      if (combinedNotes) {
        setNotes(combinedNotes);
      }

      const extractedAmount = typeof extracted.amount === 'number' 
        ? extracted.amount 
        : parseFloat(extracted.amount) || 0;

      // Set the preview data state to transition the UI
      setPreviewData({
        storeName: extracted.description || "Unknown Store",
        amount: extractedAmount,
        category: extracted.category || "Other",
        date: extracted.date || new Date().toISOString().split('T')[0],
        paymentMethod: detectedWallet,
        notes: combinedNotes
      });

      setSuccessMsg(`Receipt scanned successfully!\nDetected amount: ₹${extractedAmount}\nDetected category: ${extracted.category || 'Other'}`);
      
      stopCamera();
    } catch (err: any) {
      console.error("Gemini receipt scan failure:", err);
      setScanError(err.message || "Failed to analyze receipt. Please upload/capture again.");
    } finally {
      setScanLoading(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!previewData || !profile) return;
    setLoading(true);
    try {
      const payload = {
        userId: profile.uid,
        description: previewData.storeName,
        category: previewData.category,
        paymentMethod: previewData.paymentMethod || wallets[0]?.name || 'Cash',
        type: 'expense' as const,
        amount: previewData.amount,
        date: previewData.date,
        notes: previewData.notes || undefined,
      };

      await addTransaction(payload);
      onClose();
    } catch (err) {
      console.error("Error confirming transaction:", err);
      setScanError("Failed to save transaction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const wasOpenRef = useRef(false);

  // Set default category and wallet names whenever the modal opens or type changes
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setTxType(initialType);
      setDesc('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      
      // Reset scanner states
      setScannerOpen(!!initialScannerOpen || initialType === 'expense');
      setCapturedImage(null);
      setScanError(null);
      setSuccessMsg(null);
      setIsLiveCameraActive(false);
      setPreviewData(null);

      // Select appropriate default category
      if (initialType === 'expense') {
        setCategory('Food & Groceries');
      } else {
        setCategory('Salary');
      }

      // Default wallet
      if (wallets.length > 0) {
        setWalletName(wallets[0].name);
      } else {
        setWalletName('Cash');
      }
    } else if (!isOpen) {
      // Cleanup tracks on modal close
      stopCamera();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialType, wallets, initialScannerOpen]);

  // Clean camera tracks on complete component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Prevent page scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const expenseCategories = [
    'Food & Groceries',
    'Shopping',
    'Rent',
    'Bills & Utilities',
    'Healthcare',
    'Education',
    'Transportation',
    'Entertainment',
    'Other'
  ];

  const incomeCategories = [
    'Salary',
    'Freelance',
    'Investments',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !category || !amount || !profile) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setLoading(true);
    try {
      const payload = {
        userId: profile.uid,
        description: desc,
        category,
        paymentMethod: walletName || wallets[0]?.name || 'Cash',
        type: txType,
        amount: parsedAmount,
        date,
        notes: notes.trim() || undefined,
      };

      await addTransaction(payload);
      onClose();
    } catch (err) {
      console.error("Error adding global transaction:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-[100vh] z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-overlay text-[#1F2933]">
      <div className="w-full max-w-sm p-5 rounded-2xl shadow-2xl border relative bg-white border-[#DCE8E1] text-slate-800 max-h-[calc(100vh-32px)] overflow-y-auto animate-modal-content">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
          title="Close Modal"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="font-display font-extrabold text-[#355C4B] text-base mb-1.5 text-center uppercase tracking-wider">
          {txType === 'income' ? 'Log New Income' : 'Log New Expense'}
        </h3>
        <p className="text-[10px] text-slate-400 text-center mb-4">
          Synchronized automatically with real-time encrypted Cloud Storage.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* 1. SCANNER FLOW: If scanner is open */}
          {scannerOpen ? (
            <div className="space-y-3">
              {!previewData ? (
                /* Scanning Stage */
                <div className="bg-[#F8FAF9] rounded-xl p-3 border border-[#E9F0EC] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#355C4B] uppercase tracking-wider flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-[#355C4B] shrink-0" />
                      Scan Receipt
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerOpen(false);
                        stopCamera();
                        setCapturedImage(null);
                        setScanError(null);
                        setPreviewData(null);
                      }}
                      className="text-[10px] font-extrabold text-[#355C4B] hover:underline hover:text-[#274437] transition-colors cursor-pointer"
                    >
                      Enter Manually
                    </button>
                  </div>

                  <div className="space-y-2.5 pt-1.5 border-t border-[#E9F0EC]">
                    {!capturedImage && !isLiveCameraActive && (
                      <div className="grid grid-cols-2 gap-2">
                        {/* Option 1: Upload Receipt Image (Gallery/File) */}
                        <label className="py-2.5 px-3 rounded-xl bg-white border border-[#DCE8E1] text-slate-700 text-[10px] font-bold hover:bg-[#EEF6F2] hover:text-[#355C4B] transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center shadow-sm hover:border-[#355C4B]/40">
                          <Upload className="w-4 h-4 text-[#355C4B]" />
                          <span className="leading-tight">Upload Receipt Image<br/><span className="text-[8px] text-slate-400 font-medium">(Gallery/File)</span></span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>

                        {/* Option 2: Scan Receipt (Camera) */}
                        <button
                          type="button"
                          onClick={startCamera}
                          className="py-2.5 px-3 rounded-xl bg-white border border-[#DCE8E1] text-slate-700 text-[10px] font-bold hover:bg-[#EEF6F2] hover:text-[#355C4B] transition-colors flex flex-col items-center justify-center gap-1.5 text-center shadow-sm hover:border-[#355C4B]/40 cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-[#355C4B]" />
                          <span className="leading-tight">Scan Receipt<br/><span className="text-[8px] text-slate-400 font-medium">(Live Camera)</span></span>
                        </button>
                      </div>
                    )}

                    {/* Live video streaming state */}
                    {isLiveCameraActive && (
                      <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-black aspect-video flex flex-col justify-end shadow-inner animate-modal-content">
                        <video
                          ref={videoRef}
                          playsInline
                          muted
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="relative z-10 p-2 bg-gradient-to-t from-black/80 to-transparent flex justify-between gap-2">
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="px-2.5 py-1 rounded-lg bg-white/20 text-white text-[10px] font-bold hover:bg-white/30 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="px-3 py-1 rounded-lg bg-[#355C4B] text-white text-[10px] font-bold hover:bg-[#274437] flex items-center gap-1 shadow-md cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Snap Photo
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Captured receipt thumbnail or preview */}
                    {capturedImage && (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100 flex items-center justify-center animate-modal-content">
                          <img
                            src={capturedImage}
                            alt="Captured draft receipt"
                            className="max-h-full max-w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCapturedImage(null);
                              setScanError(null);
                            }}
                            className="absolute right-2 top-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/85 transition-colors cursor-pointer"
                            title="Delete image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {!scanLoading ? (
                          <button
                            type="button"
                            onClick={processReceiptWithAI}
                            className="w-full py-2 bg-[#355C4B] hover:bg-[#274437] text-white rounded-xl text-[10px] font-extrabold transition-all shadow flex items-center justify-center space-x-1 uppercase tracking-wide cursor-pointer animate-pulse"
                          >
                            <Camera className="w-3.5 h-3.5 text-white animate-bounce" />
                            <span>Scan Receipt</span>
                          </button>
                        ) : (
                          <div className="w-full py-2 bg-[#DEF6EC] text-[#355C4B] rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Scanning receipt...
                          </div>
                        )}
                      </div>
                    )}

                    {scanError && (
                      <div className="p-2 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[10px] font-semibold flex items-start gap-1.5 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-600" />
                        <span>{scanError}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Preview and Confirm Stage */
                <div className="bg-[#EEF6F2] border border-[#DCE8E1] rounded-2xl p-4 space-y-3 animate-modal-content">
                  <div className="flex items-center gap-2 border-b border-[#DCE8E1] pb-2.5">
                    <div className="p-1.5 bg-[#355C4B]/10 rounded-lg text-[#355C4B] shrink-0">
                      <CheckCircle className="w-4 h-4 text-[#355C4B] animate-bounce" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-[#355C4B] uppercase tracking-wider">Receipt Extracted!</h4>
                      <p className="text-[9px] text-slate-400">Please confirm and save transaction.</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Store/Merchant</span>
                      <span className="font-semibold text-right text-slate-700">{previewData.storeName}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Amount</span>
                      <span className="font-extrabold text-slate-800 text-sm">
                        {currencySymbol}{previewData.amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Category</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#355C4B]/10 text-[#355C4B]">
                        {previewData.category}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Date</span>
                      <span className="font-semibold text-slate-600">{previewData.date}</span>
                    </div>

                    {previewData.paymentMethod && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Payment Method</span>
                        <span className="font-semibold text-slate-600">{previewData.paymentMethod}</span>
                      </div>
                    )}

                    {previewData.notes && (
                      <div className="pt-2 border-t border-[#DCE8E1]/60">
                        <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider block mb-1">Items & Notes</span>
                        <p className="text-[10px] text-slate-500 bg-white/50 p-2 rounded-lg leading-relaxed whitespace-pre-wrap max-h-20 overflow-y-auto border border-dashed border-[#DCE8E1]">
                          {previewData.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {scanError && (
                    <div className="p-2 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[10px] font-semibold flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-600" />
                      <span>{scanError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewData(null);
                        setSuccessMsg(null);
                        setScanError(null);
                        setCapturedImage(null);
                      }}
                      className="py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReceipt}
                      disabled={loading}
                      className="py-2 bg-[#355C4B] hover:bg-[#274437] disabled:opacity-50 text-white rounded-xl text-[10px] font-extrabold transition-all uppercase tracking-wider shadow cursor-pointer text-center flex items-center justify-center gap-1"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Confirm Transaction</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 2. MANUAL WORKFLOW: If scanner is closed */
            <div className="space-y-3">
              {/* Manual Input Top Shortcut to switch to Receipt Scanner */}
              <div className="bg-[#F8FAF9] rounded-xl p-3 border border-[#E9F0EC] flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#355C4B] uppercase tracking-wider flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-[#355C4B]" />
                  Scan Receipt
                </span>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="text-[10px] font-extrabold text-[#355C4B] hover:underline hover:text-[#274437] transition-colors cursor-pointer"
                >
                  Scan / Upload Image
                </button>
              </div>

              {/* Flow Type selector display */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Flow Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button" 
                    onClick={() => { setTxType('expense'); setCategory('Food & Groceries'); }}
                    className={`py-1.5 rounded-xl text-center text-xs font-semibold cursor-pointer ${
                      txType === 'expense' 
                        ? 'bg-[#E85D5D] text-white shadow' 
                        : 'bg-[#EEF6F2] text-slate-400 border border-[#DCE8E1]'
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setTxType('income'); setCategory('Salary'); }}
                    className={`py-1.5 rounded-xl text-center text-xs font-semibold cursor-pointer ${
                      txType === 'income' 
                        ? 'bg-[#4CAF50] text-white shadow' 
                        : 'bg-[#EEF6F2] text-slate-400 border border-[#DCE8E1]'
                    }`}
                  >
                    Income (+)
                  </button>
                </div>
              </div>

              {/* Payment Description */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Payment Description</label>
                <input 
                  type="text" 
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={txType === 'expense' ? 'e.g. Starbucks Cappuccino' : 'e.g. Weekly freelance retainer'}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#355C4B] font-medium placeholder-slate-350"
                  required
                />
              </div>

              {/* Category & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 font-medium"
                    required
                  >
                    {txType === 'expense' 
                      ? expenseCategories.map(c => <option key={c} value={c}>{c}</option>)
                      : incomeCategories.map(c => <option key={c} value={c}>{c}</option>)
                    }
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Payment Method</label>
                  <select 
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 text-xs text-slate-600 font-medium rounded-xl"
                    required
                  >
                    {wallets.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Account">Bank Account</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Wallet">Wallet</option>
                  </select>
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Amount ({currencySymbol})</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#355C4B] font-medium"
                    required
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Date</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Notes (Optional)</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. store name, bill split, tags, additional notes..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#355C4B] font-medium bg-transparent text-slate-800 resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-[#355C4B] hover:bg-[#274437] text-white rounded-xl text-xs font-semibold transition-colors shadow-md flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>{loading ? 'Adding...' : 'Save Entry'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
