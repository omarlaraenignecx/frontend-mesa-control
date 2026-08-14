import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El panel de filtros es un componente de cliente y la suite corre sin DOM, así
 * que se revisa el archivo. Lo que se cuida aquí es que las casillas reflejen el
 * filtro que de verdad se está aplicando, no la cadena cruda de la URL.
 */
const FUENTE = readFileSync(join(import.meta.dirname, 'filtros.tsx'), 'utf8')

describe('panel de estatus final', () => {
  it('marca las casillas con la selección visible, no con la de la URL', () => {
    expect(FUENTE).toContain('seleccionVisible(seleccion)')
    expect(FUENTE).not.toContain('new Set(seleccion)')
  })

  it('ofrece seleccionar todos los estatus de una vez', () => {
    expect(FUENTE).toContain('Seleccionar todos')
    expect(FUENTE).toContain('alternarTodos(seleccion, todos)')
  })

  it('conserva la vuelta a los pendientes como salida del filtro', () => {
    expect(FUENTE).toContain('Volver a solo los pendientes')
  })
})
