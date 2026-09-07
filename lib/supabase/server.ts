import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.DEV_USER_ID) {
    const devUser = { id: process.env.DEV_USER_ID, email: 'dev@localhost' }
    return {
      auth: {
        getUser: async () => ({ data: { user: devUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createRealClient>>
  }

  return createRealClient()
}

async function createRealClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component - can't set cookies
          }
        },
      },
    }
  )
}
