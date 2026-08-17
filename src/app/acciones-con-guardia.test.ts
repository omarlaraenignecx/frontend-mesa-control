import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Prueba de arquitectura: en un archivo con `'use server'`, **toda** función
 * exportada es una Server Action con su propio punto de entrada, invocable desde
 * el navegador por quien conozca su identificador. Una que no revise la sesión es
 * una puerta abierta, no un detalle interno.
 *
 * Existe porque al implementar las notificaciones estuvo a punto de agregarse a
 * `acciones-folios.ts` una función sin guardia —para que la usara una ruta— que
 * habría dejado la escritura de folios en la hoja al alcance de cualquiera. Lo que
 * no revisa sesión va en un módulo normal de `lib/`, no en un archivo de acciones.
 */
const RAIZ = import.meta.dirname

function archivosDeApp(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivosDeApp(ruta)
    return /\.tsx?$/.test(nombre) && !nombre.includes('.test.') ? [ruta] : []
  })
}

const GUARDIAS = ['requerirUsuario', 'requerirAdmin']

const archivosDeAcciones = archivosDeApp(RAIZ).filter((ruta) =>
  /^['"]use server['"]/.test(readFileSync(ruta, 'utf8')),
)

describe('archivos de Server Actions', () => {
  it('hay al menos uno, o esta prueba no está mirando nada', () => {
    expect(archivosDeAcciones.length).toBeGreaterThan(0)
  })

  it.each(archivosDeAcciones)('%s: toda función exportada revisa la sesión', (ruta) => {
    const fuente = readFileSync(ruta, 'utf8')
    // El cuerpo de cada función exportada, hasta la siguiente exportación.
    const bloques = fuente.split(/^export (?:async )?function /m).slice(1)
    for (const bloque of bloques) {
      const nombre = bloque.slice(0, bloque.indexOf('('))
      const cuerpo = bloque.split(/^export /m)[0]
      expect(
        GUARDIAS.some((g) => cuerpo.includes(`${g}()`)),
        `${nombre} no llama a ninguna guardia (${GUARDIAS.join(' o ')})`,
      ).toBe(true)
    }
  })
})
