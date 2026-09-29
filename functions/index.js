/**
 * SHCO Portal — Cloud Functions
 * Super-Admin account provisioning and role (custom-claim) sync, served from the same
 * Firebase project so portal.shcolaw.com needs no separate backend server.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { randomUUID } = require('crypto');

const SUPER_ADMIN_EMAIL = 'syafiqahhamizad@shcolaw.com';

const corsHeaders = (req, res) => {
  const origin = req.headers.origin || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
};

exports.provisionUser = onRequest(
  { region: 'asia-southeast1', timeoutSeconds: 30 },
  async (req, res) => {
    corsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }

    try {
      const authorization = req.headers.authorization || '';
      const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!idToken) {
        res.status(401).json({ error: 'Firebase authentication is required.' });
        return;
      }

      const auth = getAuth();
      const caller = await auth.verifyIdToken(idToken);
      const callerEmail = String(caller.email || '').toLowerCase();
      if (callerEmail !== SUPER_ADMIN_EMAIL || caller.email_verified !== true) {
        res.status(403).json({ error: 'Only the verified Super Admin can create user accounts.' });
        return;
      }

      const { name, email, role, isAdmin = false, isSuperAdmin = false } = req.body || {};
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedRole = String(role || '').trim().toLowerCase();
      const allowedRoles = new Set(['partner', 'lawyer', 'assistant', 'accountant', 'reviewer', 'client']);
      if (!String(name || '').trim() || !normalizedEmail || !allowedRoles.has(normalizedRole)) {
        res.status(400).json({ error: 'Name, email, and a valid role are required.' });
        return;
      }
      // Only Partner/Lawyer are the firm's own Google Workspace SSO accounts. Assistant
      // and Reviewer also cover the "External Access" login for co-counsel/referral
      // partners, who sign in with a password on their own external email — matches the
      // same rule the client-side Add User form already applies.
      const requiresFirmEmail = normalizedRole === 'partner' || normalizedRole === 'lawyer';
      if (requiresFirmEmail && !normalizedEmail.endsWith('@shcolaw.com')) {
        res.status(400).json({ error: 'Partner and Lawyer accounts must use an @shcolaw.com email.' });
        return;
      }
      if (Boolean(isSuperAdmin) && normalizedEmail !== SUPER_ADMIN_EMAIL) {
        res.status(400).json({ error: 'Super Admin access is reserved for the approved identity.' });
        return;
      }

      const temporaryPassword = `${randomUUID().replace(/-/g, '').slice(0, 12)}Aa!`;
      const createdUser = await auth.createUser({
        displayName: String(name).trim(),
        email: normalizedEmail,
        password: temporaryPassword,
      });
      // Only the verified Super Admin can reach this endpoint at all (checked above), so
      // every account it creates is by definition vetted — approvedIdentity should reflect
      // that, not be hardcoded to a single email (which previously left every other firm
      // account with a "read only, write always rejected" Firestore identity).
      await auth.setCustomUserClaims(createdUser.uid, {
        role: normalizedRole,
        admin: Boolean(isAdmin),
        superAdmin: Boolean(isSuperAdmin) && normalizedEmail === SUPER_ADMIN_EMAIL,
        approvedIdentity: true,
        portalAccess: normalizedRole === 'client',
      });

      res.status(201).json({ id: createdUser.uid, email: normalizedEmail, temporaryPassword });
    } catch (error) {
      if (error?.code === 'auth/email-already-exists') {
        res.status(409).json({ error: 'A Firebase account already exists for this email.' });
        return;
      }
      console.error('User provisioning failed:', error);
      res.status(500).json({ error: 'Unable to create the Firebase user account.' });
    }
  },
);

exports.syncUserClaims = onRequest(
  { region: 'asia-southeast1', timeoutSeconds: 30 },
  async (req, res) => {
    corsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }

    try {
      const authorization = req.headers.authorization || '';
      const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!idToken) {
        res.status(401).json({ error: 'Firebase authentication is required.' });
        return;
      }

      const auth = getAuth();
      const caller = await auth.verifyIdToken(idToken);
      const callerEmail = String(caller.email || '').toLowerCase();
      if (callerEmail !== SUPER_ADMIN_EMAIL || caller.email_verified !== true) {
        res.status(403).json({ error: 'Only the verified Super Admin can update user access.' });
        return;
      }

      const { email, role, isAdmin = false, isSuperAdmin = false } = req.body || {};
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedRole = String(role || '').trim().toLowerCase();
      const allowedRoles = new Set(['partner', 'lawyer', 'assistant', 'accountant', 'reviewer', 'client']);
      if (!normalizedEmail || !allowedRoles.has(normalizedRole)) {
        res.status(400).json({ error: 'A valid email and role are required.' });
        return;
      }
      if (Boolean(isSuperAdmin) && normalizedEmail !== SUPER_ADMIN_EMAIL) {
        res.status(400).json({ error: 'Super Admin access is reserved for the approved identity.' });
        return;
      }

      const targetUser = await auth.getUserByEmail(normalizedEmail);
      await auth.setCustomUserClaims(targetUser.uid, {
        role: normalizedRole,
        admin: Boolean(isAdmin),
        superAdmin: Boolean(isSuperAdmin) && normalizedEmail === SUPER_ADMIN_EMAIL,
        approvedIdentity: true,
        portalAccess: normalizedRole === 'client',
      });

      res.status(200).json({ id: targetUser.uid, email: normalizedEmail });
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        res.status(404).json({ error: 'No Firebase account exists for this email yet — create it first.' });
        return;
      }
      console.error('User claims sync failed:', error);
      res.status(500).json({ error: 'Unable to update the Firebase user account.' });
    }
  },
);
