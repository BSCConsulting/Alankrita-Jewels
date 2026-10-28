import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** When false the app runs entirely on the local mock database (src/services/mockDb.ts). */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export const STORAGE_BUCKET = 'product-media'

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** SQL error codes raised on purpose by our own functions (e.g. place_order); their messages are written for shoppers. */
const CUSTOMER_FACING_CODES = new Set(['P0001', 'P0002', '22023', '28000'])

/** Error code meaning the customer's login is missing or expired. */
export const isAuthError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; status?: unknown }
  return e.code === '28000' || e.code === 'PGRST301' || e.code === 'PGRST303' || e.status === 401
}

/** Like toErrorMessage, but never shows internal database or network wording to shoppers. */
export function toCustomerMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isAuthError(error)) return 'Your mobile verification has expired. Please verify your number again.'
  if (error instanceof TypeError) return 'Network problem. Please check your internet connection and try again.'
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const code = 'code' in error ? error.code : undefined
    // Errors without a code come from our own API responses or app code, which are already worded for shoppers.
    if (code === undefined || (typeof code === 'string' && CUSTOMER_FACING_CODES.has(code))) return error.message
  }
  return fallback
}

/** Turns PostgREST / RPC errors into a readable message (admin screens). */
export function toErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}
