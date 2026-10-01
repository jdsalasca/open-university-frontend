import type { PublicAdmissionsCalendar } from './admissionsContracts'

export const OFFICIAL_ADMISSIONS_CALENDAR_2027_I: PublicAdmissionsCalendar = {
  callName: 'Primer semestre académico de 2027',
  updatedAt: '15 de septiembre de 2026',
  checkedAt: '1 de octubre de 2026',
  source: {
    label: 'Calendario oficial de ACRA',
    url: 'https://reportes.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/adm_reg/1aspi/pre/',
  },
  confirmationSource: {
    label: 'Comunicado institucional sobre la convocatoria 2027-I',
    url: 'https://dsp.uptc.edu.co/sitio/portal/cal_not_eve/noticias/det/UPTC-abre-inscripciones-para-estudiar-un-pregrado-presencial-a-distancia-o-virtual-el-proximo-semestre/',
  },
  milestones: [
    {
      id: 'pin-sale',
      dateLabel: '21 sep – 21 oct 2026',
      title: 'Venta de pines de inscripción',
      description: 'ACRA publica este intervalo para los programas presenciales. Consulta en su página los medios, valores y condiciones vigentes.',
      kind: 'application',
    },
    {
      id: 'application-close',
      dateLabel: 'Hasta el 23 oct 2026',
      title: 'Cierre de inscripciones',
      description: 'La fecha de cierre publicada para registrar la inscripción de pregrado presencial.',
      kind: 'application',
    },
    {
      id: 'special-tests',
      dateLabel: '28 y 29 oct 2026',
      title: 'Pruebas especiales',
      description: 'ACRA anuncia pruebas para Artes Plásticas y Visuales, Licenciatura en Educación Física, Recreación y Deporte, y Licenciatura en Música.',
      kind: 'selection',
    },
    {
      id: 'results',
      dateLabel: '13 nov 2026',
      title: 'Publicación de resultados',
      description: 'Fecha publicada para los resultados de pregrado presencial.',
      kind: 'selection',
    },
    {
      id: 'ise-form',
      dateLabel: '17–27 nov 2026',
      title: 'Formulario de registro ISE',
      description: 'Ventana informada por ACRA después de la publicación de resultados.',
      kind: 'enrollment',
    },
    {
      id: 'tuition-and-enrollment',
      dateLabel: '23 nov – 10 dic 2026',
      title: 'Derechos pecuniarios y matrícula',
      description: 'Intervalo publicado para el pago de derechos pecuniarios y la matrícula de pregrado presencial.',
      kind: 'enrollment',
    },
    {
      id: 'waitlist-call',
      dateLabel: '9–15 dic 2026',
      title: 'Llamado a opcionados',
      description: 'Periodo de llamados publicado para aspirantes opcionados de pregrado presencial y FESAD.',
      kind: 'enrollment',
    },
  ],
}
