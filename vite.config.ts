/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Google Search Console "HTML tag" verification; the tag is only emitted when the token is set. */
function searchConsoleVerification(token: string | undefined): Plugin {
  return {
    name: 'search-console-verification',
    transformIndexHtml: () =>
      token ? [{ tag: 'meta', attrs: { name: 'google-site-verification', content: token }, injectTo: 'head' }] : [],
  }
}

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  // Without these the storefront silently falls back to the in-browser demo database (test OTP, demo admin
  // passcode). That must never reach the live site, so a production build on Cloudflare Pages fails instead.
  const productionDeploy = command === 'build' && env.CF_PAGES === '1' && env.CF_PAGES_BRANCH === 'main'
  if (productionDeploy && !(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for the production build (see wrangler.toml).')
  }
  return {
    plugins: [react(), tailwindcss(), searchConsoleVerification(env.VITE_GOOGLE_SITE_VERIFICATION?.trim())],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      include: ['tests/**/*.test.ts'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
