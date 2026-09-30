import type {
  AcademicEntityStatus,
  AcademicOperationsClient,
  AcademicOrganizationRelation,
  AcademicOrganizationUnit,
  AcademicOrganizationUnitType,
  AcademicPeriod,
  AcademicPeriodKind,
  AcademicProgramAffiliation,
  AcademicSite,
  AcademicSiteRelation,
  AcademicSiteType,
  AcademicStructureSnapshot,
} from './academicOperationsContracts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UNIT_TYPES = new Set<AcademicOrganizationUnitType>(['FACULTY', 'SCHOOL', 'ACADEMIC_UNIT'])
const SITE_TYPES = new Set<AcademicSiteType>(['CENTRAL', 'SECCIONAL', 'REGIONAL', 'CREAD', 'CAMPUS', 'OTHER'])
const ENTITY_STATUSES = new Set<AcademicEntityStatus>(['ACTIVE', 'INACTIVE'])
const PERIOD_KINDS = new Set<AcademicPeriodKind>(['REGULAR', 'INTERSEMESTRAL'])

export class AcademicOperationsApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AcademicOperationsApiError'
    this.status = status
  }
}

export function createAcademicOperationsClient(fetcher: typeof fetch = fetch): AcademicOperationsClient {
  return {
    async getStructure(signal) {
      const response = await fetcher('/api/v1/academic-structure', requestOptions(signal))
      return parseAcademicStructure(await responseBody(response))
    },

    async getOpenPeriods(signal) {
      const response = await fetcher('/api/v1/academic-periods', requestOptions(signal))
      return parseOpenAcademicPeriods(await responseBody(response))
    },
  }
}

export const academicOperationsClient = createAcademicOperationsClient()

export function parseAcademicStructure(input: unknown): AcademicStructureSnapshot {
  if (!isRecord(input)
    || !Array.isArray(input.units)
    || !Array.isArray(input.organizationRelations)
    || !Array.isArray(input.sites)
    || !Array.isArray(input.siteRelations)
    || !Array.isArray(input.programAffiliations)) throw malformedResponse()

  const units = input.units.map(parseOrganizationUnit)
  const sites = input.sites.map(parseSite)
  const organizationRelations = input.organizationRelations.map(parseOrganizationRelation)
  const siteRelations = input.siteRelations.map(parseSiteRelation)
  const programAffiliations = input.programAffiliations.map(parseProgramAffiliation)
  assertUnique(units.map((unit) => unit.id))
  assertUnique(units.map((unit) => unit.code))
  assertUnique(sites.map((site) => site.id))
  assertUnique(sites.map((site) => site.code))

  const unitIds = new Set(units.map((unit) => unit.id))
  const siteIds = new Set(sites.map((site) => site.id))
  if (organizationRelations.some((relation) => !unitIds.has(relation.parentUnitId)
    || !unitIds.has(relation.childUnitId))
    || siteRelations.some((relation) => !siteIds.has(relation.parentSiteId)
      || !siteIds.has(relation.childSiteId))
    || programAffiliations.some((affiliation) => !unitIds.has(affiliation.organizationUnitId)
      || !siteIds.has(affiliation.siteId))) throw malformedResponse()

  return { units, organizationRelations, sites, siteRelations, programAffiliations }
}

export function parseOpenAcademicPeriods(input: unknown): AcademicPeriod[] {
  if (!Array.isArray(input)) throw malformedResponse()
  const periods = input.map(parseOpenAcademicPeriod)
  assertUnique(periods.map((period) => period.id))
  assertUnique(periods.map((period) => period.code))
  return periods
}

function parseOrganizationUnit(input: unknown): AcademicOrganizationUnit {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isIdentifier(input.code)
    || !isOneOf(UNIT_TYPES, input.type)
    || !isBoundedText(input.displayName, 240)
    || !isNonNegativeInteger(input.displayOrder)
    || !isOneOf(ENTITY_STATUSES, input.status)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0) throw malformedResponse()
  return input as unknown as AcademicOrganizationUnit
}

