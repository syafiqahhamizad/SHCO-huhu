# Firebase Production Security Setup

Use these files as the final production baseline for a confidential legal portal.

## 1) App Check

In Firebase Console:
- Go to Build -> App Check
- Choose reCAPTCHA v3
- Register the web app
- Enable App Check in Enforced mode for production

Add this to your environment:

```bash
VITE_FIREBASE_APPCHECK_SITE_KEY=your_recaptcha_site_key
```

## 2) Firestore rules

Deploy the final rules from `firestore.rules` in the project root.

## 3) Storage rules

Deploy the final rules from `storage.rules` in the project root.

## 4) Custom claims

Set custom claims using the Firebase Admin SDK.

Example:

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account", ... }'
node scripts/setCustomClaims.js
```

This script assigns claims like:
- role
- admin
- superAdmin
- portalAccess

## 5) Deploy

```bash
firebase login
firebase use <your-project-id>
firebase deploy --only hosting,firestore,storage
```

## 6) Production hardening checklist

- App Check enforced
- Firestore rules deployed
- Storage rules deployed
- Authorized domains configured in Firebase Auth
- No secrets in client-side code
- No Google tokens in localStorage
- Sensitive modules restricted to admin/partner roles
- Only use Storage for document uploads
- Keep browser state limited to non-sensitive UI preferences
