import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnitCreateCommand,
  AcademicStructureAuthorization,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

interface CreateFacultyFormProps {
  client: Pick<AcademicOperationsClient, 'createOrganizationUnit'>
  authorization: AcademicStructureAuthorization
  onCreated(unitId: string): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

interface FacultyDraft {
  code: string
  displayName: string
  displayOrder: string
  validFrom: string
  validThrough: string
  sourceReference: string
}

type Feedback = { type: 'success' | 'error' | 'warning'; text: string }

function localDate(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function emptyFacultyDraft(): FacultyDraft {
  return {
    code: '',
    displayName: '',
    displayOrder: '0',
    validFrom: localDate(),
    validThrough: '',
    sourceReference: '',
  }
}

export function CreateFacultyForm({
  client,
  authorization,
  onCreated,
  onAuthorizationRejected,
}: CreateFacultyFormProps) {
  const [draft, setDraft] = useState<FacultyDraft>(emptyFacultyDraft)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !authorization.canWrite) return

    const command: AcademicOrganizationUnitCreateCommand = {
      code: draft.code,
      type: 'FACULTY',
      displayName: draft.displayName,
      displayOrder: Number(draft.displayOrder),
      validFrom: draft.validFrom,
      validThrough: draft.validThrough || null,
      sourceReference: draft.sourceReference,
    }

    setPending(true)
    setFeedback(null)
    let unitId: string
    try {
      unitId = await client.createOrganizationUnit(command, authorization.accessToken)
    } catch (error) {
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({
          type: 'error',
          text: error.status === 401
            ? 'El servidor rechazó la sesión. Estoy comprobando la identidad; inicia sesión de nuevo si hace falta.'
            : 'El servidor negó el permiso para crear facultades. Estoy volviendo a comprobar los permisos.',
        })
        try {
          await onAuthorizationRejected?.(authorization.accessToken)
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor rechazó la creación y no pude revalidar los permisos. Vuelve a iniciar sesión antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 409) {
        setFeedback({ type: 'error', text: 'Ese código ya está registrado o entra en conflicto con la estructura vigente.' })
      } else if (error instanceof AcademicOperationsApiError && error.status === 400) {
        setFeedback({ type: 'error', text: 'El servidor rechazó los datos. Revisa código, vigencia y referencia institucional.' })
      } else {
        setFeedback({ type: 'error', text: 'No fue posible registrar la facultad. Verifica la conexión e inténtalo de nuevo.' })
      }
      setPending(false)
      return
    }

    setDraft(emptyFacultyDraft())
    const futureEffectiveDate = command.validFrom > localDate()
    setFeedback({
      type: 'success',
      text: futureEffectiveDate
        ? `Facultad registrada. Aparecerá en la estructura vigente desde ${command.validFrom}.`
        : 'Facultad registrada y estructura actualizada.',
    })
    try {
      await onCreated(unitId)
    } catch {
      setFeedback({
        type: 'warning',
        text: 'La facultad quedó registrada, pero no pude actualizar la vista. Recarga antes de continuar.',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="academic-create-faculty" aria-labelledby="academic-create-faculty-title">
      <div className="academic-create-faculty-heading">
        <div>
          <p className="academic-panel-kicker">ALTA AUDITADA</p>
          <h3 id="academic-create-faculty-title">Registrar facultad raíz</h3>
        </div>
        <span aria-hidden="true">＋</span>
      </div>
      <p className="academic-create-faculty-intro">
        Crea una facultad con código, vigencia y referencia institucional validados. No se cargan registros de ejemplo.
      </p>
      <form className="academic-create-faculty-form" onSubmit={(event) => void submit(event)}>
        <label>
          Código institucional
          <input
            autoComplete="off"
            maxLength={64}
            pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
            required
            value={draft.code}
            disabled={pending}
            onChange={(event) => {
              const code = event.currentTarget.value
              setDraft((current) => ({ ...current, code }))
            }}
          />
        </label>
        <label>
          Nombre de la facultad
          <input
            autoComplete="organization"
            maxLength={240}
            required
            value={draft.displayName}
            disabled={pending}
            onChange={(event) => {
              const displayName = event.currentTarget.value
              setDraft((current) => ({ ...current, displayName }))
            }}
          />
        </label>
        <label>
          Prioridad de visualización
          <input
            type="number"
            min={0}
            max={2_147_483_647}
            step={1}
            required
            value={draft.displayOrder}
            disabled={pending}
            onChange={(event) => {
              const displayOrder = event.currentTarget.value
              setDraft((current) => ({ ...current, displayOrder }))
            }}
          />
        </label>
        <label>
          Vigente desde
          <input
            type="date"
            required
            value={draft.validFrom}
            disabled={pending}
            onChange={(event) => {
              const validFrom = event.currentTarget.value
              setDraft((current) => ({ ...current, validFrom }))
            }}
          />
        </label>
        <label>
          Vigente hasta (opcional)
          <input
            type="date"
            min={draft.validFrom}
            value={draft.validThrough}
            disabled={pending}
            onChange={(event) => {
              const validThrough = event.currentTarget.value
              setDraft((current) => ({ ...current, validThrough }))
            }}
          />
        </label>
        <label className="academic-create-faculty-reference">
          Referencia institucional
          <input
            autoComplete="off"
            maxLength={240}
            required
            value={draft.sourceReference}
            disabled={pending}
            onChange={(event) => {
              const sourceReference = event.currentTarget.value
              setDraft((current) => ({ ...current, sourceReference }))
            }}
          />
        </label>
        <div className="academic-create-faculty-actions">
          <button type="submit" disabled={pending || !authorization.canWrite}>
            {pending ? 'Registrando…' : 'Crear facultad'}
          </button>
          <p>La escritura requiere permiso institucional y queda auditada.</p>
        </div>
      </form>
      {feedback && (
        <p className={`academic-create-faculty-feedback is-${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}
    </section>
  )
}
