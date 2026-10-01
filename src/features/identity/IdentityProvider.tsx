import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { IdentityClient } from './identityContracts'
import { identityClient as defaultIdentityClient, IdentityApiError } from './identityClient'
import type { OidcConfigurationResult, OidcSettings } from './oidcConfiguration'
import { parseOidcConfiguration } from './oidcConfiguration'
import { IdentityContext } from './identityContext'
import type { IdentitySessionState } from './identityContext'

export interface IdentitySessionUser {
  access_token: string
  expires_at?: number
  expired?: boolean
  state?: unknown
}

export interface IdentitySessionManager {
  getUser(): Promise<IdentitySessionUser | null>
  signinRedirect(args: { state: unknown }): Promise<void>
  signinCallback(): Promise<IdentitySessionUser | undefined>
  signoutRedirect(): Promise<void>
  removeUser(): Promise<void>
}

interface IdentityProviderProps extends PropsWithChildren {
  configuration?: OidcConfigurationResult
  manager?: IdentitySessionManager
  identityClient?: IdentityClient
}

const KNOWN_RETURN_HASHES = new Set(['#inicio', '#programas', '#academia'])
const DEFAULT_CONFIGURATION: OidcConfigurationResult = typeof window === 'undefined'
  ? { status: 'unconfigured' }
  : parseOidcConfiguration({
    VITE_OIDC_AUTHORITY: import.meta.env.VITE_OIDC_AUTHORITY,
    VITE_OIDC_CLIENT_ID: import.meta.env.VITE_OIDC_CLIENT_ID,
    VITE_OIDC_REDIRECT_URI: import.meta.env.VITE_OIDC_REDIRECT_URI,
    VITE_OIDC_POST_LOGOUT_REDIRECT_URI: import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
    VITE_OIDC_SCOPE: import.meta.env.VITE_OIDC_SCOPE,
  }, window.location.origin)

