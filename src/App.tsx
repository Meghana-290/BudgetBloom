import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';
import { subscribeToUserData, addNotification, syncOfflineTransactions, migrateGlobalDataIfAny } from './dbHelper';
import { Page, Transaction, Budget, Wallet, Goal, UserProfile, AppNotification, Reminder } from './types';
import { safeStorage } from './utils/storage';
import { getCachedTransactions, saveCachedTransactions, getOfflineTransactions } from './utils/offlineDB';

// Importing Custom tab views
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import DashboardTab from './components/DashboardTab';
import TransactionsTab from './components/TransactionsTab';
import SavingsTab from './components/SavingsTab';
import BudgetsTab from './components/BudgetsTab';
import AnalyticsTab from './components/AnalyticsTab';
import ReportsTab from './components/ReportsTab';
import ExportTab from './components/ExportTab';
import ProfileTab, { detectUserCurrency } from './components/ProfileTab';
import NotificationsTab from './components/NotificationsTab';
import { setGlobalCurrency } from './utils/format';

// Global Modal component
import GlobalTransactionModal from './components/GlobalTransactionModal';
import { LogOut, RefreshCw, Eye, EyeOff, Lock, Fingerprint, ShieldAlert } from 'lucide-react';

export default function App() {
  // Theme & Currency States
  const [darkMode, setDarkMode] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  // Auto-lock states for 24-hour inactivity check
  const [isLocked, setIsLocked] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [showLockPassword, setShowLockPassword] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Page Routing State - reading initial route from path hash
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const hash = window.location.hash.slice(1);
    const pageValues = Object.values(Page) as string[];
    if (hash && pageValues.includes(hash)) {
      return hash as Page;
    }
    return Page.LANDING;
  });
  const [collapsed, setCollapsed] = useState(false);

  // Authentication States
  const [uid, setUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Logout confirmation modal states
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Core Financial synced states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Offline & Synchronization States
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Unified global date filter states
  const [filterMonth, setFilterMonth] = useState('06');
  const [filterYear, setFilterYear] = useState('2026');
  const [filterDate, setFilterDate] = useState('all');
  const [activeQuickFilter, setActiveQuickFilter] = useState<'today' | 'week' | 'month' | 'year' | 'all' | null>(null);

  // Global transactional triggers
  const [globalTxModalOpen, setGlobalTxModalOpen] = useState(false);
  const [globalTxType, setGlobalTxType] = useState<'income' | 'expense'>('expense');
  const [globalScannerOpen, setGlobalScannerOpen] = useState(false);

  const handleAddTransaction = (type: 'income' | 'expense', scannerOpen = false) => {
    setGlobalTxType(type);
    setGlobalScannerOpen(scannerOpen);
    setGlobalTxModalOpen(true);
  };

  // Monitor Auth Status
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        // Enforce inactivity checks right at the gate
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const lastActive = safeStorage.getItem('budgetbloom_last_active_at');
        let needsLock = false;

        if (lastActive) {
          const inactiveTime = Date.now() - parseInt(lastActive, 10);
          if (inactiveTime > THREE_DAYS_MS) {
            console.log('Session expired due to 3 days of inactivity. Auto signing out.');
            safeStorage.removeItem('budgetbloom_last_active_at');
            try {
              await signOut(auth);
            } catch (err) {
              console.error('Sign out failed during auto-inactivity-out:', err);
            }
            setUid(null);
            setProfile(null);
            setTransactions([]);
            setBudgets([]);
            setWallets([]);
            setGoals([]);
            setAppNotifications([]);
            setCurrentPage(Page.LANDING);
            window.location.hash = Page.LANDING;
            setAuthLoading(false);
            return;
          } else if (inactiveTime > TWENTY_FOUR_HOURS_MS) {
            console.log('Session locked due to 24 hours of inactivity.');
            setIsLocked(true);
            needsLock = true;
          }
        }

        // Keep active timestamp fresh ONLY if we are not locked out
        if (!needsLock) {
          safeStorage.setItem('budgetbloom_last_active_at', Date.now().toString());
        }
        setUid(user.uid);
        
        // Sync with page hash or fallback to dashboard
        const currentHash = window.location.hash.slice(1);
        const pageValues = Object.values(Page) as string[];
        if (currentHash && pageValues.includes(currentHash) && currentHash !== Page.LANDING) {
          setCurrentPage(currentHash as Page);
          window.location.hash = currentHash;
        } else {
          setCurrentPage(Page.DASHBOARD);
          window.location.hash = Page.DASHBOARD;
        }
      } else {
        setUid(null);
        setProfile(null);
        setTransactions([]);
        setBudgets([]);
        setWallets([]);
        setGoals([]);
        setAppNotifications([]);
        setCurrentPage(Page.LANDING);
        window.location.hash = Page.LANDING;
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync state changes from url hash securely (e.g. browser back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash.slice(1);
      if (!currentHash) {
        if (uid) {
          setCurrentPage(Page.DASHBOARD);
          window.location.hash = Page.DASHBOARD;
        } else {
          setCurrentPage(Page.LANDING);
          window.location.hash = Page.LANDING;
        }
        return;
      }

      const pageValues = Object.values(Page) as string[];
      if (pageValues.includes(currentHash)) {
        const targetPage = currentHash as Page;
        if (!uid && targetPage !== Page.LANDING) {
          // Block navigation if logged out
          setCurrentPage(Page.LANDING);
          window.location.hash = Page.LANDING;
        } else if (uid && targetPage === Page.LANDING) {
          // If logged in and page is landing page, redirect to dashboard
          setCurrentPage(Page.DASHBOARD);
          window.location.hash = Page.DASHBOARD;
        } else {
          setCurrentPage(targetPage);
        }
      } else {
        if (uid) {
          setCurrentPage(Page.DASHBOARD);
          window.location.hash = Page.DASHBOARD;
        } else {
          setCurrentPage(Page.LANDING);
          window.location.hash = Page.LANDING;
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [uid]);

  // Handle programmatically-triggered navigation updates (e.g., clicking sidebar links)
  useEffect(() => {
    if (currentPage) {
      if (window.location.hash !== `#${currentPage}`) {
        window.location.hash = currentPage;
      }
    }
  }, [currentPage]);

  // Keep track of user interactions to maintain fresh lastActiveAt
  useEffect(() => {
    if (!uid || isLocked) return;

    let lastWriteTime = Date.now();
    const handleUserInteraction = () => {
      if (isLocked) return;
      const now = Date.now();
      // Write to localStorage at most once every 30 seconds to reduce I/O overhead
      if (now - lastWriteTime > 30000) {
        safeStorage.setItem('budgetbloom_last_active_at', now.toString());
        lastWriteTime = now;
      }
    };

    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, [uid, isLocked]);

  // Periodic background check for 24-hour inactivity to auto-lock the screen
  useEffect(() => {
    if (!uid || isLocked) return;

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const interval = setInterval(() => {
      const lastActive = safeStorage.getItem('budgetbloom_last_active_at');
      if (lastActive) {
        const inactiveTime = Date.now() - parseInt(lastActive, 10);
        if (inactiveTime > TWENTY_FOUR_HOURS_MS) {
          console.log('Auto-locking screen due to 24 hours of inactivity.');
          setIsLocked(true);
        }
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [uid, isLocked]);

  // Helper to load and combine offline and cached transactions from IndexedDB
  const loadLocalTransactions = async () => {
    if (!uid) return;
    try {
      const cached = await getCachedTransactions(uid);
      const offline = await getOfflineTransactions(uid);
      const merged = [...offline, ...cached];
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(merged);
      setPendingSyncCount(offline.length);
    } catch (err) {
      console.error("Failed to load local transactions:", err);
    }
  };

  // 1. Initial local load as soon as UID is known (before firestore responds)
  useEffect(() => {
    if (uid) {
      loadLocalTransactions();
    }
  }, [uid]);

  // 2. Listen to local changes (e.g., when a user adds an offline transaction)
  useEffect(() => {
    window.addEventListener('budgetbloom-tx-change', loadLocalTransactions);
    return () => {
      window.removeEventListener('budgetbloom-tx-change', loadLocalTransactions);
    };
  }, [uid]);

  // 3. Keep online status and auto-sync in sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically trigger sync when coming online
      triggerAutoSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        triggerAutoSync();
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [uid]);

  const triggerAutoSync = async () => {
    if (!uid) return;
    const offline = await getOfflineTransactions(uid);
    if (offline.length > 0) {
      handleManualSync();
    }
  };

  const handleManualSync = async () => {
    if (!uid || syncing) return;
    setSyncing(true);
    setSyncStatusMsg("Synchronizing local offline transactions...");
    try {
      const result = await syncOfflineTransactions(uid);
      if (result.totalCount > 0) {
        setSyncStatusMsg(`Successfully synchronized ${result.successCount} transaction(s)!`);
        setTimeout(() => setSyncStatusMsg(null), 4000);
      } else {
        setSyncStatusMsg(null);
      }
    } catch (err) {
      console.error("Sync failed:", err);
      setSyncStatusMsg("Sync failed. Device might be offline or Firestore unreachable.");
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setSyncing(false);
      loadLocalTransactions();
    }
  };

  // Monitor Database streams when authenticated
  useEffect(() => {
    if (!uid) return;

    let active = true;
    let unsubscribeDB: (() => void) | null = null;

    const setupStream = async () => {
      // First, run global data migration so subcollections are fully populated before subscription
      await migrateGlobalDataIfAny(uid);

      if (!active) return;

      unsubscribeDB = subscribeToUserData(uid, {
        onTransactions: async (data) => {
          // Overwrite local cached items
          await saveCachedTransactions(uid, data);
          // Load pending offline items and combine
          const offline = await getOfflineTransactions(uid);
          const merged = [...offline, ...data];
          merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(merged);
          setPendingSyncCount(offline.length);
        },
        onBudgets: (data) => setBudgets(data),
        onWallets: (data) => setWallets(data),
        onGoals: (data) => setGoals(data),
        onNotifications: (data) => setAppNotifications(data),
        onReminders: (data) => setReminders(data),
        onProfile: (data) => {
          setProfile(data);
          const detectedCurrency = detectUserCurrency(data);
          setGlobalCurrency(detectedCurrency);
          
          if (detectedCurrency === 'EUR') setCurrencySymbol('€');
          else if (detectedCurrency === 'GBP') setCurrencySymbol('£');
          else if (detectedCurrency === 'USD') setCurrencySymbol('$');
          else setCurrencySymbol('₹');

          if (data) {
            // Sync theme preferences
            setDarkMode(data.theme === 'dark');
          }
        }
      });
    };

    setupStream();

    return () => {
      active = false;
      if (unsubscribeDB) {
        unsubscribeDB();
      }
    };
  }, [uid]);

  // Prevent page scroll when App-level modals or lock screen are active
  useEffect(() => {
    if (isLogoutModalOpen || globalTxModalOpen || isLocked) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLogoutModalOpen, globalTxModalOpen, isLocked]);

  // Proactive automated notification generation in Firestore
  useEffect(() => {
    if (!uid) return;

    const generateSystemNotifications = async () => {
      const addDbNotification = addNotification;
      const currentMonthPrefix = `${filterYear}-${filterMonth}`;

      // 1. Budget Warnings Exceedance
      budgets.forEach(async (b) => {
        if (!b || !b.category) return;
        const spent = transactions
          .filter(t => t && t.type === 'expense' && t.category && t.category.toLowerCase() === b.category.toLowerCase() && t.date && t.date.startsWith(currentMonthPrefix))
          .reduce((sum, t) => sum + t.amount, 0);

        if (spent >= b.limit) {
          const messageText = `Budget Overrun Alert (100% Warning): Category ${b.category} exceeded monthly threshold limit by ${currencySymbol}${(spent - b.limit).toLocaleString()} (Spent: ${currencySymbol}${spent.toLocaleString()} / Limit: ${currencySymbol}${b.limit.toLocaleString()})`;
          const alreadyNotified = appNotifications.some(n => n.text === messageText);
          if (!alreadyNotified) {
            await addNotification({
              userId: uid,
              text: messageText,
              type: 'alert'
            });
          }
        } else if (spent >= b.limit * 0.9) {
          const messageText = `Budget Critical Alert (90% Warning): Category ${b.category} has reached 90% of your threshold limit (Spent: ${currencySymbol}${spent.toLocaleString()} / Limit: ${currencySymbol}${b.limit.toLocaleString()})`;
          const alreadyNotified = appNotifications.some(n => n.text === messageText);
          if (!alreadyNotified) {
            await addNotification({
              userId: uid,
              text: messageText,
              type: 'alert'
            });
          }
        } else if (spent >= b.limit * 0.8) {
          const messageText = `Budget Warning (80% Warning): Category ${b.category} has reached 80% of your threshold limit (Spent: ${currencySymbol}${spent.toLocaleString()} / Limit: ${currencySymbol}${b.limit.toLocaleString()})`;
          const alreadyNotified = appNotifications.some(n => n.text === messageText);
          if (!alreadyNotified) {
            await addNotification({
              userId: uid,
              text: messageText,
              type: 'alert'
            });
          }
        }
      });

      // 2. Goal completion checks & 50% milestone updates
      goals.forEach(async (g) => {
        if (g.currentAmount >= g.targetAmount && g.targetAmount > 0) {
          const messageText = `Goal Achieved Milestone: Congratulations! You have fully achieved the target for ${g.name} (${currencySymbol}${g.targetAmount.toLocaleString()} funded!)`;
          const alreadyNotified = appNotifications.some(n => n.text === messageText);
          if (!alreadyNotified) {
            await addDbNotification({
              userId: uid,
              text: messageText,
              type: 'success'
            });
          }
        } else if (g.currentAmount >= (g.targetAmount / 2) && g.targetAmount > 0) {
          const messageText = `Goal Savings Milestone reached: You have funded over 50% of your target for ${g.name} (${currencySymbol}${g.currentAmount.toLocaleString()} of ${currencySymbol}${g.targetAmount.toLocaleString()})`;
          const alreadyNotified = appNotifications.some(n => n.text === messageText);
          if (!alreadyNotified) {
            await addDbNotification({
              userId: uid,
              text: messageText,
              type: 'info'
            });
          }
        }
      });

      // 3. Monthly report availability notes
      if (transactions.length > 0) {
        const reportText = `Financial statement reports aggregated: Your ledger data analytics and custom statements are compiled for June 2026.`;
        const alreadyNotified = appNotifications.some(n => n.text === reportText);
        if (!alreadyNotified) {
          await addDbNotification({
            userId: uid,
            text: reportText,
            type: 'info'
          });
        }
      }
    };

    const timer = setTimeout(() => {
      generateSystemNotifications();
    }, 2000);

    return () => clearTimeout(timer);
  }, [transactions, budgets, goals, uid, appNotifications, filterYear, filterMonth, currencySymbol]);

  // Due Reminders background checker
  useEffect(() => {
    if (!uid || reminders.length === 0) return;

    const checkDueReminders = async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

      for (const rem of reminders) {
        if (!rem.enabled) continue;

        // Check if due date has arrived or passed and has not been triggered today
        const isDue = rem.dueDate <= todayStr;
        const alreadyTriggeredToday = rem.lastTriggered === todayStr;

        if (isDue && !alreadyTriggeredToday) {
          // Format type nicely for description
          const remTypeLabels: Record<string, string> = {
            loan_emi: 'Loan EMI',
            credit_card: 'Credit Card Bill',
            rent: 'Rent Payment',
            sip: 'SIP Investment',
            savings_goal: 'Savings Goal',
            health_insurance: 'Health Insurance',
            vehicle_insurance: 'Vehicle Insurance',
            life_insurance: 'Life Insurance',
            custom_policy: 'Custom Policy Renewal'
          };
          const typeLabel = remTypeLabels[rem.type] || 'Scheduled Payment';
          const amtStr = rem.amount > 0 ? ` of ${currencySymbol}${rem.amount.toLocaleString()}` : '';
          const messageText = `Due Alert: Your "${rem.title}" (${typeLabel})${amtStr} is scheduled for renewal/payment on ${rem.dueDate}.`;

          // 1. Create a persistent system notification in Firestore
          await addNotification({
            userId: uid,
            text: messageText,
            type: 'alert'
          });

          // 2. Trigger real push/browser desktop notification
          const { triggerPushNotification } = await import('./utils/fcm');
          await triggerPushNotification(
            `BudgetBloom: ${typeLabel} Due!`,
            `"${rem.title}"${amtStr} is due today (${rem.dueDate}).`,
            `due-${rem.id}`
          );

          // 3. Advance to the next due date based on frequency or disable if one-time
          let nextDueDate = rem.dueDate;
          let keepEnabled = rem.enabled;

          if (rem.frequency === 'one-time') {
            keepEnabled = false;
          } else {
            // Helper to advance the date
            const dateObj = new Date(rem.dueDate);
            if (!isNaN(dateObj.getTime())) {
              switch (rem.frequency) {
                case 'daily':
                  dateObj.setDate(dateObj.getDate() + 1);
                  break;
                case 'weekly':
                  dateObj.setDate(dateObj.getDate() + 7);
                  break;
                case 'monthly':
                  dateObj.setMonth(dateObj.getMonth() + 1);
                  break;
                case 'yearly':
                  dateObj.setFullYear(dateObj.getFullYear() + 1);
                  break;
                default:
                  break;
              }
              nextDueDate = dateObj.toISOString().split('T')[0];
            }
          }

          // 4. Update the reminder in Firestore
          const { updateReminder } = await import('./dbHelper');
          await updateReminder(rem.id, {
            userId: uid,
            lastTriggered: todayStr,
            dueDate: nextDueDate,
            enabled: keepEnabled
          });
        }
      }
    };

    const timer = setTimeout(() => {
      checkDueReminders();
    }, 4000); // Wait 4 seconds to avoid overlapping with system notification generator

    return () => clearTimeout(timer);
  }, [uid, reminders, currencySymbol]);

  // Synchronize Dark Mode CSS classes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen for Escape key to close the logout modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLogoutModalOpen && !isLoggingOut) {
        setIsLogoutModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLogoutModalOpen, isLoggingOut]);

  // Logout handler to open confirmation modal
  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  // Actual sign out trigger with loading state
  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      safeStorage.removeItem('budgetbloom_last_active_at');
      await signOut(auth);
      setUid(null);
      setCurrentPage(Page.LANDING);
      window.location.hash = Page.LANDING;
      setIsLogoutModalOpen(false);
    } catch (error) {
      console.error('Error during log out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleUnlockWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockPassword.trim()) {
      setLockError('Please enter your password.');
      return;
    }

    setUnlocking(true);
    setLockError(null);

    try {
      const email = auth.currentUser?.email;
      if (!email) {
        throw new Error('No logged-in user email found.');
      }

      // Re-authenticate by signing in again
      await signInWithEmailAndPassword(auth, email, lockPassword);
      
      // On success, unlock
      setIsLocked(false);
      setLockPassword('');
      setLockError(null);
      safeStorage.setItem('budgetbloom_last_active_at', Date.now().toString());
    } catch (err: any) {
      console.error('Unlock password authentication failed:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setLockError('Incorrect password. Please try again.');
      } else {
        setLockError('Authentication failed. Please verify your connection.');
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleGoogleUnlock = async () => {
    setUnlocking(true);
    setLockError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      console.log("[Google Unlock Debug] Firebase Project ID:", auth.app.options.projectId);
      console.log("[Google Unlock Debug] Authenticated User UID:", result.user.uid);
      console.log("[Google Unlock Debug] Authenticated User Email:", result.user.email);

      if (result.user.uid !== uid) {
        setLockError('This Google account does not match the active session user.');
        return;
      }

      setIsLocked(false);
      setLockError(null);
      safeStorage.setItem('budgetbloom_last_active_at', Date.now().toString());
    } catch (err: any) {
      console.error("[Google Unlock Error] Full error stack:", err.stack || err);
      
      let msg = 'Google Sign-In failed. Please try again.';
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        msg = 'Google Sign-In cancelled.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network error. Check your connection.';
      }
      setLockError(msg);
    } finally {
      setUnlocking(false);
    }
  };

  const handleLockedSignOut = async () => {
    setUnlocking(true);
    try {
      safeStorage.removeItem('budgetbloom_last_active_at');
      await signOut(auth);
      setIsLocked(false);
      setUid(null);
      setProfile(null);
      setTransactions([]);
      setBudgets([]);
      setWallets([]);
      setGoals([]);
      setAppNotifications([]);
      setCurrentPage(Page.LANDING);
      window.location.hash = Page.LANDING;
    } catch (err) {
      console.error('Sign out from locked screen failed:', err);
    } finally {
      setUnlocking(false);
    }
  };

  // Rendering Loader screen
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F172A] text-slate-100 space-y-4 font-display">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-[#00B894] flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-white text-xl font-bold font-display">BB</span>
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#38BDF8] rounded-full border-2 border-[#0F172A]"></div>
        </div>
        <p className="text-xs font-semibold tracking-widest text-[#CBD5E1] uppercase brand-pulse animate-pulse">
          Starting BudgetBloom...
        </p>
      </div>
    );
  }

  // If user is not signed in, display LoginPage
  if (!uid) {
    return (
      <LoginPage 
        onAuthSuccess={(id) => {
          safeStorage.setItem('budgetbloom_last_active_at', Date.now().toString());
          setUid(id);
          setCurrentPage(Page.DASHBOARD);
          window.location.hash = Page.DASHBOARD;
        }}
      />
    );
  }

  return (
    <div 
      className={`min-h-screen dashboard-layout transition-colors duration-250 ${
        darkMode ? 'bg-[#0B0F19] text-slate-150' : 'bg-[#EEF6F2] text-[#1F2933]'
      }`}
      style={{
        '--sidebar-width': collapsed ? '80px' : '256px'
      } as React.CSSProperties}
    >
      
      {/* Sidebar Navigation */}
      <Sidebar 
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        profile={profile}
        onLogout={handleLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onAddIncome={() => handleAddTransaction('income', false)}
        onAddExpense={() => handleAddTransaction('expense', false)}
        unreadCount={appNotifications ? appNotifications.filter(n => !n.read).length : 0}
      />

      {/* Main Content Pane */}
      <main 
        id="dashboard-container"
        className="main-content pb-24 md:pb-12"
      >
        {/* Offline & Synchronization Status Banner */}
        {(!isOnline || pendingSyncCount > 0 || syncStatusMsg) && (
          <div className="mx-auto max-w-7xl px-4 md:px-8 pt-6 pb-2">
            <div className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold shadow-xs transition-all animate-fade-in ${
              !isOnline 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400' 
                : syncing 
                ? 'bg-sky-500/10 border-sky-500/20 text-sky-850 dark:text-sky-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-[#2F6B52]'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  !isOnline ? 'bg-amber-500 animate-pulse' : syncing ? 'bg-sky-500 animate-spin' : 'bg-emerald-500 animate-pulse'
                }`} />
                <div className="space-y-0.5 text-left">
                  <p className="font-bold flex items-center gap-1.5 leading-none">
                    {!isOnline ? 'Offline Mode Active' : syncing ? 'Syncing Ledger...' : 'Network Connected'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                    {syncStatusMsg || (
                      !isOnline 
                        ? `${pendingSyncCount} pending transaction(s) stored locally on this device.` 
                        : pendingSyncCount > 0 
                        ? `You have ${pendingSyncCount} transaction(s) queued for cloud synchronization.`
                        : 'Your ledger is completely synchronized and up-to-date with the cloud.'
                    )}
                  </p>
                </div>
              </div>

              {isOnline && pendingSyncCount > 0 && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="px-4 py-1.5 rounded-xl bg-brand-green hover:bg-brand-green-hover text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 self-end sm:self-auto transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Pending Data'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {currentPage === Page.DASHBOARD && (
          <DashboardTab 
            transactions={transactions}
            budgets={budgets}
            wallets={wallets}
            goals={goals}
            profile={profile}
            currencySymbol={currencySymbol}
            onNavigate={(page) => setCurrentPage(page)}
            darkMode={darkMode}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            activeQuickFilter={activeQuickFilter}
            setActiveQuickFilter={setActiveQuickFilter}
            appNotifications={appNotifications}
          />
        )}

        {currentPage === Page.TRANSACTIONS && (
          <TransactionsTab 
            transactions={transactions}
            wallets={wallets}
            profile={profile}
            currencySymbol={currencySymbol}
            darkMode={darkMode}
            filterMonthGlobal={filterMonth}
            filterYearGlobal={filterYear}
            onAddTransaction={handleAddTransaction}
          />
        )}

        {currentPage === Page.SAVINGS && (
          <SavingsTab 
            goals={goals}
            profile={profile}
            transactions={transactions}
            currencySymbol={currencySymbol}
            darkMode={darkMode}
            filterMonth={filterMonth}
            filterYear={filterYear}
            filterDate={filterDate}
            activeQuickFilter={activeQuickFilter}
          />
        )}

        {currentPage === Page.BUDGETS && (
          <BudgetsTab 
            budgets={budgets}
            profile={profile}
            transactions={transactions}
            currencySymbol={currencySymbol}
            darkMode={darkMode}
            filterMonth={filterMonth}
            filterYear={filterYear}
          />
        )}

        {currentPage === Page.ANALYTICS && (
          <AnalyticsTab 
            transactions={transactions}
            wallets={wallets}
            budgets={budgets}
            goals={goals}
            currencySymbol={currencySymbol}
            darkMode={darkMode}
            filterMonth={filterMonth}
            filterYear={filterYear}
            filterDate={filterDate}
            activeQuickFilter={activeQuickFilter}
          />
        )}

        {currentPage === Page.REPORTS && (
          <ReportsTab 
            transactions={transactions}
            wallets={wallets}
            budgets={budgets}
            currencySymbol={currencySymbol}
            darkMode={darkMode}
            filterMonth={filterMonth}
            filterYear={filterYear}
            filterDate={filterDate}
          />
        )}

        {currentPage === Page.EXPORT && (
          <ExportTab 
            transactions={transactions}
            wallets={wallets}
            budgets={budgets}
            goals={goals}
            currencySymbol={currencySymbol}
            darkMode={darkMode}
            profile={profile}
          />
        )}

        {currentPage === Page.PROFILE && (
          <ProfileTab 
            profile={profile}
            currencySymbol={currencySymbol}
            setCurrencySymbol={setCurrencySymbol}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        )}

        {currentPage === Page.NOTIFICATIONS && (
          <NotificationsTab 
            reminders={reminders}
            appNotifications={appNotifications}
            profile={profile}
            currencySymbol={currencySymbol}
            darkMode={darkMode}
            onNavigate={setCurrentPage}
          />
        )}
      </main>

      {/* Global Add Transactions Modal */}
      <GlobalTransactionModal 
        isOpen={globalTxModalOpen}
        onClose={() => setGlobalTxModalOpen(false)}
        initialType={globalTxType}
        wallets={wallets}
        profile={profile}
        currencySymbol={currencySymbol}
        initialScannerOpen={globalScannerOpen}
      />

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div 
          id="logout-confirmation-backdrop"
          className="fixed top-0 left-0 w-full h-[100vh] bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-overlay"
          onClick={() => {
            if (!isLoggingOut) setIsLogoutModalOpen(false);
          }}
        >
          <div 
            id="logout-confirmation-content"
            className="bg-white border border-[#E2E8F0] rounded-[24px] w-full max-w-[420px] p-8 shadow-xl relative animate-modal-content text-center font-display max-h-[calc(100vh-32px)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-[#355C4B]/10 text-[#355C4B] border border-[#355C4B]/20 shadow-sm">
                <LogOut className="h-6 w-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-[#355C4B] font-display">
                  Sign Out
                </h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Are you sure you want to sign out of BudgetBloom?
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  id="cancel-logout-btn"
                  type="button"
                  disabled={isLoggingOut}
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="w-full inline-flex justify-center items-center rounded-xl border border-[#355C4B] bg-white hover:bg-[#355C4B]/5 text-[#355C4B] font-bold py-3 px-4 text-xs uppercase tracking-wider transition-all cursor-pointer h-11"
                >
                  Cancel
                </button>
                <button
                  id="confirm-logout-btn"
                  type="button"
                  disabled={isLoggingOut}
                  onClick={confirmLogout}
                  className="w-full inline-flex justify-center items-center rounded-xl bg-[#EF4444] hover:bg-[#DC2626] disabled:bg-red-400 text-white font-bold py-3 px-4 text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-[0.98] h-11"
                >
                  {isLoggingOut ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing out...
                    </>
                  ) : (
                    'Logout'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 24-HOUR AUTO-LOCK OVERLAY SCREEN */}
      {isLocked && (
        <div 
          id="autolock-overlay-container"
          className="fixed inset-0 bg-[#0F172A]/85 backdrop-blur-md flex items-center justify-center z-[10000] p-4 select-none"
        >
          <div 
            id="autolock-card-content"
            className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-slate-800 rounded-[28px] w-full max-w-[440px] p-8 shadow-2xl relative text-center font-display max-h-[calc(100vh-32px)] overflow-y-auto animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Glowing Fingerprint Circle */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-500/10 animate-pulse">
                <Fingerprint className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Title & Desc */}
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800 dark:text-white font-display tracking-tight flex items-center justify-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Workspace Locked
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
                  For your security and privacy, please authenticate to resume access to your financial dashboard.
                </p>
              </div>

              {/* Provider-specific Authenticator form */}
              {auth.currentUser?.providerData.some(p => p.providerId === 'google.com') ? (
                /* Google User Authenticator */
                <div className="space-y-4 pt-2">
                  <button
                    id="google-unlock-btn"
                    type="button"
                    disabled={unlocking}
                    onClick={handleGoogleUnlock}
                    className="w-full bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl py-3.5 transition-all shadow-sm hover:shadow-md flex items-center justify-center text-center font-display cursor-pointer active:scale-[0.99] disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{unlocking ? 'Verifying with Google...' : 'Unlock with Google'}</span>
                  </button>
                </div>
              ) : (
                /* Password User Authenticator */
                <form onSubmit={handleUnlockWorkspace} className="space-y-4 text-left pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                      Enter Password
                    </label>
                    <div className="relative">
                      <input
                        id="lock-password-input"
                        type={showLockPassword ? 'text' : 'password'}
                        disabled={unlocking}
                        value={lockPassword}
                        onChange={(e) => setLockPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-800 dark:text-slate-100 rounded-xl py-3.5 pl-4 pr-11 text-sm font-semibold tracking-wide shadow-inner focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLockPassword(!showLockPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {showLockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    id="submit-unlock-btn"
                    type="submit"
                    disabled={unlocking}
                    className="w-full inline-flex justify-center items-center rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white font-bold py-3.5 text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-[0.98] h-11"
                  >
                    {unlocking ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Unlocking...
                      </>
                    ) : (
                      'Unlock Workspace'
                    )}
                  </button>
                </form>
              )}

              {/* Error messages */}
              {lockError && (
                <div className="flex items-center gap-2 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/30 text-left text-xs font-semibold animate-shake">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{lockError}</span>
                </div>
              )}

              {/* Quick switch account option */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-5 text-center flex flex-col items-center">
                <button
                  id="locked-signout-btn"
                  type="button"
                  disabled={unlocking}
                  onClick={handleLockedSignOut}
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#E11D48] hover:text-[#BE123C] dark:text-[#FB7185] dark:hover:text-[#F43F5E] uppercase tracking-wider cursor-pointer bg-transparent border-none transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch Account / Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
