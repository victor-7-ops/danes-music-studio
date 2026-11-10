import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    // Integration tests hit a real Supabase project and belong only to
    // vitest.integration.config.mts (npm run test:integration) — CI sets
    // placeholder NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY for the
    // Next.js build step, which defeats these files' own skipIf(!url||!key)
    // guards and sends real network calls at a fake domain.
    exclude: ['**/bookings.test.ts', '**/*.integration.test.ts', '**/node_modules/**'],
  },
})
