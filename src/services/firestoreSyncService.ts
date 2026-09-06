import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { initializeFirebaseAppCheck } from './firebaseAppCheckService';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBtgzS5KcwtlMygfSmo4kmEV08-y8QEINc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0565207218.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0565207218',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0565207218.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '560462370115',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:560462370115:web:602e0f3e9110f6a8eb4bf6',
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
initializeFirebaseAppCheck(app);

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('Firebase Firestore config is missing. Add VITE_FIREBASE_* values to your .env file to enable cloud sync.');
}
const stateRef = doc(db, 'practiceSystem', 'sharedState');

export type CloudState = Record<string, unknown>;

export async function readCloudState(): Promise<CloudState | null> {
  const snapshot = await getDoc(stateRef);
  return snapshot.exists() ? (snapshot.data() as CloudState) : null;
}

export function subscribeToCloudState(onChange: (state: CloudState) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(
    stateRef,
    (snapshot) => {
      if (snapshot.exists()) onChange(snapshot.data() as CloudState);
    },
    (error) => onError(error),
  );
}

export async function writeCloudState(state: CloudState): Promise<void> {
  const sanitizedState = JSON.parse(JSON.stringify(state)) as CloudState;
  await setDoc(stateRef, sanitizedState, { merge: true });
}
