import type { Access, FieldAccess, Where } from 'payload'

export const ROLES = [
  'super-admin',
  'admin',
  'moderator',
  'editor',
  'provider',
  'customer',
] as const
export type Role = (typeof ROLES)[number]

type MaybeUser = { id?: number | string; roles?: (Role | string)[] | null } | null | undefined

export const hasRole = (user: MaybeUser, ...roles: Role[]): boolean =>
  Boolean(user?.roles?.some((r) => roles.includes(r as Role)))

export const isSuperAdmin = (user: MaybeUser) => hasRole(user, 'super-admin')
export const isAdmin = (user: MaybeUser) => hasRole(user, 'super-admin', 'admin')
/** Anyone allowed into the /admin panel. */
export const isStaff = (user: MaybeUser) => hasRole(user, 'super-admin', 'admin', 'moderator', 'editor')

export const anyone: Access = () => true
export const adminsOnly: Access = ({ req }) => isAdmin(req.user)
export const superAdminsOnly: Access = ({ req }) => isSuperAdmin(req.user)
export const staffOnly: Access = ({ req }) => isStaff(req.user)
export const signedIn: Access = ({ req }) => Boolean(req.user)

export const adminFieldOnly: FieldAccess = ({ req }) => isAdmin(req.user)
export const staffFieldOnly: FieldAccess = ({ req }) => isStaff(req.user)

/** Admins see everything; others only their own user record. */
export const selfOrAdmin: Access = ({ req }) => {
  if (isAdmin(req.user)) return true
  if (!req.user) return false
  return { id: { equals: req.user.id } } satisfies Where
}

/**
 * Which roles a given actor may grant. Only super-admins can create admins or super-admins,
 * so a routine admin can never escalate themselves (blueprint section 10).
 */
export const grantableRoles = (actor: MaybeUser): Role[] => {
  if (isSuperAdmin(actor)) return [...ROLES]
  if (isAdmin(actor)) return ['moderator', 'editor', 'provider', 'customer']
  return []
}

/** True when `next` adds any role the actor is not allowed to grant. */
export const isRoleEscalation = (actor: MaybeUser, prev: string[] = [], next: string[] = []): boolean => {
  const allowed = new Set<string>(grantableRoles(actor))
  const added = next.filter((r) => !prev.includes(r))
  const removed = prev.filter((r) => !next.includes(r))
  // Removing super-admin/admin also needs super-admin.
  const touchesTop = [...added, ...removed].some((r) => r === 'super-admin' || r === 'admin')
  if (touchesTop && !isSuperAdmin(actor)) return true
  return added.some((r) => !allowed.has(r))
}
