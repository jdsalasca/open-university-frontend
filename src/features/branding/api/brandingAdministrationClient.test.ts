import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpBrandingAdministrationClient } from './brandingAdministrationClient'

afterEach(() => vi.unstubAllGlobals())

describe('HttpBrandingAdministrationClient', () => {
  it('uploads a file with a bearer token without persisting the browser filename in metadata', async () => {
    // Arrange
    const metadata = {
      assetId: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301',
      mimeType: 'image/png',
      sizeBytes: 8,
      width: 2,
      height: 2,
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(metadata), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new HttpBrandingAdministrationClient()
    const file = new File(['12345678'], 'logo.png', { type: 'image/png' })

    // Act
    const result = await client.uploadAsset(file, 'institution-admin-token')

    // Assert
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/branding/assets', expect.objectContaining({
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer institution-admin-token' },
    }))
    expect(fetchMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData)
    expect(result).toEqual(metadata)
  })

  it('publishes the explicit current revision and uses the API audit contract', async () => {
    // Arrange
    const change = {
      expectedRevision: 7,
      institutionName: 'Universidad UPTC',
      colors: { primary: '#FFCC29', ink: '#1A1A1A', surface: '#FFFFFF', text: '#1A1A1A', accent: '#FFCC29', focus: '#1A1A1A' },
      assets: { logoLight: null, logoDark: null, favicon: null },
      modules: [],
      banners: [],
    }
    const published = { ...change, revision: 8 }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(published), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new HttpBrandingAdministrationClient()

    // Act
    const result = await client.publishConfiguration(change, 'institution-admin-token')

    // Assert
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/branding', expect.objectContaining({
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer institution-admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(change),
    }))
    expect(result.revision).toBe(8)
  })

  it('preserves a structured revision conflict for the editor to handle', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"revision_conflict"}', { status: 409 })))
    const client = new HttpBrandingAdministrationClient()

    // Act + Assert
    await expect(client.restoreRevision(6, 7, 'institution-admin-token'))
      .rejects.toMatchObject({ name: 'BrandingAdministrationError', status: 409, code: 'revision_conflict' })
  })
})
