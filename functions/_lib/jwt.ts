// Minimal JWT helpers on WebCrypto: verify Firebase ID tokens (RS256) and mint/verify Supabase tokens (HS256).

const encoder = new TextEncoder()

const b64urlToBytes = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
const bytesToB64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jsonToB64url = (value: unknown) => bytesToB64url(encoder.encode(JSON.stringify(value)))

interface DecodedJwt {
  header: { alg?: string; kid?: string }
  payload: Record<string, unknown>
  signingInput: Uint8Array
  signature: Uint8Array
}

function decode(token: string): DecodedJwt | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    return {
      header: JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0]))),
      payload: JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))),
      signingInput: encoder.encode(`${parts[0]}.${parts[1]}`),
      signature: b64urlToBytes(parts[2]),
    }
  } catch {
    return null
  }
}

const nowSeconds = () => Math.floor(Date.now() / 1000)
const CLOCK_SKEW = 60

// ---------------------------------------------------------------------------
// Firebase ID tokens — https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
// ---------------------------------------------------------------------------

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const JWKS_MIN_REFETCH_MS = 60_000
let googleKeys: { keys: Map<string, CryptoKey>; expiresAt: number; fetchedAt: number } | null = null

async function googleKey(kid: string): Promise<CryptoKey | undefined> {
  const unknownKid = googleKeys && !googleKeys.keys.has(kid)
  // Forged tokens with random kids must not trigger a Google fetch on every request.
  const canRefetch = !googleKeys || Date.now() - googleKeys.fetchedAt > JWKS_MIN_REFETCH_MS
  if (!googleKeys || googleKeys.expiresAt < Date.now() || (unknownKid && canRefetch)) {
    const res = await fetch(GOOGLE_JWKS_URL)
    if (!res.ok) throw new Error(`Could not fetch Google signing keys (${res.status})`)
    const { keys } = (await res.json()) as { keys: Array<{ kid: string; n: string; e: string }> }
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600)
    const imported = new Map<string, CryptoKey>()
    for (const k of keys) {
      imported.set(
        k.kid,
        await crypto.subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
          'verify',
        ]),
      )
    }
    googleKeys = { keys: imported, expiresAt: Date.now() + maxAge * 1000, fetchedAt: Date.now() }
  }
  return googleKeys.keys.get(kid)
}

export interface FirebaseIdentity {
  uid: string
  phoneNumber: string
}

/** Returns the verified identity, or null if the token is invalid, expired or not a phone sign-in for this project. */
export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<FirebaseIdentity | null> {
  const jwt = decode(token)
  if (!jwt || jwt.header.alg !== 'RS256' || !jwt.header.kid) return null

  const key = await googleKey(jwt.header.kid)
  if (!key || !(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, jwt.signature, jwt.signingInput))) return null

  const p = jwt.payload
  const now = nowSeconds()
  const valid =
    p.aud === projectId &&
    p.iss === `https://securetoken.google.com/${projectId}` &&
    typeof p.sub === 'string' &&
    p.sub.length > 0 &&
    p.sub.length <= 128 &&
    typeof p.exp === 'number' &&
    p.exp > now - CLOCK_SKEW &&
    typeof p.iat === 'number' &&
    p.iat <= now + CLOCK_SKEW &&
    typeof p.auth_time === 'number' &&
    p.auth_time <= now + CLOCK_SKEW &&
    typeof p.phone_number === 'string' &&
    /^\+\d{8,15}$/.test(p.phone_number)

  return valid ? { uid: p.sub as string, phoneNumber: p.phone_number as string } : null
}

// ---------------------------------------------------------------------------
// Supabase access tokens signed with the project's legacy JWT secret (HS256)
// ---------------------------------------------------------------------------

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

export async function signHs256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const signingInput = `${jsonToB64url({ alg: 'HS256', typ: 'JWT' })}.${jsonToB64url(payload)}`
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(signingInput)))
  return `${signingInput}.${bytesToB64url(signature)}`
}

/** Returns the payload of a valid, unexpired HS256 token signed with `secret`, otherwise null. */
export async function verifyHs256(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const jwt = decode(token)
  if (!jwt || jwt.header.alg !== 'HS256') return null
  if (!(await crypto.subtle.verify('HMAC', await hmacKey(secret), jwt.signature, jwt.signingInput))) return null
  const exp = jwt.payload.exp
  return typeof exp === 'number' && exp > nowSeconds() ? jwt.payload : null
}
