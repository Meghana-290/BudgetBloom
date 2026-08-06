import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  required?: boolean;
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = "Enter your password",
  label = "Password",
  id = "password-input",
  required = true,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col space-y-1.5 text-left w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-[#1F2933] pl-1">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 flex items-center justify-center">
          <Lock className="w-5 h-5 text-[#355C4B]" />
        </span>
        <input
          type={showPassword ? "text" : "password"}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full bg-[#F3F7F5] text-[#1F2933] font-medium placeholder-slate-400 border border-[#E1EAE5] rounded-[18px] py-3.5 pl-12 pr-12 text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-[#00B894]/20 focus:border-[#00B894]"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors flex items-center justify-center cursor-pointer focus:outline-none"
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5 text-slate-500" />
          ) : (
            <Eye className="w-5 h-5 text-slate-500" />
          )}
        </button>
      </div>
    </div>
  );
}