function parseSite(input: unknown): AcademicSite {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isIdentifier(input.code)
    || !isOneOf(SITE_TYPES, input.type)
    || !isBoundedText(input.displayName, 240)
    || !isNonNegativeInteger(input.displayOrder)
    || !isOneOf(ENTITY_STATUSES, input.status)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0) throw malformedResponse()
  return input as unknown as AcademicSite
}

function parseOrganizationRelation(input: unknown): AcademicOrganizationRelation {
  if (!isRecord(input)
    || !isUuid(input.parentUnitId)
    || !isUuid(input.childUnitId)
    || input.parentUnitId === input.childUnitId
    || !isNonNegativeInteger(input.displayOrder)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0) throw malformedResponse()
  return input as unknown as AcademicOrganizationRelation
}

function parseSiteRelation(input: unknown): AcademicSiteRelation {
  if (!isRecord(input)
    || !isUuid(input.parentSiteId)
    || !isUuid(input.childSiteId)
    || input.parentSiteId === input.childSiteId
    || !isNonNegativeInteger(input.displayOrder)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0) throw malformedResponse()
  return input as unknown as AcademicSiteRelation
}

function parseProgramAffiliation(input: unknown): AcademicProgramAffiliation {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isUuid(input.programId)
    || !isUuid(input.organizationUnitId)
    || !isUuid(input.siteId)
    || !isNonNegativeInteger(input.displayOrder)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0
    || !isBoundedText(input.sourceReference, 240)) throw malformedResponse()
  return input as unknown as AcademicProgramAffiliation
}

function parseOpenAcademicPeriod(input: unknown): AcademicPeriod {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isIdentifier(input.code)
    || !isOneOf(PERIOD_KINDS, input.kind)
    || !Number.isInteger(input.academicYear)
    || Number(input.academicYear) < 1900
    || Number(input.academicYear) > 9999
    || !Number.isInteger(input.sequenceNumber)
    || Number(input.sequenceNumber) < 1
    || (input.kind === 'REGULAR' && Number(input.sequenceNumber) > 2)
    || !isDate(input.startsOn)
    || !isDate(input.endsOn)
    || input.endsOn < input.startsOn
    || input.status !== 'OPEN'
    || !isUuid(input.calendarRevisionId)
    || !isPositiveInteger(input.calendarRevisionNumber)
    || !isBoundedText(input.approvalReference, 240)
    || !isBoundedText(input.officialReference, 240)
    || !isIsoInstant(input.createdAt)) throw malformedResponse()
  return input as unknown as AcademicPeriod
}

async function responseBody(response: Response): Promise<unknown> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.ok) throw malformedResponse()
    body = null
  }
  if (!response.ok) {
    const message = isRecord(body) && isBoundedText(body.message, 500)
      ? body.message
      : `Academic operations request failed (${response.status}).`
    throw new AcademicOperationsApiError(response.status, message)
  }
  return body
}

function requestOptions(signal?: AbortSignal): RequestInit {
  return {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  }
}

function assertUnique(values: readonly string[]) {
  if (new Set(values).size !== values.length) throw malformedResponse()
}

function compareDates(end: unknown, start: string): number {
  return end === null ? 1 : String(end).localeCompare(start)
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function isUuid(input: unknown): input is string {
  return typeof input === 'string' && UUID_PATTERN.test(input)
}

function isIdentifier(input: unknown): input is string {
  return typeof input === 'string' && /^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(input)
}

function isBoundedText(input: unknown, maxLength: number): input is string {
  return typeof input === 'string' && input.trim().length > 0 && [...input].length <= maxLength
}

function isDate(input: unknown): input is string {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return false
  const [year, month, day] = input.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
}

function isIsoInstant(input: unknown): input is string {
  return typeof input === 'string' && /^\d{4}-\d\d-\d\dT/.test(input) && Number.isFinite(Date.parse(input))
}

function isOneOf<T extends string>(values: ReadonlySet<T>, input: unknown): input is T {
  return typeof input === 'string' && values.has(input as T)
}

function isNonNegativeInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && Number(input) >= 0
}

function isPositiveInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && Number(input) > 0
}

function malformedResponse() {
  return new Error('The academic operations response is malformed.')
}
