import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { trips, members, expenses, expenseSplits, settlements, settlementItems, transfers, memberBalances } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { MemberDetail } from '@/components/members/MemberDetail'
import { computeBalances, simplifyDebts } from '@/lib/settlement'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string; personId: string }> }) {
  const { id, personId: memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [[trip], tripMembers, tripExpenses, tripSettlements, tripTransfers, memberBalanceRows] = await Promise.all([
    db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, user.id))),
    db.select().from(members).where(eq(members.tripId, id)),
    db.select().from(expenses).where(eq(expenses.tripId, id)),
    db.select().from(settlements).where(eq(settlements.tripId, id)),
    db.select().from(transfers).where(eq(transfers.tripId, id)),
    db.select().from(memberBalances).where(eq(memberBalances.memberId, memberId)),
  ])

  if (!trip) notFound()

  const member = tripMembers.find((m) => m.id === memberId)
  if (!member) notFound()

  const expenseIds = tripExpenses.map((e) => e.id)
  const settlementIds = tripSettlements.map((s) => s.id)

  const [tripExpenseSplits, tripSettlementItems] = await Promise.all([
    expenseIds.length
      ? db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds))
      : Promise.resolve([]),
    settlementIds.length
      ? db.select().from(settlementItems).where(inArray(settlementItems.settlementId, settlementIds))
      : Promise.resolve([]),
  ])

  const balances = computeBalances(tripMembers, tripExpenses, tripExpenseSplits, tripSettlements, new Map(), tripTransfers)
  const memberDebts = simplifyDebts(balances).filter(
    (d) => d.from === member.id || d.to === member.id
  )

  return (
    <MemberDetail
      trip={trip}
      member={member}
      allMembers={tripMembers}
      expenses={tripExpenses}
      expenseSplits={tripExpenseSplits}
      settlements={tripSettlements}
      settlementItems={tripSettlementItems}
      transfers={tripTransfers}
      balances={memberBalanceRows}
      memberDebts={memberDebts}
    />
  )
}
