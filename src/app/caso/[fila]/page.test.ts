import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ARCHIVO = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8')

/** Sin comentarios: los de esta página nombran las mismas funciones que se miden. */
const PAGINA = ARCHIVO.split('\n')
  .filter((linea) => !/^\s*(\/\/|\*|\/\*)/.test(linea))
  .join('\n')

const SINIESTRO = readFileSync(
  join(import.meta.dirname, '..', '..', 'siniestros', 'caso', '[fila]', 'page.tsx'),
  'utf8',
)

describe('cada caso se atiende en su módulo', () => {
  it('la vista de la mesa manda los siniestros a la suya', () => {
    // Es lo que evita que una respuesta salga con la marca y la plantilla de la mesa:
    // su fila sigue listando estos casos.
    expect(PAGINA).toContain('esSiniestro(cargado.caso)')
    expect(PAGINA).toContain('redirect(SINIESTROS.rutaCaso(fila))')
  })

  it('y la del ramo devuelve a la mesa lo que no es del ramo', () => {
    // El espejo: un caso de la mesa abierto aquí saldría firmado por el ejecutivo
    // de siniestros.
    expect(SINIESTRO).toContain('!esSiniestro(cargado.caso)')
    expect(SINIESTRO).toContain('redirect(MESA.rutaCaso(fila))')
  })

  it('las dos páginas son envolturas de la misma pantalla', () => {
    for (const fuente of [PAGINA, SINIESTRO]) {
      expect(fuente).toContain('PantallaDeCaso')
      expect(fuente).not.toContain('<Card')
      expect(fuente).not.toContain('cargarHilo')
    }
  })

  it('decide antes de renderizar, no después', () => {
    // Renderizar y luego redirigir contaría una visita que no ocurrió y pediría el
    // hilo al buzón equivocado. Las dos cosas cuestan y las dos sobran.
    for (const fuente of [PAGINA, SINIESTRO]) {
      expect(fuente.indexOf('redirect(')).toBeLessThan(fuente.indexOf('<PantallaDeCaso'))
    }
  })
})
