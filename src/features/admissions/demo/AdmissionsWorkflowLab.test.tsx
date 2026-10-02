import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AdmissionsWorkflowLab } from './AdmissionsWorkflowLab'

afterEach(cleanup)

describe('AdmissionsWorkflowLab', () => {
  it('starts in the applicant demo and keeps a created synthetic case available to the admin view', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)

    // Act
    await user.selectOptions(screen.getByLabelText(/primera opción ficticia/i), 'demo-program-a')
    await user.selectOptions(screen.getByLabelText(/segunda opción ficticia/i), 'demo-program-b')
    await user.click(screen.getByRole('checkbox', { name: /lee y acepta/i }))
    await user.click(screen.getByRole('checkbox', { name: /confirmo que ambas opciones/i }))
    await user.click(screen.getByRole('button', { name: /crear ficha sintética/i }))
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))

    // Assert
    const inbox = screen.getByRole('region', { name: /bandeja ficticia/i })
    expect(within(inbox).getByText('DEMO-0003')).toBeVisible()
    expect(screen.getByText(/demostración local · datos sintéticos/i)).toBeVisible()
  })

  it('supports arrow-key navigation and preserves the public calendar view', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)
    const applicantTab = screen.getByRole('tab', { name: /aspirante/i })

    // Act
    applicantTab.focus()
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{ArrowRight}')

    // Assert
    expect(screen.getByRole('tab', { name: /calendario público/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: /calendario público/i })).toHaveTextContent('Calendario público conservado')
  })

  it('keeps the demo store in memory during perspective changes but starts a clean demo after remount', async () => {
    // Arrange
    const user = userEvent.setup()
    const view = render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))
    const firstCase = screen.getByRole('article', { name: /DEMO-0001/i })

    // Act
    await user.click(within(firstCase).getByRole('button', { name: /iniciar revisión demo/i }))
    await user.click(screen.getByRole('tab', { name: /aspirante/i }))
    expect(screen.getByText(/2 fichas sintéticas/i)).toBeVisible()
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))
    expect(screen.getByRole('article', { name: /DEMO-0001/i })).toHaveTextContent(/revisión demo en curso/i)
    view.unmount()
    render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))

    // Assert
    expect(screen.getByRole('article', { name: /DEMO-0001/i })).toHaveTextContent(/pendiente de revisión demo/i)
    expect(screen.queryByText('DEMO-0003')).not.toBeInTheDocument()
  })
})
