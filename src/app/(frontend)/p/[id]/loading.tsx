import { TitleSkeleton } from '@/components/skeletons'
import { Container } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <TitleSkeleton />
      <Container className="grid gap-6 py-6 lg:grid-cols-[1fr_340px] lg:gap-10 lg:py-8">
        <div className="grid content-start gap-4 lg:order-1">
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
        <div className="skeleton h-72 rounded-2xl lg:order-2" />
      </Container>
    </>
  )
}
