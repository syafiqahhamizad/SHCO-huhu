import { firebaseAuth } from './firebaseAuthService';
import { getPracticeSettings } from './templateService';

/**
 * Shared Google Workspace access for the portal: Drive, Calendar, Tasks and Gmail.
 *
 * - One Google Identity Services (GIS) OAuth token client per scope set, using the firm's OAuth
 *   Web client ID (VITE_GOOGLE_OAUTH_CLIENT_ID, else Firm Settings → `googleOAuthClientId`) and
 *   the signed-in @shcolaw.com user as the login hint. The consent screen is "Internal".
 * - Incremental authorization: each call asks only for the scope it needs (e.g. Calendar asks for
 *   `calendar.events` only). `include_granted_scopes` lets Google return a token that also carries
 *   scopes the user already allowed, so one token can serve several services.
 * - Tokens live in memory only, with their expiry, and are re-requested silently (`prompt: ''`).
 * - The first request for a new scope shows Google's consent popup. Browsers only allow that popup
 *   shortly after a user action, so call these functions (or `prepareGoogleAccess`) directly from
 *   a click handler.
 * - Nothing here fakes success: every failure throws a `GoogleWorkspaceError` with a clear message.
 */

export const GOOGLE_SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive',
  calendar: 'https://www.googleapis.com/auth/calendar.events',
  tasks: 'https://www.googleapis.com/auth/tasks',
  gmail: 'https://www.googleapis.com/auth/gmail.send',
} as const;

export type GoogleService = keyof typeof GOOGLE_SCOPES;

export const GOOGLE_SERVICE_LABEL: Record<GoogleService, string> = {
  drive: 'Google Drive', calendar: 'Google Calendar', tasks: 'Google Tasks', gmail: 'Gmail',
};
const API_NAME: Record<GoogleService, string> = {
  drive: 'Google Drive API', calendar: 'Google Calendar API', tasks: 'Google Tasks API', gmail: 'Gmail API',
};
const CLOUD_PROJECT = 'gen-lang-client-0565207218';

export type GoogleErrorCode =
  | 'not_configured' | 'not_signed_in' | 'access_denied' | 'popup_blocked' | 'popup_closed' | 'partial_grant'
  | 'api_disabled' | 'unauthorized' | 'forbidden' | 'not_found' | 'rate_limited' | 'unavailable'
  | 'bad_request' | 'network' | 'unknown';

export class GoogleWorkspaceError extends Error {
  code: GoogleErrorCode;
  service: GoogleService;
  status: number;
  reason: string;
  constructor(message: string, code: GoogleErrorCode, service: GoogleService, status = 0, reason = '') {
    super(message);
    this.name = 'GoogleWorkspaceError';
    this.code = code;
    this.service = service;
    this.status = status;
    this.reason = reason;
  }
}

/* ------------------------------------------------------------------ config */

/** OAuth Web client IDs look like `123-abc.apps.googleusercontent.com`. */
export const looksLikeClientId = (s: string) => /^[\w-]+\.apps\.googleusercontent\.com$/.test(String(s || '').trim());

export const getGoogleClientId = (): { clientId: string; source: 'env' | 'settings' | 'none' } => {
  const env = String((import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined) || '').trim();
  const saved = String(getPracticeSettings().googleOAuthClientId || '').trim();
  return { clientId: env || saved, source: env ? 'env' : saved ? 'settings' : 'none' };
};

export const signedInGoogleEmail = () => String(firebaseAuth.currentUser?.email || '').toLowerCase();

/* ------------------------------------------------------------------ GIS loader */

interface TokenResponse { access_token?: string; expires_in?: number | string; scope?: string; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string; hint?: string }) => void }
interface GoogleOAuth2 {
  initTokenClient: (cfg: {
    client_id: string; scope: string; hint?: string; prompt?: string; include_granted_scopes?: boolean;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string; message?: string }) => void;
  }) => TokenClient;
  hasGrantedAllScopes?: (r: TokenResponse, firstScope: string, ...rest: string[]) => boolean;
}
type GoogleGlobal = { accounts?: { oauth2?: GoogleOAuth2 } };
const gsi = () => (window as unknown as { google?: GoogleGlobal }).google?.accounts?.oauth2;

