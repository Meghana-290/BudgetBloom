import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { createOrUpdateProfile, uploadAvatar } from '../dbHelper';
import { updateProfile, updateEmail, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { setGlobalCurrency } from '../utils/format';
import { 
  User, 
  Settings, 
  ShieldCheck, 
  Sun, 
  Moon, 
  Coins, 
  Key, 
  Sparkles,
  Camera,
  CheckCircle,
  HelpCircle,
  Upload,
  Trash2,
  Mail,
  Lock,
  Globe,
  Bell,
  CheckSquare
} from 'lucide-react';

/**
 * Helper function to detect the user's local currency based on their profile settings,
 * falling back to browser locale and timezone detection when profile setting is unconfigured.
 */
export function detectUserCurrency(profile: UserProfile | null): string {
  // 1. Check user profile setting first
  if (profile?.currency) {
    return profile.currency;
  }

  // 2. Fall back to browser locale detection
  try {
    const locale = navigator.language || '';
    if (locale.toUpperCase().includes('US') || locale.startsWith('en-US')) return 'USD';
    if (locale.toUpperCase().includes('GB') || locale.startsWith('en-GB')) return 'GBP';
    
    // Eurozone countries
    const euroLocales = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'FI', 'IE', 'AT', 'PT', 'GR'];
    if (euroLocales.some(el => locale.toUpperCase().includes(el))) return 'EUR';
  } catch (e) {
    console.error('Locale currency detection error:', e);
  }

  // 3. Fall back to timezone detection
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('America/')) return 'USD';
    if (tz.includes('London') || tz.includes('Europe/London')) return 'GBP';
    if (tz.startsWith('Europe/')) return 'EUR';
    if (tz.includes('Kolkata') || tz.includes('India')) return 'INR';
  } catch (e) {
    console.error('Timezone currency detection error:', e);
  }

  // Default fallback
  return 'INR';
}

