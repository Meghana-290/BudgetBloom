const isStorageAvailable = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

const memoryStorage: { [key: string]: string } = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (isStorageAvailable()) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // Quiet warning to avoid console spam, fallback safely
    }
    return memoryStorage[key] !== undefined ? memoryStorage[key] : null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (isStorageAvailable()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      // Quiet warning to avoid console spam, fallback safely
    }
    memoryStorage[key] = value;
  },
  removeItem: (key: string): void => {
    try {
      if (isStorageAvailable()) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      // Quiet warning to avoid console spam, fallback safely
    }
    delete memoryStorage[key];
  }
};
