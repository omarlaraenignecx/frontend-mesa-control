import { describe, expect, it } from 'vitest'
import { fechaCorta, formatearFechaHoja } from './fecha'

describe('formatearFechaHoja', () => {
  it('usa la hora de la mesa, no la del servidor', () => {
    // El servidor está en UTC: este instante son las 16:07 en la hoja.
    expect(formatearFechaHoja(new Date('2026-08-11T22:07:11Z'))).toBe('11/8/2026 16:07:11')
  })

  it('conserva el formato con el que la hoja guarda las fechas', () => {
    // Día y mes sin cero inicial, hora sin cero inicial, minutos y segundos con dos.
    expect(formatearFechaHoja(new Date('2026-08-11T15:05:03Z'))).toBe('11/8/2026 9:05:03')
  })

  it('no escribe el día siguiente cuando en UTC ya cambió la fecha', () => {
    expect(formatearFechaHoja(new Date('2026-08-12T02:30:00Z'))).toBe('11/8/2026 20:30:00')
  })
})

describe('fechaCorta', () => {
  it('muestra solo el día, sin la hora', () => {
    expect(fechaCorta('2026-08-11T15:30:00.000Z', '11/8/2026 9:30:00')).toBe('11 ago 2026')
  })

  it('escribe el mes con tres letras en español y respeta el día de la mesa', () => {
    expect(fechaCorta('2026-01-06T18:00:00.000Z', '')).toBe('6 ene 2026')
    // 04:00 UTC del 1 de enero son las 22:00 del 31 de diciembre en la mesa.
    expect(fechaCorta('2027-01-01T04:00:00.000Z', '')).toBe('31 dic 2026')
  })

  it('sin fecha legible cae al texto de la hoja, recortando la hora', () => {
    // Hay filas cuya marca temporal no se pudo interpretar; se muestra lo que
    // diga la hoja antes que un guion, que no informa nada.
    expect(fechaCorta(null, '11/8/2026 9:30:00')).toBe('11/8/2026')
  })

  it('sin fecha y sin texto no inventa nada', () => {
    expect(fechaCorta(null, '')).toBe('—')
  })
})
