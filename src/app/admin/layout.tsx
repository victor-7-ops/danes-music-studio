import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defense-in-depth: middleware is primary gate; layout is secondary
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return (
    <div className="flex min-h-screen bg-bg text-ink font-sans antialiased">
      <AdminSidebar />
      <main className="flex-1 ml-0 md:ml-56">{children}</main>
    </div>
  )
}
