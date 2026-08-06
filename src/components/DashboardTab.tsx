import React, { useState, useEffect } from 'react';
import { 
  Transaction, 
  Budget, 
  Wallet, 
  Goal, 
  UserProfile, 
  Page,
  AppNotification
} from '../types';
import { formatRupee } from '../utils/format';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { 
  Bell, 
  Search, 
  Calendar, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  Wallet as WalletIcon, 
  ArrowUpRight, 
  ArrowDownRight, 
  Edit3, 
  Trash2,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  PieChart as PieIcon,
  Check,
  Award,
  ChevronRight,
  Sparkles,
  Layers,
  Laptop,
  Car,
  Home,
  CheckCircle,
  X
} from 'lucide-react';
import { addTransaction, updateTransaction, deleteTransaction, deleteNotification, updateNotification } from '../dbHelper';

interface DashboardTabProps {
  transactions: Transaction[];
  budgets: Budget[];
  wallets: Wallet[];
  goals: Goal[];
  profile: UserProfile | null;
  currencySymbol: string;
  onNavigate: (page: Page) => void;
  darkMode: boolean;

  // Global lifted state
  filterMonth: string;
  setFilterMonth: (val: string) => void;
  filterYear: string;
  setFilterYear: (val: string) => void;
  filterDate: string;
  setFilterDate: (val: string) => void;
  activeQuickFilter: 'today' | 'week' | 'month' | 'year' | 'all' | null;
  setActiveQuickFilter: (val: 'today' | 'week' | 'month' | 'year' | 'all' | null) => void;
  appNotifications?: AppNotification[];
}

