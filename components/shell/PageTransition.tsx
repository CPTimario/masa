'use client'

import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-in fade-in duration-[var(--duration-normal)] ease-[var(--easing-out)]">
      {children}
    </div>
  )
}
