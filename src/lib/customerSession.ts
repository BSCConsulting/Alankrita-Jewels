// Customer identity for checkout. With Firebase configured, Firebase proves the phone number and
// /api/auth/firebase returns a 1-hour Supabase access token for that customer; otherwise the regular
// Supabase Auth session is used. Admin login (email + password) always uses the plain `supabase` client.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isFirebaseConfigured } from './firebaseConfig'
import { getAccessToken, supabase } from './supabase'

export interface CustomerSession {
  accessToken: string
  expiresAt: number
  userId: string
  phone: string
}

/** Set while a Firebase login exists, so page loads only fetch the Firebase SDK for returning customers. */
const SESSION_FLAG = 'ak-phone-session'
const REFRESH_MARGIN_SECONDS = 60

let session: CustomerSession | null = null
let restoring: Promise<CustomerSession | null> | null = null

const loadFirebase = () => import('./firebasePhone')

async function exchange(idToken: string): Promise<CustomerSession> {
  const res = await fetch('/api/auth/firebase', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('Phone login needs the Cloudflare Functions runtime — run `npm run pages:dev`.')
  }
  const data = (await res.json()) as CustomerSession & { error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Could not verify your number. Please try again.')
  session = data
  localStorage.setItem(SESSION_FLAG, '1')
  return data
}

export async function sendFirebaseOtp(phoneE164: string, recaptchaContainerId: string): Promise<void> {
  const { sendPhoneOtp } = await loadFirebase()
  await sendPhoneOtp(phoneE164, recaptchaContainerId)
}

export async function verifyFirebaseOtp(code: string): Promise<CustomerSession> {
  const { confirmPhoneOtp } = await loadFirebase()
  return exchange(await confirmPhoneOtp(code))
}

/** Returns a valid customer session, re-exchanging the persisted Firebase login when the token is near expiry. */
export async function restoreCustomerSession(): Promise<CustomerSession | null> {
  if (!isFirebaseConfigured || !supabase) return null
  if (session && session.expiresAt - REFRESH_MARGIN_SECONDS > Date.now() / 1000) return session
  if (!localStorage.getItem(SESSION_FLAG)) return null

  restoring ??= (async () => {
    try {
      const idToken = await (await loadFirebase()).currentIdToken()
      if (!idToken) {
        session = null
        localStorage.removeItem(SESSION_FLAG)
        return null
      }
      return await exchange(idToken)
    } catch (e) {
      console.error('Could not restore phone login', e)
      return null
    } finally {
      restoring = null
    }
  })()
  return restoring
}

/** Bearer token for customer-facing API calls and RLS-protected customer queries. */
export async function customerAccessToken(): Promise<string | null> {
  if (!isFirebaseConfigured) return getAccessToken()
  return (await restoreCustomerSession())?.accessToken ?? null
}

export async function signOutCustomer(): Promise<void> {
  session = null
  localStorage.removeItem(SESSION_FLAG)
  if (isFirebaseConfigured) await (await loadFirebase()).signOutPhone()
}

/** Supabase client for customer data (placing and viewing own orders). Falls back to the anon key when signed out. */
export const customerDb: SupabaseClient | null =
  supabase && isFirebaseConfigured
    ? createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!, {
        accessToken: async () => customerAccessToken(),
      })
    : supabase
