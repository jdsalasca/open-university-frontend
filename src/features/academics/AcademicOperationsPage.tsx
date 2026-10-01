import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { academicCatalogClient } from './academicCatalogClient'
import type { AcademicProgram } from './contracts'
import { academicOperationsClient } from './academicOperationsClient'
import type {
  AcademicDisplayOrderCommand,
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicPeriod,
  AcademicPeriodAuthorization,
  AcademicPeriodStatus,
  AcademicProgramAffiliation,
  AcademicSite,
  AcademicStructureAuthorization,
  AcademicStructureSnapshot,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { containsAsciiControlCharacters } from '../../shared/inputValidation'
import './AcademicOperationsPage.scss'

type RequestState = 'loading' | 'ready' | 'error'
type RequestData = {
  structure: AcademicStructureSnapshot
  periods: AcademicPeriod[]
  periodSource: 'public' | 'admin'
  programs: AcademicProgram[]
}
type StructureOrderTarget =
  | { kind: 'unit'; unitId: string; expectedDisplayOrder: number }
  | { kind: 'site'; siteId: string; expectedDisplayOrder: number }
  | { kind: 'organization-relation'; parentUnitId: string; childUnitId: string; expectedDisplayOrder: number }
  | { kind: 'site-relation'; parentSiteId: string; childSiteId: string; expectedDisplayOrder: number }
  | { kind: 'program-affiliation'; programId: string; affiliationId: string; expectedDisplayOrder: number }

interface AcademicOperationsPageProps {
  client?: AcademicOperationsClient
  loadPrograms?: (signal?: AbortSignal) => Promise<AcademicProgram[]>
  authorization?: AcademicPeriodAuthorization | null
  structureAuthorization?: AcademicStructureAuthorization | null
}

const defaultLoadPrograms = (signal?: AbortSignal) => academicCatalogClient.listPrograms(signal)

export function AcademicOperationsPage({
  client = academicOperationsClient,
  loadPrograms = defaultLoadPrograms,
  authorization = null,
  structureAuthorization = null,
}: AcademicOperationsPageProps) {
  const [requestState, setRequestState] = useState<RequestState>('loading')
  const [requestData, setRequestData] = useState<RequestData | null>(null)
  const [retryNumber, setRetryNumber] = useState(0)
  const [periodConfirmation, setPeriodConfirmation] = useState<{ id: string; action: 'open' | 'close' } | null>(null)
  const [pendingPeriodId, setPendingPeriodId] = useState<string | null>(null)
  const [periodActionMessage, setPeriodActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [structureOrderMessage, setStructureOrderMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  const administrativeDataExpired = requestData?.periodSource === 'admin' && authorization?.canRead !== true
  const visibleRequestData = administrativeDataExpired ? null : requestData
  const visibleRequestState = administrativeDataExpired && requestState === 'ready' ? 'loading' : requestState

  const sortedUnits = useMemo(() => visibleRequestData
    ? [...visibleRequestData.structure.units].filter((unit) => unit.status === 'ACTIVE').sort(compareUnits)
    : [], [visibleRequestData])
  const sortedSites = useMemo(() => visibleRequestData
    ? [...visibleRequestData.structure.sites].filter((site) => site.status === 'ACTIVE').sort(compareSites)
    : [], [visibleRequestData])
  const sortedPeriods = useMemo(() => visibleRequestData
    ? [...visibleRequestData.periods].sort((first, second) => first.startsOn.localeCompare(second.startsOn)
      || first.kind.localeCompare(second.kind)
      || first.code.localeCompare(second.code))
    : [], [visibleRequestData])
  const programById = useMemo(() => new Map((visibleRequestData?.programs ?? []).map((program) => [program.id, program])), [visibleRequestData])

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

  async function saveStructureOrder(
    target: StructureOrderTarget,
    displayOrder: number,
    sourceReference: string,
  ): Promise<void> {
    if (!structureAuthorization?.canWrite) throw new Error('La escritura de estructura requiere autorización institucional.')
    const command: AcademicDisplayOrderCommand = {
      expectedDisplayOrder: target.expectedDisplayOrder,
      displayOrder,
      sourceReference,
    }
    setStructureOrderMessage(null)
    try {
      await submitStructureOrder(client, target, command, structureAuthorization.accessToken)
    } catch (error) {
      if (error instanceof AcademicOperationsApiError && error.status === 409) {
        try {
          const refreshed = await client.getStructure()
          setRequestData((current) => current ? { ...current, structure: refreshed } : current)
          setStructureOrderMessage({
            type: 'error',
            text: 'La prioridad cambió mientras editabas. Actualicé la estructura; revisa el orden antes de volver a guardar.',
          })
          return
        } catch {
          setRequestState('error')
          setStructureOrderMessage({
            type: 'error',
            text: 'La prioridad cambió y no fue posible actualizar la estructura. Vuelve a cargar la vista antes de continuar.',
          })
          return
        }
      }
      throw error
    }

    try {
      const refreshed = await client.getStructure()
      setRequestData((current) => current ? { ...current, structure: refreshed } : current)
      setStructureOrderMessage({ type: 'success', text: 'Prioridad actualizada desde la estructura del servidor.' })
    } catch {
      setRequestState('error')
      setStructureOrderMessage({
        type: 'error',
        text: 'El servidor aceptó el cambio, pero no pude actualizar la vista. Recarga para confirmar el orden antes de seguir.',
      })
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
        {visibleRequestState === 'ready' && visibleRequestData && (
          <div className="academic-operations-stats" aria-label="Resumen de la vista">
            <div><strong>{sortedUnits.length}</strong><span>unidades</span></div>
            <div><strong>{sortedSites.length}</strong><span>sedes activas</span></div>
            <div><strong>{visibleRequestData.programs.length}</strong><span>programas publicados</span></div>
            <div><strong>{sortedPeriods.filter((period) => period.status === 'OPEN').length}</strong><span>periodos abiertos</span></div>
          </div>
        )}
      </section>

      <div className="academic-operations-note" role="note">
        <span aria-hidden="true">i</span>
        <p><strong>{authorization?.canWrite ? 'Control explícito del periodo.' : 'Vista de consulta.'}</strong> {authorization?.canWrite
          ? 'Abrir o cerrar solo cambia el estado del periodo; no publica oferta de asignaturas ni abre matrícula. El semestre de una malla curricular es distinto del periodo académico real.'
          : 'Los cambios de estado requieren permiso institucional de escritura. El semestre de una malla curricular es distinto del periodo académico real.'} {structureAuthorization?.canWrite
            ? 'La prioridad menor aparece primero; cada corrección requiere una referencia institucional y queda auditada.'
            : 'La corrección del orden requiere permiso institucional de estructura.'}</p>
      </div>

      {structureOrderMessage && (
        <p className={`academic-period-action-message is-${structureOrderMessage.type}`}
          role={structureOrderMessage.type === 'error' ? 'alert' : 'status'}>
          {structureOrderMessage.text}
        </p>
      )}

      {visibleRequestState === 'loading' && (
        <div className="academic-loading" role="status">
          <span className="academic-loading-mark" aria-hidden="true" />
          <span>Consultando estructura, programas y periodos abiertos…</span>
        </div>
      )}

      {visibleRequestState === 'error' && (
        <div className="academic-load-error" role="alert">
          <div><strong>No fue posible cargar la información académica.</strong><p>Comprueba la conexión y vuelve a intentarlo.</p></div>
          <button type="button" onClick={retry}>Intentar de nuevo</button>
        </div>
      )}

      {visibleRequestState === 'ready' && visibleRequestData && (
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
                    relations={visibleRequestData.structure.organizationRelations}
                    affiliations={visibleRequestData.structure.programAffiliations}
                    programs={programById}
                    sites={sortedSites}
                    canChangeOrder={structureAuthorization?.canWrite === true}
                    onSaveOrder={saveStructureOrder}
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
                : <SiteTree
                    sites={sortedSites}
                    relations={visibleRequestData.structure.siteRelations}
                    canChangeOrder={structureAuthorization?.canWrite === true}
                    onSaveOrder={saveStructureOrder}
                  />}
              <p className="academic-panel-footnote">Las sedes se administran aparte de las facultades.</p>
            </section>
          </div>

          <section className="academic-panel academic-periods-panel" aria-labelledby="academic-periods-title">
            <header className="academic-panel-heading">
              <span className="academic-panel-icon academic-icon-periods" aria-hidden="true">◷</span>
              <div><p className="academic-panel-kicker">CALENDARIO VIGENTE</p><h2 id="academic-periods-title">{visibleRequestData.periodSource === 'admin' ? 'Gestión de periodos académicos' : 'Periodos académicos abiertos'}</h2></div>
              <span className="academic-open-badge"><span aria-hidden="true" />{visibleRequestData.periodSource === 'admin' ? 'Vista por estado' : 'Solo periodos abiertos'}</span>
            </header>
            {periodActionMessage && <p className={`academic-period-action-message is-${periodActionMessage.type}`} role={periodActionMessage.type === 'error' ? 'alert' : 'status'}>{periodActionMessage.text}</p>}
            {sortedPeriods.length === 0
              ? <p className="academic-empty-state">{visibleRequestData.periodSource === 'admin' ? 'No hay periodos académicos registrados.' : 'No hay periodos académicos abiertos para consulta.'}</p>
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
  canChangeOrder,
  onSaveOrder,
}: {
  units: AcademicOrganizationUnit[]
  relations: AcademicStructureSnapshot['organizationRelations']
  affiliations: AcademicProgramAffiliation[]
  programs: Map<string, AcademicProgram>
  sites: AcademicSite[]
  canChangeOrder: boolean
  onSaveOrder(target: StructureOrderTarget, displayOrder: number, sourceReference: string): Promise<void>
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
    orderTarget: StructureOrderTarget,
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
          <span className="academic-sort-order">{String(orderTarget.expectedDisplayOrder).padStart(2, '0')}</span>
          <OrderEditor
            key={structureOrderTargetKey(orderTarget) + `:${orderTarget.expectedDisplayOrder}:${canChangeOrder}`}
            label={unit.displayName}
            displayOrder={orderTarget.expectedDisplayOrder}
            canChangeOrder={canChangeOrder}
            target={orderTarget}
            onSave={onSaveOrder}
          />
        </div>
        {(children.length > 0 || unitPrograms.length > 0) && (
          <ul className="academic-tree-children">
            {unitPrograms.map(({ affiliation, program }) => (
              <ProgramNode
                key={affiliation.id}
                program={program}
                site={siteById.get(affiliation.siteId)}
                affiliation={affiliation}
                canChangeOrder={canChangeOrder}
                onSaveOrder={onSaveOrder}
              />
            ))}
            {children.map(({ relation, unit: child }) => renderUnit(child, nextAncestors, {
              kind: 'organization-relation',
              parentUnitId: relation.parentUnitId,
              childUnitId: relation.childUnitId,
              expectedDisplayOrder: relation.displayOrder,
            }))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="academic-tree-wrap">
      <ul className="academic-tree" aria-label="Jerarquía académica">
        {roots.map((root) => renderUnit(root, new Set(), {
          kind: 'unit',
          unitId: root.id,
          expectedDisplayOrder: root.displayOrder,
        }))}
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

function ProgramNode({
  program,
  site,
  affiliation,
  canChangeOrder = false,
  onSaveOrder,
}: {
  program: AcademicProgram
  site?: AcademicSite
  affiliation?: AcademicProgramAffiliation
  canChangeOrder?: boolean
  onSaveOrder?: (target: StructureOrderTarget, displayOrder: number, sourceReference: string) => Promise<void>
}) {
  return (
    <li className="academic-program-node">
      <span className="academic-program-mark" aria-hidden="true">↳</span>
      <span className="academic-program-code">{program.programCode}</span>
      <span>{program.programName}</span>
      <small>{site ? `${site.displayName} · ${site.code}` : 'Adscripción territorial pendiente'}</small>
      {affiliation && (
        <>
          <span className="academic-sort-order">{String(affiliation.displayOrder).padStart(2, '0')}</span>
          {onSaveOrder && <OrderEditor
            key={`${affiliation.id}:${affiliation.displayOrder}:${canChangeOrder}`}
            label={program.programName}
            displayOrder={affiliation.displayOrder}
            canChangeOrder={canChangeOrder}
            target={{
              kind: 'program-affiliation',
              programId: affiliation.programId,
              affiliationId: affiliation.id,
              expectedDisplayOrder: affiliation.displayOrder,
            }}
            onSave={onSaveOrder}
          />}
        </>
      )}
    </li>
  )
}

function SiteTree({
  sites,
  relations,
  canChangeOrder,
  onSaveOrder,
}: {
  sites: AcademicSite[]
  relations: AcademicStructureSnapshot['siteRelations']
  canChangeOrder: boolean
  onSaveOrder(target: StructureOrderTarget, displayOrder: number, sourceReference: string): Promise<void>
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
    orderTarget: StructureOrderTarget,
  ): ReactNode {
    if (ancestors.has(site.id)) return null
    const nextAncestors = new Set(ancestors).add(site.id)
    const children = childrenByParent.get(site.id) ?? []
    return (
      <li className="academic-site-node" key={site.id}>
        <div className="academic-site-row">
          <span className="academic-site-pin" aria-hidden="true">⌖</span>
          <div><strong>{site.displayName}</strong><small>{site.code} · {labelSiteType(site.type)}</small></div>
          <span className="academic-sort-order">{String(orderTarget.expectedDisplayOrder).padStart(2, '0')}</span>
          <OrderEditor
            key={structureOrderTargetKey(orderTarget) + `:${orderTarget.expectedDisplayOrder}:${canChangeOrder}`}
            label={site.displayName}
            displayOrder={orderTarget.expectedDisplayOrder}
            canChangeOrder={canChangeOrder}
            target={orderTarget}
            onSave={onSaveOrder}
          />
        </div>
        {children.length > 0 && <ul>{children.map(({ relation, site: child }) => renderSite(child, nextAncestors, {
          kind: 'site-relation',
          parentSiteId: relation.parentSiteId,
          childSiteId: relation.childSiteId,
          expectedDisplayOrder: relation.displayOrder,
        }))}</ul>}
      </li>
    )
  }

  return <ul className="academic-site-tree" aria-label="Jerarquía de sedes">{roots.map((root) => renderSite(root, new Set(), {
    kind: 'site',
    siteId: root.id,
    expectedDisplayOrder: root.displayOrder,
  }))}</ul>
}

function OrderEditor({
  target,
  label,
  displayOrder,
  canChangeOrder,
  onSave,
}: {
  target: StructureOrderTarget
  label: string
  displayOrder: number
  canChangeOrder: boolean
  onSave(target: StructureOrderTarget, displayOrder: number, sourceReference: string): Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [nextOrder, setNextOrder] = useState(String(displayOrder))
  const [sourceReference, setSourceReference] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const targetKey = structureOrderTargetKey(target)
  const orderInputId = `academic-order-${targetKey}`
  const referenceInputId = `academic-order-reference-${targetKey}`

  if (!canChangeOrder) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const normalizedOrder = nextOrder.trim()
    const orderValue = Number(normalizedOrder)
    const reference = sourceReference.trim()
    if (!/^\d+$/.test(normalizedOrder) || !Number.isSafeInteger(orderValue) || orderValue > 100_000) {
      setErrorMessage('El orden debe ser un entero entre 0 y 100000.')
      return
    }
    if (reference.length === 0 || reference.length > 240 || containsAsciiControlCharacters(reference)) {
      setErrorMessage('Escribe una referencia institucional de hasta 240 caracteres.')
      return
    }

    setPending(true)
    setErrorMessage(null)
    try {
      await onSave(target, orderValue, reference)
      setEditing(false)
      setSourceReference('')
    } catch (error) {
      setErrorMessage(structureOrderErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="academic-order-editor">
      {!editing
        ? <button type="button" className="academic-order-edit-button"
            aria-label={`Cambiar orden de ${label}`}
            onClick={() => {
              setNextOrder(String(displayOrder))
              setSourceReference('')
              setErrorMessage(null)
              setEditing(true)
            }}>
            Cambiar orden
          </button>
        : <form className="academic-order-form" aria-label={`Editar orden de ${label}`} onSubmit={(event) => void submit(event)}>
            <label htmlFor={orderInputId}>Nuevo orden de {label}</label>
            <input
              id={orderInputId}
              type="number"
              min={0}
              max={100_000}
              step={1}
              required
              value={nextOrder}
              disabled={pending}
              onChange={(event) => setNextOrder(event.currentTarget.value)}
            />
            <label htmlFor={referenceInputId}>Referencia institucional de {label}</label>
            <input
              id={referenceInputId}
              type="text"
              maxLength={240}
              required
              value={sourceReference}
              disabled={pending}
              onChange={(event) => setSourceReference(event.currentTarget.value)}
            />
            <div className="academic-order-actions">
              <button type="submit" disabled={pending}>{pending ? 'Guardando…' : `Guardar orden de ${label}`}</button>
              <button type="button" className="secondary" disabled={pending} onClick={() => setEditing(false)}>Cancelar</button>
            </div>
            {errorMessage && <p role="alert">{errorMessage}</p>}
          </form>}
    </div>
  )
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

function submitStructureOrder(
  client: AcademicOperationsClient,
  target: StructureOrderTarget,
  command: AcademicDisplayOrderCommand,
  accessToken: string,
): Promise<void> {
  switch (target.kind) {
    case 'unit':
      return client.changeOrganizationUnitOrder(target.unitId, command, accessToken)
    case 'site':
      return client.changeSiteOrder(target.siteId, command, accessToken)
    case 'organization-relation':
      return client.changeOrganizationRelationOrder(target.parentUnitId, target.childUnitId, command, accessToken)
    case 'site-relation':
      return client.changeSiteRelationOrder(target.parentSiteId, target.childSiteId, command, accessToken)
    case 'program-affiliation':
      return client.changeProgramAffiliationOrder(target.programId, target.affiliationId, command, accessToken)
  }
}

function structureOrderTargetKey(target: StructureOrderTarget): string {
  switch (target.kind) {
    case 'unit': return `unit-${target.unitId}`
    case 'site': return `site-${target.siteId}`
    case 'organization-relation': return `organization-relation-${target.parentUnitId}-${target.childUnitId}`
    case 'site-relation': return `site-relation-${target.parentSiteId}-${target.childSiteId}`
    case 'program-affiliation': return `program-affiliation-${target.programId}-${target.affiliationId}`
  }
}

function structureOrderErrorMessage(error: unknown): string {
  if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
    return 'La sesión no tiene permiso para cambiar el orden de la estructura.'
  }
  return 'No fue posible guardar esta prioridad. La estructura no se modificó; verifica tu conexión e inténtalo de nuevo.'
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
