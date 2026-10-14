// Every /api/* response is JSON — an uncaught exception would otherwise surface as Cloudflare's HTML error page.
import { alertServerError } from '../_lib/alerts'
import type { Env } from '../_lib/env'
import { error } from '../_lib/http'

export const onRequest: PagesFunction<Env> = async ({ request, env, next, waitUntil }) => {
  try {
    return await next()
  } catch (err) {
    const path = new URL(request.url).pathname
    console.error(`${request.method} ${path} failed`, err)
    waitUntil(alertServerError(env, request.method, path, err))
    return error('Something went wrong on our side. Please try again.', 500)
  }
}
