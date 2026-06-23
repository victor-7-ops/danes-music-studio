import { createClient } from '@/lib/supabase/server'

export default async function SupabaseTestPage() {
  const supabase = await createClient()
  const { error } = await supabase.from('_realtime').select('*').limit(1)
  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Supabase Connection Test</h1>
      <p>{error ? `Error: ${error.message}` : 'Supabase connected'}</p>
    </main>
  )
}
