import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { trips, members, memberBalances, conversions, expenses, expenseSplits, settlements, settlementItems, transfers } from '@/lib/db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { MoneyPage } from '@/components/money/MoneyPage'

export default async function TripMoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [[trip], tripMembers, tripExpenses, tripSettlements, tripTransfers, conversionRows] = await Promise.all([
    db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, user.id))),
    db.select().from(members).where(eq(members.tripId, id)).orderBy(desc(members.isSelf)),
    db.select().from(expenses).where(eq(expenses.tripId, id)),
    db.select().from(settlements).where(eq(settlements.tripId, id)),
    db.select().from(transfers).where(eq(transfers.tripId, id)),
    db.select().from(conversions).where(eq(conversions.tripId, id)).orderBy(desc(conversions.createdAt)),
  ])

  if (!trip) notFound()

  const memberIds = tripMembers.map((m) => m.id)
  const expenseIds = tripExpenses.map((e) => e.id)
  const settlementIds = tripSettlements.map((s) => s.id)

  const [balances, splits, settlementSplitLinks] = await Promise.all([
    memberIds.length
      ? db.select().from(memberBalances).where(inArray(memberBalances.memberId, memberIds))
      : Promise.resolve([]),
    expenseIds.length
      ? db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds))
      : Promise.resolve([]),
    settlementIds.length
      ? db.select().from(settlementItems).where(inArray(settlementItems.settlementId, settlementIds))
      : Promise.resolve([]),
  ])

  return (
    <MoneyPage
      trip={trip}
      members={tripMembers}
      balances={balances}
      conversions={conversionRows}
      expenses={tripExpenses}
      expenseSplits={splits}
      settlements={tripSettlements}
      settlementItems={settlementSplitLinks}
      transfers={tripTransfers}
    />
  )
}
