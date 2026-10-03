import {
  isBoundedText,
  isCohort,
  isIsoInstant,
  isNonNegativeInteger,
  isProgramCode,
  isRecord,
  isUuid,
  malformedResponse,
} from './contracts'
import type {
  CurriculumVersionComparison,
  CurriculumVersionComparisonChangedField,
  CurriculumVersionComparisonSample,
} from './contracts'

export function parseCurriculumVersionComparison(input: unknown, entryCount: number): CurriculumVersionComparison {
  if (!isRecord(input)
    || !Array.isArray(input.addedSamples)
    || !Array.isArray(input.removedSamples)
    || !Array.isArray(input.modifiedSamples)
    || !Array.isArray(input.unchangedSamples)) throw malformedResponse()

  if (input.status === 'NO_REFERENCE') {
    if (input.reference !== null
      || input.counts !== null
      || input.addedSamples.length > 0
      || input.removedSamples.length > 0
      || input.modifiedSamples.length > 0
      || input.unchangedSamples.length > 0) throw malformedResponse()
    return {
      status: 'NO_REFERENCE',
      reference: null,
      counts: null,
      addedSamples: [],
      removedSamples: [],
      modifiedSamples: [],
      unchangedSamples: [],
    }
  }

  if (input.status !== 'COMPARED'
    || !isRecord(input.reference)
    || !isUuid(input.reference.curriculumId)
    || !isBoundedText(input.reference.curriculumVersion, 80)
    || !isCohort(input.reference.cohortFrom)
    || !(input.reference.cohortThrough === null || isCohort(input.reference.cohortThrough))
    || !isIsoInstant(input.reference.publishedAt)
    || !isRecord(input.counts)
    || !isNonNegativeInteger(input.counts.added)
    || !isNonNegativeInteger(input.counts.removed)
    || !isNonNegativeInteger(input.counts.modified)
    || !isNonNegativeInteger(input.counts.unchanged)) throw malformedResponse()

  const counts = {
    added: input.counts.added,
    removed: input.counts.removed,
    modified: input.counts.modified,
    unchanged: input.counts.unchanged,
  }
  const incomingTotal = counts.added + counts.modified + counts.unchanged
  if (!Number.isSafeInteger(incomingTotal) || incomingTotal !== entryCount) throw malformedResponse()

  return {
    status: 'COMPARED',
    reference: {
      curriculumId: input.reference.curriculumId,
      curriculumVersion: input.reference.curriculumVersion,
      cohortFrom: input.reference.cohortFrom,
      cohortThrough: input.reference.cohortThrough,
      publishedAt: input.reference.publishedAt,
    },
    counts,
    addedSamples: parseComparisonSamples(input.addedSamples, counts.added, 'unchanged'),
    removedSamples: parseComparisonSamples(input.removedSamples, counts.removed, 'unchanged'),
    modifiedSamples: parseComparisonSamples(input.modifiedSamples, counts.modified, 'modified'),
    unchangedSamples: parseComparisonSamples(input.unchangedSamples, counts.unchanged, 'unchanged'),
  }
}

function parseComparisonSamples(
  input: unknown[],
  count: number,
  kind: 'modified' | 'unchanged',
): CurriculumVersionComparisonSample[] {
  if (input.length > Math.min(10, count)) throw malformedResponse()
  const allowedFields: readonly CurriculumVersionComparisonChangedField[] = [
    'NAME', 'CREDITS', 'SEMESTER', 'ORDER', 'FORMATION_SPACE', 'COMPONENT', 'CHOICE_GROUP',
  ]
  return input.map((sample): CurriculumVersionComparisonSample => {
    if (!isRecord(sample)
      || !isProgramCode(sample.subjectCode)
      || !Array.isArray(sample.changedFields)
      || sample.changedFields.length > allowedFields.length
      || !sample.changedFields.every((field): field is CurriculumVersionComparisonChangedField =>
        typeof field === 'string' && allowedFields.includes(field as CurriculumVersionComparisonChangedField))
      || new Set(sample.changedFields).size !== sample.changedFields.length
      || (kind === 'modified' && sample.changedFields.length === 0)
      || (kind === 'unchanged' && sample.changedFields.length > 0)) throw malformedResponse()
    return { subjectCode: sample.subjectCode, changedFields: [...sample.changedFields] }
  })
}
