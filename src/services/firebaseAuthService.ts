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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBtgzS5KcwtlMygfSmo4kmEV08-y8QEINc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0565207218.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0565207218',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0565207218.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '560462370115',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:560462370115:web:602e0f3e9110f6a8eb4bf6',
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

export const SHCO_SUPER_ADMIN_EMAIL = 'syafiqahhamizad@shcolaw.com';

export async function signInStaffWithGoogle(): Promise<User> {
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  const email = result.user.email?.toLowerCase() || '';
  if (!email.endsWith('@shcolaw.com')) {
    await signOut(firebaseAuth);
    throw new Error('Staff access is restricted to verified @shcolaw.com Google Workspace accounts.');
  }
  return result.user;
}

type MappedSHCORole = 'Partner' | 'Lawyer' | 'Assistant' | 'Accountant' | 'Reviewer' | 'Client';

async function resolveAccessClaims(firebaseUser: User): Promise<{
  mappedRole: MappedSHCORole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  email: string;
}> {
  const tokenResult = await firebaseUser.getIdTokenResult();
  const claims = (tokenResult.claims ?? {}) as Record<string, unknown>;
  const roleClaim = String(claims.role ?? '').toLowerCase();
  const isVerifiedOwner = firebaseUser.email?.toLowerCase() === SHCO_SUPER_ADMIN_EMAIL && firebaseUser.emailVerified;

  const mappedRole: MappedSHCORole | null = (() => {
    if (roleClaim === 'partner') return 'Partner';
    if (roleClaim === 'lawyer') return 'Lawyer';
    if (roleClaim === 'assistant') return 'Assistant';
    if (roleClaim === 'accountant') return 'Accountant';
    if (roleClaim === 'reviewer') return 'Reviewer';
    if (roleClaim === 'client') return 'Client';
    return isVerifiedOwner ? 'Partner' : null;
  })();

  return {
    mappedRole,
    isAdmin: isVerifiedOwner || Boolean(claims.admin) || Boolean(claims.superAdmin),
    isSuperAdmin: isVerifiedOwner || Boolean(claims.superAdmin),
    email: (firebaseUser.email || '').toLowerCase(),
  };
}

export async function getCurrentFirebaseAccessClaims(firebaseUser: User): Promise<{
  role: MappedSHCORole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  email: string;
}> {
  const { mappedRole, ...rest } = await resolveAccessClaims(firebaseUser);

  if (!mappedRole) {
    throw new Error('This Firebase account has no valid SHCO role. Ask the Super Admin to provision the account.');
  }

  return { role: mappedRole, ...rest };
}

/**
 * Same claim resolution as getCurrentFirebaseAccessClaims, but never throws when the
 * Firebase account has no custom-claim role yet. Used for Staff Google Workspace SSO:
 * a real @shcolaw.com staff member's Firebase Auth record is only created at the moment
 * of their FIRST Google sign-in (signInWithPopup creates it) — meaning custom claims can
 * never have been set for them yet either, since claim provisioning requires the account
 * to already exist. Hard-rejecting that first sign-in would lock out every legitimate
 * staff member who hasn't already been manually claims-synced by the Super Admin. The
 * caller decides how to handle a null role (e.g. fall back to the app's own roster entry
 * for this verified domain account, or provision a limited-access one).
 */
export async function getGoogleWorkspaceAccessClaims(firebaseUser: User): Promise<{
  role: MappedSHCORole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  email: string;
  hasProvisionedRole: boolean;
}> {
  const { mappedRole, ...rest } = await resolveAccessClaims(firebaseUser);
  return { role: mappedRole, hasProvisionedRole: mappedRole !== null, ...rest };
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

/**
 * Re-applies a Firebase account's custom claims (role/admin/superAdmin) so an
 * already-provisioned user's real access matches what the app's Users & Permissions
 * screen shows for them. Needed because setCustomUserClaims only takes effect at the
 * moment it's called — changing a user's role/admin toggle in the app's local state
 * does nothing to their actual Firebase permissions without this.
 */
export async function syncFirebaseUserClaims(input: {
  email: string;
  role: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}): Promise<void> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error('Please sign in as Super Admin before updating user access.');

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/admin/sync-claims', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error || 'Unable to update the Firebase user account.');
  }
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
  if (code === 'auth/network-request-failed') return 'Network error while contacting Google. Check your connection and try again.';
  if (code === 'auth/internal-error') return 'Google sign-in was interrupted before it could finish. Please try again — if this keeps happening, tell IT the code is auth/internal-error.';
  if (error instanceof Error && error.message) return error.message;
  return `Authentication could not be completed. Please try again.${code ? ` (${code})` : ''}`;
}
