const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { randomUUID } = require('crypto');

const SUPER_ADMIN_EMAIL = 'syafiqahhamizad@shcolaw.com';

function setCors(res) {
  res.set('Access-Control-Allow-Origin', 'https://portal.shcolaw.com');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

exports.provisionUser = onRequest(
  { region: 'asia-southeast1', timeoutSeconds: 30 },
  async (req, res) => {
    setCors(res);
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

      const caller = await getAuth().verifyIdToken(idToken);
      const callerEmail = String(caller.email || '').toLowerCase();
      if (callerEmail !== SUPER_ADMIN_EMAIL || caller.email_verified !== true) {
        res.status(403).json({ error: 'Only the verified Super Admin can create user accounts.' });
        return;
      }

      const { name, email, role, isAdmin = false, isSuperAdmin = false } = req.body || {};
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedRole = String(role || '').trim().toLowerCase();
      const allowedRoles = new Set(['partner', 'lawyer', 'assistant', 'reviewer', 'client']);
      if (!String(name || '').trim() || !normalizedEmail || !allowedRoles.has(normalizedRole)) {
        res.status(400).json({ error: 'Name, email, and a valid role are required.' });
        return;
      }
      if (normalizedRole !== 'client' && !normalizedEmail.endsWith('@shcolaw.com')) {
        res.status(400).json({ error: 'Firm staff accounts must use an @shcolaw.com email.' });
        return;
      }
      if (Boolean(isSuperAdmin) && normalizedEmail !== SUPER_ADMIN_EMAIL) {
        res.status(400).json({ error: 'Super Admin access is reserved for the approved identity.' });
        return;
      }

      const temporaryPassword = `${randomUUID().replace(/-/g, '').slice(0, 12)}Aa!`;
      const createdUser = await getAuth().createUser({
        displayName: String(name).trim(),
        email: normalizedEmail,
        password: temporaryPassword,
      });
      await getAuth().setCustomUserClaims(createdUser.uid, {
        role: normalizedRole,
        admin: Boolean(isAdmin) && normalizedEmail === SUPER_ADMIN_EMAIL,
        superAdmin: Boolean(isSuperAdmin) && normalizedEmail === SUPER_ADMIN_EMAIL,
        approvedIdentity: normalizedEmail === SUPER_ADMIN_EMAIL,
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
