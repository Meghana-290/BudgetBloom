import React, { useState, useEffect } from 'react';
import { Goal, UserProfile, Transaction } from '../types';
import { formatRupee } from '../utils/format';
import { addGoal, updateGoal, deleteGoal } from '../dbHelper';
import { 
  PlusCircle, 
  TrendingUp, 
  Sparkles, 
  Trash2, 
  DollarSign, 
  ChevronRight, 
  Calendar,
  AlertCircle
} from 'lucide-react';

interface SavingsTabProps {
  goals: Goal[];
  profile: UserProfile | null;
  transactions: Transaction[];
  currencySymbol: string;
  darkMode: boolean;
  filterMonth?: string;
  filterYear?: string;
  filterDate?: string;
  activeQuickFilter?: 'today' | 'week' | 'month' | 'year' | 'all' | null;
}

export default function SavingsTab({
  goals,
  profile,
  transactions,
  currencySymbol,
  darkMode,
  filterMonth,
  filterYear,
  filterDate,
  activeQuickFilter
}: SavingsTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  // Contribution Form State
  const [isContribOpen, setIsContribOpen] = useState(false);
  const [activeContribGoal, setActiveContribGoal] = useState<Goal | null>(null);
  const [contribValue, setContribValue] = useState('');

  // Prevent page scroll when modal is open
  useEffect(() => {
    if (isOpen || isContribOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isContribOpen]);

  // Calculate user's average savings rate based on transactions
  const monthlyIncomes = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const userMonthlySavingsRate = Math.max(100, monthlyIncomes - monthlyExpenses); // Fallback to $100 min/mo rate

  // Forecast prediction
  const getGoalForecast = (g: Goal) => {
    const remaining = g.targetAmount - g.currentAmount;
    if (remaining <= 0) return 'Fully Achieved! 🎉';
    
    // Remaining / monthly savings rate
    const monthsNeeded = Math.ceil(remaining / userMonthlySavingsRate);
    if (monthsNeeded === 1) return 'Predicted completion in ~1 month';
    if (monthsNeeded > 12) {
      const years = (monthsNeeded / 12).toFixed(1);
      return `Predicted completion in ~${years} years`;
    }
    return `Predicted completion in ~${monthsNeeded} months`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetAmount || !currentAmount || !profile) return;

    const targetNum = parseFloat(targetAmount);
    const currentNum = parseFloat(currentAmount);

    if (isNaN(targetNum) || targetNum <= 0 || isNaN(currentNum) || currentNum < 0) return;

    if (editId) {
      await updateGoal(editId, {
        name,
        targetAmount: targetNum,
        currentAmount: currentNum,
        targetDate
      });
    } else {
      await addGoal({
        userId: profile.uid,
        name,
        targetAmount: targetNum,
        currentAmount: currentNum,
        targetDate
      });
    }

    setIsOpen(false);
    resetForm();
  };

  const handleContributionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContribGoal || !contribValue) return;

    const contribNum = parseFloat(contribValue);
    if (isNaN(contribNum) || contribNum <= 0) return;

    const newAmount = Math.min(activeContribGoal.targetAmount, activeContribGoal.currentAmount + contribNum);
    await updateGoal(activeContribGoal.id, { currentAmount: newAmount });

    setIsContribOpen(false);
    setContribValue('');
    setActiveContribGoal(null);
  };

  const handleEdit = (g: Goal) => {
    setEditId(g.id);
    setName(g.name);
    setTargetAmount(g.targetAmount.toString());
    setCurrentAmount(g.currentAmount.toString());
    setTargetDate(g.targetDate);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this savings goal permanently?')) {
      await deleteGoal(id);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-brand-navy dark:text-white">Savings Milestones</h2>
          <p className="text-sm text-slate-400 mt-1">Set targets, log partial savings, and track your forecasted completion timelines.</p>
        </div>

        <button 
          onClick={() => { resetForm(); setIsOpen(true); }}
          className="flex items-center space-x-2 py-2.5 px-4 rounded-xl bg-brand-green hover:bg-brand-green-hover text-xs font-bold text-white shadow shadow-brand-green/10"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Define New Goal</span>
        </button>
      </div>

      {/* RECENT ANALYTICS INSIGHTS */}
      <div className={`p-5 rounded-3xl border ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
      } flex flex-col md:flex-row justify-between gap-6`}>
        <div className="flex items-start space-x-3 max-w-lg">
          <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl shrink-0">
            <Sparkles className="w-5 h-5 flex shrink-0" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">Predictive Goal Intelligence</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              BudgetBloom analyzes your net real-time income surplus (currently averaging <span className="font-bold text-brand-green">{formatRupee(userMonthlySavingsRate)}</span> monthly delta) to predict exact calendar completion periods automatically.
            </p>
          </div>
        </div>
      </div>

      {/* GOALS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map((g) => {
          const pct = Math.min(100, Math.floor((g.currentAmount / g.targetAmount) * 100));
          return (
            <div 
              key={g.id} 
              className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between space-y-6 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-base text-brand-navy dark:text-white">{g.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Target deadline: {g.targetDate}
                    </p>
                  </div>

                  <div className="flex space-x-1.5">
                    <button 
                      onClick={() => { setActiveContribGoal(g); setIsContribOpen(true); }}
                      className="text-[10px] font-bold border border-brand-green/20 text-brand-green hover:bg-brand-green/5 py-1.5 px-3 rounded-lg transition-colors mr-2"
                    >
                      Contribute
                    </button>
                    <button 
                      onClick={() => handleEdit(g)}
                      className="p-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(g.id)}
                      className="p-1 px-1.5 rounded-lg border border-rose-500/10 text-rose-500 hover:bg-rose-500/5 transition-all text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* PRORESS RATIO DETAILS */}
                <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Accumulated savings</p>
                    <p className="font-display font-extrabold text-xl text-brand-green">
                      {formatRupee(g.currentAmount)} <span className="text-xs font-normal text-slate-400">/ {formatRupee(g.targetAmount)}</span>
                    </p>
                  </div>
                  <span className="font-display font-black text-2xl text-slate-300 dark:text-slate-700">{pct}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-brand-green h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                </div>
              </div>

              {/* Forecast panel */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
                darkMode ? 'bg-slate-800/20 border-slate-800/80' : 'bg-slate-50 border-slate-100'
              }`}>
                <span className="text-slate-400 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Predictions:
                </span>
                <span className="text-brand-green font-bold text-right">{getGoalForecast(g)}</span>
              </div>
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs border border-dashed rounded-3xl border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-300" />
            <p>No active milestones defined.</p>
            <button
              onClick={() => {
                resetForm();
                setIsOpen(true);
              }}
              className="px-4 py-2 bg-brand-green hover:bg-[#274437] text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              + Create Goal
            </button>
          </div>
        )}
      </div>

      {/* CREATE/EDIT GOAL MODAL */}
      {isOpen && (
        <div className="fixed top-0 left-0 w-full h-[100vh] z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-overlay">
          <div className={`w-full max-w-sm p-6 rounded-3xl shadow-2xl border relative max-h-[calc(100vh-32px)] overflow-y-auto animate-modal-content ${
            darkMode ? 'bg-[#0F172A] border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <h3 className="font-display font-bold text-lg mb-4">
              {editId ? 'Edit Savings Goal' : 'Define Savings Goal'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Goal Title</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. New Laptop, Travel Fund"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Target ({currencySymbol})</label>
                  <input 
                    type="number" 
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="2500"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Initial Saved ({currencySymbol})</label>
                  <input 
                    type="number" 
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    placeholder="0"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Target Date</label>
                <input 
                  type="date" 
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 p-2.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl text-xs font-semibold shadow"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTRIBUTION MODAL */}
      {isContribOpen && activeContribGoal && (
        <div className="fixed top-0 left-0 w-full h-[100vh] z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-overlay">
          <div className={`w-full max-w-xs p-6 rounded-3xl shadow-2xl border relative max-h-[calc(100vh-32px)] overflow-y-auto animate-modal-content ${
            darkMode ? 'bg-[#0F172A] border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <h4 className="font-display font-extrabold text-sm mb-2">Contribute to {activeContribGoal.name}</h4>
            <p className="text-xs text-slate-400 mb-4">Transfer cash resources directly towards this goal's target accumulation bucket.</p>

            <form onSubmit={handleContributionSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Transfer Amount ({currencySymbol})</label>
                <input 
                  type="number" 
                  step="1"
                  value={contribValue}
                  onChange={(e) => setContribValue(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold focus:outline-none"
                  required
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsContribOpen(false); setActiveContribGoal(null); }}
                  className="flex-1 p-2 border rounded-xl text-xs font-semibold hover:bg-slate-55"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 p-2 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl text-xs font-semibold shadow"
                >
                  Log Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
