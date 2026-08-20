import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ARCHIVO = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8')

/** Sin comentarios: los de esta página nombran las mismas funciones que se miden. */
const PAGINA = ARCHIVO.split('\n')
  .filter((linea) => !/^\s*(\/\/|\*|\/\*)/.test(linea))
  .join('\n')

describe('un caso de siniestros se atiende en su módulo', () => {
  it('redirige en lugar de abrirlo aquí', () => {
    // Es lo que evita que una respuesta salga de mesadecontrol@ con la plantilla
    // de la mesa: la fila de la mesa sigue listando estos casos.
    expect(PAGINA).toContain('esSiniestro(caso)')
    expect(PAGINA).toContain('redirect(SINIESTROS.rutaCaso(fila))')
  })

  it('decide antes de registrar la visita y de pedir el hilo', () => {
    // Emitir `caso_visualizado` aquí contaría una visita que no ocurrió, y pedir
    // el hilo iría al buzón equivocado. Las dos cosas cuestan y las dos sobran.
    const corte = PAGINA.indexOf('redirect(SINIESTROS.rutaCaso(fila))')
    expect(corte).toBeGreaterThan(0)
    expect(PAGINA.indexOf("tipo: 'caso_visualizado'")).toBeGreaterThan(corte)
    expect(PAGINA.indexOf('cargarHilo(')).toBeGreaterThan(corte)
  })

  it('decide con el caso ya leído, no con una lectura extra de la hoja', () => {
    expect(PAGINA.indexOf('await cargarCaso(fila)')).toBeLessThan(
      PAGINA.indexOf('esSiniestro(caso)'),
    )
  })
})
