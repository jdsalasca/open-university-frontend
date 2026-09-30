import { describe, expect, it, vi } from 'vitest'

const clientModules = import.meta.glob<typeof import('./academicOperationsClient')>('./academicOperationsClient.ts')

async function loadClient() {
  const loader = clientModules['./academicOperationsClient.ts']
  expect(loader, 'the typed academic operations client is implemented').toBeTypeOf('function')
  return loader!()
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const structure = {
  units: [{
    id: 'fae06170-9acf-4718-854e-92e945a7db17',
    code: 'FAC-CIENCIAS',
    type: 'FACULTY',
    displayName: 'Facultad de Ciencias',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  }],
  organizationRelations: [],
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
    organizationUnitId: 'fae06170-9acf-4718-854e-92e945a7db17',
    siteId: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    displayOrder: 3,
    validFrom: '2026-01-01',
    validThrough: null,
    sourceReference: 'Acuerdo institucional validado',
  }],
}

const period = {
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
  approvalReference: 'Acuerdo de calendario institucional',
  officialReference: 'Calendario institucional 2026-2',
  createdAt: '2026-06-15T10:00:00Z',
}

describe('academic operations client', () => {
  it('loads structure and open periods from separate public contracts without credentials', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(structure))
      .mockResolvedValueOnce(jsonResponse([period]))
    const client = createAcademicOperationsClient(fetcher)
    const signal = new AbortController().signal

    // Act
    const result = await Promise.all([client.getStructure(signal), client.getOpenPeriods(signal)])

    // Assert
    expect(result[0].programAffiliations[0]?.programId).toBe(structure.programAffiliations[0]?.programId)
    expect(result[1][0]).toMatchObject({ kind: 'REGULAR', status: 'OPEN', calendarRevisionNumber: 1 })
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/academic-structure', {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal,
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/v1/academic-periods', {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal,
    })
  })

  it('rejects malformed hierarchy references and periods that expose a non-open state', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const invalidStructure = {
      ...structure,
      organizationRelations: [{
        parentUnitId: structure.units[0]?.id,
        childUnitId: 'not-a-uuid',
        validFrom: '2026-01-01',
        validThrough: null,
      }],
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(invalidStructure))
      .mockResolvedValueOnce(jsonResponse([{ ...period, status: 'DRAFT' }]))
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.getStructure()).rejects.toThrow(/malformed/i)
    await expect(client.getOpenPeriods()).rejects.toThrow(/malformed/i)
  })

  it('reports a public API error as a retryable rejected request', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: 'unavailable' }, 503))
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.getStructure()).rejects.toThrow(/request failed/i)
  })
})
