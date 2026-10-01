export const SPACE_LOCATION_KINDS = ['CAMPUS', 'REGIONAL_SITE', 'CREAD', 'SERVICE'] as const

export type SpaceLocationKind = (typeof SPACE_LOCATION_KINDS)[number]

export interface SpaceSource {
  label: string
  url: string
  checkedAt: string
  sourceUpdatedAt: string | null
}

export interface SpaceLocation {
  id: string
  kind: SpaceLocationKind
  name: string
  municipality: string
  department: string | null
  address: string | null
  locationDetail: string | null
  mapQuery: string | null
  source: SpaceSource
}

export interface SpaceDirectorySnapshot {
  locations: SpaceLocation[]
  officialOfficeDirectoryUrl: string
}

const KIND_SET = new Set<string>(SPACE_LOCATION_KINDS)
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function parseSpaceDirectorySnapshot(input: unknown): SpaceDirectorySnapshot {
  if (!isRecord(input) || !Array.isArray(input.locations)
    || !isOfficialUptcUrl(input.officialOfficeDirectoryUrl)) {
    throw new Error('La respuesta de la guía de espacios no tiene un formato válido.')
  }

  const ids = new Set<string>()
  const locations = input.locations.map((item) => {
    const location = parseSpaceLocation(item)
    if (ids.has(location.id)) throw new Error('La respuesta de la guía de espacios repite un identificador.')
    ids.add(location.id)
    return location
  })

  return {
    locations,
    officialOfficeDirectoryUrl: input.officialOfficeDirectoryUrl,
  }
}

function parseSpaceLocation(input: unknown): SpaceLocation {
  if (!isRecord(input)
    || typeof input.id !== 'string' || !input.id.trim()
    || typeof input.kind !== 'string' || !KIND_SET.has(input.kind)
    || typeof input.name !== 'string' || !input.name.trim()
    || typeof input.municipality !== 'string' || !input.municipality.trim()
    || !isNullableString(input.department)
    || !isNullableString(input.address)
    || !isNullableString(input.locationDetail)
    || !isNullableString(input.mapQuery)
    || (input.address !== null && !input.address.trim())
    || (input.mapQuery !== null && !input.mapQuery.trim())
    || ((input.address === null) !== (input.mapQuery === null))
    || (input.address === null && (!input.locationDetail || !input.locationDetail.trim()))
    || !isRecord(input.source)) {
    throw new Error('Un espacio de la respuesta no cumple el contrato público.')
  }

  const { source } = input
  if (typeof source.label !== 'string' || !source.label.trim()
    || !isOfficialUptcUrl(source.url)
    || !isIsoDate(source.checkedAt)
    || !(source.sourceUpdatedAt === null || isIsoDate(source.sourceUpdatedAt))
    || (source.sourceUpdatedAt !== null && source.sourceUpdatedAt > source.checkedAt)) {
    throw new Error('La fuente de un espacio no cumple el contrato público.')
  }

  return {
    id: input.id,
    kind: input.kind as SpaceLocationKind,
    name: input.name,
    municipality: input.municipality,
    department: input.department,
    address: input.address,
    locationDetail: input.locationDetail,
    mapQuery: input.mapQuery,
    source: {
      label: source.label,
      url: source.url,
      checkedAt: source.checkedAt,
      sourceUpdatedAt: source.sourceUpdatedAt,
    },
  }
}

function isOfficialUptcUrl(input: unknown): input is string {
  if (typeof input !== 'string') return false
  try {
    const url = new URL(input)
    return url.protocol === 'https:'
      && (url.hostname === 'uptc.edu.co' || url.hostname.endsWith('.uptc.edu.co'))
  } catch {
    return false
  }
}

function isIsoDate(input: unknown): input is string {
  if (typeof input !== 'string' || !ISO_DATE_PATTERN.test(input)) return false
  const [year, month, day] = input.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isNullableString(input: unknown): input is string | null {
  return input === null || typeof input === 'string'
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
