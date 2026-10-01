import { describe, expect, it, vi } from 'vitest'
import { createSpaceGuideClient, SpaceGuideApiError } from './spaceGuideClient'

const payload = {
  officialOfficeDirectoryUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/directorio/',
  locations: [{
    id: 'cread-bogota',
    kind: 'CREAD',
    name: 'CREAD Bogotá',
    municipality: 'Bogotá',
    department: null,
    address: 'Carrera 13 No. 24-15',
    locationDetail: 'Instalaciones INCCA',
    mapQuery: 'Carrera 13 No. 24-15, Bogotá',
    source: {
      label: 'Localización y sedes UPTC',
      url: 'https://uptc.edu.co/sitio/portal/sitios/localizacion/',
      checkedAt: '2026-10-01',
      sourceUpdatedAt: null,
    },
  }],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('public space guide client', () => {
  it('loads and validates the public directory without credentials or cookies', async () => {
    // Arrange
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(payload))
    const client = createSpaceGuideClient(fetcher)
    const controller = new AbortController()

    // Act
    const result = await client.listSpaces(controller.signal)

    // Assert
    expect(result.locations[0]).toMatchObject({ id: 'cread-bogota', department: null })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/spaces', {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  })

  it('rejects a source URL outside the official UPTC domain', async () => {
    // Arrange
    const invalidPayload = structuredClone(payload)
    invalidPayload.locations[0].source.url = 'https://uptc.edu.co.attacker.example/locations'
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toThrow('La fuente de un espacio no cumple el contrato público.')
  })

  it('rejects a map query for an entry with no published street address', async () => {
    // Arrange
    const invalidPayload = structuredClone(payload)
    invalidPayload.locations[0].address = null as unknown as string
    invalidPayload.locations[0].mapQuery = 'Biblioteca municipal, Rondón'
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toThrow('Un espacio de la respuesta no cumple el contrato público.')
  })

  it('rejects impossible or future source dates', async () => {
    // Arrange
    const invalidPayload = structuredClone(payload)
    invalidPayload.locations[0].source.checkedAt = '2026-02-31'
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toThrow('La fuente de un espacio no cumple el contrato público.')
  })

  it('surfaces an HTTP error when the public catalog is temporarily unavailable', async () => {
    // Arrange
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse({}, 503)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toMatchObject<Partial<SpaceGuideApiError>>({
      name: 'SpaceGuideApiError',
      status: 503,
    })
  })
})
