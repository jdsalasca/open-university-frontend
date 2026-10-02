export const APPLICATION_PERMISSIONS = [
  'branding:read',
  'branding:write',
  'academic:catalog:read',
  'academic:catalog:write',
  'academic:structure:read',
  'academic:structure:write',
  'academic:period:read',
  'academic:period:write',
  'identity:roles:read',
  'identity:roles:write',
] as const

export type ApplicationPermission = (typeof APPLICATION_PERMISSIONS)[number]

export interface CurrentIdentity {
  userId: string
  subject: string
  permissions: ApplicationPermission[]
}

export interface IdentityClient {
  current(accessToken: string, signal?: AbortSignal): Promise<CurrentIdentity>
}
