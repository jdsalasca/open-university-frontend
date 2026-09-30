import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { BrandingProvider } from './features/branding/BrandingProvider'
import { DEFAULT_BRANDING } from './features/branding/contracts'
import type { AcademicCatalogClient } from './features/academics/contracts'
import type { AcademicOperationsClient, AcademicPeriod } from './features/academics/academicOperationsContracts'
import type { CurrentIdentity, IdentityClient } from './features/identity/identityContracts'
import type { IdentitySessionManager } from './features/identity/IdentityProvider'
import type { OidcConfigurationResult } from './features/identity/oidcConfiguration'

const oidcConfiguration: OidcConfigurationResult = {
  status: 'configured',
  settings: {
    authority: 'https://identity.example.edu.co',
    clientId: 'universiry-web',
    redirectUri: 'https://universiry.example.edu.co/auth/callback',
    postLogoutRedirectUri: 'https://universiry.example.edu.co/',
    scope: 'openid university-api',
  },
}

function authenticatedSessionManager(): IdentitySessionManager {
  return {
    getUser: async () => ({
      access_token: 'synthetic-access-token',
      expires_at: Math.floor(Date.now() / 1000) + 300,
    }),
    signinRedirect: async () => {},
    signinCallback: async () => undefined,
    signoutRedirect: async () => {},
    removeUser: async () => {},
  }
}

function identityClientWithPermissions(permissions: CurrentIdentity['permissions']): IdentityClient {
  return { current: async () => ({ subject: 'synthetic-subject', permissions }) }
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '#inicio')
})

function emptyAcademicCatalogClient(): AcademicCatalogClient {
  return {
    listPrograms: async () => [],
    listCurricula: async () => [],
    getPublishedCurriculum: async () => { throw new Error('Unexpected public curriculum detail') },
    listPublishedCurriculumEntries: async () => { throw new Error('Unexpected public curriculum page') },
    listDrafts: async () => ({ pageSize: 25, totalItems: 0, nextCursor: null, drafts: [] }),
    getCurriculum: async () => { throw new Error('Unexpected curriculum review') },
    previewCsv: async () => { throw new Error('Unexpected curriculum preview') },
    importCsv: async () => { throw new Error('Unexpected curriculum import') },
    publishCurriculum: async () => { throw new Error('Unexpected curriculum publication') },
  }
}

function emptyAcademicOperationsClient(): AcademicOperationsClient {
  return {
    getStructure: async () => ({
      units: [], organizationRelations: [], sites: [], siteRelations: [], programAffiliations: [],
    }),
    getOpenPeriods: async () => [],
    getAdminPeriods: async () => [],
    openPeriod: async () => { throw new Error('Unexpected period opening') },
    closePeriod: async () => { throw new Error('Unexpected period closing') },
  }
}

