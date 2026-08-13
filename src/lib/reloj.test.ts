import { describe, expect, it } from 'vitest'
import { diaDeLaMesa, instanteDeLaMesa, partesDeLaMesa } from './reloj'

describe('partesDeLaMesa', () => {
  it('traduce un instante a la hora que la mesa ve en la hoja', () => {
    // Caso real: la bitácora registró este envío a las 22:07:12 UTC y la hoja
    // debía decir 16:07, no 22:07.
    expect(partesDeLaMesa(new Date('2026-08-11T22:07:11Z'))).toEqual({
      anio: 2026,
      mes: 8,
      dia: 11,
      horas: 16,
      minutos: 7,
      segundos: 11,
    })
  })

  it('no adelanta el día cuando en UTC ya es mañana', () => {
    // 03:30 UTC del 12 son las 21:30 del 11 en la mesa: el día no cambia.
    expect(partesDeLaMesa(new Date('2026-08-12T03:30:00Z'))).toEqual({
      anio: 2026,
      mes: 8,
      dia: 11,
      horas: 21,
      minutos: 30,
      segundos: 0,
    })
  })

  it('cruza el fin de año sin equivocar el año', () => {
    expect(partesDeLaMesa(new Date('2027-01-01T04:00:00Z'))).toEqual({
      anio: 2026,
      mes: 12,
      dia: 31,
      horas: 22,
      minutos: 0,
      segundos: 0,
    })
  })
})

describe('instanteDeLaMesa', () => {
  it('es el inverso exacto de partesDeLaMesa', () => {
    const instante = new Date('2026-08-11T22:07:11Z')
    expect(instanteDeLaMesa(partesDeLaMesa(instante)).toISOString()).toBe(instante.toISOString())
  })

  it('interpreta una hora de pared de la hoja como el instante correcto', () => {
    // Las 9:30 del 11 de agosto en la hoja son las 15:30 UTC.
    const instante = instanteDeLaMesa({
      anio: 2026,
      mes: 8,
      dia: 11,
      horas: 9,
      minutos: 30,
      segundos: 0,
    })
    expect(instante.toISOString()).toBe('2026-08-11T15:30:00.000Z')
  })
})

describe('diaDeLaMesa', () => {
  it('dos instantes del mismo día en la mesa dan el mismo día', () => {
    const manana = new Date('2026-08-11T18:00:00Z') // 12:00 en la mesa
    const noche = new Date('2026-08-12T03:00:00Z') // 21:00 del mismo día
    expect(diaDeLaMesa(noche)).toBe(diaDeLaMesa(manana))
  })

  it('un día de diferencia son 24 horas exactas', () => {
    const uno = new Date('2026-08-11T18:00:00Z')
    const otro = new Date('2026-08-12T18:00:00Z')
    expect(diaDeLaMesa(otro) - diaDeLaMesa(uno)).toBe(24 * 60 * 60 * 1000)
  })
})
