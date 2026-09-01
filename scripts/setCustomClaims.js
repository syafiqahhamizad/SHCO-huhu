const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT environment variable.');
  console.error('Export it with the JSON content of your Firebase service account key.');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setClaims(email, role, isAdmin = false, isSuperAdmin = false) {
  const user = await admin.auth().getUserByEmail(email);
  const claims = {
    role,
    admin: Boolean(isAdmin),
    superAdmin: Boolean(isSuperAdmin),
    email,
    portalAccess: role === 'client',
  };

  await admin.auth().setCustomUserClaims(user.uid, claims);
  console.log(`Updated claims for ${email}:`, claims);
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
