import { CardSkeleton, TitleSkeleton } from '@/components/skeletons'
import { Container } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <TitleSkeleton />
      <Container className="grid gap-4 py-6 md:py-8">
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-9 w-24 rounded-full" />)}
        </div>
        <ul className="grid gap-3">
          {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
        </ul>
      </Container>
    </>
  )
}
