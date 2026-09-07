import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

function StatCard() {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  )
}

export default function TripDashboardLoading() {
  return (
    <>
      <header className="md:hidden sticky top-0 z-40 h-[52px] border-b bg-background/95 backdrop-blur" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard />
          <StatCard />
          <StatCard />
          <StatCard />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-5 w-20" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-[240px] md:h-[300px] w-full rounded-lg" />
      </div>
    </>
  )
}
