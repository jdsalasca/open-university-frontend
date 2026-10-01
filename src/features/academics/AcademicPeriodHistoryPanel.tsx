import { useEffect, useRef, useState } from 'react'
import type { AcademicOperationsClient, AcademicPeriod, AcademicPeriodAuditAction, AcademicPeriodHistory } from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import './AcademicPeriodHistoryPanel.scss'

type LoadState = 'loading' | 'ready' | 'error'

interface AcademicPeriodHistoryPanelProps {
  period: AcademicPeriod
  accessToken: string
  client: Pick<AcademicOperationsClient, 'getPeriodHistory'>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

export function AcademicPeriodHistoryPanel({
  period,
  accessToken,
  client,
  onAuthorizationRejected,
}: AcademicPeriodHistoryPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState<AcademicPeriodHistory | null>(null)
  const [state, setState] = useState<LoadState | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => requestControllerRef.current?.abort()
  }, [])

  async function loadHistory() {
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setHistory(null)
    setState('loading')
    try {
      const result = await client.getPeriodHistory(period.id, accessToken, controller.signal)
      if (controller.signal.aborted) return
      setHistory(result)
      setState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setState('error')
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        try {
          await onAuthorizationRejected?.(accessToken)
        } catch {
          // The identity shell owns session recovery; the panel keeps history unavailable.
        }
      }
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }

  function toggleHistory() {
    if (expanded) {
      requestControllerRef.current?.abort()
      requestControllerRef.current = null
      setHistory(null)
      setState(null)
      setExpanded(false)
    } else {
      setExpanded(true)
      void loadHistory()
    }
  }

  const panelId = `academic-period-history-${period.id}`
  return (
    <div className="academic-period-history">
      <button
        className="academic-period-history-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggleHistory}
      >{expanded ? 'Ocultar historial' : `Ver historial de ${period.code}`}</button>
      <section id={panelId} className="academic-period-history-content" aria-label={`Historial de ${period.code}`} hidden={!expanded}>
        {state === 'loading' && <p className="academic-period-history-message" role="status">Consultando revisiones y movimientos auditados…</p>}
        {state === 'error' && <div className="academic-period-history-error" role="alert">
          <p>No fue posible consultar el historial. Verifica tu sesión y vuelve a intentarlo.</p>
          <button type="button" onClick={() => void loadHistory()}>Reintentar historial</button>
        </div>}
        {state === 'ready' && history && <>
          <section className="academic-period-history-section" aria-labelledby={`${panelId}-calendars`}>
            <h4 id={`${panelId}-calendars`}>Versiones del calendario</h4>
            {history.calendarRevisions.length === 0
              ? <p className="academic-period-history-empty">Este periodo aún no tiene revisiones de calendario.</p>
              : <ol className="academic-period-history-revisions">
                  {history.calendarRevisions.map((revision) => <li key={revision.id}>
                    <strong>Revisión {revision.version}</strong>
                    <span className={`academic-period-history-state revision-${revision.status.toLocaleLowerCase('en-US')}`}>
                      {revision.status === 'PUBLISHED' ? 'Publicada' : 'Borrador'}
                    </span>
                    {revision.officialReference && <p>{revision.officialReference}</p>}
                    {revision.activities.length > 0 && <ul aria-label={`Actividades de revisión ${revision.version}`}>
                      {revision.activities.map((activity) => <li key={`${revision.id}-${activity.key}`}>
                        <span>{activity.label}</span>
                        <time dateTime={activity.startsAt}>{formatInstitutionalDateTime(activity.startsAt)} – {formatInstitutionalDateTime(activity.endsAt)}</time>
                      </li>)}
                    </ul>}
                  </li>)}
                </ol>}
            <p className="academic-period-history-footnote">Las horas corresponden al calendario institucional de Colombia.</p>
          </section>
          <section className="academic-period-history-section" aria-labelledby={`${panelId}-events`}>
            <h4 id={`${panelId}-events`}>Movimientos auditados</h4>
            {history.auditEvents.length === 0
              ? <p className="academic-period-history-empty">No hay movimientos de auditoría registrados.</p>
              : <ol className="academic-period-history-events">
                  {history.auditEvents.map((event) => <li key={event.id}>
                    <strong>{auditActionLabel(event.actionKey)}</strong>
                    <time dateTime={event.occurredAt}>{formatAuditInstant(event.occurredAt)}</time>
                    <span>Actor: {event.actorSub}</span>
                    {event.reference && <span>Referencia: {event.reference}</span>}
                  </li>)}
                </ol>}
          </section>
        </>}
      </section>
    </div>
  )
}

function auditActionLabel(action: AcademicPeriodAuditAction): string {
  const labels: Record<AcademicPeriodAuditAction, string> = {
    PERIOD_CREATED: 'Periodo creado',
    CALENDAR_CREATED: 'Borrador de calendario creado',
    CALENDAR_PUBLISHED: 'Calendario publicado',
    PERIOD_APPROVED: 'Periodo aprobado',
    PERIOD_OPENED: 'Periodo abierto',
    PERIOD_CLOSED: 'Periodo cerrado',
    PERIOD_CANCELLED: 'Periodo cancelado',
    PERIOD_CALENDAR_AMENDED: 'Enmienda de calendario activada',
  }
  return labels[action]
}

function formatAuditInstant(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}

function formatInstitutionalDateTime(value: string): string {
  return value.replace('T', ' ')
}
