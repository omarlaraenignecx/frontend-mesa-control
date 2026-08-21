import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGINA = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8')
const CARGANDO = readFileSync(join(import.meta.dirname, 'loading.tsx'), 'utf8')
const FILA = readFileSync(join(import.meta.dirname, '..', 'fila', 'page.tsx'), 'utf8')

/**
 * Las dos páginas de listado son envolturas de la misma pantalla. Lo que se cuida
 * aquí es que sigan siéndolo: el día que una crezca por su cuenta, la otra deja de
 * recibir las correcciones.
 */
describe('la página de Atención a Siniestros', () => {
  it('usa la pantalla compartida con su módulo', () => {
    expect(PAGINA).toContain('PantallaDeCasos')
    expect(PAGINA).toContain('modulo={SINIESTROS}')
  })

  it('no trae lógica propia: es una envoltura', () => {
    expect(PAGINA).not.toContain('filtrar(')
    expect(PAGINA).not.toContain('cargarCola')
    expect(PAGINA).not.toContain('<Table')
  })

  it('es igual de delgada que la de la mesa', () => {
    const lineas = (t: string) => t.trim().split('\n').length
    expect(lineas(PAGINA)).toBe(lineas(FILA))
  })

  it('su esqueleto de carga anuncia el módulo en el que está uno', () => {
    expect(CARGANDO).toContain('SINIESTROS.titulo')
  })
})
