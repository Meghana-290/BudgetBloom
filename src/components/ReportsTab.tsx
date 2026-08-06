import React, { useState, useEffect } from 'react';
import { Transaction, Wallet, Budget, Report } from '../types';
import { formatRupee } from '../utils/format';
import { addReport, deleteReport, addNotification } from '../dbHelper';
import { auth, db } from '../firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  TrendingUp, 
  TrendingDown, 
  Award,
  Calendar,
  Layers,
  Sparkles,
  PieChart as PieIcon,
  Filter,
  CheckCircle,
  AlertTriangle,
  FileText,
  Download,
  Printer,
  Table,
  PlusCircle,
  Bookmark,
  Trash2
} from 'lucide-react';

interface ReportsTabProps {
  transactions: Transaction[];
  wallets: Wallet[];
  budgets: Budget[];
  currencySymbol: string;
  darkMode: boolean;
  filterMonth?: string;
  filterYear?: string;
  filterDate?: string;
}

export default function ReportsTab({
  transactions,
  wallets,
  budgets,
  currencySymbol,
  darkMode,
  filterMonth,
  filterYear,
  filterDate
}: ReportsTabProps) {
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  
  // Specific picker states
  const [selectedDailyDate, setSelectedDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeeklyDate, setSelectedWeeklyDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  });
  const [selectedMonthlyPeriod, setSelectedMonthlyPeriod] = useState('2026-06');
  const [selectedYearlyPeriod, setSelectedYearlyPeriod] = useState('2026');
  
  // Custom date range states
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Local state for fetched user reports to prevent prop drilling if desired,
  // or we can query Firestore in real-time right inside the component!
  const [savedStatements, setSavedStatements] = useState<Report[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [notification, setNotification] = useState('');

  // Fetch saved reports from Firebase on load/refresh
  const fetchSavedStatements = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'reports')
      );
      const snap = await getDocs(q);
      const list: Report[] = [];
      snap.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Report);
      });
      // Sort client side
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSavedStatements(list);
    } catch (err) {
      console.error("Error fetching statements:", err);
    }
  };

  useEffect(() => {
    fetchSavedStatements();
  }, [transactions]); // refresh statements whenever a transaction action changes

  // Synchronize dynamic global selectors
  useEffect(() => {
    const targetYStr = filterYear === 'all' ? '2026' : (filterYear || '2026');
    const targetMStr = filterMonth === 'all' ? '06' : (filterMonth || '06');
    const targetDStr = filterDate === 'all' ? '15' : (filterDate || '15');
    
    setSelectedMonthlyPeriod(`${targetYStr}-${targetMStr}`);
    setSelectedYearlyPeriod(targetYStr);
    setSelectedDailyDate(`${targetYStr}-${targetMStr}-${String(targetDStr).padStart(2, '0')}`);
  }, [filterMonth, filterYear, filterDate]);

  // Dynamically build months/years that exist in data to keep selector clean
  const availableMonths = Array.from(new Set([
    '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01',
    ...transactions.map(t => t.date.substring(0, 7)).filter(d => d.length === 7)
  ])).sort().reverse();

  const availableYears = Array.from(new Set([
    '2026', '2025', '2024',
    ...transactions.map(t => t.date.substring(0, 4)).filter(d => d.length === 4)
  ])).sort().reverse();

  // Filter Transactions in active scope
  const reportTransactions = transactions.filter((t) => {
    if (reportType === 'daily') {
      return t.date === selectedDailyDate;
    }
    if (reportType === 'weekly') {
      if (!selectedWeeklyDate) return true;
      const start = new Date(selectedWeeklyDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      return t.date >= startStr && t.date <= endStr;
    }
    if (reportType === 'monthly') {
      return t.date.startsWith(selectedMonthlyPeriod);
    }
    if (reportType === 'yearly') {
      return t.date.startsWith(selectedYearlyPeriod);
    }
    if (reportType === 'custom') {
      return t.date >= customStartDate && t.date <= customEndDate;
    }
    return true;
  });

  // Calculate statistics for the active scope
  const totalIncome = reportTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = reportTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = Math.max(0, totalIncome - totalExpense);
  const savingsRate = totalIncome > 0 ? Math.floor((netSavings / totalIncome) * 100) : 0;

  // -- BUDGET STATISTICS COMPUTATION --
  // Derive unique months intersecting with the active scope for matching limits
  const periodsInScope = Array.from(new Set(
    reportTransactions.map(t => t.date.substring(0, 7))
  ));
  
  if (periodsInScope.length === 0) {
    if (reportType === 'monthly') periodsInScope.push(selectedMonthlyPeriod);
    else if (reportType === 'yearly') periodsInScope.push(`${selectedYearlyPeriod}-06`);
    else if (reportType === 'daily') periodsInScope.push(selectedDailyDate.substring(0, 7));
    else if (reportType === 'weekly' && selectedWeeklyDate) periodsInScope.push(selectedWeeklyDate.substring(0, 7));
    else if (reportType === 'custom') periodsInScope.push(customStartDate.substring(0, 7));
  }

  // Budgets intersecting this scope
  const periodBudgets = budgets.filter(b => periodsInScope.includes(b.month));
  const totalBudgetLimit = periodBudgets.reduce((sum, b) => sum + b.limit, 0);

  // Group real category expenses in the same month scopes
  let spentInBudgetsSum = 0;
  periodBudgets.forEach(b => {
    const matchingExpense = reportTransactions
      .filter(t => t.type === 'expense' && t.category === b.category && t.date.startsWith(b.month))
      .reduce((sum, t) => sum + t.amount, 0);
    spentInBudgetsSum += matchingExpense;
  });

  const budgetIsOver = spentInBudgetsSum > totalBudgetLimit;
  const budgetDelta = Math.abs(totalBudgetLimit - spentInBudgetsSum);

  // Category breakdown for selection
  const categorySummaryMap: { [key: string]: number } = {};
  reportTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      categorySummaryMap[t.category] = (categorySummaryMap[t.category] || 0) + t.amount;
    });

  const sortedCategories = Object.entries(categorySummaryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const totalExpenseCategorySum = sortedCategories.reduce((sum, c) => sum + c.amount, 0);

  // Save Report Statement to Firestore Center
  const handleSaveReportToVault = async () => {
    if (!auth.currentUser) return;
    setSaveLoading(true);
    setNotification('');
    
    const scopeTitleStr = 
      reportType === 'daily' ? `Daily: ${selectedDailyDate}` :
      reportType === 'weekly' ? `Weekly: ${selectedWeeklyDate} to ${new Date(new Date(selectedWeeklyDate).getTime() + 6*24*60*60*1000).toISOString().split('T')[0]}` :
      reportType === 'monthly' ? `Monthly: ${selectedMonthlyPeriod}` :
      reportType === 'yearly' ? `Yearly: ${selectedYearlyPeriod}` :
      `Custom: ${customStartDate} to ${customEndDate}`;

    try {
      const reportBrief = {
        userId: auth.currentUser.uid,
        title: `Ledger ${scopeTitleStr}`,
        content: JSON.stringify({
          type: reportType,
          scope: scopeTitleStr,
          income: totalIncome,
          expense: totalExpense,
          savings: netSavings,
          budgetLimit: totalBudgetLimit,
          budgetSpent: spentInBudgetsSum,
          ledgerCount: reportTransactions.length
        })
      };

      await addReport(reportBrief);
      setNotification('Financial statement report logged securely in database vault!');
      fetchSavedStatements();
      setTimeout(() => setNotification(''), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteSavedReport = async (id: string) => {
    if (confirm('Delete this statement from archive registry?')) {
      await deleteReport(id);
      fetchSavedStatements();
    }
  };

  // Print PDF Generator
  const triggerPDFPrint = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let y = 15;

    // Header Background Band
    doc.setFillColor(53, 92, 75); // #355C4B Theme Green
    doc.rect(margin, y, contentWidth, 20, 'F');

    // Initials "BB"
    doc.setFillColor(214, 165, 29); // #D6A51D Theme Gold
    doc.roundedRect(margin + 4, y + 4, 12, 12, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('BB', margin + 8, y + 11.5, { align: 'center' });

    // Logo Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('BudgetBloom Dynamic Report Statement', margin + 20, y + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(220, 232, 225);
    doc.text('Secure Financial Ledger and Statements', margin + 20, y + 14.5);

    // Period Box
    const scopeTitleStr = 
      reportType === 'daily' ? `DAILY REPORT: ${selectedDailyDate}` :
      reportType === 'weekly' ? `WEEKLY REPORT: ${selectedWeeklyDate} to ${new Date(new Date(selectedWeeklyDate).getTime() + 6*24*60*60*1000).toISOString().split('T')[0]}` :
      reportType === 'monthly' ? `MONTHLY REPORT: ${selectedMonthlyPeriod}` :
      reportType === 'yearly' ? `YEARLY REPORT: ${selectedYearlyPeriod}` :
      `CUSTOM RANGE REPORT: ${customStartDate} to ${customEndDate}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(214, 165, 29);
    doc.text(scopeTitleStr.toUpperCase(), margin + contentWidth - 4, y + 9.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text(`Created: ${new Date().toLocaleString()}`, margin + contentWidth - 4, y + 14.5, { align: 'right' });

    y += 28;

    // Accounts Overview Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(53, 92, 75);
    doc.text('I. FINANCIAL SCOPE SUMMARY OVERVIEW', margin, y);
    y += 4;

    // Metrics Card Background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

    const colWidth = contentWidth / 4;
    // Income
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('INFLOW TOTAL', margin + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text(`+₹${totalIncome.toLocaleString('en-IN')}`, margin + 4, y + 13);

    // Expense
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('OUTFLOW TOTAL', margin + colWidth + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(239, 68, 68);
    doc.text(`-₹${totalExpense.toLocaleString('en-IN')}`, margin + colWidth + 4, y + 13);

    // Net Surplus
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('NET SURPLUS', margin + colWidth * 2 + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(53, 92, 75);
    doc.text(`₹${(totalIncome - totalExpense).toLocaleString('en-IN')} (${savingsRate}%)`, margin + colWidth * 2 + 4, y + 13);

    // Budgets
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('BUDGET COMPLIANCE', margin + colWidth * 3 + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`₹${spentInBudgetsSum.toLocaleString('en-IN')}/₹${totalBudgetLimit.toLocaleString('en-IN')}`, margin + colWidth * 3 + 4, y + 13);

    y += 28;

    // Transactions Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(53, 92, 75);
    doc.text('II. DETAILED TRANSACTION ENTRIES STATEMENT', margin, y);
    y += 4;

    const dataRows = reportTransactions.map(t => [
      t.date,
      t.description,
      t.category,
      t.paymentMethod,
      t.type.toUpperCase(),
      `₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Description', 'Category', 'Wallet Pool', 'Type', 'Amount']],
      body: dataRows,
      headStyles: { fillColor: [53, 92, 75], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => {
        // Footer info on each page
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Confidential Statement of Accounts — BudgetBloom Automated Ledger Engine', margin, pageHeight - 8);
        doc.text(`Page ${doc.getNumberOfPages()}`, margin + contentWidth, pageHeight - 8, { align: 'right' });
      }
    });

    // Save and download PDF directly
    const titleClean = scopeTitleStr.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`budgetbloom_ledger_${titleClean}_report.pdf`);

    // Write unread notification to Firestore
    const uid = auth.currentUser?.uid;
    if (uid) {
      addNotification({
        userId: uid,
        text: `PDF Report Downloaded: ${scopeTitleStr} PDF statement exported.`,
        type: 'success'
      }).catch(err => console.error(err));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-[#1F2933]">
      
      {/* SCOPE SELECTION DRAWER */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 p-5 bg-[#355C4B] rounded-2xl text-white shadow-lg border border-[#274437]">
        <div className="space-y-0.5">
          <span className="bg-[#D6A51D] text-slate-950 font-mono text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-inner">
            LEDGER REPORT engine
          </span>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl mt-1.5 tracking-tight">
            Financial Report Center
          </h2>
          <p className="text-xs text-[#DCE8E1]/85">
            Audit income, expenses, custom periods, and download validated reports instantly.
          </p>
        </div>

        {/* Dynamic selector based on reportType */}
        <div className="flex flex-wrap items-center gap-3 bg-[#274437] p-2 rounded-2xl border border-[#436F5C]">
          
          <div className="flex flex-wrap bg-[#1E352B] p-1 rounded-xl">
            {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  reportType === type 
                    ? 'bg-[#355C4B] text-[#D6A51D] shadow-sm' 
                    : 'text-[#DCE8E1]/60 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="px-2 border-l border-[#436F5C] flex items-center">
            {reportType === 'daily' && (
              <input 
                type="date"
                value={selectedDailyDate}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
                className="bg-transparent text-white text-xs font-bold border-none focus:ring-0 cursor-pointer"
              />
            )}

            {reportType === 'weekly' && (
              <div className="flex flex-col">
                <span className="text-[8px] text-[#A2C3B4] font-bold uppercase tracking-wider">Starting Monday</span>
                <input 
                  type="date"
                  value={selectedWeeklyDate}
                  onChange={(e) => setSelectedWeeklyDate(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold border-none p-0 focus:ring-0 cursor-pointer"
                />
              </div>
            )}

            {reportType === 'monthly' && (
              <select
                value={selectedMonthlyPeriod}
                onChange={(e) => setSelectedMonthlyPeriod(e.target.value)}
                className="bg-transparent text-white text-xs font-bold border-none focus:ring-0 cursor-pointer"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m} className="text-slate-800">{m}</option>
                ))}
              </select>
            )}

            {reportType === 'yearly' && (
              <select
                value={selectedYearlyPeriod}
                onChange={(e) => setSelectedYearlyPeriod(e.target.value)}
                className="bg-transparent text-white text-xs font-bold border-none focus:ring-0 cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="text-slate-800">{y}</option>
                ))}
              </select>
            )}

            {reportType === 'custom' && (
              <div className="flex flex-wrap items-center gap-1">
                <div className="flex flex-col">
                  <span className="text-[8px] text-[#A2C3B4] font-bold uppercase tracking-wider">From</span>
                  <input 
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent text-white text-xs font-bold border-[#436F5C] p-0 focus:ring-0 cursor-pointer text-center"
                  />
                </div>
                <span className="text-[#A2C3B4] px-1 font-bold">-</span>
                <div className="flex flex-col">
                  <span className="text-[8px] text-[#A2C3B4] font-bold uppercase tracking-wider">To</span>
                  <input 
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent text-white text-xs font-bold border-[#436F5C] p-0 focus:ring-0 cursor-pointer text-center"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-3 text-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-xl flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* EXPORT OPTIONS PREVIEW BAR */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row gap-4 justify-between items-center ${
        darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 shadow-sm text-slate-800'
      }`}>
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-[#D6A51D]" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide">Statement Exports Ready</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Found {reportTransactions.length} transaction entries matching current filtration rules.
            </p>
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 justify-end">
          <button
            onClick={handleSaveReportToVault}
            disabled={saveLoading || reportTransactions.length === 0}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-[#D6A51D]/10 hover:bg-[#D6A51D]/20 border border-[#D6A51D]/30 text-[#86590B] dark:text-[#F3D995] active:scale-95 transition-all cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{saveLoading ? 'Saving...' : 'Save to Vault'}</span>
          </button>
          <button
            onClick={triggerPDFPrint}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border border-[#355C4B]/20 hover:bg-[#355C4B]/10 active:scale-95 transition-all text-[#355C4B] dark:text-[#A2C3B4] dark:border-slate-800 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF Print</span>
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="p-8 py-20 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center space-y-3">
          <FileText className="w-12 h-12 text-[#355C4B] animate-pulse" />
          <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm">No Financial Data Logged</h3>
          <p className="text-slate-400 text-xs max-w-sm">
            Reports will appear dynamically after you connect wallets or log transactions.
          </p>
        </div>
      ) : (
        <>
          {/* STATS TILES GRID - 4 DEEP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* INFLOW */}
            <div className={`p-4 rounded-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-800'
            } flex flex-col justify-between hover:shadow-md transition-all`}>
              <div className="flex justify-between items-start">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Cash Inflow</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-[#4CAF50]">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="font-display font-extrabold text-lg text-emerald-600 leading-none">
                  +{formatRupee(totalIncome)}
                </h3>
                <span className="text-[10px] text-slate-400 mt-1 block font-medium">Income Summary total</span>
              </div>
            </div>

            {/* EXPENSE OUTFLOW */}
            <div className={`p-4 rounded-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-800'
            } flex flex-col justify-between hover:shadow-md transition-all`}>
              <div className="flex justify-between items-start">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Cash Outflow</span>
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-[#E85D5D]">
                  <TrendingDown className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="font-display font-extrabold text-lg text-rose-500 leading-none">
                  -{formatRupee(totalExpense)}
                </h3>
                <span className="text-[10px] text-slate-400 mt-1 block font-medium">Expense Summary total</span>
              </div>
            </div>

            {/* NET SURPLUS */}
            <div className={`p-4 rounded-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-800'
            } flex flex-col justify-between hover:shadow-md transition-all`}>
              <div className="flex justify-between items-start">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Net Surplus Pool</span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-[#D6A51D]">
                  <Award className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="font-display font-extrabold text-lg text-[#355C4B] dark:text-[#A2C3B4] leading-none">
                  {formatRupee(netSavings)} <span className="text-xs text-slate-400 font-medium">({savingsRate}%)</span>
                </h3>
                <span className="text-[10px] text-slate-400 mt-1 block font-medium font-mono">Savings Summary delta</span>
              </div>
            </div>

            {/* BUDGET SUMMARY TILE */}
            <div className={`p-4 rounded-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-800'
            } flex flex-col justify-between hover:shadow-md transition-all`}>
              <div className="flex justify-between items-start">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Category Budgets</span>
                <div className={`p-1.5 rounded-lg ${budgetIsOver ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-[#4CAF50]'}`}>
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className={`font-display font-extrabold text-lg leading-none ${budgetIsOver ? 'text-rose-500' : 'text-[#355C4B] dark:text-[#A2C3B4]'}`}>
                  {formatRupee(spentInBudgetsSum)} <span className="text-xs text-slate-400 font-extrabold">/ {formatRupee(totalBudgetLimit)}</span>
                </h3>
                <span className={`text-[10px] font-bold mt-1 block uppercase ${budgetIsOver ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {budgetIsOver ? `Over budget by ${formatRupee(budgetDelta)}` : `Surplus space remaining`}
                </span>
              </div>
            </div>

          </div>

          {/* DUAL REPORT PANELS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* Detailed Ledger list inside active scope */}
            <div className={`p-5 rounded-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 shadow-sm text-slate-800'
            } lg:col-span-2 space-y-4`}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-400">Statement Period Ledger</h3>
                  <p className="text-[10px] text-slate-450 mt-0.5">Individual ledger lines in active filter scope</p>
                </div>
                <Table className="w-4 h-4 text-[#D6A51D]" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px] sm:min-w-full">
                  <thead>
                    <tr className="border-b border-slate-150/50 dark:border-slate-800/55 text-[9px] text-slate-400 uppercase tracking-wider font-extrabold">
                      <th className="py-2.5 px-2">Date</th>
                      <th className="py-2.5 px-2">Description</th>
                      <th className="py-2.5 px-2">Category</th>
                      <th className="py-2.5 px-2">Wallet</th>
                      <th className="py-2.5 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/40">
                    {reportTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="py-3 px-2 font-mono text-slate-400 text-[10px]">{t.date}</td>
                        <td className="py-3 px-2">
                          <span className="font-bold">{t.description}</span>
                          {t.notes && <p className="text-[9px] text-slate-450 italic mt-0.5 max-w-[150px] truncate">{t.notes}</p>}
                        </td>
                        <td className="py-3 px-2 text-slate-450">{t.category}</td>
                        <td className="py-3 px-2 text-slate-400">{t.paymentMethod}</td>
                        <td className={`py-3 px-2 text-right font-bold ${
                          t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                        }`}>
                          {t.type === 'income' ? '+' : '-'}{formatRupee(t.amount)}
                        </td>
                      </tr>
                    ))}
                    {reportTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-400 font-medium">
                          No ledger activities in this specific scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Breakdown list inside active scope */}
            <div className={`p-5 rounded-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 shadow-sm text-slate-800'
            } flex flex-col justify-between`}>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">OUTFLOW STRUCTURE</span>
                <h3 className="font-display font-bold text-sm uppercase tracking-tight text-slate-800 dark:text-white">Expense Distribution</h3>
              </div>

              <div className="mt-4 space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {sortedCategories.map((c, index) => {
                  const contributionPct = totalExpenseCategorySum > 0 ? Math.round((c.amount / totalExpenseCategorySum) * 100) : 0;
                  const barColors = ['#D6A51D', '#E85D5D', '#355C4B', '#4CAF50', '#6B7280', '#38BDF8'];
                  const color = barColors[index % barColors.length];
                  return (
                    <div key={c.category} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="truncate">{c.category}</span>
                        <span>{formatRupee(c.amount)} ({contributionPct})%</span>
                      </div>
                      <div className="w-full bg-[#EEF6F2] dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${contributionPct}%`, backgroundColor: color }}></div>
                      </div>
                    </div>
                  );
                })}
                {sortedCategories.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No expense distributions in selection.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4 text-[10px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-dashed border-[#DCE8E1]/80 dark:border-slate-800 flex gap-2 items-start">
                <Sparkles className="w-4 h-4 text-[#D6A51D] shrink-0" />
                <p className="dark:text-slate-400 leading-normal">
                  Statement structures are generated in real-time. Target outflows exceeding 25% to maximize your net surplus.
                </p>
              </div>
            </div>

          </div>

          {/* SAVED REGISTERED STATEMENTS HISTORY VAULT */}
          <div className={`p-6 rounded-3xl border shadow-sm ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
          }`}>
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 mb-4 animate-fade-in">
              <div>
                <h3 className="font-display font-bold text-sm flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-[#D6A51D]" />
                  <span>Audit Archive Statements Vault</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Your catalogued reports saved securely inside cloud Firestore.</p>
              </div>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-600 font-mono font-bold uppercase rounded-lg px-2.5 py-1">
                {savedStatements.length} statements logged
              </span>
            </div>

            {savedStatements.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-medium text-xs">
                No archived statements in database. Click "Save to Vault" above to persist a statement.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedStatements.map((report) => {
                  let parsed = { scope: '', income: 0, expense: 0, savings: 0, ledgerCount: 0, budgetLimit: 0, budgetSpent: 0 };
                  try {
                    parsed = JSON.parse(report.content);
                  } catch (e) {}

                  return (
                    <div 
                      key={report.id} 
                      className={`p-4 rounded-2xl border transition-all hover:border-[#D6A51D] flex flex-col justify-between space-y-4 ${
                        darkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-150'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-bold truncate max-w-[180px]">{report.title}</h4>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            Saved: {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleDeleteSavedReport(report.id)}
                          className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Delete archived statement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 text-center border-t border-b border-slate-150/50 dark:border-slate-800/50">
                        <div>
                          <span className="text-[8px] text-slate-400 uppercase tracking-wider block">Inflow</span>
                          <span className="text-[10px] font-bold text-emerald-600">+{formatRupee(parsed.income)}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 uppercase tracking-wider block">Outflow</span>
                          <span className="text-[10px] font-bold text-rose-500">-{formatRupee(parsed.expense)}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 uppercase tracking-wider block">Net</span>
                          <span className="text-[10px] font-bold text-sky-650">{formatRupee(parsed.savings)}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-450">
                        <span className="font-mono">Ledger Rows: {parsed.ledgerCount}</span>
                        {parsed.budgetLimit > 0 && (
                          <span className={parsed.budgetSpent > parsed.budgetLimit ? 'text-rose-500' : 'text-emerald-600'}>
                            Budget cap: {Math.round((parsed.budgetSpent / parsed.budgetLimit) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
