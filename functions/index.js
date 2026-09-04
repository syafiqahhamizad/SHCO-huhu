/**
 * SHCO Portal — Cloud Functions
 * AI billing drafter (Gemini) served from the same Firebase project,
 * so portal.shcolaw.com needs no separate backend server.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { randomUUID } = require('crypto');
const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
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
      const createdUser = await auth.createUser({
        displayName: String(name).trim(),
        email: normalizedEmail,
        password: temporaryPassword,
      });
      await auth.setCustomUserClaims(createdUser.uid, {
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

exports.draftBillingItems = onRequest(
  { secrets: [GEMINI_API_KEY], region: 'asia-southeast1', timeoutSeconds: 60 },
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
      const {
        practiceArea, clientName, matterTitle, matterRef,
        courtLevel, stage, subtype, consideration, hint,
      } = req.body || {};

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const prompt = `You are the billing clerk of a Malaysian law firm (Syafiqah Hamizad & Co).
Draft professional billing line items for a ${practiceArea || 'legal'} matter.

Context:
- Client: ${clientName || 'Client'}
- Matter: ${matterTitle || 'General matter'} ${matterRef ? `(ref ${matterRef})` : ''}
${subtype ? `- Conveyancing type: ${subtype}\n` : ''}${courtLevel ? `- Court level: ${courtLevel}\n` : ''}${stage ? `- Stage: ${stage}\n` : ''}${consideration ? `- Consideration/loan amount: RM ${consideration}\n` : ''}${hint ? `- Partner instruction: ${hint}\n` : ''}
Rules:
- Produce 2 to 6 line items.
- category must be exactly one of: "Fee - Fixed", "Fee - SRO", "Disbursement", "Reimbursement".
- Professional fees go under "Fee - Fixed" or "Fee - SRO".
- Court fees, stamp duty, search fees go under "Disbursement".
- Photocopy/courier/travel go under "Reimbursement".
- amount is a number in MYR, no currency symbols. Use 0 for amounts the firm will fill in manually.
- Descriptions must sound like a real Malaysian legal bill (formal, specific).

Respond with ONLY valid JSON in this exact shape, no markdown:
{"items":[{"description":"...","category":"Fee - Fixed","amount":0}]}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = (response.text || '').trim();
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('AI returned non-JSON');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

      const validCategories = ['Fee - Fixed', 'Fee - SRO', 'Disbursement', 'Reimbursement'];
      const items = (parsed.items || [])
        .filter((i) => i && typeof i.description === 'string')
        .map((i) => ({
          description: String(i.description).slice(0, 200),
          category: validCategories.includes(i.category) ? i.category : 'Fee - Fixed',
          amount: Number(i.amount) >= 0 ? Number(i.amount) : 0,
        }))
        .slice(0, 6);

      res.json({ items });
    } catch (err) {
      console.error('AI draft error:', err);
      res.status(500).json({ error: (err && err.message) || 'AI drafting failed' });
    }
  }
);
