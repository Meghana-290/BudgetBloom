import React from 'react';
import { Transaction, Wallet, Budget, Goal } from '../types';
import { formatRupee } from '../utils/format';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  CheckCircle, 
  AlertTriangle,
  Calendar,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface AnalyticsTabProps {
  transactions: Transaction[];
  wallets: Wallet[];
  budgets: Budget[];
  goals?: Goal[];
  currencySymbol: string;
  darkMode: boolean;
  filterMonth?: string;
  filterYear?: string;
  filterDate?: string;
  activeQuickFilter?: 'today' | 'week' | 'month' | 'year' | 'all' | null;
}

export default function AnalyticsTab({
  transactions,
  wallets,
  budgets,
  goals = [],
  currencySymbol,
  darkMode,
  filterMonth,
  filterYear,
  filterDate,
  activeQuickFilter
}: AnalyticsTabProps) {
  
  const targetYear = filterYear === 'all' ? '2026' : (filterYear || '2026');
  const targetMonth = filterMonth === 'all' ? '06' : (filterMonth || '06');

  // Selected period transactions (e.g. June 2026)
  const currentMonthTransactions = transactions.filter(t => {
    const parts = t.date.split('-');
    const y = parts[0];
    const m = parts[1];
    
    const yearMatch = targetYear === 'all' || y === targetYear;
    const monthMatch = targetMonth === 'all' || m === targetMonth;
    return yearMatch && monthMatch;
  });

  // Basic Metrics
  const periodIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const periodExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netCashFlow = periodIncome - periodExpense;
  const savingsRate = periodIncome > 0 ? (netCashFlow / periodIncome) * 100 : 0;

  // Selected period expenditures
  const expenseTransactions = currentMonthTransactions.filter(t => t.type === 'expense');

  // 5. Highest Spending Category
  const categorySpentMap: { [key: string]: number } = {};
  expenseTransactions.forEach((t) => {
    categorySpentMap[t.category] = (categorySpentMap[t.category] || 0) + t.amount;
  });

  let topCategory = 'None';
  let topCategoryAmount = 0;
  Object.entries(categorySpentMap).forEach(([cat, amt]) => {
    if (amt > topCategoryAmount) {
      topCategoryAmount = amt;
      topCategory = cat;
    }
  });
  const topCategoryPct = periodExpense > 0 ? Math.round((topCategoryAmount / periodExpense) * 100) : 0;

  // 6. Most Used Payment Method
  const paymentMethodMap: { [key: string]: number } = {};
  currentMonthTransactions.forEach((t) => {
    paymentMethodMap[t.paymentMethod] = (paymentMethodMap[t.paymentMethod] || 0) + 1;
  });

  let topPaymentMethod = 'None';
  let topPaymentCount = 0;
  Object.entries(paymentMethodMap).forEach(([pm, count]) => {
    if (count > topPaymentCount) {
      topPaymentCount = count;
      topPaymentMethod = pm;
    }
  });

  // 7. Average Daily Spending (selected period, standard divide by 30)
  const avgDailySpending = periodExpense / 30;

  // 8. Average Monthly Savings (All-time calculations dynamically)
  const allMonthsWithTx = Array.from(new Set(transactions.map(t => t.date.slice(0, 7))));
  const totalAllTimeIn = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalAllTimeOut = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const divisor = allMonthsWithTx.length || 1;
  const avgMonthlySavings = (totalAllTimeIn - totalAllTimeOut) / divisor;

  // Prepare Pie Chart Data
  const pieColors = ['#00B894', '#38BDF8', '#818CF8', '#F59E0B', '#EF4444', '#EC4899', '#10B981', '#3B82F6', '#6B7280'];
  const pieData = Object.entries(categorySpentMap).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  // Dynamic 12-Month Trends for Income vs Expense
  const monthsAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendData = monthsAbbr.map((m, idx) => {
    const monthStr = String(idx + 1).padStart(2, '0');
    const prefix = `${targetYear}-${monthStr}`;
    const monthlyIn = transactions.filter(t => t.date.startsWith(prefix) && t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const monthlyOut = transactions.filter(t => t.date.startsWith(prefix) && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return {
      name: m,
      Income: monthlyIn,
      Expense: monthlyOut,
      NetFlow: monthlyIn - monthlyOut
    };
  });

  // Yearly Growth Data (cumulative savings growth)
  const yearsToChart = ['2024', '2025', '2026', '2027'];
  let cumulativeSavings = 0;
  const yearlyGrowthData = yearsToChart.map(y => {
    const yearlyIn = transactions.filter(t => t.date.startsWith(y) && t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const yearlyOut = transactions.filter(t => t.date.startsWith(y) && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netYr = yearlyIn - yearlyOut;
    cumulativeSavings += netYr;
    return {
      year: y,
      Income: yearlyIn,
      Expense: yearlyOut,
      'Net Savings': netYr,
      'Cumulative Wealth': cumulativeSavings
    };
  });

  // Smart Insights Engine Compiler
  const insights: { type: 'success' | 'alert' | 'info'; text: string }[] = [];

  // Insight 1: MoM Spent Comparison
  const targetYearNum = parseInt(targetYear, 10);
  const targetMonthNum = parseInt(targetMonth, 10);
  let prevMonthNum = targetMonthNum - 1;
  let prevYearNum = targetYearNum;
  if (prevMonthNum === 0) {
    prevMonthNum = 12;
    prevYearNum -= 1;
  }
  const prevMonthStr = String(prevMonthNum).padStart(2, '0');
  const prevPrefix = `${prevYearNum}-${prevMonthStr}`;

  const spentPrevious = transactions
    .filter(t => t.date.startsWith(prevPrefix) && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  if (spentPrevious > 0) {
    const diffPct = ((periodExpense - spentPrevious) / spentPrevious) * 100;
    if (diffPct > 0) {
      insights.push({
        type: 'alert',
        text: `You spent ${diffPct.toFixed(0)}% more than last month.`
      });
    } else if (diffPct < 0) {
      insights.push({
        type: 'success',
        text: `Spectacular job! You spent ${Math.abs(diffPct).toFixed(0)}% less than last month.`
      });
    }
  } else {
    insights.push({
      type: 'info',
      text: `Your current monthly spending is tracking at ${formatRupee(periodExpense)} with a healthy cash runway remaining.`
    });
  }

  // Insight 2: Category MoM Spent Delta
  const categoriesToCheck = ['Food & Groceries', 'Shopping', 'Bills & Utilities', 'Rent', 'Transportation', 'Entertainment'];
  let maxCatIncrease = '';
  let maxCatIncreaseAmt = 0;

  categoriesToCheck.forEach(cat => {
    const currentCatSpend = expenseTransactions.filter(t => t.category.toLowerCase() === cat.toLowerCase()).reduce((sum, t) => sum + t.amount, 0);
    const prevCatSpend = transactions.filter(t => t.date.startsWith(prevPrefix) && t.category.toLowerCase() === cat.toLowerCase() && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const diff = currentCatSpend - prevCatSpend;
    if (diff > maxCatIncreaseAmt) {
      maxCatIncreaseAmt = diff;
      maxCatIncrease = cat;
    }
  });

  if (maxCatIncreaseAmt > 0) {
    insights.push({
      type: 'alert',
      text: `${maxCatIncrease} spending increased by ${formatRupee(maxCatIncreaseAmt)} compared to last month.`
    });
  }

  // Insight 3: Goal forecasting (e.g. "Korea Fund in 7 months")
  if (goals && goals.length > 0) {
    const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount);
    if (activeGoals.length > 0) {
      const activeGoal = activeGoals[0];
      const monthlyContribution = avgMonthlySavings > 0 ? avgMonthlySavings : (netCashFlow > 0 ? netCashFlow : 5000);
      const remainingNeeded = activeGoal.targetAmount - activeGoal.currentAmount;
      const estimatedMonths = Math.ceil(remainingNeeded / monthlyContribution);
      if (estimatedMonths > 0 && estimatedMonths < 120) {
        insights.push({
          type: 'success',
          text: `You are on track to complete your ${activeGoal.name} in ${estimatedMonths} months.`
        });
      }
    }
  }

  // Insight 4: Budget Overruns
  const matchMonth = `${targetYear}-${targetMonth}`;
  budgets.forEach(b => {
    if (b.month === matchMonth) {
      const categorySpent = expenseTransactions.filter(t => t.category.toLowerCase() === b.category.toLowerCase()).reduce((sum, t) => sum + t.amount, 0);
      if (categorySpent > b.limit && b.limit > 0) {
        const excessPercent = Math.round(((categorySpent - b.limit) / b.limit) * 100);
        insights.push({
          type: 'alert',
          text: `${b.category} exceeded budget by ${excessPercent}%.`
        });
      }
    }
  });

  // Guard insights minimum
  if (insights.length < 2) {
    if (savingsRate > 25) {
      insights.push({
        type: 'success',
        text: `Your current savings rate is ${savingsRate.toFixed(0)}%, surpassing the recommended 20% index criteria.`
      });
    } else {
      insights.push({
        type: 'info',
        text: "Tip: Consolidate recurrent streaming and dining bills onto single credit/debit sources for passive audits."
      });
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Title */}
      <div>
        <h2 className="font-display font-extrabold text-2xl text-brand-navy dark:text-white">Finance Intelligence Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">Advanced machine-generated advisory feed, historic projections, and active trend charts.</p>
      </div>

      {/* METRIC CARDS GRID (10 core metrics cards & info panels) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Metric 1: Net Cash Flow */}
        <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Net Cash Flow</span>
          <p className={`font-display font-black text-lg mt-1 truncate ${
            netCashFlow >= 0 ? 'text-brand-green' : 'text-rose-500'
          }`}>
            {formatRupee(netCashFlow)}
          </p>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
            {netCashFlow >= 0 ? (
              <>
                <ArrowUpRight className="w-3 h-3 text-brand-green" /> Positive
              </>
            ) : (
              <>
                <ArrowDownRight className="w-3 h-3 text-rose-500" /> Deficit
              </>
            )}
          </span>
        </div>

        {/* Metric 2: Savings Rate */}
        <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Savings Rate</span>
          <p className="font-display font-black text-lg mt-1 text-slate-800 dark:text-white">
            {Math.max(0, Math.round(savingsRate))}%
          </p>
          <div className="w-full bg-[#EEF6F2] dark:bg-slate-800 h-1 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="h-full rounded-full bg-brand-green transition-all" 
              style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
            ></div>
          </div>
        </div>

        {/* Metric 3: Average Daily Spending */}
        <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Avg Daily Spent</span>
          <p className="font-display font-black text-lg mt-1 text-slate-800 dark:text-white truncate">
            {formatRupee(avgDailySpending)}
          </p>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
            <Calendar className="w-3 h-3 text-slate-400" /> 30-day index
          </span>
        </div>

        {/* Metric 4: Average Monthly Savings */}
        <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Avg Monthly Savings</span>
          <p className="font-display font-black text-lg mt-1 text-slate-800 dark:text-white truncate">
            {formatRupee(Math.max(0, avgMonthlySavings))}
          </p>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
            <Activity className="w-3 h-3 text-brand-green" /> Historical run
          </span>
        </div>

        {/* Metric 5: Highest Spending Category */}
        <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Top Category</span>
          <p className="font-display font-black text-lg mt-1 text-rose-500 truncate" title={topCategory}>
            {topCategory}
          </p>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">
            {formatRupee(topCategoryAmount)} ({topCategoryPct}%)
          </span>
        </div>

        {/* Metric 6: Most Used Payment Channel */}
        <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Top Channel</span>
          <p className="font-display font-black text-lg mt-1 text-brand-sky truncate">
            {topPaymentMethod}
          </p>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
            <CreditCard className="w-3 h-3 text-brand-sky" /> {topPaymentCount} entries logged
          </span>
        </div>

      </div>

      {/* GRAPHIC BLOCKS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Income vs Expense Trend Chart (Double curved area chart) */}
        <div className={`p-5 rounded-3xl border shadow-sm ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="mb-4">
            <h3 className="font-display font-bold text-sm text-brand-navy dark:text-white">Income vs Expense Trend</h3>
            <p className="text-xs text-slate-400">12-month linear inflows and outflows comparison for {targetYear}</p>
          </div>

          <div className="h-60 flex items-center justify-center">
            {transactions.length === 0 ? (
              <p className="text-center text-slate-400 text-xs font-semibold">No transactions available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00B894" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#00B894" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <Tooltip 
                    formatter={(value) => formatRupee(parseFloat(value as string))}
                    contentStyle={darkMode ? { backgroundColor: '#1E293B', borderColor: '#334155' } : { backgroundColor: '#FFF' }}
                  />
                  <Area type="monotone" dataKey="Income" stroke="#00B894" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="Expense" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Monthly Cash Flow Column Chart (Green positive, red negative) */}
        <div className={`p-5 rounded-3xl border shadow-sm ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="mb-4">
            <h3 className="font-display font-bold text-sm text-brand-navy dark:text-white">Monthly Net Cash Flow</h3>
            <p className="text-xs text-slate-400">Net balances (Income - Expense) per month</p>
          </div>

          <div className="h-60 flex items-center justify-center">
            {transactions.length === 0 ? (
              <p className="text-center text-slate-400 text-xs font-semibold">No transactions available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <Tooltip 
                    formatter={(value) => formatRupee(parseFloat(value as string))}
                    contentStyle={darkMode ? { backgroundColor: '#1E293B', borderColor: '#334155' } : { backgroundColor: '#FFF' }}
                  />
                  <ReferenceLine y={0} stroke={darkMode ? '#475569' : '#CBD5E1'} strokeWidth={1} />
                  <Bar dataKey="NetFlow">
                    {trendData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.NetFlow >= 0 ? '#00B894' : '#EF4444'} 
                        radius={entry.NetFlow >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Category Spending Allocation Pie Chart with beautiful bars */}
        <div className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div>
            <h3 className="font-display font-bold text-sm text-brand-navy dark:text-white">Category Spending Distribution</h3>
            <p className="text-xs text-slate-400">Proportional outlays for the filtered month ({targetMonth}/{targetYear})</p>
          </div>

          {pieData.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-semibold text-xs flex items-center justify-center h-48">
              No transactions listed for the selected period.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 mt-4">
              <div className="h-44 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={68}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => formatRupee(parseFloat(value as string))}
                      contentStyle={darkMode ? { backgroundColor: '#1E293B', borderColor: '#334155' } : {}} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Spent</span>
                  <span className="font-display font-black text-sm text-brand-navy dark:text-white">
                    {formatRupee(periodExpense)}
                  </span>
                </div>
              </div>

              {/* Pie Legends with custom details */}
              <div className="space-y-2 overflow-y-auto max-h-48 px-1 pr-3">
                {pieData.map((p, idx) => {
                  const pct = periodExpense > 0 ? ((p.value / periodExpense) * 100).toFixed(0) : '0';
                  return (
                    <div key={p.name} className="space-y-0.5">
                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                        <span className="flex items-center space-x-1.5 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pieColors[idx % pieColors.length] }}></span>
                          <span>{p.name}</span>
                        </span>
                        <span>{formatRupee(p.value)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all" 
                          style={{ width: `${pct}%`, backgroundColor: pieColors[idx % pieColors.length] }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Chart 4: Yearly Wealth Growth and Savings Timeline (Smooth Line) */}
        <div className={`p-5 rounded-3xl border shadow-sm ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="mb-4">
            <h3 className="font-display font-bold text-sm text-brand-navy dark:text-white">Yearly Growth and Savings</h3>
            <p className="text-xs text-slate-400">Cumulative savings asset growth timeline over multiple fiscal years</p>
          </div>

          <div className="h-60 flex items-center justify-center">
            {transactions.length === 0 ? (
              <p className="text-center text-slate-400 text-xs font-semibold">No transactions available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearlyGrowthData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} vertical={false} />
                  <XAxis dataKey="year" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <Tooltip 
                    formatter={(value) => formatRupee(parseFloat(value as string))}
                    contentStyle={darkMode ? { backgroundColor: '#1E293B', borderColor: '#334155' } : { backgroundColor: '#FFF' }}
                  />
                  <Line type="monotone" dataKey="Cumulative Wealth" stroke="#00B894" strokeWidth={3} dot={{ fill: '#00B894', strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="Net Savings" stroke="#38BDF8" strokeWidth={1.5} strokeDasharray="3 3" dot={{ fill: '#38BDF8', strokeWidth: 1 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* DYNAMIC SMART INSIGHTS ENGINE */}
      <section className={`p-6 rounded-3xl border shadow-sm ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-5 h-5 text-brand-green" />
          <h3 className="font-display font-extrabold text-sm">Smart Insights Engine</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight, idx) => (
            <div 
              key={idx} 
              className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs leading-relaxed transition-all hover:scale-[1.01] ${
                insight.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                  : insight.type === 'alert' 
                  ? 'bg-rose-500/10 border-rose-500/15 text-rose-500' 
                  : 'bg-blue-500/10 border-blue-500/15 text-blue-600 dark:text-blue-400'
              }`}
            >
              {insight.type === 'success' ? (
                <CheckCircle className="w-4.5 h-4.5 shrink-0 text-emerald-500" />
              ) : insight.type === 'alert' ? (
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-rose-500" />
              ) : (
                <Sparkles className="w-4.5 h-4.5 shrink-0 text-blue-500" />
              )}
              <div>
                <p className="font-semibold">{insight.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
