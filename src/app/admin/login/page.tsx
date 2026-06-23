'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: fd.get('email') as string,
      password: fd.get('password') as string,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/admin')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="font-display text-4xl uppercase tracking-widest text-ink">
          DANES
        </h1>
        <p className="font-sans text-sm text-muted uppercase tracking-widest mt-1">
          Admin
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block font-sans text-xs uppercase tracking-widest text-muted mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full border border-ink/20 bg-bg text-ink font-sans px-4 py-3 focus:outline-none focus:border-ink transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block font-sans text-xs uppercase tracking-widest text-muted mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full border border-ink/20 bg-bg text-ink font-sans px-4 py-3 focus:outline-none focus:border-ink transition-colors"
          />
        </div>

        {error && (
          <p className="font-sans text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ink text-bg font-sans px-6 py-3 uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
