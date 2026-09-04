const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT environment variable.');
  console.error('Export it with the JSON content of your Firebase service account key.');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const APPROVED_ADMIN_EMAILS = [
  'syafiqahhamizad@shcolaw.com',
];
const APPROVED_SUPER_ADMIN_EMAILS = [
  'syafiqahhamizad@shcolaw.com',
];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setClaims(email, role, isAdmin = false, isSuperAdmin = false) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedRole = String(role || '').trim();
  const identityApproved = APPROVED_ADMIN_EMAILS.includes(normalizedEmail) || APPROVED_SUPER_ADMIN_EMAILS.includes(normalizedEmail);
  const adminApproved = Boolean(isAdmin) && APPROVED_ADMIN_EMAILS.includes(normalizedEmail);
  const superAdminApproved = Boolean(isSuperAdmin) && APPROVED_SUPER_ADMIN_EMAILS.includes(normalizedEmail);

  const claims = {
    role: normalizedRole.toLowerCase(),
    admin: adminApproved,
    superAdmin: superAdminApproved,
    email: normalizedEmail,
    approvedIdentity: identityApproved,
    portalAccess: normalizedRole.toLowerCase() === 'client',
  };

  const user = await admin.auth().getUserByEmail(normalizedEmail);
  await admin.auth().setCustomUserClaims(user.uid, claims);
  console.log(`Updated claims for ${normalizedEmail}:`, claims);
}

(async () => {
  const assignments = [
    ['syafiqahhamizad@shcolaw.com', 'partner', true, true],
    ['amerhaiqal@shcolaw.com', 'partner', false, false],
    ['zulaikha@shcolaw.com', 'partner', false, false],
    ['assistant@shcolaw.com', 'assistant', false, false],
    ['reviewer@shcolaw.com', 'reviewer', false, false],
    ['client@example.com', 'client', false, false],
  ];

  for (const [email, role, isAdmin, isSuperAdmin] of assignments) {
    try {
      await setClaims(email, role, isAdmin, isSuperAdmin);
    } catch (error) {
      console.warn(`Could not set claims for ${email}:`, error.message);
    }
  }

  process.exit(0);
})();
