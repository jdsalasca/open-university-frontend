import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { LibraryApiError } from './libraryClient'
import { libraryClient as defaultLibraryClient } from './libraryClient'
import type { LibraryClient } from './libraryClient'
import type {
  LibraryAuthorization,
  LibraryCopy,
  LibraryLoan,
  LibraryTitle,
} from './libraryContracts'
import './LibraryAdminPage.scss'

interface LibraryAdminPageProps {
  client?: LibraryClient
  authorization: LibraryAuthorization | null
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

const LOAD_ERROR = 'No fue posible consultar la biblioteca. Verifica tu sesión y vuelve a intentarlo.'
const ACTION_ERROR = 'No fue posible completar la operación. Revisa los datos e inténtalo de nuevo.'
const REJECTED_ERROR = 'El servidor rechazó la sesión y no fue posible revalidarla. Inicia sesión de nuevo.'

export function LibraryAdminPage({ client = defaultLibraryClient, authorization, onAuthorizationRejected }: LibraryAdminPageProps) {
  if (!authorization?.canRead) return null
  return <LibraryAdminPageContent
    key={authorization.accessToken}
    client={client}
    authorization={authorization}
    onAuthorizationRejected={onAuthorizationRejected}
  />
}

function LibraryAdminPageContent({
  client,
  authorization,
  onAuthorizationRejected,
}: {
  client: LibraryClient
  authorization: LibraryAuthorization
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}) {
  const { accessToken, canWrite } = authorization
  const [openLoans, setOpenLoans] = useState<LibraryLoan[]>([])
  const [titles, setTitles] = useState<LibraryTitle[]>([])
  const [copies, setCopies] = useState<LibraryCopy[]>([])
  const [selectedTitleId, setSelectedTitleId] = useState('')
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [withdrawReference, setWithdrawReference] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  /** A refused bearer means the cached permissions are stale, so the institutional session is revalidated. */
  const reportAuthorizationRejection = useCallback(async (error: unknown) => {
    if (error instanceof LibraryApiError && (error.status === 401 || error.status === 403)) {
      try {
        await onAuthorizationRejected?.(accessToken)
      } catch {
        setLoadError(REJECTED_ERROR)
      }
    }
  }, [accessToken, onAuthorizationRejected])

  const fetchCatalogue = useCallback(async (signal: AbortSignal) => {
    try {
      const [loans, catalogue] = await Promise.all([
        client.getOpenLoans(accessToken, signal),
        client.getTitles(accessToken, signal),
      ])
      if (signal.aborted) return
      setOpenLoans(loans)
      setTitles(catalogue)
      setLoadError(null)
      setLoadState('ready')
    } catch (error) {
      if (signal.aborted) return
      setLoadError(error instanceof LibraryApiError && error.status === 401
        ? 'La sesión no autoriza la lectura de la biblioteca.'
        : LOAD_ERROR)
      setLoadState('error')
      await reportAuthorizationRejection(error)
    }
  }, [accessToken, client, reportAuthorizationRejection])

  useEffect(() => {
    const controller = new AbortController()
    // Deferred so the initial load is not a synchronous setState inside the effect.
    const handle = setTimeout(() => { void fetchCatalogue(controller.signal) }, 0)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [fetchCatalogue])

  function reload() {
    setLoadState('loading')
    setLoadError(null)
    void fetchCatalogue(new AbortController().signal)
  }

  const selectTitle = useCallback(async (titleId: string) => {
    setSelectedTitleId(titleId)
    setCopies([])
    setActionError(null)
    if (!titleId) return
    try {
      setCopies(await client.getCopies(titleId, accessToken))
    } catch (error) {
      setActionError(LOAD_ERROR)
      await reportAuthorizationRejection(error)
    }
  }, [accessToken, client, reportAuthorizationRejection])

  async function withdraw(copyId: string) {
    if (!canWrite || withdrawReference.trim().length === 0) return
    setActionError(null)
    setWithdrawing(true)
    try {
      await client.withdrawCopy(copyId, withdrawReference.trim(), accessToken)
      setCopies(await client.getCopies(selectedTitleId, accessToken))
      setWithdrawReference('')
    } catch (error) {
      setActionError(ACTION_ERROR)
      await reportAuthorizationRejection(error)
    } finally {
      setWithdrawing(false)
    }
  }

  async function registerTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite) return
    const form = new FormData(event.currentTarget)
    setActionError(null)
    try {
      await client.registerTitle({
        title: String(form.get('title') ?? '').trim(),
        authors: [String(form.get('author') ?? '').trim()].filter((author) => author.length > 0),
        edition: String(form.get('edition') ?? '').trim(),
        publicationYear: form.get('publicationYear') ? Number(form.get('publicationYear')) : null,
        sourceReference: String(form.get('reference') ?? '').trim(),
      }, accessToken)
      event.currentTarget.reset()
      await fetchCatalogue(new AbortController().signal)
    } catch (error) {
      setActionError(ACTION_ERROR)
      await reportAuthorizationRejection(error)
    }
  }

