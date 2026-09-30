import { beforeEach, describe, expect, it } from 'vitest'
import type { OidcSettings } from './oidcConfiguration'

const managerModules = import.meta.glob<typeof import('./identitySessionManager')>('./identitySessionManager.ts')

async function loadManager() {
  const loader = managerModules['./identitySessionManager.ts']
  expect(loader, 'the PKCE OIDC session manager is implemented').toBeTypeOf('function')
  return loader!()
}

const configuration: OidcSettings = {
  authority: 'https://identity.example.edu.co/realms/university',
  clientId: 'universiry-web',
  redirectUri: 'https://universiry.example.edu.co/auth/callback',
  postLogoutRedirectUri: 'https://universiry.example.edu.co/',
  scope: 'openid university-api',
}

beforeEach(() => window.sessionStorage.clear())

describe('OIDC session manager', () => {
  it('uses authorization code with PKCE and limits session state to this browser tab', async () => {
    // Arrange
    const { createOidcUserManager } = await loadManager()

    // Act
    const manager = createOidcUserManager(configuration)

    // Assert
    expect(manager.settings.response_type).toBe('code')
    expect(manager.settings.disablePKCE).toBe(false)
    expect(manager.settings.automaticSilentRenew).toBe(false)
    expect(manager.settings.loadUserInfo).toBe(false)
    expect(manager.settings.scope).toBe('openid university-api')
    expect(manager.settings.userStore).toBeDefined()
    expect(manager.settings.stateStore).toBeDefined()
  })

  it('removes refresh tokens and unneeded profile claims before writing a session user', async () => {
    // Arrange
    const { createOidcUserManager } = await loadManager()
    const manager = createOidcUserManager(configuration)
    const key = 'user:https://identity.example.edu.co/realms/university:universiry-web'
    const user = {
      access_token: 'synthetic-access-token',
      refresh_token: 'must-not-persist',
      id_token: 'synthetic-id-token',
      token_type: 'Bearer',
      profile: { sub: 'subject-42', email: 'private@example.test' },
    }

    // Act
    await manager.settings.userStore.set(key, JSON.stringify(user))
    const stored = await manager.settings.userStore.get(key)

    // Assert
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).not.toHaveProperty('refresh_token')
    expect(JSON.parse(stored!).profile).toEqual({ sub: 'subject-42' })
    const keys = [...Array(window.sessionStorage.length)].map((_, index) => window.sessionStorage.key(index))
    expect(keys.some((storedKey) => storedKey?.includes('universiry.oidc.user:'))).toBe(true)
  })
})
