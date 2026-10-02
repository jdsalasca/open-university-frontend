import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AdmissionsApplicantDemo } from './AdmissionsApplicantDemo'
import {
  ADMISSIONS_DEMO_PROGRAM_OPTIONS,
  createAdmissionsDemoStore,
} from './admissionsDemoStore'

afterEach(cleanup)

describe('AdmissionsApplicantDemo', () => {
  it('validates missing choices and confirmations without creating a case', async () => {
    // Arrange
    const user = userEvent.setup()
    const store = createAdmissionsDemoStore()
    render(<AdmissionsApplicantDemo store={store} />)

    // Act
    await user.click(screen.getByRole('button', { name: /crear ficha sintética/i }))

    // Assert
    const validationMessages = await screen.findAllByRole('alert')
    expect(validationMessages).toHaveLength(4)
    expect(validationMessages[0]).toHaveTextContent(/selecciona una primera opción ficticia/i)
    expect(validationMessages[1]).toHaveTextContent(/selecciona una segunda opción ficticia/i)
    expect(validationMessages[2]).toHaveTextContent(/lee y acepta el aviso de demostración/i)
    expect(validationMessages[3]).toHaveTextContent(/confirma que ambas opciones son ficticias/i)
    expect(store.getState().applications).toHaveLength(2)
  })

  it('rejects the same sample option in both preference fields', async () => {
    // Arrange
    const user = userEvent.setup()
    const store = createAdmissionsDemoStore()
    render(<AdmissionsApplicantDemo store={store} />)

    // Act
    await user.selectOptions(screen.getByLabelText(/primera opción ficticia/i), ADMISSIONS_DEMO_PROGRAM_OPTIONS[0].id)
    await user.selectOptions(screen.getByLabelText(/segunda opción ficticia/i), ADMISSIONS_DEMO_PROGRAM_OPTIONS[0].id)
    await user.click(screen.getByRole('checkbox', { name: /lee y acepta el aviso de demostración/i }))
    await user.click(screen.getByRole('checkbox', { name: /confirmo que ambas opciones/i }))
    await user.click(screen.getByRole('button', { name: /crear ficha sintética/i }))

    // Assert
    expect(await screen.findByText(/elige una segunda opción diferente/i)).toBeVisible()
    expect(store.getState().applications).toHaveLength(2)
  })

  it('creates a local synthetic case that the admin inbox can read', async () => {
    // Arrange
    const user = userEvent.setup()
    const store = createAdmissionsDemoStore()
    render(<AdmissionsApplicantDemo store={store} />)

    // Act
    await user.selectOptions(screen.getByLabelText(/primera opción ficticia/i), ADMISSIONS_DEMO_PROGRAM_OPTIONS[0].id)
    await user.selectOptions(screen.getByLabelText(/segunda opción ficticia/i), ADMISSIONS_DEMO_PROGRAM_OPTIONS[1].id)
    await user.click(screen.getByRole('checkbox', { name: /lee y acepta el aviso de demostración/i }))
    await user.click(screen.getByRole('checkbox', { name: /confirmo que ambas opciones/i }))
    await user.click(screen.getByRole('button', { name: /crear ficha sintética/i }))

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent(/DEMO-0003/)
    expect(screen.getByRole('status')).toHaveTextContent(/solo existe en memoria/i)
    expect(store.getState().applications[0]).toMatchObject({
      reference: 'DEMO-0003',
      firstChoiceId: ADMISSIONS_DEMO_PROGRAM_OPTIONS[0].id,
      secondChoiceId: ADMISSIONS_DEMO_PROGRAM_OPTIONS[1].id,
      status: 'DEMO_RECEIVED',
    })
    expect(screen.queryByLabelText(/nombre|documento|correo|teléfono|archivo/i)).not.toBeInTheDocument()
  })
})
