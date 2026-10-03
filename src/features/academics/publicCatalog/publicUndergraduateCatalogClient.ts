import snapshotUrl from './uptcUndergraduateCatalog.snapshot.json?url'
import type { PublicUndergraduateCatalogSnapshot, PublicUndergraduateProgram } from './publicUndergraduateCatalog'

const OFFICIAL_HOST = 'www.uptc.edu.co'

export async function fetchPublicUndergraduateCatalog(
  signal?: AbortSignal,
): Promise<PublicUndergraduateCatalogSnapshot> {
  const response = await fetch(snapshotUrl, {
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
    signal,
  })

  if (!response.ok) {
    throw new Error(`No se pudo cargar la instantánea pública UPTC (HTTP ${response.status}).`)
  }

  return parsePublicUndergraduateCatalog(await response.json())
}

export function parsePublicUndergraduateCatalog(value: unknown): PublicUndergraduateCatalogSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.source)) {
    throw new Error('La instantánea pública UPTC tiene una estructura no reconocida.')
  }

  if (
    !isOfficialUrl(value.source.pageUrl)
    || !isIsoDate(value.source.pageUpdatedAt)
    || !isIsoDate(value.source.capturedAt)
    || !Array.isArray(value.programs)
    || value.programs.length === 0
  ) {
    throw new Error('La instantánea pública UPTC tiene una fuente, fecha o lista inválida.')
  }

  const ids = new Set<string>()
  for (const candidate of value.programs) {
    if (!isPublicProgram(candidate)) {
      throw new Error('La instantánea pública UPTC tiene un registro de programa inválido.')
    }
    if (ids.has(candidate.id)) {
      throw new Error('La instantánea pública UPTC tiene un identificador de programa duplicado.')
    }
    if (!isOfficialUrl(candidate.detailUrl)) {
      throw new Error('La instantánea pública UPTC contiene un enlace oficial inválido.')
    }
    ids.add(candidate.id)
  }

  return value as unknown as PublicUndergraduateCatalogSnapshot
}

function isPublicProgram(value: unknown): value is PublicUndergraduateProgram {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.faculty)
    && isNonEmptyString(value.facultyCode)
    && isNonEmptyString(value.level)
    && isNonEmptyString(value.modality)
    && isNonEmptyString(value.placeLabel)
    && (value.locationsSummary === null || typeof value.locationsSummary === 'string')
    && typeof value.markedOffered === 'boolean'
    && isNonEmptyString(value.detailUrl)
}

function isOfficialUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === OFFICIAL_HOST
  } catch {
    return false
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= (daysInMonth[month - 1] ?? 0)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
