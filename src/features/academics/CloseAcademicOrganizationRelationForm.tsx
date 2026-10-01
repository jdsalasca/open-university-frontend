import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AcademicOperationsClient,
  AcademicOrganizationRelation,
  AcademicOrganizationRelationCloseCommand,
  AcademicOrganizationUnit,
  AcademicStructureAuthorization,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { containsAsciiControlCharacters } from '../../shared/inputValidation'
import { localDateInputValue } from '../../shared/localDateInput'

interface CloseAcademicOrganizationRelationFormProps {
  units: AcademicOrganizationUnit[]
  relations: AcademicOrganizationRelation[]
  client: Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
  authorization: AcademicStructureAuthorization
  onClosed(): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

interface RelationDraft {
  relationKey: string
  effectiveThrough: string
  sourceReference: string
}

interface CloseConfirmation {
  parentUnitId: string
  childUnitId: string
  parentName: string
  childName: string
  command: AcademicOrganizationRelationCloseCommand
}

type Feedback = { type: 'success' | 'warning' | 'error'; text: string }

function relationKey(relation: AcademicOrganizationRelation): string {
  return `${relation.parentUnitId}|${relation.childUnitId}|${relation.validFrom}`
}

function previousCalendarDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! - 1)).toISOString().slice(0, 10)
}

