'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { exportTrip } from '@/server/actions/export'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { MobilePageHeader } from '@/components/shell/MobilePageHeader'
import type { User } from '@supabase/supabase-js'

interface Trip { id: string; name: string }

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [exporting, setExporting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.auth.getUser().then(({ data }) => setUser(data.user)),
      supabase.from('trips').select('id, name').then(({ data }) => {
        if (data) setTrips(data as Trip[])
      }),
    ]).finally(() => setIsLoading(false))
  }, [supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleExport() {
    if (!selectedTripId) return
    setExporting(true)
    try {
      const json = await exportTrip(selectedTripId)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const trip = trips.find((t) => t.id === selectedTripId)
      a.download = `${trip?.name ?? 'trip'}-export.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <MobilePageHeader title="Settings" />
      <div className="p-6 max-w-lg space-y-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <h1 className="hidden md:block text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          {['light', 'dark', 'system'].map((t) => (
            <Button
              key={t}
              variant={theme === t ? 'default' : 'outline'}
              onClick={() => setTheme(t)}
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            user?.email && (
              <p className="text-sm text-muted-foreground">{user.email}</p>
            )
          )}
          <Button variant="destructive" onClick={handleSignOut}>Sign Out</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Export Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select value={selectedTripId} onValueChange={(v) => setSelectedTripId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select a trip to export" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>{trip.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={handleExport}
            disabled={isLoading || !selectedTripId || exporting}
            variant="outline"
            className="w-full"
          >
            {exporting ? 'Exporting...' : 'Export as JSON'}
          </Button>
        </CardContent>
      </Card>
    </div>
    </>
  )
}
