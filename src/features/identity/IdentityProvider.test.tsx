import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentIdentity, IdentityClient } from './identityContracts'
import { IdentityApiError } from './identityClient'
import type { OidcConfigurationResult } from './oidcConfiguration'
import { useIdentity } from './identityContext'

const providerModules = import.meta.glob<typeof import('./IdentityProvider')>('./IdentityProvider.tsx')

async function loadProvider() {
  const loader = providerModules['./IdentityProvider.tsx']
  expect(loader, 'the OIDC identity provider is implemented').toBeTypeOf('function')
  return loader!()
}

const configuration: OidcConfigurationResult = {
  status: 'configured',
  settings: {
    authority: 'https://identity.example.edu.co',
    clientId: 'universiry-web',
    redirectUri: 'https://universiry.example.edu.co/auth/callback',
    postLogoutRedirectUri: 'https://universiry.example.edu.co/',
    scope: 'openid university-api',
  },
}

const identity: CurrentIdentity = {
  subject: 'subject-42',
  permissions: ['branding:read'],
}

const currentUser = {
  access_token: 'synthetic-access-token',
  expires_at: Math.floor(Date.now() / 1000) + 300,
  state: { returnHash: '#academia' },
}

function makeManager(overrides: Record<string, unknown> = {}) {
  return {
    getUser: vi.fn().mockResolvedValue(null),
    signinRedirect: vi.fn().mockResolvedValue(undefined),
    signinCallback: vi.fn().mockResolvedValue(currentUser),
    signoutRedirect: vi.fn().mockResolvedValue(undefined),
    removeUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeIdentityClient(result: CurrentIdentity | Error = identity): IdentityClient {
  return {
    current: vi.fn().mockImplementation(() => result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
  }
}

function ProviderHarness() {
  return <IdentityStateView />
}

function IdentityStateView() {
  const { state, login, logout, retry } = useIdentity()
  return (
    <div>
      <p role="status">{state.status}{state.status === 'authenticated' ? `:${state.subject}:${state.permissions.join(',')}` : ''}</p>
      {state.status === 'error' && <p>{state.message}</p>}
      <button type="button" onClick={() => void login()}>Iniciar sesión</button>
      <button type="button" onClick={() => void logout()}>Cerrar sesión</button>
      <button type="button" onClick={() => void retry()}>Reintentar</button>
    </div>
  )
}

async function renderProvider(options: {
  configuration?: OidcConfigurationResult
  manager?: ReturnType<typeof makeManager>
  identityClient?: IdentityClient
} = {}) {
  const provider = await loadProvider()
  render(
    <provider.IdentityProvider
      configuration={options.configuration ?? configuration}
      manager={options.manager as never}
      identityClient={options.identityClient ?? makeIdentityClient()}
    >
      <ProviderHarness />
    </provider.IdentityProvider>,
  )
  return provider
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.useRealTimers()
})

describe('IdentityProvider', () => {
  it('keeps login disabled when institutional OIDC is not configured', async () => {
    // Arrange
    const manager = makeManager()
    await renderProvider({ configuration: { status: 'unconfigured' }, manager })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('unconfigured')
    expect(manager.signinRedirect).not.toHaveBeenCalled()
  })

  it('shows a safe configuration error and starts no session for invalid settings', async () => {
    // Arrange
    const manager = makeManager()
    await renderProvider({ configuration: { status: 'invalid' }, manager })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('error')
    expect(manager.getUser).not.toHaveBeenCalled()
    expect(manager.signinRedirect).not.toHaveBeenCalled()
  })

  it('restores permissions only from the authenticated current-identity API response', async () => {
    // Arrange
    const manager = makeManager({ getUser: vi.fn().mockResolvedValue(currentUser) })
    const api = makeIdentityClient(identity)
    await renderProvider({ manager, identityClient: api })

    // Act + Assert
    expect(await screen.findByRole('status')).toHaveTextContent('authenticated:subject-42:branding:read')
    expect(api.current).toHaveBeenCalledWith('synthetic-access-token', expect.any(AbortSignal))
    expect(screen.queryByText(/synthetic-access-token/)).not.toBeInTheDocument()
  })

  it('removes an expired tab session without asking the API for permissions', async () => {
    // Arrange
    const manager = makeManager({ getUser: vi.fn().mockResolvedValue({
      access_token: 'expired-access-token',
      expires_at: Math.floor(Date.now() / 1000) - 10,
    }) })
    const api = makeIdentityClient(identity)

    // Act
    await renderProvider({ manager, identityClient: api })

    // Assert
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('anonymous'))
    expect(manager.removeUser).toHaveBeenCalledOnce()
    expect(api.current).not.toHaveBeenCalled()
  })

  it('clears local permissions when the restored access token expires in an open tab', async () => {
    // Arrange
    vi.useFakeTimers()
    const expiringUser = { ...currentUser, expires_at: Math.floor(Date.now() / 1000) + 4 }
    const manager = makeManager({ getUser: vi.fn().mockResolvedValue(expiringUser) })
    const api = makeIdentityClient(identity)
    await renderProvider({ manager, identityClient: api })
    await act(async () => {})
    expect(screen.getByRole('status')).toHaveTextContent('authenticated:subject-42:branding:read')

    // Act
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('anonymous')
    expect(manager.removeUser).toHaveBeenCalledOnce()
    expect(screen.queryByText(/branding:read/)).not.toBeInTheDocument()
  })

  it('does not publish permissions when the token expires during the identity request', async () => {
    // Arrange
    vi.useFakeTimers()
    const expiringUser = { ...currentUser, expires_at: Math.floor(Date.now() / 1000) + 4 }
    const manager = makeManager({ getUser: vi.fn().mockResolvedValue(expiringUser) })
    let resolveIdentity!: (value: CurrentIdentity) => void
    const api: IdentityClient = {
      current: vi.fn().mockReturnValue(new Promise<CurrentIdentity>((resolve) => { resolveIdentity = resolve })),
    }
    await renderProvider({ manager, identityClient: api })
    await act(async () => {})

    // Act
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
      resolveIdentity(identity)
      await Promise.resolve()
    })

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('anonymous')
    expect(manager.removeUser).toHaveBeenCalledOnce()
    expect(screen.queryByText(/branding:read/)).not.toBeInTheDocument()
  })

  it('keeps every permission hidden when the current-identity API denies access', async () => {
    // Arrange
    const manager = makeManager({ getUser: vi.fn().mockResolvedValue(currentUser) })
    const api = makeIdentityClient(new IdentityApiError(403))

    // Act
    await renderProvider({ manager, identityClient: api })

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent('error')
    expect(screen.getByText(/funciones administrativas siguen cerradas/i)).toBeVisible()
    expect(screen.queryByText(/branding:read/)).not.toBeInTheDocument()
    expect(manager.removeUser).not.toHaveBeenCalled()
  })

  it('processes the callback, strips its query parameters and restores only a known local view', async () => {
    // Arrange
    const manager = makeManager({ signinCallback: vi.fn().mockResolvedValue(currentUser) })
    window.history.replaceState(null, '', '/auth/callback?code=synthetic-code&state=opaque-state')
    const api = makeIdentityClient(identity)
    await renderProvider({ manager, identityClient: api })

    // Act + Assert
    expect(await screen.findByRole('status')).toHaveTextContent('authenticated:subject-42:branding:read')
    expect(manager.signinCallback).toHaveBeenCalledOnce()
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('#academia')
  })

  it('cleans a cancelled or invalid callback and leaves no partial session', async () => {
    // Arrange
    const manager = makeManager({ signinCallback: vi.fn().mockRejectedValue(new Error('provider details must stay private')) })
    window.history.replaceState(null, '', '/auth/callback?error=access_denied&state=opaque-state')
    await renderProvider({ manager })

    // Act + Assert
    expect(await screen.findByRole('status')).toHaveTextContent('error')
    expect(manager.removeUser).toHaveBeenCalled()
    expect(window.location.search).toBe('')
    expect(screen.queryByText(/provider details must stay private/)).not.toBeInTheDocument()
  })

  it('does not keep permissions after an unauthorized API response', async () => {
    // Arrange
    const manager = makeManager({ getUser: vi.fn().mockResolvedValue(currentUser) })
    const api = makeIdentityClient(new IdentityApiError(401))
    await renderProvider({ manager, identityClient: api })

    // Act + Assert
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('anonymous'))
    expect(manager.removeUser).toHaveBeenCalledOnce()
    expect(screen.queryByText(/branding:read/)).not.toBeInTheDocument()
  })

  it('clears a local session when sign-out completes', async () => {
    // Arrange
    const user = userEvent.setup()
    const manager = makeManager({ getUser: vi.fn().mockResolvedValue(currentUser) })
    await renderProvider({ manager })
    expect(await screen.findByRole('status')).toHaveTextContent('authenticated:subject-42:branding:read')

    // Act
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('anonymous'))
    expect(manager.signoutRedirect).toHaveBeenCalledOnce()
    expect(manager.removeUser).toHaveBeenCalled()
  })

  it('starts login with only a recognized internal return route', async () => {
    // Arrange
    const user = userEvent.setup()
    const manager = makeManager()
    window.history.replaceState(null, '', '/#academia')
    await renderProvider({ manager })
    await screen.findByRole('status')

    // Act
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    // Assert
    expect(manager.signinRedirect).toHaveBeenCalledWith({ state: { returnHash: '#academia' } })
  })

  it('retries permission discovery after a transient backend failure', async () => {
    // Arrange
    const user = userEvent.setup()
    const manager = makeManager({ getUser: vi.fn().mockResolvedValue(currentUser) })
    const api: IdentityClient = {
      current: vi.fn()
        .mockRejectedValueOnce(new Error('temporary network failure'))
        .mockResolvedValue(identity),
    }
    await renderProvider({ manager, identityClient: api })
    expect(await screen.findByRole('status')).toHaveTextContent('error')

    // Act
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent('authenticated:subject-42:branding:read')
    expect(api.current).toHaveBeenCalledTimes(2)
  })
})
