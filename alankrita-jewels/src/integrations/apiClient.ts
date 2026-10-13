import { customerAccessToken } from '@/lib/customerSession'
import { getAccessToken } from '@/lib/supabase'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type ApiResult<T> = { available: true; data: T } | { available: false }

/** Which login the request acts as: the checkout customer (phone OTP) or the signed-in admin. */
export type ApiActor = 'customer' | 'admin'

/**
 * POSTs to a Cloudflare Pages Function under /api. When the Functions runtime isn't running
 * (plain `vite` dev server) the response isn't JSON, and callers fall back to their mock path.
 */
export async function callApi<T>(path: string, body: unknown, actor: ApiActor = 'customer'): Promise<ApiResult<T>> {
  const token = actor === 'admin' ? await getAccessToken() : await customerAccessToken()
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch {
    return { available: false }
  }

  if (!(res.headers.get('content-type') ?? '').includes('application/json')) return { available: false }

  const json = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status)
  return { available: true, data: json }
}
