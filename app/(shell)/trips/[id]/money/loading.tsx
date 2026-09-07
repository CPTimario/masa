import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function MoneyLoading() {
  return (
    <>
      <header className="md:hidden sticky top-0 z-40 h-[52px] border-b bg-background/95 backdrop-blur" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="hidden md:block">
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
