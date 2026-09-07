'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { CATEGORIES } from '@/lib/categories'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ResponsiveFormModal } from '@/components/ui/responsive-form-modal'
import { TripForm } from '@/components/trips/TripForm'
import { MobilePageHeader } from '@/components/shell/MobilePageHeader'
import { Receipt, Users, Wallet, DollarSign, TrendingDown, TrendingUp, Minus, Pencil } from 'lucide-react'
import { SectionHeader } from '@/components/ui/section-header'
import type { Trip, Member, Expense, ExpenseSplit, Settlement, Transfer } from '@/lib/db/schema'
import { computeBalances } from '@/lib/settlement'
import { formatCurrency } from '@/lib/format'

interface Props {
  trip: Trip
  members: Member[]
  expenses: Expense[]
  expenseSplits: ExpenseSplit[]
  settlements: Settlement[]
  transfers: Transfer[]
}

export function TripDashboard({ trip, members: rawMembers, expenses, expenseSplits, settlements, transfers }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const members = useMemo(() => [...rawMembers].sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0)), [rawMembers])
  const totalBudget = useMemo(() => members.reduce((sum, m) => sum + parseFloat(m.initialBudget || '0'), 0), [members])
  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0), [expenses])
  const remaining = totalBudget - totalSpent

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => {
      map[e.category] = (map[e.category] ?? 0) + parseFloat(e.amount)
    })
    return Object.entries(map).map(([key, value]) => ({
      name: CATEGORIES[key as keyof typeof CATEGORIES]?.label ?? key,
      value: Math.round(value * 100) / 100,
      color: CATEGORIES[key as keyof typeof CATEGORIES]?.color ?? '#6b7280',
    }))
  }, [expenses])

  const dailyData = useMemo(() => {
    try {
      const tripStart = parseISO(trip.startDate)
      const tripEnd = parseISO(trip.endDate)
      const expenseDates = expenses.map(e => parseISO(e.date))
      const start = expenseDates.length ? expenseDates.reduce((a, b) => a < b ? a : b, tripStart) : tripStart
      const end = expenseDates.length ? expenseDates.reduce((a, b) => a > b ? a : b, tripEnd) : tripEnd
      const days = eachDayOfInterval({ start, end })
      return days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const total = expenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + parseFloat(e.amount), 0)
        return { date: format(day, 'MMM d'), amount: Math.round(total * 100) / 100 }
      })
    } catch {
      return []
    }
  }, [trip, expenses])

  const memberSpendingData = useMemo(() =>
    members.map(m => ({
      name: m.name,
      spent: Math.round(expenses.filter(e => e.paidById === m.id).reduce((sum, e) => sum + parseFloat(e.amount), 0) * 100) / 100,
      color: m.color,
    }))
  , [members, expenses])

  const recentExpenses = useMemo(() =>
    [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
  , [expenses])

  const balances = useMemo(() => computeBalances(members, expenses, expenseSplits, settlements, new Map(), transfers), [members, expenses, expenseSplits, settlements, transfers])

  const memberSummaries = useMemo(() =>
    members.map(m => {
      const personalSpent = expenses
        .filter(e => e.paidById === m.id && e.type === 'personal')
        .reduce((sum, e) => sum + parseFloat(e.amount), 0)
      const splitConsumed = expenseSplits
        .filter(s => s.memberId === m.id)
        .reduce((sum, s) => sum + parseFloat(s.shareAmount), 0)
      return {
        member: m,
        consumed: personalSpent + splitConsumed,
        balance: balances[m.id] ?? 0,
      }
    })
  , [members, expenses, expenseSplits, balances])

  const budgetPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0
  const isEmpty = members.length === 0

  const statCards = [
    {
      label: 'Total Budget',
      value: formatCurrency(totalBudget, trip.currency),
      icon: DollarSign,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      label: 'Total Spent',
      value: formatCurrency(totalSpent, trip.currency),
      icon: TrendingDown,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
    },
    {
      label: 'Remaining',
      value: formatCurrency(remaining, trip.currency),
      icon: remaining >= 0 ? TrendingUp : TrendingDown,
      iconBg: remaining >= 0 ? 'bg-success/10' : 'bg-destructive/10',
      iconColor: remaining >= 0 ? 'text-success' : 'text-destructive',
      valueColor: remaining >= 0 ? 'text-success' : 'text-destructive',
    },
    {
      label: 'Expenses',
      value: String(expenses.length),
      icon: Receipt,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
  ]

  return (
    <>
      <MobilePageHeader title={trip.name} backHref="/trips" />
      <div className="p-4 md:p-6 space-y-5 md:space-y-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="hidden md:block text-2xl font-bold tracking-tight">{trip.name}</h1>
            <p className="text-muted-foreground text-sm">{trip.destination}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit trip"
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.label} className="border-border">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                      <Icon className={`h-3.5 w-3.5 ${card.iconColor}`} />
                    </div>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${card.valueColor ?? ''}`}>{card.value}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {totalBudget > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Budget used</span>
              <span className={budgetPct >= 90 ? 'text-destructive font-semibold' : ''}>{Math.round(budgetPct)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                role="progressbar"
                aria-valuenow={Math.round(budgetPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Budget used"
                className={`h-full rounded-full transition-all ${budgetPct >= 90 ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        )}

        {isEmpty ? (
          <Card className="border-border">
            <CardContent className="py-8 px-6 space-y-6">
              <div className="space-y-1 text-center">
                <h2 className="text-lg font-semibold">🗺️ Let&apos;s set up your trip</h2>
                <p className="text-sm text-muted-foreground">Two quick steps to get started tracking expenses.</p>
              </div>
              <div className="space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-4">
                  <span className="h-8 w-8 shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Add travel companions</p>
                    <p className="text-xs text-muted-foreground">Invite the people sharing this trip.</p>
                  </div>
                  <Link href={`/trips/${trip.id}/people`}>
                    <Button size="sm">Go to People</Button>
                  </Link>
                </div>
                <div className="flex items-center gap-4">
                  <span className="h-8 w-8 shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Log your first expense</p>
                    <p className="text-xs text-muted-foreground">Start recording what you spend.</p>
                  </div>
                  <Link href={`/trips/${trip.id}/expenses`}>
                    <Button size="sm" variant="outline">Go to Expenses</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {memberSummaries.length > 0 && (
              <div className="space-y-3">
                <SectionHeader title="People" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {memberSummaries.map(({ member, consumed, balance: rawBalance }) => {
                    const balance = Math.round(rawBalance * 100) / 100
                    const budget = parseFloat(member.initialBudget || '0')
                    const consumedPct = budget > 0 ? Math.min(100, (consumed / budget) * 100) : 0
                    return (
                      <Link key={member.id} href={`/trips/${trip.id}/people/${member.id}`}>
                        <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-border">
                          <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div
                                aria-hidden
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ring-2 ring-white dark:ring-card"
                                style={{ backgroundColor: member.color }}
                              >
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-sm truncate">{member.name}</p>
                                  {member.isSelf && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">You</span>
                                  )}
                                </div>
                                <span className={`text-xs font-semibold flex items-center gap-0.5 ${balance > 0 ? 'text-success' : balance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {balance > 0 ? <TrendingUp className="h-3 w-3" /> : balance < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                  {balance > 0 ? `+${formatCurrency(balance, trip.currency)}` : balance < 0 ? `-${formatCurrency(Math.abs(balance), trip.currency)}` : 'Settled'}
                                </span>
                              </div>
                            </div>
                            {budget > 0 && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                  <span>{formatCurrency(consumed, trip.currency)} spent</span>
                                  <span>{formatCurrency(budget, trip.currency)} budget</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${consumedPct >= 90 ? 'bg-destructive' : 'bg-primary'}`}
                                    style={{ width: `${consumedPct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="hidden md:flex gap-2 flex-wrap">
              <Link href={`/trips/${trip.id}/expenses`}>
                <Button variant="outline" size="sm" className="gap-2"><Receipt className="h-4 w-4" />Expenses</Button>
              </Link>
              <Link href={`/trips/${trip.id}/people`}>
                <Button variant="outline" size="sm" className="gap-2"><Users className="h-4 w-4" />People</Button>
              </Link>
              <Link href={`/trips/${trip.id}/money`}>
                <Button variant="outline" size="sm" className="gap-2"><Wallet className="h-4 w-4" />Money</Button>
              </Link>
            </div>

            <Tabs defaultValue="category">
              <TabsList className="w-full md:w-auto">
                <TabsTrigger value="category">By Category</TabsTrigger>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="member">By Member</TabsTrigger>
              </TabsList>

              <TabsContent value="category">
                <Card className="border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Spending by Category</CardTitle></CardHeader>
                  <CardContent>
                    {categoryData.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">No expenses yet</p>
                    ) : (
                      <div className="h-[240px] md:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={40}>
                              {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(v) => formatCurrency(Number(v), trip.currency)} />
                            <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="daily">
                <Card className="border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Daily Spending</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[200px] md:h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyData}>
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v) => formatCurrency(Number(v), trip.currency)} cursor={{ fill: 'var(--muted)' }} />
                          <Bar dataKey="amount" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="member">
                <Card className="border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Spending by Member</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[200px] md:h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={memberSpendingData} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v) => formatCurrency(Number(v), trip.currency)} cursor={{ fill: 'var(--muted)' }} />
                          <Bar dataKey="spent" radius={[0, 4, 4, 0]}>
                            {memberSpendingData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {recentExpenses.length > 0 && (
              <Card className="border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-semibold">Recent Expenses</CardTitle>
                  <Link href={`/trips/${trip.id}/expenses`}>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary" aria-label="View all expenses">View All</Button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-0">
                  {recentExpenses.map((e, idx) => (
                    <div key={e.id} className={`flex items-center justify-between py-2.5 ${idx < recentExpenses.length - 1 ? 'border-b border-border' : ''}`}>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{e.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(e.date), 'MMM d')} · {CATEGORIES[e.category as keyof typeof CATEGORIES]?.label}
                        </p>
                      </div>
                      <span className="font-semibold text-sm tabular-nums shrink-0 ml-3">{formatCurrency(parseFloat(e.amount), trip.currency)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <ResponsiveFormModal open={editOpen} onOpenChange={setEditOpen} title="Edit Trip">
        <TripForm
          mode="edit"
          tripId={trip.id}
          initial={{
            name: trip.name,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            currency: trip.currency,
          }}
          onSuccess={() => { setEditOpen(false); router.refresh() }}
          onCancel={() => setEditOpen(false)}
        />
      </ResponsiveFormModal>
    </>
  )
}
