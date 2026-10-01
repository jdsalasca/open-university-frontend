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

export interface AcademicDisplayOrderCommand {
  expectedDisplayOrder: number
  displayOrder: number
  sourceReference: string
}

export interface AcademicStructureRelationCreateCommand {
  displayOrder: number
  validFrom: string
  validThrough: string | null
  sourceReference: string
}

export interface AcademicOrganizationRelationCloseCommand {
  validFrom: string
  effectiveThrough: string
  sourceReference: string
}

export interface AcademicProgramAffiliationCreateCommand extends AcademicStructureRelationCreateCommand {
  organizationUnitId: string
  siteId: string
}

export interface AcademicStructureEntryCreateCommand<Type extends AcademicOrganizationUnitType | AcademicSiteType> {
  code: string
  type: Type
  displayName: string
  displayOrder: number
  validFrom: string
  validThrough: string | null
  sourceReference: string
}

export type AcademicOrganizationUnitCreateCommand = AcademicStructureEntryCreateCommand<AcademicOrganizationUnitType>
export type AcademicSiteCreateCommand = AcademicStructureEntryCreateCommand<AcademicSiteType>

export interface AcademicOperationsClient {
  getStructure(signal?: AbortSignal): Promise<AcademicStructureSnapshot>
  getAdminStructure(accessToken: string, signal?: AbortSignal): Promise<AcademicStructureSnapshot>
  createOrganizationUnit(command: AcademicOrganizationUnitCreateCommand, accessToken: string,
    signal?: AbortSignal): Promise<string>
  createChildUnit(parentUnitId: string, command: AcademicOrganizationUnitCreateCommand, accessToken: string,
    signal?: AbortSignal): Promise<string>
  closeOrganizationRelation(parentUnitId: string, childUnitId: string,
    command: AcademicOrganizationRelationCloseCommand, accessToken: string, signal?: AbortSignal): Promise<void>
  createSite(command: AcademicSiteCreateCommand, accessToken: string, signal?: AbortSignal): Promise<string>
  relateOrganizationUnits(parentUnitId: string, childUnitId: string, command: AcademicStructureRelationCreateCommand,
    accessToken: string, signal?: AbortSignal): Promise<void>
  relateSites(parentSiteId: string, childSiteId: string, command: AcademicStructureRelationCreateCommand,
    accessToken: string, signal?: AbortSignal): Promise<void>
  affiliateProgram(programId: string, command: AcademicProgramAffiliationCreateCommand, accessToken: string,
    signal?: AbortSignal): Promise<void>
  getOpenPeriods(signal?: AbortSignal): Promise<AcademicPeriod[]>
  getAdminPeriods(accessToken: string, signal?: AbortSignal): Promise<AcademicPeriod[]>
  openPeriod(periodId: string, accessToken: string, signal?: AbortSignal): Promise<AcademicPeriod>
  closePeriod(periodId: string, accessToken: string, signal?: AbortSignal): Promise<AcademicPeriod>
  changeOrganizationUnitOrder(unitId: string, command: AcademicDisplayOrderCommand,
    accessToken: string, signal?: AbortSignal): Promise<void>
  changeSiteOrder(siteId: string, command: AcademicDisplayOrderCommand,
    accessToken: string, signal?: AbortSignal): Promise<void>
  changeOrganizationRelationOrder(parentUnitId: string, childUnitId: string,
    command: AcademicDisplayOrderCommand, accessToken: string, signal?: AbortSignal): Promise<void>
  changeSiteRelationOrder(parentSiteId: string, childSiteId: string,
    command: AcademicDisplayOrderCommand, accessToken: string, signal?: AbortSignal): Promise<void>
  changeProgramAffiliationOrder(programId: string, affiliationId: string,
    command: AcademicDisplayOrderCommand, accessToken: string, signal?: AbortSignal): Promise<void>
}

export interface AcademicPeriodAuthorization {
  accessToken: string
  canRead: boolean
  canWrite: boolean
}

export interface AcademicStructureAuthorization {
  accessToken: string
  canRead: boolean
  canWrite: boolean
}
