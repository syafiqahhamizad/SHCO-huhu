import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import { type FirebaseApp } from 'firebase/app';

export function isTrustedAppHost(): boolean {
  if (typeof window === 'undefined') return true;

  const hostname = window.location.hostname.toLowerCase();
  const trustedHosts = [
    'localhost',
    '127.0.0.1',
    'portal.shcolaw.com',
    'shcolaw.com',
    'www.shcolaw.com',
  ];

  return trustedHosts.includes(hostname)
    || hostname.endsWith('.firebaseapp.com')
    || hostname.endsWith('.web.app');
}

export function initializeFirebaseAppCheck(app: FirebaseApp): AppCheck | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!isTrustedAppHost()) {
    console.warn('Blocked Firebase App Check startup: this hostname is not in the trusted allowlist.');
    return undefined;
  }

  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) {
    return undefined;
  }

  try {
    const cached = (app as FirebaseApp & { _appCheck?: AppCheck })._appCheck;
    if (cached) return cached;

    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });

    (app as FirebaseApp & { _appCheck?: AppCheck })._appCheck = appCheck;
    return appCheck;
  } catch (error) {
    console.warn('Firebase App Check could not be initialized; continuing with app-level protections only.', error);
    return undefined;
  }
}