describe('App', () => {
  it('applies institution name, published logo, and module label to the application shell', async () => {
    // Arrange
    const branding = {
      ...DEFAULT_BRANDING,
      institutionName: 'Universidad de prueba institucional',
      assets: { ...DEFAULT_BRANDING.assets, logoDark: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301' },
      modules: DEFAULT_BRANDING.modules.map((module) => module.key === 'visual-identity'
        ? { ...module, label: 'Marca institucional' }
        : module),
    }
    render(
      <BrandingProvider loader={async () => branding}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const lockup = await screen.findByRole('link', { name: 'Universidad de prueba institucional, inicio' })

    // Assert
    expect(lockup.querySelector('img')).toHaveAttribute('src', '/assets/a7e7f06b-09a7-43db-a468-4c7b8ee3d301')
    expect(screen.getByRole('link', { name: 'Marca institucional' })).toBeVisible()
    expect(screen.getByText('Marca institucional', { selector: '.breadcrumbs strong' })).toBeVisible()
  })

  it('opens the visual identity control center and keeps publication closed without institutional access', async () => {
    // Arrange
    const branding = {
      ...DEFAULT_BRANDING,
      institutionName: 'Universidad Pedagógica y Tecnológica de Colombia',
    }
    render(
      <BrandingProvider loader={async () => branding}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const centerHeading = await screen.findByRole('heading', { name: 'Centro de identidad visual' })

    // Assert
    expect(centerHeading).toBeVisible()
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('La publicación requiere acceso institucional')
    expect(screen.getByRole('link', { name: 'Identidad visual' })).toBeVisible()
  })

  it('opens Programs as a keyboard accessible development preview while branding availability stays false', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App catalogClient={emptyAcademicCatalogClient()} />
      </BrandingProvider>,
    )

    // Act
    const programsLink = await screen.findByRole('link', { name: /programas.*vista previa/i })
    await user.tab()
    await user.tab()
    await user.tab()
    expect(programsLink).toHaveFocus()
    await user.keyboard('{Enter}')

    // Assert
    expect(await screen.findByRole('heading', { name: 'Programas de pregrado presencial' })).toBeVisible()
    expect(programsLink).toHaveAttribute('aria-current', 'page')
    expect(DEFAULT_BRANDING.modules.find((module) => module.key === 'programs')?.available).toBe(false)
    expect(screen.getByText(/Este módulo es una vista previa y no está habilitado para operación institucional/i)).toBeVisible()
  })

  it('opens academic structure and periods from the application navigation', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={emptyAcademicCatalogClient()}
          academicOperationsClient={emptyAcademicOperationsClient()}
        />
      </BrandingProvider>,
    )

    // Act
    const link = await screen.findByRole('link', { name: /estructura y periodos/i })
    await user.click(link)

    // Assert
    expect(await screen.findByRole('heading', { name: /estructura y periodos académicos/i })).toBeVisible()
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('uses backend branding permission without granting academic catalog controls', async () => {
    // Arrange
    const user = userEvent.setup()
    const catalogClient = {
      ...emptyAcademicCatalogClient(),
      listDrafts: vi.fn().mockResolvedValue({ pageSize: 25, totalItems: 0, nextCursor: null, drafts: [] }),
    }
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={catalogClient}
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['branding:write'])}
        />
      </BrandingProvider>,
    )

    // Act
    expect(await screen.findByText('Sesión institucional activa')).toBeVisible()
    await user.click(screen.getByRole('link', { name: /programas.*vista previa/i }))
    expect(await screen.findByRole('heading', { name: 'Programas de pregrado presencial' })).toBeVisible()

    // Assert
    expect(catalogClient.listDrafts).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/archivo CSV/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()

    // Act: the same permission remains scoped to the visual identity module.
    await user.click(screen.getByRole('link', { name: 'Identidad visual' }))
    const primaryColor = await screen.findByLabelText('Color HEX: Primario')
    await user.clear(primaryColor)
    await user.type(primaryColor, '#E0C037')

    // Assert
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeEnabled()
  })

  it('keeps sign-out available when the permission lookup fails', async () => {
    // Arrange
    const user = userEvent.setup()
    const manager = authenticatedSessionManager()
    manager.getUser = vi.fn().mockResolvedValue({
      access_token: 'synthetic-access-token',
      expires_at: Math.floor(Date.now() / 1000) + 300,
    })
    manager.signoutRedirect = vi.fn().mockResolvedValue(undefined)
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={oidcConfiguration}
          identityManager={manager}
          currentIdentityClient={{ current: vi.fn().mockRejectedValue(new Error('service unavailable')) }}
        />
      </BrandingProvider>,
    )

    // Act + Assert: verification errors keep permissions closed and preserve a way to end the local session.
    expect(await screen.findByText(/no fue posible verificar los permisos/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(manager.signoutRedirect).toHaveBeenCalledOnce()
    expect(await screen.findByText('Sin sesión institucional')).toBeVisible()
  })

  it('does not let an academic catalog permission publish visual identity changes', async () => {
    // Arrange
    const user = userEvent.setup()
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['academic:catalog:write'])}
        />
      </BrandingProvider>,
    )
    expect(await screen.findByText('Sesión institucional activa')).toBeVisible()

    // Act
    const primaryColor = screen.getByLabelText('Color HEX: Primario')
    await user.clear(primaryColor)
    await user.type(primaryColor, '#E0C037')

    // Assert
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/permiso de escritura/i)
  })

  it('passes only backend period permissions to explicit open and close controls', async () => {
    // Arrange
    const user = userEvent.setup()
    const period: AcademicPeriod = {
      id: 'fb750786-79cc-49cf-9814-0f1047c76ba4',
      code: '2026-2',
      kind: 'REGULAR',
      academicYear: 2026,
      sequenceNumber: 2,
      startsOn: '2026-07-15',
      endsOn: '2026-12-18',
      status: 'APPROVED',
      calendarRevisionId: '7ecfa4a1-52f6-4b56-9b3c-8fc0cebdc98f',
      calendarRevisionNumber: 1,
      approvalReference: 'Synthetic approved calendar',
      officialReference: 'Synthetic academic period',
      createdAt: '2026-06-15T10:00:00Z',
    }
    const operations = emptyAcademicOperationsClient()
    const getAdminPeriods = vi.fn().mockResolvedValue([period])
    const openPeriod = vi.fn().mockResolvedValue({ ...period, status: 'OPEN' })
    operations.getAdminPeriods = getAdminPeriods
    operations.openPeriod = openPeriod
    window.history.replaceState(null, '', '#academia')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={emptyAcademicCatalogClient()}
          academicOperationsClient={operations}
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['academic:period:read', 'academic:period:write'])}
        />
      </BrandingProvider>,
    )

    // Act
    await user.click(await screen.findByRole('button', { name: 'Abrir periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar apertura' }))

    // Assert
    expect(getAdminPeriods).toHaveBeenCalledWith('synthetic-access-token', expect.any(AbortSignal))
    expect(openPeriod).toHaveBeenCalledWith(period.id, 'synthetic-access-token')
  })
})
