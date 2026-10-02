import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AdmissionsAdminDemo } from './AdmissionsAdminDemo'
import { createAdmissionsDemoStore } from './admissionsDemoStore'

afterEach(cleanup)

describe('AdmissionsAdminDemo', () => {
  it('shows a synthetic inbox without exposing applicant identity fields or admission decisions', () => {
    // Arrange
    const store = createAdmissionsDemoStore()
    render(<AdmissionsAdminDemo store={store} />)

    // Act
    const inbox = screen.getByRole('region', { name: /bandeja ficticia/i })

    // Assert
    expect(within(inbox).getByText('DEMO-0001')).toBeVisible()
    expect(within(inbox).getByText('DEMO-0002')).toBeVisible()
    expect(within(inbox).getAllByText(/programa ficticio/i)).toHaveLength(4)
    expect(inbox).toHaveTextContent(/datos de ejemplo/i)
    expect(within(inbox).queryByText(/admitir|rechazar|puntaje|documento de identidad/i)).not.toBeInTheDocument()
  })

  it('explains an empty inbox and points to the synthetic applicant journey', () => {
    // Arrange
    const store = createAdmissionsDemoStore()
    store.setState({ applications: [] })
    render(<AdmissionsAdminDemo store={store} />)

    // Act
    const inbox = screen.getByRole('region', { name: /bandeja ficticia/i })

    // Assert
    expect(within(inbox).getByRole('heading', { name: /aún no hay fichas sintéticas/i })).toBeVisible()
    expect(within(inbox).getByText(/cambia a la vista del aspirante/i)).toBeVisible()
    expect(within(inbox).queryByRole('article')).not.toBeInTheDocument()
  })

  it('allows only forward demo review actions and reflects the changed status', async () => {
    // Arrange
    const user = userEvent.setup()
    const store = createAdmissionsDemoStore()
    render(<AdmissionsAdminDemo store={store} />)
    const firstCase = screen.getByRole('article', { name: /DEMO-0001/i })

    // Act
    await user.click(within(firstCase).getByRole('button', { name: /iniciar revisión demo/i }))

    // Assert
    expect(store.getState().applications.find((item) => item.reference === 'DEMO-0001')?.status)
      .toBe('DEMO_REVIEWING')
    expect(within(firstCase).getByText(/revisión demo en curso/i)).toBeVisible()
    expect(within(firstCase).getByRole('button', { name: /cerrar revisión demo/i })).toBeVisible()
    expect(within(firstCase).queryByRole('button', { name: /admitir|rechazar/i })).not.toBeInTheDocument()
  })

  it('marks a demo review complete without creating a selection result', async () => {
    // Arrange
    const user = userEvent.setup()
    const store = createAdmissionsDemoStore()
    render(<AdmissionsAdminDemo store={store} />)
    const secondCase = screen.getByRole('article', { name: /DEMO-0002/i })

    // Act
    await user.click(within(secondCase).getByRole('button', { name: /cerrar revisión demo/i }))

    // Assert
    expect(store.getState().applications.find((item) => item.reference === 'DEMO-0002')?.status)
      .toBe('DEMO_REVIEW_COMPLETE')
    expect(within(secondCase).getByText(/revisión demo finalizada/i)).toBeVisible()
    expect(within(secondCase).queryByRole('button')).not.toBeInTheDocument()
  })
})
