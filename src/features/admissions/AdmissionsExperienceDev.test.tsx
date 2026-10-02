import { cleanup, render, screen } from '@testing-library/react'
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
})
