'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MapPin, Receipt, Users, Settings, LogOut, Wallet, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/trips', label: 'Trips', icon: MapPin },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function TripNavItems({ tripId }: { tripId?: string }) {
  const pathname = usePathname()
  if (!tripId) return null

  const items = [
    { href: `/trips/${tripId}`, label: 'Overview', icon: LayoutDashboard },
    { href: `/trips/${tripId}/expenses`, label: 'Expenses', icon: Receipt },
    { href: `/trips/${tripId}/people`, label: 'People', icon: Users },
    { href: `/trips/${tripId}/money`, label: 'Money', icon: Wallet },
  ]

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        Current Trip
      </p>
      {items.map((item) => {
        const Icon = item.icon
        const isActive =
          pathname === item.href ||
          (item.href !== `/trips/${tripId}` && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors font-medium',
              isActive
                ? 'bg-primary/10 text-primary border-l-2 border-primary -ml-px pl-[11px]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const tripId = pathname.match(/\/trips\/([^/]+)/)?.[1]
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-sidebar h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Image src="/icon.svg" alt="Masa" width={32} height={32} className="h-8 w-8 shrink-0" unoptimized />
          <div>
            <h1 className="font-bold text-sm leading-tight tracking-tight">Masa</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Group trip expenses</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors font-medium',
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary -ml-px pl-[11px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
        <TripNavItems tripId={tripId} />
      </nav>

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground text-sm font-medium"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}
