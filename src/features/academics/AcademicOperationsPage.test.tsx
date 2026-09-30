import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicProgram } from './contracts'
import type { AcademicOperationsClient, AcademicPeriod, AcademicStructureSnapshot } from './academicOperationsContracts'

const pageModules = import.meta.glob<typeof import('./AcademicOperationsPage')>('./AcademicOperationsPage.tsx')

async function loadPage() {
  const loader = pageModules['./AcademicOperationsPage.tsx']
  expect(loader, 'the academic operations page is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const structure: AcademicStructureSnapshot = {
  units: [
    {
      id: 'fae06170-9acf-4718-854e-92e945a7db17',
      code: 'FAC-CIENCIAS',
      type: 'FACULTY',
      displayName: 'Facultad de Ciencias',
      displayOrder: 2,
      status: 'ACTIVE',
      validFrom: '2026-01-01',
      validThrough: null,
    },
    {
      id: '127d89c9-a72a-436a-9a90-26da60bc9570',
      code: 'ESC-SISTEMAS',
      type: 'SCHOOL',
      displayName: 'Escuela de Sistemas',
      displayOrder: 1,
      status: 'ACTIVE',
      validFrom: '2026-01-01',
      validThrough: null,
    },
  ],
  organizationRelations: [{
    parentUnitId: 'fae06170-9acf-4718-854e-92e945a7db17',
    childUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
    validFrom: '2026-01-01',
    validThrough: null,
  }],
  sites: [{
    id: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    code: 'TUNJA',
    type: 'CENTRAL',
    displayName: 'Sede Central Tunja',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  }],
  siteRelations: [],
  programAffiliations: [{
    id: '8ab62b62-b65b-4b70-9bf0-df868abfe7eb',
    programId: 'b31e24c4-4b0e-4b79-8480-ae5f26105646',
    organizationUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
    siteId: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    displayOrder: 1,
    validFrom: '2026-01-01',
    validThrough: null,
    sourceReference: 'Resolución de prueba',
  }],
}

const regularPeriod: AcademicPeriod = {
  id: 'fb750786-79cc-49cf-9814-0f1047c76ba4',
  code: '2026-2',
  kind: 'REGULAR',
  academicYear: 2026,
  sequenceNumber: 2,
  startsOn: '2026-07-15',
  endsOn: '2026-12-18',
  status: 'OPEN',
  calendarRevisionId: '7ecfa4a1-52f6-4b56-9b3c-8fc0cebdc98f',
  calendarRevisionNumber: 1,
  approvalReference: 'Acuerdo de calendario institucional de prueba',
  officialReference: 'Calendario institucional de prueba',
  createdAt: '2026-06-15T10:00:00Z',
}

const intersemester: AcademicPeriod = {
  ...regularPeriod,
  id: '92e76bd6-d8c9-4c28-a6c9-7e54f69668bb',
  code: '2026-INT-1',
  kind: 'INTERSEMESTRAL',
  sequenceNumber: 1,
  startsOn: '2026-06-01',
  endsOn: '2026-06-30',
}

const programs: AcademicProgram[] = [{
  id: 'b31e24c4-4b0e-4b79-8480-ae5f26105646',
  programCode: 'ING-SIS',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'LEGACY-DUITAMA',
  programName: 'Ingeniería de Sistemas',
  faculty: 'Texto legado que no se usa como relación',
  campusName: 'Texto legado que no se usa como relación',
}, {
  id: '8a751e5d-65ad-4a33-b48c-d95ae7b07915',
  programCode: 'AAA-PROG',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'LEGACY-BOGOTA',
  programName: 'Programa ordenado después',
  faculty: 'Texto legado que no se usa como relación',
  campusName: 'Texto legado que no se usa como relación',
}]

const structureWithOrderedPrograms: AcademicStructureSnapshot = {
  ...structure,
  programAffiliations: [
    ...structure.programAffiliations,
    {
      ...structure.programAffiliations[0]!,
      id: 'c4011f06-4a61-42f2-8e28-24b71ff8ee12',
      programId: '8a751e5d-65ad-4a33-b48c-d95ae7b07915',
      displayOrder: 9,
    },
  ],
}

function createClient(overrides: Partial<AcademicOperationsClient> = {}): AcademicOperationsClient {
  return {
    getStructure: vi.fn().mockResolvedValue(structure),
    getOpenPeriods: vi.fn().mockResolvedValue([regularPeriod, intersemester]),
    ...overrides,
  }
}

describe('AcademicOperationsPage', () => {
  it('orders the hierarchy and uses normalized affiliations while distinguishing regular and intersemester periods', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient({ getStructure: vi.fn().mockResolvedValue(structureWithOrderedPrograms) })
    render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Act
    const title = await screen.findByRole('heading', { name: /estructura y periodos académicos/i })

    // Assert
    expect(title).toBeVisible()
    expect(screen.getByText('Facultad de Ciencias')).toBeVisible()
    expect(screen.getByText('Escuela de Sistemas')).toBeVisible()
    expect(screen.getByText('Ingeniería de Sistemas')).toBeVisible()
    expect(screen.getByText('ING-SIS')).toBeVisible()
    expect(screen.getByText('Sede Central Tunja')).toBeVisible()
    expect(screen.getAllByText('Sede Central Tunja · TUNJA')).toHaveLength(2)
    expect(screen.queryByText('LEGACY-DUITAMA')).not.toBeInTheDocument()
    expect(screen.queryByText('LEGACY-BOGOTA')).not.toBeInTheDocument()
    expect(screen.getByText('ING-SIS').closest('li')?.nextElementSibling).toHaveTextContent('AAA-PROG')
    expect(screen.getByText('Período regular')).toBeVisible()
    expect(screen.getByText('Intersemestral')).toBeVisible()
    expect(screen.getByText(/el semestre indicado en una malla curricular es distinto del periodo académico/i)).toBeVisible()
    expect(screen.getByText(/requiere una sesión institucional/i)).toBeVisible()
    expect(client.getStructure).toHaveBeenCalledOnce()
    expect(client.getOpenPeriods).toHaveBeenCalledOnce()
  })

  it('shows explicit empty states instead of sample programs or periods', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient({
      getStructure: vi.fn().mockResolvedValue({
        units: [], organizationRelations: [], sites: [], siteRelations: [], programAffiliations: [],
      }),
      getOpenPeriods: vi.fn().mockResolvedValue([]),
    })
    render(<AcademicOperationsPage client={client} loadPrograms={async () => []} />)

    // Act + Assert
    expect(await screen.findByText(/no hay unidades cargadas/i)).toBeVisible()
    expect(screen.getByText(/no hay periodos académicos abiertos/i)).toBeVisible()
    expect(screen.queryByText(/Ingeniería de Sistemas/)).not.toBeInTheDocument()
  })

  it('lets the user retry a failed public request', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const getStructure = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(structure)
    const client = createClient({ getStructure })
    render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Act
    await user.click(await screen.findByRole('button', { name: /intentar de nuevo/i }))

    // Assert
    expect(await screen.findByText('Ingeniería de Sistemas')).toBeVisible()
    expect(getStructure).toHaveBeenCalledTimes(2)
  })
})
