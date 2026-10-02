import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { AdmissionsAdminDemo } from './AdmissionsAdminDemo'
import { AdmissionsApplicantDemo } from './AdmissionsApplicantDemo'
import { createAdmissionsDemoStore } from './admissionsDemoStore'
import './AdmissionsWorkflowLab.scss'

type AdmissionsPerspective = 'applicant' | 'admin' | 'calendar'

interface AdmissionsWorkflowLabProps {
  calendar: ReactNode
}

const TABS: { id: AdmissionsPerspective; label: string }[] = [
  { id: 'applicant', label: 'Aspirante · demo' },
  { id: 'admin', label: 'Equipo de admisiones · demo' },
  { id: 'calendar', label: 'Calendario público' },
]

function panelId(perspective: AdmissionsPerspective) {
  return `admissions-lab-panel-${perspective}`
}

function tabId(perspective: AdmissionsPerspective) {
  return `admissions-lab-tab-${perspective}`
}

export function AdmissionsWorkflowLab({ calendar }: AdmissionsWorkflowLabProps) {
  const [store] = useState(createAdmissionsDemoStore)
  const [activePerspective, setActivePerspective] = useState<AdmissionsPerspective>('applicant')

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = TABS.length - 1
    if (nextIndex === undefined) return

    event.preventDefault()
    const nextTab = TABS[nextIndex]
    setActivePerspective(nextTab.id)
    document.getElementById(tabId(nextTab.id))?.focus()
  }

  return (
    <section className="admissions-workflow-lab" aria-label="Laboratorio de experiencia de admisiones">
      <header className="admissions-lab-shell-header">
        <div className="admissions-lab-shell-copy">
          <span className="admissions-lab-mark" aria-hidden="true">U</span>
          <div>
            <p className="admissions-lab-shell-eyebrow">PLATAFORMA UNIVERSITARIA · ENTORNO LOCAL</p>
            <h1>Admisiones, desde ambas perspectivas</h1>
          </div>
        </div>
        <div className="admissions-lab-dev-badge"><span aria-hidden="true" /> Vista de desarrollo</div>
      </header>

      <div className="admissions-lab-safety-banner" role="note">
        <span className="admissions-lab-safety-icon" aria-hidden="true">i</span>
        <span><strong>Demostración local · datos sintéticos.</strong> No escribas información real: nada se envía ni se guarda al recargar.</span>
        <span className="admissions-lab-memory-indicator"><span aria-hidden="true" />Solo memoria</span>
      </div>

      <div className="admissions-lab-perspective-bar">
        <div className="admissions-lab-perspective-label">
          <span>RECORRIDO INTERACTIVO</span>
          <strong>Explora la experiencia</strong>
        </div>
        <div className="admissions-lab-tabs" role="tablist" aria-label="Perspectivas del flujo de admisiones">
          {TABS.map((tab, index) => (
            <button
              aria-controls={panelId(tab.id)}
              aria-selected={activePerspective === tab.id}
              className={`admissions-lab-tab${activePerspective === tab.id ? ' is-active' : ''}`}
              id={tabId(tab.id)}
              key={tab.id}
              onClick={() => setActivePerspective(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={activePerspective === tab.id ? 0 : -1}
              type="button"
            >
              <span className="admissions-lab-tab-index">0{index + 1}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admissions-lab-content">
        <div
          aria-labelledby={tabId('applicant')}
          className="admissions-lab-tabpanel"
          hidden={activePerspective !== 'applicant'}
          id={panelId('applicant')}
          role="tabpanel"
          tabIndex={0}
        >
          <AdmissionsApplicantDemo store={store} />
        </div>
        <div
          aria-labelledby={tabId('admin')}
          className="admissions-lab-tabpanel"
          hidden={activePerspective !== 'admin'}
          id={panelId('admin')}
          role="tabpanel"
          tabIndex={0}
        >
          <AdmissionsAdminDemo store={store} />
        </div>
        <div
          aria-labelledby={tabId('calendar')}
          className="admissions-lab-tabpanel admissions-lab-calendar-panel"
          hidden={activePerspective !== 'calendar'}
          id={panelId('calendar')}
          role="tabpanel"
          tabIndex={0}
        >
          {calendar}
        </div>
      </div>
    </section>
  )
}
