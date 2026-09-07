'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { conversions, memberBalances, trips } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq, and, sql } from 'drizzle-orm'

const conversionSchema = z.object({
  memberId: z.string().uuid(),
  fromCurrency: z.string().length(3),
  fromAmount: z.coerce.number().positive(),
  exchangeRate: z.coerce.number().positive(),
  toCurrency: z.string().length(3),
  toAmount: z.coerce.number().positive(),
  date: z.string(),
  notes: z.string().optional(),
}).refine(d => d.fromCurrency !== d.toCurrency, {
  message: 'Source and target currency must differ',
  path: ['toCurrency'],
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

export async function createConversion(tripId: string, data: z.infer<typeof conversionSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [trip] = await db.select().from(trips).where(
    and(eq(trips.id, tripId), eq(trips.userId, user.id))
  )
  if (!trip) throw new Error('Unauthorized')

  const parsed = conversionSchema.parse(data)

  await db.transaction(async (tx) => {
    await tx.insert(conversions).values({
      tripId,
      memberId: parsed.memberId,
      fromCurrency: parsed.fromCurrency,
      fromAmount: String(parsed.fromAmount),
      toCurrency: parsed.toCurrency,
      toAmount: String(parsed.toAmount),
      exchangeRate: String(parsed.exchangeRate),
      date: parsed.date,
      notes: parsed.notes,
    })

    await upsertBalance(tx, parsed.memberId, parsed.fromCurrency, -parsed.fromAmount)
    await upsertBalance(tx, parsed.memberId, parsed.toCurrency, parsed.toAmount)
  })

  revalidatePath(`/trips/${tripId}/wallet`)
}

export async function deleteConversion(id: string, tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const [trip] = await db.select().from(trips).where(
    and(eq(trips.id, tripId), eq(trips.userId, user.id))
  )
  if (!trip) throw new Error('Unauthorized')

  await db.transaction(async (tx) => {
    const [conv] = await tx.select().from(conversions).where(eq(conversions.id, id))
    if (!conv) return

    await upsertBalance(tx, conv.memberId, conv.fromCurrency, parseFloat(String(conv.fromAmount)))
    await upsertBalance(tx, conv.memberId, conv.toCurrency, -parseFloat(String(conv.toAmount)))
    await tx.delete(conversions).where(eq(conversions.id, id))
  })

  revalidatePath(`/trips/${tripId}/wallet`)
}
