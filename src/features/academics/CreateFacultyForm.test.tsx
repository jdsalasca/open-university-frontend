import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicOperationsClient } from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

const formModules = import.meta.glob<typeof import('./CreateFacultyForm')>('./CreateFacultyForm.tsx')

async function loadForm() {
  const loader = formModules['./CreateFacultyForm.tsx']
  expect(loader, 'the protected faculty creation form is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

describe('CreateFacultyForm', () => {
  it('creates a root faculty with an institutional reference and refreshes the structure', async () => {
    // Arrange
    const user = userEvent.setup()
    const unitId = '34a06170-9acf-4718-854e-92e945a7db17'
    const createOrganizationUnit = vi.fn().mockResolvedValue(unitId)
    const onCreated = vi.fn().mockResolvedValue(undefined)
    const client = { createOrganizationUnit } as unknown as Pick<AcademicOperationsClient, 'createOrganizationUnit'>
    const { CreateFacultyForm } = await loadForm()
    render(
      <CreateFacultyForm
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canWrite: true }}
        onCreated={onCreated}
      />,
    )

    await user.type(screen.getByLabelText('Código institucional'), 'fac-ciencias')
    await user.type(screen.getByLabelText('Nombre de la facultad'), 'Facultad de Ciencias')
    await user.clear(screen.getByLabelText('Vigente desde'))
    await user.type(screen.getByLabelText('Vigente desde'), '2026-09-30')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acuerdo institucional de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear facultad' }))

    // Assert
    await waitFor(() => expect(createOrganizationUnit).toHaveBeenCalledWith({
      code: 'fac-ciencias',
      type: 'FACULTY',
      displayName: 'Facultad de Ciencias',
      displayOrder: 0,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: 'Acuerdo institucional de prueba',
    }, 'institutional-access-token'))
    expect(onCreated).toHaveBeenCalledWith(unitId)
    expect(await screen.findByRole('status')).toHaveTextContent(/facultad registrada/i)
  })

  it('keeps a duplicate-code conflict visible and does not refresh the structure', async () => {
    // Arrange
    const user = userEvent.setup()
    const createOrganizationUnit = vi.fn().mockRejectedValue(
      new AcademicOperationsApiError(409, 'Conflicto de estructura'),
    )
    const onCreated = vi.fn()
    const client = { createOrganizationUnit } as unknown as Pick<AcademicOperationsClient, 'createOrganizationUnit'>
    const { CreateFacultyForm } = await loadForm()
    render(
      <CreateFacultyForm
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canWrite: true }}
        onCreated={onCreated}
      />,
    )
    await user.type(screen.getByLabelText('Código institucional'), 'fac-ciencias')
    await user.type(screen.getByLabelText('Nombre de la facultad'), 'Facultad de Ciencias')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acuerdo institucional de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear facultad' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya existe|conflicto/i)
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('revalidates authorization when the server rejects a faculty write', async () => {
    // Arrange
    const user = userEvent.setup()
    const createOrganizationUnit = vi.fn().mockRejectedValue(new AcademicOperationsApiError(403, 'Forbidden'))
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    const client = { createOrganizationUnit } as unknown as Pick<AcademicOperationsClient, 'createOrganizationUnit'>
    const { CreateFacultyForm } = await loadForm()
    render(
      <CreateFacultyForm
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canWrite: true }}
        onCreated={vi.fn()}
        onAuthorizationRejected={onAuthorizationRejected}
      />,
    )
    await user.type(screen.getByLabelText('Código institucional'), 'fac-ciencias')
    await user.type(screen.getByLabelText('Nombre de la facultad'), 'Facultad de Ciencias')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acuerdo institucional de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear facultad' }))

    // Assert
    await waitFor(() => expect(onAuthorizationRejected).toHaveBeenCalledWith('institutional-access-token'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/permiso|sesión/i)
  })
})
