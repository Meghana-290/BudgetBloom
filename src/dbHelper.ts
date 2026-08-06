import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, auth, storage } from './firebase';
import { Transaction, Budget, Wallet, Goal, UserProfile, Report, AppNotification, Reminder } from './types';
import { addOfflineTransaction, getOfflineTransactions, deleteOfflineTransaction } from './utils/offlineDB';

// Helper to resolve currently authenticated user ID or fallback
function getUserId(providedUserId?: string): string {
  const uid = auth.currentUser?.uid || providedUserId;
  if (!uid) {
    throw new Error("No authenticated user session found");
  }
  return uid;
}

// Real-time synchronization hooks using secure subcollections
export function subscribeToUserData(
  userId: string,
  callbacks: {
    onTransactions: (data: Transaction[]) => void;
    onBudgets: (data: Budget[]) => void;
    onWallets: (data: Wallet[]) => void;
    onGoals: (data: Goal[]) => void;
    onProfile: (data: UserProfile | null) => void;
    onReports?: (data: Report[]) => void;
    onNotifications?: (data: AppNotification[]) => void;
    onReminders?: (data: Reminder[]) => void;
  }
) {
  if (!userId) return () => {};

  // Subscribe Profile
  const unsubscribeProfile = onSnapshot(
    doc(db, 'users', userId),
    (docSnap) => {
      if (docSnap.exists()) {
        callbacks.onProfile(docSnap.data() as UserProfile);
      } else {
        callbacks.onProfile(null);
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, `users/${userId}`)
  );

  // Subscribe Transactions (Subcollection)
  const unsubscribeTransactions = onSnapshot(
    collection(db, 'users', userId, 'transactions'),
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Transaction);
      });
      // Sort by date descending
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callbacks.onTransactions(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/transactions`)
  );

  // Subscribe Budgets (Subcollection)
  const unsubscribeBudgets = onSnapshot(
    collection(db, 'users', userId, 'budgets'),
    (snapshot) => {
      const list: Budget[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Budget);
      });
      callbacks.onBudgets(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/budgets`)
  );

  // Subscribe Wallets (Subcollection)
  const unsubscribeWallets = onSnapshot(
    collection(db, 'users', userId, 'wallets'),
    (snapshot) => {
      const list: Wallet[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Wallet);
      });
      callbacks.onWallets(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/wallets`)
  );

  // Subscribe Goals (Subcollection)
  const unsubscribeGoals = onSnapshot(
    collection(db, 'users', userId, 'goals'),
    (snapshot) => {
      const list: Goal[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Goal);
      });
      callbacks.onGoals(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/goals`)
  );

  // Subscribe Reports (Subcollection)
  let unsubscribeReports = () => {};
  if (callbacks.onReports) {
    unsubscribeReports = onSnapshot(
      collection(db, 'users', userId, 'reports'),
      (snapshot) => {
        const list: Report[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id } as Report);
        });
        callbacks.onReports?.(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/reports`)
    );
  }

  // Subscribe Notifications (Subcollection)
  let unsubscribeNotifications = () => {};
  if (callbacks.onNotifications) {
    unsubscribeNotifications = onSnapshot(
      collection(db, 'users', userId, 'notifications'),
      (snapshot) => {
        const list: AppNotification[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id } as AppNotification);
        });
        // Sort notifications by createdAt descending
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callbacks.onNotifications?.(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/notifications`)
    );
  }

  // Subscribe Reminders (Subcollection)
  let unsubscribeReminders = () => {};
  if (callbacks.onReminders) {
    unsubscribeReminders = onSnapshot(
      collection(db, 'users', userId, 'reminders'),
      (snapshot) => {
        const list: Reminder[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id } as Reminder);
        });
        // Sort reminders by dueDate ascending (soonest first)
        list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        callbacks.onReminders?.(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/reminders`)
    );
  }

  return () => {
    unsubscribeProfile();
    unsubscribeTransactions();
    unsubscribeBudgets();
    unsubscribeWallets();
    unsubscribeGoals();
    unsubscribeReports();
    unsubscribeNotifications();
    unsubscribeReminders();
  };
}

// Write Operations
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const ref = doc(db, 'users', userId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    return null;
  }
}

export async function createOrUpdateProfile(userId: string, profile: Partial<UserProfile>) {
  const ref = doc(db, 'users', userId);
  try {
    const payload: any = {};
    if (profile.uid !== undefined) payload.uid = profile.uid;
    if (profile.email !== undefined) payload.email = profile.email;
    if (profile.displayName !== undefined) payload.displayName = profile.displayName;
    if (profile.name !== undefined) payload.name = profile.name;
    if (profile.photoURL !== undefined) payload.photoURL = profile.photoURL;
    if (profile.currency !== undefined) payload.currency = profile.currency;
    if (profile.theme !== undefined) payload.theme = profile.theme;
    if (profile.createdAt !== undefined) payload.createdAt = profile.createdAt;
    if (profile.preferences !== undefined) payload.preferences = profile.preferences;

    await setDoc(ref, payload, { merge: true });

    // Determine if it is account initialization vs profile preferences save
    const text = (profile.createdAt !== undefined)
      ? `Account Created: Welcome to BudgetBloom!`
      : `Profile Updated: Saved settings and core financial preferences`;

    await addDoc(collection(db, 'users', userId, 'notifications'), {
      userId,
      text,
      type: 'info',
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
  const userId = getUserId(transaction.userId);
  
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log("Device is offline, storing transaction locally in IndexedDB");
    await addOfflineTransaction(userId, transaction);
    return;
  }

  try {
    const nowStr = new Date().toISOString();
    await addDoc(collection(db, 'users', userId, 'transactions'), {
      ...transaction,
      userId,
      createdAt: nowStr,
      updatedAt: nowStr
    });

    const prefix = transaction.type === 'income' ? 'Income' : 'Expense';
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      userId,
      text: `${prefix} Added: '${transaction.description}' of ₹${transaction.amount.toLocaleString()} under ${transaction.category}`,
      type: transaction.type === 'income' ? 'success' : 'alert',
      read: false,
      createdAt: nowStr
    });
  } catch (error) {
    console.warn("Firestore write failed, falling back to local IndexedDB:", error);
    await addOfflineTransaction(userId, transaction);
  }
}

export async function syncOfflineTransactions(userId: string): Promise<{ successCount: number; totalCount: number }> {
  try {
    const pending = await getOfflineTransactions(userId);
    if (pending.length === 0) {
      return { successCount: 0, totalCount: 0 };
    }

    console.log(`Starting synchronization of ${pending.length} offline transactions to Firestore...`);
    let successCount = 0;

    for (const tx of pending) {
      try {
        const nowStr = new Date().toISOString();
        // Remove temporary client properties
        const { id, isOfflinePending, ...firestorePayload } = tx as any;

        // Add to firestore
        await addDoc(collection(db, 'users', userId, 'transactions'), {
          ...firestorePayload,
          createdAt: nowStr,
          updatedAt: nowStr
        });

        // Add synced notification
        const prefix = tx.type === 'income' ? 'Income' : 'Expense';
        await addDoc(collection(db, 'users', userId, 'notifications'), {
          userId,
          text: `[Synced] ${prefix} Added Offline: '${tx.description}' of ₹${tx.amount.toLocaleString()} under ${tx.category}`,
          type: tx.type === 'income' ? 'success' : 'alert',
          read: false,
          createdAt: nowStr
        });

        // Delete from offline store
        await deleteOfflineTransaction(tx.id);
        successCount++;
      } catch (err) {
        console.error("Failed to sync individual offline transaction:", tx, err);
      }
    }

    // Trigger update event
    window.dispatchEvent(new Event('budgetbloom-tx-change'));

    return { successCount, totalCount: pending.length };
  } catch (err) {
    console.error("Error in syncOfflineTransactions:", err);
    return { successCount: 0, totalCount: 0 };
  }
}

export async function updateTransaction(id: string, transaction: Partial<Transaction>) {
  const userId = getUserId(transaction.userId);
  try {
    const ref = doc(db, 'users', userId, 'transactions', id);
    await updateDoc(ref, {
      ...transaction,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/transactions/${id}`);
  }
}

