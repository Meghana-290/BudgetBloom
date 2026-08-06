import React, { useState, useEffect } from 'react';
import { Budget, UserProfile, Transaction } from '../types';
import { formatRupee } from '../utils/format';
import { setBudget, deleteBudget } from '../dbHelper';
import { safeStorage } from '../utils/storage';
import { 
  PlusCircle, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  Sparkles,
  AlertCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  TrendingDown,
  Lightbulb,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Brain
} from 'lucide-react';

interface BudgetsTabProps {
  budgets: Budget[];
  profile: UserProfile | null;
  transactions: Transaction[];
  currencySymbol: string;
  darkMode: boolean;
  filterMonth?: string;
  filterYear?: string;
}

export default function BudgetsTab({
  budgets,
  profile,
  transactions,
  currencySymbol,
  darkMode,
  filterMonth,
  filterYear
}: BudgetsTabProps) {
  const [isOpen, setIsOpen] = useState(false);

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
  const [category, setCategory] = useState('Food & Groceries');
  const [limit, setLimit] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-06'); // Standard active dashboard month

  React.useEffect(() => {
    const targetYStr = filterYear === 'all' ? '2026' : (filterYear || '2026');
    const targetMStr = filterMonth === 'all' ? '06' : (filterMonth || '06');
    setSelectedMonth(`${targetYStr}-${targetMStr}`);
  }, [filterMonth, filterYear]);
  
  const categoriesList = ['Food & Groceries', 'Shopping', 'Rent', 'Bills & Utilities', 'Healthcare', 'Education', 'Transportation', 'Entertainment', 'Other'];

  // Income configuration states
  const [customIncome, setCustomIncome] = useState<string>(() => {
    return safeStorage.getItem('budgetbloom_user_income_override') || '';
  });

  const currentMonthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
  const filteredBudgets = budgets.filter(b => b.month === selectedMonth);

  const detectedIncome = transactions
    .filter(t => t.date.startsWith(selectedMonth) && t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyIncome = customIncome ? parseFloat(customIncome) : (detectedIncome || 50000);

  // AI-powered spending prediction/budget suggestions state
  const [aiInsights, setAiInsights] = useState<any | null>(() => {
    const cached = safeStorage.getItem('budgetbloom_ai_budgets_insights');
    return cached ? JSON.parse(cached) : null;
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [appliedCategories, setAppliedCategories] = useState<{ [key: string]: boolean }>({});
  const [isAiSectionCollapsed, setIsAiSectionCollapsed] = useState(false);

  const generateAiInsights = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/budget-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactions,
          budgets,
          income: monthlyIncome
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate AI budget insights.");
      }

      const resJson = await response.json();
      if (!resJson.success || !resJson.data) {
        throw new Error("Invalid response format received from AI endpoint.");
      }

      setAiInsights(resJson.data);
      safeStorage.setItem('budgetbloom_ai_budgets_insights', JSON.stringify(resJson.data));
    } catch (err: any) {
      console.error("AI budget insights generation failed:", err);
      setAiError(err.message || "An unexpected error occurred while analyzing patterns.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplySuggestedBudget = async (categoryName: string, limitNum: number) => {
    if (!profile) return;
    try {
      await setBudget({
        userId: profile.uid,
        category: categoryName,
        limit: limitNum,
        month: selectedMonth
      });
      setAppliedCategories(prev => ({ ...prev, [categoryName]: true }));
      setTimeout(() => {
        setAppliedCategories(prev => ({ ...prev, [categoryName]: false }));
      }, 3000);
    } catch (err) {
      console.error("Failed to apply suggested budget limit:", err);
    }
  };

  // 2. Real-time enrichment of thresholds
  const enrichedBudgets = filteredBudgets.map((b) => {
    const totalSpent = currentMonthTransactions
      .filter((t) => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
      .reduce((sum, t) => sum + t.amount, 0);

    const pct = b.limit > 0 ? Math.min(100, Math.floor((totalSpent / b.limit) * 100)) : 0;
    const remaining = Math.max(0, b.limit - totalSpent);
    const exceeded = totalSpent > b.limit;

    return {
      ...b,
      spent: totalSpent,
      percentage: pct,
      remaining,
      exceeded
    };
  });

  const currencySymbolDisplay = '₹';

  // Summaries
  const cumulativeBudgetLimit = filteredBudgets.reduce((sum, b) => sum + b.limit, 0);
  const cumulativeActualSpent = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRemainingBuffer = enrichedBudgets.reduce((sum, b) => sum + b.remaining, 0);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limit || !profile) return;

    const limitNum = parseFloat(limit);
    if (isNaN(limitNum) || limitNum < 0) return;

    await setBudget({
      userId: profile.uid,
      category,
      limit: limitNum,
      month: selectedMonth
    });

    setIsOpen(false);
    setLimit('');
  };

  const handleDeleteBudget = async (id: string) => {
    if (confirm('Delete this budget limit permanently?')) {
      await deleteBudget(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-[#1F2933]">
      
      {/* HEADER SECTION WITH MONTH SELECTION */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 p-5 bg-[#355C4B] rounded-2xl text-white shadow-lg border border-[#274437]">
        <div className="space-y-0.5">
          <span className="bg-[#D6A51D] text-slate-950 font-mono text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-inner">
            Real-Time Spending Guard
          </span>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl mt-1.5 tracking-tight">
            Configure Category-Specific Budgets
          </h2>
          <p className="text-xs text-[#DCE8E1]/85">
            Identify thresholds, track consumption speed, and lock down potential overspending.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Dynamic Month Selector */}
          <div className="p-2 px-3.5 rounded-xl bg-[#274437] border border-[#436F5C] flex items-center space-x-2 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-[#D6A51D]" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-white font-medium"
            >
              <option value="2026-06" className="text-slate-900">June 2026</option>
              <option value="2026-05" className="text-slate-900">May 2026</option>
              <option value="2026-04" className="text-slate-900">April 2026</option>
            </select>
          </div>

          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center space-x-2 py-2 px-4 rounded-xl bg-[#D6A51D] hover:bg-[#b08713] text-xs font-extrabold text-slate-950 shadow-md transition-all font-sans"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Configure Category Limit</span>
          </button>
        </div>
      </div>

      {/* BUDGET AI ADVISOR SECTION */}
      <div className="bg-white rounded-2xl border border-[#DCE8E1] shadow-sm hover:shadow-md transition-all overflow-hidden" id="budget-ai-advisor-card">
        {/* Top Header Row representing state control */}
        <div className="p-4.5 bg-gradient-to-r from-[#F0F7F4] to-white border-b border-[#E9F0EC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#355C4B]/10 text-[#355C4B] rounded-xl">
              <Brain className="w-5 h-5 text-[#355C4B] shrink-0" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-sm text-[#355C4B] flex items-center gap-1.5 leading-none">
                Budget AI Advisor
                <Sparkles className="w-3.5 h-3.5 text-[#D6A51D] shrink-0 animate-pulse" />
              </h3>
              <p className="text-[10px] text-slate-450 font-medium">Overspending diagnostics & tailored limit allocations based on your income</p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 self-end sm:self-auto">
            {aiInsights && (
              <button
                onClick={generateAiInsights}
                disabled={aiLoading}
                className="p-1.5 text-slate-400 hover:text-[#355C4B] rounded-lg hover:bg-[#EEF6F2] transition-colors"
                title="Recalculate Advisor recommendations"
              >
                <RefreshCw className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setIsAiSectionCollapsed(!isAiSectionCollapsed)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 text-[10px] font-bold hover:bg-slate-50 flex items-center gap-1 transition-all"
            >
              {isAiSectionCollapsed ? (
                <>
                  <span>Expand Advisor</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Collapse Advisor</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Body */}
        {!isAiSectionCollapsed && (
          <div className="p-5 space-y-5">
            
            {/* INCOME CONFIGURATION PANEL */}
            <div className="p-4 rounded-xl bg-[#EEF6F2]/40 border border-[#D1E6DB]/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-[#355C4B] uppercase tracking-wider block">Income Diagnostic Baseline</span>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  We auto-detected <span className="font-bold text-slate-800">{formatRupee(detectedIncome)}</span> in income transactions this month. Specify your exact monthly income below to let the Advisor calculate optimal saving boundaries.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    placeholder="Enter monthly income"
                    value={customIncome}
                    onChange={(e) => {
                      setCustomIncome(e.target.value);
                      safeStorage.setItem('budgetbloom_user_income_override', e.target.value);
                    }}
                    className="pl-6 pr-3 py-1.5 w-36 rounded-lg border border-[#BEDECB] text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#355C4B]"
                  />
                </div>
                {!aiInsights && !aiLoading && (
                  <button
                    onClick={generateAiInsights}
                    className="px-3.5 py-1.5 bg-[#355C4B] hover:bg-[#274437] text-white text-xs font-bold rounded-lg transition"
                  >
                    Analyze & Advise
                  </button>
                )}
              </div>
            </div>

            {/* 1. Initial State: Invite user to analyze */}
            {!aiInsights && !aiLoading && !aiError && (
              <div className="py-8 text-center max-w-xl mx-auto space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#355C4B]/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#355C4B] animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-800 text-sm">Advisor Diagnostics Ready</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    Let Gemini AI inspect your monthly income of <span className="font-bold text-slate-700">{formatRupee(monthlyIncome)}</span>, evaluate overspending habits, and suggest specific, actionable category limits to boost your financial cushion.
                  </p>
                </div>
                <button
                  onClick={generateAiInsights}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#355C4B] hover:bg-[#274437] text-white text-xs font-bold rounded-xl shadow-sm transition-all uppercase tracking-wider font-sans"
                >
                  <Brain className="w-4 h-4 text-emerald-300" />
                  <span>Run Overspending Diagnostics</span>
                </button>
              </div>
            )}

            {/* 2. Loading State */}
            {aiLoading && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3.5">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-[#355C4B]/10 border-t-[#355C4B] animate-spin"></div>
                  <Brain className="w-5 h-5 text-[#355C4B] absolute inset-0 m-auto animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[#355C4B] text-xs">AI Trend Modeling In Progress...</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Gemini is compiling transaction habits relative to your monthly income of {formatRupee(monthlyIncome)}</p>
                </div>
              </div>
            )}

            {/* 3. Error State */}
            {aiError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-semibold flex items-start gap-2 max-w-xl mx-auto">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600 animate-pulse" />
                <div>
                  <p className="font-bold">Analysis Calculation Interrupted</p>
                  <p className="text-[10px] text-red-600 font-medium mt-0.5">{aiError}</p>
                  <button
                    onClick={generateAiInsights}
                    className="mt-2.5 px-3 py-1 bg-white border border-red-200 hover:bg-red-50/50 rounded-lg text-[9px] font-extrabold text-red-700 transition"
                  >
                    Retry Diagnostics
                  </button>
                </div>
              </div>
            )}

            {/* 4. Loaded Insights & Predictions Display */}
            {aiInsights && !aiLoading && !aiError && (
              <div className="space-y-6 animate-fade-in">

                {/* INCOME ALLOCATION & METER CHART */}
                <div className="p-4 rounded-xl bg-[#FCFDFD] border border-slate-150 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Recommended Budget Floor</span>
                    <h4 className="font-display font-extrabold text-base text-slate-800">
                      {formatRupee(aiInsights.totalSuggestedLimit)} <span className="text-xs font-normal text-slate-500">Suggested Limit</span>
                    </h4>
                    <p className="text-[10px] text-slate-450 font-medium">Safe ceiling budget targets proposed by the Advisor.</p>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-500">Income Allocation Ratio</span>
                      <span className={`font-mono ${
                        (aiInsights.totalSuggestedLimit / monthlyIncome) <= 0.8 
                          ? 'text-emerald-600' 
                          : (aiInsights.totalSuggestedLimit / monthlyIncome) <= 1.0 
                          ? 'text-amber-500' 
                          : 'text-rose-500'
                      }`}>
                        {Math.floor((aiInsights.totalSuggestedLimit / monthlyIncome) * 100)}% of your {formatRupee(monthlyIncome)} income
                      </span>
                    </div>

                    <div className="w-full bg-[#EEF6F2] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.floor((aiInsights.totalSuggestedLimit / monthlyIncome) * 100))}%`,
                          backgroundColor: (aiInsights.totalSuggestedLimit / monthlyIncome) <= 0.8 ? '#355C4B' : (aiInsights.totalSuggestedLimit / monthlyIncome) <= 1.0 ? '#D6A51D' : '#E85D5D'
                        }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-semibold">
                      <span>0% (Full Savings)</span>
                      <span>80% (Maximum Recommended Limit)</span>
                      <span>100%+ (Overdraft)</span>
                    </div>
                  </div>
                </div>

                {/* DETECTED OVERSPENDING DIAGNOSTIC CARD */}
                {aiInsights.overspendingAnalysis && (
                  <div className="p-4 rounded-xl bg-rose-550/10 border border-rose-500/20 text-rose-950 space-y-1.5 shadow-3xs">
                    <div className="flex items-center space-x-2 text-rose-800">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 animate-pulse" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">
                        Detected Overspending Pattern Diagnostic
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-900 font-medium leading-relaxed">
                      {aiInsights.overspendingAnalysis}
                    </p>
                  </div>
                )}
                
                {/* Executive Summary Quote Callout */}
                <div className="p-4 rounded-xl bg-[#F8FAF9] border-l-4 border-[#355C4B] space-y-1 shadow-xs">
                  <span className="text-[9px] font-extrabold text-[#355C4B] tracking-widest uppercase flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-[#D6A51D]" />
                    AI Executive Spending Summary
                  </span>
                  <p className="text-[11px] text-[#2C4A3C] font-semibold leading-relaxed">
                    "{aiInsights.generalSummary}"
                  </p>
                </div>

                {/* Grid of optimal suggestions */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Calculated Optimal Next-Month Category Budgets
                    </span>
                    <span className="text-[10px] font-mono text-[#355C4B] bg-[#EEF6F2] py-0.5 px-2 rounded-md font-semibold">
                      Total Recommended Target Limits: <span className="font-extrabold text-[#355C4B]">{formatRupee(aiInsights.totalSuggestedLimit)}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {aiInsights.categoryInsights?.map((insight: any, idx: number) => {
                      const isApplied = appliedCategories[insight.category];
                      const isTrendUp = insight.trend?.toLowerCase() === 'up';
                      const isTrendDown = insight.trend?.toLowerCase() === 'down';

                      return (
                        <div 
                          key={idx}
                          className="p-4 rounded-xl bg-white border border-[#E9F0EC] hover:border-[#355C4B]/20 transition-all flex flex-col justify-between space-y-3 shadow-xs hover:shadow-sm"
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-display font-extrabold text-xs text-slate-800 tracking-tight flex items-center gap-1.5 capitalize">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#355C4B]/20"></span>
                                {insight.category}
                              </h4>

                              {/* Trend Badge */}
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wide ${
                                isTrendUp
                                  ? 'bg-rose-500/10 text-rose-700'
                                  : isTrendDown
                                  ? 'bg-emerald-500/10 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {isTrendUp ? (
                                  <>
                                    <TrendingDown className="w-3 h-3 text-rose-650 shrink-0" />
                                    <span>Rising</span>
                                  </>
                                ) : isTrendDown ? (
                                  <>
                                    <TrendingUp className="w-3 h-3 text-emerald-650 shrink-0" />
                                    <span>Declining</span>
                                  </>
                                ) : (
                                  <>
                                    <Percent className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>Stable</span>
                                  </>
                                )}
                              </span>
                            </div>

                            {/* Current vs Suggested metrics */}
                            <div className="grid grid-cols-2 gap-2 mt-2.5 bg-[#F9FBF9] p-2 rounded-lg border border-[#F0F5F2]">
                              <div className="space-y-0.5">
                                <span className="text-[8px] uppercase font-bold text-slate-400 block">Recent Spending</span>
                                <span className="font-mono text-[10.5px] font-bold text-slate-600">
                                  {formatRupee(insight.historicalSpent)}
                                </span>
                              </div>
                              <div className="space-y-0.5 border-l border-slate-150 pl-2">
                                <span className="text-[8px] uppercase font-bold text-[#355C4B] block">AI Ideal Target</span>
                                <span className="font-mono text-xs font-extrabold text-[#355C4B]">
                                  {formatRupee(insight.suggestedLimit)}
                                </span>
                              </div>
                            </div>

                            {/* Reasoning */}
                            <p className="text-[10px] text-slate-500 italic mt-2.5 leading-relaxed font-medium">
                              "{insight.reason}"
                            </p>
                          </div>

                          {/* Quick Interactive Button To Instantly Configure Limit */}
                          <button
                            type="button"
                            onClick={() => handleApplySuggestedBudget(insight.category, insight.suggestedLimit)}
                            disabled={isApplied}
                            className={`w-full py-2 rounded-lg text-[9px] font-extrabold transition-all duration-200 border flex items-center justify-center gap-1 ${
                              isApplied
                                ? 'bg-emerald-500 border-emerald-500 text-white animate-bounce'
                                : 'bg-[#EEF6F2] border-[#D1E6DB] text-[#355C4B] hover:bg-[#355C4B] hover:border-[#355C4B] hover:text-white hover:shadow-xs cursor-pointer'
                            }`}
                          >
                            {isApplied ? (
                              <>
                                <Check className="w-3 h-3 text-white" />
                                <span>Applied Category Bound!</span>
                              </>
                            ) : (
                              <>
                                <PlusCircle className="w-3 h-3" />
                                <span>Set Suggested Limit ({formatRupee(insight.suggestedLimit)})</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Curated Personalized Saving Guidelines */}
                <div className="pt-4 border-t border-[#F0F5F2] space-y-2.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#355C4B] flex items-center gap-1">
                    <Lightbulb className="w-4 h-4 text-[#D6A51D] animate-bounce shrink-0" />
                    Tailored Financial Action Tips
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {aiInsights.savingTips?.map((tip: string, idx: number) => (
                      <div 
                        key={idx}
                        className="p-3 rounded-lg bg-[#FCFDFD] border border-slate-100 text-[10.5px] text-slate-600 font-medium flex items-start gap-2.5 leading-relaxed shadow-3xs"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#EEF6F2] text-[#355C4B] font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                           {idx + 1}
                        </span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recalculate CTA */}
                <div className="flex flex-col sm:flex-row justify-between items-center pt-3 border-t border-[#EEF6F2] gap-3">
                  <div className="text-[10px] text-slate-400 font-medium self-start sm:self-auto">
                    Advisor analyzed spending relative to monthly income of <span className="font-bold text-slate-600">{formatRupee(monthlyIncome)}</span>.
                  </div>
                  <button
                    onClick={generateAiInsights}
                    disabled={aiLoading}
                    className="px-4 py-2 bg-[#EEF6F2] hover:bg-[#355C4B] hover:text-white text-[#355C4B] text-[10px] font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-3xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                    <span>Re-Analyze Spending Habits</span>
                  </button>
                </div>

              </div>
            )}
          </div>
        )}
      </div>

      {/* CORE BUDGET INSIGHT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Allocated Budgets */}
        <div className="p-4 rounded-xl bg-white border border-[#DCE8E1] shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cumulative Allocated Limit</span>
            <div className="p-2 rounded-lg bg-[#355C4B]/10 text-[#355C4B]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-display font-extrabold text-xl text-slate-900 leading-none">
              {formatRupee(cumulativeBudgetLimit)}
            </h3>
            <span className="text-[10px] text-slate-400 mt-1.5 block">Aggregated monthly ceiling limit</span>
          </div>
        </div>

        {/* Total Spent of Allocated */}
        <div className="p-4 rounded-xl bg-white border border-[#DCE8E1] shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Month Outflow</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-[#E85D5D]">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-display font-extrabold text-xl text-[#E85D5D] leading-none">
              {formatRupee(cumulativeActualSpent)}
            </h3>
            <span className="text-[10px] text-rose-500 font-semibold mt-1.5 block">Recorded real-time expense volume</span>
          </div>
        </div>

        {/* Remaining of Allocated */}
        <div className="p-4 rounded-xl bg-white border border-[#DCE8E1] shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Remaining Buffer</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-[#4CAF50]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-display font-extrabold text-xl text-[#4CAF50] leading-none">
              {formatRupee(totalRemainingBuffer)}
            </h3>
            <span className="text-[10px] text-emerald-600 font-medium mt-1.5 block">Buffer across category bounds</span>
          </div>
        </div>

      </div>

      {/* BUDGET LIMITS CARDS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {enrichedBudgets.map((b) => (
          <div 
            key={b.id} 
            className="p-5 rounded-xl bg-white border border-[#DCE8E1] shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
          >
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-display font-extrabold text-sm text-slate-800 capitalize tracking-tight flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ 
                      backgroundColor: b.percentage >= 100 ? '#E85D5D' : b.percentage >= 90 ? '#F97316' : b.percentage >= 80 ? '#EAB308' : '#4CAF50' 
                    }}></span>
                    {b.category}
                  </h3>
                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                    {selectedMonth === '2026-06' ? 'June 2026' : selectedMonth === '2026-05' ? 'May 2026' : 'April 2026'} Limit
                  </span>
                </div>
                
                <button 
                  onClick={() => handleDeleteBudget(b.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#E85D5D] hover:bg-rose-50 transition-colors"
                  title="Remove limit"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress visual metrics */}
              <div className="flex justify-between items-end mt-4">
                <div className="space-y-0.5">
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Spent Cumulative Balance</p>
                  <p className="font-display font-extrabold text-sm text-slate-800">
                    {formatRupee(b.spent)} <span className="text-xs font-normal text-slate-400">/ {formatRupee(b.limit)}</span>
                  </p>
                </div>
                
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  b.percentage >= 100 
                    ? 'bg-rose-500/10 text-[#E85D5D]' 
                    : b.percentage >= 90
                    ? 'bg-orange-550/10 text-orange-600'
                    : b.percentage >= 80 
                    ? 'bg-amber-500/10 text-[#D6A51D]' 
                    : 'bg-emerald-500/10 text-[#4CAF50]'
                }`}>
                  {b.percentage}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#EEF6F2] h-2 rounded-full overflow-hidden mt-3">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ 
                    width: `${b.percentage}%`,
                    backgroundColor: b.percentage >= 100 ? '#E85D5D' : b.percentage >= 90 ? '#F97316' : b.percentage >= 80 ? '#D6A51D' : '#355C4B'
                  }}
                ></div>
              </div>
            </div>

            {/* Warning banners */}
            <div className={`p-2 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 ${
              b.percentage >= 100 
                ? 'bg-rose-500/10 border-rose-500/10 text-[#E85D5D]' 
                : b.percentage >= 90
                ? 'bg-orange-500/10 border-orange-500/10 text-orange-600'
                : b.percentage >= 80 
                ? 'bg-amber-500/10 border-amber-500/10 text-[#D6A51D]' 
                : 'bg-emerald-500/10 border-emerald-500/10 text-[#355C4B]'
            }`}>
              {b.percentage >= 100 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse text-[#E85D5D]" />
                  <span className="truncate">Red Alert: Limit Exceeded by {formatRupee(b.spent - b.limit)}</span>
                </>
              ) : b.percentage >= 90 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-orange-600" />
                  <span className="truncate">Orange Alert: Approaching critical cap (90%+ spent)</span>
                </>
              ) : b.percentage >= 80 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#D6A51D]" />
                  <span className="truncate">Yellow Alert: 80%+ threshold caution advised</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5 shrink-0 text-[#355C4B]" />
                  <span className="truncate">{formatRupee(b.remaining)} budget buffer safe</span>
                </>
              )}
            </div>

          </div>
        ))}

        {filteredBudgets.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-white border border-dashed rounded-xl border-[#DCE8E1] hover:border-[#355C4B]/50 transition-colors flex flex-col items-center justify-center space-y-2.5">
            <AlertCircle className="w-8 h-8 text-[#D6A51D] animate-pulse" />
            <p className="font-semibold text-slate-500 font-sans">No spending limits configured yet for this month.</p>
            <p className="text-[10px] text-slate-400 max-w-sm px-4">
              Set interactive category bounds to dynamically highlight risk levels and protect your balance.
            </p>
            <button 
              onClick={() => setIsOpen(true)}
              className="mt-2 text-xs text-white bg-[#355C4B] hover:bg-[#274437] font-bold py-2 px-4 rounded-xl shadow-md transition-all"
            >
              + Create Budget
            </button>
          </div>
        )}
      </div>

      {/* DETAILED LEDGER HELP CARD */}
      <div className="p-4.5 rounded-xl bg-white border border-[#DCE8E1] shadow-xs flex items-start space-x-3.5">
        <div className="p-2.5 rounded-lg bg-[#355C4B]/10 text-[#355C4B] shrink-0">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="font-extrabold text-xs text-slate-800">Dynamic Budget Guarding Mechanics:</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            When you define a category limit (e.g., <span className="font-bold">Food</span> at {currencySymbolDisplay}400.00), BudgetBloom listens to Firestore transactions dynamically. Outflows belonging to configured categories automatically decrease your buffer limit, triggering warning bars instantly when consumption speed reaches <span className="font-extrabold text-[#D6A51D]">80%</span> of threshold target.
          </p>
        </div>
      </div>

      {/* CREATE BUDGET MODAL */}
      {isOpen && (
        <div className="fixed top-0 left-0 w-full h-[100vh] z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-overlay">
          <div className="w-full max-w-sm p-6 rounded-2xl shadow-2xl border relative bg-white border-[#DCE8E1] text-slate-800 max-h-[calc(100vh-32px)] overflow-y-auto animate-modal-content">
            <h3 className="font-display font-extrabold text-sm sm:text-base mb-3 text-center uppercase tracking-wider text-[#355C4B]">
              Configure Category spending limit
            </h3>

            <form onSubmit={handleSaveBudget} className="space-y-3.5">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Month</label>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-150 text-xs font-bold text-slate-650 flex items-center space-x-2">
                  <Calendar className="w-3.5 h-3.5 text-[#355C4B]" />
                  <span>{selectedMonth === '2026-06' ? 'June 2026' : selectedMonth === '2026-05' ? 'May 2026' : 'April 2026'}</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expense Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-250 text-xs font-medium text-slate-600 focus:ring-1 focus:ring-[#355C4B]"
                  required
                >
                  {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ceiling Limit ({currencySymbolDisplay})</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="e.g. 400.00"
                  className="w-full p-2.5 rounded-xl border border-slate-250 text-xs font-bold focus:ring-1 focus:ring-[#355C4B]"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 p-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 p-2 bg-[#355C4B] hover:bg-[#274437] text-white rounded-xl text-xs font-semibold transition-colors shadow-md"
                >
                  Set Budget Bound
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
