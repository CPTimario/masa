'use client'

import { useMemo, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ArrowRight, ArrowLeftRight, History, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/format'
import { deleteConversion } from '@/server/actions/conversions'
import { deleteSettlement } from '@/server/actions/settlements'
import { deleteTransfer } from '@/server/actions/transfers'
import type { Member, Expense, ExpenseSplit, Settlement, SettlementItem, Transfer, Conversion } from '@/lib/db/schema'

interface Props {
  members: Member[]
  settlements: Settlement[]
  settlementItems: SettlementItem[]
  expenseSplits: ExpenseSplit[]
  expenses: Expense[]
  transfers: Transfer[]
  conversions: Conversion[]
  currency: string
}

type Item =
  | { kind: 'settlement'; date: string; data: Settlement }
  | { kind: 'transfer'; date: string; data: Transfer }
  | { kind: 'conversion'; date: string; data: Conversion }

export function MoneyHistory({
  members,
  settlements,
  settlementItems,
  expenseSplits,
  expenses,
  transfers,
  conversions,
}: Props) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'settlement' | 'transfer' | 'conversion'; id: string; tripId: string } | null>(null)
  const [isDeleting, startDeleting] = useTransition()

  function confirmDelete() {
    if (!pendingDelete) return
    const { kind, id, tripId } = pendingDelete
    startDeleting(async () => {
      if (kind === 'settlement') await deleteSettlement(id, tripId)
      else if (kind === 'transfer') await deleteTransfer(id, tripId)
      else await deleteConversion(id, tripId)
      setPendingDelete(null)
    })
  }

  function getMemberName(id: string) {
    return memberById.get(id)?.name ?? 'Unknown'
  }

  function coveredExpensesFor(settlementId: string): Expense[] {
    return settlementItems
      .filter((si) => si.settlementId === settlementId)
      .map((si) => {
        const split = expenseSplits.find((s) => s.id === si.expenseSplitId)
        if (!split) return null
        return expenses.find((e) => e.id === split.expenseId) ?? null
      })
      .filter(Boolean) as Expense[]
  }

  const items = useMemo<Item[]>(() => {
    const combined: Item[] = [
      ...settlements.map((s) => ({ kind: 'settlement' as const, date: s.date, data: s })),
      ...transfers.map((t) => ({ kind: 'transfer' as const, date: t.date, data: t })),
      ...conversions.map((c) => ({ kind: 'conversion' as const, date: c.date, data: c })),
    ]
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [settlements, transfers, conversions])

  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        heading="No activity yet"
        body="Settlements, transfers, and conversions will show up here."
      />
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        if (item.kind === 'settlement') {
          const s = item.data
          const covered = coveredExpensesFor(s.id)
          return (
            <Card key={`settlement-${s.id}`} className="border-border">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-sm truncate">{getMemberName(s.fromMemberId)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm truncate">{getMemberName(s.toMemberId)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{format(new Date(s.date), 'MMM d')}</span>
                    <Badge variant="secondary" className="font-semibold tabular-nums">
                      {formatCurrency(parseFloat(String(s.amount)), s.currency)}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Delete settlement"
                      onClick={() => setPendingDelete({ kind: 'settlement', id: s.id, tripId: s.tripId })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {covered.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {covered.map((e) => (
                      <Badge key={e.id} variant="outline" className="text-xs font-normal">{e.description}</Badge>
                    ))}
                  </div>
                )}
                {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
              </CardContent>
            </Card>
          )
        }

        if (item.kind === 'transfer') {
          const t = item.data
          return (
            <Card key={`transfer-${t.id}`} className="border-border">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center bg-muted shrink-0">
                      <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-sm truncate">{getMemberName(t.fromMemberId)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-sm truncate">{getMemberName(t.toMemberId)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{format(new Date(t.date), 'MMM d')}</span>
                    <Badge variant="secondary" className="font-semibold tabular-nums">
                      {formatCurrency(parseFloat(String(t.amount)), t.currency)}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Delete transfer"
                      onClick={() => setPendingDelete({ kind: 'transfer', id: t.id, tripId: t.tripId })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {t.notes && <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>}
              </CardContent>
            </Card>
          )
        }

        const conv = item.data
        const member = memberById.get(conv.memberId)
        const rate = parseFloat(String(conv.exchangeRate))
        return (
          <Card key={`conversion-${conv.id}`} className="border-border">
            <CardContent className="pt-3 pb-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    role="img"
                    aria-label={member?.name ?? 'Unknown'}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: member?.color ?? '#6366f1' }}
                  >
                    {(member?.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {formatCurrency(parseFloat(String(conv.fromAmount)), conv.fromCurrency)}
                      {' → '}
                      {formatCurrency(parseFloat(String(conv.toAmount)), conv.toCurrency)}
                      <span className="text-muted-foreground font-normal ml-1.5 text-xs">(×{rate < 1 ? rate.toFixed(4) : rate.toFixed(2)})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(conv.date), 'MMM d')}
                      {member ? ` · ${member.name}` : ''}
                      {conv.notes ? ` · ${conv.notes}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete conversion"
                  onClick={() => setPendingDelete({ kind: 'conversion', id: conv.id, tripId: conv.tripId })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => { if (!o) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {pendingDelete?.kind ?? 'item'}?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone. Member balances will be updated.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