  async function registerCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || !selectedTitleId) return
    const form = new FormData(event.currentTarget)
    setActionError(null)
    try {
      await client.registerCopy(selectedTitleId, {
        barcode: String(form.get('barcode') ?? '').trim(),
        location: String(form.get('location') ?? '').trim(),
        sourceReference: String(form.get('reference') ?? '').trim(),
      }, accessToken)
      event.currentTarget.reset()
      await selectTitle(selectedTitleId)
    } catch (error) {
      setActionError(ACTION_ERROR)
      await reportAuthorizationRejection(error)
    }
  }

  return (
    <section className="library-admin" aria-labelledby="library-admin-title">
      <header className="library-admin-heading">
        <p className="library-admin-kicker">SERVICIOS BIBLIOGRÁFICOS</p>
        <h2 id="library-admin-title">Biblioteca</h2>
        <p>Catálogo, ejemplares en circulación y préstamos pendientes. No registra datos personales de lectores.</p>
      </header>

      {loadState === 'loading' && <p className="library-status" role="status">Consultando la biblioteca…</p>}
      {loadState === 'error' && <div className="library-error" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={reload}>Reintentar</button>
      </div>}
      {actionError && <p className="library-error" role="alert">{actionError}</p>}

      {loadState === 'ready' && <>
        <section className="library-section" aria-labelledby="library-open-loans-title">
          <h3 id="library-open-loans-title">Préstamos pendientes</h3>
          {openLoans.length === 0
            ? <p className="library-empty">No hay ejemplares pendientes de devolución.</p>
            : <ul className="library-loans">
              {openLoans.map((loan) => (
                <li key={loan.loanId} className="library-loan">
                  <span className="library-loan-due">
                    <span className="library-loan-caption">Vence</span>
                    <time dateTime={loan.dueOn}>{loan.dueOn}</time>
                  </span>
                  {loan.overdue && <span className="library-loan-overdue">Vencido</span>}
                  <span className="library-loan-reference">{loan.sourceReference}</span>
                </li>
              ))}
            </ul>}
        </section>

        <section className="library-section" aria-labelledby="library-catalogue-title">
          <h3 id="library-catalogue-title">Catálogo</h3>
          {titles.length === 0
            ? <p className="library-empty">Todavía no hay títulos registrados.</p>
            : <>
              <label className="library-field">
                <span>Seleccionar título</span>
                <select
                  aria-label="Seleccionar título"
                  value={selectedTitleId}
                  onChange={(event) => void selectTitle(event.currentTarget.value)}
                >
                  <option value="">Selecciona un título</option>
                  {titles.map((title) => (
                    <option key={title.titleId} value={title.titleId}>
                      {title.title}{title.edition ? ` · ${title.edition}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTitleId && (copies.length === 0
                ? <p className="library-empty">Este título no tiene ejemplares registrados.</p>
                : <ul className="library-copies">
                  {copies.map((copy) => (
                    <li key={copy.copyId} className="library-copy">
                      <span className="library-copy-barcode">{copy.barcode}</span>
                      <span className="library-copy-location">{copy.location}</span>
                      <span className={copy.active ? 'library-copy-active' : 'library-copy-inactive'}>
                        {copy.active
                          ? 'En circulación'
                          : copy.withdrawnReference
                            ? `Retirado · ${copy.withdrawnReference}`
                            : 'Retirado'}
                      </span>
                      {canWrite && copy.active && (
                        <button
                          type="button"
                          disabled={withdrawing || withdrawReference.trim().length === 0}
                          onClick={() => void withdraw(copy.copyId)}
                        >
                          Retirar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>)}
            </>}
        </section>
      </>}

      {canWrite && (
        <section className="library-section" aria-labelledby="library-register-title">
          <h3 id="library-register-title">Registrar</h3>

          <form className="library-form" onSubmit={(event) => void registerTitle(event)}>
            <h4>Nuevo título</h4>
            <label className="library-field"><span>Título de la obra</span>
              <input name="title" required maxLength={240} /></label>
            <label className="library-field"><span>Autor</span>
              <input name="author" required maxLength={160} /></label>
            <label className="library-field"><span>Edición</span>
              <input name="edition" required maxLength={80} /></label>
            <label className="library-field"><span>Año</span>
              <input name="publicationYear" type="number" min={1450} max={2200} /></label>
            <label className="library-field"><span>Referencia institucional</span>
              <input name="reference" required maxLength={240} /></label>
            <button type="submit">Registrar título</button>
          </form>

          {selectedTitleId && (
            <form className="library-form" onSubmit={(event) => void registerCopy(event)}>
              <h4>Nuevo ejemplar</h4>
              <label className="library-field"><span>Código de barras</span>
                <input name="barcode" required maxLength={48} /></label>
              <label className="library-field"><span>Ubicación</span>
                <input name="location" required maxLength={120} /></label>
              <label className="library-field"><span>Referencia institucional</span>
                <input name="reference" required maxLength={240} /></label>
              <button type="submit">Registrar ejemplar</button>
            </form>
          )}

          <label className="library-field">
            <span>Referencia institucional del retiro</span>
            <input
              aria-label="Referencia institucional del retiro"
              value={withdrawReference}
              maxLength={240}
              onChange={(event) => setWithdrawReference(event.currentTarget.value)}
            />
          </label>
          <p className="library-hint">La referencia es obligatoria para retirar un ejemplar de circulación.</p>
        </section>
      )}
    </section>
  )
}
