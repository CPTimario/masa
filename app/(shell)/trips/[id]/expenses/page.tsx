import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { trips, members, expenses, expenseSplits } from '@/lib/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { ExpensesPage } from '@/components/expenses/ExpensesPage'

export default async function TripExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [[trip], tripMembers, tripExpenses] = await Promise.all([
    db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, user.id))),
    db.select().from(members).where(eq(members.tripId, id)).orderBy(desc(members.isSelf)),
    db.select().from(expenses).where(eq(expenses.tripId, id)).orderBy(desc(expenses.date)),
  ])

  if (!trip) return null

  const expenseIds = tripExpenses.map(e => e.id)
  const tripExpenseSplits = expenseIds.length
    ? await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds))
    : []

  return (
    <ExpensesPage
      tripId={id}
      initialTrip={trip}
      initialMembers={tripMembers}
      initialExpenses={tripExpenses}
      initialExpenseSplits={tripExpenseSplits}
    />
  )
}
