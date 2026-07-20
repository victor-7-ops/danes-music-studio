import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { config } from 'dotenv'

// Load .env.local so SUPABASE_SERVICE_ROLE_KEY is available to tests
config({ path: '.env.local' })

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: [
      'src/lib/__tests__/bookings.test.ts',
      'src/lib/__tests__/equipmentReserve.integration.test.ts',
    ],
  },
})