interface ProfileTabProps {
  profile: UserProfile | null;
  currencySymbol: string;
  setCurrencySymbol: (symbol: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export default function ProfileTab({
  profile,
  currencySymbol,
  setCurrencySymbol,
  darkMode,
  setDarkMode
}: ProfileTabProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [selectedCurrency, setSelectedCurrency] = useState(() => detectUserCurrency(profile));
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  
  // Advanced Auth updates
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Custom Preferences
  const [weeklyReports, setWeeklyReports] = useState(profile?.preferences?.weeklyReports ?? false);
  const [budgetWarnings, setBudgetWarnings] = useState(profile?.preferences?.budgetWarnings ?? true);
  const [thresholdAlerts, setThresholdAlerts] = useState(profile?.preferences?.thresholdAlerts ?? true);

  // States
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitor auth providers to see if password or Gmail/Google is used
  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com') ?? false;

  // Sync state with incoming loaded profiles
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setSelectedCurrency(detectUserCurrency(profile));
      setPhotoURL(profile.photoURL || '');
      setWeeklyReports(profile.preferences?.weeklyReports ?? false);
      setBudgetWarnings(profile.preferences?.budgetWarnings ?? true);
      setThresholdAlerts(profile.preferences?.thresholdAlerts ?? true);
    }
  }, [profile?.uid]);

  // Handle standard preferences form submit
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!displayName.trim() || !profile) {
      setError('Please provide a valid profile name.');
      setLoading(false);
      return;
    }

    try {
      // 1. Sync display name and photo to Auth local state
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName,
          photoURL: photoURL || null
        });
      }

      // 2. Sync to Firestore Database user preferences
      await createOrUpdateProfile(profile.uid, {
        displayName,
        currency: selectedCurrency,
        theme: darkMode ? 'dark' : 'light',
        photoURL: photoURL || null,
        preferences: {
          weeklyReports,
          budgetWarnings,
          thresholdAlerts
        }
      });

      // Update local currency symbol cache
      if (selectedCurrency === 'INR') setCurrencySymbol('₹');
      else if (selectedCurrency === 'EUR') setCurrencySymbol('€');
      else if (selectedCurrency === 'GBP') setCurrencySymbol('£');
      else setCurrencySymbol('$');

      setGlobalCurrency(selectedCurrency);

      setSuccess('Profile details and preferences synced cataloged successfully!');
    } catch (err: any) {
      console.error(err);
      setError('Failed to update and sync preferences: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Safe file loader helper
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file format (PNG, JPG, JPEG, WEBP).');
      return;
    }
    if (file.size > 1024 * 1024 * 10) { // Limit to 10MB since we use Firebase Storage
      setError('Image is too large! Please upload a photo smaller than 10MB.');
      return;
    }

    setError('');
    setLoading(true);
    setSuccess('');
    try {
      if (profile?.uid) {
        const downloadUrl = await uploadAvatar(profile.uid, file);
        setPhotoURL(downloadUrl);
        setSuccess('Avatar uploaded successfully!');
      } else {
        setError('No active user profile session was loaded.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to upload avatar: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Handle advanced credentials update
  const handleAuthCredentialsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Email update request
      if (newEmail.trim() && newEmail.trim() !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, newEmail.trim());
        await createOrUpdateProfile(auth.currentUser.uid, {
          email: newEmail.trim()
        });
        setNewEmail('');
      }

      // 2. Password update request
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          setError('Password must contain at least 6 characters.');
          setLoading(false);
          return;
        }
        await updatePassword(auth.currentUser, newPassword);
        setNewPassword('');
        setConfirmPassword('');
      }

      setSuccess('Security credentials successfully updated! Your active keys are updated.');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security reasons, this critical action requires recent authentication. Please sign out and log back in to renew your secure session.');
      } else {
        setError(err.message || 'Could not update security credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto text-[#1F2933]">
      
      {/* Title */}
      <div>
        <h2 className="font-display font-extrabold text-2xl text-brand-navy dark:text-white">Profile & Preferences</h2>
        <p className="text-sm text-slate-400 mt-1">Configure name details, upload visual avatars, adjust regional format settings, and update account passwords.</p>
      </div>

      {success && (
        <div id="settings-success-alert" className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs text-center font-medium flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div id="settings-error-alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs text-center font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: VISUAL PROFILE AVATAR EDITOR */}
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between space-y-6 ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="space-y-4">
            <h3 className="font-display font-bold text-sm text-brand-navy dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              Your Profile Image
            </h3>
            
            {/* Display Current Avatar */}
            <div className="text-center py-4">
              <div className="relative inline-block mx-auto">
                <div className={`w-32 h-32 rounded-full overflow-hidden flex items-center justify-center text-4xl font-extrabold mx-auto border-4 border-[#355C4B]/20 bg-[#355C4B]/10 text-[#355C4B] dark:text-[#A2C3B4]`}>
                  {photoURL ? (
                    <img 
                      src={photoURL} 
                      alt="User Avatar" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>
                      {(() => {
                        const name = displayName || profile?.name || '';
                        if (name) {
                          const parts = name.trim().split(/\s+/);
                          if (parts.length >= 2) {
                            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                          }
                          return parts[0].substring(0, 2).toUpperCase();
                        }
                        return (profile?.email || 'B').substring(0, 2).toUpperCase();
                      })()}
                    </span>
                  )}
                </div>
                {photoURL && (
                  <button 
                    onClick={() => setPhotoURL('')}
                    className="absolute -top-1 -right-1 p-1.5 rounded-full bg-rose-500 text-white shadow hover:bg-rose-600 transition-colors"
                    title="Remove profile image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="font-semibold text-sm truncate mt-3 dark:text-white">
                {displayName || 'BudgetBloom Member'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{profile?.email}</p>
            </div>

            {/* Drag and Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                dragActive 
                  ? 'border-[#355C4B] bg-[#355C4B]/5' 
                  : darkMode 
                    ? 'border-slate-700 hover:border-[#355C4B] hover:bg-slate-800/45' 
                    : 'border-slate-200 hover:border-[#355C4B] hover:bg-[#EEF6F2]/30'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-6 h-6 text-slate-400" />
              <div className="text-xs">
                <span className="font-bold text-[#355C4B] dark:text-[#A2C3B4]">Click to upload</span> or drag image here
              </div>
              <span className="text-[10px] text-slate-400 font-medium">PNG, JPG, max 600KB</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 leading-normal bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-dashed border-[#DCE8E1]/80 dark:border-slate-800 flex gap-2 items-start">
            <Sparkles className="w-4 h-4 text-[#D6A51D] shrink-0" />
            <p className="font-medium">
              Updating your profile picture instantly synchronizes across all devices and updates active printable ledger summary banners.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: PREFERENCES, SECURITY, THEME */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* GENERAL PREFERENCES FORM */}
          <form onSubmit={handleUpdateProfile} className={`p-6 rounded-3xl border shadow-sm space-y-6 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-display font-bold text-sm text-brand-navy dark:text-white">Account Details & Preferences</h3>
              <span className="p-1 px-2.5 text-[9px] font-mono font-bold text-brand-green bg-brand-green/10 rounded-full uppercase tracking-wider">Validated Setup</span>
            </div>

            <div className="space-y-4">
              
              {/* Display Name Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Your Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="E.g. Jane Doe"
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl border focus:outline-none text-xs font-semibold focus:ring-1 focus:ring-[#355C4B] ${
                      darkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Currency & Theme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Local Currency Code</label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                      value={selectedCurrency}
                      onChange={(e) => setSelectedCurrency(e.target.value)}
                      className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#355C4B] ${
                        darkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                      required
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">System Design Theme</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button" 
                      onClick={() => setDarkMode(false)}
                      className={`py-2 px-3 rounded-xl text-center text-xs font-bold flex items-center justify-center space-x-1.5 border transition-all ${
                        !darkMode 
                          ? 'bg-[#355C4B] text-white border-[#355C4B] shadow-sm' 
                          : 'bg-slate-850 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setDarkMode(true)}
                      className={`py-2 px-3 rounded-xl text-center text-xs font-bold flex items-center justify-center space-x-1.5 border transition-all ${
                        darkMode 
                          ? 'bg-[#355C4B] text-white border-[#355C4B] shadow-sm' 
                          : 'bg-slate-850 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* ACCOUNT PREFERENCES SUITE */}
              <div className="space-y-3 pt-3">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Account Controls & Preferences</span>
                
                <div className="space-y-2.5">
                  
                  {/* Weekly Report Toggle */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    darkMode ? 'bg-slate-850/40 border-slate-800' : 'bg-slate-50/60 border-slate-150'
                  }`}>
                    <div className="flex items-start space-x-3 pr-2">
                      <CheckSquare className={`w-4 h-4 mt-0.5 ${weeklyReports ? 'text-[#355C4B]' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Email digest reports</p>
                        <p className="text-[10px] text-slate-450 leading-tight">Receive interactive financial statements and ledger reports by email.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWeeklyReports(!weeklyReports)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                        weeklyReports ? 'bg-[#355C4B]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${weeklyReports ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Budget Exceeded Toggle */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    darkMode ? 'bg-slate-850/40 border-slate-800' : 'bg-slate-50/60 border-slate-150'
                  }`}>
                    <div className="flex items-start space-x-3 pr-2">
                      <Bell className={`w-4 h-4 mt-0.5 ${budgetWarnings ? 'text-[#355C4B]' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Budget Overrun Warnings</p>
                        <p className="text-[10px] text-slate-450 leading-tight">Deliver a real-time system notification if spending exceeds 95% of active limits.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBudgetWarnings(!budgetWarnings)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                        budgetWarnings ? 'bg-[#355C4B]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${budgetWarnings ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Savings Goals alerts */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    darkMode ? 'bg-slate-850/40 border-slate-800' : 'bg-slate-50/60 border-slate-150'
                  }`}>
                    <div className="flex items-start space-x-3 pr-2">
                      <Globe className={`w-4 h-4 mt-0.5 ${thresholdAlerts ? 'text-[#355C4B]' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Goal Completion Milestones</p>
                        <p className="text-[10px] text-slate-450 leading-tight">Log notifications inside the system alert vault immediately as goals are completed.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setThresholdAlerts(!thresholdAlerts)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                        thresholdAlerts ? 'bg-[#355C4B]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${thresholdAlerts ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                </div>
              </div>

            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#355C4B] hover:bg-[#274437] text-white text-xs font-bold rounded-xl transition-all font-display shadow active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Processing updates...' : 'Save Settings & Preferences'}
            </button>
          </form>

          {/* SECURE CREDENTIALS SETUP (PASSWORD / EMAIL) */}
          <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-display font-bold text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-[#D6A51D]" />
                <span>Security Credentials</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Protect your ledger data with state-of-the-art authentication. Security updates require a verified password-based login session.
              </p>
            </div>

            {isGoogleUser ? (
              <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-xs font-medium leading-relaxed">
                Google Authorized Client: This email session is managed of your verified Google Account. Password updates are managed on google.com security suite safely.
              </div>
            ) : (
              <form onSubmit={handleAuthCredentialsUpdate} className="space-y-4 pt-1">
                
                {/* Email Change */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Change Linked Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter new email address"
                      className={`w-full pl-9 pr-4 py-2.5 rounded-xl border focus:outline-none text-xs font-semibold focus:ring-1 focus:ring-[#355C4B] ${
                        darkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Password Change fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">New Secured Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className={`w-full pl-9 pr-4 py-2.5 rounded-xl border focus:outline-none text-xs font-semibold focus:ring-1 focus:ring-[#355C4B] ${
                          darkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className={`w-full pl-9 pr-4 py-2.5 rounded-xl border focus:outline-none text-xs font-semibold focus:ring-1 focus:ring-[#355C4B] ${
                          darkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>

                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={loading || (!newEmail && !newPassword)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 disabled:opacity-50"
                  >
                    Update Auth Credentials
                  </button>
                  
                  <button 
                    type="button"
                    onClick={async () => {
                      if (!profile?.email) return;
                      setLoading(true);
                      setError('');
                      setSuccess('');
                      try {
                        await sendPasswordResetEmail(auth, profile.email);
                        setSuccess('Password refresh instructions email has been dispatched successfully to ' + profile.email);
                      } catch (err: any) {
                        console.error(err);
                        setError(err.message || 'Could not dispatch password reset link.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold rounded-xl transition-all"
                  >
                    Dispatch Password Reset Email
                  </button>
                </div>

              </form>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
