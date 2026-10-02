import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type { AdmissionsDemoReviewStatus, AdmissionsDemoState } from './admissionsDemoStore'
import { ADMISSIONS_DEMO_PROGRAM_OPTIONS } from './admissionsDemoStore'

interface AdmissionsAdminDemoProps {
  store: StoreApi<AdmissionsDemoState>
}

const STATUS_LABELS: Record<AdmissionsDemoReviewStatus, string> = {
  DEMO_RECEIVED: 'Recibida · pendiente de revisión demo',
  DEMO_REVIEWING: 'Revisión demo en curso',
  DEMO_REVIEW_COMPLETE: 'Revisión demo finalizada',
}

function getProgramLabel(programId: string): string {
  return ADMISSIONS_DEMO_PROGRAM_OPTIONS.find((program) => program.id === programId)?.label ?? 'Opción ficticia'
}

export function AdmissionsAdminDemo({ store }: AdmissionsAdminDemoProps) {
  const applications = useStore(store, (state) => state.applications)

  return (
    <section className="admissions-lab-view admissions-lab-admin" aria-labelledby="admissions-admin-demo-title">
      <header className="admissions-lab-view-heading">
        <div>
          <p className="admissions-lab-eyebrow">RECORRIDO 02 · EQUIPO</p>
          <h2 id="admissions-admin-demo-title">Una bandeja clara para revisar cada ficha</h2>
          <p>Explora cómo se verían las opciones y el avance de una revisión inicial.</p>
        </div>
        <span className="admissions-lab-inbox-count"><strong>{applications.length}</strong> fichas demo</span>
      </header>

      <div className="admissions-lab-notice admissions-lab-notice-admin" role="note">
        <strong>Vista de muestra, sin acceso institucional</strong>
        <span>Esta bandeja no inicia sesión ni concede permisos. No contiene aspirantes reales y no permite admitir, rechazar ni asignar puntajes.</span>
      </div>

      <section className="admissions-lab-inbox" aria-label="Bandeja ficticia de admisiones">
        {applications.length === 0 ? (
          <div className="admissions-lab-empty-state">
            <span aria-hidden="true">✳</span>
            <h3>Aún no hay fichas sintéticas</h3>
            <p>Cambia a la vista del aspirante y crea una ficha de ejemplo.</p>
          </div>
        ) : (
          <div className="admissions-lab-case-list">
            {applications.map((application) => (
              <article
                className="admissions-lab-case-card"
                key={application.reference}
                aria-label={`Ficha ${application.reference}`}
              >
                <div className="admissions-lab-case-topline">
                  <span className="admissions-lab-case-reference">{application.reference}</span>
                  <span className={`admissions-lab-status admissions-lab-status-${application.status.toLowerCase()}`}>
                    <span aria-hidden="true" />{STATUS_LABELS[application.status]}
                  </span>
                </div>

                <div className="admissions-lab-case-options">
                  <div><small>Primera opción</small><strong>{getProgramLabel(application.firstChoiceId)}</strong></div>
                  <span className="admissions-lab-choice-arrow" aria-hidden="true">→</span>
                  <div><small>Segunda opción</small><strong>{getProgramLabel(application.secondChoiceId)}</strong></div>
                </div>

                <div className="admissions-lab-case-footer">
                  <span>Ficha de ejemplo · datos de ejemplo</span>
                  {application.status === 'DEMO_RECEIVED' && (
                    <button
                      className="admissions-lab-secondary-button"
                      type="button"
                      onClick={() => store.getState().transitionReview(application.reference, 'DEMO_REVIEWING')}
                    >
                      Iniciar revisión demo
                    </button>
                  )}
                  {application.status === 'DEMO_REVIEWING' && (
                    <button
                      className="admissions-lab-secondary-button"
                      type="button"
                      onClick={() => store.getState().transitionReview(application.reference, 'DEMO_REVIEW_COMPLETE')}
                    >
                      Cerrar revisión demo
                    </button>
                  )}
                  {application.status === 'DEMO_REVIEW_COMPLETE' && <span className="admissions-lab-complete-mark">Recorrido demo cerrado</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
