import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { trips, members } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { MembersPage } from '@/components/members/MembersPage'

export default async function TripMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [[trip], tripMembers] = await Promise.all([
    db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, user.id))),
    db.select().from(members).where(eq(members.tripId, id)),
  ])

  return <MembersPage tripId={id} initialMembers={tripMembers} currency={trip?.currency ?? 'PHP'} />
}
