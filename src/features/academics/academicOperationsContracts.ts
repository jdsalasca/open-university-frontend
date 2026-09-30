export type AcademicOrganizationUnitType = 'FACULTY' | 'SCHOOL' | 'ACADEMIC_UNIT'
export type AcademicSiteType = 'CENTRAL' | 'SECCIONAL' | 'REGIONAL' | 'CREAD' | 'CAMPUS' | 'OTHER'
export type AcademicEntityStatus = 'ACTIVE' | 'INACTIVE'
export type AcademicPeriodKind = 'REGULAR' | 'INTERSEMESTRAL'
export type AcademicPeriodStatus = 'DRAFT' | 'APPROVED' | 'OPEN' | 'CLOSED' | 'CANCELLED'

export interface AcademicOrganizationUnit {
  id: string
  code: string
  type: AcademicOrganizationUnitType
  displayName: string
  displayOrder: number
  status: AcademicEntityStatus
  validFrom: string
  validThrough: string | null
}

export interface AcademicOrganizationRelation {
  parentUnitId: string
  childUnitId: string
  displayOrder: number
  validFrom: string
  validThrough: string | null
}

export interface AcademicSite {
  id: string
  code: string
  type: AcademicSiteType
  displayName: string
  displayOrder: number
  status: AcademicEntityStatus
  validFrom: string
  validThrough: string | null
}

export interface AcademicSiteRelation {
  parentSiteId: string
  childSiteId: string
  displayOrder: number
  validFrom: string
  validThrough: string | null
}

export interface AcademicProgramAffiliation {
  id: string
  programId: string
  organizationUnitId: string
  siteId: string
  displayOrder: number
  validFrom: string
  validThrough: string | null
  sourceReference: string
}

export interface AcademicStructureSnapshot {
  units: AcademicOrganizationUnit[]
  organizationRelations: AcademicOrganizationRelation[]
  sites: AcademicSite[]
  siteRelations: AcademicSiteRelation[]
  programAffiliations: AcademicProgramAffiliation[]
}

export interface AcademicPeriod {
  id: string
  code: string
  kind: AcademicPeriodKind
  academicYear: number
  sequenceNumber: number
  startsOn: string
  endsOn: string
  status: AcademicPeriodStatus
  calendarRevisionId: string | null
  calendarRevisionNumber: number | null
  approvalReference: string | null
  officialReference: string | null
  createdAt: string
}

export interface AcademicOperationsClient {
  getStructure(signal?: AbortSignal): Promise<AcademicStructureSnapshot>
  getOpenPeriods(signal?: AbortSignal): Promise<AcademicPeriod[]>
  getAdminPeriods(accessToken: string, signal?: AbortSignal): Promise<AcademicPeriod[]>
  openPeriod(periodId: string, accessToken: string, signal?: AbortSignal): Promise<AcademicPeriod>
  closePeriod(periodId: string, accessToken: string, signal?: AbortSignal): Promise<AcademicPeriod>
}

export interface AcademicPeriodAuthorization {
  accessToken: string
  canRead: boolean
  canWrite: boolean
}
