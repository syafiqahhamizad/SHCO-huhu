import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { initializeFirebaseAppCheck } from './firebaseAppCheckService';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
initializeFirebaseAppCheck(firebaseApp);

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('Firebase client config is missing. Add VITE_FIREBASE_* values to your .env file to enable Firebase auth.');
}

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

export async function getCurrentFirebaseAccessClaims(firebaseUser: User): Promise<{
  role: 'Partner' | 'Lawyer' | 'Assistant' | 'Reviewer' | 'Client';
  isAdmin: boolean;
  isSuperAdmin: boolean;
  email: string;
}> {
  const tokenResult = await firebaseUser.getIdTokenResult();
  const claims = (tokenResult.claims ?? {}) as Record<string, unknown>;
  const roleClaim = String(claims.role ?? '').toLowerCase();

  const mappedRole = (() => {
    if (roleClaim === 'partner') return 'Partner';
    if (roleClaim === 'lawyer') return 'Lawyer';
    if (roleClaim === 'assistant') return 'Assistant';
    if (roleClaim === 'reviewer') return 'Reviewer';
    if (roleClaim === 'client') return 'Client';
    return null;
  })();

  if (!mappedRole) {
    throw new Error('This Firebase account has no valid SHCO role. Ask the Super Admin to provision the account.');
  }

  return {
    role: mappedRole,
    isAdmin: Boolean(claims.admin) || Boolean(claims.superAdmin),
    isSuperAdmin: Boolean(claims.superAdmin),
    email: (firebaseUser.email || '').toLowerCase(),
  };
}

export async function signInClientWithPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return result.user;
}

export async function provisionFirebaseUser(input: {
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}): Promise<{ id: string; email: string; temporaryPassword: string }> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error('Please sign in as Super Admin before creating a user.');

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = await response.json() as { id?: string; email?: string; temporaryPassword?: string; error?: string };
  if (!response.ok || !result.id || !result.email || !result.temporaryPassword) {
    throw new Error(result.error || 'Unable to create the Firebase user account.');
  }
  return {
    id: result.id,
    email: result.email,
    temporaryPassword: result.temporaryPassword,
  };
}

export async function signInExternalWithPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return result.user;
}

export async function getCurrentFirebaseClaims(): Promise<Record<string, unknown>> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) return {};

  try {
    const tokenResult = await currentUser.getIdTokenResult();
    return (tokenResult.claims ?? {}) as Record<string, unknown>;
  } catch (error) {
    console.warn('Unable to read Firebase custom claims for the current user.', error);
    return {};
  }
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
