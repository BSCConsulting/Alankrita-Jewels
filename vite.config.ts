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

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
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
