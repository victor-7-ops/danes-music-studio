import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  if (pathname !== '/admin/login') {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/admin/login')
    if (user.app_metadata?.role !== 'admin') redirect('/')
  }

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#f5f4f0] text-ink font-sans antialiased">
      <AdminSidebar />
      <main className="min-h-screen pt-14 md:ml-60 md:pt-0">{children}</main>
    </div>
  )
}
