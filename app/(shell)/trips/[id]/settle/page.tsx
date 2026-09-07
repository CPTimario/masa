import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { trips, members, expenses, expenseSplits, settlements, settlementItems, transfers } from '@/lib/db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { SettlePage } from '@/components/settlement/SettlePage'

export default async function TripSettlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [[trip], tripMembers, tripExpenses, tripSettlements, tripTransfers] = await Promise.all([
    db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, user.id))),
    db.select().from(members).where(eq(members.tripId, id)).orderBy(desc(members.isSelf)),
    db.select().from(expenses).where(eq(expenses.tripId, id)),
    db.select().from(settlements).where(eq(settlements.tripId, id)),
    db.select().from(transfers).where(eq(transfers.tripId, id)),
  ])

  if (!trip) return null

  const expenseIds = tripExpenses.map((e) => e.id)
  const splits = expenseIds.length
    ? await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds))
    : []

  const settlementIds = tripSettlements.map((s) => s.id)
  const settlementSplitLinks = settlementIds.length
    ? await db.select().from(settlementItems).where(inArray(settlementItems.settlementId, settlementIds))
    : []

  return (
    <SettlePage
      tripId={id}
      currency={trip.currency}
      initialMembers={tripMembers}
      initialExpenses={tripExpenses}
      initialSplits={splits}
      initialSettlements={tripSettlements}
      initialSettlementItems={settlementSplitLinks}
      initialTransfers={tripTransfers}
    />
  )
}
