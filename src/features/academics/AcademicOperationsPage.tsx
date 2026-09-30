import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { academicCatalogClient } from './academicCatalogClient'
import type { AcademicProgram } from './contracts'
import { academicOperationsClient } from './academicOperationsClient'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicPeriod,
  AcademicProgramAffiliation,
  AcademicSite,
  AcademicStructureSnapshot,
} from './academicOperationsContracts'
import './AcademicOperationsPage.scss'

type RequestState = 'loading' | 'ready' | 'error'
type RequestData = {
  structure: AcademicStructureSnapshot
  periods: AcademicPeriod[]
  programs: AcademicProgram[]
}

interface AcademicOperationsPageProps {
  client?: AcademicOperationsClient
  loadPrograms?: (signal?: AbortSignal) => Promise<AcademicProgram[]>
}

const defaultLoadPrograms = (signal?: AbortSignal) => academicCatalogClient.listPrograms(signal)

export function AcademicOperationsPage({
  client = academicOperationsClient,
  loadPrograms = defaultLoadPrograms,
}: AcademicOperationsPageProps) {
  const [requestState, setRequestState] = useState<RequestState>('loading')
  const [requestData, setRequestData] = useState<RequestData | null>(null)
  const [retryNumber, setRetryNumber] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      client.getStructure(controller.signal),
      client.getOpenPeriods(controller.signal),
      loadPrograms(controller.signal),
    ])
      .then(([structure, periods, programs]) => {
        setRequestData({ structure, periods, programs })
        setRequestState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setRequestState('error')
      })
    return () => controller.abort()
  }, [client, loadPrograms, retryNumber])

  const sortedUnits = useMemo(() => requestData
    ? [...requestData.structure.units].filter((unit) => unit.status === 'ACTIVE').sort(compareUnits)
    : [], [requestData])
  const sortedSites = useMemo(() => requestData
    ? [...requestData.structure.sites].filter((site) => site.status === 'ACTIVE').sort(compareSites)
    : [], [requestData])
  const sortedPeriods = useMemo(() => requestData
    ? [...requestData.periods].sort((first, second) => first.startsOn.localeCompare(second.startsOn)
      || first.kind.localeCompare(second.kind)
      || first.code.localeCompare(second.code))
    : [], [requestData])
  const programById = useMemo(() => new Map((requestData?.programs ?? []).map((program) => [program.id, program])), [requestData])

  function retry() {
    setRequestData(null)
    setRequestState('loading')
    setRetryNumber((current) => current + 1)
  }

  return (
    <div className="academic-operations">
      <section className="academic-operations-hero" aria-labelledby="academic-operations-title">
        <div className="academic-operations-hero-copy">
          <p className="academic-operations-eyebrow"><span aria-hidden="true" /> GESTIÓN ACADÉMICA <span aria-hidden="true">/</span> ORGANIZACIÓN Y PERIODOS</p>
          <h1 id="academic-operations-title">Estructura y periodos académicos</h1>
          <p>Una vista ordenada de las unidades académicas, sus sedes y los calendarios que están abiertos.</p>
          <span className="academic-preview-chip"><span aria-hidden="true">◌</span> Consulta de desarrollo · Sin datos personales</span>
        </div>
        <div className="academic-hero-mark" aria-hidden="true">
          <span className="academic-hero-ring academic-hero-ring-one" />
          <span className="academic-hero-ring academic-hero-ring-two" />
          <span className="academic-hero-emblem">A</span>
        </div>
        {requestState === 'ready' && requestData && (
          <div className="academic-operations-stats" aria-label="Resumen de la vista">
            <div><strong>{sortedUnits.length}</strong><span>unidades</span></div>
            <div><strong>{sortedSites.length}</strong><span>sedes activas</span></div>
            <div><strong>{requestData.programs.length}</strong><span>programas publicados</span></div>
            <div><strong>{sortedPeriods.length}</strong><span>periodos abiertos</span></div>
          </div>
        )}
      </section>

      <div className="academic-operations-note" role="note">
        <span aria-hidden="true">i</span>
        <p><strong>Vista de consulta.</strong> Crear unidades, adscribir programas y abrir periodos requiere una sesión institucional con permisos. El semestre indicado en una malla curricular es distinto del periodo académico real.</p>
      </div>

      {requestState === 'loading' && (
        <div className="academic-loading" role="status">
          <span className="academic-loading-mark" aria-hidden="true" />
          <span>Consultando estructura, programas y periodos abiertos…</span>
        </div>
      )}

      {requestState === 'error' && (
        <div className="academic-load-error" role="alert">
          <div><strong>No fue posible cargar la información académica.</strong><p>Comprueba la conexión y vuelve a intentarlo.</p></div>
          <button type="button" onClick={retry}>Intentar de nuevo</button>
        </div>
      )}

      {requestState === 'ready' && requestData && (
        <>
          <div className="academic-structure-grid">
            <section className="academic-panel academic-units-panel" aria-labelledby="academic-units-title">
              <header className="academic-panel-heading">
                <span className="academic-panel-icon academic-icon-units" aria-hidden="true">▤</span>
                <div><p className="academic-panel-kicker">EJE ORGANIZACIONAL</p><h2 id="academic-units-title">Facultades y unidades</h2></div>
                <span className="academic-panel-count">{sortedUnits.length.toString().padStart(2, '0')}</span>
              </header>
              {sortedUnits.length === 0
                ? <p className="academic-empty-state">No hay unidades cargadas en la estructura vigente.</p>
                : <OrganizationTree
                    units={sortedUnits}
                    relations={requestData.structure.organizationRelations}
                    affiliations={requestData.structure.programAffiliations}
                    programs={programById}
                    sites={sortedSites}
                  />}
              <p className="academic-panel-footnote">La jerarquía y el orden vienen de relaciones institucionales fechadas.</p>
            </section>

            <section className="academic-panel academic-sites-panel" aria-labelledby="academic-sites-title">
              <header className="academic-panel-heading">
                <span className="academic-panel-icon academic-icon-sites" aria-hidden="true">⌖</span>
                <div><p className="academic-panel-kicker">EJE TERRITORIAL</p><h2 id="academic-sites-title">Sedes y lugares</h2></div>
                <span className="academic-panel-count">{sortedSites.length.toString().padStart(2, '0')}</span>
              </header>
              {sortedSites.length === 0
                ? <p className="academic-empty-state">No hay sedes cargadas en la estructura vigente.</p>
                : <SiteTree sites={sortedSites} relations={requestData.structure.siteRelations} />}
              <p className="academic-panel-footnote">Las sedes se administran aparte de las facultades.</p>
            </section>
          </div>

          <section className="academic-panel academic-periods-panel" aria-labelledby="academic-periods-title">
            <header className="academic-panel-heading">
              <span className="academic-panel-icon academic-icon-periods" aria-hidden="true">◷</span>
              <div><p className="academic-panel-kicker">CALENDARIO VIGENTE</p><h2 id="academic-periods-title">Periodos académicos abiertos</h2></div>
              <span className="academic-open-badge"><span aria-hidden="true" /> Solo periodos abiertos</span>
            </header>
            {sortedPeriods.length === 0
              ? <p className="academic-empty-state">No hay periodos académicos abiertos para consulta.</p>
              : <ul className="academic-period-list">
                  {sortedPeriods.map((period) => <PeriodCard key={period.id} period={period} />)}
                </ul>}
          </section>
        </>
      )}
    </div>
  )
}

