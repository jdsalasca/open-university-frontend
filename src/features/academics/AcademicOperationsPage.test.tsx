import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicProgram } from './contracts'
import type { AcademicOperationsClient, AcademicPeriod, AcademicStructureSnapshot } from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

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
    displayOrder: 1,
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

const structureWithAllOrderTargets: AcademicStructureSnapshot = {
  ...structure,
  sites: [
    ...structure.sites,
    {
      id: 'bb783bf7-0fbb-48d5-9c49-17240492ef6e',
      code: 'SECCIONAL-CHIQUINQUIRA',
      type: 'SECCIONAL',
      displayName: 'Seccional Chiquinquirá',
      displayOrder: 4,
      status: 'ACTIVE',
      validFrom: '2026-01-01',
      validThrough: null,
    },
  ],
  siteRelations: [{
    parentSiteId: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    childSiteId: 'bb783bf7-0fbb-48d5-9c49-17240492ef6e',
    displayOrder: 4,
    validFrom: '2026-01-01',
    validThrough: null,
  }],
}

function createClient(overrides: Partial<AcademicOperationsClient> = {}): AcademicOperationsClient {
  return {
    getStructure: vi.fn().mockResolvedValue(structure),
    getOpenPeriods: vi.fn().mockResolvedValue([regularPeriod, intersemester]),
    getAdminPeriods: vi.fn().mockResolvedValue([regularPeriod, intersemester]),
    createOrganizationUnit: vi.fn().mockResolvedValue('34a06170-9acf-4718-854e-92e945a7db17'),
    createSite: vi.fn().mockResolvedValue('94a06170-9acf-4718-854e-92e945a7db17'),
    openPeriod: vi.fn().mockImplementation(async (_periodId: string, _accessToken: string) => ({
      ...regularPeriod,
      status: 'OPEN',
    })),
    closePeriod: vi.fn().mockImplementation(async (_periodId: string, _accessToken: string) => ({
      ...regularPeriod,
      status: 'CLOSED',
    })),
    changeOrganizationUnitOrder: vi.fn().mockResolvedValue(undefined),
    changeSiteOrder: vi.fn().mockResolvedValue(undefined),
    changeOrganizationRelationOrder: vi.fn().mockResolvedValue(undefined),
    changeSiteRelationOrder: vi.fn().mockResolvedValue(undefined),
    changeProgramAffiliationOrder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('AcademicOperationsPage', () => {
  it('orders sibling units and sites by relationship order while preserving root order', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const facultyRootFirst = {
      ...structure.units[0]!,
      id: '3378ef0f-1091-4e8b-a7d2-b8c05b7b9b17',
      code: 'FAC-ROOT-FIRST',
      displayName: 'Facultad raíz primero',
      displayOrder: 1,
    }
    const schoolNodeFirst = {
      ...structure.units[1]!,
      id: 'a99f11b6-5fce-40d0-bc57-63da94397e89',
      code: 'ESC-NODE-FIRST',
      displayName: 'Escuela primero por nodo',
      displayOrder: 1,
    }
    const schoolRelationFirst = {
      ...structure.units[1]!,
      id: 'b7ac56e5-210f-4f0a-a4b4-6dbf8f4d5192',
      code: 'ESC-RELATION-FIRST',
      displayName: 'Escuela primero por relación',
      displayOrder: 2,
    }
    const schoolTieZulu = {
      ...structure.units[1]!,
      id: 'c72e5da1-7d8e-463e-8916-d13126c55fb9',
      code: 'ESC-TIE-Z',
      displayName: 'Escuela empate Z',
      displayOrder: 3,
    }
    const schoolTieAlpha = {
      ...structure.units[1]!,
      id: 'b9f98965-b868-4eb6-8e20-02bd74dfef97',
      code: 'ESC-TIE-A',
      displayName: 'Escuela empate A',
      displayOrder: 3,
    }
    const siteRootFirst = {
      ...structure.sites[0]!,
      id: 'f1df48de-5279-4a62-a067-4c0ed5724ebc',
      code: 'SITE-ROOT-FIRST',
      displayName: 'Sede raíz primero',
      displayOrder: 0,
    }
    const siteNodeFirst = {
      ...structure.sites[0]!,
      id: '342f4fd1-353b-4f78-a6d5-695915956efc',
      code: 'SITE-NODE-FIRST',
      type: 'REGIONAL' as const,
      displayName: 'Sede primero por nodo',
      displayOrder: 1,
    }
    const siteRelationFirst = {
      ...structure.sites[0]!,
      id: '9cb298c8-a70a-48dc-a870-24da32191f4d',
      code: 'SITE-RELATION-FIRST',
      type: 'REGIONAL' as const,
      displayName: 'Sede primero por relación',
      displayOrder: 2,
    }
    const siteTieZulu = {
      ...structure.sites[0]!,
      id: '372aab0b-520a-4bf1-9ad9-ed2021483cee',
      code: 'SITE-TIE-Z',
      type: 'REGIONAL' as const,
      displayName: 'Sede empate Z',
      displayOrder: 3,
    }
    const siteTieAlpha = {
      ...structure.sites[0]!,
      id: '8349a8c1-3dcb-4bec-8a1d-4105dbdc8450',
      code: 'SITE-TIE-A',
      type: 'REGIONAL' as const,
      displayName: 'Sede empate A',
      displayOrder: 3,
    }
    const orderedStructure: AcademicStructureSnapshot = {
      ...structure,
      units: [...structure.units, facultyRootFirst, schoolNodeFirst, schoolRelationFirst, schoolTieZulu, schoolTieAlpha],
      organizationRelations: [
        { ...structure.organizationRelations[0]!, displayOrder: 12 },
        {
          parentUnitId: structure.units[0]!.id,
          childUnitId: schoolNodeFirst.id,
          displayOrder: 8,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentUnitId: structure.units[0]!.id,
          childUnitId: schoolRelationFirst.id,
          displayOrder: 2,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentUnitId: structure.units[0]!.id,
          childUnitId: schoolTieZulu.id,
          displayOrder: 5,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentUnitId: structure.units[0]!.id,
          childUnitId: schoolTieAlpha.id,
          displayOrder: 5,
          validFrom: '2026-01-01',
          validThrough: null,
        },
      ],
      sites: [...structure.sites, siteRootFirst, siteNodeFirst, siteRelationFirst, siteTieZulu, siteTieAlpha],
      siteRelations: [
        {
          parentSiteId: structure.sites[0]!.id,
          childSiteId: siteNodeFirst.id,
          displayOrder: 8,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentSiteId: structure.sites[0]!.id,
          childSiteId: siteRelationFirst.id,
          displayOrder: 2,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentSiteId: structure.sites[0]!.id,
          childSiteId: siteTieZulu.id,
          displayOrder: 5,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentSiteId: structure.sites[0]!.id,
          childSiteId: siteTieAlpha.id,
          displayOrder: 5,
          validFrom: '2026-01-01',
          validThrough: null,
        },
      ],
    }
    const client = createClient({ getStructure: vi.fn().mockResolvedValue(orderedStructure) })
    render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Act
    await screen.findByRole('heading', { name: /estructura y periodos académicos/i })

    // Assert
    const organizationRoots = screen.getByRole('list', { name: 'Jerarquía académica' })
    expect(organizationRoots.children[0]).toHaveTextContent('Facultad raíz primero')
    expect(organizationRoots.children[0]?.querySelector('.academic-sort-order')).toHaveTextContent('01')
    const faculty = screen.getByText('Facultad de Ciencias').closest('li')!
    const unitChildren = faculty.querySelector(':scope > ul')!
    expect(unitChildren.children[0]).toHaveTextContent('Escuela primero por relación')
    expect(unitChildren.children[1]).toHaveTextContent('Escuela empate A')
    expect(unitChildren.children[2]).toHaveTextContent('Escuela empate Z')
    expect(unitChildren.children[3]).toHaveTextContent('Escuela primero por nodo')
    expect(unitChildren.children[0]?.querySelector('.academic-sort-order')).toHaveTextContent('02')
    expect(unitChildren.children[1]?.querySelector('.academic-sort-order')).toHaveTextContent('05')
    expect(unitChildren.children[2]?.querySelector('.academic-sort-order')).toHaveTextContent('05')
    expect(unitChildren.children[3]?.querySelector('.academic-sort-order')).toHaveTextContent('08')

    const siteRoots = screen.getByRole('list', { name: 'Jerarquía de sedes' })
    expect(siteRoots.children[0]).toHaveTextContent('Sede raíz primero')
    expect(siteRoots.children[0]?.querySelector('.academic-sort-order')).toHaveTextContent('00')
    const centralSite = screen.getByText('Sede Central Tunja').closest('li')!
    const siteChildren = centralSite.querySelector(':scope > ul')!
    expect(siteChildren.children[0]).toHaveTextContent('Sede primero por relación')
    expect(siteChildren.children[1]).toHaveTextContent('Sede empate A')
    expect(siteChildren.children[2]).toHaveTextContent('Sede empate Z')
    expect(siteChildren.children[3]).toHaveTextContent('Sede primero por nodo')
    expect(siteChildren.children[0]?.querySelector('.academic-sort-order')).toHaveTextContent('02')
    expect(siteChildren.children[1]?.querySelector('.academic-sort-order')).toHaveTextContent('05')
    expect(siteChildren.children[2]?.querySelector('.academic-sort-order')).toHaveTextContent('05')
    expect(siteChildren.children[3]?.querySelector('.academic-sort-order')).toHaveTextContent('08')
  })

  it('shows audited order controls for every active structure relationship only to writers', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient({ getStructure: vi.fn().mockResolvedValue(structureWithAllOrderTargets) })
    const { rerender } = render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Act + Assert: public readers continue to see persisted order without write controls.
    expect(await screen.findByText('Seccional Chiquinquirá')).toBeVisible()
    expect(screen.queryByRole('button', { name: /cambiar orden de/i })).not.toBeInTheDocument()

    // Act: server-resolved structure write permission enables the five supported order targets.
    rerender(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canWrite: true }}
    />)

    // Assert
    for (const name of [
      'Facultad de Ciencias',
      'Escuela de Sistemas',
      'Sede Central Tunja',
      'Seccional Chiquinquirá',
      'Ingeniería de Sistemas',
    ]) {
      expect(await screen.findByRole('button', { name: `Cambiar orden de ${name}` })).toBeVisible()
    }
  })

  it('saves a unit priority with its expected value and source reference, then refreshes from the server', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const updatedStructure: AcademicStructureSnapshot = {
      ...structureWithAllOrderTargets,
      units: structureWithAllOrderTargets.units.map((unit) => unit.id === structure.units[0]!.id
        ? { ...unit, displayOrder: 7 }
        : unit),
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structureWithAllOrderTargets)
      .mockResolvedValueOnce(updatedStructure)
    const changeOrganizationUnitOrder = vi.fn().mockResolvedValue(undefined)
    const client = createClient({ getStructure, changeOrganizationUnitOrder })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cambiar orden de Facultad de Ciencias' }))
    await user.clear(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'))
    await user.type(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'), '7')
    await user.type(screen.getByLabelText('Referencia institucional de Facultad de Ciencias'), 'Resolución 123 de 2026')
    await user.click(screen.getByRole('button', { name: 'Guardar orden de Facultad de Ciencias' }))

    // Assert
    expect(changeOrganizationUnitOrder).toHaveBeenCalledWith(
      structure.units[0]!.id,
      { expectedDisplayOrder: 2, displayOrder: 7, sourceReference: 'Resolución 123 de 2026' },
      'synthetic-structure-token',
    )
    expect(getStructure).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('07')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(/prioridad actualizada/i)
  })

  it('refreshes the displayed structure and reports a concurrent order conflict', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const concurrentStructure: AcademicStructureSnapshot = {
      ...structureWithAllOrderTargets,
      sites: structureWithAllOrderTargets.sites.map((site) => site.id === structure.sites[0]!.id
        ? { ...site, displayOrder: 8 }
        : site),
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structureWithAllOrderTargets)
      .mockResolvedValueOnce(concurrentStructure)
    const changeSiteOrder = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const client = createClient({ getStructure, changeSiteOrder })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cambiar orden de Sede Central Tunja' }))
    await user.clear(screen.getByLabelText('Nuevo orden de Sede Central Tunja'))
    await user.type(screen.getByLabelText('Nuevo orden de Sede Central Tunja'), '5')
    await user.type(screen.getByLabelText('Referencia institucional de Sede Central Tunja'), 'Acta de organización 8')
    await user.click(screen.getByRole('button', { name: 'Guardar orden de Sede Central Tunja' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/estructura cambió|prioridad cambió/i)
    expect(getStructure).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('08')).toBeVisible()
    expect(changeSiteOrder).toHaveBeenCalledOnce()
  })

  it('rejects a negative order before sending a structure mutation', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const changeOrganizationUnitOrder = vi.fn().mockResolvedValue(undefined)
    const client = createClient({ changeOrganizationUnitOrder })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cambiar orden de Facultad de Ciencias' }))
    await user.clear(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'))
    await user.type(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'), '-1')
    fireEvent.submit(screen.getByRole('form', { name: 'Editar orden de Facultad de Ciencias' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/entero entre 0 y 100000/i)
    expect(changeOrganizationUnitOrder).not.toHaveBeenCalled()
  })

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
    expect(screen.getByText(/el semestre de una malla curricular es distinto del periodo académico/i)).toBeVisible()
    expect(screen.getByText(/requieren permiso institucional de escritura/i)).toBeVisible()
    expect(client.getStructure).toHaveBeenCalledOnce()
    expect(client.getOpenPeriods).toHaveBeenCalledOnce()
    expect(client.getAdminPeriods).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /abrir periodo|cerrar periodo/i })).not.toBeInTheDocument()
  })

  it('requires an explicit confirmation and period write permission to open a period', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const approved = { ...regularPeriod, status: 'APPROVED' as const }
    const openPeriod = vi.fn().mockResolvedValue({ ...approved, status: 'OPEN' as const })
    const client = createClient({
      getAdminPeriods: vi.fn().mockResolvedValue([approved]),
      openPeriod,
    })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-access-token', canRead: true, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Abrir periodo 2026-2' }))

    // Assert: require explicit confirmation and explain the limited effect.
    expect(screen.getByText(/solo cambiará el estado del periodo; no publicará oferta ni abrirá matrículas/i)).toBeVisible()
    expect(openPeriod).not.toHaveBeenCalled()

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirmar apertura' }))

    // Assert
    expect(openPeriod).toHaveBeenCalledWith(approved.id, 'synthetic-access-token')
    expect(await screen.findByText('Abierto')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(/el periodo 2026-2 quedó abierto/i)
  })

  it('refreshes the active calendar and requires a new confirmation after a stale close conflict', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const amendedPeriod = {
      ...regularPeriod,
      calendarRevisionId: 'ac83a27f-3753-4a2d-8e1d-a8ee160555e7',
      calendarRevisionNumber: 2,
      officialReference: 'Resolución modificatoria de calendario',
    }
    const getAdminPeriods = vi.fn()
      .mockResolvedValueOnce([regularPeriod])
      .mockResolvedValueOnce([amendedPeriod])
    const closePeriod = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const client = createClient({ getAdminPeriods, closePeriod })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-access-token', canRead: true, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cerrar periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/otro cambio modificó el periodo/i)
    expect(getAdminPeriods).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/Calendario rev\. 2/)).toBeVisible()
    expect(screen.queryByText(/Calendario rev\. 1/)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Confirmar cierre de 2026-2' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar periodo 2026-2' })).toBeEnabled()
  })

  it.each([401, 403])('revalidates institutional authorization after a period transition returns %i', async (status) => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const accessToken = 'synthetic-access-token'
    const closePeriod = vi.fn().mockRejectedValue(new AcademicOperationsApiError(status, 'Denied'))
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    const client = createClient({ closePeriod })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken, canRead: true, canWrite: true }}
      onAuthorizationRejected={onAuthorizationRejected}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cerrar periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 401
      ? /el servidor rechazó la sesión/i
      : /el servidor negó el permiso/i)
    expect(onAuthorizationRejected).toHaveBeenCalledWith(accessToken)
  })

  it('shows approved and open periods for readers but hides transitions without write permission', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const approved = {
      ...regularPeriod,
      id: '0326036b-58de-4897-bc5b-1e54d498ec4d',
      code: '2026-3',
      status: 'APPROVED' as const,
    }
    const client = createClient({ getAdminPeriods: vi.fn().mockResolvedValue([approved, regularPeriod]) })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-read-token', canRead: true, canWrite: false }}
    />)

    // Act + Assert
    expect(await screen.findByText('Aprobado')).toBeVisible()
    expect(screen.getByText('Abierto')).toBeVisible()
    expect(client.getAdminPeriods).toHaveBeenCalledWith('synthetic-read-token', expect.any(AbortSignal))
    expect(screen.queryByRole('button', { name: /abrir periodo|cerrar periodo/i })).not.toBeInTheDocument()
  })

  it('hides previously loaded administrative periods immediately when read permission is lost', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const approved = { ...regularPeriod, status: 'APPROVED' as const }
    const client = createClient({
      getAdminPeriods: vi.fn().mockResolvedValue([approved]),
      getOpenPeriods: vi.fn(() => new Promise<AcademicPeriod[]>(() => {})),
    })
    const { rerender } = render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-read-token', canRead: true, canWrite: false }}
    />)
    expect(await screen.findByText('Aprobado')).toBeVisible()

    // Act: session expiry/logout removes authorization while the public reload is still pending.
    rerender(<AcademicOperationsPage client={client} loadPrograms={async () => programs} authorization={null} />)

    // Assert: stale administrative data is hidden in the same render, before the request resolves.
    expect(screen.queryByText('Aprobado')).not.toBeInTheDocument()
    expect(screen.queryByText('2026-2')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/consultando estructura/i)
  })

  it('allows a write-only operator to close a public open period but not open a hidden approved period', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const closePeriod = vi.fn().mockResolvedValue({ ...regularPeriod, status: 'CLOSED' as const })
    const client = createClient({ closePeriod })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-write-token', canRead: false, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cerrar periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    // Assert
    expect(client.getOpenPeriods).toHaveBeenCalledOnce()
    expect(client.getAdminPeriods).not.toHaveBeenCalled()
    expect(closePeriod).toHaveBeenCalledWith(regularPeriod.id, 'synthetic-write-token')
    expect(screen.queryByText('2026-2')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /abrir periodo/i })).not.toBeInTheDocument()
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

  it('shows root-faculty creation only to an authorized structure writer', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient()
    const { rerender } = render(
      <AcademicOperationsPage client={client} loadPrograms={async () => programs} />,
    )
    expect(await screen.findByText('Facultad de Ciencias')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Crear facultad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear lugar' })).not.toBeInTheDocument()

    // Act
    rerender(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canWrite: true }}
      />,
    )

    // Assert
    expect(await screen.findByRole('button', { name: 'Crear facultad' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Crear lugar' })).toBeVisible()
  })

  it('creates a root site only for an authorized structure writer and reloads the server structure', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const siteId = '94a06170-9acf-4718-854e-92e945a7db17'
    const createdSite = {
      id: siteId,
      code: 'LUGAR-REGIONAL-PRUEBA',
      type: 'REGIONAL' as const,
      displayName: 'Lugar regional de prueba',
      displayOrder: 2,
      status: 'ACTIVE' as const,
      validFrom: '2026-09-30',
      validThrough: null,
    }
    const updatedStructure: AcademicStructureSnapshot = {
      ...structure,
      sites: [...structure.sites, createdSite],
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(updatedStructure)
    const createSite = vi.fn().mockResolvedValue(siteId)
    const client = createClient({ getStructure, createSite })
    render(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canWrite: true }}
      />,
    )
    await screen.findByText('Sede Central Tunja')
    const siteForm = within(screen.getByRole('region', { name: 'Registrar lugar académico' }))
    await user.type(siteForm.getByLabelText('Código del lugar'), 'lugar-regional-prueba')
    await user.selectOptions(siteForm.getByLabelText('Tipo de lugar'), 'REGIONAL')
    await user.type(siteForm.getByLabelText('Nombre del lugar'), 'Lugar regional de prueba')
    await user.clear(siteForm.getByLabelText('Prioridad del lugar'))
    await user.type(siteForm.getByLabelText('Prioridad del lugar'), '2')
    await user.type(siteForm.getByLabelText('Referencia institucional'), 'Acto institucional de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear lugar' }))

    // Assert
    expect(createSite).toHaveBeenCalledWith({
      code: 'lugar-regional-prueba',
      type: 'REGIONAL',
      displayName: 'Lugar regional de prueba',
      displayOrder: 2,
      validFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      validThrough: null,
      sourceReference: 'Acto institucional de prueba',
    }, 'synthetic-structure-token')
    expect(await screen.findByText('Lugar regional de prueba')).toBeVisible()
    expect(getStructure).toHaveBeenCalledTimes(2)
  })

  it('creates a faculty through the protected client and reloads the authoritative structure', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const facultyId = '34a06170-9acf-4718-854e-92e945a7db17'
    const createdFaculty = {
      id: facultyId,
      code: 'FAC-APLICADAS',
      type: 'FACULTY' as const,
      displayName: 'Facultad de Ciencias Aplicadas',
      displayOrder: 3,
      status: 'ACTIVE' as const,
      validFrom: '2026-09-30',
      validThrough: null,
    }
    const updatedStructure: AcademicStructureSnapshot = {
      ...structure,
      units: [...structure.units, createdFaculty],
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(updatedStructure)
    const createOrganizationUnit = vi.fn().mockResolvedValue(facultyId)
    const client = createClient({ getStructure, createOrganizationUnit })
    render(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canWrite: true }}
      />,
    )
    await screen.findByText('Facultad de Ciencias')
    const facultyForm = within(screen.getByRole('region', { name: 'Registrar facultad raíz' }))
    await user.type(facultyForm.getByLabelText('Código institucional'), 'fac-aplicadas')
    await user.type(facultyForm.getByLabelText('Nombre de la facultad'), 'Facultad de Ciencias Aplicadas')
    await user.clear(facultyForm.getByLabelText('Prioridad de visualización'))
    await user.type(facultyForm.getByLabelText('Prioridad de visualización'), '3')
    await user.clear(facultyForm.getByLabelText('Vigente desde'))
    await user.type(facultyForm.getByLabelText('Vigente desde'), '2026-09-30')
    await user.type(facultyForm.getByLabelText('Referencia institucional'), 'Acuerdo institucional de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear facultad' }))

    // Assert
    expect(createOrganizationUnit).toHaveBeenCalledWith({
      code: 'fac-aplicadas',
      type: 'FACULTY',
      displayName: 'Facultad de Ciencias Aplicadas',
      displayOrder: 3,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: 'Acuerdo institucional de prueba',
    }, 'synthetic-structure-token')
    expect(await screen.findByText('Facultad de Ciencias Aplicadas')).toBeVisible()
    expect(getStructure).toHaveBeenCalledTimes(2)
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
