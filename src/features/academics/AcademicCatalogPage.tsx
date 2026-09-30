import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { academicCatalogClient } from './academicCatalogClient'
import type {
  AcademicCatalogClient,
  AcademicCatalogIssue,
  AcademicCurriculum,
  AcademicCurriculumDetails,
  AcademicProgram,
  CatalogAuthorization,
} from './contracts'
import { validateCurriculumCsvFile } from './contracts'
import './AcademicCatalogPage.scss'

interface AcademicCatalogPageProps {
  client?: AcademicCatalogClient
  authorization?: CatalogAuthorization | null
}

type RequestState = 'loading' | 'ready' | 'error'

interface ApiFailure extends Error {
  status?: number
  code?: string
  issues?: readonly AcademicCatalogIssue[]
}

export function AcademicCatalogPage({
  client = academicCatalogClient,
  authorization = null,
}: AcademicCatalogPageProps) {
  const accessToken = authorization?.accessToken.trim() ? authorization.accessToken : null
  const canReadDrafts = accessToken !== null
    && authorization?.permissions.includes('academic:catalog:read') === true

  const [programs, setPrograms] = useState<AcademicProgram[]>([])
  const [programsState, setProgramsState] = useState<RequestState>('loading')
  const [programsError, setProgramsError] = useState('')
  const [programRetry, setProgramRetry] = useState(0)
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [curricula, setCurricula] = useState<AcademicCurriculum[]>([])
  const [curriculaState, setCurriculaState] = useState<RequestState>('ready')
  const [curriculaError, setCurriculaError] = useState('')
  const [publicRefresh, setPublicRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    client.listPrograms(controller.signal)
      .then((result) => {
        setPrograms(result)
        setProgramsState('ready')
        setSelectedProgramId(result[0]?.id ?? '')
        setCurricula([])
        setCurriculaState(result.length > 0 ? 'loading' : 'ready')
        setCurriculaError('')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setProgramsError('No se pudo cargar el catálogo. Comprueba la conexión e inténtalo de nuevo.')
        setProgramsState('error')
      })
    return () => controller.abort()
  }, [client, programRetry])

  useEffect(() => {
    if (!selectedProgramId) return

    const controller = new AbortController()
    client.listCurricula(selectedProgramId, controller.signal)
      .then((result) => {
        setCurricula(result.filter((curriculum) => curriculum.status === 'PUBLISHED'))
        setCurriculaState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setCurriculaError('No se pudieron cargar las versiones publicadas de este programa.')
        setCurriculaState('error')
      })
    return () => controller.abort()
  }, [client, selectedProgramId, publicRefresh])

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  )

  function retryPrograms() {
    setProgramsState('loading')
    setProgramsError('')
    setProgramRetry((count) => count + 1)
  }

  function chooseProgram(programId: string) {
    setSelectedProgramId(programId)
    setCurriculaState('loading')
    setCurriculaError('')
  }

  function retryCurricula() {
    setCurriculaState('loading')
    setCurriculaError('')
    setPublicRefresh((count) => count + 1)
  }

  function refreshPublicCurricula() {
    setCurriculaState('loading')
    setCurriculaError('')
    setPublicRefresh((count) => count + 1)
  }

  return (
    <div className="academic-catalog">
      <section className="catalog-hero" aria-labelledby="catalog-title">
        <div className="catalog-hero-copy">
          <p className="catalog-eyebrow"><span aria-hidden="true" /> VIDA UNIVERSITARIA <span aria-hidden="true">/</span> CATÁLOGO ACADÉMICO</p>
          <h1 id="catalog-title">Programas de <em>pregrado presencial</em></h1>
          <p className="catalog-intro">Consulta los planes de estudio publicados por programa y cohorte. Las versiones anteriores se conservan para acompañar el recorrido académico.</p>
          <div className="catalog-hero-meta">
            <span className="catalog-preview-badge"><span aria-hidden="true">◌</span> Vista previa de desarrollo</span>
            <span>Solo consulta pública · Sin datos personales</span>
          </div>
        </div>
        <div className="catalog-hero-art" aria-hidden="true">
          <div className="catalog-art-orbit catalog-art-orbit-one" />
          <div className="catalog-art-orbit catalog-art-orbit-two" />
          <div className="catalog-art-disc"><span>U</span></div>
          <div className="catalog-art-spark catalog-art-spark-one">✳</div>
          <div className="catalog-art-spark catalog-art-spark-two">✦</div>
          <div className="catalog-art-caption">RUTA<br />ACADÉMICA</div>
        </div>
      </section>

      <div className="catalog-operation-note" role="note">
        <span className="catalog-note-icon" aria-hidden="true">i</span>
        <p><strong>Este módulo es una vista previa y no está habilitado para operación institucional.</strong> El acceso oficial y la publicación requieren validación de la UPTC.</p>
      </div>

      {programsState === 'loading' && <p className="catalog-loading" role="status">Cargando catálogo académico…</p>}

      {programsState === 'error' && (
        <div className="catalog-error" role="alert">
          <span className="catalog-error-icon" aria-hidden="true">!</span>
          <div><strong>No se pudo cargar el catálogo</strong><p>{programsError}</p></div>
          <button className="catalog-button catalog-button-secondary" type="button" onClick={retryPrograms}>Reintentar</button>
        </div>
      )}

      {programsState === 'ready' && programs.length === 0 && (
        <section className="catalog-empty" aria-labelledby="catalog-empty-title">
          <div className="catalog-empty-art" aria-hidden="true"><span>⌁</span><i /><b /></div>
          <p className="catalog-eyebrow">CATÁLOGO EN PREPARACIÓN</p>
          <h2 id="catalog-empty-title">No hay programas publicados todavía</h2>
          <p>Las versiones aparecerán aquí cuando exista un plan académico revisado y publicado por la institución.</p>
          <span className="catalog-empty-footnote"><span aria-hidden="true">◇</span> No mostramos registros de ejemplo como si fueran oficiales.</span>
        </section>
      )}

      {programsState === 'ready' && programs.length > 0 && (
        <section className="catalog-browser" aria-label="Programas y planes de estudio">
          <div className="catalog-programs-panel">
            <div className="catalog-section-heading">
              <div><p className="catalog-eyebrow">EXPLORAR</p><h2>Programas</h2></div>
              <span className="catalog-count">{programs.length.toString().padStart(2, '0')}</span>
            </div>
            <div className="catalog-program-list" role="group" aria-label="Seleccionar programa">
              {programs.map((program) => (
                <button
                  aria-pressed={selectedProgramId === program.id}
                  className={`catalog-program-option${selectedProgramId === program.id ? ' is-selected' : ''}`}
                  key={program.id}
                  onClick={() => chooseProgram(program.id)}
                  type="button"
                >
                  <span className="catalog-program-mark" aria-hidden="true">{program.programCode.slice(0, 1)}</span>
                  <span className="catalog-program-copy"><strong>{program.programName}</strong><small>{program.faculty} · {program.campusName}</small></span>
                  <span className="catalog-program-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>

          <div className="catalog-curricula-panel">
            {selectedProgram && (
              <div className="catalog-section-heading catalog-curricula-heading">
                <div><p className="catalog-eyebrow">PLANES PUBLICADOS · {selectedProgram.campusName.toLocaleUpperCase('es-CO')}</p><h2>{selectedProgram.programName}</h2></div>
                <span className="catalog-campus-tag">{selectedProgram.programCode}</span>
              </div>
            )}
            {curriculaState === 'loading' && <p className="catalog-loading" role="status">Cargando versiones publicadas…</p>}
            {curriculaState === 'error' && (
              <div className="catalog-error catalog-error-compact" role="alert">
                <p>{curriculaError}</p>
                <button className="catalog-button catalog-button-secondary" type="button" onClick={retryCurricula}>Reintentar</button>
              </div>
            )}
            {curriculaState === 'ready' && curricula.length === 0 && (
              <div className="catalog-no-curricula">
                <span className="catalog-no-curricula-icon" aria-hidden="true">▤</span>
                <div><h3>Sin planes publicados</h3><p>Este programa todavía no tiene una versión curricular pública disponible.</p></div>
              </div>
            )}
            {curriculaState === 'ready' && curricula.length > 0 && (
              <div className="catalog-curriculum-grid">
                {curricula.map((curriculum) => <CurriculumCard curriculum={curriculum} key={curriculum.id} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {canReadDrafts && accessToken
        ? <CatalogAdministration
          key={accessToken}
          accessToken={accessToken}
          authorization={authorization!}
          client={client}
          onPublished={refreshPublicCurricula}
        />
        : <LockedCatalogAdministration />}
    </div>
  )
}

interface CatalogAdministrationProps {
  accessToken: string
  authorization: CatalogAuthorization
  client: AcademicCatalogClient
  onPublished: () => void
}

function CatalogAdministration({ accessToken, authorization, client, onPublished }: CatalogAdministrationProps) {
  const canWriteCatalog = authorization.permissions.includes('academic:catalog:write')
  const [drafts, setDrafts] = useState<AcademicCurriculum[]>([])
  const [draftsState, setDraftsState] = useState<RequestState>('loading')
  const [draftsError, setDraftsError] = useState('')
  const [draftRefresh, setDraftRefresh] = useState(0)
  const [selectedDraft, setSelectedDraft] = useState<AcademicCurriculumDetails | null>(null)
  const [reviewingDraftId, setReviewingDraftId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState<ApiFailure | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    client.listDrafts(accessToken, controller.signal)
      .then((result) => {
        setDrafts(result.filter((curriculum) => curriculum.status === 'DRAFT'))
        setDraftsState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setDraftsError('No se pudieron cargar los borradores administrativos.')
        setDraftsState('error')
      })
    return () => controller.abort()
  }, [client, accessToken, draftRefresh])

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null
    setSelectedFile(file)
    setActionMessage('')
    setActionError(null)
    if (!file) return

    const fileError = validateCurriculumCsvFile(file)
    if (fileError) setActionError(clientFailure(fileError.status, fileError.code, fileError.message))
  }

  async function importCurriculum() {
    if (!canWriteCatalog || !selectedFile || actionError) return
    setActionPending(true)
    setActionMessage('')
    setActionError(null)
    try {
      const created = await client.importCsv(selectedFile, accessToken)
      setDrafts((current) => [created, ...current.filter((draft) => draft.id !== created.id)])
      setSelectedFile(null)
      setActionMessage(`Borrador creado: versión ${created.curriculumVersion}.`)
      setSelectedDraft(null)
    } catch (error) {
      setActionError(asApiFailure(error))
    } finally {
      setActionPending(false)
    }
  }

  async function reviewCurriculum(curriculumId: string) {
    setReviewingDraftId(curriculumId)
    setSelectedDraft(null)
    setActionMessage('')
    setActionError(null)
    try {
      setSelectedDraft(await client.getCurriculum(curriculumId, accessToken))
    } catch (error) {
      setActionError(asApiFailure(error))
    } finally {
      setReviewingDraftId('')
    }
  }

  async function publishCurriculum(curriculumId: string) {
    if (!canWriteCatalog) return
    setActionPending(true)
    setActionMessage('')
    setActionError(null)
    try {
      const published = await client.publishCurriculum(curriculumId, accessToken)
      setDrafts((current) => current.filter((draft) => draft.id !== curriculumId))
      setSelectedDraft(null)
      setActionMessage(`Currículo publicado: versión ${published.curriculum.curriculumVersion}.`)
      setDraftsState('loading')
      setDraftRefresh((current) => current + 1)
      onPublished()
    } catch (error) {
      setActionError(asApiFailure(error))
    } finally {
      setActionPending(false)
    }
  }

  function retryDrafts() {
    setDraftsState('loading')
    setDraftsError('')
    setDraftRefresh((count) => count + 1)
  }

  return (
    <section className="catalog-admin" aria-labelledby="catalog-admin-title">
      <CatalogAdminHeading />
      <div className="catalog-admin-grid">
        {canWriteCatalog && (
          <section className="catalog-upload-card" aria-labelledby="catalog-upload-title">
            <p className="catalog-eyebrow">IMPORTAR PLAN</p>
            <h3 id="catalog-upload-title">Crear borrador desde CSV</h3>
            <p>El archivo completo se valida antes de guardarse. Límite: 2 MiB.</p>
            <label className="catalog-file-picker" htmlFor="catalog-csv-file">
              <span className="catalog-file-icon" aria-hidden="true">↑</span>
              <span><strong>{selectedFile?.name ?? 'Seleccionar archivo CSV'}</strong><small>UTF-8 · máximo 2 MiB</small></span>
              <span className="catalog-file-action">Elegir</span>
            </label>
            <input
              accept=".csv,text/csv,application/vnd.ms-excel"
              className="catalog-file-input"
              id="catalog-csv-file"
              onChange={chooseFile}
              type="file"
            />
            <button
              className="catalog-button catalog-button-primary"
              disabled={!selectedFile || Boolean(actionError) || actionPending}
              onClick={importCurriculum}
              type="button"
            >
              {actionPending ? 'Procesando…' : 'Importar borrador'} <span aria-hidden="true">→</span>
            </button>
          </section>
        )}

        <section className="catalog-drafts-card" aria-labelledby="catalog-drafts-title">
          <div className="catalog-drafts-heading"><div><p className="catalog-eyebrow">REVISIÓN</p><h3 id="catalog-drafts-title">Borradores</h3></div><span className="catalog-count">{drafts.length.toString().padStart(2, '0')}</span></div>
          {draftsState === 'loading' && <p className="catalog-loading" role="status">Cargando borradores…</p>}
          {draftsState === 'error' && <div className="catalog-inline-error" role="alert"><p>{draftsError}</p><button className="catalog-button catalog-button-secondary" onClick={retryDrafts} type="button">Reintentar</button></div>}
          {draftsState === 'ready' && drafts.length === 0 && <p className="catalog-drafts-empty">No hay borradores pendientes de revisión.</p>}
          {drafts.length > 0 && (
            <ul className="catalog-draft-list">
              {drafts.map((draft) => (
                <li className="catalog-draft-row" key={draft.id}>
                  <span className="catalog-draft-status" aria-hidden="true">●</span>
                  <span className="catalog-draft-copy"><strong>{draft.programName}</strong><small>Versión {draft.curriculumVersion} · cohorte {draft.cohortFrom}</small></span>
                  <button className="catalog-button catalog-button-secondary" disabled={reviewingDraftId === draft.id} onClick={() => reviewCurriculum(draft.id)} type="button">
                    {reviewingDraftId === draft.id ? 'Abriendo…' : `Revisar ${draft.curriculumVersion}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedDraft && (
        <section className="catalog-review-card" aria-labelledby="catalog-review-title">
          <div className="catalog-review-heading"><div><p className="catalog-eyebrow">REVISIÓN DEL BORRADOR</p><h3 id="catalog-review-title">{selectedDraft.curriculum.programName} · {selectedDraft.curriculum.curriculumVersion}</h3><p>Cohorte {cohortLabel(selectedDraft.curriculum)}</p></div>
            {canWriteCatalog && <button className="catalog-button catalog-button-primary" disabled={actionPending} onClick={() => publishCurriculum(selectedDraft.curriculum.id)} type="button">{actionPending ? 'Publicando…' : `Publicar ${selectedDraft.curriculum.curriculumVersion}`}</button>}
          </div>
          <div className="catalog-review-table-wrap">
            <table className="catalog-review-table"><caption>Actividades curriculares del plan en revisión</caption>
              <thead><tr><th scope="col">Semestre</th><th scope="col">Código</th><th scope="col">Asignatura</th><th scope="col">Créditos</th><th scope="col">Espacio</th><th scope="col">Componente</th></tr></thead>
              <tbody>{selectedDraft.entries.map((entry) => <tr key={`${entry.subjectRevisionId}-${entry.rowOrder}`}><td>{entry.semester}</td><td>{entry.subjectCode}</td><td>{entry.subjectName}</td><td>{entry.credits}</td><td>{entry.formationSpace}</td><td>{entry.component}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {actionMessage && <p className="catalog-action-success" role="status">{actionMessage}</p>}
      {actionError && <ActionError error={actionError} />}
    </section>
  )
}

function LockedCatalogAdministration() {
  return (
    <section className="catalog-admin" aria-labelledby="catalog-admin-title">
      <CatalogAdminHeading />
      <div className="catalog-admin-locked" role="status">
        <span aria-hidden="true">◌</span>
        <div><strong>Funciones administrativas cerradas</strong><p>La revisión de borradores y las acciones de publicación requieren acceso y permisos institucionales.</p></div>
        <span className="catalog-locked-tag">Sin sesión institucional</span>
      </div>
    </section>
  )
}

function CatalogAdminHeading() {
  return (
    <div className="catalog-admin-heading">
      <div className="catalog-admin-mark" aria-hidden="true">⌘</div>
      <div><p className="catalog-eyebrow">GESTIÓN ACADÉMICA</p><h2 id="catalog-admin-title">Administración del catálogo</h2></div>
      <span className="catalog-admin-lock">◈ <span>Acceso controlado</span></span>
    </div>
  )
}

function CurriculumCard({ curriculum }: { curriculum: AcademicCurriculum }) {
  return (
    <article className="catalog-curriculum-card" aria-label={`Versión ${curriculum.curriculumVersion}`}>
      <div className="catalog-curriculum-card-top"><span className="catalog-version-label">VERSIÓN</span><span className="catalog-published-indicator"><i aria-hidden="true" /> Publicado</span></div>
      <h3>{curriculum.curriculumVersion}</h3>
      <div className="catalog-cohort-band"><span aria-hidden="true">◷</span><span><small>COHORTE</small><strong>{cohortLabel(curriculum)}</strong></span><span className="catalog-card-arrow" aria-hidden="true">↗</span></div>
      <div className="catalog-curriculum-card-bottom"><span>{curriculum.entryCount} actividades</span><span>{curriculum.campusName}</span></div>
    </article>
  )
}

function ActionError({ error }: { error: ApiFailure }) {
  const title = error.status === 403 || error.code === 'forbidden'
    ? 'No tienes permiso para esta acción.'
    : error.status === 401 || error.code === 'unauthorized'
      ? 'Tu acceso institucional no está autenticado.'
      : error.status === 409 || error.code === 'curriculum_conflict'
        ? 'El borrador ya cambió de estado. Actualiza la lista y revisa su versión actual.'
        : error.code === 'file_too_large' || error.status === 413
          ? 'El archivo supera el límite de 2 MiB.'
          : error.code === 'unsupported_file_type'
            ? 'Selecciona un archivo con formato CSV.'
            : error.message || 'No se pudo completar la acción.'

  return (
    <div className="catalog-action-error" role="alert">
      <strong>{title}</strong>
      {error.issues && error.issues.length > 0 && (
        <ul>{error.issues.map((issue, index) => <li key={`${issue.rowNumber}-${issue.column}-${index}`}>{issue.rowNumber ? `Fila ${issue.rowNumber}` : 'Archivo'}{issue.column ? ` · ${issue.column}` : ''} · {issue.code}</li>)}</ul>
      )}
    </div>
  )
}

function cohortLabel(curriculum: AcademicCurriculum): string {
  return `${curriculum.cohortFrom}${curriculum.cohortThrough ? ` — ${curriculum.cohortThrough}` : ' — sin término definido'}`
}

function clientFailure(status: number, code: string, message: string): ApiFailure {
  return Object.assign(new Error(message), { status, code, issues: [] as readonly AcademicCatalogIssue[] })
}

function asApiFailure(error: unknown): ApiFailure {
  if (error instanceof Error) {
    const candidate = error as ApiFailure
    return {
      message: candidate.message,
      name: candidate.name,
      status: candidate.status,
      code: candidate.code,
      issues: Array.isArray(candidate.issues) ? candidate.issues : [],
    }
  }
  return clientFailure(0, 'request_failed', 'No se pudo completar la solicitud. Comprueba la conexión e inténtalo de nuevo.')
}
