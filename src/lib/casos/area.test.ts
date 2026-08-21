import { describe, expect, it } from 'vitest'
import { AREA_SINIESTROS, esSiniestro } from './area'

describe('esSiniestro', () => {
  it('reconoce el área tal como la escribe la hoja', () => {
    expect(esSiniestro({ area: AREA_SINIESTROS })).toBe(true)
    expect(esSiniestro({ area: 'Siniestros' })).toBe(true)
  })

  it('no se rompe por mayúsculas, espacios ni acentos', () => {
    // La gente captura como quiere y la hoja guarda lo que le den.
    expect(esSiniestro({ area: ' SINIESTROS ' })).toBe(true)
    expect(esSiniestro({ area: 'siniestros' })).toBe(true)
  })

  it('las otras dos áreas del formulario son de la mesa', () => {
    expect(esSiniestro({ area: 'Mesa de control' })).toBe(false)
    expect(esSiniestro({ area: 'Ingresos y Egresos' })).toBe(false)
  })

  it('una petición sin área es de la mesa', () => {
    // Es lo que eran todas antes de que el formulario preguntara.
    expect(esSiniestro({ area: null })).toBe(false)
    expect(esSiniestro({ area: '' })).toBe(false)
    expect(esSiniestro({ area: '   ' })).toBe(false)
  })

  it('no confunde un área que solo contiene la palabra', () => {
    // La causa de seguimiento "Siniestros" existe en otra columna y no marca área.
    expect(esSiniestro({ area: 'Mesa de control · Siniestros' })).toBe(false)
  })
})
