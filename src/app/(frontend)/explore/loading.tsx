import { CardSkeleton, TitleSkeleton } from '@/components/skeletons'
import { Container } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <TitleSkeleton />
      <Container className="grid gap-6 py-6 md:grid-cols-[260px_1fr] md:py-8 lg:gap-10">
        <div className="hidden rounded-2xl border border-line bg-white p-4 md:block">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton mt-4 h-11" />
          <div className="skeleton mt-3 h-11" />
          <div className="skeleton mt-3 h-11" />
        </div>
        <ul className="grid content-start gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </ul>
      </Container>
    </>
  )
}