let gsiLoading: Promise<void> | null = null;
/** Loads https://accounts.google.com/gsi/client once. Safe to call early (e.g. on mount) to make the later click faster. */
export const loadGoogleIdentity = (): Promise<void> => {
  if (gsi()) return Promise.resolve();
  if (gsiLoading) return gsiLoading;
  gsiLoading = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = 'https://accounts.google.com/gsi/client';
    el.async = true;
    el.defer = true;
    el.onload = () => (gsi() ? resolve() : reject(new Error('Google sign-in library loaded but is not available.')));
    el.onerror = () => { gsiLoading = null; reject(new Error('Could not load Google sign-in (accounts.google.com). Check the internet connection, or whether a browser extension is blocking it.')); };
    document.head.appendChild(el);
  });
  return gsiLoading;
};

/* ------------------------------------------------------------------ messages */

const SETTINGS_PATH = 'Firm & Practice Settings → Firm & Letterhead';

const notConfiguredMessage = (service: GoogleService) => service === 'drive'
  ? 'Google Drive is not set up: no OAuth client ID. Ask the Managing Partner to add it in Firm & Practice Settings → Firm & Letterhead → Google Drive storage.'
  : GOOGLE_SERVICE_LABEL[service] + ' is not set up: no OAuth client ID. Ask the Managing Partner to add it in ' + SETTINGS_PATH + ' → Google Drive storage (Calendar, Tasks and Gmail use the same client ID).';

const authMessage = (service: GoogleService, code: GoogleErrorCode, detail = ''): string => {
  const L = GOOGLE_SERVICE_LABEL[service];
  if (service === 'drive') {
    // Drive's wording is kept exactly as it was before this module existed.
    if (code === 'access_denied') return 'Google Drive access was not allowed. Click again and choose “Allow” so the portal can save files to the firm’s Shared Drive.';
    if (code === 'partial_grant') return 'Google Drive access was only partly allowed. Click again and tick the Google Drive permission.';
    if (code === 'popup_blocked') return 'The browser blocked the Google sign-in popup. Allow popups for this site, then try again.';
    if (code === 'popup_closed') return 'The Google sign-in window was closed before Drive access was given. Try again and choose “Allow”.';
    if (code === 'unauthorized') return 'Google did not give Drive access (' + (detail || 'no token') + ').';
    return 'Google sign-in for Drive failed' + (detail ? ': ' + detail : '.') + ' If this keeps happening, check that this site’s address is in the OAuth client’s Authorized JavaScript origins.';
  }
  if (code === 'access_denied') return L + ' access denied: you chose not to allow it. Click again and choose “Allow” in Google’s window.';
  if (code === 'partial_grant') return L + ' access was only partly allowed. Click again and tick the ' + L + ' permission.';
  if (code === 'popup_blocked') return 'Popup blocked: the browser stopped Google’s sign-in window for ' + L + '. Allow popups for this site, then click again.';
  if (code === 'popup_closed') return 'The Google sign-in window was closed before ' + L + ' access was given. Click again and choose “Allow”.';
  if (code === 'unauthorized') return 'Google did not give ' + L + ' access (' + (detail || 'no token') + ').';
  return 'Google sign-in for ' + L + ' failed' + (detail ? ': ' + detail : '.') + ' If this keeps happening, check that this site’s address is in the OAuth client’s Authorized JavaScript origins.';
};

/* ------------------------------------------------------------------ tokens */

interface CachedToken { value: string; expiresAt: number; clientId: string; email: string; scopes: Set<string> }
let tokens: CachedToken[] = [];
const pending = new Map<string, Promise<string>>();
interface ClientEntry { clientId: string; email: string; client: TokenClient; waiter?: { resolve: (t: string) => void; reject: (e: Error) => void } }
const clients = new Map<string, ClientEntry>();

/** Fired on window with `detail.scopes` (string[]) whenever a fresh Google token arrives. */
export const GOOGLE_TOKEN_EVENT = 'shco-google-token';

const scopeKey = (scopes: string[]) => [...new Set(scopes)].sort().join(' ');

