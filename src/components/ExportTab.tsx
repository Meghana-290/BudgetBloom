import React, { useState, useEffect } from 'react';
import { Transaction, Wallet, Budget, Goal, UserProfile } from '../types';
import { formatRupee } from '../utils/format';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addNotification } from '../dbHelper';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Search,
  Layers,
  Award,
  Wallet as WalletIcon,
  PieChart,
  Grid,
  CheckCircle,
  FileText,
  TrendingUp,
  TrendingDown,
  X,
  User,
  Mail,
  Calendar,
  Clock
} from 'lucide-react';

interface ExportTabProps {
  transactions: Transaction[];
  wallets: Wallet[];
  budgets: Budget[];
  goals: Goal[];
  currencySymbol: string;
  darkMode: boolean;
  profile?: UserProfile | null;
}

export default function ExportTab({
  transactions,
  wallets,
  budgets,
  goals,
  currencySymbol,
  darkMode,
  profile
}: ExportTabProps) {
  const [reportType, setReportType] = useState<'June' | 'Cumulative'>('June');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBalanceSheetOpen, setIsBalanceSheetOpen] = useState(false);

  // Lock body scroll when Balance Sheet modal is open
  useEffect(() => {
    if (isBalanceSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isBalanceSheetOpen]);

  const currentMonth = '2026-06';
  
  // Filter active transactions
  const displayTransactions = transactions.filter((t) => {
    const matchesPeriod = reportType === 'June' ? t.date.startsWith(currentMonth) : true;
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPeriod && matchesSearch;
  });

  // Calculate high-level totals
  const totalIncome = displayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = displayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netSurplus = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSurplus / totalIncome) * 100)) : 0;

  // Active Category Outflows
  const categorySummaryMap: { [key: string]: number } = {};
  displayTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      categorySummaryMap[t.category] = (categorySummaryMap[t.category] || 0) + t.amount;
    });

  const sortedCategories = Object.entries(categorySummaryMap)
    .sort((a, b) => b[1] - a[1]);
  const highestSpendingCategory = sortedCategories[0]?.[0] || 'None';
  const highestSpendingAmount = sortedCategories[0]?.[1] || 0;

  // Most used payment method
  const paymentMethodsMap: { [key: string]: number } = {};
  displayTransactions.forEach(t => {
    paymentMethodsMap[t.paymentMethod] = (paymentMethodsMap[t.paymentMethod] || 0) + 1;
  });
  const mostUsedMethod = Object.entries(paymentMethodsMap)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Goals specific inside selection
  const matchingGoals = goals;

  // Budgets intersecting this scope
  const activeBudgets = budgets.filter(b => {
    if (reportType === 'June') {
      return b.month === '2026-06';
    }
    return true; // cumulative
  });

  // Dynamic Balance Sheet Computations:
  const generatedDate = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const statementPeriod = reportType === 'June' ? 'June 01 - June 30, 2026' : 'Aggregated All-Time';
  const clientName = profile?.name || profile?.displayName || 'BudgetBloom Member';
  const clientEmail = profile?.email || 'N/A';

  // ASSETS
  const cashBalance = wallets.filter(w => w.type === 'Cash').reduce((sum, w) => sum + w.balance, 0);
  const upiBalance = wallets.filter(w => w.type === 'UPI').reduce((sum, w) => sum + w.balance, 0);
  const bankBalance = wallets.filter(w => w.type === 'Bank Account').reduce((sum, w) => sum + w.balance, 0);
  const savingsContributions = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const otherAssets = wallets.filter(w => w.type !== 'Cash' && w.type !== 'UPI' && w.type !== 'Bank Account' && w.type !== 'Credit Card' && w.balance > 0).reduce((sum, w) => sum + w.balance, 0);
  const totalAssetsVal = cashBalance + upiBalance + bankBalance + savingsContributions + otherAssets;

  // LIABILITIES
  const loanLiability = Math.abs(wallets.filter(w => w.balance < 0 && w.type !== 'Credit Card').reduce((sum, w) => sum + w.balance, 0));
  const creditCardDue = Math.abs(wallets.filter(w => w.type === 'Credit Card' && w.balance < 0).reduce((sum, w) => sum + w.balance, 0));
  const pendingPayments = displayTransactions.filter(t => t.type === 'expense' && (t.notes?.toLowerCase()?.includes('pending') || t.notes?.toLowerCase()?.includes('unpaid') || t.notes?.toLowerCase()?.includes('due') || t.description?.toLowerCase()?.includes('pending'))).reduce((sum, t) => sum + t.amount, 0);
  const billsPayable = displayTransactions.filter(t => t.category === 'Bills' && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const otherLiabilitiesVal = 0;
  const totalLiabilitiesVal = loanLiability + creditCardDue + pendingPayments + billsPayable + otherLiabilitiesVal;

  // NET WORTH
  const netWorthVal = totalAssetsVal - totalLiabilitiesVal;

  // PROFIT / LOSS / AT-HAND SUMMARY
  const availableBalanceLeft = totalIncome - totalExpense;
  const isProfit = availableBalanceLeft >= 0;

  // EXPENSE INSIGHTS EXTRA DETAILS
  const expenseTx = displayTransactions.filter(t => t.type === 'expense');
  const largestExpenseTx = expenseTx.reduce((max, t) => t.amount > (max?.amount || 0) ? t : max, null as Transaction | null);
  const largestExpenseLabel = largestExpenseTx ? `${largestExpenseTx.description} (${formatRupee(largestExpenseTx.amount)})` : 'None logged';

  const uniqueMonths = Array.from(new Set(transactions.map(t => t.date.substring(0, 7))));
  const allExpensesTotal = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const averageMonthlyExpense = uniqueMonths.length > 0 ? (allExpensesTotal / uniqueMonths.length) : totalExpense;

  const handleDownloadBalanceSheetPDF = () => {
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

    const drawHeader = (title: string, subtitle: string) => {
      // Shaded background bar
      doc.setFillColor(53, 92, 75); // Dark Green Theme
      doc.rect(margin, y, contentWidth, 24, 'F');

      doc.setFillColor(214, 165, 29); // #D6A51D Gold Accent 
      doc.roundedRect(margin + 5, y + 4, 16, 16, 3, 3, 'F');

      // Initials "BB"
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('BB', margin + 13, y + 13.5, { align: 'center' });

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 25, y + 10);

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(220, 232, 225);
      doc.text(subtitle, margin + 25, y + 15);
      doc.text(`Generated: ${generatedDate}`, margin + 25, y + 19);

      // Label "CONFIDENTIAL"
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(214, 165, 29); // Gold
      doc.text('CONFIDENTIAL BALANCE SHEET', margin + contentWidth - 5, y + 10, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(statementPeriod.toUpperCase(), margin + contentWidth - 5, y + 15, { align: 'right' });
      doc.text(`User: ${clientEmail}`, margin + contentWidth - 5, y + 19, { align: 'right' });

      y += 30;
    };

    const drawFooter = (pageNum: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 15, margin + contentWidth, pageHeight - 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('BudgetBloom Dynamic Registry • Secure Cryptographic Cloud Ledger Backup', margin, pageHeight - 10);
      doc.text(`Page ${pageNum}`, margin + contentWidth, pageHeight - 10, { align: 'right' });
    };

    // PAGE 1
    drawHeader('BudgetBloom Balance Sheet', `Detailed Statement of Net Worth, Assets, Actions, & Milestones`);

    // Section 1: Customer Info details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(53, 92, 75);
    doc.text('I. STATEMENT OF ACCOUNTS PARTICIPANTS', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Account Holder Name: ${clientName}     •     Registered Client Security Email: ${clientEmail}     •     Currency: ${currencySymbol}`, margin, y);
    y += 8;

    // Section 2: Summary of Accounts table / details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(53, 92, 75);
    doc.text('II. HIGHLIGHT FINANCIAL SUMMARY', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Metric Parameter', 'Accumulated Amount', 'Financial Commentary']],
      body: [
        ['Total Income Inflows', `+${currencySymbol}${totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Aggregate cash inflow and wallet transfers logged.'],
        ['Total Expense Outflows', `-${currencySymbol}${totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Aggregate ledger expenditures on bills, foods, shopping, etc.'],
        ['Total Goals Savings', `${currencySymbol}${savingsContributions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Amount successfully deposited inside active savings goals.'],
        ['Available Balance Remaining', `${currencySymbol}${availableBalanceLeft.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isProfit ? 'Profit / Net Surplus' : 'Loss / Net Deficit'],
        ['Net Status Evaluation', isProfit ? 'NET PROFIT / SURPLUS' : 'NET LOSS / DEFICIT', isProfit ? 'Healthy positive financial cash-flow.' : 'Deficit. Action required to curb outflows.'],
        ['Active Savings Rate Metrics', `${savingsRate}%`, 'Percentage of logged inflows saved.']
      ],
      theme: 'striped',
      headStyles: { fillColor: [53, 92, 75], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { fontStyle: 'bold', cellWidth: 40 },
        2: { cellWidth: 90 }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Section 3: ASSETS & LIABILITIES & NET WORTH Double Entry representation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(53, 92, 75);
    doc.text('III. STATEMENT OF ASSETS & LIABILITIES (NET WORTH)', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Asset Division Class', 'Amount', 'Liability Class Division', 'Amount']],
      body: [
        ['Cash Balance (Wallets)', `${currencySymbol}${cashBalance.toLocaleString('en-IN')}`, 'Outstanding Loans / Debts', `${currencySymbol}${loanLiability.toLocaleString('en-IN')}`],
        ['UPI Balance (Wallets)', `${currencySymbol}${upiBalance.toLocaleString('en-IN')}`, 'Outstanding Credit Due', `${currencySymbol}${creditCardDue.toLocaleString('en-IN')}`],
        ['Bank Account Balance', `${currencySymbol}${bankBalance.toLocaleString('en-IN')}`, 'Pending Unpaid Expenses', `${currencySymbol}${pendingPayments.toLocaleString('en-IN')}`],
        ['Savings Goal Deposits', `${currencySymbol}${savingsContributions.toLocaleString('en-IN')}`, 'Bills Payable Current Month', `${currencySymbol}${billsPayable.toLocaleString('en-IN')}`],
        ['Other Liquid Assets', `${currencySymbol}${otherAssets.toLocaleString('en-IN')}`, 'Other Miscellaneous Liabilities', `${currencySymbol}${otherLiabilitiesVal.toLocaleString('en-IN')}`],
        ['TOTAL ASSETS', `${currencySymbol}${totalAssetsVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'TOTAL LIABILITIES', `${currencySymbol}${totalLiabilitiesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [53, 92, 75], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { fontStyle: 'normal' },
        1: { fontStyle: 'bold' },
        2: { fontStyle: 'normal' },
        3: { fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        // Highlight totals row in bold & light background
        if (data.row.index === 5) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // NET WORTH SUMMARY BOX
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(53, 92, 75);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(53, 92, 75);
    doc.text('TOTAL NET WORTH STATEMENT EVALUATION:', margin + 4, y + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${currencySymbol}${netWorthVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + contentWidth - 4, y + 9.5, { align: 'right' });

    drawFooter(1);

    // PAGE 2: EXTRA INSIGHTS, SAVINGS GOALS & DETAILED TRANSACTIONS
    doc.addPage();
    y = 15;
    drawHeader('BudgetBloom Balance Sheet (Continued)', `Audited Goals, Expense Analytics, & Detailed Entries`);

    // Section 4: Expense insights & info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(53, 92, 75);
    doc.text('IV. INTELLIGENT EXPENSE INSIGHTS & SAVINGS MILESTONES', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['A. Expense Insight Parameter', 'Value / Details', 'B. Savings Goal Milestones', 'Progress Details']],
      body: [
        ['Highest Outflow Category', highestSpendingCategory, 'Goals Evaluated Count', `${goals.length} target profiles`],
        ['Most Used Payment Wallet', mostUsedMethod, 'Total Targets Set Amount', `${currencySymbol}${goals.reduce((sum, g) => sum + g.targetAmount, 0).toLocaleString('en-IN')}`],
        ['Single Largest Expenditures', largestExpenseLabel, 'Total Collected Savings', `${currencySymbol}${savingsContributions.toLocaleString('en-IN')}`],
        ['Monthly Running Outflow Scale', `${currencySymbol}${averageMonthlyExpense.toLocaleString('en-IN')}`, 'Aggregate Achievement Rate', `${goals.reduce((sum, g) => sum + g.targetAmount, 0) > 0 ? Math.round((savingsContributions / goals.reduce((sum, g) => sum + g.targetAmount, 0)) * 100) : 0}%`]
      ],
      theme: 'plain',
      headStyles: { fillColor: [53, 92, 75], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
      columnStyles: {
        0: { fontStyle: 'normal', cellWidth: 45 },
        1: { fontStyle: 'bold', cellWidth: 45 },
        2: { fontStyle: 'normal', cellWidth: 45 },
        3: { fontStyle: 'bold', cellWidth: 45 }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Section 5: Detailed Transactions Ledger
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(53, 92, 75);
    doc.text('V. RECENT AUDITED TRANSACTION ENTRIES', margin, y);
    y += 4;

    const tableRows = displayTransactions.map(t => [
      t.date,
      t.description,
      t.category,
      t.type.toUpperCase(),
      t.paymentMethod,
      `${t.type === 'income' ? '+' : '-'}${currencySymbol}${t.amount.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date Logged', 'Description Ledger Line', 'Category', 'Post Type', 'Payment Wallet', 'Incurred Amount']],
      body: tableRows.length > 0 ? tableRows : [['N/A', 'No matching ledger activities logged under active filter scope.', 'N/A', 'N/A', 'N/A', 'N/A']],
      theme: 'striped',
      headStyles: { fillColor: [53, 92, 75], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 6.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { fontStyle: 'normal', cellWidth: 22 },
        1: { fontStyle: 'bold', cellWidth: 55 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 33 },
        5: { fontStyle: 'bold', halign: 'right', cellWidth: 25 }
      }
    });

    drawFooter(2);

    doc.save(`BudgetBloom_Audited_Balance_Sheet_${reportType}.pdf`);

    // Write unread notification to Firestore
    if (profile?.uid) {
      addNotification({
        userId: profile.uid,
        text: `Balance Sheet PDF exported: Your detailed audited financial balance statement copy has been prepared.`,
        type: 'success'
      }).catch(err => console.error(err));
    }
  };

  // Programmatic high-quality PDF Report exporter
  const handleExportPDF = () => {
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

    // Drawing top brand header bar for each page
    const drawHeader = (pageNumber: number) => {
      // Background band at top
      doc.setFillColor(53, 92, 75); // #355C4B Theme Green
      doc.rect(margin, y, contentWidth, 20, 'F');

      // Brand Logo Initials "BB"
      doc.setFillColor(214, 165, 29); // #D6A51D Theme Gold
      doc.roundedRect(margin + 4, y + 4, 12, 12, 2.5, 2.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42); // slate-900 text
      doc.text('BB', margin + 8, y + 11.5, { align: 'center' });

      // Brand Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('BudgetBloom Financial Ledger', margin + 20, y + 9.5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(220, 232, 225);
      doc.text('Secure Personal Wealth & Budget Analytics Report', margin + 20, y + 14.5);

      // Period Scope & Timestamp Info
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      const periodLabel = reportType === 'June' ? 'June 2026 Summary' : 'Cumulative Ledgers';
      doc.text(periodLabel.toUpperCase(), margin + contentWidth - 4, y + 9.5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(214, 165, 29);
      doc.text(`Run: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin + contentWidth - 4, y + 14.5, { align: 'right' });

      y += 26;
    };

    const drawFooter = (pageNum: number, totalPagesPlaceholder: string) => {
      // Draw border footer separator
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 15, margin + contentWidth, pageHeight - 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('BudgetBloom Inc. • SSL Encryption Certified • Firestore Client Ledger Database', margin, pageHeight - 10);
      doc.text(`Page ${pageNum} of ${totalPagesPlaceholder}`, margin + contentWidth, pageHeight - 10, { align: 'right' });
    };

    // Initialize Page 1
    drawHeader(1);

    // MEMBER DETAILS CARD
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(53, 92, 75); // Theme green
    doc.text('MEMBER PROFILE & SECURITY LEDGER DETAIL:', margin, y);
    y += 4;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const clientName = profile?.name || profile?.displayName || 'BudgetBloom Member';
    const clientEmail = profile?.email || 'N/A';
    doc.text(`Account Holder: ${clientName}  |  Secure Registered Email: ${clientEmail}  |  Tracking Currency: ${currencySymbol}`, margin, y);
    y += 8;

    // I. FINANCIAL STATEMENTS SUMMARY BANNER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(53, 92, 75);
    doc.text('I. FINANCIAL SCOPE SUMMARY OVERVIEW', margin, y);
    y += 5;

    // Draw shaded card background for key metrics
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 38, 3, 3, 'FD');

    const colWidth = contentWidth / 4;
    
    // Total income metric block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('STATEMENTS INFLOW', margin + 6, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(16, 185, 129); // green-500
    doc.text('+' + currencySymbol + totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 }), margin + 6, y + 15);

    // Total expense metric block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('STATEMENTS OUTFLOW', margin + colWidth + 6, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(239, 68, 68); // red-500
    doc.text('-' + currencySymbol + totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 }), margin + colWidth + 6, y + 15);

    // Net value metric block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('NET SURPLUS DELTA', margin + colWidth * 2 + 6, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    const surplusColor = netSurplus >= 0 ? [53, 92, 75] : [239, 68, 68];
    doc.setTextColor(surplusColor[0], surplusColor[1], surplusColor[2]);
    const surplusSignOrEmpty = netSurplus >= 0 ? '+' : '';
    doc.text(surplusSignOrEmpty + currencySymbol + netSurplus.toLocaleString('en-IN', { minimumFractionDigits: 2 }), margin + colWidth * 2 + 6, y + 15);

    // Savings rate block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('SAVINGS METRIC RATE', margin + colWidth * 3 + 6, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(53, 92, 75);
    doc.text(`${savingsRate}%`, margin + colWidth * 3 + 6, y + 15);

    // Card internal divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + 5, y + 21, margin + contentWidth - 5, y + 21);

    // Supplementary metrics details inside summary block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('PEAK OUTFLOW SPECIFIC CATEGORY', margin + 6, y + 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const categoryLimitLabel = highestSpendingAmount > 0 ? `${highestSpendingCategory} (${currencySymbol}${highestSpendingAmount.toLocaleString('en-IN')})` : 'No Spending Record';
    doc.text(categoryLimitLabel, margin + 6, y + 32);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('DOMINANT ACCOUNT PAYMENT METHOD / SOURCE', margin + colWidth * 2 + 6, y + 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(mostUsedMethod.toUpperCase(), margin + colWidth * 2 + 6, y + 32);

    y += 46;

    // II. CATEGORY TARGET LIMITS & BUGET COMPLIANCE
    if (activeBudgets.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(53, 92, 75);
      doc.text('II. ACTIVE CATEGORY BUDGET COMPLIANCE', margin, y);
      y += 5;

      // Draw table header in budget green accent
      doc.setFillColor(53, 92, 75);
      doc.rect(margin, y, contentWidth, 7.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Budget Category', margin + 4, y + 5);
      doc.text('Temporal Period', margin + 65, y + 5);
      doc.text('Target Limit Cap', margin + contentWidth - 4, y + 5, { align: 'right' });
      
      y += 7.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      activeBudgets.forEach((b, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, 7, 'F');
        }
        doc.setTextColor(51, 65, 85);
        doc.text(b.category, margin + 4, y + 5);
        doc.text(b.month, margin + 65, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.text(currencySymbol + b.limit.toLocaleString('en-IN', { minimumFractionDigits: 2 }), margin + contentWidth - 4, y + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += 7;
      });

      y += 6;
    }

    // III. SAVINGS MILESTONES GOALS REGISTRY
    if (matchingGoals.length > 0) {
      // Ensure we don't overflow with section title
      if (y > 240) {
        drawFooter(doc.getNumberOfPages(), '??');
        doc.addPage();
        y = 15;
        drawHeader(doc.getNumberOfPages());
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(53, 92, 75);
      doc.text('III. SAVINGS MILESTONES & ASSET TARGET REGISTRY', margin, y);
      y += 5;

      // Table Header
      doc.setFillColor(53, 92, 75);
      doc.rect(margin, y, contentWidth, 7.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Asset Designation Goal', margin + 4, y + 5);
      doc.text('Target Milestone Date', margin + 65, y + 5);
      doc.text('Accumlated Ratio', margin + 115, y + 5);
      doc.text('Total Target Sum', margin + contentWidth - 4, y + 5, { align: 'right' });

      y += 7.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      matchingGoals.forEach((g, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, 7, 'F');
        }
        const progressRate = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
        doc.setTextColor(51, 65, 85);
        doc.text(g.name, margin + 4, y + 5);
        doc.text(g.targetDate, margin + 65, y + 5);
        doc.text(`${currencySymbol}${g.currentAmount} of ${currencySymbol}${g.targetAmount} (${progressRate}%)`, margin + 115, y + 5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(currencySymbol + g.targetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), margin + contentWidth - 4, y + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        y += 7;
      });

      y += 6;
    }

    // IV. DETAILED LEDGER ENTRY RECORDS
    if (y > 230) {
      drawFooter(doc.getNumberOfPages(), '??');
      doc.addPage();
      y = 15;
      drawHeader(doc.getNumberOfPages());
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(53, 92, 75);
    doc.text('IV. DETAILED LEDGER TRANSACTION RECORDS', margin, y);
    y += 5;

    const drawTableHead = (currentY: number) => {
      doc.setFillColor(30, 41, 59); // Slate dark gray for ledger
      doc.rect(margin, currentY, contentWidth, 8, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Date', margin + 4, currentY + 5.5);
      doc.text('Description Ledger Entry', margin + 28, currentY + 5.5);
      doc.text('Category', margin + 85, currentY + 5.5);
      doc.text('Payment Source', margin + 124, currentY + 5.5);
      doc.text('Inflow/Outflow Amount', margin + contentWidth - 4, currentY + 5.5, { align: 'right' });
    };

    drawTableHead(y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    displayTransactions.forEach((t, idx) => {
      // Standard overflow threshold checks
      if (y > 268) {
        drawFooter(doc.getNumberOfPages(), '??');
        doc.addPage();
        y = 15;
        drawHeader(doc.getNumberOfPages());
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(53, 92, 75);
        doc.text('IV. DETAILED LEDGER TRANSACTION RECORDS (CONTINUED)', margin, y);
        y += 5;
        
        drawTableHead(y);
        y += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 7, 'F');
      }

      // Format row line columns
      doc.setTextColor(100, 116, 139);
      doc.text(t.date, margin + 4, y + 4.8);
      
      doc.setTextColor(30, 41, 59);
      const stringRepresentation = t.description.length > 36 ? t.description.substring(0, 36) + '...' : t.description;
      doc.text(stringRepresentation, margin + 28, y + 4.8);
      
      doc.text(t.category, margin + 85, y + 4.8);
      doc.text(t.paymentMethod, margin + 124, y + 4.8);

      if (t.type === 'income') {
        doc.setTextColor(16, 185, 129); // positive text green
        doc.setFont('helvetica', 'bold');
        doc.text('+' + currencySymbol + t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), margin + contentWidth - 4, y + 4.8, { align: 'right' });
      } else {
        doc.setTextColor(239, 68, 68); // negative text red
        doc.setFont('helvetica', 'bold');
        doc.text('-' + currencySymbol + t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), margin + contentWidth - 4, y + 4.8, { align: 'right' });
      }

      doc.setFont('helvetica', 'normal');
      y += 7;
    });

    if (displayTransactions.length === 0) {
      doc.setTextColor(148, 163, 184);
      doc.text('No matching transactions captured under this ledger scope view.', margin + contentWidth / 2, y + 8, { align: 'center' });
      y += 15;
    }

    // Set genuine Total Page count across all footers dynamically
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, String(totalPages));
    }

     // Write file & trigger download prompt
     doc.save(`BudgetBloom_${reportType}_Summary_Report.pdf`);

     // Save notification in Firestore
     if (profile?.uid) {
       addNotification({
         userId: profile.uid,
         text: `PDF Report Downloaded: ${reportType === 'June' ? 'June 2026 Summary' : 'Cumulative'} Financial PDF exported.`,
         type: 'success'
       }).catch(err => console.error("Could not write notification: ", err));
     }
  };

  // Browser Print trigger (handles clean styled layout printing as PDF)
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in text-[#1F2933]">
      
      {/* Title BLOCK (Hidden on print!) */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 no-print bg-[#355C4B] rounded-2xl p-5 text-white border border-[#274437]">
        <div>
          <span className="bg-[#D6A51D] text-slate-950 font-mono text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-inner">
            EXPORTER TOOLKIT
          </span>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl mt-1.5 tracking-tight">Export & Print Center</h2>
          <p className="text-xs text-[#DCE8E1]/85">Download raw transactional ledgers, active goal sheets, budget thresholds, or export a detailed printed report PDF.</p>
        </div>
      </div>

      {/* FILTER PANEL (Hidden on print) */}
      <div className="p-4 rounded-2xl border no-print bg-[#EDF7F2] dark:bg-[#1E2923] border-[#CCE2D6] dark:border-[#274437] shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 text-slate-800 dark:text-slate-100">
        
        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-800 dark:text-emerald-400" />
          <input 
            type="text" 
            placeholder="Search matching items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-[#CCE2D6] dark:border-[#274437] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#355C4B] dark:text-emerald-100"
          />
        </div>

        {/* Buttons container */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:justify-end">
          <button 
            type="button"
            onClick={handleExportPDF}
            className="flex items-center justify-center space-x-1.5 py-2 px-4 rounded-xl bg-[#355C4B] hover:bg-[#274437] text-xs font-bold text-white transition-all shadow cursor-pointer"
            id="download-pdf-report-btn"
          >
            <FileText className="w-4 h-4 text-[#D6A51D]" />
            <span>Download PDF</span>
          </button>
          
          <button 
            type="button"
            onClick={() => setIsBalanceSheetOpen(true)}
            className="flex items-center justify-center space-x-1.5 py-2 px-4 rounded-xl bg-white dark:bg-slate-900 border border-[#355C4B]/20 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold text-[#355C4B] dark:text-[#A2C3B4] transition-all shadow cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#D6A51D]" />
            <span>Balance Sheet</span>
          </button>
        </div>

      </div>

      {/* RAW DOCUMENT REPRESENTATION (The printable page layout & print mockup!) */}
      <div id="printable-report-sheet" className="p-8 rounded-3xl border shadow bg-white text-slate-800 border-[#DCE8E1]">
        
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-[#355C4B] flex items-center justify-center text-white font-bold text-sm">
                BB
              </div>
              <span className="font-display font-black text-lg text-[#355C4B]">BudgetBloom Financial Dashboard</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Audit Ledger Statement • Private Security copy</p>
          </div>

          <div className="text-right text-xs">
            <p className="font-bold text-slate-500">STATEMENT PERIOD</p>
            <p className="font-mono text-[#355C4B] mt-0.5 uppercase font-bold text-xs">
              {reportType === 'June' ? 'June 01 - June 30, 2026' : 'Aggregated All-Time'}
            </p>
          </div>
        </div>

        {/* 1. ANALYTICS SUMMARY BOX */}
        <div className="space-y-4 mb-8">
          <h4 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider">I. Analytics Overview Summary</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-450">Statements Inflow</span>
              <p className="font-display font-bold text-lg text-emerald-600 mt-1">
                +{formatRupee(totalIncome)}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-450">Statements Outflow</span>
              <p className="font-display font-bold text-lg text-rose-500 mt-1">
                -{formatRupee(totalExpense)}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-450">Net Surplus Delta</span>
              <p className={`font-display font-bold text-lg mt-1 ${netSurplus >= 0 ? 'text-[#355C4B]' : 'text-rose-500'}`}>
                {netSurplus >= 0 ? '+' : '-'}{formatRupee(Math.abs(netSurplus))}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-450">Savings Rate %</span>
              <p className="font-display font-bold text-lg text-[#355C4B] mt-1">
                {savingsRate}%
              </p>
            </div>

            {/* Sub analytic KPI parameters */}
            <div className="col-span-2 pt-3 border-t border-slate-200 text-xs text-slate-500">
              <span className="font-bold text-slate-400 text-[9px] uppercase block">Highest Spending Category</span>
              <p className="font-semibold text-slate-700 mt-0.5">{highestSpendingCategory} ({formatRupee(highestSpendingAmount)})</p>
            </div>
            <div className="col-span-2 pt-3 border-t border-slate-200 text-xs text-slate-500">
              <span className="font-bold text-slate-400 text-[9px] uppercase block">Most Active Payment Method</span>
              <p className="font-semibold text-slate-700 mt-0.5">{mostUsedMethod}</p>
            </div>
          </div>
        </div>

        {/* 2. CATEGORY BUDGET ALLOCATIONS */}
        {activeBudgets.length > 0 && (
          <div className="space-y-4 mb-8">
            <h4 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider">II. Category Budget Limits Summary</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-455 uppercase">
                    <th className="py-2">Category</th>
                    <th className="py-2">Month Period</th>
                    <th className="py-2 text-right">Limit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {activeBudgets.map(b => (
                    <tr key={b.id}>
                      <td className="py-2 font-semibold text-slate-800">{b.category}</td>
                      <td className="py-2 text-slate-500">{b.month}</td>
                      <td className="py-2 text-right font-extrabold">{formatRupee(b.limit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. SAVINGS MILESTONES & GOALS */}
        {matchingGoals.length > 0 && (
          <div className="space-y-4 mb-8">
            <h4 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider">III. Savings Milestones Registry</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-455 uppercase">
                    <th className="py-2">Goal Target</th>
                    <th className="py-2">Target Date</th>
                    <th className="py-2 text-center">Progress Rate</th>
                    <th className="py-2 text-right">Target Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {matchingGoals.map(g => {
                    const percent = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                    return (
                      <tr key={g.id}>
                        <td className="py-2 font-semibold text-slate-800">{g.name}</td>
                        <td className="py-2 text-slate-500">{g.targetDate}</td>
                        <td className="py-2 text-center font-bold text-[#355C4B]">
                          {g.currentAmount} / {g.targetAmount} ({percent}%)
                        </td>
                        <td className="py-2 text-right font-extrabold">{formatRupee(g.targetAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. LEDGER ENTRIES LIST FOR PRINT */}
        <div className="space-y-4">
          <h4 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider">IV. Detailed Transaction Entries</h4>
          
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                <th className="py-2.5">Date</th>
                <th className="py-2.5">Description</th>
                <th className="py-2.5">Category</th>
                <th className="py-2.5">Wallet Source</th>
                <th className="py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayTransactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 font-mono text-slate-400">{t.date}</td>
                  <td className="py-2.5 font-semibold text-slate-800">{t.description}</td>
                  <td className="py-2.5">{t.category}</td>
                  <td className="py-2.5 text-slate-500">{t.paymentMethod}</td>
                  <td className={`py-2.5 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatRupee(t.amount)}
                  </td>
                </tr>
              ))}
              {displayTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    No transactions captured in this report block.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Footer */}
        <div className="text-center text-[10px] text-slate-400 border-t border-slate-200 pt-8 mt-12">
          <p>This statement represents secure financial assets computed dynamically via BudgetBloom API.</p>
          <p className="mt-0.5">BudgetBloom Inc. • SSL Encryption Certified • Secure Firestore Storage.</p>
        </div>

      </div>

      {/* BALANCE SHEET PREVIEW OVERLAY MODAL */}
      {isBalanceSheetOpen && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-md overflow-y-auto no-print">
          {/* Backdrop Click Layer to close */}
          <div 
            className="fixed inset-0 w-full h-full cursor-default" 
            onClick={() => setIsBalanceSheetOpen(false)} 
          />
          
          {/* Alignment Wrapper: flex justify-center items-start pt-6 pb-12 w-full */}
          <div className="relative flex justify-center items-start pt-6 pb-12 w-full z-10">
            {/* The Balance Sheet Card */}
            <div className="balance-sheet-modal w-full max-w-5xl mx-4 bg-white rounded-3xl shadow-2xl flex flex-col border border-[#E2E8F0] animate-scale-up text-[#1E293B] select-none overflow-hidden">
            
            {/* Modal Header: Clear typography, elegant top padding, white bg, soft border */}
            <div className="py-4 px-6 border-b border-[#E2E8F0] bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none relative">
              <div>
                <span className="bg-[#D4A017]/10 text-[#D4A017] font-mono text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded">
                  OFFICIAL AUDITED STATEMENT
                </span>
                <h3 className="font-display font-black text-xl mt-0.5 text-[#1E293B]">BudgetBloom Balance Sheet</h3>
                <p className="text-[10px] text-[#64748B] font-medium mt-0.5">Dynamic accounting statement of capital assets, liabilities, earnings, and net position.</p>
              </div>

              {/* Top Right Information - 2x2 grid with beautiful icons */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-[#64748B] text-left min-w-[285px] md:min-w-[320px] mr-10">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-[#94A3B8] tracking-wider leading-none">Account Holder</span>
                    <span className="font-bold text-[#1E293B] block truncate max-w-[140px] mt-0.5">{clientName}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-[#94A3B8] tracking-wider leading-none">Email</span>
                    <span className="font-bold text-[#1E293B] block truncate max-w-[140px] mt-0.5" title={clientEmail}>{clientEmail}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-[#94A3B8] tracking-wider leading-none">Statement Period</span>
                    <span className="font-bold text-[#355C4B] block mt-0.5">{statementPeriod}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-[#94A3B8] tracking-wider leading-none">Generated On</span>
                    <span className="font-bold font-mono text-[#64748B] block mt-0.5">{generatedDate}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsBalanceSheetOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex items-center justify-center animate-pulse"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body: Scrollable with clean internal scrolling as safety net, fits beautifully without tricky scales */}
            <div className="overflow-y-auto flex-1 bg-slate-50 text-[#1E293B] p-5">
              <div className="space-y-4">
                
                {/* 1. FINANCIAL SUMMARY CARDS */}
                <div className="grid grid-cols-4 gap-3">
                  
                  {/* Card 1: Total Inflows */}
                  <div className="flex items-center space-x-3 p-3 bg-white border border-[#E2E8F0] rounded-xl shadow-xs hover:shadow-sm transition-all">
                    <div className="p-2.5 rounded-lg bg-emerald-50 text-[#10B981] shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">TOTAL INFLOWS</span>
                      <span className="text-sm font-extrabold text-[#10B981] block mt-0.5 font-mono">
                        +{formatRupee(totalIncome)}
                      </span>
                      <span className="text-[9px] text-[#94A3B8] block mt-0.5 font-medium">Logged income sources</span>
                    </div>
                  </div>

                  {/* Card 2: Total Expenses */}
                  <div className="flex items-center space-x-3 p-3 bg-white border border-[#E2E8F0] rounded-xl shadow-xs hover:shadow-sm transition-all">
                    <div className="p-2.5 rounded-lg bg-rose-50 text-[#EF4444] shrink-0">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">TOTAL EXPENSES</span>
                      <span className="text-sm font-extrabold text-[#EF4444] block mt-0.5 font-mono">
                        -{formatRupee(totalExpense)}
                      </span>
                      <span className="text-[9px] text-[#94A3B8] block mt-0.5 font-medium">Logged dynamic outflows</span>
                    </div>
                  </div>

                  {/* Card 3: Saved Targets */}
                  <div className="flex items-center space-x-3 p-3 bg-white border border-[#E2E8F0] rounded-xl shadow-xs hover:shadow-sm transition-all">
                    <div className="p-2.5 rounded-lg bg-teal-50 text-emerald-605 shrink-0">
                      <WalletIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">SAVED TARGETS</span>
                      <span className="text-sm font-extrabold text-emerald-600 block mt-0.5 font-mono font-medium">
                        {formatRupee(savingsContributions)}
                      </span>
                      <span className="text-[9px] text-[#94A3B8] block mt-0.5 font-medium">10% safe savings rate</span>
                    </div>
                  </div>

                  {/* Card 4: Available Liquid */}
                  <div className="flex items-center space-x-3 p-3 bg-white border border-[#E2E8F0] rounded-xl shadow-xs hover:shadow-sm transition-all">
                    <div className="p-2.5 rounded-lg bg-amber-50 text-amber-550 shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">AVAILABLE LIQUID</span>
                      <span className={`text-sm font-extrabold block mt-0.5 font-mono ${availableBalanceLeft >= 0 ? 'text-[#355C4B]' : 'text-[#EF4444]'}`}>
                        {formatRupee(availableBalanceLeft)}
                      </span>
                      <span className="text-[9px] text-[#94A3B8] block mt-0.5 font-medium">Cash-flow Profit</span>
                    </div>
                  </div>

                </div>

                {/* 2. MIDDLE SECTION: THREE-COLUMN LAYOUT */}
                <div className="grid grid-cols-3 gap-3.5">
                  
                  {/* Column 1: Assets Column */}
                  <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                    <div className="py-2.5 px-3.5 border-b border-[#E2E8F0] flex items-center space-x-2 shrink-0 bg-white">
                      <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-650">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <h4 className="text-[10px] font-black text-emerald-750 uppercase tracking-wider">Assets Ledger Registry</h4>
                    </div>
                    <div className="p-3 divide-y divide-slate-100 text-[10.5px] space-y-1.5 flex-grow flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Cash Balance</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(cashBalance)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">UPI Balance</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(upiBalance)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Bank Balance</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(bankBalance)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Savings Goal Contributions</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(savingsContributions)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Other Assets</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(otherAssets)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between pt-2.5 font-bold text-emerald-700">
                        <span>TOTAL ASSETS</span>
                        <span className="font-mono">{formatRupee(totalAssetsVal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Liabilities Column */}
                  <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                    <div className="py-2.5 px-3.5 border-b border-[#E2E8F0] flex items-center space-x-2 shrink-0 bg-white">
                      <div className="p-1.5 rounded-md bg-rose-50 text-rose-650">
                        <TrendingDown className="w-4 h-4 text-[#EF4444]" />
                      </div>
                      <h4 className="text-[10px] font-black text-rose-750 uppercase tracking-wider">Liabilities Outstanding</h4>
                    </div>
                    <div className="p-3 divide-y divide-slate-100 text-[10.5px] space-y-1.5 flex-grow flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Loans</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(loanLiability)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Credit Due</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(creditCardDue)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Pending Payments</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(pendingPayments)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Bills Payable</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(billsPayable)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-[#64748B] font-medium">Other Liabilities</span>
                          <span className="font-bold text-[#1E293B]">{formatRupee(otherLiabilitiesVal)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between pt-2.5 font-bold text-rose-650">
                        <span>TOTAL LIABILITIES</span>
                        <span className="font-mono">{formatRupee(totalLiabilitiesVal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Stacked Net Worth & Profit/Loss Summary */}
                  <div className="flex flex-col gap-3 justify-between font-sans">
                    
                    {/* Card 3A: NET WORTH */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs flex flex-col flex-grow justify-between">
                      <div className="py-2 px-3 border-b border-[#E2E8F0] flex items-center space-x-1.5 bg-white shrink-0">
                        <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <h4 className="text-[10px] font-extrabold text-emerald-755 uppercase tracking-wider">Net Worth Summary</h4>
                      </div>
                      <div className="p-3 divide-y divide-[#E2E8F0] text-[10.5px] space-y-1 flex-grow flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="flex justify-between py-0.5">
                            <span className="text-[#64748B] font-medium">Total Assets</span>
                            <span className="font-bold text-[#1E293B]">{formatRupee(totalAssetsVal)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-[#64748B] font-medium">Total Liabilities</span>
                            <span className="font-bold text-rose-600">-{formatRupee(totalLiabilitiesVal)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between pt-2.5 font-bold text-emerald-600">
                          <span>NET WORTH</span>
                          <span className="font-mono">{formatRupee(netWorthVal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3B: PROFIT & LOSS SUMMARY */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs flex flex-col flex-grow justify-between">
                      <div className="py-2 px-3 border-b border-[#E2E8F0] flex items-center space-x-1.5 bg-white shrink-0">
                        <PieChart className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <h4 className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">Profit / Loss Summary</h4>
                      </div>
                      <div className="p-3 divide-y divide-[#E2E8F0] text-[10.5px] space-y-1 flex-grow flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="flex justify-between py-0.5">
                            <span className="text-[#64748B] font-medium">Total Income</span>
                            <span className="font-bold text-[#1E293B]">{formatRupee(totalIncome)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-[#64748B] font-medium">Total Expenses</span>
                            <span className="font-bold text-rose-600">-{formatRupee(totalExpense)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between pt-2.5 font-bold text-emerald-600">
                          <span>NET SURPLUS</span>
                          <span className="font-mono">{formatRupee(availableBalanceLeft)}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

                {/* 3. LOWER SECTION: TWO-COLUMN LAYOUT */}
                <div className="grid grid-cols-2 gap-3.5">
                  
                  {/* Expense Highlights */}
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center space-x-1.5 border-b border-[#E2E8F0] pb-2 mb-2">
                      <div className="p-1 rounded bg-purple-50 text-purple-600 shrink-0">
                        <PieChart className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">
                        Expense Highlights
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                      <div className="p-2 rounded-lg bg-purple-50/40 border border-purple-100/50">
                        <span className="text-[8px] uppercase font-bold text-purple-500 tracking-wider block leading-none">Highest spending segment</span>
                        <span className="font-extrabold text-purple-900 block mt-1 truncate animate-pulse" title={highestSpendingCategory}>
                          {highestSpendingCategory || 'N/A'}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-50/40 border border-purple-100/50">
                        <span className="text-[8px] uppercase font-bold text-purple-500 tracking-wider block leading-none">Primary Wallet Instrument</span>
                        <span className="font-extrabold text-purple-900 block mt-1 truncate">
                          {mostUsedMethod || 'N/A'}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-50/40 border border-purple-100/50">
                        <span className="text-[8px] uppercase font-bold text-purple-500 tracking-wider block leading-none">Single largest outflow draft</span>
                        <span className="font-extrabold text-purple-900 block mt-1 truncate" title={largestExpenseLabel}>
                          {largestExpenseLabel}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-50/40 border border-purple-100/50">
                        <span className="text-[8px] uppercase font-bold text-purple-500 tracking-wider block leading-none">Running average outflow rate</span>
                        <span className="font-extrabold text-[#EF4444] block mt-1 font-mono">
                          {formatRupee(averageMonthlyExpense)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Savings Goals Summary */}
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center space-x-1.5 border-b border-[#E2E8F0] pb-2 mb-2">
                      <div className="p-1 rounded bg-emerald-50 text-emerald-600 shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                        Savings Goals Summary
                      </h4>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="text-[#64748B] font-bold border-b border-[#E2E8F0]">
                            <th className="py-1 pb-1.5 font-semibold text-[8px] uppercase tracking-wider">Goal Name</th>
                            <th className="py-1 pb-1.5 font-semibold text-[8px] uppercase tracking-wider text-right">Target Amount</th>
                            <th className="py-1 pb-1.5 font-semibold text-[8px] uppercase tracking-wider text-right">Saved Amount</th>
                            <th className="py-1 pb-1.5 font-semibold text-[8px] uppercase tracking-wider text-right">Remaining Amount</th>
                            <th className="py-1 pb-1.5 font-semibold text-[8px] uppercase tracking-wider text-right">Progress</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[#1E293B]">
                          {matchingGoals.map(g => {
                            const percent = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
                            return (
                              <tr key={g.id} className="hover:bg-slate-50/50">
                                <td className="py-1 font-bold text-slate-800 truncate max-w-[100px]">{g.name}</td>
                                <td className="py-1 text-right font-mono text-slate-600">{formatRupee(g.targetAmount)}</td>
                                <td className="py-1 text-right font-mono text-slate-600">{formatRupee(g.currentAmount)}</td>
                                <td className="py-1 text-right font-mono text-slate-600">{formatRupee(remaining)}</td>
                                <td className="py-1 text-right">
                                  <div className="flex flex-col items-end space-y-0.5">
                                    <span className="font-bold text-emerald-600 font-mono text-[9px]">{percent}%</span>
                                    <div className="w-12 bg-slate-100 rounded-full h-1 overflow-hidden">
                                      <div className="bg-[#10B981] h-1 rounded-full" style={{ width: `${percent}%` }} />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {matchingGoals.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-slate-400 font-medium leading-none">
                                No active milestones registered under scope.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* 4. BOTTOM SECTION: TRANSACTION SUMMARY TABLE */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
                  <div className="flex items-center space-x-1.5 border-b border-[#E2E8F0] pb-2 mb-2">
                    <div className="p-1 rounded bg-slate-55 text-slate-650 shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider">
                      Transaction Summary
                    </h4>
                  </div>
                  <div className="overflow-x-auto max-h-[110px] rounded-lg border border-[#E2E8F0]">
                    <table className="w-full text-left border-collapse text-[10.5px]">
                      <thead className="bg-[#F8FAFC] text-[#1E293B] font-bold border-b border-[#E2E8F0] sticky top-0 z-10 text-[9px] uppercase tracking-wider">
                        <tr>
                          <th className="py-1.5 px-3">Date</th>
                          <th className="py-1.5 px-3">Description</th>
                          <th className="py-1.5 px-3">Category</th>
                          <th className="py-1.5 px-3">Type</th>
                          <th className="py-1.5 px-3">Payment Method</th>
                          <th className="py-1.5 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[#1E293B] bg-white text-[10px]">
                        {displayTransactions.slice(0, 3).map(t => (
                          <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-3 font-mono text-[#64748B]">{t.date}</td>
                            <td className="py-1.5 px-3 font-bold text-[#1E293B] truncate max-w-[150px]" title={t.description}>{t.description}</td>
                            <td className="py-1.5 px-3 text-[#64748B]">{t.category}</td>
                            <td className="py-1.5 px-3">
                              <span className={`inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded text-[7.5px] font-extrabold ${
                                t.type === 'income' ? 'bg-emerald-50 text-emerald-605 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                              }`}>
                                <span>{t.type === 'income' ? 'Income' : 'Expense'}</span>
                                {t.type === 'income' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-slate-500 font-bold font-sans text-[8.5px] uppercase tracking-wider">{t.paymentMethod}</td>
                            <td className={`py-1.5 px-3 text-right font-extrabold font-mono ${
                              t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {t.type === 'income' ? '+' : '-'}{formatRupee(t.amount)}
                            </td>
                          </tr>
                        ))}
                        {displayTransactions.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-[#64748B] font-medium leading-none">
                              No transactions registry matches logged.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Bottom Actions with premium grey bg and spacing */}
            <div className="p-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex justify-end space-x-3.5 no-print flex-none">
              <button
                type="button"
                onClick={() => setIsBalanceSheetOpen(false)}
                className="py-1 px-3 rounded-md border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownloadBalanceSheetPDF();
                  setIsBalanceSheetOpen(false);
                }}
                className="py-1 px-4.5 rounded-md bg-[#355C4B] hover:bg-[#274437] text-white hover:text-[#D6A51D] text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-2"
              >
                <Download className="w-3.5 h-3.5 text-[#D6A51D]" />
                <span>Download Balance Sheet PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

    </div>
  );
}
