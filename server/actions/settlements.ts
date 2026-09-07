'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { settlements, settlementItems, memberBalances, trips } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq, and, sql } from 'drizzle-orm'

const settlementSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  date: z.string(),
  notes: z.string().optional(),
  coveredSplitIds: z.array(z.string().uuid()).optional(),
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

export async function createSettlement(tripId: string, data: z.infer<typeof settlementSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [trip] = await db.select().from(trips).where(
    and(eq(trips.id, tripId), eq(trips.userId, user.id))
  )
  if (!trip) throw new Error('Unauthorized')

  const parsed = settlementSchema.parse(data)

  await db.transaction(async (tx) => {
    const [newSettlement] = await tx.insert(settlements).values({
      tripId,
      fromMemberId: parsed.fromMemberId,
      toMemberId: parsed.toMemberId,
      amount: String(parsed.amount),
      currency: parsed.currency,
      date: parsed.date,
      notes: parsed.notes,
    }).returning()

    if (parsed.coveredSplitIds?.length) {
      await tx.insert(settlementItems).values(
        parsed.coveredSplitIds.map((splitId) => ({
          settlementId: newSettlement.id,
          expenseSplitId: splitId,
        }))
      )
    }

    await upsertBalance(tx, parsed.fromMemberId, parsed.currency, -parsed.amount)
    await upsertBalance(tx, parsed.toMemberId, parsed.currency, parsed.amount)
  })

  revalidatePath(`/trips/${tripId}/money`)
  revalidatePath(`/trips/${tripId}/people`)
  revalidatePath(`/trips/${tripId}`)
}

export async function deleteSettlement(id: string, tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [trip] = await db.select().from(trips).where(
    and(eq(trips.id, tripId), eq(trips.userId, user.id))
  )
  if (!trip) throw new Error('Unauthorized')

  await db.transaction(async (tx) => {
    const [settlement] = await tx.select().from(settlements).where(eq(settlements.id, id))
    if (!settlement) return

    await upsertBalance(tx, settlement.fromMemberId, settlement.currency, parseFloat(String(settlement.amount)))
    await upsertBalance(tx, settlement.toMemberId, settlement.currency, -parseFloat(String(settlement.amount)))

    await tx.delete(settlements).where(eq(settlements.id, id))
  })

  revalidatePath(`/trips/${tripId}/money`)
  revalidatePath(`/trips/${tripId}/people`)
  revalidatePath(`/trips/${tripId}`)
}