const validToken = (scopes: string[]): CachedToken | undefined => {
  const { clientId } = getGoogleClientId();
  const email = signedInGoogleEmail();
  const now = Date.now();
  tokens = tokens.filter((t) => t.expiresAt - 60_000 > now && t.clientId === clientId && t.email === email);
  return tokens.find((t) => scopes.every((s) => t.scopes.has(s)));
};

/** True when a token covering `service` is cached for the current client ID and user and not about to expire. */
export const hasValidGoogleToken = (service: GoogleService) => !!validToken([GOOGLE_SCOPES[service]]);

/** Forget cached tokens (all, or those carrying `service`'s scope), e.g. after a 401 or on sign-out. */
export const clearGoogleTokens = (service?: GoogleService) => {
  tokens = service ? tokens.filter((t) => !t.scopes.has(GOOGLE_SCOPES[service])) : [];
};

/**
 * Returns a valid access token for `service`, requesting one through GIS when none is cached or it
 * expires within a minute. Call it from a click handler where possible (popup blockers).
 */
export async function getGoogleAccessToken(service: GoogleService): Promise<string> {
  const scope = GOOGLE_SCOPES[service];
  const { clientId } = getGoogleClientId();
  if (!clientId) throw new GoogleWorkspaceError(notConfiguredMessage(service), 'not_configured', service);
  if (service !== 'drive' && !looksLikeClientId(clientId)) {
    throw new GoogleWorkspaceError('The OAuth client ID in Firm Settings should end with “.apps.googleusercontent.com”. Ask the Managing Partner to fix it.', 'not_configured', service);
  }
  const hit = validToken([scope]);
  if (hit) return hit.value;
  const key = scopeKey([scope]);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const email = signedInGoogleEmail();
  const p = (async () => {
    try {
      await loadGoogleIdentity();
    } catch (e) {
      throw new GoogleWorkspaceError(e instanceof Error ? e.message : String(e), 'network', service);
    }
    const oauth2 = gsi();
    if (!oauth2) throw new GoogleWorkspaceError('Google sign-in is not available in this browser.', 'unknown', service);
    let entry = clients.get(key);
    if (!entry || entry.clientId !== clientId || entry.email !== email) {
      const e: ClientEntry = { clientId, email, client: null as unknown as TokenClient };
      e.client = oauth2.initTokenClient({
        client_id: clientId,
        scope,
        hint: email || undefined,
        prompt: '',
        include_granted_scopes: true,
        callback: (r) => {
          const w = e.waiter; e.waiter = undefined;
          if (!w) return;
          if (r.error || !r.access_token) {
            w.reject(new GoogleWorkspaceError(
              authMessage(service, r.error === 'access_denied' ? 'access_denied' : 'unauthorized', r.error_description || r.error || ''),
              r.error === 'access_denied' ? 'access_denied' : 'unauthorized', service, 0, r.error || ''));
            return;
          }
          if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(r, scope)) {
            w.reject(new GoogleWorkspaceError(authMessage(service, 'partial_grant'), 'partial_grant', service));
            return;
          }
          const granted = new Set(String(r.scope || scope).split(/\s+/).filter(Boolean));
          granted.add(scope);
          tokens.push({ value: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) || 3600) * 1000, clientId, email, scopes: granted });
          w.resolve(r.access_token);
          window.dispatchEvent(new CustomEvent(GOOGLE_TOKEN_EVENT, { detail: { scopes: [...granted] } }));
        },
        error_callback: (err) => {
          const w = e.waiter; e.waiter = undefined;
          if (!w) return;
          const t = String(err?.type || '');
          const code: GoogleErrorCode = t === 'popup_failed_to_open' ? 'popup_blocked' : t === 'popup_closed' ? 'popup_closed' : 'unknown';
          w.reject(new GoogleWorkspaceError(authMessage(service, code, err?.message || ''), code, service, 0, t));
        },
      });
      entry = e;
      clients.set(key, entry);
    }
    const ent = entry;
    return new Promise<string>((resolve, reject) => {
      ent.waiter = { resolve, reject };
      ent.client.requestAccessToken({ prompt: '', hint: email || undefined });
    });
  })();
  pending.set(key, p);
  try {
    return await p;
  } finally {
    pending.delete(key);
  }
}

