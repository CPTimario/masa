'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResponsiveFormModal } from '@/components/ui/responsive-form-modal'
import { Input } from '@/components/ui/input'
import { computeBalances, simplifyDebts, getDebtBreakdown } from '@/lib/settlement'
import { formatCurrency } from '@/lib/format'
import { createSettlement } from '@/server/actions/settlements'
import { format } from 'date-fns'
import { ArrowRight, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { CATEGORIES } from '@/lib/categories'
import type { Member, Expense, ExpenseSplit, Settlement, Transfer } from '@/lib/db/schema'

interface Props {
  tripId: string
  currency: string
  initialMembers: Member[]
  initialExpenses: Expense[]
  initialSplits: ExpenseSplit[]
  initialSettlements: Settlement[]
  initialSettlementItems: { settlementId: string; expenseSplitId: string }[]
  initialTransfers: Transfer[]
}

export function SettlePageContent({
  tripId,
  currency,
  initialMembers,
  initialExpenses,
  initialSplits,
  initialSettlements,
  initialSettlementItems,
  initialTransfers,
}: Props) {
  const router = useRouter()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<{ from: string; to: string; amount: number } | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [customAmount, setCustomAmount] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const settlementExpenseMap = useMemo(() => {
    const map = new Map<string, Expense>()
    for (const item of initialSettlementItems) {
      if (!map.has(item.settlementId)) {
        const split = initialSplits.find((s) => s.id === item.expenseSplitId)
        if (split) {
          const expense = initialExpenses.find((e) => e.id === split.expenseId)
          if (expense) map.set(item.settlementId, expense)
        }
      }
    }
    return map
  }, [initialSettlementItems, initialSplits, initialExpenses])

  const balances = initialMembers.length
    ? computeBalances(initialMembers, initialExpenses, initialSplits, initialSettlements, settlementExpenseMap, initialTransfers)
    : {}
  const debts = simplifyDebts(balances)

  const paidSplitIds = useMemo(() =>
    new Map(initialSettlementItems.map((si) => [si.expenseSplitId, si.settlementId])),
    [initialSettlementItems]
  )

  const breakdown = useMemo(() => {
    if (!selectedDebt) return []
    return getDebtBreakdown(selectedDebt.from, selectedDebt.to, initialExpenses, initialSplits, paidSplitIds)
  }, [selectedDebt, initialExpenses, initialSplits, paidSplitIds])

  const unpaidBreakdown = useMemo(() => breakdown.filter((i) => !i.paidBySettlementId), [breakdown])

  const selectedTotal = useMemo(() =>
    unpaidBreakdown
      .filter((item) => selectedItems.has(item.splitId))
      .reduce((sum, item) => sum + item.shareAmount, 0),
    [unpaidBreakdown, selectedItems]
  )

  const defaultAmount = unpaidBreakdown.length > 0 && selectedItems.size === unpaidBreakdown.length
    ? (selectedDebt?.amount ?? selectedTotal)
    : selectedTotal

  const payAmount = useCustom ? parseFloat(customAmount || '0') : defaultAmount

  function getMemberName(id: string) {
    return initialMembers.find((m) => m.id === id)?.name ?? 'Unknown'
  }

  function getMemberColor(id: string) {
    return initialMembers.find((m) => m.id === id)?.color ?? '#6366f1'
  }

  function openPayment(debt: { from: string; to: string; amount: number }) {
    setSelectedDebt(debt)
    setPayDate(format(new Date(), 'yyyy-MM-dd'))
    setUseCustom(false)
    setCustomAmount('')
    const items = getDebtBreakdown(debt.from, debt.to, initialExpenses, initialSplits, paidSplitIds)
    setSelectedItems(new Set(items.filter((i) => !i.paidBySettlementId).map((i) => i.splitId)))
    setPaymentOpen(true)
  }

  function toggleItem(splitId: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(splitId)) next.delete(splitId); else next.add(splitId)
      return next
    })
    setUseCustom(false)
  }

  function toggleAll() {
    if (selectedItems.size === unpaidBreakdown.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(unpaidBreakdown.map((i) => i.splitId)))
    }
    setUseCustom(false)
  }

  async function handlePayment() {
    if (!selectedDebt || payAmount <= 0) return
    setIsSubmitting(true)
    try {
      await createSettlement(tripId, {
        fromMemberId: selectedDebt.from,
        toMemberId: selectedDebt.to,
        amount: payAmount,
        currency,
        date: payDate,
        coveredSplitIds: Array.from(selectedItems),
      })
      setPaymentOpen(false)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  const allChecked = unpaidBreakdown.length > 0 && selectedItems.size === unpaidBreakdown.length

  return (
    <>
      <div className="space-y-6">
        <div>
          <SectionHeader title="Balances" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            {initialMembers.map((member) => {
              const balance = Math.round((balances[member.id] ?? 0) * 100) / 100
              return (
                <Card key={member.id} className="border-border">
                  <CardContent className="pt-3 pb-3 px-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        aria-hidden
                        className="h-6 w-6 rounded-full shrink-0 ring-1 ring-white dark:ring-card"
                        style={{ backgroundColor: member.color }}
                      />
                      <span className="font-medium text-sm truncate">{member.name}</span>
                    </div>
                    <span className={`text-base font-bold tabular-nums flex items-center gap-1 ${balance > 0 ? 'text-success' : balance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {balance > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : balance < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      {balance >= 0 ? '+' : ''}{formatCurrency(balance, currency)}
                    </span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div>
          <SectionHeader title="Who Owes What" />
          {debts.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={CheckCircle2} heading="All settled up!" body="No outstanding balances." />
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              {debts.map((debt, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        role="img"
                        aria-label={getMemberName(debt.from)}
                        className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: getMemberColor(debt.from) }}
                      >
                        {getMemberName(debt.from).charAt(0)}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm truncate">{getMemberName(debt.from)}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm truncate">{getMemberName(debt.to)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-sm tabular-nums text-destructive">
                        {formatCurrency(debt.amount, currency)}
                      </span>
                      <Button size="sm" onClick={() => openPayment(debt)} className="h-7 text-xs px-3">
                        Settle
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <ResponsiveFormModal open={paymentOpen} onOpenChange={setPaymentOpen} title="Record Settlement">
          {selectedDebt && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{getMemberName(selectedDebt.from)}</span>
                {' pays '}
                <span className="font-semibold text-foreground">{getMemberName(selectedDebt.to)}</span>
              </p>

              {breakdown.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    className="flex items-center gap-3 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted transition-colors w-full text-left"
                    onClick={toggleAll}
                  >
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                    <span className="text-xs font-semibold text-muted-foreground">All expenses</span>
                  </button>
                  <div className="divide-y divide-border max-h-56 overflow-y-auto">
                    {breakdown.map((item) => {
                      const cat = CATEGORIES[item.category as keyof typeof CATEGORIES]
                      const isPaid = !!item.paidBySettlementId
                      const checked = selectedItems.has(item.splitId)
                      return (
                        <button
                          key={item.splitId}
                          type="button"
                          disabled={isPaid}
                          className={`flex items-center gap-3 px-3 py-2.5 transition-colors w-full text-left ${
                            isPaid
                              ? 'opacity-50 cursor-not-allowed bg-muted/30'
                              : `cursor-pointer hover:bg-muted/50 ${checked ? '' : 'opacity-60'}`
                          }`}
                          onClick={() => !isPaid && toggleItem(item.splitId)}
                        >
                          <Checkbox checked={!isPaid && checked} disabled={isPaid} onCheckedChange={() => !isPaid && toggleItem(item.splitId)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{item.description}</p>
                              {isPaid && <Badge variant="secondary" className="text-xs shrink-0">Paid</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.date), 'MMM d')} · {cat?.label ?? item.category}
                            </p>
                          </div>
                          <span className="text-sm font-bold tabular-nums shrink-0">
                            {formatCurrency(item.shareAmount, currency)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="payAmount" className="text-sm font-medium">Amount</label>
                <Input
                  id="payAmount"
                  type="number"
                  step="0.01"
                  value={useCustom ? customAmount : defaultAmount.toFixed(2)}
                  readOnly={!useCustom}
                  onChange={(e) => { setCustomAmount(e.target.value) }}
                  placeholder="Amount"
                />
                {!useCustom ? (
                  <button
                    type="button"
                    className="text-xs text-primary underline underline-offset-2"
                    onClick={() => { setUseCustom(true); setCustomAmount(selectedTotal.toFixed(2)) }}
                  >
                    Enter custom amount
                  </button>
                ) : selectedTotal > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-primary underline underline-offset-2"
                    onClick={() => { setUseCustom(false); setCustomAmount('') }}
                  >
                    Reset to selected ({formatCurrency(defaultAmount, currency)})
                  </button>
                ) : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="payDate" className="text-sm font-medium">Settlement date</label>
                <Input
                  id="payDate"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
                <Button onClick={handlePayment} disabled={payAmount <= 0 || isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Record Settlement'}
                </Button>
              </div>
            </div>
          )}
        </ResponsiveFormModal>
      </div>
    </>
  )
}
