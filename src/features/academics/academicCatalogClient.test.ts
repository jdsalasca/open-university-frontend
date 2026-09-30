import { describe, expect, it, vi } from 'vitest'
const clientModules = import.meta.glob<typeof import('./academicCatalogClient')>('./academicCatalogClient.ts')

async function loadClient() {
  const loader = clientModules['./academicCatalogClient.ts']
  expect(loader, 'the typed academic catalog client is implemented').toBeTypeOf('function')
  return loader!()
}

const program = {
  id: 'f2ba149c-8910-49b3-aac7-48aa49fd104d',
  programCode: 'PRE-001',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'TUNJA',
  programName: 'Ingeniería de Prueba',
  faculty: 'Facultad de Prueba',
  campusName: 'Tunja',
}

const curriculum = {
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('academic catalog client', () => {
  it('loads and validates the public program catalog without sending credentials or cookies', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse([program]))
    const client = createAcademicCatalogClient(fetcher)

    // Act
    const result = await client.listPrograms()

    // Assert
    expect(result[0]).toMatchObject({ id: program.id, programName: program.programName })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/academic-catalog/programs', {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
  })

  it('sends the institutional bearer token for protected draft reads and reviews', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse([curriculum]))
      .mockResolvedValueOnce(jsonResponse({ curriculum, entries: [] }))
    const client = createAcademicCatalogClient(fetcher)

    // Act
    await client.listDrafts('institutional-token')
    await client.getCurriculum(curriculum.id, 'institutional-token')

    // Assert
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/admin/academic-catalog/drafts', {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer institutional-token' },
    })
    expect(fetcher).toHaveBeenNthCalledWith(2,
      `/api/v1/admin/academic-catalog/curricula/${curriculum.id}`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer institutional-token' }) }),
    )
  })

  it('rejects an unsupported CSV media type before making a request', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicCatalogClient(fetcher)
    const file = new File(['content'], 'curriculum.csv', { type: 'application/pdf' })

    // Act
    const request = client.importCsv(file, 'institutional-token')

    // Assert
    await expect(request).rejects.toMatchObject({ code: 'unsupported_file_type' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects files above the server byte limit before upload', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicCatalogClient(fetcher)
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'curriculum.csv', { type: 'text/csv' })

    // Act
    const request = client.importCsv(file, 'institutional-token')

    // Assert
    await expect(request).rejects.toMatchObject({ code: 'file_too_large' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns safe row and column issues from a rejected CSV without retaining cell values', async () => {
    // Arrange
    const { createAcademicCatalogClient, AcademicCatalogApiError } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      error: 'invalid_curriculum_csv',
      message: 'El CSV no cumple el contrato.',
      issues: [{ rowNumber: 7, column: 'credits', code: 'INVALID_DECIMAL' }],
    }, 400))
    const client = createAcademicCatalogClient(fetcher)
    const file = new File(['secret-cell-value'], 'curriculum.csv', { type: 'text/csv' })

    // Act
    const request = client.importCsv(file, 'institutional-token')

    // Assert
    await expect(request).rejects.toBeInstanceOf(AcademicCatalogApiError)
    await expect(request).rejects.toMatchObject({
      status: 400,
      code: 'invalid_curriculum_csv',
      issues: [{ rowNumber: 7, column: 'credits', code: 'invalid_decimal' }],
    })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/academic-catalog/imports', expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer institutional-token' },
    }))
  })

  it.each([
    [403, 'forbidden'],
    [409, 'curriculum_conflict'],
  ])('preserves protected API response status %s for UI conflict handling', async (status, code) => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: code, message: 'Request rejected.', issues: [] }, status))
    const client = createAcademicCatalogClient(fetcher)

    // Act
    const request = client.publishCurriculum(curriculum.id, 'institutional-token')

    // Assert
    await expect(request).rejects.toMatchObject({ status, code })
  })

  it('rejects malformed catalog responses instead of rendering unvalidated API data', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const client = createAcademicCatalogClient(vi.fn().mockResolvedValue(jsonResponse([{ ...program, id: '../bad' }])))

    // Act
    const request = client.listPrograms()

    // Assert
    await expect(request).rejects.toThrow('malformed')
  })
})
