/**
 * Request lifecycle from the blueprint (section 7):
 * Submitted → Assigned → Contacted → Quoted → Accepted → In Progress → Completed,
 * with terminal Cancelled / Rejected / Expired.
 */
export const REQUEST_STATUSES = [
  'submitted',
  'assigned',
  'contacted',
  'quoted',
  'accepted',
  'in-progress',
  'completed',
  'cancelled',
  'rejected',
  'expired',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const TERMINAL: ReadonlySet<RequestStatus> = new Set(['completed', 'cancelled', 'rejected', 'expired'])

export type Actor = 'customer' | 'provider' | 'staff' | 'system'

const T: Record<Exclude<Actor, 'staff'>, Partial<Record<RequestStatus, RequestStatus[]>>> = {
  customer: {
    submitted: ['cancelled'],
    assigned: ['cancelled'],
    contacted: ['cancelled'],
    quoted: ['accepted', 'cancelled'],
    accepted: ['cancelled'],
  },
  provider: {
    submitted: ['contacted', 'rejected'],
    assigned: ['contacted', 'rejected'],
    contacted: ['quoted', 'accepted', 'rejected'],
    // In the MVP, price is agreed directly by phone, so the provider may record the agreement.
    quoted: ['accepted', 'rejected'],
    accepted: ['in-progress', 'cancelled'],
    'in-progress': ['completed'],
  },
  system: {
    submitted: ['assigned', 'expired'],
    assigned: ['expired'],
  },
}

export function canTransition(actor: Actor, from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return true
  if (actor === 'staff') return true // staff overrides are allowed but audit-logged
  if (TERMINAL.has(from)) return false
  return T[actor][from]?.includes(to) ?? false
}

/** Statuses that need a reason recorded (blueprint: "terminal outcomes with reason and timestamp"). */
export const needsReason = (to: RequestStatus) => to === 'cancelled' || to === 'rejected'
