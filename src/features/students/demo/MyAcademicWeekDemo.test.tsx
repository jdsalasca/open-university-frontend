import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

const demoModules = import.meta.glob<typeof import('./MyAcademicWeekDemo')>('./MyAcademicWeekDemo.tsx')

async function loadDemo() {
  const loader = demoModules['./MyAcademicWeekDemo.tsx']
  expect(loader, 'the student week preview is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(cleanup)

describe('MyAcademicWeekDemo', () => {
  it('shows a clearly synthetic, read-only weekly agenda', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()

    // Act
    render(<MyAcademicWeekDemo />)

    // Assert
    expect(screen.getByRole('heading', { name: 'Mi semana académica' })).toBeVisible()
    expect(screen.getByText(/agenda ficticia/i)).toBeVisible()
    expect(screen.getByText(/no refleja una matrícula real/i)).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /inscrib|cancelar|nota|calificar/i })).not.toBeInTheDocument()
  })

  it('filters sessions by selected weekday without changing the agenda data', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Martes' }))

    // Assert
    const agenda = screen.getByRole('region', { name: /agenda semanal de ejemplo/i })
    expect(within(agenda).getAllByRole('article')).toHaveLength(1)
    expect(within(agenda).getByText('Martes')).toBeVisible()
    expect(within(agenda).getByText('Lectura académica de muestra')).toBeVisible()
    expect(within(agenda).queryByText('Laboratorio de ejemplo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Martes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens an accessible detail panel for the selected sample session', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: /ver detalle de laboratorio de ejemplo/i }))

    // Assert
    const details = screen.getByRole('region', { name: /detalle de la sesión seleccionada/i })
    expect(within(details).getByText('DEMO-202')).toBeVisible()
    expect(within(details).getByText('Taller de muestra 02')).toBeVisible()
    expect(within(details).getByText('Docente de ejemplo 2')).toBeVisible()
  })

  it('explains when a selected day has no sample sessions', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Domingo' }))

    // Assert
    expect(screen.getByText(/no hay sesiones en este día de la agenda de ejemplo/i)).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('clears a selected session when the day filter changes', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: /ver detalle de laboratorio de ejemplo/i }))
    expect(screen.getByText('Taller de muestra 02')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Martes' }))

    // Assert
    expect(screen.queryByText('Taller de muestra 02')).not.toBeInTheDocument()
    expect(screen.getByText(/elige una sesión para consultar sus detalles de ejemplo/i)).toBeVisible()
  })
})
