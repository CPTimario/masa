'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { members, trips, memberBalances } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq, and, sql } from 'drizzle-orm'

const memberSchema = z.object({
  name: z.string().min(1),
  initialBudget: z.coerce.number().min(0),
  isSelf: z.boolean().default(false),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

async function verifyTripOwnership(tripId: string, userId: string) {
  const [trip] = await db.select().from(trips).where(
    and(eq(trips.id, tripId), eq(trips.userId, userId))
  )
  if (!trip) throw new Error('Trip not found or unauthorized')
  return trip
}

export async function createMember(tripId: string, data: z.infer<typeof memberSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const trip = await verifyTripOwnership(tripId, user.id)
  const parsed = memberSchema.parse(data)

  await db.transaction(async (tx) => {
    const [member] = await tx.insert(members).values({ tripId, ...parsed, initialBudget: String(parsed.initialBudget) }).returning()
    if (parsed.initialBudget > 0) {
      await tx.insert(memberBalances).values({ memberId: member.id, currency: trip.currency, balance: String(parsed.initialBudget) })
        .onConflictDoUpdate({
          target: [memberBalances.memberId, memberBalances.currency],
          set: { balance: sql`${memberBalances.balance} + excluded.balance` },
        })
    }
  })
  revalidatePath(`/trips/${tripId}/people`)
}

export async function updateMember(id: string, tripId: string, data: Partial<z.infer<typeof memberSchema>>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const trip = await verifyTripOwnership(tripId, user.id)
  const { initialBudget, ...rest } = data

  await db.transaction(async (tx) => {
    if (initialBudget !== undefined) {
      const [old] = await tx.select().from(members).where(eq(members.id, id))
      const oldBudget = parseFloat(String(old?.initialBudget ?? '0'))
      const diff = initialBudget - oldBudget
      if (diff !== 0) {
        await tx.insert(memberBalances).values({ memberId: id, currency: trip.currency, balance: String(diff) })
          .onConflictDoUpdate({
            target: [memberBalances.memberId, memberBalances.currency],
            set: { balance: sql`${memberBalances.balance} + excluded.balance` },
          })
      }
    }
    await tx.update(members).set({
      ...rest,
      ...(initialBudget !== undefined ? { initialBudget: String(initialBudget) } : {}),
    }).where(eq(members.id, id))
  })
  revalidatePath(`/trips/${tripId}/people`)
}

export async function deleteMember(id: string, tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await verifyTripOwnership(tripId, user.id)
  await db.delete(members).where(eq(members.id, id))
  revalidatePath(`/trips/${tripId}/people`)
}
