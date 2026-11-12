import type { PayloadRequest } from 'payload'

/** Append-only audit record for privileged actions (blueprint sections 10 and 15). */
export async function audit(
  req: PayloadRequest,
  action: string,
  collection: string,
  docId: number | string,
  detail: Record<string, unknown> = {},
) {
  await req.payload.create({
    collection: 'audit-logs',
    overrideAccess: true,
    req, // same transaction as the change being logged
    data: {
      action,
      targetCollection: collection,
      targetId: String(docId),
      actor: req.user?.id ? Number(req.user.id) || undefined : undefined,
      detail,
    },
  })
}
