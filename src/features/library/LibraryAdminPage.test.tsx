import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryAdminPage } from './LibraryAdminPage'
import { LibraryApiError } from './libraryClient'
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
  withdrawnBy: null,
  withdrawnReference: null,
  withdrawnAt: null,
}

const WITHDRAWN_COPY: LibraryCopy = {
  ...ACTIVE_COPY,
  active: false,
  withdrawnBy: 'librarian',
  withdrawnReference: 'Resolución de descarte 7 de 2026',
  withdrawnAt: '2026-10-03T14:00:00Z',
}

function fakeClient(overrides: Partial<LibraryClient> = {}): LibraryClient {
  return {
    getTitles: vi.fn(async () => [TITLE]),
    getCopies: vi.fn(async () => [ACTIVE_COPY]),
    getOpenLoans: vi.fn(async () => [OVERDUE_LOAN]),
    registerTitle: vi.fn(async () => TITLE),
    registerCopy: vi.fn(async () => ACTIVE_COPY),
    withdrawCopy: vi.fn(async () => WITHDRAWN_COPY),
    returnLoan: vi.fn(async () => ({ ...OVERDUE_LOAN, returnedOn: '2026-10-03' })),
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

  it('asks the session to revalidate when the server rejects the library token', async () => {
    // Arrange: the server refuses the current bearer, so the identity has to be revalidated.
    const onAuthorizationRejected = vi.fn(async () => undefined)
    const client = fakeClient({
      getOpenLoans: vi.fn(async () => { throw new LibraryApiError(403, 'forbidden') }),
    })

    // Act
    render(<LibraryAdminPage
      client={client}
      authorization={{ accessToken: 'token', canRead: true, canWrite: false }}
      onAuthorizationRejected={onAuthorizationRejected}
    />)

    // Assert
    await waitFor(() => expect(onAuthorizationRejected).toHaveBeenCalledWith('token'))
  })

  it('does not allow withdrawing a copy without an institutional reference', async () => {
    // Arrange
    const client = fakeClient()
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)

    // Act
    await user.selectOptions(await screen.findByLabelText('Seleccionar título'), 'title-1')
    await screen.findByText('BC-0001')

    // Assert: the button is inert until a reference exists, and nothing was written.
    expect((screen.getByRole('button', { name: 'Retirar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(client.withdrawCopy).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Referencia institucional del retiro'), 'Resolución 9 de 2026')
    expect((screen.getByRole('button', { name: 'Retirar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('registers the return of an outstanding loan with an institutional reference', async () => {
    // Arrange: the desk sees one loan on its way out, which then leaves the outstanding list.
    const client = fakeClient({
      getOpenLoans: vi.fn(async () => [OVERDUE_LOAN]).mockResolvedValueOnce([OVERDUE_LOAN]).mockResolvedValue([]),
    })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)

    // Act
    await screen.findByText('Préstamos pendientes')
    const registerReturn = () => screen.getByRole('button', { name: 'Registrar devolución' }) as HTMLButtonElement
    expect(registerReturn().disabled).toBe(true)
    await user.type(screen.getByLabelText('Referencia institucional de la devolución'), 'Devolución 1 de 2026')
    await user.click(registerReturn())

    // Assert
    await waitFor(() => expect(client.returnLoan).toHaveBeenCalledWith('loan-1', 'Devolución 1 de 2026', 'token'))
    expect(await screen.findByText('No hay ejemplares pendientes de devolución.')).toBeTruthy()
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
    expect(await screen.findByText('Retirado · Resolución de descarte 7 de 2026')).toBeTruthy()
  })
})
