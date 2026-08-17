import { describe, expect, it } from 'vitest'
import type { Caso } from '@/lib/casos/caso'
import { casosNuevos, marcaMasAlta } from './deteccion'

const caso = (fila: number, iso: string): Caso =>
  ({
    fila,
    folio: null,
    marcaTemporalIso: iso,
    marcaTemporalTexto: '',
    adjuntos: [],
    camposExtra: [],
  }) as unknown as Caso

const AYER = '2026-08-13T10:00:00.000Z'
const HOY = '2026-08-14T10:00:00.000Z'

describe('casosNuevos', () => {
  it('sin marca de agua no notifica nada: es el arranque', () => {
    // La primera corrida no puede avisar de los 1,466 casos de 2026.
    expect(casosNuevos([caso(7230, AYER), caso(7231, HOY)], null)).toEqual([])
  })

  it('devuelve los posteriores a la marca', () => {
    const nuevos = casosNuevos([caso(7230, AYER), caso(7231, HOY)], AYER)
    expect(nuevos.map((c) => c.fila)).toEqual([7230, 7231])
  })

  it('incluye los de la marca exacta, porque la clave descarta el repetido', () => {
    // Dos respuestas del formulario en el mismo segundo existen. Comparar con
    // "mayor o igual" nunca pierde una; el índice único evita el aviso doble.
    expect(casosNuevos([caso(7230, AYER)], AYER).map((c) => c.fila)).toEqual([7230])
  })

  it('descarta los anteriores', () => {
    expect(casosNuevos([caso(7229, AYER)], HOY)).toEqual([])
  })

  it('no falla con la lista vacía', () => {
    expect(casosNuevos([], AYER)).toEqual([])
  })

  it('un caso sin fecha legible no genera aviso', () => {
    // No se puede saber si es nuevo, y avisar de él cada minuto para siempre
    // sería peor que no avisar. Sigue visible en la fila.
    const sinFecha = { ...caso(7232, HOY), marcaTemporalIso: null } as unknown as Caso
    expect(casosNuevos([sinFecha], AYER)).toEqual([])
  })
})

describe('marcaMasAlta', () => {
  it('es la marca temporal más reciente de la lectura', () => {
    expect(marcaMasAlta([caso(7230, AYER), caso(7231, HOY)])).toBe(HOY)
  })

  it('no depende del orden en que vengan los casos', () => {
    expect(marcaMasAlta([caso(7231, HOY), caso(7230, AYER)])).toBe(HOY)
  })

  it('sin casos no hay marca', () => {
    expect(marcaMasAlta([])).toBeNull()
  })

  it('ignora los casos sin fecha legible al calcular la marca', () => {
    const sinFecha = { ...caso(7232, HOY), marcaTemporalIso: null } as unknown as Caso
    expect(marcaMasAlta([sinFecha, caso(7230, AYER)])).toBe(AYER)
    expect(marcaMasAlta([sinFecha])).toBeNull()
  })
})
