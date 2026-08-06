import { Transaction } from '../types';

const DB_NAME = 'BudgetBloomOfflineDB';
const DB_VERSION = 1;

// Fallbacks for private browsing where IndexedDB may not be allowed or fail
let memoryCacheTxs: Transaction[] = [];
let memoryOfflineTxs: Transaction[] = [];

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cached_transactions')) {
          db.createObjectStore('cached_transactions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('offline_transactions')) {
          db.createObjectStore('offline_transactions', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (e) {
      reject(e);
    }
  });
}

// Cached Transactions Store API (stores online-fetched items for rapid offline startup)
export async function getCachedTransactions(userId: string): Promise<Transaction[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('cached_transactions', 'readonly');
      const store = transaction.objectStore(transaction.objectStoreNames[0] || 'cached_transactions');
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result as Transaction[];
        // Filter by current user
        const userTxs = all.filter(t => t.userId === userId);
        resolve(userTxs);
      };

      request.onerror = () => {
        resolve(memoryCacheTxs.filter(t => t.userId === userId));
      };
    });
  } catch (e) {
    return memoryCacheTxs.filter(t => t.userId === userId);
  }
}

export async function saveCachedTransactions(userId: string, txs: Transaction[]): Promise<void> {
  try {
    // Keep memory cache in sync anyway
    memoryCacheTxs = memoryCacheTxs.filter(t => t.userId !== userId).concat(txs);

    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('cached_transactions', 'readwrite');
      const store = transaction.objectStore('cached_transactions');

      // Clear old cached transactions for this user
      const requestAll = store.getAll();
      requestAll.onsuccess = () => {
        const all = requestAll.result as Transaction[];
        all.forEach(item => {
          if (item.userId === userId) {
            store.delete(item.id);
          }
        });

        // Add new ones
        txs.forEach(tx => {
          store.put(tx);
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch (e) {
    // Fail silently, memory fallback handles it
  }
}

// Offline Pending Transactions Store API (stores items added while disconnected)
export async function getOfflineTransactions(userId: string): Promise<Transaction[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('offline_transactions', 'readonly');
      const store = transaction.objectStore('offline_transactions');
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result as Transaction[];
        const userTxs = all.filter(t => t.userId === userId);
        resolve(userTxs);
      };

      request.onerror = () => {
        resolve(memoryOfflineTxs.filter(t => t.userId === userId));
      };
    });
  } catch (e) {
    return memoryOfflineTxs.filter(t => t.userId === userId);
  }
}

export async function addOfflineTransaction(
  userId: string, 
  tx: Omit<Transaction, 'id' | 'createdAt'>
): Promise<Transaction> {
  const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const nowStr = new Date().toISOString();
  
  const offlineTx: Transaction = {
    ...tx,
    id: offlineId,
    userId,
    createdAt: nowStr,
    isOfflinePending: true
  };

  try {
    memoryOfflineTxs.push(offlineTx);

    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('offline_transactions', 'readwrite');
      const store = transaction.objectStore('offline_transactions');
      const request = store.put(offlineTx);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("IndexedDB write failed. Using memory fallback.", e);
  }

  // Trigger custom window event to notify components that local transaction list changed
  window.dispatchEvent(new Event('budgetbloom-tx-change'));
  
  return offlineTx;
}

export async function deleteOfflineTransaction(id: string): Promise<void> {
  try {
    memoryOfflineTxs = memoryOfflineTxs.filter(t => t.id !== id);

    const db = await getDB();
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('offline_transactions', 'readwrite');
      const store = transaction.objectStore('offline_transactions');
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch (e) {
    // Fail silently
  }

  window.dispatchEvent(new Event('budgetbloom-tx-change'));
}
