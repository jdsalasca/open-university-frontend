import { Component, lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { academicCatalogClient } from './features/academics/academicCatalogClient'
import type { AcademicCatalogClient, AcademicCatalogPermission } from './features/academics/contracts'
import type {
  AcademicOperationsClient,
  AcademicPeriodAuthorization,
  AcademicStructureAuthorization,
} from './features/academics/academicOperationsContracts'
import { useBranding } from './features/branding/useBranding'
import { spaceGuideClient as defaultSpaceGuideClient } from './features/spaces/spaceGuideClient'
import type { SpaceGuideClient } from './features/spaces/spaceGuideClient'
import { roleAccessClient as defaultRoleAccessClient } from './features/access/roleAccessClient'
import type { RoleAccessClient, RoleScopeKind } from './features/access/roleAccessContracts'
import type { RoleAccessScopeOption } from './features/access/RoleAccessPage'
import { IdentityProvider } from './features/identity/IdentityProvider'
import type { IdentitySessionManager } from './features/identity/IdentityProvider'
import { useIdentity } from './features/identity/identityContext'
import type { IdentityClient } from './features/identity/identityContracts'
import type { OidcConfigurationResult } from './features/identity/oidcConfiguration'
import './App.scss'

const AcademicCatalogPage = lazy(() =>
  import('./features/academics/AcademicCatalogPage')
    .then(({ AcademicCatalogPage: page }) => ({ default: page })),
)
const AcademicOperationsPage = lazy(() =>
  import('./features/academics/AcademicOperationsPage')
    .then(({ AcademicOperationsPage: page }) => ({ default: page })),
)
const AdmissionsCalendarPage = lazy(() =>
  import('./features/admissions/AdmissionsCalendarPage')
    .then(({ AdmissionsCalendarPage: page }) => ({ default: page })),
)
const SpaceGuidePage = lazy(() =>
  import('./features/spaces/SpaceGuidePage')
    .then(({ SpaceGuidePage: page }) => ({ default: page })),
)
const VisualIdentityCenter = lazy(() =>
  import('./features/branding/VisualIdentityCenter')
    .then(({ VisualIdentityCenter: page }) => ({ default: page })),
)
const RoleAccessPage = lazy(() =>
  import('./features/access/RoleAccessPage')
    .then(({ RoleAccessPage: page }) => ({ default: page })),
)

interface AppProps {
  catalogClient?: AcademicCatalogClient
  academicOperationsClient?: AcademicOperationsClient
  spaceGuideClient?: SpaceGuideClient
  oidcConfiguration?: OidcConfigurationResult
  identityManager?: IdentitySessionManager
  currentIdentityClient?: IdentityClient
  roleAccessClient?: RoleAccessClient
}

let academicOperationsClientPromise: Promise<AcademicOperationsClient> | null = null

function resolveAcademicOperationsClient(client?: AcademicOperationsClient): Promise<AcademicOperationsClient> {
  if (client) return Promise.resolve(client)
  academicOperationsClientPromise ??= import('./features/academics/academicOperationsClient')
    .then(({ academicOperationsClient: defaultClient }) => defaultClient)
    .catch((error: unknown) => {
      academicOperationsClientPromise = null
      throw error
    })
  return academicOperationsClientPromise
}

type ApplicationView = 'identity' | 'programs' | 'academia' | 'admissions' | 'spaces' | 'access'

const MODULE_SYMBOLS: Record<string, string> = {
  home: '⌂',
  students: '◎',
  programs: '▧',
  curricula: '▤',
  subjects: '◇',
  'academic-load': '◷',
  admissions: '◇',
  spaces: '⌖',
  'visual-identity': '✳',
}

export function App({
  catalogClient = academicCatalogClient,
  academicOperationsClient: operationsClient,
  spaceGuideClient: guideClient = defaultSpaceGuideClient,
  oidcConfiguration,
  identityManager,
  currentIdentityClient,
  roleAccessClient = defaultRoleAccessClient,
}: AppProps = {}) {
  return (
    <IdentityProvider
      configuration={oidcConfiguration}
      manager={identityManager}
      identityClient={currentIdentityClient}
    >
      <ApplicationShell catalogClient={catalogClient} operationsClient={operationsClient}
        spaceGuideClient={guideClient} roleAccessClient={roleAccessClient} />
    </IdentityProvider>
  )
}

function ApplicationShell({
  catalogClient,
  operationsClient,
  spaceGuideClient,
  roleAccessClient,
}: {
  catalogClient: AcademicCatalogClient
  operationsClient?: AcademicOperationsClient
  spaceGuideClient: SpaceGuideClient
  roleAccessClient: RoleAccessClient
}) {
  const { branding, status } = useBranding()
  const { state: identity, login, logout, retry, loginAvailable } = useIdentity()
  const [view, setView] = useState<ApplicationView>(() => readApplicationView())
  const [rejectedStructureAccessToken, setRejectedStructureAccessToken] = useState<string | null>(null)
  const [rejectedPeriodAccessToken, setRejectedPeriodAccessToken] = useState<string | null>(null)
  const [rejectedRoleAccessToken, setRejectedRoleAccessToken] = useState<string | null>(null)
  useEffect(() => {
    const onHashChange = () => setView(readApplicationView())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const modules = branding.modules.filter((module) => !['visual-identity', 'programs', 'admissions', 'spaces'].includes(module.key))
  const identityModule = branding.modules.find((module) => module.key === 'visual-identity')
  const programsModule = branding.modules.find((module) => module.key === 'programs')
  const admissionsModule = branding.modules.find((module) => module.key === 'admissions')
  const spacesModule = branding.modules.find((module) => module.key === 'spaces')
  const institutionLogo = branding.assets.logoDark
    ? `/assets/${branding.assets.logoDark}`
    : null
  const identityLabel = identityModule?.label ?? 'Identidad visual'
  const programsLabel = programsModule?.label ?? 'Programas'
  const admissionsLabel = admissionsModule?.label ?? 'Admisiones'
  const spacesLabel = spacesModule?.label ?? 'Guía de espacios'
  const isProgramsView = view === 'programs'
  const isAcademicOperationsView = view === 'academia'
  const isAdmissionsView = view === 'admissions'
  const isSpacesView = view === 'spaces'
  const isRoleAccessView = view === 'access'
  const isIdentityView = view === 'identity'
  const authenticatedIdentity = identity.status === 'authenticated' ? identity : null
  const hasInstitutionalSession = authenticatedIdentity !== null
  const canEndInstitutionalSession = hasInstitutionalSession || (identity.status === 'error' && loginAvailable)
  const catalogAuthorization = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      permissions: authenticatedIdentity.permissions.filter(isAcademicCatalogPermission),
    }
    : null
  const periodAuthorization: AcademicPeriodAuthorization | null = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('academic:period:read')
        && authenticatedIdentity.accessToken !== rejectedPeriodAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('academic:period:write')
        && authenticatedIdentity.accessToken !== rejectedPeriodAccessToken,
    }
    : null
  const structureAuthorization: AcademicStructureAuthorization | null = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('academic:structure:read')
        && authenticatedIdentity.accessToken !== rejectedStructureAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('academic:structure:write')
        && authenticatedIdentity.accessToken !== rejectedStructureAccessToken,
    }
    : null
  const roleAccessAuthorization = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('identity:roles:read')
        && authenticatedIdentity.accessToken !== rejectedRoleAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('identity:roles:write')
        && authenticatedIdentity.accessToken !== rejectedRoleAccessToken,
    }
    : null
  const revalidateRejectedStructureAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedStructureAccessToken(accessToken)
    await retry()
  }, [retry])
  const revalidateRejectedPeriodAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedPeriodAccessToken(accessToken)
    await retry()
  }, [retry])
  const revalidateRejectedRoleAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedRoleAccessToken(accessToken)
    await retry()
  }, [retry])
  const loadRoleScopeOptions = useCallback(async (
    kind: RoleScopeKind,
    signal?: AbortSignal,
  ): Promise<RoleAccessScopeOption[]> => {
    if (kind === 'SITE' || kind === 'FACULTY') {
      const structureClient = await resolveAcademicOperationsClient(operationsClient)
      const structure = await structureClient.getStructure(signal)
      if (kind === 'SITE') {
        return structure.sites
          .filter((site) => site.status === 'ACTIVE')
          .sort((left, right) => left.displayName.localeCompare(right.displayName, 'es'))
          .map((site) => ({ reference: site.id, label: `${site.code} · ${site.displayName}` }))
      }
      return structure.units
        .filter((unit) => unit.type === 'FACULTY' && unit.status === 'ACTIVE')
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'es'))
        .map((unit) => ({ reference: unit.id, label: `${unit.code} · ${unit.displayName}` }))
    }
    if (kind === 'PROGRAM') {
      const programs = await catalogClient.listPrograms(signal)
      return programs
        .sort((left, right) => left.programName.localeCompare(right.programName, 'es'))
        .map((program) => ({ reference: program.id, label: `${program.programCode} · ${program.programName}` }))
    }
    return []
  }, [catalogClient, operationsClient])
  const sessionLabel = identity.status === 'authenticated' ? 'Sesión institucional activa'
    : identity.status === 'loading' ? 'Verificando sesión…'
      : identity.status === 'unconfigured' ? 'Acceso institucional pendiente de configuración'
        : identity.status === 'error' ? identity.message
          : identity.reason === 'expired' ? 'Sesión vencida · Sin acceso'
            : 'Sin sesión institucional'
  const identityCenterKey = `${branding.revision}:${authenticatedIdentity?.subject ?? 'anonymous'}`
  const currentPageLabel = isRoleAccessView ? 'Accesos y perfiles'
    : isAdmissionsView ? admissionsLabel
    : isSpacesView ? spacesLabel
    : isProgramsView ? programsLabel
    : isAcademicOperationsView ? 'Estructura y periodos'
      : identityLabel

  return (
    <div className="platform-shell">
      <aside className="sidebar" aria-label="Navegación del sistema">
        <a className="brand-lockup" href="#inicio" aria-label={`${branding.institutionName}, inicio`}>
          {institutionLogo
            ? <img className="brand-lockup-logo" src={institutionLogo} alt="" />
            : <span className="brand-monogram" aria-hidden="true">U</span>}
          <span className="brand-lockup-copy">
            <strong>{branding.institutionName}</strong>
            <small>PLATAFORMA UNIVERSITARIA</small>
          </span>
        </a>

        <div className="sidebar-group">
          <p className="sidebar-caption">ESPACIO DE TRABAJO</p>
          <nav className="primary-nav" aria-label="Principal">
            <button className="nav-item" type="button" disabled title="El resumen estará disponible cuando el módulo se implemente">
              <span className="nav-glyph" aria-hidden="true">⌂</span>
              <span>Resumen</span>
            </button>
            <a className={`nav-item${isIdentityView ? ' active' : ''}`} href="#inicio" aria-current={isIdentityView ? 'page' : undefined}>
              <span className="nav-glyph" aria-hidden="true">✳</span>
              <span>{identityLabel}</span>
              {isIdentityView && <span className="nav-status" aria-hidden="true" />}
            </a>
            {roleAccessAuthorization?.canRead && (
              <a className={`nav-item${isRoleAccessView ? ' active' : ''}`} href="#accesos"
                aria-current={isRoleAccessView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">⌑</span>
                <span>Accesos y perfiles</span>
                {isRoleAccessView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
            <a className={`nav-item${isProgramsView ? ' active' : ''}`} href="#programas" aria-current={isProgramsView ? 'page' : undefined}>
              <span className="nav-glyph" aria-hidden="true">▧</span>
              <span>{programsLabel} · Vista previa</span>
              {isProgramsView && <span className="nav-status" aria-hidden="true" />}
            </a>
            {admissionsModule?.available && admissionsModule.visible && (
              <a className={`nav-item${isAdmissionsView ? ' active' : ''}`} href="#admisiones" aria-current={isAdmissionsView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">{MODULE_SYMBOLS.admissions}</span>
                <span>{admissionsLabel} · Información pública</span>
                {isAdmissionsView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
            {spacesModule?.available && spacesModule.visible && (
              <a className={`nav-item${isSpacesView ? ' active' : ''}`} href="#espacios" aria-current={isSpacesView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">{MODULE_SYMBOLS.spaces}</span>
                <span>{spacesLabel} · Guía pública</span>
                {isSpacesView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
            <a className={`nav-item${isAcademicOperationsView ? ' active' : ''}`} href="#academia" aria-current={isAcademicOperationsView ? 'page' : undefined}>
              <span className="nav-glyph" aria-hidden="true">◷</span>
              <span>Estructura y periodos · Vista previa</span>
              {isAcademicOperationsView && <span className="nav-status" aria-hidden="true" />}
            </a>
          </nav>
        </div>

        <div className="sidebar-group module-nav-group">
          <p className="sidebar-caption">VIDA UNIVERSITARIA</p>
          <nav className="primary-nav" aria-label="Módulos universitarios">
            {modules.map((module) => (
              <button className="nav-item subdued" type="button" disabled={!module.available} key={module.key}>
                <span className="nav-glyph" aria-hidden="true">{MODULE_SYMBOLS[module.key] ?? '◦'}</span>
                <span>{module.label}</span>
                {!module.available && <span className="coming-soon">Próximo</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <span className="environment-indicator" aria-hidden="true" />
          <span><strong>Entorno de desarrollo</strong><small>Sin datos estudiantiles reales</small></span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>{isProgramsView || isAcademicOperationsView || isAdmissionsView || isSpacesView ? 'Vida universitaria' : 'Administración'}</span><span aria-hidden="true">/</span><strong>{currentPageLabel}</strong></div>
          <div className="topbar-meta">
            <span className="autosave-indicator"><span aria-hidden="true" />{isRoleAccessView ? 'Control administrativo' : isAdmissionsView ? 'Consulta de admisiones' : isSpacesView ? 'Consulta de espacios' : isProgramsView ? 'Consulta de programas' : isAcademicOperationsView ? 'Consulta académica' : status === 'ready' ? 'Identidad sincronizada' : 'Identidad de respaldo'}</span>
            <span className="topbar-divider" aria-hidden="true" />
            {isRoleAccessView
              ? <span className="revision-chip">PERFILES · IDENTIDAD</span>
              : isAdmissionsView
              ? <span className="revision-chip">PREGRADO · 2027-I</span>
              : isSpacesView
                ? <span className="revision-chip">SEDES · CREAD</span>
              : isProgramsView
              ? <span className="revision-chip">PREGRADO · PRESENCIAL</span>
              : isAcademicOperationsView
                ? <span className="revision-chip">ESTRUCTURA · PERIODOS</span>
                : <span className="revision-chip">REV. {branding.revision.toString().padStart(2, '0')}</span>}
            <div className="identity-session-controls" aria-label="Sesión institucional">
              <span className={`identity-session-status is-${identity.status}`}
                role={identity.status === 'error' ? 'status' : undefined}
                aria-live="polite">
                {sessionLabel}
              </span>
              {identity.status === 'error' && (
                <button className="identity-session-button secondary" type="button" onClick={() => void retry()}>
                  Reintentar
                </button>
              )}
              <button
                className="identity-session-button"
                type="button"
                disabled={!loginAvailable || identity.status === 'loading'}
                onClick={() => void (canEndInstitutionalSession ? logout() : login())}
                title={!loginAvailable ? 'El inicio de sesión requiere configuración institucional aprobada' : undefined}
              >
                {canEndInstitutionalSession ? 'Cerrar sesión' : 'Iniciar sesión'}
              </button>
            </div>
          </div>
        </header>

        <main id={view === 'identity' ? 'inicio' : view === 'programs' ? 'programas' : isAdmissionsView ? 'admisiones' : isSpacesView ? 'espacios' : isRoleAccessView ? 'accesos' : 'academia'}
          className={isRoleAccessView ? 'role-access-page-content' : isAdmissionsView ? 'admissions-page-content' : isSpacesView ? 'spaces-page-content' : isProgramsView ? 'catalog-page-content' : isAcademicOperationsView ? 'academic-page-content' : 'page-content identity-page-content'}>
          {isIdentityView && status === 'fallback' && (
            <div className="status-banner" role="status">
              <span className="status-banner-icon" aria-hidden="true">i</span>
              <span><strong>Mostrando identidad oficial de respaldo.</strong> El servicio de configuración pública no está disponible por ahora.</span>
            </div>
          )}
          {isIdentityView && status === 'loading' && <p className="sr-only" role="status">Cargando identidad institucional…</p>}

          <ModuleLoadBoundary
            key={view}
            fallback={<ModuleLoadFailure label={isAdmissionsView
              ? 'la agenda de admisiones'
              : isSpacesView
                ? 'la guía de espacios'
                : isRoleAccessView
                  ? 'la consola de accesos'
              : isProgramsView || isAcademicOperationsView
                ? 'el módulo académico'
                : 'el centro de identidad visual'} />}
          >
            <Suspense fallback={<p className="module-loading" role="status" aria-live="polite">
              Cargando {isRoleAccessView ? 'consola de accesos' : isAdmissionsView ? 'agenda de admisiones' : isSpacesView ? 'guía de espacios' : isProgramsView || isAcademicOperationsView ? 'módulo académico' : 'centro de identidad visual'}…
            </p>}>
              {isRoleAccessView
                ? <RoleAccessPage client={roleAccessClient} authorization={roleAccessAuthorization}
                  loadScopeOptions={loadRoleScopeOptions} onAuthorizationRejected={revalidateRejectedRoleAccess} />
                : isProgramsView
                ? <AcademicCatalogPage client={catalogClient} authorization={catalogAuthorization} />
                : isAcademicOperationsView
                  ? <AcademicOperationsPage
                    client={operationsClient}
                    loadPrograms={catalogClient.listPrograms}
                    authorization={periodAuthorization}
                    structureAuthorization={structureAuthorization}
                    onStructureAuthorizationRejected={revalidateRejectedStructureAccess}
                    onPeriodAuthorizationRejected={revalidateRejectedPeriodAccess}
                  />
                  : isAdmissionsView
                    ? <AdmissionsCalendarPage />
                    : isSpacesView
                      ? <SpaceGuidePage client={spaceGuideClient} />
                    : <VisualIdentityCenter
                    key={identityCenterKey}
                    accessToken={authenticatedIdentity?.accessToken ?? null}
                    permissions={authenticatedIdentity?.permissions ?? []}
                    initialConfiguration={branding}
                  />}
            </Suspense>
          </ModuleLoadBoundary>

          <footer className="page-footer"><span>{branding.institutionName}</span><span>{isRoleAccessView
            ? roleAccessAuthorization?.canWrite
              ? 'Gestión de perfiles · permisos asignados y auditados en el servidor'
              : 'Consulta de perfiles · escritura requiere autorización institucional'
            : isAdmissionsView
            ? 'Calendario público de admisiones · Información de ACRA'
            : isSpacesView
              ? 'Guía pública de ubicaciones · Consulta la fuente oficial antes de desplazarte'
            : isProgramsView
            ? 'Vista previa de programas · Sin publicación institucional'
          : isAcademicOperationsView
              ? periodAuthorization?.canWrite
                ? 'Control del estado del periodo · Oferta y matrícula independientes'
                : 'Vista de consulta · Apertura y cierre requieren permiso institucional'
              : `Configuración pública · Rev. ${branding.revision}`}</span></footer>
        </main>
      </div>
    </div>
  )
}

export default App

function readApplicationView(): ApplicationView {
  if (typeof window === 'undefined') return 'identity'
  if (window.location.hash === '#programas') return 'programs'
  if (window.location.hash === '#academia') return 'academia'
  if (window.location.hash === '#admisiones') return 'admissions'
  if (window.location.hash === '#espacios') return 'spaces'
  if (window.location.hash === '#accesos') return 'access'
  return 'identity'
}

function isAcademicCatalogPermission(permission: string): permission is AcademicCatalogPermission {
  return permission === 'academic:catalog:read' || permission === 'academic:catalog:write'
}

class ModuleLoadBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function ModuleLoadFailure({ label }: { label: string }) {
  return (
    <div className="module-load-failure" role="alert">
      <p>No se pudo cargar {label}.</p>
      <button className="module-load-retry" type="button" onClick={() => window.location.reload()}>
        Recargar pantalla
      </button>
    </div>
  )
}
