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
  calendarRevisionId: string
  calendarRevisionNumber: number
  approvalReference: string
  officialReference: string
  createdAt: string
}

export interface AcademicOperationsClient {
  getStructure(signal?: AbortSignal): Promise<AcademicStructureSnapshot>
  getOpenPeriods(signal?: AbortSignal): Promise<AcademicPeriod[]>
}