export function IdentityProvider({
  children,
  configuration = DEFAULT_CONFIGURATION,
  manager: providedManager,
  identityClient = defaultIdentityClient,
}: IdentityProviderProps) {
  const manager = useMemo(() => {
    if (configuration.status !== 'configured') return null
    return providedManager ?? createIdentitySessionManager(configuration.settings)
  }, [configuration, providedManager])
  const initialState = stateForConfiguration(configuration)
  const [state, setState] = useState<IdentitySessionState>(initialState)
  const initializationRef = useRef<Promise<IdentitySessionState> | null>(null)
  const activeRequestRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)

  const startInitialization = useCallback(() => {
    if (!manager || configuration.status !== 'configured') {
      return Promise.resolve(stateForConfiguration(configuration))
    }
    const request = new AbortController()
    activeRequestRef.current = request
    const pending = initializeIdentitySession(manager, identityClient, configuration.settings, request.signal)
      .finally(() => {
        if (activeRequestRef.current === request) activeRequestRef.current = null
      })
    initializationRef.current = pending
    return pending
  }, [configuration, identityClient, manager])

  useEffect(() => {
    let active = true
    if (!manager || configuration.status !== 'configured') {
      return () => { active = false }
    }

    const pending = initializationRef.current ?? startInitialization()
    const generation = ++generationRef.current
    void pending.then((nextState) => {
      if (active && generationRef.current === generation) setState(nextState)
    })
    return () => { active = false }
  }, [configuration, manager, startInitialization])

  useEffect(() => {
    if (!manager || state.status !== 'authenticated') return
    let timer: number
    const expireWhenDue = () => {
      const remainingMilliseconds = state.expiresAt * 1000 - Date.now()
      if (remainingMilliseconds > 0) {
        timer = window.setTimeout(expireWhenDue, Math.min(remainingMilliseconds, 2_147_483_647))
        return
      }

      generationRef.current += 1
      activeRequestRef.current?.abort()
      void removeCurrentUser(manager)
      setState((current) => current.status === 'authenticated'
        && current.accessToken === state.accessToken
        ? { status: 'anonymous', reason: 'expired' }
        : current)
    }
    timer = window.setTimeout(expireWhenDue,
      Math.min(Math.max(0, state.expiresAt * 1000 - Date.now()), 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [manager, state])

  const login = useCallback(async () => {
    if (!manager || configuration.status !== 'configured') return
    activeRequestRef.current?.abort()
    generationRef.current += 1
    setState({ status: 'loading' })
    try {
      await manager.signinRedirect({ state: { returnHash: knownReturnHash(window.location.hash) } })
    } catch {
      await removeCurrentUser(manager)
      setState({ status: 'error', message: 'No se pudo iniciar la autenticación institucional.' })
    }
  }, [configuration, manager])

  const logout = useCallback(async () => {
    if (!manager) {
      setState({ status: 'anonymous', reason: 'signed-out' })
      return
    }
    activeRequestRef.current?.abort()
    generationRef.current += 1
    try {
      await manager.signoutRedirect()
      await manager.removeUser()
      setState({ status: 'anonymous', reason: 'signed-out' })
    } catch {
      await removeCurrentUser(manager)
      setState({ status: 'error', message: 'La sesión local terminó; el proveedor no confirmó el cierre global.' })
    }
  }, [manager])

  const retry = useCallback(async () => {
    if (!manager || configuration.status !== 'configured') return
    activeRequestRef.current?.abort()
    generationRef.current += 1
    setState({ status: 'loading' })
    const pending = startInitialization()
    const generation = generationRef.current
    const nextState = await pending
    if (generationRef.current === generation) setState(nextState)
  }, [configuration, manager, startInitialization])

  const visibleState = manager && configuration.status === 'configured'
    ? state
    : stateForConfiguration(configuration)
  const loginAvailable = configuration.status === 'configured'
  const value = useMemo(() => ({ state: visibleState, loginAvailable, login, logout, retry }),
    [login, loginAvailable, logout, retry, visibleState])
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
}

function createIdentitySessionManager(settings: OidcSettings): IdentitySessionManager {
  let managerPromise: Promise<IdentitySessionManager> | undefined
  const loadManager = () => {
    if (!managerPromise) {
      managerPromise = import('./identitySessionManager')
        .then(({ createOidcUserManager }) => {
          const manager = createOidcUserManager(settings)
          return {
            getUser: () => manager.getUser(),
            signinRedirect: (args: { state: unknown }) => manager.signinRedirect(args),
            signinCallback: () => manager.signinCallback(),
            signoutRedirect: () => manager.signoutRedirect(),
            removeUser: () => manager.removeUser(),
          }
        })
        .catch((error: unknown) => {
          managerPromise = undefined
          throw error
        })
    }
    return managerPromise
  }

  return {
    getUser: async () => (await loadManager()).getUser(),
    signinRedirect: async (args) => (await loadManager()).signinRedirect(args),
    signinCallback: async () => (await loadManager()).signinCallback(),
    signoutRedirect: async () => (await loadManager()).signoutRedirect(),
    removeUser: async () => (await loadManager()).removeUser(),
  }
}

async function initializeIdentitySession(
  manager: IdentitySessionManager,
  client: IdentityClient,
  settings: OidcSettings,
  signal: AbortSignal,
): Promise<IdentitySessionState> {
  let user: IdentitySessionUser | undefined | null
  if (isCallbackResponse(settings.redirectUri)) {
    try {
      user = await manager.signinCallback()
      replaceCallbackUrl(user ? stateReturnHash(user.state) : '')
    } catch {
      replaceCallbackUrl('')
      await removeCurrentUser(manager)
      return { status: 'error', message: 'No se pudo completar el retorno de autenticación institucional.' }
    }
    if (!user) {
      await removeCurrentUser(manager)
      return { status: 'anonymous', reason: 'signed-out' }
    }
  } else {
    try {
      user = await manager.getUser()
    } catch {
      await removeCurrentUser(manager)
      return { status: 'error', message: 'No se pudo recuperar la sesión de esta pestaña.' }
    }
  }

  if (!user) return { status: 'anonymous', reason: 'signed-out' }
  if (!isUsableUser(user)) {
    await removeCurrentUser(manager)
    return { status: 'anonymous', reason: 'expired' }
  }

  try {
    const current = await client.current(user.access_token, signal)
    if (!isUsableUser(user)) {
      await removeCurrentUser(manager)
      return { status: 'anonymous', reason: 'expired' }
    }
    return {
      status: 'authenticated',
      accessToken: user.access_token,
      expiresAt: user.expires_at!,
      subject: current.subject,
      permissions: [...current.permissions],
    }
  } catch (error) {
    if (error instanceof IdentityApiError && error.status === 401) {
      await removeCurrentUser(manager)
      return { status: 'anonymous', reason: 'expired' }
    }
    return { status: 'error', message: 'No fue posible verificar los permisos. Las funciones administrativas siguen cerradas.' }
  }
}

function stateForConfiguration(configuration: OidcConfigurationResult): IdentitySessionState {
  if (configuration.status === 'unconfigured') return { status: 'unconfigured' }
  if (configuration.status === 'invalid') {
    return { status: 'error', message: 'La configuración de autenticación institucional es inválida.' }
  }
  return { status: 'loading' }
}

function isUsableUser(user: IdentitySessionUser): boolean {
  return typeof user.access_token === 'string'
    && user.access_token.trim().length > 0
    && typeof user.expires_at === 'number'
    && Number.isFinite(user.expires_at)
    && user.expires_at > Date.now() / 1000
    && user.expired !== true
}

function isCallbackResponse(redirectUri: string): boolean {
  const callbackPath = new URL(redirectUri).pathname
  if (window.location.pathname !== callbackPath) return false
  const parameters = new URLSearchParams(window.location.search)
  return parameters.has('code') || parameters.has('state') || parameters.has('error')
}

function stateReturnHash(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('returnHash' in state)) return '#inicio'
  const returnHash = state.returnHash
  return typeof returnHash === 'string' && KNOWN_RETURN_HASHES.has(returnHash) ? returnHash : '#inicio'
}

function knownReturnHash(hash: string): string {
  return KNOWN_RETURN_HASHES.has(hash) ? hash : '#inicio'
}

function replaceCallbackUrl(hash: string): void {
  const safeHash = KNOWN_RETURN_HASHES.has(hash) ? hash : ''
  window.history.replaceState(null, document.title, `${window.location.origin}/${safeHash}`)
}

async function removeCurrentUser(manager: IdentitySessionManager): Promise<void> {
  try {
    await manager.removeUser()
  } catch {
    // Local state still fails closed if the storage adapter is unavailable.
  }
}

