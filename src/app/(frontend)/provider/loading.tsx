import { TitleSkeleton } from '@/components/skeletons'
import { Container } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <TitleSkeleton />
      <Container className="grid gap-6 py-6 lg:grid-cols-[1fr_300px] lg:gap-10 lg:py-8">
        <div className="grid content-start gap-3">
          <div className="skeleton h-12 rounded-xl" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-48 rounded-2xl" />
      </Container>
    </>
  )
}
