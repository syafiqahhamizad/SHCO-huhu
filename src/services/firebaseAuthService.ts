import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  sendEmailVerification,
  type Auth,
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

export const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
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

const SHCO_SUPER_ADMIN_EMAIL = 'syafiqahhamizad@shcolaw.com';

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

/**
 * Same claim resolution as resolveAccessClaims, but never throws when the
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

interface ProvisionedAccount {
  id: string;
  email: string;
  /** Empty when no password was set (Google Workspace staff, or an account that already existed). */
  temporaryPassword: string;
  /** 'google': @shcolaw.com staff sign in with Google — nothing is created in advance. */
  method: 'google' | 'password';
  /** A Firebase sign-in for this email already existed; only the access list was updated. */
  alreadyExisted: boolean;
  /** A verification email was sent; the person must click it before their first sign-in. */
  verificationEmailSent: boolean;
}

const PROVISIONING_APP_NAME = 'provisioning';

const generateTemporaryPassword = (): string => {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*?-'];
  const all = sets.join('');
  const rand = (n: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  };
  const chars = sets.map((set) => set[rand(set.length)]);
  while (chars.length < 14) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const localUserId = () => 'U-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);

export const isGoogleWorkspaceEmail = (email: string) => email.trim().toLowerCase().endsWith('@shcolaw.com');

/**
 * Creates a sign-in for a new person WITHOUT Cloud Functions.
 *
 * - @shcolaw.com staff sign in with Google Workspace; their Firebase account is created by
 *   their own first Google sign-in, so nothing is created here — adding them to the roster
 *   (and so to the access list) is all that's needed.
 * - Everyone else (clients, external Reviewer/Assistant/Accountant) gets an email/password
 *   account created from this browser through a SECONDARY Firebase app instance, so the
 *   Super Admin's own session is untouched. A verification email is sent: the rules only
 *   let password accounts in once their email is verified.
 *
 * What they may open is decided by the owner-published access list (practiceSystem/access).
 */
export async function provisionFirebaseUser(input: {
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}): Promise<ProvisionedAccount> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error('Please sign in as Super Admin before creating a user.');
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');

  if (isGoogleWorkspaceEmail(email)) {
    return { id: localUserId(), email, temporaryPassword: '', method: 'google', alreadyExisted: false, verificationEmailSent: false };
  }

  const secondaryApp = getApps().find((a) => a.name === PROVISIONING_APP_NAME) || initializeApp(firebaseConfig, PROVISIONING_APP_NAME);
  initializeFirebaseAppCheck(secondaryApp);
  let secondaryAuth: Auth;
  try {
    secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });
  } catch {
    secondaryAuth = getAuth(secondaryApp);
  }

  const temporaryPassword = generateTemporaryPassword();
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, temporaryPassword);
    let verificationEmailSent = false;
    try {
      await sendEmailVerification(credential.user);
      verificationEmailSent = true;
    } catch (error) {
      console.warn('Account created but the verification email could not be sent.', error);
    }
    return { id: credential.user.uid, email, temporaryPassword, method: 'password', alreadyExisted: false, verificationEmailSent };
  } catch (error) {
    const code = String((error as { code?: string })?.code || '');
    if (code === 'auth/email-already-in-use') {
      // The sign-in already exists (e.g. created earlier) — just add/update the list entry.
      return { id: localUserId(), email, temporaryPassword: '', method: 'password', alreadyExisted: true, verificationEmailSent: false };
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error('Email/password sign-in is not enabled for this Firebase project. Turn on Authentication → Sign-in method → Email/Password in the Firebase console, then try again.');
    }
    if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') {
      throw new Error('Firebase rejected the generated password under the project password policy. Please try again.');
    }
    throw new Error(getFirebaseAuthErrorMessage(error));
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }
}

/** Plain-English pop-up text for a newly created sign-in. */
export function describeProvisionedAccount(p: ProvisionedAccount, opts: { signInWhere?: string } = {}): string {
  const where = opts.signInWhere || 'portal.shcolaw.com';
  if (p.method === 'google') {
    return `${p.email} has been added.\n\nNo password is needed: they sign in at ${where} with “Sign in with Google” using their @shcolaw.com Google Workspace account. Their access starts as soon as the access list shows “published”.`;
  }
  if (p.alreadyExisted) {
    return `${p.email} already has a sign-in, so no new password was created.\n\nTheir access has been added to the access list. If they have forgotten the password, use “Forgot password” on the sign-in page.`;
  }
  return `Sign-in created.\n\nEmail: ${p.email}\nTemporary password: ${p.temporaryPassword}\n\n${p.verificationEmailSent
    ? 'A verification email has been sent to them. They MUST click the link in that email before their first sign-in — until then the portal will refuse them.'
    : 'The verification email could NOT be sent. They will be asked to verify when they first try to sign in.'}\n\nGive the temporary password to them privately (e.g. WhatsApp) and ask them to change it after signing in at ${where}.`;
}

/**
 * Makes sure a password account has a verified email (required by the access rules).
 * Returns true when verified. When not, re-sends the verification email (best effort).
 */
export async function ensureEmailVerified(user: User): Promise<boolean> {
  if (user.emailVerified) return true;
  await user.reload().catch(() => undefined);
  const fresh = firebaseAuth.currentUser;
  if (fresh?.emailVerified) {
    await fresh.getIdToken(true).catch(() => undefined);
    return true;
  }
  await sendEmailVerification(user).catch(() => undefined);
  return false;
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
