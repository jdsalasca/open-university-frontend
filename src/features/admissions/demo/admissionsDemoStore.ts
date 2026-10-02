import { createStore } from 'zustand/vanilla'

export const ADMISSIONS_DEMO_PROGRAM_OPTIONS = [
  { id: 'demo-program-a', label: 'Programa ficticio A' },
  { id: 'demo-program-b', label: 'Programa ficticio B' },
  { id: 'demo-program-c', label: 'Programa ficticio C' },
] as const

export type AdmissionsDemoProgramId = typeof ADMISSIONS_DEMO_PROGRAM_OPTIONS[number]['id']
export type AdmissionsDemoReviewStatus = 'DEMO_RECEIVED' | 'DEMO_REVIEWING' | 'DEMO_REVIEW_COMPLETE'

export interface AdmissionsDemoApplication {
  reference: string
  firstChoiceId: AdmissionsDemoProgramId
  secondChoiceId: AdmissionsDemoProgramId
  hasReviewedDemoNotice: true
  confirmedSyntheticOptions: true
  status: AdmissionsDemoReviewStatus
}

export interface NewAdmissionsDemoApplication {
  firstChoiceId: AdmissionsDemoProgramId
  secondChoiceId: AdmissionsDemoProgramId
  hasReviewedDemoNotice: boolean
  confirmedSyntheticOptions: boolean
}

export interface AdmissionsDemoState {
  applications: AdmissionsDemoApplication[]
  addApplication(application: NewAdmissionsDemoApplication): AdmissionsDemoApplication
  transitionReview(reference: string, status: AdmissionsDemoReviewStatus): void
  resetDemo(): void
}

const INITIAL_DEMO_APPLICATIONS: AdmissionsDemoApplication[] = [
  {
    reference: 'DEMO-0001',
    firstChoiceId: 'demo-program-a',
    secondChoiceId: 'demo-program-b',
    hasReviewedDemoNotice: true,
    confirmedSyntheticOptions: true,
    status: 'DEMO_RECEIVED',
  },
  {
    reference: 'DEMO-0002',
    firstChoiceId: 'demo-program-b',
    secondChoiceId: 'demo-program-c',
    hasReviewedDemoNotice: true,
    confirmedSyntheticOptions: true,
    status: 'DEMO_REVIEWING',
  },
]

const ALLOWED_REVIEW_TRANSITIONS: Record<AdmissionsDemoReviewStatus, AdmissionsDemoReviewStatus | null> = {
  DEMO_RECEIVED: 'DEMO_REVIEWING',
  DEMO_REVIEWING: 'DEMO_REVIEW_COMPLETE',
  DEMO_REVIEW_COMPLETE: null,
}

const VALID_PROGRAM_IDS = new Set<string>(ADMISSIONS_DEMO_PROGRAM_OPTIONS.map((option) => option.id))

function cloneInitialApplications(): AdmissionsDemoApplication[] {
  return INITIAL_DEMO_APPLICATIONS.map((application) => ({ ...application }))
}

function validateNewApplication(application: NewAdmissionsDemoApplication) {
  if (!VALID_PROGRAM_IDS.has(application.firstChoiceId) || !VALID_PROGRAM_IDS.has(application.secondChoiceId)) {
    throw new Error('Selecciona opciones ficticias disponibles para la demostración.')
  }
  if (application.firstChoiceId === application.secondChoiceId) {
    throw new Error('Elige opciones diferentes para la demostración.')
  }
  if (!application.hasReviewedDemoNotice || !application.confirmedSyntheticOptions) {
    throw new Error('Confirma el aviso y las opciones ficticias antes de continuar.')
  }
}

export function createAdmissionsDemoStore() {
  let nextReferenceSequence = INITIAL_DEMO_APPLICATIONS.length + 1

  return createStore<AdmissionsDemoState>()((set, get) => ({
    applications: cloneInitialApplications(),
    addApplication: (application) => {
      validateNewApplication(application)
      const created: AdmissionsDemoApplication = {
        reference: `DEMO-${String(nextReferenceSequence).padStart(4, '0')}`,
        firstChoiceId: application.firstChoiceId,
        secondChoiceId: application.secondChoiceId,
        hasReviewedDemoNotice: true,
        confirmedSyntheticOptions: true,
        status: 'DEMO_RECEIVED',
      }
      nextReferenceSequence += 1
      set((state) => ({ applications: [created, ...state.applications] }))
      return created
    },
    transitionReview: (reference, status) => {
      const current = get().applications.find((application) => application.reference === reference)
      if (!current) throw new Error('No existe esa ficha sintética en la bandeja local.')
      if (ALLOWED_REVIEW_TRANSITIONS[current.status] !== status) {
        throw new Error('Transición demo no permitida.')
      }
      set((state) => ({
        applications: state.applications.map((application) => application.reference === reference
          ? { ...application, status }
          : application),
      }))
    },
    resetDemo: () => {
      nextReferenceSequence = INITIAL_DEMO_APPLICATIONS.length + 1
      set({ applications: cloneInitialApplications() })
    },
  }))
}