export async function deleteTransaction(id: string) {
  const userId = getUserId();
  try {
    await deleteDoc(doc(db, 'users', userId, 'transactions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/transactions/${id}`);
  }
}

// Budgets CRUD
export async function setBudget(budget: Omit<Budget, 'id'>) {
  const userId = getUserId(budget.userId);
  try {
    // Check if budget for this category and month already exists
    const q = query(
      collection(db, 'users', userId, 'budgets'), 
      where('category', '==', budget.category),
      where('month', '==', budget.month)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docId = snap.docs[0].id;
      await updateDoc(doc(db, 'users', userId, 'budgets', docId), { limit: budget.limit });
    } else {
      await addDoc(collection(db, 'users', userId, 'budgets'), {
        ...budget,
        userId
      });
    }

    // Auto-generate notification for Budget Configured
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      userId,
      text: `Budget Updated: Set ceiling limit of ₹${budget.limit.toLocaleString()} for category ${budget.category}`,
      type: 'info',
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/budgets`);
  }
}

export async function deleteBudget(id: string) {
  const userId = getUserId();
  try {
    await deleteDoc(doc(db, 'users', userId, 'budgets', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/budgets/${id}`);
  }
}

// Wallets CRUD
export async function addWallet(wallet: Omit<Wallet, 'id' | 'createdAt'>) {
  const userId = getUserId(wallet.userId);
  try {
    await addDoc(collection(db, 'users', userId, 'wallets'), {
      ...wallet,
      userId,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/wallets`);
  }
}

export async function updateWallet(id: string, wallet: Partial<Wallet>) {
  const userId = getUserId(wallet.userId);
  try {
    const ref = doc(db, 'users', userId, 'wallets', id);
    await updateDoc(ref, wallet);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/wallets/${id}`);
  }
}

export async function deleteWallet(id: string) {
  const userId = getUserId();
  try {
    await deleteDoc(doc(db, 'users', userId, 'wallets', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/wallets/${id}`);
  }
}

// Goals CRUD
export async function addGoal(goal: Omit<Goal, 'id' | 'createdAt'>) {
  const userId = getUserId(goal.userId);
  try {
    await addDoc(collection(db, 'users', userId, 'goals'), {
      ...goal,
      userId,
      createdAt: new Date().toISOString()
    });

    // Auto-generate notification
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      userId,
      text: `Goal Created: '${goal.name}' defined with target amount of ₹${goal.targetAmount.toLocaleString()}`,
      type: 'info',
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/goals`);
  }
}

export async function updateGoal(id: string, goal: Partial<Goal>) {
  const userId = getUserId(goal.userId);
  try {
    const ref = doc(db, 'users', userId, 'goals', id);
    await updateDoc(ref, goal);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/goals/${id}`);
  }
}

export async function deleteGoal(id: string) {
  const userId = getUserId();
  try {
    await deleteDoc(doc(db, 'users', userId, 'goals', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/goals/${id}`);
  }
}

// Reports CRUD
export async function addReport(report: Omit<Report, 'id' | 'createdAt'>) {
  const userId = getUserId(report.userId);
  try {
    await addDoc(collection(db, 'users', userId, 'reports'), {
      ...report,
      userId,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/reports`);
  }
}

export async function deleteReport(id: string) {
  const userId = getUserId();
  try {
    await deleteDoc(doc(db, 'users', userId, 'reports', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/reports/${id}`);
  }
}

// Notifications CRUD
export async function addNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
  const userId = getUserId(notification.userId);
  try {
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      ...notification,
      userId,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/notifications`);
  }
}

export async function updateNotification(id: string, notification: Partial<AppNotification>) {
  const userId = getUserId(notification.userId);
  try {
    const ref = doc(db, 'users', userId, 'notifications', id);
    await updateDoc(ref, notification);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/notifications/${id}`);
  }
}

export async function deleteNotification(id: string) {
  const userId = getUserId();
  try {
    await deleteDoc(doc(db, 'users', userId, 'notifications', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/notifications/${id}`);
  }
}

// Reminders CRUD
export async function addReminder(reminder: Omit<Reminder, 'id' | 'createdAt'>) {
  const userId = getUserId(reminder.userId);
  try {
    const ref = await addDoc(collection(db, 'users', userId, 'reminders'), {
      ...reminder,
      userId,
      createdAt: new Date().toISOString()
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/reminders`);
    return null;
  }
}

export async function updateReminder(id: string, reminder: Partial<Reminder>) {
  const userId = getUserId(reminder.userId);
  try {
    const ref = doc(db, 'users', userId, 'reminders', id);
    await updateDoc(ref, reminder);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/reminders/${id}`);
  }
}

export async function deleteReminder(id: string) {
  const userId = getUserId();
  try {
    await deleteDoc(doc(db, 'users', userId, 'reminders', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/reminders/${id}`);
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const fileRef = ref(storage, `users/${userId}/avatar`);
  await uploadBytes(fileRef, file);
  const downloadUrl = await getDownloadURL(fileRef);

  // Update Firestore user profile
  await createOrUpdateProfile(userId, { photoURL: downloadUrl });

  // Create success notification in Firestore
  await addNotification({
    userId,
    text: "Avatar uploaded successfully",
    type: 'success'
  });

  return downloadUrl;
}

// Seed Initial Data for New Users
export async function seedDemoData(userId: string) {
  // Stubbed out - no longer seeding dummy statistics or transactions
}

// Check and migrate legacy global collections to user-scoped subcollections
export async function migrateGlobalDataIfAny(uid: string) {
  try {
    console.log(`Checking for global data to migrate for user: ${uid}`);
    
    // 1. Transactions
    const globalTxRef = collection(db, 'transactions');
    const txQuery = query(globalTxRef, where('userId', '==', uid));
    const txSnapshot = await getDocs(txQuery);
    if (!txSnapshot.empty) {
      console.log(`Found ${txSnapshot.size} global transactions. Migrating...`);
      for (const docSnap of txSnapshot.docs) {
        const data = docSnap.data();
        await setDoc(doc(db, 'users', uid, 'transactions', docSnap.id), data);
        await deleteDoc(doc(db, 'transactions', docSnap.id));
      }
    }

    // 2. Budgets
    const globalBudgetsRef = collection(db, 'budgets');
    const budgetsQuery = query(globalBudgetsRef, where('userId', '==', uid));
    const budgetsSnapshot = await getDocs(budgetsQuery);
    if (!budgetsSnapshot.empty) {
      console.log(`Found ${budgetsSnapshot.size} global budgets. Migrating...`);
      for (const docSnap of budgetsSnapshot.docs) {
        const data = docSnap.data();
        await setDoc(doc(db, 'users', uid, 'budgets', docSnap.id), data);
        await deleteDoc(doc(db, 'budgets', docSnap.id));
      }
    }

    // 3. Goals
    const globalGoalsRef = collection(db, 'goals');
    const goalsQuery = query(globalGoalsRef, where('userId', '==', uid));
    const goalsSnapshot = await getDocs(goalsQuery);
    if (!goalsSnapshot.empty) {
      console.log(`Found ${goalsSnapshot.size} global goals. Migrating...`);
      for (const docSnap of goalsSnapshot.docs) {
        const data = docSnap.data();
        await setDoc(doc(db, 'users', uid, 'goals', docSnap.id), data);
        await deleteDoc(doc(db, 'goals', docSnap.id));
      }
    }

    // 4. Notifications
    const globalNotificationsRef = collection(db, 'notifications');
    const notificationsQuery = query(globalNotificationsRef, where('userId', '==', uid));
    const notificationsSnapshot = await getDocs(notificationsQuery);
    if (!notificationsSnapshot.empty) {
      console.log(`Found ${notificationsSnapshot.size} global notifications. Migrating...`);
      for (const docSnap of notificationsSnapshot.docs) {
        const data = docSnap.data();
        await setDoc(doc(db, 'users', uid, 'notifications', docSnap.id), data);
        await deleteDoc(doc(db, 'notifications', docSnap.id));
      }
    }
    console.log("Data migration check and processing completed.");
  } catch (err) {
    console.error("Failed to run data migration check:", err);
  }
}
