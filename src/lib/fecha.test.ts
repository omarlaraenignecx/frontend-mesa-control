import { describe, expect, it } from 'vitest'
import { fechaCorta, formatearFechaHoja } from './fecha'

describe('formatearFechaHoja', () => {
  it('usa el formato con el que la hoja guarda las fechas', () => {
    expect(formatearFechaHoja(new Date(2026, 7, 11, 9, 5, 3))).toBe('11/8/2026 9:05:03')
  })
})

describe('fechaCorta', () => {
  it('muestra solo el día, sin la hora', () => {
    const iso = new Date(2026, 7, 11, 9, 30).toISOString()
    expect(fechaCorta(iso, '11/8/2026 9:30:00')).toBe('11 ago 2026')
  })

  it('escribe el mes con tres letras en español', () => {
    expect(fechaCorta(new Date(2026, 0, 6).toISOString(), '')).toBe('6 ene 2026')
    expect(fechaCorta(new Date(2026, 11, 31).toISOString(), '')).toBe('31 dic 2026')
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