function OrganizationTree({
  units,
  relations,
  affiliations,
  programs,
  sites,
}: {
  units: AcademicOrganizationUnit[]
  relations: AcademicStructureSnapshot['organizationRelations']
  affiliations: AcademicProgramAffiliation[]
  programs: Map<string, AcademicProgram>
  sites: AcademicSite[]
}) {
  const unitById = new Map(units.map((unit) => [unit.id, unit]))
  const siteById = new Map(sites.map((site) => [site.id, site]))
  const childrenByParent = new Map<string, AcademicOrganizationUnit[]>()
  const childIds = new Set<string>()
  for (const relation of relations) {
    const parent = unitById.get(relation.parentUnitId)
    const child = unitById.get(relation.childUnitId)
    if (!parent || !child) continue
    childrenByParent.set(parent.id, [...(childrenByParent.get(parent.id) ?? []), child])
    childIds.add(child.id)
  }
  childrenByParent.forEach((children) => children.sort(compareUnits))
  let roots = units.filter((unit) => !childIds.has(unit.id))
  if (roots.length === 0) roots = units
  const attachedProgramIds = new Set(affiliations
    .filter((affiliation) => unitById.has(affiliation.organizationUnitId))
    .map((affiliation) => affiliation.programId))
  const visiblePrograms = [...programs.values()].sort((first, second) => first.programCode.localeCompare(second.programCode)
    || first.programName.localeCompare(second.programName))
  const unattachedPrograms = visiblePrograms.filter((program) => !attachedProgramIds.has(program.id))

  function renderUnit(unit: AcademicOrganizationUnit, ancestors: ReadonlySet<string>): ReactNode {
    if (ancestors.has(unit.id)) return null
    const nextAncestors = new Set(ancestors).add(unit.id)
    const children = childrenByParent.get(unit.id) ?? []
    const unitPrograms = affiliations
      .filter((affiliation) => affiliation.organizationUnitId === unit.id)
      .map((affiliation) => ({ affiliation, program: programs.get(affiliation.programId) }))
      .filter((entry): entry is { affiliation: AcademicProgramAffiliation; program: AcademicProgram } => entry.program !== undefined)
      .sort((first, second) => first.affiliation.displayOrder - second.affiliation.displayOrder
        || first.program.programCode.localeCompare(second.program.programCode)
        || first.program.programName.localeCompare(second.program.programName))
    return (
      <li className="academic-tree-node" key={unit.id}>
        <div className="academic-unit-row">
          <span className={'academic-unit-type academic-unit-type-' + unit.type.toLocaleLowerCase('en-US')}>{labelUnitType(unit.type)}</span>
          <div className="academic-unit-copy"><strong>{unit.displayName}</strong><small>{unit.code}</small></div>
          <span className="academic-sort-order">{String(unit.displayOrder).padStart(2, '0')}</span>
        </div>
        {(children.length > 0 || unitPrograms.length > 0) && (
          <ul className="academic-tree-children">
            {unitPrograms.map(({ affiliation, program }) => (
              <ProgramNode key={affiliation.id} program={program} site={siteById.get(affiliation.siteId)} />
            ))}
            {children.map((child) => renderUnit(child, nextAncestors))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="academic-tree-wrap">
      <ul className="academic-tree" aria-label="Jerarquía académica">
        {roots.map((root) => renderUnit(root, new Set()))}
      </ul>
      {unattachedPrograms.length > 0 && (
        <div className="academic-unattached-programs">
          <p>Programas publicados pendientes de adscripción</p>
          <ul>{unattachedPrograms.map((program) => <ProgramNode key={program.id} program={program} />)}</ul>
        </div>
      )}
    </div>
  )
}

function ProgramNode({ program, site }: { program: AcademicProgram; site?: AcademicSite }) {
  return (
    <li className="academic-program-node">
      <span className="academic-program-mark" aria-hidden="true">↳</span>
      <span className="academic-program-code">{program.programCode}</span>
      <span>{program.programName}</span>
      <small>{site ? `${site.displayName} · ${site.code}` : 'Adscripción territorial pendiente'}</small>
    </li>
  )
}

function SiteTree({
  sites,
  relations,
}: {
  sites: AcademicSite[]
  relations: AcademicStructureSnapshot['siteRelations']
}) {
  const byId = new Map(sites.map((site) => [site.id, site]))
  const childrenByParent = new Map<string, AcademicSite[]>()
  const childIds = new Set<string>()
  for (const relation of relations) {
    const parent = byId.get(relation.parentSiteId)
    const child = byId.get(relation.childSiteId)
    if (!parent || !child) continue
    childrenByParent.set(parent.id, [...(childrenByParent.get(parent.id) ?? []), child])
    childIds.add(child.id)
  }
  childrenByParent.forEach((children) => children.sort(compareSites))
  let roots = sites.filter((site) => !childIds.has(site.id))
  if (roots.length === 0) roots = sites

  function renderSite(site: AcademicSite, ancestors: ReadonlySet<string>): ReactNode {
    if (ancestors.has(site.id)) return null
    const nextAncestors = new Set(ancestors).add(site.id)
    const children = childrenByParent.get(site.id) ?? []
    return (
      <li className="academic-site-node" key={site.id}>
        <div className="academic-site-row">
          <span className="academic-site-pin" aria-hidden="true">⌖</span>
          <div><strong>{site.displayName}</strong><small>{site.code} · {labelSiteType(site.type)}</small></div>
          <span className="academic-sort-order">{String(site.displayOrder).padStart(2, '0')}</span>
        </div>
        {children.length > 0 && <ul>{children.map((child) => renderSite(child, nextAncestors))}</ul>}
      </li>
    )
  }

  return <ul className="academic-site-tree" aria-label="Jerarquía de sedes">{roots.map((root) => renderSite(root, new Set()))}</ul>
}

function PeriodCard({ period }: { period: AcademicPeriod }) {
  return (
    <li className="academic-period-card">
      <div className="academic-period-date"><span>{period.startsOn.slice(0, 4)}</span><strong>{period.startsOn.slice(5)}</strong></div>
      <div className="academic-period-copy">
        <div className="academic-period-title-row">
          <h3>{period.kind === 'REGULAR' ? 'Período regular' : 'Intersemestral'}</h3>
          <span className="academic-period-state">Abierto</span>
        </div>
        <p><strong>{period.code}</strong><span aria-hidden="true">·</span> {formatDate(period.startsOn)} – {formatDate(period.endsOn)}</p>
        <small>{period.officialReference} · Calendario rev. {period.calendarRevisionNumber}</small>
      </div>
      <span className="academic-period-chevron" aria-hidden="true">↗</span>
    </li>
  )
}

function compareUnits(first: AcademicOrganizationUnit, second: AcademicOrganizationUnit) {
  return first.displayOrder - second.displayOrder || first.code.localeCompare(second.code)
}

function compareSites(first: AcademicSite, second: AcademicSite) {
  return first.displayOrder - second.displayOrder || first.code.localeCompare(second.code)
}

function labelUnitType(type: AcademicOrganizationUnit['type']) {
  return type === 'FACULTY' ? 'Facultad' : type === 'SCHOOL' ? 'Escuela' : 'Unidad académica'
}

function labelSiteType(type: AcademicSite['type']) {
  return type === 'CENTRAL' ? 'Central'
    : type === 'SECCIONAL' ? 'Seccional'
      : type === 'REGIONAL' ? 'Regional'
        : type === 'CREAD' ? 'CREAD'
          : type === 'CAMPUS' ? 'Campus'
            : 'Otro lugar'
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year!, month! - 1, day!)))
}
