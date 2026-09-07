import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function PersonDetailLoading() {
  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-40 h-[52px] border-b bg-background/95 backdrop-blur" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Desktop header */}
        <div className="hidden md:flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="px-3 pb-3 pt-3 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-24" />
              </CardContent>
            </Card>
          ))}
          <Card className="col-span-2">
            <CardContent className="px-3 pb-3 pt-3 space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        </div>

        {/* Debt summary row */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="px-3 pb-3 pt-3 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action bar */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>

        {/* Tabs */}
        <div className="space-y-4">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Card>
            <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
