import { useState } from 'react'
import './MyAcademicWeekDemo.scss'

type Weekday = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'
type DayFilter = 'Toda la semana' | Weekday

interface SampleSession {
  id: string
  weekday: Weekday
  startTime: string
  endTime: string
  course: string
  code: string
  room: string
  instructor: string
}

const WEEKDAYS: readonly Weekday[] = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
]

const SAMPLE_SESSIONS: readonly SampleSession[] = [
  {
    id: 'sample-foundations', weekday: 'Lunes', startTime: '08:00', endTime: '09:30',
    course: 'Fundamentos de muestra', code: 'DEMO-101', room: 'Aula de muestra 01',
    instructor: 'Docente de ejemplo 1',
  },
  {
    id: 'sample-laboratory', weekday: 'Lunes', startTime: '10:00', endTime: '11:30',
    course: 'Laboratorio de ejemplo', code: 'DEMO-202', room: 'Taller de muestra 02',
    instructor: 'Docente de ejemplo 2',
  },
  {
    id: 'sample-reading', weekday: 'Martes', startTime: '09:00', endTime: '10:30',
    course: 'Lectura académica de muestra', code: 'DEMO-305', room: 'Aula de muestra 03',
    instructor: 'Docente de ejemplo 3',
  },
  {
    id: 'sample-project', weekday: 'Miércoles', startTime: '13:00', endTime: '14:30',
    course: 'Proyecto en equipo de muestra', code: 'DEMO-408', room: 'Sala de muestra 04',
    instructor: 'Docente de ejemplo 4',
  },
  {
    id: 'sample-systems', weekday: 'Jueves', startTime: '10:00', endTime: '11:30',
    course: 'Diseño de sistemas de muestra', code: 'DEMO-411', room: 'Aula de muestra 05',
    instructor: 'Docente de ejemplo 5',
  },
  {
    id: 'sample-reflection', weekday: 'Viernes', startTime: '08:30', endTime: '10:00',
    course: 'Cierre y reflexión de muestra', code: 'DEMO-512', room: 'Sala de muestra 06',
    instructor: 'Docente de ejemplo 6',
  },
]

export function MyAcademicWeekDemo() {
  const [selectedDay, setSelectedDay] = useState<DayFilter>('Toda la semana')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const sessions = selectedDay === 'Toda la semana'
    ? SAMPLE_SESSIONS
    : SAMPLE_SESSIONS.filter((session) => session.weekday === selectedDay)
  const selectedSession = SAMPLE_SESSIONS.find((session) => session.id === selectedSessionId)

  return (
    <div className="student-week-demo">
      <header className="student-week-hero">
        <div className="student-week-hero-copy">
          <p className="student-week-eyebrow">EXPERIENCIA LOCAL · SOLO DESARROLLO</p>
          <h1>Mi semana académica</h1>
          <p>Una vista de ejemplo para explorar cómo puede organizarse una semana de clases.</p>
        </div>
        <span className="student-week-demo-mark" aria-hidden="true">7<span>d</span></span>
      </header>

      <aside className="student-week-notice" role="note" aria-label="Alcance de esta demostración">
        <span className="student-week-notice-icon" aria-hidden="true">i</span>
        <span><strong>Agenda ficticia.</strong> No refleja una matrícula real ni horarios oficiales de la UPTC.</span>
      </aside>

      <section className="student-week-overview" aria-label="Resumen de agenda de ejemplo">
        <div>
          <span className="student-week-overview-label">SEMANA DE EJEMPLO</span>
          <strong>Consulta por día</strong>
        </div>
        <p><strong>{SAMPLE_SESSIONS.length}</strong><span>sesiones ficticias</span></p>
      </section>

      <div className="student-week-filters" role="group" aria-label="Filtrar agenda por día">
        {(['Toda la semana', ...WEEKDAYS] as const).map((day) => (
          <button
            aria-pressed={selectedDay === day}
            className={selectedDay === day ? 'is-active' : undefined}
            key={day}
            onClick={() => {
              setSelectedDay(day)
              setSelectedSessionId(null)
            }}
            type="button"
          >
            {day}
          </button>
        ))}
      </div>

      <div className="student-week-layout">
        <section className="student-week-agenda" role="region" aria-label="Agenda semanal de ejemplo">
          <div className="student-week-section-heading">
            <div>
              <p className="student-week-eyebrow">AGENDA · DATOS DE MUESTRA</p>
              <h2>{selectedDay === 'Toda la semana' ? 'La semana, de un vistazo' : selectedDay}</h2>
            </div>
            <span className="student-week-session-count">{sessions.length} {sessions.length === 1 ? 'sesión' : 'sesiones'}</span>
          </div>

          {sessions.length > 0 ? (
            <ol className="student-week-session-list">
              {sessions.map((session, index) => (
                <li key={session.id}>
                  {selectedDay === 'Toda la semana' && (index === 0 || sessions[index - 1].weekday !== session.weekday) && (
                    <h3 className="student-week-day-heading">{session.weekday}</h3>
                  )}
                  <article className="student-week-session-card">
                    <div className="student-week-session-time">
                      <strong>{session.startTime}</strong>
                      <span>{session.endTime}</span>
                    </div>
                    <div className="student-week-session-copy">
                      <span className="student-week-session-code">{session.code}</span>
                      <h3>{session.course}</h3>
                      <p>{session.room} <span aria-hidden="true">·</span> {session.instructor}</p>
                    </div>
                    <button
                      aria-label={`Ver detalle de ${session.course.toLowerCase()}`}
                      className="student-week-detail-button"
                      onClick={() => setSelectedSessionId(session.id)}
                      type="button"
                    >
                      <span aria-hidden="true">↗</span>
                    </button>
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <div className="student-week-empty" role="status">
              <span aria-hidden="true">○</span>
              <strong>Un día tranquilo</strong>
              <p>No hay sesiones en este día de la agenda de ejemplo.</p>
            </div>
          )}
        </section>

        <section className="student-week-detail" role="region" aria-label="Detalle de la sesión seleccionada" aria-live="polite">
          {selectedSession ? (
            <>
              <p className="student-week-eyebrow">DETALLE · EJEMPLO</p>
              <span className="student-week-detail-code">{selectedSession.code}</span>
              <h2>{selectedSession.course}</h2>
              <dl>
                <div><dt>Día</dt><dd>{selectedSession.weekday}</dd></div>
                <div><dt>Hora</dt><dd>{selectedSession.startTime}–{selectedSession.endTime}</dd></div>
                <div><dt>Espacio</dt><dd>{selectedSession.room}</dd></div>
                <div><dt>Docente</dt><dd>{selectedSession.instructor}</dd></div>
              </dl>
              <p className="student-week-detail-note">Información inventada para esta demostración.</p>
            </>
          ) : (
            <div className="student-week-detail-placeholder">
              <span aria-hidden="true">⌁</span>
              <p>Elige una sesión para consultar sus detalles de ejemplo.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
