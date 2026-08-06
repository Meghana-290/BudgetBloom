import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable Firestore offline persistence securely for web clients only when outside iframes
if (typeof window !== 'undefined') {
  const isIframe = (() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // Secure default if accessing top is blocked
    }
  })();

  const isIndexedDBAvailable = (() => {
    try {
      return !!window.indexedDB;
    } catch (e) {
      return false;
    }
  })();

  if (!isIframe && isIndexedDBAvailable) {
    enableMultiTabIndexedDbPersistence(db)
      .then(() => {
        console.log('Firestore multi-tab offline persistence enabled successfully.');
      })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore multi-tab offline persistence failed-precondition, enabling single-tab fallback.');
          enableIndexedDbPersistence(db).catch((singleErr) => {
            console.warn('Firestore single-tab fallback also failed-precondition:', singleErr.message);
          });
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore offline persistence is unimplemented/not supported by this browser:', err.message);
        } else {
          console.error('Error enabling Firestore multi-tab offline persistence, falling back:', err);
          enableIndexedDbPersistence(db).catch((singleErr) => {
            console.error('Firestore single-tab fallback failed:', singleErr);
          });
        }
      });
  } else {
    console.log('Skipping Firestore offline persistence (running inside sandboxed iframe or IndexedDB is restricted).');
  }
}

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Standard handleFirestoreError required by skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


