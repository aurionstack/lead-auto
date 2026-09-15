import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname === '/oauth/consent')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  // If user is logged in and visits root or login, redirect to dashboard
  if (
    user &&
    (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/')
  ) {
    const url = request.nextUrl.clone()
    const requestedRedirect = request.nextUrl.searchParams.get('redirect')
    const safeRedirect = requestedRedirect?.startsWith('/oauth/consent?authorization_id=') ? requestedRedirect : '/dashboard'
    const destination = new URL(safeRedirect, request.url)
    url.pathname = destination.pathname
    url.search = destination.search
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