/**
 * Get tokens for several services inside one click (before any other await), so later calls in
 * the same flow do not need a popup. Requests run one after the other; the first failure throws.
 */
export async function prepareGoogleAccess(services: GoogleService[]): Promise<void> {
  for (const s of services) await getGoogleAccessToken(s);
}

/* ------------------------------------------------------------------ REST */

export interface GoogleFetchHints {
  /** Shown for 403 permission errors (e.g. "share the court diary with you"). */
  forbidden?: string;
  /** Shown for 404 (e.g. "the court diary calendar was not found"). */
  notFound?: string;
}

/** Turns a Google API error response into something the staff member (or owner) can act on. */
export const describeGoogleApiError = (service: GoogleService, status: number, reason: string, message: string, hints: GoogleFetchHints = {}): { code: GoogleErrorCode; message: string } => {
  const L = GOOGLE_SERVICE_LABEL[service];
  const r = reason.toLowerCase(), m = message.toLowerCase();
  if (r === 'accessnotconfigured' || r === 'service_disabled' || m.includes('has not been used') || m.includes('is disabled')) {
    return { code: 'api_disabled', message: API_NAME[service] + ' isn’t enabled for this project. Ask the Managing Partner to enable it: Google Cloud Console (project ' + CLOUD_PROJECT + ') → APIs & Services → Enable APIs → ' + API_NAME[service] + '.' };
  }
  if (status === 401) return { code: 'unauthorized', message: 'Your ' + L + ' sign-in has expired. Try again.' };
  if (r === 'ratelimitexceeded' || r === 'userratelimitexceeded' || r === 'quotaexceeded' || status === 429) return { code: 'rate_limited', message: L + ' is busy. Wait a moment and try again.' };
  if (r === 'insufficientpermissions' || r === 'access_token_scope_insufficient' || m.includes('insufficient authentication scopes')) {
    return { code: 'access_denied', message: L + ' access denied: the portal was not given ' + L + ' permission. Click again and choose “Allow”.' };
  }
  if (status === 403) return { code: 'forbidden', message: hints.forbidden || 'Your Google account does not have permission for this in ' + L + (message ? ' (' + message + ')' : '') + '.' };
  if (status === 404 || status === 410) return { code: 'not_found', message: hints.notFound || L + ' could not find that item (it may have been deleted).' };
  if (status >= 500) return { code: 'unavailable', message: L + ' is temporarily unavailable (' + status + '). Try again in a minute.' };
  if (status === 400) return { code: 'bad_request', message: L + ' rejected the request' + (message ? ': ' + message : '.') };
  return { code: 'unknown', message: L + ' error ' + (status || '') + (message ? ': ' + message : '') };
};

/**
 * fetch() with a Bearer token for `service`. Retries once with a fresh token on 401. Throws a
 * `GoogleWorkspaceError` for any non-2xx response or network failure.
 */
export async function googleApiFetch(service: GoogleService, url: string, init: RequestInit = {}, hints: GoogleFetchHints = {}, retried = false): Promise<Response> {
  const t = await getGoogleAccessToken(service);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + t } });
  } catch {
    throw new GoogleWorkspaceError('Could not reach ' + GOOGLE_SERVICE_LABEL[service] + '. Check the internet connection and try again.', 'network', service);
  }
  if (res.status === 401 && !retried) { clearGoogleTokens(service); return googleApiFetch(service, url, init, hints, true); }
  if (!res.ok) {
    let reason = '', message = '';
    try {
      const j = await res.json() as { error?: { message?: string; errors?: { reason?: string }[]; status?: string; details?: { reason?: string }[] } };
      reason = j.error?.details?.find((d) => d.reason)?.reason || j.error?.errors?.[0]?.reason || j.error?.status || '';
      message = j.error?.message || '';
    } catch { /* not JSON */ }
    const d = describeGoogleApiError(service, res.status, reason, message, hints);
    if (d.code === 'access_denied') clearGoogleTokens(service);
    throw new GoogleWorkspaceError(d.message, d.code, service, res.status, reason);
  }
  return res;
}

export const googleErrorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
