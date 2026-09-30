import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { BrandingProvider } from './features/branding/BrandingProvider'
import { DEFAULT_BRANDING } from './features/branding/contracts'
import type { AcademicCatalogClient } from './features/academics/contracts'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '#inicio')
})

function emptyAcademicCatalogClient(): AcademicCatalogClient {
  return {
    listPrograms: async () => [],
    listCurricula: async () => [],
    getPublishedCurriculum: async () => { throw new Error('Unexpected public curriculum detail') },
    listDrafts: async () => [],
    getCurriculum: async () => { throw new Error('Unexpected curriculum review') },
    importCsv: async () => { throw new Error('Unexpected curriculum import') },
    publishCurriculum: async () => { throw new Error('Unexpected curriculum publication') },
  }
}

describe('App', () => {
  it('applies institution name, published logo, and module label to the application shell', async () => {
    // Arrange
    const branding = {
      ...DEFAULT_BRANDING,
      institutionName: 'Universidad de prueba institucional',
      assets: { ...DEFAULT_BRANDING.assets, logoDark: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301' },
      modules: DEFAULT_BRANDING.modules.map((module) => module.key === 'visual-identity'
        ? { ...module, label: 'Marca institucional' }
        : module),
    }
    render(
      <BrandingProvider loader={async () => branding}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const lockup = await screen.findByRole('link', { name: 'Universidad de prueba institucional, inicio' })

    // Assert
    expect(lockup.querySelector('img')).toHaveAttribute('src', '/assets/a7e7f06b-09a7-43db-a468-4c7b8ee3d301')
    expect(screen.getByRole('link', { name: 'Marca institucional' })).toBeVisible()
    expect(screen.getByText('Marca institucional', { selector: '.breadcrumbs strong' })).toBeVisible()
  })

  it('opens the visual identity control center and keeps publication closed without institutional access', async () => {
    // Arrange
    const branding = {
      ...DEFAULT_BRANDING,
      institutionName: 'Universidad Pedagógica y Tecnológica de Colombia',
    }
    render(
      <BrandingProvider loader={async () => branding}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const centerHeading = await screen.findByRole('heading', { name: 'Centro de identidad visual' })

    // Assert
    expect(centerHeading).toBeVisible()
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('La publicación requiere acceso institucional')
    expect(screen.getByRole('link', { name: 'Identidad visual' })).toBeVisible()
  })

  it('opens Programs as a keyboard accessible development preview while branding availability stays false', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App catalogClient={emptyAcademicCatalogClient()} />
      </BrandingProvider>,
    )

    // Act
    const programsLink = await screen.findByRole('link', { name: /programas.*vista previa/i })
    await user.tab()
    await user.tab()
    await user.tab()
    expect(programsLink).toHaveFocus()
    await user.keyboard('{Enter}')

    // Assert
    expect(await screen.findByRole('heading', { name: 'Programas de pregrado presencial' })).toBeVisible()
    expect(programsLink).toHaveAttribute('aria-current', 'page')
    expect(DEFAULT_BRANDING.modules.find((module) => module.key === 'programs')?.available).toBe(false)
    expect(screen.getByText(/Este módulo es una vista previa y no está habilitado para operación institucional/i)).toBeVisible()
  })
})
