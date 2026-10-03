import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { createOrUpdateProfile, getUserProfile } from '../dbHelper';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, X, Sparkles, TrendingUp, Fingerprint } from 'lucide-react';
import { safeStorage } from '../utils/storage';

interface LoginPageProps {
  onAuthSuccess: (uid: string) => void;
}

// Crisp Vector Google Icon
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" width="24" height="24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

// Pure premium dark green credit card matching the provided reference mockup exactly, wrapped for 3D tilting & float animation
const FintechHeaderIllustration = () => (
  <div className="card-wrapper select-none">
    {/* Floating fuzzy cast shadow */}
    <div className="card-shadow" />

    <div className="card-illustration relative">
      {/* Glossy card highlight */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/12 via-transparent to-transparent rounded-[14px] pointer-events-none" />
      
      {/* Top section: Chip & Brand circles */}
      <div className="flex justify-between items-start w-full">
        {/* Yellow Sim Card Chip */}
        <div className="w-[18px] sm:w-[26px] h-[13px] sm:h-[18px] bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 rounded p-[1px] flex flex-col justify-between">
          <div className="h-[0.5px] bg-amber-900/20 rounded" />
          <div className="flex justify-between">
            <div className="w-[3px] sm:w-[4px] h-[1px] bg-amber-900/20 rounded" />
            <div className="w-[3px] sm:w-[4px] h-[1px] bg-amber-900/20 rounded" />
          </div>
          <div className="h-[0.5px] bg-amber-900/20 rounded" />
        </div>
        
        {/* Brand circle overlapping logo */}
        <div className="flex -space-x-1 sm:-space-x-2">
          <div className="w-2.5 sm:w-[14px] h-2.5 sm:h-[14px] rounded-full bg-amber-500/95" />
          <div className="w-2.5 sm:w-[14px] h-2.5 sm:h-[14px] rounded-full bg-yellow-400/80 backdrop-blur-[1px]" />
        </div>
      </div>

      {/* Center: Card dots format */}
      <div className="text-[9px] sm:text-[12px] tracking-[0.2em] font-mono text-emerald-100/90 font-medium my-0.5 select-all text-left w-full">
        ••••  ••••  ••••  1234
      </div>

      {/* Footer: Holder & Validity info */}
      <div className="flex justify-between items-end text-[5px] sm:text-[7.5px] tracking-wider text-emerald-200/80 font-mono uppercase leading-none w-full">
        <div className="text-left">
          <span className="block text-[4px] sm:text-[5px] text-emerald-400/50 font-sans tracking-widest lowercase mb-[2px] font-medium leading-none">holder</span>
          <span className="font-semibold select-none leading-none">budgetbloom</span>
        </div>
        <div className="text-right">
          <span className="block text-[4px] sm:text-[5px] text-emerald-400/50 font-sans tracking-widest lowercase mb-[2px] font-medium leading-none">valid thru</span>
          <span className="font-semibold select-none leading-none">05/26</span>
        </div>
      </div>
    </div>
  </div>
);

// Fallback SavingsPiggy is set to show FintechHeaderIllustration to ensure consistent exact card rules and size across login and signup
const SavingsPiggyIllustration = () => <FintechHeaderIllustration />;

export default function LoginPage({ onAuthSuccess }: LoginPageProps) {
  const [viewMode, setViewMode] = useState<'login' | 'register'>('login');

  // Input states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // General states
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Reset Password Modal
  const [resetEmailModal, setResetEmailModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [providerError, setProviderError] = useState<{ provider: 'Email/Password' | 'Google' } | null>(null);

  const showToastMsg = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
      const ensureUserProfile = async (user: any, fallbackName?: string) => {
    const existingProfile = await getUserProfile(user.uid);

    const authName = user.displayName || fallbackName || '';
    const authEmail = user.email || '';

    if (!existingProfile) {
      await createOrUpdateProfile(user.uid, {
        uid: user.uid,
        email: authEmail,
        displayName: authName || 'BudgetBloom Member',
        name: authName || 'BudgetBloom Member',
        photoURL: user.photoURL || '',
        currency: 'INR',
        theme: 'light',
        createdAt: new Date().toISOString()
      } as any);

      return;
    }

    // Keep existing profile data, but make sure basic Auth information exists.
    await createOrUpdateProfile(user.uid, {
      uid: user.uid,
      email: existingProfile.email || authEmail,
      displayName: existingProfile.displayName || authName || 'BudgetBloom Member',
      name: existingProfile.name || authName || 'BudgetBloom Member',
      photoURL: existingProfile.photoURL || user.photoURL || ''
    } as any);
  };
  // Read saved email if Remember Me was selected earlier
  useEffect(() => {
    const savedEmail = safeStorage.getItem('budgetbloom_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Premium simulation of biometric authentication
  const handleBiometricLogin = () => {
    showToastMsg('Biometric sensor activated. Please place your finger on the sensor.', 'success');
  };

// Google SSO Auth
const handleGoogleAuth = async (e: React.MouseEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const googleEmail = (user.email || '').toLowerCase();

    if (!googleEmail) {
      await auth.signOut();
      showToastMsg('Unable to get your Google email address.', 'error');
      return;
    }

    console.log('[Google Auth Debug] Google User UID:', user.uid);
    console.log('[Google Auth Debug] Google User Email:', googleEmail);

    // Check whether a BudgetBloom account already exists
    const emailDoc = await getDoc(
      doc(db, 'registered_emails', googleEmail)
    );

    const accountExists = emailDoc.exists();

    // GOOGLE SIGN-UP
    if (viewMode === 'register') {
      if (accountExists) {
        await auth.signOut();

        showToastMsg(
          'An account already exists with this email. Please log in instead.',
          'error'
        );

        return;
      }

      // Create BudgetBloom profile from Google account information
      await ensureUserProfile(user);

      await setDoc(
        doc(db, 'registered_emails', googleEmail),
        {
          uid: user.uid,
          registered: true
        },
        { merge: true }
      );

      showToastMsg('Account created successfully!', 'success');
      onAuthSuccess(user.uid);
      return;
    }

    // GOOGLE LOGIN
    if (!accountExists) {
      await auth.signOut();

      showToastMsg(
        'No account found with this email. Please sign up first.',
        'error'
      );

      return;
    }

    // Automatically populate/complete profile from Google account
    await ensureUserProfile(user);

    await setDoc(
      doc(db, 'registered_emails', googleEmail),
      {
        uid: user.uid,
        registered: true
      },
      { merge: true }
    );

    showToastMsg('Welcome back!', 'success');
    onAuthSuccess(user.uid);

  } catch (err: any) {
    console.error(
      '[Google Auth Error] Full error stack:',
      err.stack || err
    );

    let msg = 'Google Sign-In failed. Please try again.';

    if (
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request'
    ) {
      msg = 'Google Sign-In cancelled.';
    } else if (err.code === 'auth/network-request-failed') {
      msg = 'Network error. Please check your connection.';
    }

    showToastMsg(msg, 'error');

  } finally {
    setLoading(false);
  }
};

  // Credentials sign in manual login

const handleLoginSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const trimmedEmail = email.trim();
  const trimmedPassword = password;

  if (!trimmedEmail || !trimmedPassword) {
    showToastMsg('Please enter email and password.', 'error');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmedEmail)) {
    showToastMsg('Please enter a valid email address.', 'error');
    return;
  }

  if (trimmedPassword.length < 6) {
    showToastMsg('Password must be at least 6 characters.', 'error');
    return;
  }

  setLoading(true);

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      trimmedEmail,
      trimmedPassword
    );

    if (rememberMe) {
      safeStorage.setItem(
        'budgetbloom_remembered_email',
        trimmedEmail
      );
    } else {
      safeStorage.removeItem('budgetbloom_remembered_email');
    }

    // Make sure the user's BudgetBloom profile exists
    await ensureUserProfile(result.user);

    try {
      await setDoc(
        doc(db, 'registered_emails', trimmedEmail.toLowerCase()),
        {
          uid: result.user.uid,
          registered: true
        },
        { merge: true }
      );
    } catch (dbErr) {
      console.warn('Failed to save to registered_emails:', dbErr);
    }

    showToastMsg('Welcome back!', 'success');
    onAuthSuccess(result.user.uid);

  } catch (err: any) {
    console.error(err);

    let userExistsInDb = true;

    try {
      const emailDoc = await getDoc(
        doc(db, 'registered_emails', trimmedEmail.toLowerCase())
      );

      userExistsInDb = emailDoc.exists();

    } catch (dbErr) {
      console.warn('Failed to verify registered_emails:', dbErr);
    }

    let msg = 'Invalid email or wrong password.';

    if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';

    } else if (err.code === 'auth/user-not-found') {
      msg = 'Account not found. Please create an account first.';

    } else if (err.code === 'auth/wrong-password') {
      msg = 'Incorrect password. Please try again.';

    } else if (err.code === 'auth/invalid-credential') {
      if (!userExistsInDb) {
        msg = 'Account not found. Please create an account first.';
      } else {
        msg = 'Incorrect password. Please try again.';
      }

    } else if (err.code === 'auth/operation-not-allowed') {
      msg = 'Email/Password sign-in is not enabled in Firebase Console.';
      setProviderError({ provider: 'Email/Password' });

    } else if (err.code === 'auth/network-request-failed') {
      msg = 'Network error. Please check your connection.';
    }

    showToastMsg(msg, 'error');

  } finally {
    setLoading(false);
  }
};
  
  // Credentials signup manual

const handleRegisterSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();
  const trimmedPassword = password;
  const trimmedConfirmPassword = confirmPassword;

  if (!trimmedName) {
    showToastMsg('Please enter your full name.', 'error');
    return;
  }

  if (!trimmedEmail || !trimmedPassword || !trimmedConfirmPassword) {
    showToastMsg('Please fill in all registration fields.', 'error');
    return;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmedEmail)) {
    showToastMsg('Please enter a valid email address.', 'error');
    return;
  }

  if (trimmedPassword !== trimmedConfirmPassword) {
    showToastMsg('Passwords do not match.', 'error');
    return;
  }

  if (trimmedPassword.length < 6) {
    showToastMsg('Password must be at least 6 characters.', 'error');
    return;
  }

  setLoading(true);

  try {
    const normalizedEmail = trimmedEmail.toLowerCase();

    // Check if a BudgetBloom account already exists
    const existingEmailDoc = await getDoc(
      doc(db, 'registered_emails', normalizedEmail)
    );

    if (existingEmailDoc.exists()) {
      showToastMsg(
        'An account already exists with this email. Please log in instead.',
        'error'
      );
      return;
    }

    // Create Firebase Authentication account
    const result = await createUserWithEmailAndPassword(
      auth,
      trimmedEmail,
      trimmedPassword
    );

    const user = result.user;

    // Create BudgetBloom profile using signup information
    await createOrUpdateProfile(user.uid, {
      uid: user.uid,
      email: user.email || trimmedEmail,
      displayName: trimmedName,
      name: trimmedName,
      photoURL: user.photoURL || '',
      currency: 'INR',
      theme: 'light',
      createdAt: new Date().toISOString()
    } as any);

    // Register email address
    try {
      await setDoc(
        doc(db, 'registered_emails', normalizedEmail),
        {
          uid: user.uid,
          registered: true
        }
      );
    } catch (dbErr) {
      console.warn('Failed to write to registered_emails:', dbErr);
    }

    showToastMsg('Account created successfully!', 'success');
    onAuthSuccess(user.uid);

  } catch (err: any) {
    console.error(err);

    let msg = 'Registration failed.';

    if (err.code === 'auth/email-already-in-use') {
      msg =
        'An account already exists with this email. Please log in instead.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    } else if (err.code === 'auth/weak-password') {
      msg = 'Password is too weak. Must be at least 6 characters.';
    } else if (err.code === 'auth/operation-not-allowed') {
      msg =
        'Email/Password sign-up is not enabled in Firebase Console.';
      setProviderError({ provider: 'Email/Password' });
    } else if (err.code === 'auth/network-request-failed') {
      msg = 'Network error. Please check your connection.';
    }

    showToastMsg(msg, 'error');

  } finally {
    setLoading(false);
  }
};
  // Password reset submit
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
      showToastMsg('Please enter your email.', 'error');
      return;
    }

    // Email format validation (standard regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showToastMsg('Invalid email address.', 'error');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      showToastMsg('Password reset link sent! Check your inbox.', 'success');
      setResetEmailModal(false);
    } catch (err: any) {
      console.error(err);
      let msg = 'Unable to send recovery email.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No account matches this email.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network error. Please check your connection.';
      }
      showToastMsg(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page select-none overflow-hidden relative w-screen h-screen">
      
      {/* Layer 2: Translucent Sweeping Waves */}
      <div className="liquid-wave liquid-wave-1"></div>
      <div className="liquid-wave liquid-wave-2"></div>
      <div className="liquid-wave liquid-wave-3"></div>
      <div className="liquid-wave liquid-wave-4"></div>
      
      {/* Layer 3: Soft Blurred Green Overlays */}
      <div className="blurred-overlay blurred-overlay-1"></div>
      <div className="blurred-overlay blurred-overlay-2"></div>
      
      {/* Layer 4: Subtle Radial Glow behind the login card */}
      <div className="bg-radial-card-glow"></div>
      
      {/* Toast Alert message notifications */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 max-w-sm p-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-fade-in flex items-center space-x-3 duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className={`p-1 rounded-full ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Main Container Card (centered, styled via index.css rules) */}
      <div id="auth-main-card" className={`auth-card relative ${viewMode === 'register' ? 'register-card' : ''}`}>
        
        {/* FINANCE ILLUSTRATION (ONLY SHOWN IN LOGIN OR CUSTOM SVG GRAPHIC FOR RICH FIDELITY) */}
        {viewMode === 'login' ? <FintechHeaderIllustration /> : <SavingsPiggyIllustration />}

        {/* LOGO (BudgetBloom - with small green growth logo next to brand name) */}
        <div className="flex items-center space-x-1.5 select-none animate-fade-in logo-row">
          <TrendingUp className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
          <span className="text-lg font-bold tracking-tight text-[#0E3E26] font-display">
            Budget<span className="text-[#E59500]">Bloom</span>
          </span>
        </div>

        {/* HEADINGS */}
        <div className="text-center px-4 w-full">
          <h1 className="auth-title font-bold text-slate-800 font-display tracking-tight mt-0.5">
            {viewMode === 'login' ? (
              <span>Welcome <span className="text-[#E59500]">Back</span></span>
            ) : (
              <span>Create <span className="text-[#E59500]">Account</span></span>
            )}
          </h1>
          <p className="auth-subtitle text-slate-500 font-medium leading-relaxed">
            Secure your financial freedom and track savings
          </p>
        </div>

        {/* DYNAMIC FORM */}
        <div className="w-full">
          {viewMode === 'login' ? (
            /* ==================== LOGIN FORM ==================== */
            <form onSubmit={handleLoginSubmit} className="w-full">
              
              {/* Email Address Input */}
              <div className="form-group flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1 select-none">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="input-box w-full bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-[#0E3E26] focus:ring-4 focus:ring-[#0E3E26]/5 rounded-xl px-4 pl-12 text-sm outline-none transition-all font-medium"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="form-group flex flex-col space-y-1">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (email) setResetEmail(email);
                      setResetEmailModal(true);
                    }}
                    className="text-[10px] font-bold text-[#E59500] hover:text-[#c47e00] transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-box w-full bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-[#0E3E26] focus:ring-4 focus:ring-[#0E3E26]/5 rounded-xl px-4 pl-12 pr-12 text-sm outline-none transition-all font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Toggle */}
              <div className="remember-row flex items-center pl-1">
                <label className="flex items-center cursor-pointer space-x-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-[#0E3E26] focus:ring-[#0E3E26]/20 w-3.5 h-3.5 border-slate-300 pointer-events-auto accent-[#0E3E26]"
                  />
                  <span className="text-[11px] text-slate-500 font-semibold select-none">Remember my email</span>
                </label>
              </div>

              {/* Solid Orange Login Submit Button with slightly rounded corners (rounded-xl) */}
              <button
                type="submit"
                disabled={loading}
                className="login-button w-full relative bg-[#E59500] hover:bg-[#d48400] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:shadow-md active:scale-[0.99] transition-all flex items-center justify-center text-center font-display cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>LOG IN</span>
                )}
              </button>

            </form>
          ) : (
            /* ==================== REGISTER FORM ==================== */
            <form onSubmit={handleRegisterSubmit} className="w-full">
              
              {/* Full Name Input */}
              <div className="form-group flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1 select-none">
                  FULL NAME
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="input-box w-full bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-[#0E3E26] focus:ring-4 focus:ring-[#0E3E26]/5 rounded-xl px-4 pl-12 text-sm outline-none transition-all font-medium"
                    required
                  />
                </div>
              </div>

              {/* Email Address Input */}
              <div className="form-group flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1 select-none">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                    <Mail className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="input-box w-full bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-[#0E3E26] focus:ring-4 focus:ring-[#0E3E26]/5 rounded-xl px-4 pl-12 text-sm outline-none transition-all font-medium"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="form-group flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1 select-none">
                  PASSWORD
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="input-box w-full bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-[#0E3E26] focus:ring-4 focus:ring-[#0E3E26]/5 rounded-xl px-4 pl-12 pr-12 text-sm outline-none transition-all font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="form-group flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1 select-none">
                  CONFIRM PASSWORD
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                     <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="input-box w-full bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-[#0E3E26] focus:ring-4 focus:ring-[#0E3E26]/5 rounded-xl px-4 pl-12 pr-12 text-sm outline-none transition-all font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600"
                    id="toggle-confirm-password-btn"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Solid Orange Create Account Submit Button with slightly rounded corners (rounded-xl) */}
              <button
                type="submit"
                disabled={loading}
                className="login-button w-full relative bg-[#E59500] hover:bg-[#d48400] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:shadow-md active:scale-[0.99] transition-all flex items-center justify-center text-center font-display cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>CREATE ACCOUNT</span>
                )}
              </button>

            </form>
          )}

          {/* Spacer "or continue with" (clean matching line styles) */}
          <div className="divider relative flex items-center select-none text-slate-400">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Or Continue With</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* GOOGLE SIGN IN & FINGERPRINT BUTTON CONTAINER */}
          <div className="flex flex-col min-[360px]:flex-row items-center justify-center gap-2.5 max-w-[380px] w-full mx-auto">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="google-button flex-grow w-full min-[360px]:w-auto bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 hover:scale-[1.02] active:scale-[0.99] hover:shadow-md text-slate-700 font-bold text-sm rounded-[16px] transition-all duration-200 shadow-sm flex items-center justify-center text-center font-display cursor-pointer"
              style={{ height: '50px' }}
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>
            <button
              type="button"
              onClick={handleBiometricLogin}
              title="Biometric Login"
              className="flex items-center justify-center h-[50px] w-[50px] bg-white border border-slate-200 hover:border-slate-300 rounded-[16px] text-emerald-600 hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.99] hover:shadow-md transition-all duration-200 shadow-sm cursor-pointer shrink-0"
              id="biometric-indicator"
            >
              <Fingerprint className="w-5 h-5 text-emerald-600" />
            </button>
          </div>

          {/* TOGGLE VIEW MODE SWITCH LINK */}
          <div className="bottom-link text-center text-xs font-semibold select-none text-slate-500">
            {viewMode === 'login' ? (
              <span>
                New to BudgetBloom?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('register');
                    setFullName('');
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-[#0E3E26] hover:text-[#0C301D] font-bold underline cursor-pointer pl-1"
                >
                  Create Account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setFullName('');
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-[#0E3E26] hover:text-[#0C301D] font-bold underline cursor-pointer pl-1"
                >
                  Log In
                </button>
              </span>
            )}
          </div>

        </div>

      </div>

      {/* Password Recovery Modal overlay (clean custom dialog) */}
      {resetEmailModal && (
        <div id="reset-modal" className="fixed inset-0 bg-[#021F13]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-350">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-6 sm:p-8 shadow-2xl relative border border-emerald-100/30 animate-fade-in font-display">
            <button
              onClick={() => setResetEmailModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-5">
              <div className="text-center">
                <div className="inline-flex p-3 rounded-2xl bg-amber-50 text-amber-500 mb-2">
                  <TrendingUp className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 font-display">Reset Password</h3>
                <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">
                  Enter your registered email address below, and we'll send you an encrypted link to retrieve password access to your account.
                </p>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="flex flex-col space-y-1">
                  <label htmlFor="reset-email" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
                    Your Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                      <Mail className="w-5 h-5" />
                    </span>
                    <input
                      type="email"
                      id="reset-email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-2xl py-3 px-4 pl-11 text-sm outline-none focus:ring-4 focus:ring-[#0E3E26]/5 focus:border-[#0E3E26] transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetEmailModal(false)}
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-[#0E3E26] to-[#1C5E40] text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center text-center"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span>Send Recovery Link</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Auth Provider Setup Guide Modal */}
      {providerError && (
        <div id="provider-error-modal" className="fixed inset-0 bg-[#021F13]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-350">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-6 sm:p-8 shadow-2xl relative border border-emerald-100/30 animate-fade-in font-display">
            <button
              onClick={() => setProviderError(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-5">
              <div className="text-center">
                <div className="inline-flex p-3 rounded-2xl bg-amber-50 text-amber-500 mb-2">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 font-display">{providerError.provider} Sign-In Required</h3>
                <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">
                  This auth provider is currently not enabled in your Firebase project. To allow authentication, please enable it in your Firebase Console.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2.5">
                <p className="text-xs font-bold text-slate-700">How to fix this:</p>
                <ol className="text-xs text-slate-600 list-decimal pl-4 space-y-1.5 font-medium">
                  <li>Open the <span className="font-bold">Firebase Console</span> for your project.</li>
                  <li>In the left sidebar, navigate to <span className="font-bold">Build &gt; Authentication</span>.</li>
                  <li>Click on the <span className="font-bold">Sign-in method</span> tab.</li>
                  <li>Click <span className="font-bold">Add new provider</span> (or select edit), choose <span className="font-bold">{providerError.provider}</span>, and toggle it to <span className="font-bold">Enabled</span>.</li>
                  <li>Save changes and try logging in/signing up again.</li>
                </ol>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProviderError(null)}
                  className="flex-grow bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl transition-all"
                >
                  Close
                </button>
                <a
                  href="https://console.firebase.google.com/project/trans-bruin-c8gvj/authentication/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-grow bg-[#E59500] hover:bg-[#d48400] text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md active:scale-[0.99] transition-all flex items-center justify-center text-center cursor-pointer"
                >
                  Open Firebase Console
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
