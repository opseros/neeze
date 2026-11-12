import { Container } from './ui'

export function TitleSkeleton() {
  return (
    <div className="border-b border-line bg-white">
      <Container className="py-5 md:py-8">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton mt-3 h-8 w-64 max-w-full" />
        <div className="skeleton mt-2 h-4 w-48" />
      </Container>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex gap-3">
        <div className="skeleton size-12 shrink-0 rounded-xl" />
        <div className="flex-1">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton mt-2 h-3 w-1/2" />
          <div className="skeleton mt-4 h-3 w-full" />
          <div className="skeleton mt-1.5 h-3 w-5/6" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="skeleton h-10" />
        <div className="skeleton h-10" />
      </div>
    </li>
  )
}
