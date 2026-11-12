/** Which kind of request a listing type takes. */
export type RequestKind = 'service' | 'appointment' | 'enquiry'

const APPOINTMENT = new Set(['doctor', 'clinic', 'hospital', 'diagnostic'])
const ENQUIRY = new Set(['business', 'school', 'gym', 'hotel', 'bus-operator'])

export function requestKindFor(providerType: string | null | undefined): RequestKind {
  if (providerType && APPOINTMENT.has(providerType)) return 'appointment'
  if (providerType && ENQUIRY.has(providerType)) return 'enquiry'
  return 'service'
}
