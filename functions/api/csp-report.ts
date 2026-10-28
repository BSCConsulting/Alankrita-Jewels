// POST /api/csp-report — browsers report Content-Security-Policy violations here (see public/_headers).
// Logged only (Cloudflare → Pages → Functions → Logs), so the policy can be tightened from report-only to enforced.
import type { Env } from '../_lib/env'

const MAX_BODY_BYTES = 8 * 1024

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  const body = (await request.text()).slice(0, MAX_BODY_BYTES)
  try {
    const parsed = JSON.parse(body) as { 'csp-report'?: Record<string, unknown> }
    const r = parsed['csp-report'] ?? {}
    console.warn('CSP violation', r['violated-directive'] ?? r['effective-directive'], r['blocked-uri'], r['document-uri'])
  } catch {
    console.warn('CSP report (unparsed)', body.slice(0, 500))
  }
  return new Response(null, { status: 204 })
}
