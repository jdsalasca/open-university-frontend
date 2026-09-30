import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { academicCatalogClient } from './academicCatalogClient'
import type { AcademicProgram } from './contracts'
import { academicOperationsClient } from './academicOperationsClient'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicPeriod,
  AcademicPeriodAuthorization,
  AcademicPeriodStatus,
  AcademicProgramAffiliation,
  AcademicSite,
  AcademicStructureSnapshot,
} from './academicOperationsContracts'
import './AcademicOperationsPage.scss'

type RequestState = 'loading' | 'ready' | 'error'
type RequestData = {
  structure: AcademicStructureSnapshot
  periods: AcademicPeriod[]
  periodSource: 'public' | 'admin'
  programs: AcademicProgram[]
}

interface AcademicOperationsPageProps {
  client?: AcademicOperationsClient
  loadPrograms?: (signal?: AbortSignal) => Promise<AcademicProgram[]>
  authorization?: AcademicPeriodAuthorization | null
}

const defaultLoadPrograms = (signal?: AbortSignal) => academicCatalogClient.listPrograms(signal)

export function AcademicOperationsPage({
  client = academicOperationsClient,
  loadPrograms = defaultLoadPrograms,
  authorization = null,
}: AcademicOperationsPageProps) {
  const [requestState, setRequestState] = useState<RequestState>('loading')
  const [requestData, setRequestData] = useState<RequestData | null>(null)
  const [retryNumber, setRetryNumber] = useState(0)
  const [periodConfirmation, setPeriodConfirmation] = useState<{ id: string; action: 'open' | 'close' } | null>(null)
  const [pendingPeriodId, setPendingPeriodId] = useState<string | null>(null)
  const [periodActionMessage, setPeriodActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const periodRequest = authorization?.canRead
      ? client.getAdminPeriods(authorization.accessToken, controller.signal)
      : client.getOpenPeriods(controller.signal)
    Promise.all([
      client.getStructure(controller.signal),
      periodRequest,
      loadPrograms(controller.signal),
    ])
      .then(([structure, periods, programs]) => {
        setRequestData({ structure, periods, programs, periodSource: authorization?.canRead ? 'admin' : 'public' })
        setRequestState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setRequestState('error')
      })
    return () => controller.abort()
  }, [authorization?.accessToken, authorization?.canRead, client, loadPrograms, retryNumber])

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

  async function transitionPeriod(period: AcademicPeriod, action: 'open' | 'close') {
    if (!authorization?.canWrite || pendingPeriodId) return
    setPendingPeriodId(period.id)
    setPeriodActionMessage(null)
    try {
      const updatedPeriod = action === 'open'
        ? await client.openPeriod(period.id, authorization.accessToken)
        : await client.closePeriod(period.id, authorization.accessToken)
      setRequestData((current) => {
        if (!current) return current
        const updatedPeriods = current.periods
          .map((item) => item.id === updatedPeriod.id ? updatedPeriod : item)
          .filter((item) => current.periodSource === 'admin' || item.status === 'OPEN')
        return { ...current, periods: updatedPeriods }
      })
      setPeriodConfirmation(null)
      setPeriodActionMessage({
        type: 'success',
        text: `El periodo ${updatedPeriod.code} quedó ${action === 'open' ? 'abierto' : 'cerrado'}. La oferta de asignaturas y la matrícula no cambiaron.`,
      })
    } catch {
      setPeriodActionMessage({ type: 'error', text: 'No fue posible cambiar el estado del periodo. Actualiza la vista y vuelve a intentarlo.' })
    } finally {
      setPendingPeriodId(null)
    }
  }

  return (
    <div className="academic-operations">
      <section className="academic-operations-hero" aria-labelledby="academic-operations-title">
        <div className="academic-operations-hero-copy">
          <p className="academic-operations-eyebrow"><span aria-hidden="true" /> GESTIÓN ACADÉMICA <span aria-hidden="true">/</span> ORGANIZACIÓN Y PERIODOS</p>
          <h1 id="academic-operations-title">Estructura y periodos académicos</h1>
          <p>Una vista ordenada de las unidades académicas, sus sedes y el estado de los periodos regulares e intersemestrales.</p>
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
            <div><strong>{sortedPeriods.filter((period) => period.status === 'OPEN').length}</strong><span>periodos abiertos</span></div>
          </div>
        )}
      </section>

      <div className="academic-operations-note" role="note">
        <span aria-hidden="true">i</span>
        <p><strong>{authorization?.canWrite ? 'Control explícito del periodo.' : 'Vista de consulta.'}</strong> {authorization?.canWrite
          ? 'Abrir o cerrar solo cambia el estado del periodo; no publica oferta de asignaturas ni abre matrícula. El semestre de una malla curricular es distinto del periodo académico real.'
          : 'Los cambios de estado requieren permiso institucional de escritura. El semestre de una malla curricular es distinto del periodo académico real.'}</p>
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
              <div><p className="academic-panel-kicker">CALENDARIO VIGENTE</p><h2 id="academic-periods-title">{requestData.periodSource === 'admin' ? 'Gestión de periodos académicos' : 'Periodos académicos abiertos'}</h2></div>
              <span className="academic-open-badge"><span aria-hidden="true" />{requestData.periodSource === 'admin' ? 'Vista por estado' : 'Solo periodos abiertos'}</span>
            </header>
            {periodActionMessage && <p className={`academic-period-action-message is-${periodActionMessage.type}`} role={periodActionMessage.type === 'error' ? 'alert' : 'status'}>{periodActionMessage.text}</p>}
            {sortedPeriods.length === 0
              ? <p className="academic-empty-state">{requestData.periodSource === 'admin' ? 'No hay periodos académicos registrados.' : 'No hay periodos académicos abiertos para consulta.'}</p>
              : <ul className="academic-period-list">
                  {sortedPeriods.map((period) => <PeriodCard
                    key={period.id}
                    period={period}
                    canWrite={authorization?.canWrite === true}
                    confirmation={periodConfirmation?.id === period.id ? periodConfirmation.action : null}
                    pending={pendingPeriodId === period.id}
                    onRequestTransition={(action) => {
                      setPeriodActionMessage(null)
                      setPeriodConfirmation({ id: period.id, action })
                    }}
                    onCancelTransition={() => setPeriodConfirmation(null)}
                    onConfirmTransition={() => void transitionPeriod(period, periodConfirmation?.action ?? 'open')}
                  />)}
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
  const childrenByParent = new Map<string, { relation: AcademicStructureSnapshot['organizationRelations'][number]; unit: AcademicOrganizationUnit }[]>()
  const childIds = new Set<string>()
  for (const relation of relations) {
    const parent = unitById.get(relation.parentUnitId)
    const child = unitById.get(relation.childUnitId)
    if (!parent || !child) continue
    childrenByParent.set(parent.id, [...(childrenByParent.get(parent.id) ?? []), { relation, unit: child }])
    childIds.add(child.id)
  }
  childrenByParent.forEach((children) => children.sort((first, second) =>
    first.relation.displayOrder - second.relation.displayOrder || compareUnits(first.unit, second.unit)))
  let roots = units.filter((unit) => !childIds.has(unit.id))
  if (roots.length === 0) roots = units
  const attachedProgramIds = new Set(affiliations
    .filter((affiliation) => unitById.has(affiliation.organizationUnitId))
    .map((affiliation) => affiliation.programId))
  const visiblePrograms = [...programs.values()].sort((first, second) => first.programCode.localeCompare(second.programCode)
    || first.programName.localeCompare(second.programName))
  const unattachedPrograms = visiblePrograms.filter((program) => !attachedProgramIds.has(program.id))

  function renderUnit(
    unit: AcademicOrganizationUnit,
    ancestors: ReadonlySet<string>,
    displayOrder: number,
  ): ReactNode {
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
          <span className="academic-sort-order">{String(displayOrder).padStart(2, '0')}</span>
        </div>
        {(children.length > 0 || unitPrograms.length > 0) && (
          <ul className="academic-tree-children">
            {unitPrograms.map(({ affiliation, program }) => (
              <ProgramNode key={affiliation.id} program={program} site={siteById.get(affiliation.siteId)} />
            ))}
            {children.map(({ relation, unit: child }) => renderUnit(child, nextAncestors, relation.displayOrder))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="academic-tree-wrap">
      <ul className="academic-tree" aria-label="Jerarquía académica">
        {roots.map((root) => renderUnit(root, new Set(), root.displayOrder))}
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
  const childrenByParent = new Map<string, { relation: AcademicStructureSnapshot['siteRelations'][number]; site: AcademicSite }[]>()
  const childIds = new Set<string>()
  for (const relation of relations) {
    const parent = byId.get(relation.parentSiteId)
    const child = byId.get(relation.childSiteId)
    if (!parent || !child) continue
    childrenByParent.set(parent.id, [...(childrenByParent.get(parent.id) ?? []), { relation, site: child }])
    childIds.add(child.id)
  }
  childrenByParent.forEach((children) => children.sort((first, second) =>
    first.relation.displayOrder - second.relation.displayOrder || compareSites(first.site, second.site)))
  let roots = sites.filter((site) => !childIds.has(site.id))
  if (roots.length === 0) roots = sites

  function renderSite(
    site: AcademicSite,
    ancestors: ReadonlySet<string>,
    displayOrder: number,
  ): ReactNode {
    if (ancestors.has(site.id)) return null
    const nextAncestors = new Set(ancestors).add(site.id)
    const children = childrenByParent.get(site.id) ?? []
    return (
      <li className="academic-site-node" key={site.id}>
        <div className="academic-site-row">
          <span className="academic-site-pin" aria-hidden="true">⌖</span>
          <div><strong>{site.displayName}</strong><small>{site.code} · {labelSiteType(site.type)}</small></div>
          <span className="academic-sort-order">{String(displayOrder).padStart(2, '0')}</span>
        </div>
        {children.length > 0 && <ul>{children.map(({ relation, site: child }) => renderSite(child, nextAncestors, relation.displayOrder))}</ul>}
      </li>
    )
  }

  return <ul className="academic-site-tree" aria-label="Jerarquía de sedes">{roots.map((root) => renderSite(root, new Set(), root.displayOrder))}</ul>
}

function PeriodCard({
  period,
  canWrite,
  confirmation,
  pending,
  onRequestTransition,
  onCancelTransition,
  onConfirmTransition,
}: {
  period: AcademicPeriod
  canWrite: boolean
  confirmation: 'open' | 'close' | null
  pending: boolean
  onRequestTransition(action: 'open' | 'close'): void
  onCancelTransition(): void
  onConfirmTransition(): void
}) {
  const availableAction = canWrite && period.status === 'APPROVED' ? 'open'
    : canWrite && period.status === 'OPEN' ? 'close'
      : null
  const actionLabel = availableAction === 'open' ? 'Abrir' : 'Cerrar'

  return (
    <li className="academic-period-card">
      <div className="academic-period-date"><span>{period.startsOn.slice(0, 4)}</span><strong>{period.startsOn.slice(5)}</strong></div>
      <div className="academic-period-copy">
        <div className="academic-period-title-row">
          <h3>{period.kind === 'REGULAR' ? 'Período regular' : 'Intersemestral'}</h3>
          <span className={`academic-period-state state-${period.status.toLocaleLowerCase('en-US')}`}>{periodStatusLabel(period.status)}</span>
        </div>
        <p><strong>{period.code}</strong><span aria-hidden="true">·</span> {formatDate(period.startsOn)} – {formatDate(period.endsOn)}</p>
        <small>{periodReferencesLabel(period)}</small>
        {availableAction && <button
          className={`academic-period-action action-${availableAction}`}
          type="button"
          aria-label={`${actionLabel} periodo ${period.code}`}
          disabled={pending}
          onClick={() => onRequestTransition(availableAction)}
        >{pending ? 'Procesando…' : `${actionLabel} periodo`}</button>}
        {confirmation && (
          <div className="academic-period-confirmation" role="group" aria-label={`Confirmar ${confirmation === 'open' ? 'apertura' : 'cierre'} de ${period.code}`}>
            <p>Esta acción solo cambiará el estado del periodo; no publicará oferta ni abrirá matrículas.</p>
            <div>
              <button type="button" disabled={pending} onClick={onConfirmTransition}>Confirmar {confirmation === 'open' ? 'apertura' : 'cierre'}</button>
              <button type="button" className="secondary" disabled={pending} onClick={onCancelTransition}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

function periodStatusLabel(status: AcademicPeriodStatus): string {
  if (status === 'DRAFT') return 'Borrador'
  if (status === 'APPROVED') return 'Aprobado'
  if (status === 'OPEN') return 'Abierto'
  if (status === 'CLOSED') return 'Cerrado'
  return 'Cancelado'
}

function periodReferencesLabel(period: AcademicPeriod): string {
  const references = [
    period.officialReference,
    period.calendarRevisionNumber === null ? null : `Calendario rev. ${period.calendarRevisionNumber}`,
    period.approvalReference === null ? null : `Aprobación: ${period.approvalReference}`,
  ].filter((reference): reference is string => reference !== null)
  return references.length > 0 ? references.join(' · ') : 'Calendario pendiente de aprobación'
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
