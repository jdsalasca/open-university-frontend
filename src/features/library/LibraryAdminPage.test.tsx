import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryAdminPage } from './LibraryAdminPage'
import type { LibraryClient } from './libraryClient'
import type { LibraryCopy, LibraryLoan, LibraryTitle } from './libraryContracts'

const TITLE: LibraryTitle = {
  titleId: 'title-1',
  title: 'Álgebra lineal',
  authors: ['Autor uno'],
  edition: '3a',
  publicationYear: 2019,
  sourceReference: 'Acta 1 de 2026',
}

const OVERDUE_LOAN: LibraryLoan = {
  loanId: 'loan-1',
  copyId: 'copy-1',
  borrowerUserId: 'user-1',
  lentOn: '2026-01-01',
  dueOn: '2026-02-01',
  returnedOn: null,
  overdue: true,
  sourceReference: 'Préstamo 1 de 2026',
}

const ACTIVE_COPY: LibraryCopy = {
  copyId: 'copy-1',
  titleId: 'title-1',
  barcode: 'BC-0001',
  location: 'Estante A-3',
  active: true,
}

const WITHDRAWN_COPY: LibraryCopy = { ...ACTIVE_COPY, active: false }

function fakeClient(overrides: Partial<LibraryClient> = {}): LibraryClient {
  return {
    getTitles: vi.fn(async () => [TITLE]),
    getCopies: vi.fn(async () => [ACTIVE_COPY]),
    getOpenLoans: vi.fn(async () => [OVERDUE_LOAN]),
    registerTitle: vi.fn(async () => TITLE),
    registerCopy: vi.fn(async () => ACTIVE_COPY),
    withdrawCopy: vi.fn(async () => WITHDRAWN_COPY),
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('LibraryAdminPage', () => {
  it('lists the outstanding loans and marks the overdue ones', async () => {
    // Arrange + Act
    render(<LibraryAdminPage client={fakeClient()} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)

    // Assert
    expect(await screen.findByText('Préstamos pendientes')).toBeTruthy()
    expect(screen.getByText('2026-02-01')).toBeTruthy()
    expect(screen.getByText('Vencido')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar título' })).toBeNull()
  })

  it('renders nothing when the session cannot read the library', () => {
    // Arrange + Act
    const { container } = render(
      <LibraryAdminPage client={fakeClient()} authorization={{ accessToken: 'token', canRead: false, canWrite: true }} />,
    )

    // Assert
    expect(container.firstChild).toBeNull()
  })

  it('records the institutional reference when a librarian withdraws a copy', async () => {
    // Arrange
    const client = fakeClient({
      getCopies: vi.fn(async () => [ACTIVE_COPY]).mockResolvedValueOnce([ACTIVE_COPY]).mockResolvedValue([WITHDRAWN_COPY]),
    })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)

    // Act
    await user.selectOptions(await screen.findByLabelText('Seleccionar título'), 'title-1')
    await screen.findByText('BC-0001')
    await user.type(screen.getByLabelText('Referencia institucional del retiro'), 'Resolución de descarte 7 de 2026')
    await user.click(screen.getByRole('button', { name: 'Retirar' }))

    // Assert
    await waitFor(() => expect(client.withdrawCopy).toHaveBeenCalledWith('copy-1', 'Resolución de descarte 7 de 2026', 'token'))
    expect(await screen.findByText('Retirado')).toBeTruthy()
  })
})
