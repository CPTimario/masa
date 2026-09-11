'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { expenses, expenseSplits, trips, memberBalances } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq, and, sql } from 'drizzle-orm'

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  category: z.enum(['travel', 'food', 'accommodation', 'activities', 'shopping', 'health', 'gifts', 'misc']),
  paidById: z.string().uuid(),
  type: z.enum(['personal', 'shared']),
  date: z.string(),
  currency: z.string().length(3).optional(),
  splits: z.array(z.object({
    memberId: z.string().uuid(),
    shareAmount: z.coerce.number().positive(),
  })).optional(),
})

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function verifyTripOwnership(tripId: string, userId: string) {
  const [trip] = await db.select().from(trips).where(
    and(eq(trips.id, tripId), eq(trips.userId, userId))
  )
  if (!trip) throw new Error('Trip not found or unauthorized')
  return trip
}

async function upsertBalance(tx: Tx, memberId: string, currency: string, delta: number) {
  await tx.insert(memberBalances)
    .values({ memberId, currency, balance: String(delta) })
    .onConflictDoUpdate({
      target: [memberBalances.memberId, memberBalances.currency],
      set: { balance: sql`${memberBalances.balance} + excluded.balance` },
    })
}

export async function createExpense(tripId: string, data: z.infer<typeof expenseSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const trip = await verifyTripOwnership(tripId, user.id)
  const parsed = expenseSchema.parse(data)
  const currency = parsed.currency ?? trip.currency

  await db.transaction(async (tx) => {
    const [expense] = await tx.insert(expenses).values({
      tripId,
      description: parsed.description,
      amount: String(parsed.amount),
      category: parsed.category,
      paidById: parsed.paidById,
      type: parsed.type,
      date: parsed.date,
      currency: parsed.currency ?? null,
    }).returning()

    if (parsed.type === 'shared' && parsed.splits?.length) {
      await tx.insert(expenseSplits).values(
        parsed.splits.map((s) => ({
          expenseId: expense.id,
          memberId: s.memberId,
          shareAmount: String(s.shareAmount),
        }))
      )
    }
    // Wallet: whoever physically paid loses that cash (all expense types)
    await upsertBalance(tx, parsed.paidById, currency, -parsed.amount)
  })

  revalidatePath(`/trips/${tripId}/expenses`)
  revalidatePath(`/trips/${tripId}/people`)
  revalidatePath(`/trips/${tripId}`)
}

export async function updateExpense(id: string, tripId: string, data: z.infer<typeof expenseSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const trip = await verifyTripOwnership(tripId, user.id)
  const parsed = expenseSchema.parse(data)
  const newCurrency = parsed.currency ?? trip.currency

  await db.transaction(async (tx) => {
    const [oldExpense] = await tx.select().from(expenses).where(eq(expenses.id, id))
    const oldCurrency = oldExpense?.currency ?? trip.currency

    // Reverse old payer's wallet debit
    if (oldExpense) {
      await upsertBalance(tx, oldExpense.paidById, oldCurrency, parseFloat(String(oldExpense.amount)))
    }

    await tx.update(expenses).set({
      description: parsed.description,
      amount: String(parsed.amount),
      category: parsed.category,
      paidById: parsed.paidById,
      type: parsed.type,
      date: parsed.date,
      currency: parsed.currency ?? null,
    }).where(eq(expenses.id, id))

    await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, id))

    if (parsed.type === 'shared' && parsed.splits?.length) {
      await tx.insert(expenseSplits).values(
        parsed.splits.map((s) => ({
          expenseId: id,
          memberId: s.memberId,
          shareAmount: String(s.shareAmount),
        }))
      )
    }
    // Apply new payer's wallet debit
    await upsertBalance(tx, parsed.paidById, newCurrency, -parsed.amount)
  })

  revalidatePath(`/trips/${tripId}/expenses`)
  revalidatePath(`/trips/${tripId}`)
}

export async function deleteExpense(id: string, tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const trip = await verifyTripOwnership(tripId, user.id)

  await db.transaction(async (tx) => {
    const [expense] = await tx.select().from(expenses).where(eq(expenses.id, id))
    const currency = expense?.currency ?? trip.currency

    // Reverse wallet debit for whoever paid
    if (expense) {
      await upsertBalance(tx, expense.paidById, currency, parseFloat(String(expense.amount)))
    }

    await tx.delete(expenses).where(eq(expenses.id, id))
  })

  revalidatePath(`/trips/${tripId}/expenses`)
  revalidatePath(`/trips/${tripId}`)
}