export function CloseAcademicOrganizationRelationForm({
  units,
  relations,
  client,
  authorization,
  onClosed,
  onAuthorizationRejected,
}: CloseAcademicOrganizationRelationFormProps) {
  const [draft, setDraft] = useState<RelationDraft>({ relationKey: '', effectiveThrough: '', sourceReference: '' })
  const [confirmation, setConfirmation] = useState<CloseConfirmation | null>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const today = localDateInputValue()
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])
  const closeableRelations = useMemo(() => relations
    .filter((relation) => {
      const endpointsExist = unitById.has(relation.parentUnitId) && unitById.has(relation.childUnitId)
      const notExpired = relation.validThrough === null || relation.validThrough >= today
      const canShorten = relation.validThrough === null || relation.validThrough > relation.validFrom
      return endpointsExist && notExpired && canShorten && relation.parentUnitId !== relation.childUnitId
    })
    .sort((first, second) => first.validFrom.localeCompare(second.validFrom)
      || relationKey(first).localeCompare(relationKey(second))), [relations, today, unitById])
  const selectedRelation = closeableRelations.find((relation) => relationKey(relation) === draft.relationKey)

  if (!authorization.canRead || !authorization.canWrite) return null

  function changeDraft(update: Partial<RelationDraft>) {
    setDraft((current) => ({ ...current, ...update }))
    setConfirmation(null)
    setFeedback(null)
  }

  function reviewClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const relation = closeableRelations.find((candidate) => relationKey(candidate) === draft.relationKey)
    const sourceReference = draft.sourceReference.trim()
    if (!relation || !draft.effectiveThrough || draft.effectiveThrough < relation.validFrom
      || (relation.validThrough !== null && draft.effectiveThrough >= relation.validThrough)) {
      setFeedback({ type: 'error', text: 'Selecciona una relación y un último día que acorte su vigencia sin preceder su inicio.' })
      return
    }
    if (sourceReference.length === 0 || sourceReference.length > 240 || containsAsciiControlCharacters(sourceReference)) {
      setFeedback({ type: 'error', text: 'La referencia institucional es obligatoria y debe tener hasta 240 caracteres válidos.' })
      return
    }
    const parent = unitById.get(relation.parentUnitId)
    const child = unitById.get(relation.childUnitId)
    if (!parent || !child) {
      setFeedback({ type: 'error', text: 'No se encontraron ambas unidades. Actualiza la estructura antes de continuar.' })
      return
    }
    setFeedback(null)
    setConfirmation({
      parentUnitId: relation.parentUnitId,
      childUnitId: relation.childUnitId,
      parentName: parent.displayName,
      childName: child.displayName,
      command: {
        validFrom: relation.validFrom,
        effectiveThrough: draft.effectiveThrough,
        sourceReference,
      },
    })
  }

  async function confirmClosure() {
    if (pending || !confirmation || !authorization.canWrite) return
    setPending(true)
    setFeedback(null)
    try {
      await client.closeOrganizationRelation(
        confirmation.parentUnitId,
        confirmation.childUnitId,
        confirmation.command,
        authorization.accessToken,
      )
    } catch (error) {
      setConfirmation(null)
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({
          type: 'error',
          text: error.status === 401
            ? 'El servidor rechazó la sesión. Estoy comprobando la identidad; inicia sesión de nuevo si hace falta.'
            : 'El servidor negó el permiso para cerrar la relación. Estoy volviendo a comprobar los permisos.',
        })
        try {
          await onAuthorizationRejected?.(authorization.accessToken)
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor rechazó la operación y no pude revalidar los permisos. Vuelve a iniciar sesión antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 409) {
        try {
          await onClosed()
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y actualicé la estructura. Revisa la relación y su vigencia antes de otro intento.',
          })
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y no pude actualizar la estructura. Recarga antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 400) {
        setFeedback({ type: 'error', text: 'El servidor rechazó los datos. Revisa la vigencia y la referencia institucional.' })
      } else {
        setFeedback({ type: 'error', text: 'No fue posible cerrar la relación. Verifica la conexión antes de continuar.' })
      }
      setPending(false)
      return
    }

    setConfirmation(null)
    setDraft({ relationKey: '', effectiveThrough: '', sourceReference: '' })
    setFeedback({ type: 'success', text: 'Relación organizacional cerrada con referencia y auditoría.' })
    try {
      await onClosed()
    } catch {
      setFeedback({
        type: 'warning',
        text: 'La relación quedó cerrada, pero no pude actualizar la vista. Recarga para confirmar el estado antes de continuar.',
      })
    } finally {
      setPending(false)
    }
  }

  const maximumDate = selectedRelation?.validThrough ? previousCalendarDay(selectedRelation.validThrough) : undefined

  return (
    <section className="academic-create-entry" aria-labelledby="academic-close-unit-relation-title">
      <div className="academic-create-entry-heading">
        <div>
          <p className="academic-panel-kicker">VIGENCIA Y AUDITORÍA</p>
          <h3 id="academic-close-unit-relation-title">Cerrar una relación organizacional</h3>
        </div>
        <span aria-hidden="true">⌁</span>
      </div>
      <p className="academic-create-entry-intro">
        Acorta el vínculo entre dos unidades sin eliminar ninguna. El último día indicado es inclusivo y la referencia queda auditada.
      </p>
      {closeableRelations.length === 0 ? (
        <p className="academic-empty-state">No hay relaciones actuales o futuras que puedan acortarse.</p>
      ) : (
        <form className="academic-create-entry-form" onSubmit={(event) => void reviewClosure(event)}>
          <label>
            Relación organizacional
            <select
              required
              value={draft.relationKey}
              disabled={pending || confirmation !== null}
              onChange={(event) => changeDraft({ relationKey: event.currentTarget.value, effectiveThrough: '' })}
            >
              <option value="">Selecciona una relación fechada</option>
              {closeableRelations.map((relation) => {
                const parent = unitById.get(relation.parentUnitId)!
                const child = unitById.get(relation.childUnitId)!
                return (
                  <option key={relationKey(relation)} value={relationKey(relation)}>
                    {parent.displayName} → {child.displayName} · Desde {relation.validFrom}
                    {relation.validThrough ? ` · Hasta ${relation.validThrough}` : ' · Sin cierre'}
                  </option>
                )
              })}
            </select>
          </label>
          <label>
            Último día de vigencia (inclusive)
            <input
              type="date"
              required
              min={selectedRelation?.validFrom}
              max={maximumDate}
              value={draft.effectiveThrough}
              disabled={pending || confirmation !== null || !selectedRelation}
              onChange={(event) => changeDraft({ effectiveThrough: event.currentTarget.value })}
            />
          </label>
          {selectedRelation && (
            <p className="academic-relation-close-current">
              Relación vigente desde {selectedRelation.validFrom} hasta {selectedRelation.validThrough ?? 'sin fecha de cierre'}.
              {selectedRelation.validThrough && ' Solo se permite acortar esta vigencia.'}
            </p>
          )}
          <label className="academic-create-entry-reference">
            Referencia institucional
            <input
              autoComplete="off"
              maxLength={240}
              required
              value={draft.sourceReference}
              disabled={pending || confirmation !== null}
              onChange={(event) => changeDraft({ sourceReference: event.currentTarget.value })}
            />
          </label>
          {!confirmation && (
            <div className="academic-create-entry-actions">
              <button type="submit" disabled={pending || !authorization.canWrite || closeableRelations.length === 0}>
                Revisar cierre
              </button>
              <p>El cierre termina este vínculo desde la fecha indicada; no borra unidades ni sus demás relaciones.</p>
            </div>
          )}
        </form>
      )}
      {confirmation && (
        <section className="academic-relation-close-confirmation" role="region" aria-label="Confirmar cierre de relación">
          <h4>Confirma el cierre</h4>
          <p>
            {confirmation.parentName} → {confirmation.childName} quedará vigente hasta{' '}
            <time dateTime={confirmation.command.effectiveThrough}>{confirmation.command.effectiveThrough}</time>, inclusive.
            {' '}La operación conserva ambas unidades y registra la referencia “{confirmation.command.sourceReference}”.
          </p>
          <div>
            <button type="button" disabled={pending} onClick={() => void confirmClosure()}>
              {pending ? 'Cerrando…' : 'Confirmar cierre de relación'}
            </button>
            <button type="button" className="secondary" disabled={pending} onClick={() => setConfirmation(null)}>
              Cancelar
            </button>
          </div>
        </section>
      )}
      {feedback && (
        <p className={`academic-create-entry-feedback is-${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}
    </section>
  )
}
