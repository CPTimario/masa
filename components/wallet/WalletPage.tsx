'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Wallet, ArrowLeftRight } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { ConversionModal } from './ConversionModal'
import type { Trip, Member, MemberBalance, Conversion } from '@/lib/db/schema'

interface Props {
  trip: Trip
  members: Member[]
  balances: MemberBalance[]
  conversions: Conversion[]
}

export function WalletPageContent({ trip, members, balances }: Props) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const [convertTarget, setConvertTarget] = useState<{ memberId: string; fromCurrency: string } | null>(null)

  const byCurrency = useMemo(() => {
    const map = new Map<string, MemberBalance[]>()
    for (const b of balances) {
      const list = map.get(b.currency) ?? []
      list.push(b)
      map.set(b.currency, list)
    }
    // self-member first within each currency group
    for (const [currency, rows] of map) {
      map.set(currency, [...rows].sort((a, b) => {
        const aIsSelf = memberById.get(a.memberId)?.isSelf ?? false
        const bIsSelf = memberById.get(b.memberId)?.isSelf ?? false
        return (bIsSelf ? 1 : 0) - (aIsSelf ? 1 : 0)
      }))
    }
    return map
  }, [balances, memberById])

  const currencies = useMemo(() => {
    const rest = Array.from(byCurrency.keys()).filter((c) => c !== trip.currency).sort()
    return byCurrency.has(trip.currency) ? [trip.currency, ...rest] : rest
  }, [byCurrency, trip.currency])

  return (
    <>
      <div className="space-y-4 md:space-y-5">
        {currencies.length === 0 ? (
          <EmptyState
            icon={Wallet}
            heading="No wallet entries yet"
            body="Record cash on hand for each member to get started."
          />
        ) : (
          currencies.map((currency) => {
            const rows = byCurrency.get(currency)!
            const total = rows.reduce((sum, b) => sum + parseFloat(b.balance), 0)
            return (
              <Card key={currency} className="border-border">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{currency}</CardTitle>
                    <span className={`text-sm font-bold tabular-nums ${total >= 0 ? 'text-success' : 'text-destructive'}`}>
                      Total: {formatCurrency(total, currency)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-1">
                  {rows.map((b, idx) => {
                    const member = memberById.get(b.memberId)
                    const amt = parseFloat(b.balance)
                    return (
                      <div
                        key={b.memberId}
                        className={`flex items-center justify-between py-2.5 ${idx < rows.length - 1 ? 'border-b border-border' : ''}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            role="img"
                            aria-label={member?.name ?? 'Unknown'}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ring-1 ring-white dark:ring-card"
                            style={{ backgroundColor: member?.color ?? '#6366f1' }}
                          >
                            {(member?.name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{member?.name ?? 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold tabular-nums ${amt >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(amt, currency)}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label="Convert currency"
                            title="Convert currency"
                            onClick={() => setConvertTarget({ memberId: b.memberId, fromCurrency: currency })}
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <ConversionModal
        tripId={trip.id}
        members={members}
        open={convertTarget !== null}
        onOpenChange={(open) => { if (!open) setConvertTarget(null) }}
        defaultMemberId={convertTarget?.memberId}
        defaultFromCurrency={convertTarget?.fromCurrency}
      />
    </>
  )
}
