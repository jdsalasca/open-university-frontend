import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentType } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AcademicCatalogClient,
  AcademicCurriculum,
  AcademicCurriculumDraftsPage,
  AcademicCurriculumDraftsPageQuery,
  AcademicCurriculumDetails,
  AcademicCurriculumEntriesPage,
  AcademicCurriculumEntriesPageQuery,
  AcademicCurriculumEntry,
  CurriculumImportPreview,
  AcademicProgram,
  CatalogAuthorization,
} from './contracts'

afterEach(cleanup)

interface AcademicCatalogPageProps {
  client: AcademicCatalogClient
  authorization?: CatalogAuthorization | null
}

const pageModules = import.meta.glob<{ AcademicCatalogPage: ComponentType<AcademicCatalogPageProps> }>(
  './AcademicCatalogPage.tsx',
)

async function renderCatalogPage(props: AcademicCatalogPageProps) {
  const loader = pageModules['./AcademicCatalogPage.tsx']
  expect(loader, 'the accessible academic catalog page is implemented').toBeTypeOf('function')
  const module = await loader!()
  const Page = module.AcademicCatalogPage
  return render(Page ? <Page {...props} /> : null)
}

const program: AcademicProgram = {
  id: 'f2ba149c-8910-49b3-aac7-48aa49fd104d',
  programCode: 'PRE-001',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'TUNJA',
  programName: 'Ingeniería de Prueba',
  faculty: 'Facultad de Prueba',
  campusName: 'Tunja',
}

const secondProgram: AcademicProgram = {
  ...program,
  id: '7efb9955-ec0b-40d6-8c67-f9188dc4c016',
  programCode: 'PRE-002',
  campusCode: 'SOGAMOSO',
  programName: 'Física de Prueba',
  faculty: 'Facultad de Ciencias',
  campusName: 'Sogamoso',
}

const publishedCurriculum: AcademicCurriculum = {
  id: 'c376975f-016f-4a95-9279-bb50ff95bbd1',
  programId: program.id,
  programCode: program.programCode,
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'TUNJA',
  programName: program.programName,
  faculty: program.faculty,
  campusName: program.campusName,
  curriculumVersion: '2026-A',
  cohortFrom: '2026-1',
  cohortThrough: null,
  approvalReference: 'Acuerdo de prueba',
  status: 'PUBLISHED',
  entryCount: 42,
  createdAt: '2026-01-10T10:00:00Z',
  publishedAt: '2026-01-11T10:00:00Z',
}

const secondPublishedCurriculum: AcademicCurriculum = {
  ...publishedCurriculum,
  id: 'dfe01eae-2219-408c-8ae5-650e77e41d7f',
  programId: secondProgram.id,
  programCode: secondProgram.programCode,
  campusCode: secondProgram.campusCode,
  programName: secondProgram.programName,
  faculty: secondProgram.faculty,
  campusName: secondProgram.campusName,
  curriculumVersion: '2025-B',
  cohortFrom: '2025-2',
  entryCount: 20,
}

const draft: AcademicCurriculum = { ...publishedCurriculum, id: '46e7938c-cbab-4f97-9dc5-0ad1ab04603d', status: 'DRAFT', publishedAt: null }

const details: AcademicCurriculumDetails = {
  curriculum: draft,
  entries: [{
    subjectId: '9f7d9d63-c2bb-4424-85c1-63797065a35d',
    subjectRevisionId: '536f34ac-cbf7-4ba3-bc35-301c814d8f50',
    subjectCode: 'MAT-101',
    subjectName: 'Cálculo I',
    credits: 4,
    semester: 1,
    formationSpace: 'Disciplinar',
    component: 'Fundamentación',
    choiceGroup: null,
    rowOrder: 1,
  }],
}

const importPreview: CurriculumImportPreview = {
  programCode: program.programCode,
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  sniesCode: '12345',
  programName: program.programName,
  faculty: program.faculty,
  campusCode: program.campusCode,
  campusName: program.campusName,
  curriculumVersion: '2026-A',
  cohortFrom: '2026-1',
  cohortThrough: null,
  approvalReference: 'Acuerdo de prueba',
  entryCount: 1,
  semesters: [1],
  sampleEntries: [{
    sourceRowNumber: 2,
    rowOrder: 1,
    semester: 1,
    subjectCode: 'MAT-101',
    subjectName: 'Cálculo I',
    credits: 4,
    formationSpace: 'Disciplinar',
    component: 'Fundamentación',
    choiceGroup: 'Electiva A',
  }],
}

