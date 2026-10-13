// Firebase phone OTP. Only ever loaded via dynamic import (see customerSession.ts).
import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth'
import { firebaseConfig } from './firebaseConfig'

let auth: Auth | null = null
let verifier: RecaptchaVerifier | null = null
let confirmation: ConfirmationResult | null = null

function firebaseAuth(): Auth {
  if (!auth) {
    auth = initializeAuth(initializeApp(firebaseConfig), { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
    auth.languageCode = 'en'
  }
  return auth
}

const FRIENDLY_ERRORS: Record<string, string> = {
  'auth/invalid-phone-number': 'Enter a valid 10-digit Indian mobile number.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/quota-exceeded': 'OTP service is busy right now. Please try again shortly or WhatsApp us.',
  'auth/invalid-verification-code': 'Incorrect OTP. Please try again.',
  'auth/code-expired': 'This OTP has expired. Please request a new one.',
  'auth/captcha-check-failed': 'Security check failed. Please refresh the page and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'Phone login is not enabled yet. Please WhatsApp us to order.',
  'auth/billing-not-enabled': 'Phone login is not enabled yet. Please WhatsApp us to order.',
  'auth/unauthorized-domain': 'Phone login is not enabled for this website address yet.',
}

function friendly(error: unknown, fallback: string): Error {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code && !FRIENDLY_ERRORS[code]) console.error('Firebase auth error', code, error)
  return new Error(FRIENDLY_ERRORS[code] ?? fallback)
}

/** `recaptchaContainerId` must stay mounted between sends so resends can re-render the invisible reCAPTCHA. */
export async function sendPhoneOtp(phoneE164: string, recaptchaContainerId: string): Promise<void> {
  const a = firebaseAuth()
  verifier?.clear()
  verifier = new RecaptchaVerifier(a, recaptchaContainerId, { size: 'invisible' })
  try {
    confirmation = await signInWithPhoneNumber(a, phoneE164, verifier)
  } catch (e) {
    verifier.clear()
    verifier = null
    throw friendly(e, 'Could not send OTP. Please try again.')
  }
}

/** Confirms the code and returns a Firebase ID token for the server exchange. */
export async function confirmPhoneOtp(code: string): Promise<string> {
  if (!confirmation) throw new Error('Please request an OTP first.')
  try {
    const credential = await confirmation.confirm(code)
    confirmation = null
    return await credential.user.getIdToken()
  } catch (e) {
    throw friendly(e, 'Incorrect OTP. Please try again.')
  }
}

/** ID token of the persisted Firebase login (refreshed by the SDK when expired), or null if signed out. */
export async function currentIdToken(): Promise<string | null> {
  const a = firebaseAuth()
  await a.authStateReady()
  return a.currentUser ? a.currentUser.getIdToken() : null
}

export async function signOutPhone(): Promise<void> {
  await signOut(firebaseAuth())
}
