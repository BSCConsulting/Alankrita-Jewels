// POST /api/auth/firebase  { idToken }
// Exchanges a Firebase phone-OTP ID token for a short-lived Supabase access token. Firebase only proves
// ownership of the number; the customer is a regular Supabase auth user, so RLS, auth.uid() and the
// place_order RPC work unchanged.
import type { Env } from '../../_lib/env'
import { error, json, readJson } from '../../_lib/http'
import { signHs256, verifyFirebaseIdToken } from '../../_lib/jwt'
import { hasSupabase } from '../../_lib/supabase'

const TOKEN_TTL_SECONDS = 60 * 60

/** Looks the number up in auth.users (verified, not customer-editable) via the user_id_by_phone RPC. */
async function findUserIdByPhone(env: Env, digits: string): Promise<string | null> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/user_id_by_phone`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_phone: digits }),
  })
  if (res.ok) return ((await res.json()) as string | null) ?? null
  throw new Error(`user_id_by_phone failed: ${res.status} ${await res.text()}`)
}

async function createPhoneUser(env: Env, digits: string, firebaseUid: string): Promise<string | null> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      phone: digits,
      phone_confirm: true,
      app_metadata: { provider: 'firebase', providers: ['firebase'] },
      user_metadata: { firebase_uid: firebaseUid },
    }),
  })
  if (res.ok) return ((await res.json()) as { id: string }).id
  // A concurrent exchange for the same number may have just created the user.
  const existing = await findUserIdByPhone(env, digits)
  if (existing) return existing
  console.error('Supabase user creation failed', res.status, await res.text())
  return null
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const projectId = env.FIREBASE_PROJECT_ID
  const jwtSecret = env.SUPABASE_JWT_SECRET
  if (!projectId || !jwtSecret || !hasSupabase(env)) {
    const missing = [
      !projectId && 'FIREBASE_PROJECT_ID',
      !jwtSecret && 'SUPABASE_JWT_SECRET',
      !hasSupabase(env) && 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean)
    console.error(`Phone login is not configured (missing: ${missing.join(', ')})`)
    return error('Phone login is temporarily unavailable. Please try again later.', 503)
  }

  const { idToken } = await readJson<{ idToken: string }>(request)
  if (!idToken) return error('idToken is required', 400)

  const identity = await verifyFirebaseIdToken(idToken, projectId)
  if (!identity) return error('Your verification has expired. Please request a new OTP.', 401)

  const digits = identity.phoneNumber.replace(/^\+/, '')
  const userId = (await findUserIdByPhone(env, digits)) ?? (await createPhoneUser(env, digits, identity.uid))
  if (!userId) return error('Could not create your account. Please try again.', 502)

  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + TOKEN_TTL_SECONDS
  const accessToken = await signHs256(
    {
      iss: `${env.SUPABASE_URL}/auth/v1`,
      aud: 'authenticated',
      role: 'authenticated',
      sub: userId,
      phone: digits,
      iat,
      exp,
      app_metadata: { provider: 'firebase', providers: ['firebase'] },
      user_metadata: {},
      amr: [{ method: 'otp', timestamp: iat }],
      is_anonymous: false,
    },
    jwtSecret,
  )

  return json({ accessToken, expiresAt: exp, userId, phone: `+${digits}` }, 200, { 'cache-control': 'no-store' })
}
