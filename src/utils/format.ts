let currentGlobalCurrency = 'INR';

export function setGlobalCurrency(currency: string) {
  currentGlobalCurrency = currency;
}

export function formatRupee(value: number): string {
  let locale = 'en-IN';
  if (currentGlobalCurrency === 'USD') {
    locale = 'en-US';
  } else if (currentGlobalCurrency === 'EUR') {
    locale = 'en-IE';
  } else if (currentGlobalCurrency === 'GBP') {
    locale = 'en-GB';
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currentGlobalCurrency,
    maximumFractionDigits: 0
  });
  return formatter.format(value);
}

export const monthsMapFull: { [key: string]: string } = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December'
};

export function filterTransactionsByDate(
  transactions: any[],
  filterYear: string,
  filterMonth: string,
  filterDate: string,
  activeQuickFilter: 'today' | 'week' | 'month' | 'year' | 'all' | null
) {
  return transactions.filter(t => {
    if (activeQuickFilter === 'week') {
      const txDateObj = new Date(t.date);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const day = today.getDay();
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
}
