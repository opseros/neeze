import type { Instrumentation } from 'next'

export async function register() {}

/** Every unhandled server error (pages, API routes, server actions) → email alert. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { sendErrorAlert } = await import('./lib/alerts')
  const path = request.path.split('?')[0]
  await sendErrorAlert(err, { path, method: request.method, kind: `${context.routeType} ${context.routePath}` })
}
