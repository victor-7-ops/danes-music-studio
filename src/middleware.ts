import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('x-pathname', request.nextUrl.pathname)
  let supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          forwardedHeaders.set('cookie', request.cookies.toString())
          supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ALWAYS getUser(), never getSession() — does not revalidate server-side
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
  const isLoginPage = request.nextUrl.pathname === '/admin/login'

  const isAdmin = user?.app_metadata?.role === 'admin'
  if (isAdminPath && !isLoginPage && !isAdmin) {
    return NextResponse.redirect(new URL(user ? '/' : '/admin/login', request.url))
  }
  if (isLoginPage && isAdmin) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
  if (isLoginPage && user && !isAdmin) return NextResponse.redirect(new URL('/', request.url))

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*'],
}
