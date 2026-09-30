import { useBranding } from './features/branding/useBranding'
import { VisualIdentityCenter } from './features/branding/VisualIdentityCenter'
import './App.scss'

const MODULE_SYMBOLS: Record<string, string> = {
  home: '⌂',
  students: '◎',
  programs: '▧',
  curricula: '▤',
  subjects: '◇',
  'academic-load': '◷',
  'visual-identity': '✳',
}

export function App() {
  const { branding, status } = useBranding()
  const modules = branding.modules.filter((module) => module.key !== 'visual-identity')
  const identityModule = branding.modules.find((module) => module.key === 'visual-identity')
  const institutionLogo = branding.assets.logoDark
    ? `/assets/${branding.assets.logoDark}`
    : null
  const identityLabel = identityModule?.label ?? 'Identidad visual'

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
            <a className="nav-item active" href="#inicio" aria-current="page">
              <span className="nav-glyph" aria-hidden="true">✳</span>
              <span>{identityLabel}</span>
              <span className="nav-status" aria-hidden="true" />
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
          <div className="breadcrumbs"><span>Administración</span><span aria-hidden="true">/</span><strong>{identityLabel}</strong></div>
          <div className="topbar-meta">
            <span className="autosave-indicator"><span aria-hidden="true" />{status === 'ready' ? 'Identidad sincronizada' : 'Identidad de respaldo'}</span>
            <span className="topbar-divider" aria-hidden="true" />
            <span className="revision-chip">REV. {branding.revision.toString().padStart(2, '0')}</span>
          </div>
        </header>

        <main id="inicio" className="page-content identity-page-content">
          {status === 'fallback' && (
            <div className="status-banner" role="status">
              <span className="status-banner-icon" aria-hidden="true">i</span>
              <span><strong>Mostrando identidad oficial de respaldo.</strong> El servicio de configuración pública no está disponible por ahora.</span>
            </div>
          )}
          {status === 'loading' && <p className="sr-only" role="status">Cargando identidad institucional…</p>}

          <VisualIdentityCenter key={branding.revision} accessToken={null} initialConfiguration={branding} />

          <footer className="page-footer"><span>{branding.institutionName}</span><span>Configuración pública · Rev. {branding.revision}</span></footer>
        </main>
      </div>
    </div>
  )
}

export default App
