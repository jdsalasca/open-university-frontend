import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../../App'
import { BrandingProvider } from '../branding/BrandingProvider'
import { DEFAULT_BRANDING } from '../branding/contracts'

function renderStudentServicesPage() {
  window.history.replaceState(null, '', '#estudiantes')
  render(
    <BrandingProvider loader={async () => DEFAULT_BRANDING}>
      <App />
    </BrandingProvider>,
  )
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '#inicio')
})

describe('StudentServicesPage', () => {
  it('shows Bienestar and Biblioteca services as source-attributed cards', async () => {
    // Arrange
    renderStudentServicesPage()

    // Act
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Assert
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(4)
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Bienestar Universitario',
      'Bienestar Virtual',
      'Préstamo y consulta bibliográfica',
      'Biblioteca digital y catálogo',
    ])
    expect(screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' })).toBeVisible()
    expect(screen.queryAllByRole('form')).toHaveLength(0)

    const sourceLinks = screen.getAllByRole('link', { name: /en el portal oficial UPTC/i })
    expect(sourceLinks).toHaveLength(4)
    for (const link of sourceLinks) {
      const sourceUrl = new URL(link.getAttribute('href') ?? '')
      expect(sourceUrl.protocol).toBe('https:')
      expect(sourceUrl.hostname).toBe('www.uptc.edu.co')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('matches accented service names with case-insensitive, unaccented text', async () => {
    // Arrange
    const user = userEvent.setup()
    renderStudentServicesPage()
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' }), 'PRESTAMO')

    // Assert
    const cards = screen.getAllByRole('article')
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Préstamo y consulta bibliográfica',
    ])
    expect(screen.getByText('1', { selector: 'strong' })).toBeVisible()
    expect(screen.getByText('servicio disponible')).toBeVisible()
  })

  it('combines a category filter with the local text search', async () => {
    // Arrange
    const user = userEvent.setup()
    renderStudentServicesPage()
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Act
    await user.click(screen.getByRole('button', { name: 'Biblioteca' }))
    const search = screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' })
    await user.type(search, 'PRESTAMO')

    // Assert
    expect(screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Préstamo y consulta bibliográfica',
    ])
    expect(screen.queryByRole('heading', { name: 'Bienestar Universitario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Bienestar Virtual' })).not.toBeInTheDocument()
  })

  it('explains an empty result and resets the search and category together', async () => {
    // Arrange
    const user = userEvent.setup()
    renderStudentServicesPage()
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Act
    await user.click(screen.getByRole('button', { name: 'Biblioteca' }))
    const search = screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' })
    await user.type(search, 'sin coincidencias')

    // Assert
    expect(screen.getByText('0', { selector: 'strong' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('No encontramos servicios con esos filtros.')
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda y filtros' }))
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(search).toHaveValue('')
    expect(search).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
  })
})
