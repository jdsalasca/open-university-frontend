import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdmissionsCalendarIcs, downloadAdmissionsCalendar } from './admissionsCalendarIcs'
import { OFFICIAL_ADMISSIONS_CALENDAR_2027_I } from './official2027ICalendar'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createAdmissionsCalendarIcs', () => {
  it('serializes published inclusive dates as all-day events with an exclusive end date', () => {
    // Arrange
    const generatedAt = new Date('2026-10-01T17:00:00.000Z')

    // Act
    const calendar = createAdmissionsCalendarIcs(OFFICIAL_ADMISSIONS_CALENDAR_2027_I, generatedAt)
    const unfolded = calendar.replace(/\r\n /g, '')

    // Assert
    expect(unfolded).toContain('DTSTAMP:20261001T170000Z')
    expect(unfolded).toContain('UID:pin-sale@admisiones.universiry.local')
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20260921\r\nDTEND;VALUE=DATE:20261022')
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20261023\r\nDTEND;VALUE=DATE:20261024')
    expect(unfolded).toContain(OFFICIAL_ADMISSIONS_CALENDAR_2027_I.source.url)
    expect(calendar).toMatch(/\r\nEND:VCALENDAR\r\n$/)
    expect(calendar).not.toMatch(/DTSTART:[0-9]{8}T/)
  })

  it('escapes text and folds lines by UTF-8 octets without splitting a character', () => {
    // Arrange
    const sourceCalendar = OFFICIAL_ADMISSIONS_CALENDAR_2027_I
    const calendarWithLongText = {
      ...sourceCalendar,
      milestones: [{
        ...sourceCalendar.milestones[0],
        title: 'Admisiones, 2027; presencial\\ etapa 1',
        description: `${'Universidad á '.repeat(12)}\nConfirma la fuente oficial.`,
      }],
    }

    // Act
    const serialized = createAdmissionsCalendarIcs(calendarWithLongText, new Date('2026-10-01T17:00:00Z'))
    const lines = serialized.split('\r\n').filter(Boolean)
    const unfolded = serialized.replace(/\r\n /g, '')

    // Assert
    expect(serialized).toContain('SUMMARY:Admisiones\\, 2027\\; presencial\\\\ etapa 1')
    expect(unfolded).toContain('DESCRIPTION:Universidad á Universidad á')
    expect(lines.every((line) => new TextEncoder().encode(line).byteLength <= 75)).toBe(true)
    expect(unfolded).toContain('Confirma la fuente oficial.')
  })

  it('rejects malformed or reversed date ranges instead of creating invalid calendar events', () => {
    // Arrange
    const calendar = OFFICIAL_ADMISSIONS_CALENDAR_2027_I
    const malformedCalendar = {
      ...calendar,
      milestones: [{ ...calendar.milestones[0], startsOn: '2026-02-30' }],
    }
    const reversedCalendar = {
      ...calendar,
      milestones: [{ ...calendar.milestones[0], startsOn: '2026-10-22', endsOn: '2026-10-21' }],
    }

    // Act / Assert
    expect(() => createAdmissionsCalendarIcs(malformedCalendar, new Date('2026-10-01T17:00:00Z'))).toThrow(RangeError)
    expect(() => createAdmissionsCalendarIcs(reversedCalendar, new Date('2026-10-01T17:00:00Z'))).toThrow(RangeError)
  })
})

describe('downloadAdmissionsCalendar', () => {
  it('creates a calendar file with a stable name and releases its temporary URL', () => {
    // Arrange
    const createObjectURL = vi.fn().mockReturnValue('blob:uptc-calendar')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.useFakeTimers()

    let downloadedName = ''
    let downloadedHref = ''
    let wasHidden = false
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download
      downloadedHref = this.href
      wasHidden = Boolean(this.hidden)
    })

    // Act
    downloadAdmissionsCalendar(OFFICIAL_ADMISSIONS_CALENDAR_2027_I)

    // Assert
    expect(createObjectURL).toHaveBeenCalledOnce()
    const [calendarBlob] = createObjectURL.mock.calls[0]
    expect(calendarBlob).toBeInstanceOf(Blob)
    expect(calendarBlob.type).toBe('text/calendar;charset=utf-8')
    expect(click).toHaveBeenCalledOnce()
    expect(downloadedName).toBe('uptc-pregrado-presencial-2027-i.ics')
    expect(downloadedHref).toBe('blob:uptc-calendar')
    expect(wasHidden).toBe(true)

    vi.advanceTimersByTime(0)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:uptc-calendar')
  })
})
