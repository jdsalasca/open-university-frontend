import { useBranding } from './features/branding/useBranding'
import './App.css'

const COLOR_LABELS = [
  ['primary', 'Primario'],
  ['ink', 'Tinta'],
  ['surface', 'Superficie'],
  ['text', 'Texto'],
  ['accent', 'Acento'],
  ['focus', 'Foco'],
] as const

const MODULE_SYMBOLS: Record<string, string> = {
  home: '⌂',
  students: '◎',
  programs: '▧',
  curricula: '▤',
  subjects: '◇',
  'academic-load': '◷',
  'visual-identity': '✳',
}

function App() {
  const { branding, status } = useBranding()
  const visibleModules = branding.modules.filter((module) => module.visible && module.available)
  const availableLater = branding.modules.filter((module) => !module.available).length
  const firstBanner = branding.banners[0]

  return (
    <div className="platform-shell">
      <aside className="sidebar" aria-label="Navegación del sistema">
        <a className="brand-lockup" href="#inicio" aria-label={`${branding.institutionName}, inicio`}>
          <span className="brand-monogram" aria-hidden="true">U</span>
          <span className="brand-lockup-copy">
            <strong>UPTC</strong>
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
              <span>Identidad visual</span>
              <span className="nav-status" aria-hidden="true" />
            </a>
          </nav>
        </div>

        <div className="sidebar-group module-nav-group">
          <p className="sidebar-caption">VIDA UNIVERSITARIA</p>
          <nav className="primary-nav" aria-label="Módulos universitarios">
            {branding.modules.filter((module) => module.key !== 'visual-identity').map((module) => (
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
          <div className="breadcrumbs"><span>Administración</span><span aria-hidden="true">/</span><strong>Identidad visual</strong></div>
          <div className="topbar-meta">
            <span className="autosave-indicator"><span aria-hidden="true" />{status === 'ready' ? 'Identidad sincronizada' : 'Identidad institucional'}</span>
            <span className="topbar-divider" aria-hidden="true" />
            <span className="revision-chip">REV. {branding.revision.toString().padStart(2, '0')}</span>
          </div>
        </header>

        <main id="inicio" className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" />CENTRO DE IDENTIDAD VISUAL</p>
              <h1>La identidad de tu institución, en un solo lugar.</h1>
              <p className="page-intro">Administra cómo se presenta la UPTC en cada experiencia digital de su comunidad.</p>
            </div>
            <div className="publish-area">
              <button className="publish-button" type="button" disabled title="La autenticación institucional todavía no está conectada">
                <span aria-hidden="true">↗</span> Publicar cambios
              </button>
              <span>La publicación requiere acceso institucional</span>
            </div>
          </div>

          {status === 'fallback' && (
            <div className="status-banner" role="status">
              <span className="status-banner-icon" aria-hidden="true">i</span>
              <span><strong>Mostrando identidad oficial de respaldo.</strong> El servicio de configuración no está disponible; puedes continuar consultando el espacio.</span>
            </div>
          )}
          {status === 'loading' && <p className="sr-only" role="status">Cargando identidad institucional…</p>}

          <section className="brand-hero" aria-labelledby="hero-title">
            <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
            <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
            <div className="hero-content">
              <div className="hero-label"><span aria-hidden="true">✦</span> PERFIL INSTITUCIONAL</div>
              <h2 id="hero-title">{branding.institutionName}</h2>
              <p>Una identidad sólida conecta cada servicio con las personas que hacen parte de la universidad.</p>
              <div className="hero-meta">
                <span className="published-dot" aria-hidden="true" />
                <span>{status === 'fallback' ? 'Identidad oficial de respaldo' : 'Identidad pública activa'}</span>
                <span className="hero-meta-separator" aria-hidden="true">·</span>
                <span>{visibleModules.length} secciones visibles</span>
              </div>
            </div>
            <div className="hero-brand-preview" aria-label="Vista previa de la marca">
              {branding.assets.logoLight ? (
                <img className="hero-institution-logo" src={`/assets/${branding.assets.logoLight}`} alt={`Logo institucional de ${branding.institutionName}`} />
              ) : (
                <div className="hero-seal" aria-hidden="true"><i /></div>
              )}
              <span className="preview-rule" />
              <span className="preview-caption">SISTEMA DE IDENTIDAD</span>
              <span className="preview-name">{branding.institutionName.split(' ').slice(0, 4).join(' ')}</span>
            </div>
          </section>

          <div className="section-heading">
            <div><p className="eyebrow">CONFIGURACIÓN ACTUAL</p><h2>Elementos de marca</h2></div>
            <span className="read-only-badge"><span aria-hidden="true">◉</span> Vista de solo lectura</span>
          </div>

          <div className="dashboard-grid">
            <section className="surface-card palette-card" aria-labelledby="palette-title">
              <div className="card-heading">
                <div className="card-icon palette-icon" aria-hidden="true">◧</div>
                <div><h3 id="palette-title">Paleta institucional</h3><p>Los tonos que dan forma a la experiencia.</p></div>
                <span className="card-arrow" aria-hidden="true">↗</span>
              </div>
              <div className="palette-grid">
                {COLOR_LABELS.map(([key, label]) => (
                  <div className="swatch-item" key={key}>
                    <span className="color-swatch" style={{ backgroundColor: branding.colors[key] }} aria-label={`${label}: ${branding.colors[key]}`} />
                    <span className="swatch-label">{label}<code>{branding.colors[key]}</code></span>
                  </div>
                ))}
              </div>
              <div className="card-footnote"><span className="contrast-icon" aria-hidden="true">Aa</span><span>Contraste validado para lectura institucional</span><span className="check-mark" aria-hidden="true">✓</span></div>
            </section>

            <section className="surface-card modules-card" aria-labelledby="modules-title">
              <div className="card-heading">
                <div className="card-icon modules-icon" aria-hidden="true">☷</div>
                <div><h3 id="modules-title">Nombres de módulos</h3><p>La navegación de la comunidad universitaria.</p></div>
                <span className="card-arrow" aria-hidden="true">↗</span>
              </div>
              <div className="module-preview-list">
                {visibleModules.map((module) => (
                  <div className="module-preview-row" key={module.key}>
                    <span className="module-mini-glyph" aria-hidden="true">{MODULE_SYMBOLS[module.key] ?? '◦'}</span>
                    <span>{module.label}</span><span className="module-row-arrow" aria-hidden="true">→</span>
                  </div>
                ))}
              </div>
              <div className="card-footnote"><span className="module-count">{availableLater}</span><span>módulos pendientes de habilitación</span></div>
            </section>

            <section className="surface-card assets-card" aria-labelledby="assets-title">
              <div className="card-heading">
                <div className="card-icon assets-icon" aria-hidden="true">▧</div>
                <div><h3 id="assets-title">Activos institucionales</h3><p>Logos, íconos y piezas gráficas.</p></div>
                <span className="card-arrow" aria-hidden="true">↗</span>
              </div>
              <div className="asset-status-list">
                <div><span className="asset-status-icon" aria-hidden="true">U</span><span><strong>Logo principal</strong><small>{branding.assets.logoLight ? 'Publicado' : 'Pendiente de configurar'}</small></span><span className={branding.assets.logoLight ? 'asset-state on' : 'asset-state'}>{branding.assets.logoLight ? 'Activo' : 'Vacío'}</span></div>
                <div><span className="asset-status-icon muted" aria-hidden="true">▣</span><span><strong>Favicon</strong><small>{branding.assets.favicon ? 'Publicado' : 'Pendiente de configurar'}</small></span><span className={branding.assets.favicon ? 'asset-state on' : 'asset-state'}>{branding.assets.favicon ? 'Activo' : 'Vacío'}</span></div>
                <div><span className="asset-status-icon banner" aria-hidden="true">▱</span><span><strong>Banners vigentes</strong><small>{firstBanner ? firstBanner.title : 'Sin piezas publicadas'}</small></span><span className="asset-state">{branding.banners.length.toString().padStart(2, '0')}</span></div>
              </div>
            </section>

            <section className="surface-card portal-card" aria-labelledby="portal-title">
              <div className="portal-card-top"><div><p className="eyebrow">PREVISUALIZACIÓN</p><h3 id="portal-title">Así se verá tu portal</h3></div><span className="preview-live-tag"><span /> EN VIVO</span></div>
              <div className="mini-portal" style={{ borderColor: branding.colors.primary }}>
                <div className="mini-portal-header">
                  <span className="mini-portal-mark" style={{ backgroundColor: branding.colors.primary }} aria-hidden="true">U</span>
                  <span className="mini-portal-name">{branding.institutionName}</span>
                  <span className="mini-portal-menu" aria-hidden="true">☰</span>
                </div>
                <div className="mini-portal-body">
                  <div className="mini-portal-copy"><span>BIENVENIDA A LA UPTC</span><strong>El futuro se construye<br />en comunidad.</strong><i style={{ backgroundColor: branding.colors.primary }} /></div>
                  <div className="mini-portal-art" style={{ backgroundColor: branding.colors.primary }}>
                    {firstBanner ? <img src={`/assets/${firstBanner.assetId}`} alt={firstBanner.altText} /> : <span aria-hidden="true">✦</span>}
                  </div>
                </div>
                <div className="mini-portal-footer"><span /><span /><span /><span /></div>
              </div>
              <p className="preview-note">Previsualización con configuración pública vigente.</p>
            </section>
          </div>

          <footer className="page-footer"><span>PLATAFORMA INSTITUCIONAL UPTC</span><span>Base visual documentada · Rev. {branding.revision}</span></footer>
        </main>
      </div>
    </div>
  )
}

export default App
