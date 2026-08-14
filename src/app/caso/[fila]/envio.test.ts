import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Los compositores de correo son componentes de cliente y la suite corre sin DOM,
 * así que se revisa el archivo.
 *
 * Lo que se cuida es que un error que la acción no alcance a atrapar —un 413 por
 * cuerpo grande, una caída de red a media petición, un despliegue nuevo— termine
 * en un mensaje dentro del panel y no en la pantalla de error de Next, que fue
 * lo que vio la mesa el 14 de agosto de 2026 al responder un correo con adjunto.
 */
const fuente = (archivo: string) =>
  readFileSync(join(import.meta.dirname, archivo), 'utf8')

describe.each([['conversacion.tsx'], ['reenviar-cadena.tsx']])(
  '%s no deja que un error tumbe la página',
  (archivo) => {
    const FUENTE = fuente(archivo)

    it('atrapa lo que lance la acción', () => {
      expect(FUENTE).toMatch(/\}\s*catch/)
    })

    it('convierte la falla en un resultado que el panel ya sabe mostrar', () => {
      expect(FUENTE).toMatch(/setResultado\(\{\s*ok: false/)
    })
  },
)
