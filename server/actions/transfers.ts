'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { transfers, memberBalances, trips } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq, and, sql } from 'drizzle-orm'

const transferSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  exchangeRateToTrip: z.coerce.number().positive().optional(),
  date: z.string(),
  notes: z.string().optional(),
}).refine(d => d.fromMemberId !== d.toMemberId, {
  message: 'Sender and recipient must be different members',
  path: ['toMemberId'],
})

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function upsertBalance(tx: Tx, memberId: string, currency: string, delta: number) {
  await tx.insert(memberBalances)
    .values({ memberId, currency, balance: String(delta) })
    .onConflictDoUpdate({
      target: [memberBalances.memberId, memberBalances.currency],
      set: { balance: sql`${memberBalances.balance} + excluded.balance` },
    })
}

export async function createTransfer(tripId: string, data: z.infer<typeof transferSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [trip] = await db.select().from(trips).where(
    and(eq(trips.id, tripId), eq(trips.userId, user.id))
  )
  if (!trip) throw new Error('Unauthorized')

  const parsed = transferSchema.parse(data)

  await db.transaction(async (tx) => {
    await tx.insert(transfers).values({
      tripId,
      fromMemberId: parsed.fromMemberId,
      toMemberId: parsed.toMemberId,
      amount: String(parsed.amount),
      currency: parsed.currency,
      exchangeRateToTrip: parsed.exchangeRateToTrip != null ? String(parsed.exchangeRateToTrip) : null,
      date: parsed.date,
      notes: parsed.notes,
    })

    await upsertBalance(tx, parsed.fromMemberId, parsed.currency, -parsed.amount)
    await upsertBalance(tx, parsed.toMemberId, parsed.currency, parsed.amount)
  })

  revalidatePath(`/trips/${tripId}/money`)
  revalidatePath(`/trips/${tripId}/people`)
  revalidatePath(`/trips/${tripId}`)
}

export async function deleteTransfer(id: string, tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [trip] = await db.select().from(trips).where(
    and(eq(trips.id, tripId), eq(trips.userId, user.id))
  )
  if (!trip) throw new Error('Unauthorized')

  await db.transaction(async (tx) => {
    const [transfer] = await tx.select().from(transfers).where(eq(transfers.id, id))
    if (!transfer) return

    await upsertBalance(tx, transfer.fromMemberId, transfer.currency, parseFloat(String(transfer.amount)))
    await upsertBalance(tx, transfer.toMemberId, transfer.currency, -parseFloat(String(transfer.amount)))

    await tx.delete(transfers).where(eq(transfers.id, id))
  })

  revalidatePath(`/trips/${tripId}/money`)
  revalidatePath(`/trips/${tripId}/people`)
  revalidatePath(`/trips/${tripId}`)
}
