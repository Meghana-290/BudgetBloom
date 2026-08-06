import React, { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import PasswordInput from './PasswordInput';
import { safeStorage } from '../utils/storage';

interface LoginFormProps {
  onSubmit: (email: string, password: string, rememberMe: boolean) => void;
  onForgotPassword: (email: string) => void;
  loading?: boolean;
}

export default function LoginForm({ onSubmit, onForgotPassword, loading = false }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Read saved email if Remember Me was selected earlier
  useEffect(() => {
    const savedEmail = safeStorage.getItem('budgetbloom_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onSubmit(email, password, rememberMe);
    }
  };

  const handleForgotClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onForgotPassword(email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full">
      {/* Email Address Field */}
      <div className="flex flex-col space-y-1.5 text-left w-full">
        <label htmlFor="login-email" className="text-sm font-semibold text-[#1F2933] pl-1">
          Email Address
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 flex items-center justify-center">
            <Mail className="w-5 h-5 text-[#355C4B]" />
          </span>
          <input
            type="email"
            id="login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="w-full bg-[#F3F7F5] text-[#1F2933] font-medium placeholder-slate-400 border border-[#E1EAE5] rounded-[18px] py-3.5 pl-12 pr-4 text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-[#00B894]/20 focus:border-[#00B894]"
          />
        </div>
      </div>

      {/* Password Field */}
      <PasswordInput
        value={password}
        onChange={setPassword}
        placeholder="Enter your password"
        label="Password"
        id="login-password"
      />

      {/* Remember Me & Forgot Password Row */}
      <div className="flex items-center justify-between text-xs py-1 select-none">
        <label className="flex items-center space-x-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-5 h-5 rounded border-[#C3D4CB] text-[#00B894] focus:ring-[#00B894]/20 accent-[#00B894] cursor-pointer"
          />
          <span className="text-sm font-medium text-[#4A5D55]">Remember me</span>
        </label>
        <button
          type="button"
          onClick={handleForgotClick}
          className="text-sm font-bold text-[#00B894] hover:text-[#00a383] transition-colors focus:outline-none"
        >
          Forgot Password?
        </button>
      </div>

      {/* Login Button with Premium Gold/Yellow Metallic Gradient */}
      <button
        type="submit"
        disabled={loading}
        className="w-full relative mt-2 bg-gradient-to-r from-[#DFAC22] via-[#EBC13D] to-[#D59E15] hover:brightness-105 active:scale-[0.98] text-white font-bold text-base rounded-[18px] py-3.5 shadow-lg shadow-amber-500/10 hover:shadow-xl hover:shadow-amber-500/20 transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <span>Login</span>
        )}
      </button>
    </form>
  );
}
