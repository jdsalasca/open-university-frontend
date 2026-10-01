import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AcademicOperationsClient,
  AcademicOrganizationRelation,
  AcademicOrganizationUnit,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

const formModules = import.meta.glob<typeof import('./CloseAcademicOrganizationRelationForm')>(
  './CloseAcademicOrganizationRelationForm.tsx',
)

async function loadForm() {
  const loader = formModules['./CloseAcademicOrganizationRelationForm.tsx']
  expect(loader, 'the protected relation closure form is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const units: AcademicOrganizationUnit[] = [
  {
    id: 'fae06170-9acf-4718-854e-92e945a7db17',
    code: 'FACULTY-TEST',
    type: 'FACULTY',
    displayName: 'Facultad de prueba',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2020-01-01',
    validThrough: null,
  },
  {
    id: '127d89c9-a72a-436a-9a90-26da60bc9570',
    code: 'SCHOOL-TEST',
    type: 'SCHOOL',
    displayName: 'Escuela de prueba',
    displayOrder: 2,
    status: 'ACTIVE',
    validFrom: '2020-01-01',
    validThrough: null,
  },
]

const relations: AcademicOrganizationRelation[] = [
  {
    parentUnitId: units[0]!.id,
    childUnitId: units[1]!.id,
    displayOrder: 1,
    validFrom: '2024-01-01',
    validThrough: null,
  },
  {
    parentUnitId: units[0]!.id,
    childUnitId: units[1]!.id,
    displayOrder: 1,
    validFrom: '2019-01-01',
    validThrough: '2019-12-31',
  },
  {
    parentUnitId: units[0]!.id,
    childUnitId: units[1]!.id,
    displayOrder: 1,
    validFrom: '2018-01-01',
    validThrough: '2018-01-01',
  },
]

const authorization = { accessToken: 'institutional-access-token', canRead: true, canWrite: true }

describe('CloseAcademicOrganizationRelationForm', () => {
  it('requires review and explicit confirmation, then closes only the selected dated relation', async () => {
    // Arrange
    const user = userEvent.setup()
    const closeOrganizationRelation = vi.fn().mockResolvedValue(undefined)
    const onClosed = vi.fn().mockResolvedValue(undefined)
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicOrganizationRelationForm } = await loadForm()
    render(<CloseAcademicOrganizationRelationForm
      units={units}
      relations={relations}
      client={client}
      authorization={authorization}
      onClosed={onClosed}
    />)

    await user.selectOptions(screen.getByLabelText('Relación organizacional'), `${units[0]!.id}|${units[1]!.id}|2024-01-01`)
    await user.type(screen.getByLabelText('Último día de vigencia (inclusive)'), '2026-06-30')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acta de reorganización 17 de 2026')

    // Act
    await user.click(screen.getByRole('button', { name: 'Revisar cierre' }))

    // Assert
    expect(closeOrganizationRelation).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Confirmar cierre de relación' })).toHaveTextContent('2026-06-30')

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre de relación' }))

    // Assert
    await waitFor(() => expect(closeOrganizationRelation).toHaveBeenCalledWith(
      units[0]!.id,
      units[1]!.id,
      {
        validFrom: '2024-01-01',
        effectiveThrough: '2026-06-30',
        sourceReference: 'Acta de reorganización 17 de 2026',
      },
      'institutional-access-token',
    ))
    expect(closeOrganizationRelation).toHaveBeenCalledTimes(1)
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent(/relación.*cerrada/i)
  })

  it('refreshes after a concurrent change and does not retry the close automatically', async () => {
    // Arrange
    const user = userEvent.setup()
    const closeOrganizationRelation = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const onClosed = vi.fn().mockResolvedValue(undefined)
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicOrganizationRelationForm } = await loadForm()
    render(<CloseAcademicOrganizationRelationForm
      units={units}
      relations={[relations[0]!]}
      client={client}
      authorization={authorization}
      onClosed={onClosed}
    />)

    await user.selectOptions(screen.getByLabelText('Relación organizacional'), `${units[0]!.id}|${units[1]!.id}|2024-01-01`)
    await user.type(screen.getByLabelText('Último día de vigencia (inclusive)'), '2026-06-30')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Referencia de prueba')
    await user.click(screen.getByRole('button', { name: 'Revisar cierre' }))

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre de relación' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/conflicto.*actualicé la estructura/i)
    expect(closeOrganizationRelation).toHaveBeenCalledTimes(1)
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Confirmar cierre de relación' })).not.toBeInTheDocument()
  })

  it('caps an existing finite interval and rejects an extension even if submitted programmatically', async () => {
    // Arrange
    const closeOrganizationRelation = vi.fn()
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicOrganizationRelationForm } = await loadForm()
    const finiteRelation: AcademicOrganizationRelation = { ...relations[0]!, validThrough: '2027-01-01' }
    const { container } = render(<CloseAcademicOrganizationRelationForm
      units={units}
      relations={[finiteRelation]}
      client={client}
      authorization={authorization}
      onClosed={vi.fn()}
    />)

    await userEvent.setup().selectOptions(
      screen.getByLabelText('Relación organizacional'),
      `${units[0]!.id}|${units[1]!.id}|2024-01-01`,
    )
    const dateInput = screen.getByLabelText('Último día de vigencia (inclusive)')
    expect(dateInput).toHaveAttribute('max', '2026-12-31')
    fireEvent.change(dateInput, { target: { value: '2027-01-01' } })
    fireEvent.change(screen.getByLabelText('Referencia institucional'), { target: { value: 'Referencia de prueba' } })

    // Act
    fireEvent.submit(container.querySelector('form')!)

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/acorte su vigencia/i)
    expect(closeOrganizationRelation).not.toHaveBeenCalled()
  })

  it('does not expose a close action to an operator without write permission', async () => {
    // Arrange
    const closeOrganizationRelation = vi.fn()
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicOrganizationRelationForm } = await loadForm()

    // Act
    const { container } = render(<CloseAcademicOrganizationRelationForm
      units={units}
      relations={relations}
      client={client}
      authorization={{ ...authorization, canWrite: false }}
      onClosed={vi.fn()}
    />)

    // Assert
    expect(container).toBeEmptyDOMElement()
    expect(closeOrganizationRelation).not.toHaveBeenCalled()
  })

  it('explains when all known relations are already expired or cannot be shortened', async () => {
    // Arrange
    const closeOrganizationRelation = vi.fn()
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicOrganizationRelationForm } = await loadForm()

    // Act
    render(<CloseAcademicOrganizationRelationForm
      units={units}
      relations={[relations[1]!, relations[2]!]}
      client={client}
      authorization={authorization}
      onClosed={vi.fn()}
    />)

    // Assert
    expect(screen.getByText(/no hay relaciones actuales o futuras que puedan acortarse/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Relación organizacional')).not.toBeInTheDocument()
    expect(closeOrganizationRelation).not.toHaveBeenCalled()
  })
})
