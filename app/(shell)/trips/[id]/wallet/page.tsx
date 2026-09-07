import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { trips, members, memberBalances, conversions } from '@/lib/db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { WalletPage } from '@/components/wallet/WalletPage'

export default async function TripWalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [[trip], tripMembers] = await Promise.all([
    db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, user.id))),
    db.select().from(members).where(eq(members.tripId, id)).orderBy(desc(members.isSelf)),
  ])

  if (!trip) notFound()

  const memberIds = tripMembers.map((m) => m.id)
  const [balances, conversionRows] = await Promise.all([
    memberIds.length
      ? db.select().from(memberBalances).where(inArray(memberBalances.memberId, memberIds))
      : Promise.resolve([]),
    db.select().from(conversions).where(eq(conversions.tripId, trip.id)).orderBy(desc(conversions.createdAt)),
  ])

  return <WalletPage trip={trip} members={tripMembers} balances={balances} conversions={conversionRows} />
}
