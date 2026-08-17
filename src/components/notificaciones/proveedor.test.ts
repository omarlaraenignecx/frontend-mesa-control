import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El proveedor es un componente de cliente y la suite corre sin DOM, así que se
 * revisa el archivo. Lo que se cuida son las cuatro decisiones que no se ven al
 * leer el JSX y que, si se pierden, cuestan peticiones o confunden al área.
 */
const FUENTE = readFileSync(join(import.meta.dirname, 'proveedor.tsx'), 'utf8')

describe('proveedor de notificaciones', () => {
  it('sondea cada 30 segundos', () => {
    expect(FUENTE).toContain('const INTERVALO_MS = 30_000')
  })

  it('no sondea con la pestaña oculta, y consulta al volver a ella', () => {
    expect(FUENTE).toContain('document.hidden')
    expect(FUENTE).toContain('visibilitychange')
  })

  it('deja de insistir cuando la sesión ya no vale', () => {
    // Sin esto, una pestaña vieja golpea la ruta cada 30 segundos para siempre.
    expect(FUENTE).toMatch(/status === 401/)
    expect(FUENTE).toContain('detenido')
  })

  it('no avisa de lo que ya estaba pendiente al entrar', () => {
    // Si no, abrir la fila refrescaría la tabla de golpe sin que llegara nada.
    expect(FUENTE).toContain('primeraVez')
  })

  it('un fallo de red no rompe la pantalla', () => {
    expect(FUENTE).toMatch(/catch \{\s*\n\s*return/)
  })

  it('limpia el reloj y el escucha al desmontarse', () => {
    expect(FUENTE).toContain('clearInterval')
    expect(FUENTE).toContain('removeEventListener')
  })
})
