import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { BrandingProvider } from './features/branding/BrandingProvider'
import { DEFAULT_BRANDING } from './features/branding/contracts'

afterEach(cleanup)

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
})
