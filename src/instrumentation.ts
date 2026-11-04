export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'CRON_SECRET',
    'GOOGLE_TOKEN_ENCRYPTION_KEY',
  ]
  const missing = required.filter(name => !process.env[name])
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`)
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? '')) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must contain 64 hexadecimal characters.')
  }
}
