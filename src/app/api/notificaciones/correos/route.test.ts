import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUENTE = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')

/**
 * El orden se mide sobre el cuerpo de la función y no sobre el archivo completo:
 * los nombres también aparecen en el bloque de importaciones, y ahí el orden es
 * alfabético y no dice nada de lo que hace la ruta.
 */
const CUERPO = FUENTE.slice(FUENTE.indexOf('export async function POST'))

describe('ruta de correos recibidos', () => {
  it('exige el secreto antes de hablar con Gmail', () => {
    const secreto = CUERPO.indexOf('secretoValido')
    expect(secreto).toBeGreaterThan(-1)
    expect(secreto).toBeLessThan(CUERPO.indexOf('mensajesRecientes'))
  })

  it('responde 401 sin secreto válido', () => {
    expect(CUERPO).toContain('status: 401')
  })

  it('resuelve la fila por el folio del hilo, no por la fila guardada', () => {
    // `casos_hilo` no lleva la hoja: su fila 7181 puede ser de la copia o de la
    // productiva. El folio sí identifica el caso dentro de la hoja que se sirve.
    expect(CUERPO).toContain('folioUsado')
    expect(CUERPO).toContain('casoPorFolio')
    expect(CUERPO).not.toMatch(/vinculo\.fila|v\.fila/)
  })

  it('sella el módulo por el área del caso, no por el buzón donde se leyó', () => {
    // La conversación de un siniestro puede vivir en el buzón de la mesa; el aviso
    // igual tiene que llegar a la campanita del ramo.
    expect(CUERPO).toContain('moduloDelCaso(caso).clave')
  })

  it('descarta las claves que ya existen antes de pedir metadatos a Gmail', () => {
    expect(CUERPO.indexOf('clavesExistentes')).toBeLessThan(CUERPO.indexOf('metadatosDeMensaje'))
  })

  it('revalida la vista de cada caso tocado, para que el chat traiga el mensaje', () => {
    expect(CUERPO).toContain('revalidatePath')
  })

  it('sale temprano cuando no hay nada que hacer, sin leer la hoja', () => {
    // Leer 1,428 casos de la hoja cada minuto sin necesidad es gasto puro.
    expect(CUERPO.indexOf('pendientes.length === 0')).toBeLessThan(CUERPO.indexOf('leerCasos('))
  })
})
