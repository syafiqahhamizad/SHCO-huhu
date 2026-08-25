import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyBtgzS5KcwtlMygfSmo4kmEV08-y8QEINc',
  authDomain: 'gen-lang-client-0565207218.firebaseapp.com',
  projectId: 'gen-lang-client-0565207218',
  storageBucket: 'gen-lang-client-0565207218.firebasestorage.app',
  messagingSenderId: '560462370115',
  appId: '1:560462370115:web:602e0f3e9110f6a8eb4bf6',
};

const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: 'shcolaw.com',
  prompt: 'select_account',
});

export async function signInStaffWithGoogle(): Promise<User> {
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  const email = result.user.email?.toLowerCase() || '';
  if (!email.endsWith('@shcolaw.com')) {
    await signOut(firebaseAuth);
    throw new Error('Staff access is restricted to verified @shcolaw.com Google Workspace accounts.');
  }
  return result.user;
}

export async function signInClientWithPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return result.user;
}

export async function signInExternalWithPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return result.user;
}

export async function signOutFromFirebase(): Promise<void> {
  await signOut(firebaseAuth);
}

export function getFirebaseAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the Google sign-in window. Please allow pop-ups and try again.';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
  if (code === 'auth/unauthorized-domain') {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'the current app domain';
    return `Firebase has not authorised this domain: ${hostname}. Add exactly "${hostname}" under Firebase Authentication > Settings > Authorized domains.`;
  }
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'The email or password is incorrect.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Authentication could not be completed. Please try again.';
}
