// Public Firebase web config (Firebase console → Project settings → Your apps). Kept separate from
// firebasePhone.ts so checking the flag doesn't pull the Firebase SDK into the main bundle.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** When true, customer phone OTP goes through Firebase instead of Supabase Auth. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
