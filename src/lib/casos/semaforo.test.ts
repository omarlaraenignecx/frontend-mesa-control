import { describe, expect, it } from 'vitest'
import type { Caso } from './caso'
import { UMBRALES_SEMAFORO, diasDeEspera, semaforoDe } from './semaforo'

const HOY = new Date(2026, 7, 10, 12, 0, 0) // 10 de agosto de 2026

function conFecha(fecha: Date | null): Pick<Caso, 'marcaTemporalIso'> {
  return { marcaTemporalIso: fecha ? fecha.toISOString() : null }
}

describe('diasDeEspera', () => {
  it('cuenta los días naturales desde la marca temporal', () => {
    expect(diasDeEspera(conFecha(new Date(2026, 7, 10, 9, 0)), HOY)).toBe(0)
    expect(diasDeEspera(conFecha(new Date(2026, 7, 8, 9, 0)), HOY)).toBe(2)
    expect(diasDeEspera(conFecha(new Date(2026, 6, 31, 9, 0)), HOY)).toBe(10)
  })

  it('devuelve null si el caso no tiene fecha legible', () => {
    expect(diasDeEspera(conFecha(null), HOY)).toBeNull()
  })
})

describe('semaforoDe', () => {
  it('verde hasta 2 días', () => {
    expect(semaforoDe(conFecha(new Date(2026, 7, 10)), HOY)).toBe('verde')
    expect(semaforoDe(conFecha(new Date(2026, 7, 8)), HOY)).toBe('verde')
  })

  it('ámbar de 3 a 5 días', () => {
    expect(semaforoDe(conFecha(new Date(2026, 7, 7)), HOY)).toBe('ambar')
    expect(semaforoDe(conFecha(new Date(2026, 7, 5)), HOY)).toBe('ambar')
  })

  it('rojo a partir de 6 días', () => {
    expect(semaforoDe(conFecha(new Date(2026, 7, 4)), HOY)).toBe('rojo')
    expect(semaforoDe(conFecha(new Date(2026, 6, 1)), HOY)).toBe('rojo')
  })

  it('los umbrales están en un solo lugar y son los acordados', () => {
    expect(UMBRALES_SEMAFORO).toEqual({ ambar: 3, rojo: 6 })
  })

  it('sin fecha no hay semáforo', () => {
    expect(semaforoDe(conFecha(null), HOY)).toBeNull()
  })

  it('funciona con un caso que viajó por el caché, donde todo se serializa a JSON', () => {
    // La caché de la cola guarda los casos como JSON: cualquier Date vuelve
    // convertido en string y los métodos de fecha dejan de existir. El modelo
    // tiene que sobrevivir ese viaje sin ayuda de nadie.
    const caso = conFecha(new Date(2026, 7, 8))
    const trasElCache = JSON.parse(JSON.stringify(caso))

    expect(diasDeEspera(trasElCache, HOY)).toBe(2)
    expect(semaforoDe(trasElCache, HOY)).toBe('verde')
  })
})
