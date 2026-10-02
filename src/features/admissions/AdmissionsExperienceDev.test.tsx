import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdmissionsExperience } from './AdmissionsExperience'
import type { AdmissionsCallClient } from './admissionsCallContracts'

afterEach(cleanup)

function publicCalendarClient(): AdmissionsCallClient {
  return {
    getPublicCalls: vi.fn(async () => []),
    getAdminCalls: vi.fn(async () => []),
    createCall: vi.fn(async () => { throw new Error('Unexpected call creation') }),
    createRevision: vi.fn(async () => { throw new Error('Unexpected revision creation') }),
    updateDraft: vi.fn(async () => { throw new Error('Unexpected draft update') }),
    publish: vi.fn(async () => { throw new Error('Unexpected publication') }),
  }
}

describe('AdmissionsExperience in the local Vite preview', () => {
  it('opens the applicant experience, preserves the public calendar, and makes no application API calls', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = publicCalendarClient()
    render(<AdmissionsExperience client={client} />)

    // Act
    expect(await screen.findByRole('tab', { name: /aspirante · demo/i })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: /calendario público/i }))

    // Assert
    expect(await screen.findByRole('heading', { name: /pregrado presencial.*2027-i/i })).toBeVisible()
    expect(screen.getByText(/no hay una convocatoria administrada publicada/i)).toBeVisible()
    expect(client.getPublicCalls).toHaveBeenCalledOnce()
    expect(client.getAdminCalls).not.toHaveBeenCalled()
    expect(client.createCall).not.toHaveBeenCalled()
  })

  it('shares the correction loop between the synthetic applicant and admissions-team views', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = publicCalendarClient()
    render(<AdmissionsExperience client={client} />)

    // Act
    await user.click(await screen.findByRole('tab', { name: /equipo de admisiones/i }))
    const adminCase = screen.getByRole('article', { name: /ficha demo-0001/i })
    await user.click(within(adminCase).getByRole('button', { name: /ver detalle/i }))
    await user.click(screen.getByRole('button', { name: /iniciar revisión demo/i }))
    await user.selectOptions(screen.getByLabelText(/motivo de ajuste demo/i), 'DEMO_COMPLETE_CHECKLIST')
    await user.click(screen.getByRole('button', { name: /solicitar ajuste demo/i }))
    await user.click(screen.getByRole('tab', { name: /aspirante/i }))
    const applicantCase = screen.getByRole('article', { name: /ficha demo-0001/i })
    await user.click(within(applicantCase).getByRole('button', { name: /confirmo la respuesta demo/i }))
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))

    // Assert
    await user.click(within(adminCase).getByRole('button', { name: /ver detalle/i }))
    const detail = screen.getByRole('region', { name: /detalle de ficha DEMO-0001/i })
    expect(within(detail).getByRole('status')).toHaveTextContent(/respuesta demo recibida/i)
    expect(screen.getByRole('button', { name: /reanudar revisión demo/i })).toBeVisible()
    expect(client.createCall).not.toHaveBeenCalled()
    expect(client.getAdminCalls).not.toHaveBeenCalled()
  })
})
