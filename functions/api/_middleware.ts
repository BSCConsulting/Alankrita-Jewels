// Every /api/* response is JSON — an uncaught exception would otherwise surface as Cloudflare's HTML error page.
import type { Env } from '../_lib/env'
import { error } from '../_lib/http'

export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  try {
    return await next()
  } catch (err) {
    console.error(`${request.method} ${new URL(request.url).pathname} failed`, err)
    return error('Something went wrong on our side. Please try again.', 500)
  }
}
