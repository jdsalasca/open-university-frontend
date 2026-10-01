import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpaceDirectorySnapshot, SpaceLocation } from './spaceGuideContracts'
import type { SpaceGuideClient } from './spaceGuideClient'
import { SpaceGuidePage } from './SpaceGuidePage'

afterEach(cleanup)

const locations: SpaceLocation[] = [
  {
    id: 'site-central-tunja', kind: 'CAMPUS', name: 'Sede Central Tunja', municipality: 'Tunja',
    department: 'Boyacá', address: 'Avenida Central del Norte 39-115', locationDetail: null,
    mapQuery: 'Avenida Central del Norte 39-115, Tunja, Boyacá, Colombia',
    source: {
      label: 'Localización y sedes UPTC', url: 'https://uptc.edu.co/sitio/portal/sitios/localizacion/',
      checkedAt: '2026-10-01', sourceUpdatedAt: '2026-07-03',
    },
  },
  {
    id: 'cread-chiquinquira', kind: 'CREAD', name: 'CREAD Chiquinquirá', municipality: 'Chiquinquirá',
    department: null, address: 'Calle 14 No. 2-37, barrio Sucre', locationDetail: null,
    mapQuery: 'Calle 14 No. 2-37, barrio Sucre, Chiquinquirá',
    source: {
      label: 'Localización y sedes UPTC', url: 'https://uptc.edu.co/sitio/portal/sitios/localizacion/',
      checkedAt: '2026-10-01', sourceUpdatedAt: '2026-07-03',
    },
  },
  {
    id: 'service-acra', kind: 'SERVICE', name: 'Admisiones y Control de Registro Académico (ACRA)',
    municipality: 'Tunja', department: 'Boyacá', address: 'Sede Central Tunja, Avenida Central del Norte 39-115',
    locationDetail: 'Edificio de Admisiones, primer piso',
    mapQuery: 'Edificio de Admisiones UPTC, Avenida Central del Norte 39-115, Tunja, Boyacá',
    source: {
      label: 'Contacto ACRA UPTC', url: 'https://uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/adm_reg/cont.html',
      checkedAt: '2026-10-01', sourceUpdatedAt: null,
    },
  },
]

const snapshot: SpaceDirectorySnapshot = {
  locations,
  officialOfficeDirectoryUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/directorio/',
}

function clientReturning(data: SpaceDirectorySnapshot = snapshot): SpaceGuideClient {
  return { listSpaces: vi.fn().mockResolvedValue(data) }
}

describe('SpaceGuidePage', () => {
  it('loads the sourced campus, CREAD and service cards with map and source links', async () => {
    // Arrange
    const client = clientReturning()
    render(<SpaceGuidePage client={client} />)

    // Act
    const campusCard = await screen.findByRole('article', { name: /sede central tunja/i })

    // Assert
    expect(screen.getByRole('heading', { name: 'Guía de espacios' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('3 de 3 espacios')
    expect(within(campusCard).getByRole('link', { name: /abrir búsqueda de mapa para sede central tunja/i }))
      .toHaveAttribute('href', expect.stringContaining('openstreetmap.org/search?query='))
    expect(within(campusCard).getByRole('link', { name: 'Localización y sedes UPTC' }))
      .toHaveAttribute('href', 'https://uptc.edu.co/sitio/portal/sitios/localizacion/')
    expect(screen.getByRole('link', { name: /directorio oficial de oficinas/i })).toHaveAttribute(
      'href', snapshot.officialOfficeDirectoryUrl,
    )
  })

  it('searches without accents and combines the text query with a location type filter', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /cread chiquinquirá/i })

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios' }), 'chiquinquira')

    // Assert
    expect(screen.getByRole('article', { name: /cread chiquinquirá/i })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('1 de 3 espacios')
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar espacios' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'SERVICE')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios' }), 'TUNJA')

    // Assert
    expect(screen.getByRole('article', { name: /acra/i })).toBeVisible()
    expect(screen.queryByRole('article', { name: /sede central tunja/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 de 3 espacios')
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar espacios' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios' }), 'chiquinquira')
    expect(screen.getByRole('status')).toHaveTextContent('0 de 3 espacios')
  })

  it('shows an empty-search state and lets the visitor clear filters', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /sede central tunja/i })

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios' }), 'lugar inexistente')

    // Assert
    expect(screen.getByText('No encontramos espacios con esos filtros.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('status')).toHaveTextContent('3 de 3 espacios')
  })

  it('reports a loading failure and retries the public catalog request', async () => {
    // Arrange
    const user = userEvent.setup()
    const client: SpaceGuideClient = {
      listSpaces: vi.fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(snapshot),
    }
    render(<SpaceGuidePage client={client} />)

    // Act
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    // Assert
    expect(await screen.findByRole('article', { name: /acra/i })).toBeVisible()
    expect(client.listSpaces).toHaveBeenCalledTimes(2)
  })

  it('does not create an external map link for a location without a published street address', async () => {
    // Arrange
    const incompleteLocation = {
      ...locations[2], address: null, locationDetail: 'Segundo piso de la biblioteca municipal', mapQuery: null,
    } as SpaceLocation
    render(<SpaceGuidePage client={clientReturning({ ...snapshot, locations: [incompleteLocation] })} />)

    // Act
    const serviceCard = await screen.findByRole('article', { name: /acra/i })

    // Assert
    expect(within(serviceCard).queryByRole('link', { name: /abrir búsqueda de mapa/i })).not.toBeInTheDocument()
  })
})
