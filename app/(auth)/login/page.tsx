'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Message = { text: string; type: 'success' | 'error' } | null

function friendlyError(msg: string): string {
  if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (msg.toLowerCase().includes('invalid email')) {
    return 'Please enter a valid email address.'
  }
  return msg
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true') {
      router.replace('/trips')
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/trips')
      } else {
        setCheckingSession(false)
      }
    })
  }, [supabase, router])

  async function handleGoogleLogin() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setMessage({ text: friendlyError(error.message), type: 'error' })
    } else {
      setMessage({ text: 'Check your email for a sign-in link!', type: 'success' })
    }
    setLoading(false)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="flex items-center gap-2">
          <Image src="/icon.svg" alt="Masa" width={40} height={40} className="h-10 w-10" unoptimized />
          <span className="text-xl font-bold">Masa</span>
        </div>
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Sign in to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <div>
                <label htmlFor="email" className="sr-only">Email address</label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send Magic Link'}
              </Button>
            </form>

            {message && (
              <p
                className={`text-sm text-center ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}
                role={message.type === 'error' ? 'alert' : 'status'}
              >
                {message.text}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