const publicDetails: AcademicCurriculumDetails = {
  ...details,
  curriculum: publishedCurriculum,
  entries: [
    ...details.entries.map((entry) => ({ ...entry, choiceGroup: 'OPT-2026' })),
    {
      ...details.entries[0],
      subjectId: '9f7d9d63-c2bb-4424-85c1-63797065a35e',
      subjectRevisionId: '536f34ac-cbf7-4ba3-bc35-301c814d8f51',
      subjectCode: 'FIS-101',
      subjectName: 'Física I',
      semester: 2,
      choiceGroup: null,
      rowOrder: 2,
    },
  ],
}

const largeCurriculumEntries: AcademicCurriculumEntry[] = Array.from({ length: 101 }, (_, index) => ({
    ...publicDetails.entries[0],
    subjectId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    subjectRevisionId: `00000001-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    subjectCode: `SUB-${String(index + 1).padStart(3, '0')}`,
    subjectName: `Asignatura ${index + 1}`,
    semester: Math.floor(index / 10) + 1,
    choiceGroup: null,
    rowOrder: index + 1,
  }))

const authorization: CatalogAuthorization = {
  accessToken: 'institutional-token',
  permissions: ['academic:catalog:read', 'academic:catalog:write'],
}

function createDraftsPage(
  query: AcademicCurriculumDraftsPageQuery,
  drafts: AcademicCurriculum[],
  totalItems = drafts.length,
  nextCursor: string | null = null,
): AcademicCurriculumDraftsPage {
  return {
    pageSize: query.pageSize,
    totalItems,
    drafts,
    nextCursor,
  }
}

function createEntriesPage(
  query: AcademicCurriculumEntriesPageQuery,
  entries: AcademicCurriculumEntry[] = publicDetails.entries,
  totalItems = entries.length,
  curriculumId = publishedCurriculum.id,
): AcademicCurriculumEntriesPage {
  return {
    curriculumId,
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize),
    entries,
  }
}

function createClient(overrides: Partial<AcademicCatalogClient> = {}): AcademicCatalogClient {
  return {
    listPrograms: vi.fn().mockResolvedValue([]),
    listCurricula: vi.fn().mockResolvedValue([]),
    listDrafts: vi.fn().mockImplementation((_token, query) => Promise.resolve(createDraftsPage(query, []))),
    getCurriculum: vi.fn().mockResolvedValue(details),
    getPublishedCurriculum: vi.fn().mockResolvedValue(publishedCurriculum),
    listPublishedCurriculumEntries: vi.fn().mockImplementation((_id, query) => Promise.resolve(createEntriesPage(query))),
    previewCsv: vi.fn().mockResolvedValue(importPreview),
    importCsv: vi.fn().mockResolvedValue(draft),
    publishCurriculum: vi.fn().mockResolvedValue({ ...details, curriculum: publishedCurriculum }),
    ...overrides,
  } as AcademicCatalogClient
}

describe('AcademicCatalogPage', () => {
  it('shows the explicit empty state and keeps all administrative controls unavailable without institutional authorization', async () => {
    // Arrange
    const client = createClient()
    await renderCatalogPage({ client })

    // Act
    const heading = await screen.findByRole('heading', { name: 'Programas de pregrado presencial' })

    // Assert
    expect(heading).toBeVisible()
    expect(screen.getByText(/No hay programas publicados todavía/i)).toBeVisible()
    expect(screen.getByText(/Vista previa de desarrollo/i)).toBeVisible()
    expect(screen.getByText(/permisos institucionales/i)).toBeVisible()
    expect(screen.queryByLabelText(/archivo CSV/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publicar/i })).not.toBeInTheDocument()
    expect(client.listDrafts).not.toHaveBeenCalled()
    expect(client.importCsv).not.toHaveBeenCalled()
    expect(client.publishCurriculum).not.toHaveBeenCalled()
  })

  it('offers a public download of the blank curriculum CSV template while administrative actions stay locked', async () => {
    // Arrange
    const client = createClient()
    await renderCatalogPage({ client })

    // Act
    const templateLink = screen.getByRole('link', { name: /descargar plantilla csv/i })

    // Assert
    expect(templateLink).toHaveAttribute('href', '/api/v1/academic-catalog/curriculum-template')
    expect(templateLink).toHaveAttribute('download', 'academic-curriculum-template.csv')
    expect(screen.queryByLabelText(/archivo CSV/i)).not.toBeInTheDocument()
    expect(client.importCsv).not.toHaveBeenCalled()
  })

  it('renders published curriculum versions grouped with their admission cohorts', async () => {
    // Arrange
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
    })
    await renderCatalogPage({ client })

    // Act
    const curriculumCard = await screen.findByRole('article', { name: /2026-A/i })

    // Assert
    expect(screen.getByRole('button', { name: /Ingeniería de Prueba/i })).toHaveAttribute('aria-pressed', 'true')
    expect(within(curriculumCard).getByText(/2026-1/)).toBeVisible()
    expect(within(curriculumCard).getByText(/42 actividades/i)).toBeVisible()
    expect(within(curriculumCard).getByText(/Publicado/i)).toBeVisible()
  })

  it('searches programs by unaccented text and loads a selected result', async () => {
    // Arrange
    const listCurricula = vi.fn().mockImplementation((programId: string) => Promise.resolve(
      programId === secondProgram.id ? [secondPublishedCurriculum] : [publishedCurriculum],
    ))
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program, secondProgram]),
      listCurricula,
    })
    await renderCatalogPage({ client })
    await screen.findByRole('button', { name: /Ingeniería de Prueba/i })

    // Act
    await userEvent.type(screen.getByRole('searchbox', { name: /buscar programa/i }), 'fisica')

    // Assert: matching text can be found without its accent.
    const matchingProgram = screen.getByRole('button', { name: /Física de Prueba/i })
    expect(matchingProgram).toBeVisible()
    expect(screen.queryByRole('button', { name: /Ingeniería de Prueba/i })).not.toBeInTheDocument()
    expect(listCurricula).toHaveBeenCalledTimes(1)

    // Act: select the result.
    await userEvent.click(matchingProgram)

    // Assert
    expect(await screen.findByRole('heading', { name: 'Física de Prueba' })).toBeVisible()
    expect(screen.getByText('2025-B')).toBeVisible()
    expect(listCurricula).toHaveBeenCalledWith(secondProgram.id, expect.any(AbortSignal))
  })

  it('explains when no program matches and keeps the selected plan identifiable', async () => {
    // Arrange
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
    })
    await renderCatalogPage({ client })
    await screen.findByRole('button', { name: /Ingeniería de Prueba/i })

    // Act
    await userEvent.type(screen.getByRole('searchbox', { name: /buscar programa/i }), 'NO-EXISTE')

    // Assert
    const programList = within(screen.getByRole('group', { name: /seleccionar programa/i }))
    expect(programList.getByRole('status')).toHaveTextContent(/ningún programa coincide/i)
    expect(screen.getByText(/el plan mostrado corresponde a ingeniería de prueba/i)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Ingeniería de Prueba' })).toBeVisible()
    expect(client.listCurricula).toHaveBeenCalledTimes(1)
  })

  it('requests_only_the_first_bounded_page', async () => {
    // Arrange
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
    })
    await renderCatalogPage({ client })

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /ver asignaturas de la versión 2026-A/i }))

    // Assert
    expect(client.getPublishedCurriculum).toHaveBeenCalledWith(publishedCurriculum.id, expect.any(AbortSignal))
    expect(client.listPublishedCurriculumEntries).toHaveBeenCalledWith(
      publishedCurriculum.id,
      { page: 1, pageSize: 100, search: '', semester: undefined },
      expect.any(AbortSignal),
    )
    expect(await screen.findByRole('table', { name: /asignaturas de la versión 2026-A/i })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /asignatura/i })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Cálculo I' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'MAT-101' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'OPT-2026' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Física I' })).toBeVisible()
  })

  it('filters_by_numeric_semester', async () => {
    // Arrange
    const listEntries = vi.fn().mockImplementation((_id, query: AcademicCurriculumEntriesPageQuery) => Promise.resolve(
      createEntriesPage(query, query.semester === 2 ? [publicDetails.entries[1]] : publicDetails.entries),
    ))
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
      listPublishedCurriculumEntries: listEntries,
    })
    await renderCatalogPage({ client })
    await userEvent.click(await screen.findByRole('button', { name: /ver asignaturas de la versión 2026-A/i }))
    await screen.findByRole('table', { name: /asignaturas de la versión 2026-A/i })

    // Act
    fireEvent.change(screen.getByRole('spinbutton', { name: /semestre/i }), { target: { value: '2' } })

    // Assert
    await waitFor(() => expect(listEntries).toHaveBeenLastCalledWith(
      publishedCurriculum.id,
      { page: 1, pageSize: 100, search: '', semester: 2 },
      expect.any(AbortSignal),
    ))
    expect(await screen.findByRole('cell', { name: 'Física I' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'Cálculo I' })).not.toBeInTheDocument()
  })

  it('shows_no_server_matches', async () => {
    // Arrange
    const listEntries = vi.fn().mockImplementation((_id, query: AcademicCurriculumEntriesPageQuery) => Promise.resolve(
      query.search
        ? createEntriesPage(query, [], 0)
        : createEntriesPage(query),
    ))
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
      listPublishedCurriculumEntries: listEntries,
    })
    await renderCatalogPage({ client })
    await userEvent.click(await screen.findByRole('button', { name: /ver asignaturas de la versión 2026-A/i }))
    await screen.findByRole('table', { name: /asignaturas de la versión 2026-A/i })

    // Act
    fireEvent.change(screen.getByRole('searchbox', { name: /buscar asignatura/i }), { target: { value: 'NO-EXISTE' } })

    // Assert
    const detail = within(screen.getByRole('region', { name: /detalle de la versión 2026-A/i }))
    await waitFor(() => expect(detail.getByRole('status')).toHaveTextContent(/ninguna asignatura coincide/i))
    expect(screen.queryByRole('table', { name: /asignaturas de la versión 2026-A/i })).not.toBeInTheDocument()
    await waitFor(() => expect(listEntries).toHaveBeenLastCalledWith(
      publishedCurriculum.id,
      { page: 1, pageSize: 100, search: 'NO-EXISTE', semester: undefined },
      expect.any(AbortSignal),
    ))
  })

  it('loads_the_next_server_page', async () => {
    // Arrange
    const listEntries = vi.fn().mockImplementation((_id, query: AcademicCurriculumEntriesPageQuery) => Promise.resolve(
      createEntriesPage(query, query.page === 1 ? largeCurriculumEntries.slice(0, 100) : largeCurriculumEntries.slice(100), 101),
    ))
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
      listPublishedCurriculumEntries: listEntries,
    })
    await renderCatalogPage({ client })
    await userEvent.click(await screen.findByRole('button', { name: /ver asignaturas de la versión 2026-A/i }))
    const table = await screen.findByRole('table', { name: /asignaturas de la versión 2026-A/i })

    // Act + Assert: the first server page renders no more than 100 data rows.
    expect(within(table).getAllByRole('row')).toHaveLength(101)
    expect(screen.getByRole('cell', { name: 'Asignatura 100' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'Asignatura 101' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /página anterior/i })).toBeDisabled()

    // Act: move to the remaining row.
    await userEvent.click(screen.getByRole('button', { name: /página siguiente/i }))
    await screen.findByRole('cell', { name: 'Asignatura 101' })

    // Assert
    const secondPageTable = screen.getByRole('table', { name: /asignaturas de la versión 2026-A/i })
    expect(within(secondPageTable).getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('cell', { name: 'Asignatura 101' })).toBeVisible()
    expect(screen.getByText('Página 2 de 2')).toBeVisible()
    expect(listEntries).toHaveBeenLastCalledWith(
      publishedCurriculum.id,
      { page: 2, pageSize: 100, search: '', semester: undefined },
      expect.any(AbortSignal),
    )
  })

  it('debounces_search_and_resets_pagination', async () => {
    // Arrange
    const listEntries = vi.fn().mockImplementation((_id, query: AcademicCurriculumEntriesPageQuery) => Promise.resolve(
      query.search
        ? createEntriesPage(query, [publicDetails.entries[1]], 1)
        : createEntriesPage(query, query.page === 1 ? largeCurriculumEntries.slice(0, 100) : largeCurriculumEntries.slice(100), 101),
    ))
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
      listPublishedCurriculumEntries: listEntries,
    })
    await renderCatalogPage({ client })

    // Act: navigate to page two, then start a search.
    await userEvent.click(await screen.findByRole('button', { name: /ver asignaturas de la versión 2026-A/i }))
    await userEvent.click(await screen.findByRole('button', { name: /página siguiente/i }))
    await screen.findByRole('cell', { name: 'Asignatura 101' })
    const callsBeforeSearch = listEntries.mock.calls.length
    fireEvent.change(screen.getByRole('searchbox', { name: /buscar asignatura/i }), { target: { value: 'Física' } })

    // Assert: the request waits for the debounce and returns to server page one.
    expect(listEntries).toHaveBeenCalledTimes(callsBeforeSearch)
    await waitFor(() => expect(listEntries).toHaveBeenLastCalledWith(
      publishedCurriculum.id,
      { page: 1, pageSize: 100, search: 'Física', semester: undefined },
      expect.any(AbortSignal),
    ))
    expect(await screen.findByRole('cell', { name: 'Física I' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: /paginación de asignaturas/i })).not.toBeInTheDocument()
  })

  it('rejects_entries_for_another_curriculum', async () => {
    // Arrange
    const listEntries = vi.fn().mockImplementation((_id, query: AcademicCurriculumEntriesPageQuery) => Promise.resolve(
      createEntriesPage(query, publicDetails.entries, publicDetails.entries.length, secondPublishedCurriculum.id),
    ))
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
      listPublishedCurriculumEntries: listEntries,
    })
    await renderCatalogPage({ client })

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /ver asignaturas de la versión 2026-A/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar las asignaturas/i)
    expect(screen.queryByRole('table', { name: /asignaturas de la versión 2026-A/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Cálculo I')).not.toBeInTheDocument()
  })

  it('does not render subjects when the published detail is no longer available', async () => {
    // Arrange
    const unavailable = Object.assign(new Error('Not found.'), { status: 404, code: 'curriculum_not_found' })
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
      getPublishedCurriculum: vi.fn().mockRejectedValue(unavailable),
    })
    await renderCatalogPage({ client })

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /ver asignaturas de la versión 2026-A/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya no está publicada o no existe/i)
    expect(screen.queryByRole('table', { name: /asignaturas de la versión 2026-A/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Cálculo I')).not.toBeInTheDocument()
  })

  it('fails closed if a public detail response unexpectedly contains a draft', async () => {
    // Arrange
    const client = createClient({
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([publishedCurriculum]),
      getPublishedCurriculum: vi.fn().mockResolvedValue({ ...draft, id: publishedCurriculum.id }),
    })
    await renderCatalogPage({ client })

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /ver asignaturas de la versión 2026-A/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/no está disponible para consulta pública/i)
    expect(screen.queryByText('Cálculo I')).not.toBeInTheDocument()
  })

  it('renders institution supplied program text as text rather than executable markup', async () => {
    // Arrange
    const hostileName = '<img src=x onerror=alert(1)>'
    const client = createClient({ listPrograms: vi.fn().mockResolvedValue([{ ...program, programName: hostileName }]) })
    await renderCatalogPage({ client })

    // Act
    const programNames = await screen.findAllByText(hostileName)

    // Assert
    expect(programNames.every((element) => element.tagName !== 'IMG')).toBe(true)
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('shows an explicit retry action when the public catalog cannot be reached', async () => {
    // Arrange
    const client = createClient({ listPrograms: vi.fn().mockRejectedValue(new Error('offline')) })
    await renderCatalogPage({ client })

    // Act
    const retry = await screen.findByRole('button', { name: /reintentar/i })

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo cargar el catálogo/i)
    await userEvent.click(retry)
    expect(client.listPrograms).toHaveBeenCalledTimes(2)
  })

  it('lists drafts and loads a curriculum review before offering the protected publish action', async () => {
    // Arrange
    const client = createClient({ listDrafts: vi.fn().mockResolvedValue(createDraftsPage({ pageSize: 25 }, [draft])) })
    await renderCatalogPage({ client, authorization })

    // Act
    const reviewButton = await screen.findByRole('button', { name: /revisar 2026-A/i })
    await userEvent.click(reviewButton)

    // Assert
    expect(client.listDrafts).toHaveBeenCalledWith(authorization.accessToken, { pageSize: 25 }, expect.any(AbortSignal))
    expect(await screen.findByText('Cálculo I')).toBeVisible()
    expect(client.getCurriculum).toHaveBeenCalledWith(draft.id, authorization.accessToken)
    expect(screen.getByRole('button', { name: /publicar 2026-A/i })).toBeEnabled()
  })

  it('loads the next administrative draft page from the server', async () => {
    // Arrange
    const pageSize = 25
    const firstPageDrafts = Array.from({ length: pageSize }, (_, index) => ({
      ...draft,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      curriculumVersion: `2026-${String(index + 1).padStart(2, '0')}`,
    }))
    const finalDraft = { ...draft, id: '00000000-0000-4000-8000-000000000026', curriculumVersion: '2027-01' }
    const listDrafts = vi.fn()
      .mockResolvedValueOnce(createDraftsPage({ pageSize }, firstPageDrafts, 26, 'cursor-page-2'))
      .mockResolvedValueOnce(createDraftsPage({ pageSize, after: 'cursor-page-2' }, [finalDraft], 26))
    const client = createClient({
      listDrafts: listDrafts as unknown as AcademicCatalogClient['listDrafts'],
    })
    await renderCatalogPage({ client, authorization })

    // Act
    const nextPage = await screen.findByRole('button', { name: /página siguiente de borradores/i })
    expect(screen.getByText('Página 1 · 25 visibles · 26 pendientes')).toBeVisible()
    await userEvent.click(nextPage)

    // Assert
    expect(await screen.findByRole('button', { name: /revisar 2027-01/i })).toBeVisible()
    expect(screen.getByText('Página 2 · 1 visible · 26 pendientes')).toBeVisible()
    expect(screen.queryByRole('button', { name: /revisar 2026-01/i })).not.toBeInTheDocument()
    expect(listDrafts).toHaveBeenNthCalledWith(1, authorization.accessToken, { pageSize }, expect.any(AbortSignal))
    expect(listDrafts).toHaveBeenNthCalledWith(2, authorization.accessToken, { pageSize, after: 'cursor-page-2' }, expect.any(AbortSignal))
  })

  it('returns to the first draft page when publication empties the current cursor position', async () => {
    // Arrange
    const pageSize = 25
    const firstPageDrafts = Array.from({ length: pageSize }, (_, index) => ({
      ...draft,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      curriculumVersion: `2026-${String(index + 1).padStart(2, '0')}`,
    }))
    const finalDraft = { ...draft, id: '00000000-0000-4000-8000-000000000026', curriculumVersion: '2027-01' }
    const listDrafts = vi.fn()
      .mockResolvedValueOnce(createDraftsPage({ pageSize }, firstPageDrafts, 26, 'cursor-page-2'))
      .mockResolvedValueOnce(createDraftsPage({ pageSize, after: 'cursor-page-2' }, [finalDraft], 26))
      .mockResolvedValueOnce(createDraftsPage({ pageSize, after: 'cursor-page-2' }, [], 25))
      .mockResolvedValueOnce(createDraftsPage({ pageSize }, firstPageDrafts, 25, null))
    const client = createClient({
      listDrafts: listDrafts as unknown as AcademicCatalogClient['listDrafts'],
      getCurriculum: vi.fn().mockResolvedValue({ ...details, curriculum: finalDraft }),
    })
    await renderCatalogPage({ client, authorization })
    await userEvent.click(await screen.findByRole('button', { name: /página siguiente de borradores/i }))
    await userEvent.click(await screen.findByRole('button', { name: /revisar 2027-01/i }))
    await screen.findByRole('heading', { name: /2027-01/i })

    // Act
    await userEvent.click(screen.getByRole('button', { name: /publicar 2027-01/i }))

    // Assert
    expect(await screen.findByText(/currículo publicado/i)).toBeVisible()
    expect(await screen.findByRole('button', { name: /revisar 2026-01/i })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: /paginación de borradores/i })).not.toBeInTheDocument()
    expect(listDrafts).toHaveBeenNthCalledWith(3, authorization.accessToken, { pageSize, after: 'cursor-page-2' }, expect.any(AbortSignal))
    expect(listDrafts).toHaveBeenNthCalledWith(4, authorization.accessToken, { pageSize }, expect.any(AbortSignal))
  })

  it.each([
    ['MIME type', new File(['bad'], 'curriculum.csv', { type: 'application/pdf' }), /formato CSV/i],
    ['file size', new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'curriculum.csv', { type: 'text/csv' }), /2 MiB/i],
  ])('rejects an invalid %s before sending an import request', async (_case, file, errorText) => {
    // Arrange
    const client = createClient()
    await renderCatalogPage({ client, authorization })
    const input = await screen.findByLabelText(/archivo CSV/i)

    // Act
    fireEvent.change(input, { target: { files: [file] } })

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(errorText)
    expect(client.importCsv).not.toHaveBeenCalled()
  })

  it('previews a valid CSV before creating its draft and adds the draft to the review queue', async () => {
    // Arrange
    const listDrafts = vi.fn()
      .mockImplementationOnce((_token, query) => Promise.resolve(createDraftsPage(query, [])))
      .mockImplementationOnce((_token, query) => Promise.resolve(createDraftsPage(query, [draft])))
    const client = createClient({ listDrafts: listDrafts as AcademicCatalogClient['listDrafts'] })
    await renderCatalogPage({ client, authorization })
    const input = await screen.findByLabelText(/archivo CSV/i)
    const file = new File(['header,row'], 'plan.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: /validar csv/i }))

    // Assert the first request is a no-write preview.
    expect(client.previewCsv).toHaveBeenCalledWith(file, authorization.accessToken)
    expect(client.importCsv).not.toHaveBeenCalled()
    expect(await screen.findByText('Cálculo I')).toBeVisible()
    expect(screen.getByText('Electiva A')).toBeVisible()
    expect(screen.getByText(/3 semestres|1 semestre/i)).toBeVisible()

    // Act: the explicit confirmation makes the import request.
    await userEvent.click(screen.getByRole('button', { name: /crear borrador/i }))

    // Assert
    expect(client.importCsv).toHaveBeenCalledWith(file, authorization.accessToken)
    expect(await screen.findByText(/borrador creado/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /revisar 2026-A/i })).toBeVisible()
    expect(listDrafts).toHaveBeenCalledTimes(2)
  })

  it('does not import when the preview is rejected', async () => {
    // Arrange
    const client = createClient({ previewCsv: vi.fn().mockRejectedValue(new Error('No fue posible validar el archivo.')) })
    await renderCatalogPage({ client, authorization })
    const input = await screen.findByLabelText(/archivo CSV/i)
    const firstFile = new File(['first'], 'first.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [firstFile] } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: /validar csv/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible validar el archivo.')
    expect(client.importCsv).not.toHaveBeenCalled()

  })

  it('allows retrying a failed preview with the same file', async () => {
    // Arrange
    const client = createClient({
      previewCsv: vi.fn()
        .mockRejectedValueOnce(new Error('Servicio temporalmente no disponible.'))
        .mockResolvedValue(importPreview),
    })
    await renderCatalogPage({ client, authorization })
    const input = await screen.findByLabelText(/archivo CSV/i)
    const file = new File(['curriculum'], 'plan.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(input).toHaveValue('')

    // Act
    await userEvent.click(screen.getByRole('button', { name: /validar csv/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible.')
    fireEvent.change(input, { target: { files: [file] } })
    await userEvent.click(screen.getByRole('button', { name: /validar csv/i }))

    // Assert
    expect(client.previewCsv).toHaveBeenCalledTimes(2)
    expect(client.previewCsv).toHaveBeenLastCalledWith(file, authorization.accessToken)
    expect(await screen.findByText('Cálculo I')).toBeVisible()
    expect(client.importCsv).not.toHaveBeenCalled()
  })

  it('clears a successful preview when another file is selected', async () => {
    // Arrange
    const client = createClient()
    await renderCatalogPage({ client, authorization })
    const input = await screen.findByLabelText(/archivo CSV/i)
    const firstFile = new File(['first'], 'first.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [firstFile] } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: /validar csv/i }))
    expect(await screen.findByText('Cálculo I')).toBeVisible()
    const replacement = new File(['replacement'], 'replacement.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [replacement] } })

    // Assert
    expect(screen.queryByText('Cálculo I')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /validar csv/i })).toBeEnabled()
    expect(client.importCsv).not.toHaveBeenCalled()
  })

  it('shows safe row and field details when the backend rejects a confirmed import', async () => {
    // Arrange
    const invalidCsv = Object.assign(new Error('El CSV tiene errores.'), {
      status: 400,
      code: 'invalid_curriculum_csv',
      issues: [{ rowNumber: 7, column: 'credits', code: 'invalid_decimal' }],
    })
    const client = createClient({ importCsv: vi.fn().mockRejectedValue(invalidCsv) })
    await renderCatalogPage({ client, authorization })
    const input = await screen.findByLabelText(/archivo CSV/i)
    fireEvent.change(input, { target: { files: [new File(['bad'], 'plan.csv', { type: 'text/csv' })] } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: /validar csv/i }))
    await screen.findByText('Cálculo I')
    await userEvent.click(screen.getByRole('button', { name: /crear borrador/i }))

    // Assert
    const errors = await screen.findByRole('alert')
    expect(errors).toHaveTextContent('Fila 7')
    expect(errors).toHaveTextContent('credits')
    expect(errors).not.toHaveTextContent('bad')
  })

  it('publishes a reviewed draft and refreshes the public list', async () => {
    // Arrange
    const client = createClient({
      listDrafts: vi.fn()
        .mockResolvedValueOnce(createDraftsPage({ pageSize: 25 }, [draft]))
        .mockResolvedValue(createDraftsPage({ pageSize: 25 }, [])),
      listPrograms: vi.fn().mockResolvedValue([program]),
      listCurricula: vi.fn().mockResolvedValue([]),
    })
    await renderCatalogPage({ client, authorization })
    await userEvent.click(await screen.findByRole('button', { name: /revisar 2026-A/i }))
    await screen.findByText('Cálculo I')

    // Act
    await userEvent.click(screen.getByRole('button', { name: /publicar 2026-A/i }))

    // Assert
    expect(client.publishCurriculum).toHaveBeenCalledWith(draft.id, authorization.accessToken)
    expect(await screen.findByText(/currículo publicado/i)).toBeVisible()
    await waitFor(() => expect(client.listCurricula).toHaveBeenCalledTimes(2))
  })

  it.each([
    [409, 'curriculum_conflict', /ya cambió de estado/i],
    [403, 'forbidden', /no tienes permiso/i],
  ])('shows a useful publish error when the server rejects publication with %s', async (status, code, message) => {
    // Arrange
    const error = Object.assign(new Error('Rejected.'), { status, code, issues: [] })
    const client = createClient({
      listDrafts: vi.fn().mockResolvedValue(createDraftsPage({ pageSize: 25 }, [draft])),
      publishCurriculum: vi.fn().mockRejectedValue(error),
    })
    await renderCatalogPage({ client, authorization })
    await userEvent.click(await screen.findByRole('button', { name: /revisar 2026-A/i }))
    await screen.findByText('Cálculo I')

    // Act
    await userEvent.click(screen.getByRole('button', { name: /publicar 2026-A/i }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('does not show write controls to an authenticated catalog reader', async () => {
    // Arrange
    const reader = { accessToken: 'reader-token', permissions: ['academic:catalog:read'] as const }
    const client = createClient({ listDrafts: vi.fn().mockResolvedValue(createDraftsPage({ pageSize: 25 }, [draft])) })
    await renderCatalogPage({ client, authorization: reader })

    // Act
    await screen.findByRole('heading', { name: /borradores/i })

    // Assert
    expect(screen.getByRole('button', { name: /revisar 2026-A/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /descargar plantilla csv/i })).toHaveAttribute('download', 'academic-curriculum-template.csv')
    expect(screen.queryByLabelText(/archivo CSV/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publicar/i })).not.toBeInTheDocument()
  })
})
