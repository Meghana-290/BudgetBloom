import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { createOrUpdateProfile } from '../dbHelper';
import { safeStorage } from '../utils/storage';
import { 
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  TrendingUp,
  CheckCircle,
  PiggyBank,
  ArrowUpRight,
  Fingerprint
} from 'lucide-react';

interface LandingProps {
  onAuthSuccess: (uid: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export default function Landing({ onAuthSuccess, darkMode, setDarkMode }: LandingProps) {
  // Auth view states: 'login' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Read saved email if Remember Me was checked previously
  useEffect(() => {
    const savedEmail = safeStorage.getItem('budgetbloom_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Save profile metadata
      await createOrUpdateProfile(user.uid, {
        email: user.email || '',
        displayName: user.displayName || 'BudgetBloom Member',
        photoURL: user.photoURL,
        currency: 'INR',
        theme: darkMode ? 'dark' : 'light'
      });

      showToast('Welcome to BudgetBloom!', 'success');
      onAuthSuccess(user.uid);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Auth failed. Try allowing popups.');
      showToast('Google login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (authMode === 'login') {
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        
        // Remember me logic
        if (rememberMe) {
          safeStorage.setItem('budgetbloom_remembered_email', email);
        } else {
          safeStorage.removeItem('budgetbloom_remembered_email');
        }

        showToast('Welcome back to BudgetBloom!', 'success');
        onAuthSuccess(result.user.uid);
      } catch (err: any) {
        console.error(err);
        let msg = 'Invalid credentials. Please verify your email and password.';
        if (err.code === 'auth/user-not-found') msg = 'No account associated with this email.';
        if (err.code === 'auth/wrong-password') msg = 'Incorrect password. Try again.';
        if (err.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password sign-in is not enabled in your Firebase console. Please go to your Firebase Console -> Authentication -> Sign-in Method, and enable standard "Email/Password" login first.';
        }
        setError(msg);
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    } else if (authMode === 'register') {
      if (!displayName.trim()) {
        setError('Please enter your full name.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }

      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        // Remember me logic
        if (rememberMe) {
          safeStorage.setItem('budgetbloom_remembered_email', email);
        }

        await createOrUpdateProfile(user.uid, {
          email: user.email || '',
          displayName: displayName,
          currency: 'INR',
          theme: 'light'
        });

        showToast('Account registered successfully!', 'success');
        onAuthSuccess(user.uid);
      } catch (err: any) {
        console.error(err);
        let msg = 'Registration failed. Try another email.';
        if (err.code === 'auth/email-already-in-use') msg = 'This email is already in use.';
        if (err.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password accounts are not enabled in your Firebase console. Please go to Firebase Console -> Authentication -> Sign-in Method, and enable "Email/Password" to register standard credentials.';
        }
        setError(msg);
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    } else if (authMode === 'forgot') {
      try {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Password reset link has been dispatched to your email address!');
        showToast('Reset email sent!', 'success');
      } catch (err: any) {
        console.error(err);
        let msg = 'Unable to send recovery email. Please check your address.';
        if (err.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password authentication is disabled in your Firebase console. Go to Firebase Console -> Authentication -> Sign-in Method, and enable "Email/Password" to use standard account features.';
        }
        setError(msg);
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className={`h-screen w-full lg:h-screen overflow-hidden flex transition-colors duration-300 ${
      darkMode ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'
    }`}>
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[99] max-w-xs p-3 rounded-xl shadow-lg border animate-fade-in flex items-center space-x-2 backdrop-blur-md ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-650 dark:text-rose-400'
        }`}>
          <div className={`p-1 rounded-full ${notification.type === 'success' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
            <CheckCircle className="w-3.5 h-3.5" />
          </div>
          <p className="text-[11px] font-semibold">{notification.message}</p>
        </div>
      )}

      {/* LEFT PANEL: Illustration / Brand Section for Desktop */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-tr from-[#0F172A] via-[#15203B] to-[#1E293B] relative items-center justify-center p-8 overflow-hidden border-r border-slate-800">
        
        {/* Abstract Glowing Aura Circles */}
        <div className="absolute top-1/4 -left-12 w-80 h-80 rounded-full bg-[#00B894]/5 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 -right-12 w-80 h-80 rounded-full bg-[#38BDF8]/5 blur-[100px] pointer-events-none"></div>
        
        <div className="relative text-center max-w-md z-10 space-y-5 flex flex-col items-center">
          
          {/* Aesthetic Theme Switcher inside Landing */}
          <button 
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="absolute -top-10 right-0 p-2 rounded-full bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            title="Toggle theme view"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Cute Blooming Coin Jar Illustration (exactly 180-220px container size to prevent desktop scroll) */}
          <div className="relative w-52 h-52 flex items-center justify-center">
            
            {/* Background floating sparkle elements */}
            <div className="absolute top-3 left-6 animate-pulse text-[#38BDF8] opacity-60">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="absolute bottom-6 right-6 animate-pulse text-[#00B894] opacity-50">
              <Sparkles className="w-4.5 h-4.5" />
            </div>

            {/* Glowing background halo */}
            <div className="absolute inset-4 rounded-full bg-[#00B894]/5 border border-[#00B894]/10 animate-ping" style={{ animationDuration: '4s' }}></div>

            {/* Main Sticker Jar graphic - Reduced by 35-40% */}
            <div className="w-28 h-32 bg-slate-800/40 rounded-2xl border border-white/10 relative flex flex-col items-center justify-end pb-3 pt-6 shadow-2xl backdrop-blur-md">
              
              {/* Glass reflection effect */}
              <div className="absolute inset-y-0 left-3 w-2.5 bg-white/5 skew-x-12 rounded-full"></div>

              {/* Plant Leaves Blooming from Jar */}
              <div className="absolute -top-9 flex flex-col items-center">
                
                {/* Upper leaves */}
                <div className="flex space-x-0.5">
                  <div className="w-5 h-8 bg-emerald-400 rounded-tr-2xl rounded-bl-2xl transform rotate-12 shadow-md shadow-emerald-500/15"></div>
                  <div className="w-5 h-8 bg-[#00B894] rounded-tl-2xl rounded-br-2xl transform -rotate-12 shadow-md shadow-emerald-500/15"></div>
                </div>

                {/* Main stem with glowing money flower center */}
                <div className="w-1.5 h-10 bg-emerald-500/85 rounded-full relative -mt-1.5">
                {/* Blooming coins growing like leaves */}
                <div className="absolute top-1 -left-4 w-3.5 h-3.5 rounded-full bg-amber-400 border border-white/10 flex items-center justify-center font-bold text-[8px] text-slate-900 shadow">
                  ₹
                </div>
                <div className="absolute top-4 -right-4 w-3.5 h-3.5 rounded-full bg-amber-400 border border-white/10 flex items-center justify-center font-bold text-[8px] text-slate-900 shadow">
                  ₹
                </div>
              </div>
            </div>

            {/* Seeded Coins Inside and Piling Up inside jar */}
            <div className="w-22 bg-slate-700/30 rounded-xl p-1.5 border border-white/5 space-y-1 mt-1">
              <div className="flex justify-center -space-x-1">
                <div className="w-5 h-5 rounded-full bg-amber-400/95 flex items-center justify-center text-[9px] font-bold text-slate-900 shadow border border-amber-300">
                  ₹
                </div>
                <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[9px] font-bold text-slate-900 shadow border border-amber-400">
                  ₹
                </div>
              </div>
                <div className="w-full bg-[#00B894]/20 border border-[#00B894]/30 rounded-full h-1 flex items-center">
                  <div className="bg-[#00B894] w-2/3 h-0.5 rounded-full animate-pulse"></div>
                </div>
              </div>

            </div>

            {/* Float Metric Card 1 (Income flow sticker) */}
            <div className="absolute top-3 -right-2 p-1.5 rounded-xl bg-slate-900/95 border border-white/10 shadow-xl flex items-center space-x-1.5 transform hover:scale-105 transition-transform duration-300">
              <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-[#22C55E]" />
              </div>
              <div className="text-left">
                <p className="text-[7px] text-slate-405 font-bold uppercase tracking-wider">Salary Flow</p>
                <p className="text-[10px] font-bold text-white">+₹45K</p>
              </div>
            </div>

            {/* Float Metric Card 2 (Savings goals sticked to left, reduced piggy bank size by 40%) */}
            <div className="absolute bottom-4 -left-4 p-1.5 rounded-xl bg-slate-900/95 border border-white/10 shadow-xl flex items-center space-x-1.5 transform hover:scale-105 transition-transform duration-300">
              <div className="w-5 h-5 rounded bg-sky-500/10 flex items-center justify-center">
                <PiggyBank className="w-3 h-3 text-[#38BDF8]" />
              </div>
              <div className="text-left">
                <p className="text-[7px] text-slate-405 font-bold uppercase tracking-wider">Goal Bloom</p>
                <p className="text-[10px] font-bold text-sky-400">82% Ach.</p>
              </div>
            </div>

          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold font-display tracking-tight text-white">
              Cultivate Your Financial Freedom
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Watch your goals bloom with real-time analytics, automated budget ceilings, and secure cloud tracking.
            </p>
          </div>

          <div className="flex items-center space-x-4 text-[10px] text-slate-500 pt-3 border-t border-slate-805/50 w-full justify-center">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Cloud Firestore Active</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <Fingerprint className="w-3.5 h-3.5 text-sky-500 animate-pulse" />
              <span>Two-Factor Auth</span>
            </span>
          </div>

        </div>
      </div>

      {/* RIGHT PANEL: Login / Register / Forgot Password forms (Centered vertically/horizontally, 100vh, zero scrolling) */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center py-4 px-6 lg:p-8 self-center h-full relative overflow-y-auto lg:overflow-hidden select-none">
        
        {/* Absolute header toggle inside right panel for mobile view only */}
        <div className="lg:hidden absolute top-4 right-4">
          <button 
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400 transition-colors"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Form Container Wrapper - Compact margins */}
        <div className="w-full max-w-sm space-y-4">
          
          {/* Logo Section */}
          <div className="flex flex-col items-center text-center space-y-1">
            <div className="w-10 h-10 rounded-xl bg-[#00B894] flex items-center justify-center shadow-md shadow-[#00B894]/15 transform hover:scale-105 transition-transform">
              <Sparkles className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <span className="font-display font-extrabold text-xl tracking-tight text-[#0F172A] dark:text-white">
                Budget<span className="text-[#00B894]">Bloom</span>
              </span>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                {authMode === 'login' && 'Your professional personal finance workspace'}
                {authMode === 'register' && 'Cultivate real-time fiscal clarity'}
                {authMode === 'forgot' && 'Reset your secure login passcode'}
              </p>
            </div>
          </div>

          {/* Form Card - Reduced height, padding and spacings */}
          <div className={`p-5 sm:px-6 sm:py-5 rounded-2xl border shadow-lg ${
            darkMode 
              ? 'bg-[#1E293B] border-slate-700/60 text-white' 
              : 'bg-white border-slate-100 text-slate-800'
          }`}>
            
            <h3 className="font-display font-bold text-sm sm:text-base dark:text-white mb-3 text-center">
              {authMode === 'login' && 'Sign In to Account'}
              {authMode === 'register' && 'Create Your Free Account'}
              {authMode === 'forgot' && 'Reset Vault Password'}
            </h3>

            {error && (
              <div className="p-2 px-3 mb-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-semibold text-center leading-relaxed">
                {error}
              </div>
            )}

            {success && (
              <div className="p-2 px-3 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-semibold text-center leading-relaxed">
                {success}
              </div>
            )}

            <form onSubmit={handleCredentialAuth} className="space-y-3">
              
              {/* Full Name field for Sign Up */}
              {authMode === 'register' && (
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Jane Doe"
                      className={`w-full py-2 px-3 pl-9 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00B894]/40 text-xs transition-all ${
                        darkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                      required
                      id="register-input-name"
                    />
                    <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={`w-full py-2 px-3 pl-9 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00B894]/40 text-xs transition-all ${
                      darkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    required
                    id="auth-input-email"
                  />
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Password Fields */}
              {authMode !== 'forgot' && (
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Password</label>
                    {authMode === 'login' && (
                      <button 
                        type="button" 
                        onClick={() => setAuthMode('forgot')}
                        className="text-[10.5px] text-[#00B894] hover:underline font-bold"
                        id="forgot-password-link"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full py-2 px-3 pl-9 pr-9 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00B894]/40 text-xs transition-all ${
                        darkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                      required
                      id="auth-input-password"
                    />
                    <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password Confirmation field for Sign Up */}
              {authMode === 'register' && (
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full py-2 px-3 pl-9 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00B894]/40 text-xs transition-all ${
                        darkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                      required
                      id="register-input-confirm"
                    />
                    <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              )}

              {/* Remember Me functionality */}
              {authMode !== 'forgot' && (
                <div className="flex items-center space-x-2 py-0.5">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#00B894] focus:ring-[#00B894]/30 w-3.5 h-3.5 accent-[#00B894] cursor-pointer"
                    id="remember-me"
                  />
                  <span className="text-[11px] font-medium text-slate-400 select-none cursor-pointer">Remember my credentials</span>
                </div>
              )}

              {/* Submit trigger button (Shorter height) */}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-1.5 p-2 sm:p-2.5 rounded-xl bg-[#00B894] hover:bg-[#00a383] text-white text-[11px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-60"
                id="auth-submit"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>
                      {authMode === 'login' && 'Log In to Workspace'}
                      {authMode === 'register' && 'Register For Free'}
                      {authMode === 'forgot' && 'Transmit Passcode Reset'}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

            </form>

            {/* Google Authentication Segment */}
            {authMode !== 'forgot' && (
              <div className="mt-3.5 flex flex-col space-y-2.5">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-[9px] uppercase font-bold tracking-wider">
                    <span className={`px-2 inline-block ${
                      darkMode ? 'bg-[#1E293B] text-slate-450' : 'bg-white text-slate-400'
                    }`}>
                      Or Authenticate With
                    </span>
                  </div>
                </div>

                <button 
                  onClick={handleGoogleAuth}
                  className={`w-full p-2 text-[11px] font-bold uppercase tracking-wider border rounded-xl flex items-center justify-center space-x-2 hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors cursor-pointer ${
                    darkMode ? 'border-slate-700 text-slate-350' : 'border-slate-200 text-slate-600'
                  }`}
                  id="auth-google"
                >
                  <svg className="w-3.5 h-3.5 mr-0.5" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.66 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99C6.18 7.42 8.87 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.45c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.38-4.88 3.38-8.5z" />
                    <path fill="#FBBC05" d="M5.24 14.73c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.39 7.56C.5 9.35 0 11.33 0 13.43c0 2.1.5 4.08 1.39 5.87l3.85-2.99-1.28-1.58z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.67-2.3 1.07-3.9 1.07-3.13 0-5.82-2.38-6.76-5.51L1.39 16.3C3.37 20.19 7.35 23 12 23z" />
                  </svg>
                  <span>Google SSO Account</span>
                </button>
              </div>
            )}

            {/* Form Mode Toggle Footer */}
            <div className="mt-3.5 text-center text-[11px] font-semibold">
              {authMode === 'login' && (
                <p className="text-slate-400">
                  New to BudgetBloom?{' '}
                  <button onClick={() => setAuthMode('register')} className="text-[#00B894] hover:underline font-bold" id="create-account-link">
                    Create instant account
                  </button>
                </p>
              )}
              {authMode === 'register' && (
                <p className="text-slate-400">
                  Already have a workspace?{' '}
                  <button onClick={() => setAuthMode('login')} className="text-[#00B894] hover:underline font-bold" id="already-have-account-link">
                    Log in here
                  </button>
                </p>
              )}
              {authMode === 'forgot' && (
                <p className="text-slate-400">
                  Recognize password credentials?{' '}
                  <button onClick={() => setAuthMode('login')} className="text-[#00B894] hover:underline font-bold">
                    Return to login
                  </button>
                </p>
              )}
            </div>

          </div>

          {/* Footer credentials copy */}
          <p className="text-center text-[10px] font-medium text-slate-400/90 leading-relaxed font-mono">
            Protected with standard SSL-secured cloud storage. <br />
            © 2026 BudgetBloom Inc. All privacy reserved.
          </p>

        </div>
      </div>

    </div>
  );
}
