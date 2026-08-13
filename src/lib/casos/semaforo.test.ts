import { describe, expect, it } from 'vitest'
import type { Caso } from './caso'
import { diasDeEspera, semaforoDe } from './semaforo'

const HOY = new Date('2026-08-10T18:00:00Z') // mediodía del 10 de agosto en la hoja

function conFecha(fecha: Date | null): Pick<Caso, 'marcaTemporalIso'> {
  return { marcaTemporalIso: fecha ? fecha.toISOString() : null }
}

describe('diasDeEspera', () => {
  it('cuenta los días naturales desde la marca temporal', () => {
    // Las 9:00 de cada uno de esos días en la hoja, como instantes.
    expect(diasDeEspera(conFecha(new Date('2026-08-10T15:00:00Z')), HOY)).toBe(0)
    expect(diasDeEspera(conFecha(new Date('2026-08-08T15:00:00Z')), HOY)).toBe(2)
    expect(diasDeEspera(conFecha(new Date('2026-07-31T15:00:00Z')), HOY)).toBe(10)
  })

  it('no cuenta un día de más en las últimas horas de la tarde', () => {
    // 20:00 en la hoja del mismo 10 de agosto: en UTC ya es el día 11, y con la
    // medianoche del servidor esto contaba 1 día de espera en lugar de 0.
    expect(diasDeEspera(conFecha(new Date('2026-08-11T02:00:00Z')), HOY)).toBe(0)
  })

  it('devuelve null si el caso no tiene fecha legible', () => {
    expect(diasDeEspera(conFecha(null), HOY)).toBeNull()
  })
})

describe('semaforoDe', () => {
  it('pinta el estatus final de la hoja, no la antigüedad del caso', () => {
    expect(semaforoDe({ estatusFinal: 'Concluida' })).toBe('verde')
    expect(semaforoDe({ estatusFinal: 'Improcedente' })).toBe('rojo')
    expect(semaforoDe({ estatusFinal: 'Tramite' })).toBe('ambar')
  })

  it('reconoce el estatus con acento y con espacios sobrantes', () => {
    // La validación de la hoja dice "Tramite" sin acento, pero en el histórico
    // hay filas capturadas a mano antes de que esa validación existiera.
    expect(semaforoDe({ estatusFinal: 'Trámite' })).toBe('ambar')
    expect(semaforoDe({ estatusFinal: '  concluida ' })).toBe('verde')
  })

  it('sin estatus no hay color: el círculo se dibuja hueco', () => {
    expect(semaforoDe({ estatusFinal: null })).toBeNull()
    expect(semaforoDe({ estatusFinal: '   ' })).toBeNull()
  })

  it('un valor que no está en la validación se pinta gris, nunca truena', () => {
    // "N/A" existe en 570 filas del histórico y hay dos textos sueltos más.
    expect(semaforoDe({ estatusFinal: 'N/A' })).toBe('desconocido')
    expect(semaforoDe({ estatusFinal: 'Información incompleta' })).toBe('desconocido')
  })

  it('funciona con un caso que viajó por el caché, donde todo se serializa a JSON', () => {
    const caso = { estatusFinal: 'Concluida', marcaTemporalIso: '2026-08-08T15:00:00.000Z' }
    const trasElCache = JSON.parse(JSON.stringify(caso))

    expect(semaforoDe(trasElCache)).toBe('verde')
    expect(diasDeEspera(trasElCache, HOY)).toBe(2)
  })
})
