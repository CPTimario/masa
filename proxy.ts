import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Dev auth bypass — skip Supabase auth entirely in development
  if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.DEV_USER_ID) {
    const isLoginRoute = request.nextUrl.pathname === '/login'
    if (isLoginRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/trips'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isLoginRoute = request.nextUrl.pathname === '/login'

  if (!user && !isAuthRoute && !isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/trips'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|ico)$).*)',
  ],
}
