import React, { useState, useEffect } from 'react';
import { Transaction, Wallet, UserProfile } from '../types';
import { formatRupee } from '../utils/format';
import { 
  addTransaction, 
  updateTransaction, 
  deleteTransaction 
} from '../dbHelper';
import { 
  PlusCircle, 
  Search, 
  Calendar, 
  Filter, 
  Trash2, 
  Edit3, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Minus,
  Sparkles
} from 'lucide-react';

interface TransactionsTabProps {
  transactions: Transaction[];
  wallets: Wallet[];
  profile: UserProfile | null;
  currencySymbol: string;
  darkMode: boolean;
  filterMonthGlobal?: string;
  filterYearGlobal?: string;
  onAddTransaction?: (type: 'income' | 'expense', scannerOpen?: boolean) => void;
}

export default function TransactionsTab({
  transactions,
  wallets,
  profile,
  currencySymbol,
  darkMode,
  filterMonthGlobal,
  filterYearGlobal,
  onAddTransaction
}: TransactionsTabProps) {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterDateRange, setFilterDateRange] = useState('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState('All');

  // Synchronize dynamic global selectors
  React.useEffect(() => {
    if (filterYearGlobal && filterMonthGlobal) {
      if (filterYearGlobal !== 'all' && filterMonthGlobal !== 'all') {
        setFilterMonth(`${filterYearGlobal}-${filterMonthGlobal}`);
      } else if (filterYearGlobal !== 'all') {
        // If only year selected, see if any transaction starts with it
        setFilterMonth('All');
      } else {
        setFilterMonth('All');
      }
    }
  }, [filterYearGlobal, filterMonthGlobal]);

  // Modal forms
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Prevent page scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('Food & Groceries');
  const [walletName, setWalletName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Categories list
  const expenseCategories = ['Food & Groceries', 'Shopping', 'Rent', 'Bills & Utilities', 'Healthcare', 'Education', 'Transportation', 'Entertainment', 'Other'];
  const incomeCategories = ['Salary', 'Internship', 'Freelance', 'Business', 'Investments', 'Gift', 'Other'];
  const allCategories = Array.from(new Set(['All', ...expenseCategories, ...incomeCategories]));

  // Months lists (from records dynamically)
  const monthsSet = new Set<string>();
  transactions.forEach((t) => {
    if (t.date && t.date.length >= 7) {
      monthsSet.add(t.date.substring(0, 7));
    }
  });
  const months = ['All', ...Array.from(monthsSet).sort().reverse()];

  // Helper code to map a range name into start & end date strings
  const getDateRangeBounds = (range: string) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    let start = '';
    let end = '';

    const formatD = (d: Date) => d.toISOString().split('T')[0];

    switch (range) {
      case 'Today':
        start = todayStr;
        end = todayStr;
        break;
      case 'Yesterday': {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        start = formatD(d);
        end = formatD(d);
        break;
      }
      case 'This Week': {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        start = formatD(monday);
        end = formatD(sunday);
        break;
      }
      case 'Last Week': {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
        const prevMonday = new Date(d.setDate(diff));
        const prevSunday = new Date(prevMonday);
        prevSunday.setDate(prevMonday.getDate() + 6);
        start = formatD(prevMonday);
        end = formatD(prevSunday);
        break;
      }
      case 'This Month': {
        const d = new Date();
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        start = formatD(firstDay);
        end = formatD(lastDay);
        break;
      }
      case 'Last Month': {
        const d = new Date();
        const firstDay = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth(), 0);
        start = formatD(firstDay);
        end = formatD(lastDay);
        break;
      }
      case 'This Year': {
        const d = new Date();
        start = `${d.getFullYear()}-01-01`;
        end = `${d.getFullYear()}-12-31`;
        break;
      }
      case 'Last Year': {
        const d = new Date();
        start = `${d.getFullYear() - 1}-01-01`;
        end = `${d.getFullYear() - 1}-12-31`;
        break;
      }
      case 'Custom':
        start = customStartDate;
        end = customEndDate;
        break;
      default:
        break;
    }
    return { start, end };
  };

  // Filter application
  const filteredTransactions = transactions.filter((t) => {
    // Search fields: Amount, Category, Notes, Date, Description
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      t.description.toLowerCase().includes(query) || 
      t.category.toLowerCase().includes(query) || 
      t.date.includes(query) ||
      t.amount.toString().includes(query) ||
      (t.notes && t.notes.toLowerCase().includes(query));

    const matchesMonth = filterMonth === 'All' || t.date.startsWith(filterMonth);
    const matchesCategory = filterCategory === 'All' || t.category === filterCategory;
    const matchesType = filterType === 'All' || t.type === filterType;

    // Date range filter
    let matchesRange = true;
    if (filterDateRange !== 'All') {
      const { start, end } = getDateRangeBounds(filterDateRange);
      if (start) {
        matchesRange = t.date >= start;
      }
      if (end && matchesRange) {
        matchesRange = t.date <= end;
      }
    }

    return matchesSearch && matchesMonth && matchesCategory && matchesType && matchesRange;
  });

  // Pagination slices
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !category || !amount || !profile) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const payload = {
      userId: profile.uid,
      description: desc,
      category,
      paymentMethod: walletName || wallets[0]?.name || 'Cash',
      type,
      amount: parsedAmount,
      date,
      notes: notes.trim() || '',
    };

    if (editId) {
      await updateTransaction(editId, payload);
    } else {
      await addTransaction(payload);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (t: Transaction) => {
    setEditId(t.id);
    setDesc(t.description);
    setCategory(t.category);
    setWalletName(t.paymentMethod);
    setType(t.type);
    setAmount(t.amount.toString());
    setDate(t.date);
    setNotes(t.notes || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this transaction permanently?')) {
      await deleteTransaction(id);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setDesc('');
    setCategory('Food & Groceries');
    setWalletName(wallets[0]?.name || 'Cash');
    setType('expense');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-brand-navy dark:text-white">Transaction Ledger</h2>
          <p className="text-sm text-slate-400 mt-1">Audit, log, or refine individual financial actions.</p>
        </div>

        <div className="flex flex-row items-center gap-3 self-end sm:self-auto">
          <button 
            type="button"
            title="Upload Receipt (AI Scan)"
            onClick={() => onAddTransaction?.('expense', true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#355C4B]/15 text-[#355C4B] border border-[#355C4B]/20 hover:bg-[#355C4B]/25 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95 text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D6A51D] animate-pulse" />
            <span>AI Scan Receipt</span>
          </button>
          <button 
            type="button"
            title="Add Income"
            onClick={() => { resetForm(); setType('income'); setCategory('Salary'); setIsModalOpen(true); }}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-green/15 text-brand-green border border-brand-green/20 hover:bg-brand-green/25 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
          <button 
            type="button"
            title="Add Expense"
            onClick={() => { resetForm(); setType('expense'); setCategory('Food & Groceries'); setIsModalOpen(true); }}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-600/15 text-rose-600 border border-rose-600/20 hover:bg-rose-600/25 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <Minus className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className={`p-4 rounded-2xl border ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
      } flex flex-wrap gap-4 items-center`}>
        
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search keywords, amount, category, date or notes..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-green ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}
          />
        </div>

        {/* Date Range preset */}
        <div className="flex flex-col space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-400 font-sans">Date Range Filter</label>
          <select 
            value={filterDateRange} 
            onChange={(e) => { setFilterDateRange(e.target.value); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-xl text-xs font-medium border ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-650'
            }`}
          >
            <option value="All">All Time</option>
            <option value="Today">Today</option>
            <option value="Yesterday">Yesterday</option>
            <option value="This Week">This Week</option>
            <option value="Last Week">Last Week</option>
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
            <option value="This Year">This Year</option>
            <option value="Last Year">Last Year</option>
            <option value="Custom">Custom Date Range</option>
          </select>
        </div>

        {/* Custom Range Picks */}
        {filterDateRange === 'Custom' && (
          <>
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Start Date</label>
              <input 
                type="date"
                value={customStartDate}
                onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-[#1F2933]'
                }`}
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">End Date</label>
              <input 
                type="date"
                value={customEndDate}
                onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-[#1F2933]'
                }`}
              />
            </div>
          </>
        )}

        {/* Month */}
        <div className="flex flex-col space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-400 font-sans">Month</label>
          <select 
            value={filterMonth} 
            onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-xl text-xs font-medium border ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-650'
            }`}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m === 'All' ? 'All Months' : m}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="flex flex-col space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-400 font-sans">Category</label>
          <select 
            value={filterCategory} 
            onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-xl text-xs font-medium border ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-650'
            }`}
          >
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>

        {/* Action Type */}
        <div className="flex flex-col space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-400 font-sans">Txn Type</label>
          <select 
            value={filterType} 
            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-xl text-xs font-medium border ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-650'
            }`}
          >
            <option value="All">All Flows</option>
            <option value="income">Income (+)</option>
            <option value="expense">Expense (-)</option>
          </select>
        </div>

      </div>

      {/* LEDGER GRID TABLE */}
      <div className={`p-4 rounded-3xl border shadow-sm overflow-hidden ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px] sm:min-w-full">
            <thead>
              <tr className="border-b border-slate-200/50 dark:border-slate-800/80 text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Wallet Option</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50 text-xs">
              {paginatedTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-400">{t.date}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-navy dark:text-white">{t.description}</span>
                      {t.isOfflinePending && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse border border-amber-500/20">
                          Offline Pending
                        </span>
                      )}
                    </div>
                    {t.notes && (
                      <div className="text-[10px] text-slate-400 font-medium italic mt-0.5 max-w-[200px] truncate" title={t.notes}>
                        {t.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${
                      t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-brand-sky'
                    }`}>
                      {t.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-450 font-medium">{t.paymentMethod}</td>
                  <td className="py-3.5 px-4 uppercase text-[10px] font-bold">
                    <span className={t.type === 'income' ? 'text-brand-green' : 'text-rose-500'}>{t.type}</span>
                  </td>
                  <td className={`py-3.5 px-4 font-extrabold ${t.type === 'income' ? 'text-brand-green' : 'text-rose-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatRupee(t.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => handleEdit(t)}
                        className="p-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Entry"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-1 px-1.5 rounded-lg border border-rose-500/10 text-rose-500 hover:bg-rose-500/5 transition-colors"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3.5">
                      <span className="font-semibold text-sm">No transactions found</span>
                      {filterType === 'income' ? (
                        <button
                          onClick={() => {
                            resetForm();
                            setType('income');
                            setIsModalOpen(true);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                          + Add Income
                        </button>
                      ) : filterType === 'expense' ? (
                        <button
                          onClick={() => {
                            resetForm();
                            setType('expense');
                            setIsModalOpen(true);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                          + Add Expense
                        </button>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              resetForm();
                              setType('income');
                              setIsModalOpen(true);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                          >
                            + Add Income
                          </button>
                          <button
                            onClick={() => {
                              resetForm();
                              setType('expense');
                              setIsModalOpen(true);
                            }}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                          >
                            + Add Expense
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION PANEL */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 text-xs font-semibold">
            <span className="text-slate-400">
              Showing Page {currentPage} of {totalPages}
            </span>

            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CORE MODAL DIALOG */}
      {isModalOpen && (
        <div className="fixed top-0 left-0 w-full h-[100vh] z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-overlay">
          <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl border relative max-h-[calc(100vh-32px)] overflow-y-auto animate-modal-content ${
            darkMode ? 'bg-[#0F172A] border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <h3 className="font-display font-bold text-lg mb-4">
              {editId ? 'Refine Transaction Log' : 'Create Transaction Entry'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Flow Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button" 
                    onClick={() => { setType('expense'); setCategory('Food & Groceries'); }}
                    className={`p-2 rounded-xl text-center text-xs font-semibold ${
                      type === 'expense' ? 'bg-rose-500 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setType('income'); setCategory('Salary'); }}
                    className={`p-2 rounded-xl text-center text-xs font-semibold ${
                      type === 'income' ? 'bg-brand-green text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    Income (+)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Log Description</label>
                <input 
                  type="text" 
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Monthly Grocery, Freelance Inflow"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-1 focus:ring-brand-green font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500"
                    required
                  >
                    {type === 'expense' 
                      ? expenseCategories.map(c => <option key={c} value={c}>{c}</option>)
                      : incomeCategories.map(c => <option key={c} value={c}>{c}</option>)
                    }
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Payment Method</label>
                  <select 
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500"
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
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Amount ({currencySymbol})</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-1 focus:ring-brand-green font-medium"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Entry Date</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Notes (Optional)</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes, e.g., bill details, splitting info, tags..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-1 focus:ring-brand-green font-medium bg-transparent text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 p-2.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl text-xs font-semibold shadow"
                >
                  Submit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
