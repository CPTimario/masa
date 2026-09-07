'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Plus, ArrowLeftRight, Receipt, CreditCard, ArrowUpRight, ArrowDownLeft, CheckCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ResponsiveFormModal } from '@/components/ui/responsive-form-modal'
import { CATEGORIES } from '@/lib/categories'
import { buildTransactionHistory } from '@/lib/wallet'
import { formatCurrency } from '@/lib/format'
import { MobilePageHeader } from '@/components/shell/MobilePageHeader'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { TransferModal } from '@/components/wallet/TransferModal'
import { ConversionModal } from '@/components/wallet/ConversionModal'
import { createSettlement } from '@/server/actions/settlements'
import type { Trip, Member, Expense, ExpenseSplit, Settlement, SettlementItem, Transfer, MemberBalance } from '@/lib/db/schema'

interface DebtItem {
  splitId: string
  expenseId: string
  description: string
  category: string
  date: string
  shareAmount: number
  paidBySettlementId?: string
}

function getDebtBreakdown(
  fromId: string,
  toId: string,
  expenses: Expense[],
  splits: ExpenseSplit[],
  paidSplitIds: Map<string, string>,
): DebtItem[] {
  return expenses
    .filter((e) => e.type === 'shared' && e.paidById === toId)
    .flatMap((e) => {
      const split = splits.find((s) => s.expenseId === e.id && s.memberId === fromId)
      if (!split) return []
      return [{
        splitId: split.id,
        expenseId: e.id,
        description: e.description,
        category: e.category,
        date: e.date,
        shareAmount: Math.round(parseFloat(String(split.shareAmount)) * 100) / 100,
        paidBySettlementId: paidSplitIds.get(split.id),
      }]
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

interface Props {
  trip: Trip
  member: Member
  allMembers: Member[]
  expenses: Expense[]
  expenseSplits: ExpenseSplit[]
  settlements: Settlement[]
  settlementItems: SettlementItem[]
  transfers: Transfer[]
  balances: MemberBalance[]
  memberDebts: { from: string; to: string; amount: number }[]
}

const TX_ICONS = {
  expense_paid:        { icon: Receipt,       color: 'text-destructive', bg: 'bg-destructive/5' },
  expense_split:       { icon: Receipt,       color: 'text-destructive', bg: 'bg-destructive/5' },
  settlement_sent:     { icon: CreditCard,    color: 'text-destructive', bg: 'bg-destructive/5' },
  settlement_received: { icon: CheckCircle,   color: 'text-success',     bg: 'bg-success/10' },
  transfer_sent:       { icon: ArrowUpRight,  color: 'text-destructive', bg: 'bg-destructive/5' },
  transfer_received:   { icon: ArrowDownLeft, color: 'text-success',     bg: 'bg-success/10' },
}

export function MemberDetail({ trip, member, allMembers, expenses, expenseSplits, settlements, settlementItems, transfers, balances, memberDebts }: Props) {
  const router = useRouter()
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [settleDebt, setSettleDebt] = useState<{ from: string; to: string; amount: number } | null>(null)
  const [settleDate, setSettleDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [useCustom, setUseCustom] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [settling, setSettling] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState(
    () => balances.find((b) => b.currency === trip.currency)?.currency ?? balances[0]?.currency ?? trip.currency
  )

  const consumed = useMemo(() => {
    const personalSpent = expenses
      .filter((e) => e.paidById === member.id && e.type === 'personal')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0)
    const splitConsumed = expenseSplits
      .filter((s) => s.memberId === member.id)
      .reduce((sum, s) => sum + parseFloat(s.shareAmount), 0)
    return personalSpent + splitConsumed
  }, [expenses, expenseSplits, member.id])

  const budget = parseFloat(member.initialBudget || '0')
  const budgetPct = budget > 0 ? Math.min(100, (consumed / budget) * 100) : 0

  const totalOwed = useMemo(
    () => memberDebts.filter((d) => d.from === member.id).reduce((sum, d) => sum + d.amount, 0),
    [memberDebts, member.id]
  )
  const totalOwedToMe = useMemo(
    () => memberDebts.filter((d) => d.to === member.id).reduce((sum, d) => sum + d.amount, 0),
    [memberDebts, member.id]
  )

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.filter((e) => e.paidById === member.id && e.type === 'personal').forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + parseFloat(e.amount)
    })
    const expenseById = new Map(expenses.map((e) => [e.id, e]))
    expenseSplits.filter((s) => s.memberId === member.id).forEach((s) => {
      const expense = expenseById.get(s.expenseId)
      if (expense) {
        map[expense.category] = (map[expense.category] ?? 0) + parseFloat(s.shareAmount)
      }
    })
    return Object.entries(map).map(([key, value]) => ({
      name: CATEGORIES[key as keyof typeof CATEGORIES]?.label ?? key,
      amount: Math.round(value * 100) / 100,
      color: CATEGORIES[key as keyof typeof CATEGORIES]?.color ?? '#6b7280',
    }))
  }, [expenses, expenseSplits, member.id])

  const memberByIdMap = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers])

  const paidSplitIds = useMemo(
    () => new Map(settlementItems.map((si) => [si.expenseSplitId, si.settlementId])),
    [settlementItems]
  )

  const breakdown = useMemo(() => {
    if (!settleDebt) return []
    return getDebtBreakdown(settleDebt.from, settleDebt.to, expenses, expenseSplits, paidSplitIds)
  }, [settleDebt, expenses, expenseSplits, paidSplitIds])

  const unpaidBreakdown = useMemo(() => breakdown.filter((i) => !i.paidBySettlementId), [breakdown])

  const selectedTotal = useMemo(
    () => unpaidBreakdown.filter((item) => selectedItems.has(item.splitId)).reduce((sum, item) => sum + item.shareAmount, 0),
    [unpaidBreakdown, selectedItems]
  )

  const defaultAmount = unpaidBreakdown.length > 0 && selectedItems.size === unpaidBreakdown.length
    ? (settleDebt?.amount ?? selectedTotal)
    : selectedTotal

  const payAmount = useCustom ? parseFloat(customAmount || '0') : defaultAmount

  function openSettleModal(debt: { from: string; to: string; amount: number }) {
    setSettleDebt(debt)
    setSettleDate(format(new Date(), 'yyyy-MM-dd'))
    setUseCustom(false)
    setCustomAmount('')
    const items = getDebtBreakdown(debt.from, debt.to, expenses, expenseSplits, paidSplitIds)
    setSelectedItems(new Set(items.filter((i) => !i.paidBySettlementId).map((i) => i.splitId)))
  }

  function toggleItem(splitId: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      next.has(splitId) ? next.delete(splitId) : next.add(splitId)
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

  const transactions = useMemo(
    () => buildTransactionHistory(member.id, expenses, expenseSplits, settlements, transfers, trip.currency)
          .filter((tx) => tx.type !== 'expense_split'),
    [member.id, expenses, expenseSplits, settlements, transfers, trip.currency]
  )

  function handleSuccess() {
    router.refresh()
  }

  const activeBalance = balances.find((b) => b.currency === selectedCurrency) ?? balances[0]

  return (
    <>
      <MobilePageHeader title={member.name} backHref={`/trips/${trip.id}/members`} />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Desktop header */}
        <div className="hidden md:flex items-center gap-3">
          <Link href={`/trips/${trip.id}/members`} aria-label="Back to members" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
            style={{ backgroundColor: member.color }}
          >
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{member.name}</h1>
              {member.isSelf && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">You</span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">{trip.name}</p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground">Budget</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-sm md:text-lg font-bold truncate">{formatCurrency(budget, trip.currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground">Consumed</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-sm md:text-lg font-bold truncate">{formatCurrency(consumed, trip.currency)}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground">Wallet</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {balances.length === 0 ? (
                <p className="text-sm font-bold text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {balances.map((b) => (
                      <button
                        key={b.currency}
                        onClick={() => setSelectedCurrency(b.currency)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          selectedCurrency === b.currency
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {b.currency}
                      </button>
                    ))}
                  </div>
                  {activeBalance && (() => {
                    const amt = parseFloat(activeBalance.balance)
                    return (
                      <p className={`text-sm md:text-lg font-bold truncate ${amt >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(amt, activeBalance.currency)}
                      </p>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Debt summary */}
        <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs text-muted-foreground">You Owe</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {totalOwed > 0
                  ? <p className="text-sm md:text-lg font-bold text-destructive truncate">{formatCurrency(totalOwed, trip.currency)}</p>
                  : <p className="text-sm font-bold text-muted-foreground">—</p>
                }
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs text-muted-foreground">Owed to You</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {totalOwedToMe > 0
                  ? <p className="text-sm md:text-lg font-bold text-success truncate">{formatCurrency(totalOwedToMe, trip.currency)}</p>
                  : <p className="text-sm font-bold text-muted-foreground">—</p>
                }
              </CardContent>
            </Card>
        </div>

        {/* Budget progress */}
        {budget > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Budget used</span>
              <span>{Math.round(budgetPct)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                role="progressbar"
                aria-valuenow={Math.round(budgetPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Budget used"
                className="h-full rounded-full transition-all"
                style={{
                  width: `${budgetPct}%`,
                  backgroundColor: budgetPct >= 100 ? '#ef4444' : member.color,
                }}
              />
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setExpenseModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Expense
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTransferModalOpen(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-1" /> Transfer
          </Button>
          {balances.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setConvertModalOpen(true)}>
              <ArrowLeftRight className="h-4 w-4 mr-1" /> Convert
            </Button>
          )}
        </div>

        {/* Tabs: Transaction History | Debts */}
        <Tabs defaultValue="history">
          <TabsList className="w-full">
            <TabsTrigger value="history" className="flex-1">Transaction History</TabsTrigger>
            <TabsTrigger value="debts" className="flex-1">Debts</TabsTrigger>
          </TabsList>

          {/* Transaction History tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            {categoryData.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Spending by Category</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[200px] md:h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(Number(v), trip.currency)} width={80} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v), trip.currency)} />
                        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                          {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
              <CardContent className="space-y-0 px-3 pb-3">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No activity yet.</p>
                ) : (
                  transactions.map((tx) => {
                    const meta = TX_ICONS[tx.type]
                    const Icon = meta.icon
                    const counterpart = tx.counterpartMemberId ? memberByIdMap.get(tx.counterpartMemberId) : null
                    const isInflow = tx.type === 'settlement_received' || tx.type === 'transfer_received'
                    return (
                      <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                          <Icon className={`h-4 w-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {format(new Date(tx.date), 'MMM d')}
                            {counterpart && ` · ${tx.type === 'transfer_sent' || tx.type === 'settlement_sent' ? 'to' : 'from'} ${counterpart.name}`}
                            {tx.category && ` · ${CATEGORIES[tx.category as keyof typeof CATEGORIES]?.label ?? tx.category}`}
                          </p>
                          {tx.amountInTrip != null && (
                            <p className="text-xs text-muted-foreground">≈ {formatCurrency(tx.amountInTrip, trip.currency)}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold tabular-nums ${meta.color}`}>
                            {isInflow ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Debts tab */}
          <TabsContent value="debts" className="mt-4">
            {memberDebts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">All settled up</p>
            ) : (
              <Card>
                <CardContent className="space-y-4 pt-4">
                  {memberDebts.filter((d) => d.from === member.id).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">I owe</p>
                      {memberDebts.filter((d) => d.from === member.id).map((debt, i) => {
                        const counterpart = memberByIdMap.get(debt.to)
                        return (
                          <div key={i} className="flex items-center justify-between gap-3 py-1">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{counterpart?.name ?? debt.to}</p>
                              <p className="text-sm font-bold text-destructive">{formatCurrency(debt.amount, trip.currency)}</p>
                            </div>
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openSettleModal(debt)}>
                              Pay
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {memberDebts.filter((d) => d.to === member.id).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Owed to me</p>
                      {memberDebts.filter((d) => d.to === member.id).map((debt, i) => {
                        const counterpart = memberByIdMap.get(debt.from)
                        return (
                          <div key={i} className="flex items-center justify-between gap-3 py-1">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{counterpart?.name ?? debt.from}</p>
                              <p className="text-sm font-bold text-success">{formatCurrency(debt.amount, trip.currency)}</p>
                            </div>
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openSettleModal(debt)}>
                              Mark received
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Expense modal */}
      <ResponsiveFormModal open={expenseModalOpen} onOpenChange={setExpenseModalOpen} title="Add Expense">
        <div className="p-4 md:p-0">
          <ExpenseForm
            tripId={trip.id}
            members={allMembers.map((m) => ({ id: m.id, name: m.name, isSelf: m.isSelf }))}
            currency={trip.currency}
            defaultPaidById={member.id}
            onSuccess={() => { setExpenseModalOpen(false); handleSuccess() }}
            onCancel={() => setExpenseModalOpen(false)}
          />
        </div>
      </ResponsiveFormModal>

      {/* Transfer modal */}
      <TransferModal
        tripId={trip.id}
        tripCurrency={trip.currency}
        members={allMembers.map((m) => ({ id: m.id, name: m.name, isSelf: m.isSelf }))}
        open={transferModalOpen}
        onOpenChange={(o) => {
          setTransferModalOpen(o)
          if (!o) handleSuccess()
        }}
        defaultFromMemberId={member.id}
      />

      {/* Convert modal */}
      <ConversionModal
        tripId={trip.id}
        members={allMembers.map((m) => ({ id: m.id, name: m.name }))}
        open={convertModalOpen}
        onOpenChange={(o) => {
          setConvertModalOpen(o)
          if (!o) handleSuccess()
        }}
        defaultMemberId={member.id}
        defaultFromCurrency={selectedCurrency}
      />

      {/* Settle modal */}
      <ResponsiveFormModal
        open={!!settleDebt}
        onOpenChange={(o) => { if (!o) setSettleDebt(null) }}
        title="Record Settlement"
      >
        {settleDebt && (() => {
          const fromName = memberByIdMap.get(settleDebt.from)?.name ?? ''
          const toName = memberByIdMap.get(settleDebt.to)?.name ?? ''
          const allChecked = unpaidBreakdown.length > 0 && selectedItems.size === unpaidBreakdown.length
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{fromName} pays {toName}</p>

              {breakdown.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allChecked}
                    className="flex items-center gap-3 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted transition-colors w-full text-left"
                    onClick={toggleAll}
                  >
                    <span className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${allChecked ? 'bg-primary border-primary' : 'border-input bg-background'}`} aria-hidden>
                      {allChecked && <span className="block h-2 w-2 bg-primary-foreground rounded-sm" />}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">All expenses</span>
                  </button>
                  <div className="divide-y max-h-56 overflow-y-auto">
                    {breakdown.map((item) => {
                      const cat = CATEGORIES[item.category as keyof typeof CATEGORIES]
                      const isPaid = !!item.paidBySettlementId
                      const checked = selectedItems.has(item.splitId)
                      return (
                        <button
                          key={item.splitId}
                          type="button"
                          role="checkbox"
                          aria-checked={isPaid ? false : checked}
                          disabled={isPaid}
                          className={`flex items-center gap-3 px-3 py-2 transition-colors w-full text-left ${
                            isPaid ? 'opacity-50 cursor-not-allowed bg-muted/30' : `cursor-pointer hover:bg-muted/50 ${checked ? '' : 'opacity-60'}`
                          }`}
                          onClick={() => !isPaid && toggleItem(item.splitId)}
                        >
                          <span className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${!isPaid && checked ? 'bg-primary border-primary' : 'border-input bg-background'}`} aria-hidden>
                            {!isPaid && checked && <span className="block h-2 w-2 bg-primary-foreground rounded-sm" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{item.description}</p>
                              {isPaid && <Badge variant="secondary" className="text-xs shrink-0">Paid</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.date), 'MMM d')} · {cat?.label ?? item.category}
                            </p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums shrink-0">
                            {formatCurrency(item.shareAmount, trip.currency)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="settle-amount" className="text-sm font-medium">Amount</label>
                <Input
                  id="settle-amount"
                  type="number"
                  step="0.01"
                  value={useCustom ? customAmount : defaultAmount.toFixed(2)}
                  readOnly={!useCustom}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Amount"
                />
                {!useCustom ? (
                  <button type="button" className="text-xs text-primary underline" onClick={() => { setUseCustom(true); setCustomAmount(selectedTotal.toFixed(2)) }}>
                    Enter custom amount
                  </button>
                ) : selectedTotal > 0 ? (
                  <button type="button" className="text-xs text-primary underline" onClick={() => { setUseCustom(false); setCustomAmount('') }}>
                    Reset to selected ({formatCurrency(defaultAmount, trip.currency)})
                  </button>
                ) : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="settle-date" className="text-sm font-medium">Settlement date</label>
                <Input id="settle-date" type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSettleDebt(null)}>Cancel</Button>
                <Button
                  disabled={settling || payAmount <= 0}
                  onClick={async () => {
                    setSettling(true)
                    try {
                      await createSettlement(trip.id, {
                        fromMemberId: settleDebt.from,
                        toMemberId: settleDebt.to,
                        amount: payAmount,
                        currency: trip.currency,
                        date: settleDate,
                        coveredSplitIds: Array.from(selectedItems),
                      })
                      setSettleDebt(null)
                      router.refresh()
                    } finally {
                      setSettling(false)
                    }
                  }}
                >
                  {settling ? 'Recording...' : 'Record Settlement'}
                </Button>
              </div>
            </div>
          )
        })()}
      </ResponsiveFormModal>
    </>
  )
}
