import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function PeopleLoading() {
  return (
    <>
      <header className="md:hidden sticky top-0 z-40 h-[52px] border-b bg-background/95 backdrop-blur" />
      <div className="p-4 md:p-6">
        <div className="hidden md:flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