export default function DashboardTab({
  transactions,
  budgets,
  wallets,
  goals,
  profile,
  currencySymbol,
  onNavigate,
  darkMode,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  filterDate,
  setFilterDate,
  activeQuickFilter,
  setActiveQuickFilter,
  appNotifications
}: DashboardTabProps) {
  const [showNotification, setShowNotification] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getDynamicNotifications = () => {
    const list: Array<{ id: string; type: 'success' | 'alert' | 'info'; text: string }> = [];
    const currentMonthPrefix = `${filterYear}-${filterMonth}`;

    // 1. Budget Exceeded checks
    budgets.forEach((b) => {
      const monthExpenses = transactions.filter(t => 
        t.type === 'expense' && 
        t.category.toLowerCase() === b.category.toLowerCase() &&
        t.date.startsWith(currentMonthPrefix)
      );
      const spent = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
      if (spent > b.limit) {
        list.push({
          id: `budget-${b.id}`,
          type: 'alert',
          text: `Budget Exceeded: You spent ${formatRupee(spent)} on ${b.category}, exceeding the ${formatRupee(b.limit)} limit!`
        });
      }
    });

    // 2. Goal Completed checks
    goals.forEach((g) => {
      if (g.currentAmount >= g.targetAmount && g.targetAmount > 0) {
        list.push({
          id: `goal-${g.id}`,
          type: 'success',
          text: `Goal Completed: Congratulations! You've achieved your target of ${formatRupee(g.targetAmount)} for ${g.name}!`
        });
      }
    });

    // 3. Monthly Summary check
    const currentMonthTx = transactions.filter(t => t.date.startsWith(currentMonthPrefix));
    const earn = currentMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const spend = currentMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    if (earn > 0 || spend > 0) {
      list.push({
        id: 'monthly-summary',
        type: 'success',
        text: `Monthly Summary (June): Inflow: ${formatRupee(earn)} | Outflow: ${formatRupee(spend)} | Surplus: ${formatRupee(Math.max(0, earn - spend))}.`
      });
    }

    // 4. Upcoming Bills check
    const billsBudget = budgets.find(b => b.category.toLowerCase().includes('bills') || b.category.toLowerCase().includes('rent'));
    const isBillsDue = transactions.filter(t => t.category.toLowerCase() === 'bills' && t.date.startsWith(currentMonthPrefix)).length === 0;
    if (isBillsDue && billsBudget) {
      list.push({
        id: 'upcoming-bills',
        type: 'alert',
        text: `Upcoming Bills: Rent/Utility of ${formatRupee(billsBudget.limit)} has not been logged this month yet.`
      });
    } else {
      list.push({
        id: 'upcoming-bills',
        type: 'info',
        text: `Upcoming Bills: Keep an eye out for recurring mobile, internet, and electricity renewals.`
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'welcome',
        type: 'info',
        text: 'Live security listeners are active. Start logging transactions to view alerts!'
      });
    }

     // Merge dynamic notifications and persistent appNotifications
     const finalMerged = [...list];
     if (appNotifications) {
       appNotifications.forEach((n) => {
         if (!finalMerged.some(item => item.text === n.text)) {
           finalMerged.push({
             id: n.id,
             type: n.type,
             text: n.text,
             read: n.read
           } as any);
         }
       });
     }

    return finalMerged;
  };

  const handleDismissNotification = async (id: string) => {
    if (!id.startsWith('budget-') && !id.startsWith('goal-') && id !== 'upcoming-bills' && id !== 'welcome') {
      try {
        await deleteNotification(id);
      } catch (err) {
        console.error("Error dismissing database notification:", err);
      }
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const dbNotif = appNotifications?.find(n => n.id === id);
    if (dbNotif) {
      try {
        await updateNotification(dbNotif.id, { ...dbNotif, read: true });
      } catch (err) {
        console.error("Error marking status as read:", err);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!appNotifications) return;
    const unread = appNotifications.filter(n => !n.read);
    for (const n of unread) {
      try {
        await updateNotification(n.id, { ...n, read: true });
      } catch (err) {
        console.error("Error marking all status as read:", err);
      }
    }
  };
  
  // Dynamic current date calculations
  const now = new Date();
  const todayDate = String(now.getDate()).padStart(2, '0');
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayYear = String(now.getFullYear());
  
  // Transaction Modal state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  
  // Prevent page scroll when modal is open
  useEffect(() => {
    if (isTxModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isTxModalOpen]);
  const [txEditId, setTxEditId] = useState<string | null>(null);
  const [txDesc, setTxDesc] = useState('');
  const [txCategory, setTxCategory] = useState('Food & Groceries');
  const [txWallet, setTxWallet] = useState('');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Filters state
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState('year');

  const monthsMapFull: { [key: string]: string } = {
    '01': 'January',
    '02': 'February',
    '03': 'March',
    '04': 'April',
    '05': 'May',
    '06': 'June',
    '07': 'July',
    '08': 'August',
    '09': 'September',
    '10': 'October',
    '11': 'November',
    '12': 'December'
  };

  const selectedMonthDisplay = 
    activeQuickFilter === 'week'
      ? 'This Week'
      : activeQuickFilter === 'today'
        ? 'Today'
        : filterYear === 'all' && filterMonth === 'all' && filterDate === 'all'
          ? 'All Time'
          : filterYear === 'all'
            ? `${filterDate !== 'all' ? `Day ${filterDate} of ` : ''}${filterMonth !== 'all' ? monthsMapFull[filterMonth] : 'All Months'} (All Years)`
            : filterMonth === 'all'
              ? `All of ${filterYear}`
              : `${filterDate !== 'all' ? filterDate + ' ' : ''}${monthsMapFull[filterMonth]} ${filterYear}`;

  // Core filter logic
  const monthTransactions = transactions.filter(t => {
    if (activeQuickFilter === 'week') {
      const txDateObj = new Date(t.date);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const day = today.getDay();
      // standard Monday-based week or Sunday-based week
      const diff = today.getDate() - day; // Sunday is 0
      const startOfWeek = new Date(today);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0,0,0,0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23,59,59,999);
      
      return txDateObj >= startOfWeek && txDateObj <= endOfWeek;
    }

    const parts = t.date.split('-');
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    
    const yearMatch = filterYear === 'all' || y === filterYear;
    const monthMatch = filterMonth === 'all' || m === filterMonth;
    const dateMatch = filterDate === 'all' || (d && parseInt(d, 10) === parseInt(filterDate, 10));
    
    return yearMatch && monthMatch && dateMatch;
  });
  const totalBalance = wallets.length > 0
    ? wallets.reduce((sum, w) => sum + w.balance, 0)
    : transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate savings
  const totalSavings = Math.max(0, totalIncome - totalExpense);

  // Categories lists
  const expenseCategories = ['Food & Groceries', 'Shopping', 'Rent', 'Bills & Utilities', 'Healthcare', 'Education', 'Transportation', 'Entertainment', 'Other'];
  const incomeCategories = ['Salary', 'Freelance', 'Investments', 'Other'];

  const mapCategoryForProgress = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('food') || c.includes('grocery') || c.includes('groceries') || c.includes('cafe') || c.includes('restaurant') || c.includes('dining')) return 'Food & Groceries';
    if (c.includes('shop') || c.includes('store') || c.includes('purchase')) return 'Shopping';
    if (c.includes('rent') || c.includes('house') || c.includes('home')) return 'Rent';
    if (c.includes('bill') || c.includes('utility') || c.includes('electricity') || c.includes('water')) return 'Bills & Utilities';
    if (c.includes('health') || c.includes('medical') || c.includes('doctor') || c.includes('pharmacy') || c.includes('beauty') || c.includes('spa')) return 'Healthcare';
    if (c.includes('education') || c.includes('school') || c.includes('college') || c.includes('book') || c.includes('course')) return 'Education';
    if (c.includes('travel') || c.includes('trip') || c.includes('flight') || c.includes('taxi') || c.includes('bus') || c.includes('car') || c.includes('cab') || c.includes('fuel') || c.includes('uber') || c.includes('ola') || c.includes('train') || c.includes('transportation')) return 'Transportation';
    if (c.includes('entertainment') || c.includes('movie') || c.includes('game') || c.includes('subscription') || c.includes('netflix')) return 'Entertainment';
    return 'Other';
  };

  // Money Flow chart: dynamic aggregates for selected year/month, account, and timeframe
  const targetYear = filterYear === 'all' ? '2026' : filterYear;
  const targetMonth = filterMonth === 'all' ? '06' : filterMonth;
  const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Filter by selectedAccount (which maps to wallet IDs/names)
  const walletForAccount = wallets.find(w => w.id === selectedAccount);
  const chartTransactions = selectedAccount === 'all'
    ? transactions
    : transactions.filter(t => t.paymentMethod === (walletForAccount ? walletForAccount.name : selectedAccount));

  const monthlyFlowStats = selectedTimeframe === 'month'
    ? Array.from({ length: 31 }, (_, idx) => {
        const dayStr = String(idx + 1).padStart(2, '0');
        const dayPrefix = `${targetYear}-${targetMonth}-${dayStr}`;
        const realIncome = chartTransactions.filter(t => t.date === dayPrefix && t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const realExpense = chartTransactions.filter(t => t.date === dayPrefix && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        return {
          name: dayStr,
          Income: realIncome,
          Expense: realExpense
        };
      })
    : monthsList.map((m, idx) => {
        const monthNumStr = `0${idx + 1}`.slice(-2);
        const targetPrefix = `${targetYear}-${monthNumStr}`;
        const realIncome = chartTransactions.filter(t => t.date.startsWith(targetPrefix) && t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const realExpense = chartTransactions.filter(t => t.date.startsWith(targetPrefix) && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        return {
          name: m,
          Income: realIncome,
          Expense: realExpense
        };
      });

  // Budget Card: dynamic mapping for core categories
  const budgetCategoriesDef = [
    { name: 'Food & Groceries', color: '#4CAF50' },
    { name: 'Shopping', color: '#E85D5D' },
    { name: 'Rent', color: '#6B7280' },
    { name: 'Bills & Utilities', color: '#D6A51D' },
    { name: 'Healthcare', color: '#9333EA' },
    { name: 'Education', color: '#F59E0B' },
    { name: 'Transportation', color: '#38BDF8' },
    { name: 'Entertainment', color: '#EF4444' },
    { name: 'Other', color: '#94A3B8' }
  ];

  const budgetSpendData = budgetCategoriesDef.map(cat => {
    const spentValue = monthTransactions
      .filter(t => t.type === 'expense' && mapCategoryForProgress(t.category) === cat.name)
      .reduce((sum, t) => sum + t.amount, 0);

    const matchMonth = `${filterYear}-${filterMonth}`;
    const budgetLimit = budgets.find(b => b.category.toLowerCase() === cat.name.toLowerCase() && b.month === matchMonth)?.limit || 0;
    
    return {
      name: cat.name,
      value: spentValue,
      color: cat.color,
      limit: budgetLimit
    };
  });

  const totalMonthlySpend = budgetSpendData.reduce((sum, d) => sum + d.value, 0);

  // Saving Goals Card
  const displayGoals = goals.map((g, idx) => {
    const icons = [Laptop, Car, Home, Sparkles];
    return {
      name: g.name,
      logo: icons[idx % icons.length] || Sparkles,
      target: g.targetAmount,
      current: g.currentAmount,
      color: idx % 3 === 0 ? '#D6A51D' : idx % 3 === 1 ? '#4CAF50' : '#355C4B'
    };
  });

  // Searches & Ledger List
  const recentTransactions = monthTransactions
    .filter(t => {
      if (searchQuery.trim() === '') return true;
      const query = searchQuery.toLowerCase().trim();

      // Check transaction type (income or expense)
      const isIncomeQuery = ('income'.includes(query) || 'earned'.includes(query)) && t.type === 'income';
      const isExpenseQuery = ('expense'.includes(query) || 'spent'.includes(query) || 'expenses'.includes(query)) && t.type === 'expense';

      // Match text fields: description, category, paymentMethod
      const descMatch = t.description.toLowerCase().includes(query);
      const categoryMatch = t.category.toLowerCase().includes(query);
      const methodMatch = t.paymentMethod.toLowerCase().includes(query);

      // Match amount: matching the number value as well
      const amountMatch = t.amount.toString().includes(query) || formatRupee(t.amount).toLowerCase().includes(query);

      // Match date: matching parts of date, and month names like "June", "January", etc.
      const dateStr = t.date.toLowerCase();
      const monthsArray = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const dateParts = t.date.split('-');
      const monthIndex = parseInt(dateParts[1], 10) - 1;
      const monthName = (monthIndex >= 0 && monthIndex < 12) ? monthsArray[monthIndex] : '';
      const dateMatch = dateStr.includes(query) || monthName.includes(query);

      return isIncomeQuery || isExpenseQuery || descMatch || categoryMatch || methodMatch || amountMatch || dateMatch;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txDesc.trim() || !txCategory || !txAmount) return;
    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!profile) return;

    const payload = {
      userId: profile.uid,
      description: txDesc,
      category: txCategory,
      paymentMethod: txWallet || wallets[0]?.name || 'Primary Wallet',
      type: txType,
      amount: amountNum,
      date: txDate,
    };

    if (txEditId) {
      await updateTransaction(txEditId, payload);
    } else {
      await addTransaction(payload);
    }
    setIsTxModalOpen(false);
    resetForm();
  };

  const handleEditInit = (t: any) => {
    setTxEditId(t.id);
    setTxDesc(t.description);
    setTxCategory(t.category);
    setTxWallet(t.paymentMethod);
    setTxType(t.type);
    setTxAmount(t.amount.toString());
    setTxDate(t.date);
    setIsTxModalOpen(true);
  };

  const handleDeleteInit = async (id: string) => {
    if (confirm('Delete this transaction permanently?')) {
      await deleteTransaction(id);
    }
  };

  const resetForm = () => {
    setTxEditId(null);
    setTxDesc('');
    setTxCategory('Food & Groceries');
    setTxWallet(wallets[0]?.name || 'Primary Wallet');
    setTxType('expense');
    setTxAmount('');
    setTxDate(new Date().toISOString().split('T')[0]);
  };

  const currencySymbolDisplay = '₹';

  return (
    <div className="space-y-6 animate-fade-in text-[#1F2933]">
      
      {/* 6. TOP HEADER WITH WELCOME & CONTROLS */}
      <header className="bg-[#355C4B] rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 border border-[#274437] dashboard-header">
        <div className="flex items-center space-x-3.5">
          {/* User Profile Avatar */}
          <div className="relative shrink-0">
            {profile?.photoURL ? (
              <img 
                src={profile.photoURL} 
                alt="Profile" 
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border-2 border-[#D6A51D] shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#D6A51D] text-slate-950 font-extrabold flex items-center justify-center text-sm shadow-md border-2 border-white/20 uppercase">
                {(() => {
                  const name = profile?.displayName || profile?.name || '';
                  if (name) {
                    const parts = name.trim().split(/\s+/);
                    if (parts.length >= 2) {
                      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                    }
                    return parts[0].substring(0, 2).toUpperCase();
                  }
                  return (profile?.email || 'B').substring(0, 2).toUpperCase();
                })()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#355C4B] rounded-full"></span>
          </div>

          <div className="space-y-0.5">
            <span className="bg-[#D6A51D] text-slate-950 font-mono text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-inner">
              Workspace Dashboard
            </span>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl mt-0.5 tracking-tight">
              Welcome back, {profile?.displayName?.split(' ')[0] || 'Bloom Member'}!
            </h1>
            <p className="text-xs text-[#DCE8E1]/85 font-medium">
              Your real-time financial tracking hub is synchronized with secure Cloud Storage.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Dynamic Day Selector */}
          <div className="p-2 px-3 rounded-xl bg-[#274437] border border-[#436F5C] flex items-center space-x-1.5 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-[#D6A51D]" />
            <span className="text-white/60 text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Date:</span>
            <select 
              value={filterDate} 
              onChange={(e) => {
                setFilterDate(e.target.value);
                setActiveQuickFilter(null);
              }}
              className="bg-transparent focus:outline-none cursor-pointer text-white font-medium pr-1"
            >
              <option value="all" className="text-slate-900">All Days</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(day => (
                <option key={day} value={day} className="text-slate-900">{day}</option>
              ))}
            </select>
          </div>

          {/* Dynamic Month Selector */}
          <div className="p-2 px-3 rounded-xl bg-[#274437] border border-[#436F5C] flex items-center space-x-1.5 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-[#D6A51D]" />
            <span className="text-white/60 text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Month:</span>
            <select 
              value={filterMonth} 
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setActiveQuickFilter(null);
              }}
              className="bg-transparent focus:outline-none cursor-pointer text-white font-medium pr-1"
            >
              <option value="all" className="text-slate-900">All Months</option>
              <option value="01" className="text-slate-900">January</option>
              <option value="02" className="text-slate-900">February</option>
              <option value="03" className="text-slate-900">March</option>
              <option value="04" className="text-slate-900">April</option>
              <option value="05" className="text-slate-900">May</option>
              <option value="06" className="text-slate-900">June</option>
              <option value="07" className="text-slate-900">July</option>
              <option value="08" className="text-slate-900">August</option>
              <option value="09" className="text-slate-900">September</option>
              <option value="10" className="text-slate-900">October</option>
              <option value="11" className="text-slate-900">November</option>
              <option value="12" className="text-slate-900">December</option>
            </select>
          </div>

          {/* Dynamic Year Selector */}
          <div className="p-2 px-3 rounded-xl bg-[#274437] border border-[#436F5C] flex items-center space-x-1.5 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-[#D6A51D]" />
            <span className="text-white/60 text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Year:</span>
            <select 
              value={filterYear} 
              onChange={(e) => {
                setFilterYear(e.target.value);
                setActiveQuickFilter(null);
              }}
              className="bg-transparent focus:outline-none cursor-pointer text-white font-medium pr-1"
            >
              <option value="all" className="text-slate-900">All Years</option>
              <option value="2024" className="text-slate-900">2024</option>
              <option value="2025" className="text-slate-900">2025</option>
              <option value="2026" className="text-slate-900">2026</option>
              <option value="2027" className="text-slate-900">2027</option>
              <option value="2028" className="text-slate-900">2028</option>
              <option value="2029" className="text-slate-900">2029</option>
              <option value="2030" className="text-slate-900">2030</option>
              <option value="2031" className="text-slate-900">2031</option>
              <option value="2032" className="text-slate-900">2032</option>
              <option value="2033" className="text-slate-900">2033</option>
              <option value="2034" className="text-slate-900">2034</option>
              <option value="2035" className="text-slate-900">2035</option>
            </select>
          </div>

          {/* Search bar + Bell block group to align them tightly side-by-side (12px to 16px gap) */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Expanded & Fully Functional Search Bar */}
            <div className="relative w-full sm:w-64 md:w-64 lg:w-80 xl:w-[420px] group transition-all duration-300">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#DCE8E1]/60 group-focus-within:text-[#D6A51D] group-focus-within:scale-110 transition-all duration-200" />
              <input 
                type="text" 
                placeholder="Search transactions, categories, amount or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 rounded-xl text-xs font-semibold focus:outline-none bg-[#274437]/80 hover:bg-[#274437] border border-[#436F5C] focus:border-[#D6A51D] placeholder-[#DCE8E1]/50 text-white focus:ring-2 focus:ring-[#D6A51D]/20 shadow-inner transition-all duration-300 group-hover:border-[#4d806a]"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#DCE8E1]/60 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-all duration-150"
                  title="Clear Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Notification bell */}
            <div className="relative">
              <button 
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setShowMobileDrawer(true);
                  } else {
                    setShowNotification(!showNotification);
                  }
                }}
                className="p-2.5 sm:p-2 rounded-xl bg-[#274437] border border-[#436F5C] hover:bg-[#2c4d3e] transition-colors relative flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0"
                title="Notifications & Alerts"
                id="btn-responsive-bell"
              >
                <Bell className="w-5 h-5 sm:w-4.5 sm:h-4.5 text-[#DCE8E1]" />
                {(() => {
                  const unreadDbCount = appNotifications ? appNotifications.filter(n => !n.read).length : 0;
                  return unreadDbCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-[#D6A51D] text-slate-950 border border-[#355C4B] font-extrabold text-[9px] rounded-full w-4.5 h-4.5 flex items-center justify-center animate-bounce shadow-md">
                      {unreadDbCount}
                    </span>
                  ) : null;
                })()}
              </button>

              {/* Desktop/Tablet Dropdown Panel */}
              {showNotification && (
                <div className="absolute right-0 mt-3 w-85 p-4 rounded-xl shadow-2xl border z-50 bg-white text-slate-800 border-[#DCE8E1] animate-fade-in max-h-[420px] overflow-y-auto flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3 pb-1.5 border-b border-slate-100">
                      <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#355C4B]">Active Alerts</span>
                      <div className="flex items-center space-x-2">
                        {appNotifications && appNotifications.some(n => !n.read) && (
                          <button 
                            onClick={handleMarkAllAsRead} 
                            className="text-[9px] text-[#355C4B] hover:text-[#D6A51D] font-extrabold uppercase hover:underline mr-1"
                            title="Mark all notifications as read"
                          >
                            Mark all read
                          </button>
                        )}
                        <button onClick={() => setShowNotification(false)} className="text-[10px] text-[#D6A51D] font-extrabold uppercase hover:underline">Close</button>
                      </div>
                    </div>
                    
                    <div className="space-y-2.5">
                      {getDynamicNotifications().map((item: any) => {
                        const isDbNotification = appNotifications?.some(n => n.id === item.id);
                        const isUnread = isDbNotification ? appNotifications?.find(n => n.id === item.id)?.read === false : false;
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`flex items-start justify-between space-x-2.5 text-[11px] leading-relaxed p-2 rounded-xl transition-all ${
                              isUnread ? 'bg-[#EEF6F2] border-l-3 border-[#D6A51D] font-medium' : 'hover:bg-slate-50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-start space-x-2 flex-1 min-w-0">
                               {item.type === 'success' && (
                                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 p-0.5 bg-emerald-100 rounded-full" />
                              )}
                              {item.type === 'alert' && (
                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 p-0.5 bg-rose-100 rounded-full" />
                              )}
                              {item.type === 'info' && (
                                <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5 p-0.5 bg-blue-100 rounded-full" />
                              )}
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <p className="text-slate-700 font-medium break-words">{item.text}</p>
                                {isUnread && (
                                  <button 
                                    onClick={() => handleMarkAsRead(item.id)}
                                    className="text-[9px] text-[#355C4B] hover:underline block font-extrabold uppercase mt-1"
                                  >
                                    Mark as read
                                  </button>
                                )}
                              </div>
                            </div>
                            {isDbNotification && (
                              <button 
                                onClick={() => handleDismissNotification(item.id)}
                                className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-100 shrink-0 self-center transition-colors"
                                title="Dismiss notification"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {getDynamicNotifications().length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">No active system alerts.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-slate-100 text-center">
                    <button
                      onClick={() => {
                        setShowNotification(false);
                        onNavigate(Page.NOTIFICATIONS);
                      }}
                      className="w-full text-center text-[10px] font-extrabold text-[#355C4B] hover:text-[#D6A51D] uppercase tracking-wider hover:underline"
                    >
                      Manage Reminders & Alerts →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Full-Screen Notification Drawer */}
            {showMobileDrawer && (
              <div className="fixed inset-0 bg-[#0B0F19]/80 backdrop-blur-md z-[9999] flex flex-col justify-end" id="mobile-notification-drawer">
                {/* Transparent tap to dismiss area */}
                <div className="absolute inset-0" onClick={() => setShowMobileDrawer(false)} />
                
                {/* Sliding Panel Content */}
                <div className="relative w-full max-h-[85vh] bg-white dark:bg-[#1E293B] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up border-t border-slate-200 dark:border-slate-800">
                  {/* Header of Drawer */}
                  <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-[#D6A51D]" />
                      <span className="font-display font-extrabold text-base text-[#355C4B] dark:text-white">
                        Notifications & Alerts
                      </span>
                    </div>
                    <button 
                      onClick={() => setShowMobileDrawer(false)}
                      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center w-9 h-9"
                      title="Close drawer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick Option Row */}
                  {appNotifications && appNotifications.some(n => !n.read) && (
                    <div className="bg-[#EEF6F2] dark:bg-[#263D33]/20 px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unread actions</span>
                      <button 
                        onClick={async () => {
                          await handleMarkAllAsRead();
                        }}
                        className="text-xs font-extrabold text-[#355C4B] dark:text-brand-sage-green hover:underline flex items-center gap-1.5 py-1 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700 shadow-xs active:scale-95 transition-all"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        Mark All Read
                      </button>
                    </div>
                  )}

                  {/* Scrollable list with smooth scrolling and large touch targets */}
                  <div className="flex-1 overflow-y-auto scroll-smooth divide-y divide-slate-100 dark:divide-slate-800 p-4 space-y-3">
                    {getDynamicNotifications().map((item: any) => {
                      const isDbNotification = appNotifications?.some(n => n.id === item.id);
                      const isUnread = isDbNotification ? appNotifications?.find(n => n.id === item.id)?.read === false : false;

                      return (
                        <div 
                          key={item.id} 
                          className={`flex items-start justify-between gap-3.5 p-4 rounded-2xl transition-all ${
                            isUnread 
                              ? 'bg-[#EEF6F2] dark:bg-[#355C4B]/15 border-l-4 border-[#D6A51D]' 
                              : 'bg-slate-50 dark:bg-slate-900/40 border border-slate-150/40 dark:border-slate-800/40'
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {item.type === 'success' && (
                              <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 p-1 bg-emerald-100 rounded-full" />
                            )}
                            {item.type === 'alert' && (
                              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 p-1 bg-rose-100 rounded-full" />
                            )}
                            {item.type === 'info' && (
                              <Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 p-1 bg-blue-100 rounded-full" />
                            )}
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <p className="text-xs font-semibold leading-relaxed text-slate-800 dark:text-slate-200">
                                {item.text}
                              </p>
                              
                              {isUnread && (
                                <button 
                                  onClick={() => handleMarkAsRead(item.id)}
                                  className="text-[10px] text-[#355C4B] dark:text-brand-sage-green hover:underline font-extrabold uppercase py-1.5 px-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs inline-block active:scale-95 transition-all"
                                >
                                  Mark Read
                                </button>
                              )}
                            </div>
                          </div>

                          {isDbNotification && (
                            <button 
                              onClick={() => handleDismissNotification(item.id)}
                              className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-2xl transition-all shrink-0 self-center flex items-center justify-center min-w-[44px] min-h-[44px]"
                              title="Dismiss alert"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {getDynamicNotifications().length === 0 && (
                      <div className="py-16 text-center space-y-2">
                        <Bell className="w-9 h-9 mx-auto text-slate-300" />
                        <p className="text-xs font-semibold text-slate-400">All caught up! No active alerts.</p>
                      </div>
                    )}
                  </div>

                  {/* Footer navigation link to go to full Notification & Reminder page */}
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                    <button
                      onClick={() => {
                        setShowMobileDrawer(false);
                        onNavigate(Page.NOTIFICATIONS);
                      }}
                      className="w-full bg-[#355C4B] hover:bg-[#274437] text-white py-3.5 px-4 rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[44px]"
                    >
                      <Bell className="w-4 h-4 text-[#D6A51D]" />
                      Configure Reminders & Policies
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* QUICK QUICK DATE FILTER STRIP AND SUMMARY CARDS */}
      <div className="space-y-3.5">
        {/* QUICK QUICK DATE FILTER STRIP */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-2">Quick Filters:</span>
          <button 
            onClick={() => {
              setFilterDate(todayDate);
              setFilterMonth(todayMonth);
              setFilterYear(todayYear);
              setActiveQuickFilter('today');
            }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
              activeQuickFilter === 'today' || (filterDate === todayDate && filterMonth === todayMonth && filterYear === todayYear)
                ? 'bg-[#355C4B] border-[#274437] text-white shadow-md'
                : 'bg-white dark:bg-[#1E293B] border-[#DCE8E1] dark:border-slate-850 text-[#355C4B] dark:text-slate-350 hover:bg-[#EEF6F2] dark:hover:bg-slate-800'
            }`}
          >
            Today
          </button>
          <button 
            onClick={() => {
              setFilterDate('all');
              setFilterMonth(todayMonth);
              setFilterYear(todayYear);
              setActiveQuickFilter('week');
            }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
              activeQuickFilter === 'week'
                ? 'bg-[#355C4B] border-[#274437] text-white shadow-md'
                : 'bg-white dark:bg-[#1E293B] border-[#DCE8E1] dark:border-slate-850 text-[#355C4B] dark:text-slate-350 hover:bg-[#EEF6F2] dark:hover:bg-slate-800'
            }`}
          >
            This Week
          </button>
          <button 
            onClick={() => {
              setFilterDate('all');
              setFilterMonth(todayMonth);
              setFilterYear(todayYear);
              setActiveQuickFilter('month');
            }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
              activeQuickFilter === 'month' || (filterDate === 'all' && filterMonth === todayMonth && filterYear === todayYear && activeQuickFilter !== 'week')
                ? 'bg-[#355C4B] border-[#274437] text-white shadow-md'
                : 'bg-white dark:bg-[#1E293B] border-[#DCE8E1] dark:border-slate-850 text-[#355C4B] dark:text-slate-350 hover:bg-[#EEF6F2] dark:hover:bg-slate-800'
            }`}
          >
            This Month
          </button>
          <button 
            onClick={() => {
              setFilterDate('all');
              setFilterMonth('all');
              setFilterYear(todayYear);
              setActiveQuickFilter('year');
            }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
              activeQuickFilter === 'year' || (filterDate === 'all' && filterMonth === 'all' && filterYear === todayYear)
                ? 'bg-[#355C4B] border-[#274437] text-white shadow-md'
                : 'bg-white dark:bg-[#1E293B] border-[#DCE8E1] dark:border-slate-850 text-[#355C4B] dark:text-slate-350 hover:bg-[#EEF6F2] dark:hover:bg-slate-800'
            }`}
          >
            This Year
          </button>
          <button 
            onClick={() => {
              setFilterDate('all');
              setFilterMonth('all');
              setFilterYear('all');
              setActiveQuickFilter('all');
            }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
              activeQuickFilter === 'all' || (filterDate === 'all' && filterMonth === 'all' && filterYear === 'all')
                ? 'bg-[#355C4B] border-[#274437] text-white shadow-md'
                : 'bg-white dark:bg-[#1E293B] border-[#DCE8E1] dark:border-slate-850 text-[#355C4B] dark:text-slate-350 hover:bg-[#EEF6F2] dark:hover:bg-slate-800'
            }`}
          >
            All Time
          </button>
        </div>

        {/* 1. TOP SUMMARY CARDS (4 cards: Total Balance, Income, Expense, Total Savings) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stats-grid">
          
          {/* Total Balance Card */}
          <div className="p-5 rounded-xl bg-white border border-[#DCE8E1] shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Balance</span>
              <div className="p-2 rounded-lg bg-[#355C4B]/10 text-[#355C4B]">
                <WalletIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-display font-extrabold text-2xl text-slate-900 leading-none">
                {formatRupee(totalBalance)}
              </h3>
              <span className="text-[10px] text-slate-400 mt-1.5 block font-medium">Combined Wallet holdings</span>
            </div>
          </div>

          {/* Income Card */}
          <div className="p-5 rounded-xl bg-white border border-[#DCE8E1] shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Income</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-[#4CAF50]">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-display font-extrabold text-2xl text-[#4CAF50] leading-none">
                {formatRupee(totalIncome)}
              </h3>
              <span className="text-[10px] text-emerald-600 font-medium mt-1.5 block">{selectedMonthDisplay} Income flow</span>
            </div>
          </div>

          {/* Expense Card */}
          <div className="p-5 rounded-xl bg-white border border-[#DCE8E1] shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Expense</span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-[#E85D5D]">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-display font-extrabold text-2xl text-[#E85D5D] leading-none">
                {formatRupee(totalExpense)}
              </h3>
              <span className="text-[10px] text-rose-550 font-medium mt-1.5 block">{selectedMonthDisplay} Outflow spent</span>
            </div>
          </div>

          {/* Total Savings Card */}
          <div className="p-5 rounded-xl bg-white border border-[#DCE8E1] shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Savings</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-[#D6A51D]">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-display font-extrabold text-2xl text-[#355C4B] leading-none">
                {formatRupee(totalSavings)}
              </h3>
              <span className="text-[10px] text-slate-400 mt-1.5 block font-medium">Monthly computed reserve speed</span>
            </div>
          </div>

        </section>
      </div>

      {/* 3. PERIODIC FINANCIAL TRACKING ENGINE */}
      {(() => {
        const todayDateStr = new Date().toISOString().split('T')[0];
        const dailyIncome = transactions
          .filter(t => t.type === 'income' && t.date === todayDateStr)
          .reduce((sum, t) => sum + t.amount, 0);
        const dailyExpense = transactions
          .filter(t => t.type === 'expense' && t.date === todayDateStr)
          .reduce((sum, t) => sum + t.amount, 0);
        const dailySavings = dailyIncome - dailyExpense;

        const todayObj2 = new Date();
        todayObj2.setHours(0,0,0,0);
        const dow2 = todayObj2.getDay();
        const diffMon2 = todayObj2.getDate() - dow2 + (dow2 === 0 ? -6 : 1);
        const monDateObj2 = new Date(todayObj2);
        monDateObj2.setDate(diffMon2);
        const startOfWeekDateStr2 = monDateObj2.toISOString().split('T')[0];
        
        const sunDateObj2 = new Date(monDateObj2);
        sunDateObj2.setDate(monDateObj2.getDate() + 6);
        const endOfWeekDateStr2 = sunDateObj2.toISOString().split('T')[0];

        const weeklyIncome = transactions
          .filter(t => t.type === 'income' && t.date >= startOfWeekDateStr2 && t.date <= endOfWeekDateStr2)
          .reduce((sum, t) => sum + t.amount, 0);
        const weeklyExpense = transactions
          .filter(t => t.type === 'expense' && t.date >= startOfWeekDateStr2 && t.date <= endOfWeekDateStr2)
          .reduce((sum, t) => sum + t.amount, 0);
        const weeklySavings = weeklyIncome - weeklyExpense;

        const fallbackM2 = filterMonth === 'all' ? todayMonth : filterMonth;
        const fallbackY2 = filterYear === 'all' ? todayYear : filterYear;
        const monthPrefixStr2 = `${fallbackY2}-${fallbackM2}`;
        const monthlyIncome = transactions
          .filter(t => t.type === 'income' && t.date.startsWith(monthPrefixStr2))
          .reduce((sum, t) => sum + t.amount, 0);
        const monthlyExpense = transactions
          .filter(t => t.type === 'expense' && t.date.startsWith(monthPrefixStr2))
          .reduce((sum, t) => sum + t.amount, 0);
        const monthlySavings = monthlyIncome - monthlyExpense;

        const fallbackYearOnly2 = filterYear === 'all' ? todayYear : filterYear;
        const yearlyIncome = transactions
          .filter(t => t.type === 'income' && t.date.startsWith(fallbackYearOnly2))
          .reduce((sum, t) => sum + t.amount, 0);
        const yearlyExpense = transactions
          .filter(t => t.type === 'expense' && t.date.startsWith(fallbackYearOnly2))
          .reduce((sum, t) => sum + t.amount, 0);
        const yearlySavings = yearlyIncome - yearlyExpense;

        return (
          <section className="space-y-3 mb-6">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Continuous Ledger Metrics</span>
              <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-tight">Periodic Cashflow tracking</h2>
              <p className="text-[10px] text-slate-400 font-medium leading-none">Automated calculations updated in real-time from active ledger entries</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Daily Card */}
              <div className="bg-white p-4.5 rounded-xl border border-[#DCE8E1] shadow-xs flex flex-col justify-between hover:shadow-sm transition-all text-[#1F2933]">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">Daily Window (Today)</span>
                  <span className="text-[8px] bg-[#EEF6F2] font-semibold text-[#355C4B] px-1.5 py-0.5 rounded-full border border-[#DCE8E1]">Inflow / Outflow</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400 font-medium">Inflow:</span>
                    <span className="text-[#4CAF50] font-bold font-mono">+{formatRupee(dailyIncome)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400 font-medium">Outflow:</span>
                    <span className="text-[#E85D5D] font-bold font-mono">-{formatRupee(dailyExpense)}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-100 pt-1.5 flex justify-between text-xs font-extrabold">
                    <span className="text-slate-700">Savings reserve:</span>
                    <span className={`font-mono ${dailySavings >= 0 ? 'text-[#355C4B]' : 'text-[#E85D5D]'}`}>
                      {dailySavings >= 0 ? '+' : ''}{formatRupee(dailySavings)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekly Card */}
              <div className="bg-white p-4.5 rounded-xl border border-[#DCE8E1] shadow-xs flex flex-col justify-between hover:shadow-sm transition-all text-[#1F2933]">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">Weekly Window</span>
                  <span className="text-[8px] bg-[#EEF6F2] font-semibold text-[#355C4B] px-1.5 py-0.5 rounded-full border border-[#DCE8E1]">Inflow / Outflow</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400 font-medium">Inflow:</span>
                    <span className="text-[#4CAF50] font-bold font-mono">+{formatRupee(weeklyIncome)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400 font-medium">Outflow:</span>
                    <span className="text-[#E85D5D] font-bold font-mono">-{formatRupee(weeklyExpense)}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-100 pt-1.5 flex justify-between text-xs font-extrabold">
                    <span className="text-slate-700">Savings reserve:</span>
                    <span className={`font-mono ${weeklySavings >= 0 ? 'text-[#355C4B]' : 'text-[#E85D5D]'}`}>
                      {weeklySavings >= 0 ? '+' : ''}{formatRupee(weeklySavings)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Card */}
              <div className="bg-white p-4.5 rounded-xl border border-[#DCE8E1] shadow-xs flex flex-col justify-between hover:shadow-sm transition-all text-[#1F2933]">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">Monthly Window</span>
                  <span className="text-[8px] bg-[#EEF6F2] font-semibold text-[#355C4B] px-1.5 py-0.5 rounded-full border border-[#DCE8E1]">Selected Month</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400 font-medium">Inflow:</span>
                    <span className="text-[#4CAF50] font-bold font-mono">+{formatRupee(monthlyIncome)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400 font-medium">Outflow:</span>
                    <span className="text-[#E85D5D] font-bold font-mono">-{formatRupee(monthlyExpense)}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-100 pt-1.5 flex justify-between text-xs font-extrabold">
                    <span className="text-slate-700">Savings reserve:</span>
                    <span className={`font-mono ${monthlySavings >= 0 ? 'text-[#355C4B]' : 'text-[#E85D5D]'}`}>
                      {monthlySavings >= 0 ? '+' : ''}{formatRupee(monthlySavings)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Yearly Card */}
              <div className="bg-white p-4.5 rounded-xl border border-[#DCE8E1] shadow-xs flex flex-col justify-between hover:shadow-sm transition-all text-[#1F2933]">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">Yearly Window</span>
                  <span className="text-[8px] bg-[#EEF6F2] font-semibold text-[#355C4B] px-1.5 py-0.5 rounded-full border border-[#DCE8E1]">Selected Year</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400 font-medium">Inflow:</span>
                    <span className="text-[#4CAF50] font-bold font-mono">+{formatRupee(yearlyIncome)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400 font-medium">Outflow:</span>
                    <span className="text-[#E85D5D] font-bold font-mono">-{formatRupee(yearlyExpense)}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-100 pt-1.5 flex justify-between text-xs font-extrabold">
                    <span className="text-slate-700">Savings reserve:</span>
                    <span className={`font-mono ${yearlySavings >= 0 ? 'text-[#355C4B]' : 'text-[#E85D5D]'}`}>
                      {yearlySavings >= 0 ? '+' : ''}{formatRupee(yearlySavings)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* CORE DISPLAY MATRIX: Bento Box Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 charts-grid">
        
        {/* 2. MONEY FLOW CHART CARD (Occupies 2 columns on desktop) */}
        <div className="bg-white p-5 rounded-2xl border border-[#DCE8E1] shadow-sm flex flex-col justify-between lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Analysis Engine</span>
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Money Flow Chart</h2>
              <p className="text-[10px] text-slate-400 font-medium">Tracking inflows and outflows across months</p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Account Dropdown */}
              <select 
                value={selectedAccount} 
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="p-1 px-2 text-[10px] font-extrabold bg-[#EEF6F2] hover:bg-[#dce8e1] rounded-lg border border-[#DCE8E1] text-[#355C4B] cursor-pointer"
              >
                <option value="all">All Accounts</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>

              {/* Timeframe selector Dropdown */}
              <select 
                value={selectedTimeframe} 
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="p-1 px-2 text-[10px] font-extrabold bg-[#EEF6F2] hover:bg-[#dce8e1] rounded-lg border border-[#DCE8E1] text-[#355C4B] cursor-pointer"
              >
                <option value="year">This Year</option>
                <option value="month">Current Month</option>
              </select>
            </div>
          </div>

          {/* Bar Chart visual viewport */}
          <div className="h-56 w-full flex items-center justify-center">
            {transactions.length === 0 ? (
              <p className="text-center text-slate-400 font-semibold text-xs px-6">
                No financial data available yet. Start by adding your first transaction.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyFlowStats} margin={{ top: 10, bottom: 5, left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF6F2" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} fontWeight="bold" tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={9} fontWeight="bold" tickLine={false} />
                  <RechartsTooltip 
                    formatter={(value) => formatRupee(parseFloat(value as string))} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #DCE8E1', fontFamily: 'Inter' }}
                  />
                  <Bar dataKey="Income" fill="#4CAF50" radius={[4, 4, 0, 0]} barSize={16} name="Inflow (Income)" />
                  <Bar dataKey="Expense" fill="#E85D5D" radius={[4, 4, 0, 0]} barSize={16} name="Outflow (Expense)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex justify-center space-x-5 text-[9px] font-extrabold uppercase tracking-wider text-slate-500 pt-3.5 border-t border-slate-100 mt-2">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#4CAF50]"></span>
              <span>Total Incoming</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#E85D5D]"></span>
              <span>Total Expended</span>
            </span>
          </div>
        </div>

        {/* 3. BUDGET CARD (occupies 1 column on desktop) */}
        <div className="bg-white p-5 rounded-2xl border border-[#DCE8E1] shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Limits & progress</span>
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Active Budget Allocation</h2>
              <p className="text-[10px] text-slate-400 font-medium">Circular category consumption tracking</p>
            </div>
            <PieIcon className="w-5 h-5 text-[#355C4B]" />
          </div>

          {/* Donut Chart visual viewport with Monthly Spend in center */}
          <div className="h-44 w-full flex items-center justify-center relative my-1">
            {transactions.filter(t => t.type === 'expense').length === 0 ? (
              <p className="text-center text-slate-400 font-semibold text-xs px-6">
                No financial data available yet. Start by adding your first transaction.
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={budgetSpendData} 
                      innerRadius={50} 
                      outerRadius={70} 
                      paddingAngle={3} 
                      dataKey="value"
                    >
                      {budgetSpendData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatRupee(parseFloat(value as string))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Total Spent</span>
                  <span className="text-[13px] font-extrabold text-slate-800 leading-none mt-1">
                    {formatRupee(totalMonthlySpend)}
                  </span>
                  <span className="text-[8px] text-[#355C4B] font-bold mt-1 uppercase">Monthly</span>
                </div>
              </>
            )}
          </div>

          {/* Specified 6 categories progress list */}
          <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
            {budgetSpendData.map((item) => {
              const spentPct = item.limit > 0 ? Math.min(100, Math.floor((item.value / item.limit) * 100)) : 0;
              const displayPct = item.limit > 0 ? Math.floor((item.value / item.limit) * 100) : 0;
              return (
                <div key={item.name} className="space-y-0.5 text-[#1F2933]">
                  <div className="flex justify-between text-[9px] font-bold text-slate-700">
                    <span className="flex items-center space-x-1.5 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="truncate">{item.name}</span>
                      {displayPct >= 100 ? (
                        <span className="px-1 py-[0.5px] bg-red-50 text-red-600 border border-red-150 text-[6.5px] font-black uppercase rounded shrink-0 scale-90 origin-left">Red Warning</span>
                      ) : displayPct >= 90 ? (
                        <span className="px-1 py-[0.5px] bg-orange-50 text-orange-600 border border-orange-150 text-[6.5px] font-black uppercase rounded shrink-0 scale-90 origin-left">Orange Warning</span>
                      ) : displayPct >= 80 ? (
                        <span className="px-1 py-[0.5px] bg-yellow-50 text-yellow-750 border border-yellow-250 text-[6.5px] font-black uppercase rounded shrink-0 scale-90 origin-left">Yellow Warning</span>
                      ) : null}
                    </span>
                    <span>{formatRupee(item.value)} / {item.limit > 0 ? formatRupee(item.limit) : 'No Limit'} ({displayPct}%)</span>
                  </div>
                  <div className="w-full bg-[#EEF6F2] h-1.5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${item.limit > 0 ? spentPct : 0}%`, backgroundColor: item.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* RECENT TRANSACTIONS & GOALS AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* 4. RECENT TRANSACTIONS TABLE (Occupies 2 columns on desktop) */}
        <div className="bg-white p-5 rounded-2xl border border-[#DCE8E1] shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Audit trail Ledger</span>
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Recent Transactions</h2>
              <p className="text-[10px] text-slate-400 font-medium">Real-time ledger entries filtered dynamically</p>
            </div>
            
            <button 
              onClick={() => onNavigate(Page.TRANSACTIONS)}
              className="text-[10px] font-extrabold text-[#D6A51D] uppercase hover:underline flex items-center space-x-1"
            >
              <span>Manage Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px] sm:min-w-full">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Payment Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/10 rounded-full text-slate-350 dark:text-slate-500">
                          <Search className="w-8 h-8 mx-auto stroke-[1.5]" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
                            No matching transactions found
                          </p>
                          <p className="text-xs text-slate-400 max-w-xs mx-auto">
                            {searchQuery 
                              ? `We couldn't find any results matching "${searchQuery}". Try double check spelling or categories.`
                              : 'No transactions recorded for the selected period yet.'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx: any) => (
                    <tr 
                      key={tx.id} 
                      className="hover:bg-slate-50 border-b border-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-400 truncate">
                        {tx.date}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-[180px]">
                          <span className="font-extrabold text-slate-800 truncate">{tx.description}</span>
                          {tx.isOfflinePending && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse border border-amber-500/20 shrink-0">
                              Offline
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block text-[8px] font-extrabold uppercase bg-[#EEF6F2] text-[#355C4B] px-2 py-0.5 rounded-full border border-[#DCE8E1]">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[10px] text-slate-500 font-semibold truncate">
                        {tx.paymentMethod}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono">
                        <span className={tx.type === 'income' ? 'text-[#4CAF50]' : 'text-[#E85D5D]'}>
                          {tx.type === 'income' ? '+' : '-'}{formatRupee(tx.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center space-x-1">
                          <button 
                            onClick={() => handleEditInit(tx)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                            title="Edit Transaction"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteInit(tx.id)}
                            className="p-1 rounded hover:bg-rose-50 text-rose-500 transition-colors"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: stacked SAVINGS GOALS and RECENT ACTIVITY FEED */}
        <div className="flex flex-col space-y-5 lg:col-span-1 text-[#1F2933]">
          
          {/* 5. SAVINGS GOALS CARD */}
          <div className="bg-white p-5 rounded-2xl border border-[#DCE8E1] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Milestones tracker</span>
                  <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Active Saving Goals</h2>
                  <p className="text-[10px] text-slate-400 font-medium">Acquisitions and target reserves progress</p>
                </div>
                <Sparkles className="w-5 h-5 text-[#D6A51D] animate-pulse" />
              </div>

              <div className="space-y-4">
                {displayGoals.map((g) => {
                  const percentage = Math.min(100, Math.floor((g.current / g.target) * 100));
                  const IconComponent = g.logo;
                  return (
                    <div key={g.name} className="space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-white shadow-xs text-[#355C4B]">
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-800 text-[11px] uppercase tracking-tight">{g.name}</p>
                            <p className="text-[9px] text-slate-400">Target: {formatRupee(g.target)}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold bg-[#EEF6F2] px-2 py-0.5 rounded-full text-[#355C4B] border border-[#DCE8E1]">
                          {percentage}%
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="w-full bg-[#EEF6F2] h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ width: `${percentage}%`, backgroundColor: g.color }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-450 font-medium">
                          <span>Saved: {formatRupee(g.current)}</span>
                          <span>Remaining: {formatRupee(Math.max(0, g.target - g.current))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <button 
              onClick={() => onNavigate(Page.SAVINGS)}
              className="w-full mt-4 text-center text-xs text-[#355C4B] hover:text-[#274437] font-extrabold py-2 rounded-xl bg-[#EEF6F2] hover:bg-[#dce8e1] border border-[#DCE8E1] transition-all"
            >
              Manage Goals Inventory
            </button>
          </div>

          {/* 6. RECENT ACTIVITY STREAM CARD */}
          <div className="bg-white p-5 rounded-2xl border border-[#DCE8E1] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Database audit log</span>
                  <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Recent Activity Stream</h2>
                  <p className="text-[10px] text-slate-400 font-medium">Dynamic lifestyle events logged to Firestore</p>
                </div>
                <Layers className="w-5 h-5 text-[#355C4B]" />
              </div>

              <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                {(appNotifications && appNotifications.length > 0) ? (
                  appNotifications.slice(0, 5).map((n) => {
                    const isSalary = n.text.toLowerCase().includes('salary') || n.text.toLowerCase().includes('income');
                    const isExpense = n.text.toLowerCase().includes('expense') || n.text.toLowerCase().includes('outflow');
                    const isGoal = n.text.toLowerCase().includes('goal');
                    const isBudget = n.text.toLowerCase().includes('budget');
                    
                    return (
                      <div key={n.id} className="flex items-start space-x-2.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          isSalary ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          isExpense ? 'bg-rose-50 text-rose-500 border border-rose-100' :
                          isGoal ? 'bg-amber-50 text-[#D6A51D] border border-amber-100' :
                          isBudget ? 'bg-teal-50 text-teal-600 border border-teal-100' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {isSalary ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                           isExpense ? <ArrowDownRight className="w-3.5 h-3.5" /> :
                           isGoal ? <Award className="w-3.5 h-3.5" /> :
                           isBudget ? <Layers className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-700 font-bold leading-normal">{n.text}</p>
                          <p className="text-[8px] text-slate-400 font-mono">
                            {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2 border border-dashed rounded-xl border-slate-150">
                    <CheckCircle className="w-6 h-6 text-slate-350" />
                    <p className="font-semibold text-[10px]">No telemetry logged</p>
                    <p className="text-[9px] text-slate-400">All databases synced completely</p>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => onNavigate(Page.DASHBOARD)}
              className="w-full mt-4 text-center text-xs text-[#355C4B] hover:text-[#274437] font-extrabold py-2 rounded-xl bg-[#EEF6F2] hover:bg-[#dce8e1] border border-[#DCE8E1] transition-all"
            >
              Sync Activity records
            </button>
          </div>

        </div>

      </div>

      {/* TRANSACTION MODAL */}
      {isTxModalOpen && (
        <div className="fixed top-0 left-0 w-full h-[100vh] z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-overlay">
          <div className="w-full max-w-sm p-5 rounded-2xl shadow-2xl border relative bg-white border-[#DCE8E1] text-slate-800 max-h-[calc(100vh-32px)] overflow-y-auto animate-modal-content">
            <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 mb-3 text-center uppercase tracking-wider text-[#355C4B]">
              {txEditId ? 'Edit Ledger Entry' : 'Log New Transaction'}
            </h3>

            <form onSubmit={handleSaveTransaction} className="space-y-3">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Flow Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button" 
                    onClick={() => { setTxType('expense'); setTxCategory('Food & Groceries'); }}
                    className={`p-2 rounded-xl text-center text-xs font-semibold ${
                      txType === 'expense' 
                        ? 'bg-[#E85D5D] text-white' 
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setTxType('income'); setTxCategory('Salary'); }}
                    className={`p-2 rounded-xl text-center text-xs font-semibold ${
                      txType === 'income' 
                        ? 'bg-[#4CAF50] text-white' 
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    Income (+)
                  </button>
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Description</label>
                <input 
                  type="text" 
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="e.g. Starbucks Latte, Rent Payment"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#355C4B] font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Category</label>
                  <select 
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium"
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
                    value={txWallet}
                    onChange={(e) => setTxWallet(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Amount ({currencySymbolDisplay})</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#355C4B] font-medium"
                    required
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Date</label>
                  <input 
                    type="date" 
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsTxModalOpen(false)}
                  className="flex-1 p-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 p-2 bg-[#355C4B] hover:bg-[#274437] text-white rounded-xl text-xs font-semibold transition-colors shadow-md"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
