'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { trips } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq, and } from 'drizzle-orm'

const tripSchema = z.object({
  name: z.string().min(1),
  destination: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  currency: z.enum(['PHP', 'THB', 'USD', 'SGD', 'EUR']),
})

export async function createTrip(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const parsed = tripSchema.parse({
    name: formData.get('name'),
    destination: formData.get('destination'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    currency: formData.get('currency'),
  })

  const [trip] = await db.insert(trips).values({
    userId: user.id,
    ...parsed,
  }).returning()

  revalidatePath('/trips')
  redirect(`/trips/${trip.id}/people`)
}

export async function updateTrip(id: string, data: z.infer<typeof tripSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await db.update(trips)
    .set(data)
    .where(and(eq(trips.id, id), eq(trips.userId, user.id)))

  revalidatePath('/trips')
  revalidatePath(`/trips/${id}`)
}

export async function deleteTrip(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await db.delete(trips).where(and(eq(trips.id, id), eq(trips.userId, user.id)))

  revalidatePath('/trips')
  redirect('/trips')
}
