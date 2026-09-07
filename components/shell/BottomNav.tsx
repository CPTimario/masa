'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Users, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()
  const tripId = pathname.match(/\/trips\/([^/]+)/)?.[1]

  if (!tripId) return null

  const items = [
    { href: `/trips/${tripId}`, label: 'Overview', icon: LayoutDashboard },
    { href: `/trips/${tripId}/expenses`, label: 'Expenses', icon: Receipt },
    { href: `/trips/${tripId}/people`, label: 'People', icon: Users },
    { href: `/trips/${tripId}/money`, label: 'Money', icon: Wallet },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-sm z-50 shadow-[0_-1px_0_0_var(--border)]"
      aria-label="Main navigation"
    >
      <div className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (tripId != null && item.href !== `/trips/${tripId}` && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-10 h-6 rounded-full transition-colors',
                  isActive ? 'bg-primary/10' : ''
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
