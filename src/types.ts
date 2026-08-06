export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  name?: string | null;
  photoURL?: string | null;
  currency?: string;
  theme?: 'light' | 'dark';
  createdAt?: string;
  preferences?: {
    weeklyReports: boolean;
    budgetWarnings: boolean;
    thresholdAlerts: boolean;
  };
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId: string;
  description: string;
  category: string;
  paymentMethod: string;
  type: TransactionType;
  amount: number;
  date: string;
  createdAt: string;
  notes?: string;
  isOfflinePending?: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  limit: number;
  month: string; // e.g. "2026-06"
}

export type WalletType = 'Cash' | 'Bank Account' | 'Credit Card' | 'UPI';

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  type: WalletType;
  balance: number;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  createdAt: string;
}

export enum Page {
  LANDING = 'landing',
  DASHBOARD = 'dashboard',
  TRANSACTIONS = 'transactions',
  WALLET = 'wallet',
  SAVINGS = 'savings',
  BUDGETS = 'budgets',
  ANALYTICS = 'analytics',
  REPORTS = 'reports',
  EXPORT = 'export_print',
  PROFILE = 'profile',
  NOTIFICATIONS = 'notifications',
}

export interface Report {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  text: string;
  type: 'success' | 'alert' | 'info';
  read: boolean;
  createdAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  type: 'loan_emi' | 'credit_card' | 'rent' | 'sip' | 'savings_goal' | 'health_insurance' | 'vehicle_insurance' | 'life_insurance' | 'custom_policy';
  amount: number;
  dueDate: string;
  frequency: 'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  enabled: boolean;
  lastTriggered?: string;
  createdAt: string;
}

