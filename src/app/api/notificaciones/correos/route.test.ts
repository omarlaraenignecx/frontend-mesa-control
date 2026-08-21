import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MESA = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')
const RAMO = readFileSync(
  join(import.meta.dirname, '..', 'siniestros-correos', 'route.ts'),
  'utf8',
)
const COMPARTIDO = readFileSync(
  join(import.meta.dirname, '..', '..', '..', '..', 'lib', 'notificaciones', 'correos-recibidos.ts'),
  'utf8',
)

/**
 * El orden se mide sobre el cuerpo de la función y no sobre el archivo completo: los
 * nombres también aparecen en el bloque de importaciones, y ahí el orden es alfabético
 * y no dice nada de lo que hace el código.
 */
const cuerpoDe = (fuente: string, desde: string) => fuente.slice(fuente.indexOf(desde))

describe('las dos rutas de correos recibidos', () => {
  it('cada una exige el secreto antes de hablar con Gmail', () => {
    for (const [fuente, marca] of [
      [MESA, 'export async function POST'],
      [RAMO, 'export async function POST'],
    ] as const) {
      const cuerpo = cuerpoDe(fuente, marca)
      const secreto = cuerpo.indexOf('secretoValido')
      expect(secreto).toBeGreaterThan(-1)
      expect(secreto).toBeLessThan(cuerpo.indexOf('revisarCorreos'))
      expect(cuerpo).toContain('status: 401')
    }
  })

  it('la de la mesa revisa el buzón de la mesa y la del ramo el del ramo', () => {
    expect(MESA).toContain("revisarCorreos('mesa', await depsGmail())")
    expect(RAMO).toContain("revisarCorreos('siniestros', {")
    expect(RAMO).toContain('buzonDeSiniestros()')
    // La del ramo no puede caer al buzón de la mesa por descuido.
    expect(RAMO).not.toContain('depsGmail')
  })

  it('comparten el cuerpo, no lo duplican', () => {
    // Dos copias de sesenta líneas serían dos sitios donde arreglar el mismo error.
    for (const fuente of [MESA, RAMO]) {
      expect(fuente).not.toContain('mensajesRecientes')
      expect(fuente).not.toContain('guardarNotificaciones')
    }
  })

  it('sin cuenta autorizada la del ramo responde bien, no revienta cada minuto', () => {
    // El flujo de n8n llama desde antes de que el ejecutivo autorice: un 500 por
    // minuto llenaría el historial de errores rojos que no son errores.
    expect(RAMO).toContain('SinCuentaSiniestrosError')
    expect(RAMO).toContain('sinCuenta: true')
  })
})

describe('la revisión de una bandeja', () => {
  const CUERPO = cuerpoDe(COMPARTIDO, 'export async function revisarCorreos')

  it('solo mira los hilos de su módulo', () => {
    // Los dos módulos pueden compartir buzón. Sin este filtro, la primera revisión en
    // correr se quedaría con las respuestas de la otra y las metería en su campanita.
    expect(CUERPO).toContain('eq(schema.casosHilo.modulo, modulo)')
  })

  it('sella los avisos con el módulo que se está revisando', () => {
    expect(CUERPO).toContain('modulo,')
  })

  it('resuelve la fila por el folio del hilo, no por la fila guardada', () => {
    // `casos_hilo` no lleva la hoja: su fila 7181 puede ser de la copia o de la
    // productiva. El folio sí identifica el caso dentro de la hoja que se sirve.
    expect(CUERPO).toContain('folioUsado')
    expect(CUERPO).toContain('casoPorFolio')
    expect(CUERPO).not.toMatch(/vinculo\.fila|v\.fila/)
  })

  it('descarta las claves que ya existen antes de pedir metadatos a Gmail', () => {
    expect(CUERPO.indexOf('clavesExistentes')).toBeLessThan(CUERPO.indexOf('metadatosDeMensaje'))
  })

  it('revalida la vista del caso en la ruta de su módulo', () => {
    // Sin la ruta del módulo, revalidaría la página de la mesa para un caso del ramo
    // y el chat que se está mirando no traería el mensaje.
    expect(CUERPO).toContain('revalidatePath(config.rutaCaso(fila))')
  })

  it('sale temprano cuando no hay nada que hacer, sin leer la hoja', () => {
    // Leer 1,428 casos de la hoja cada minuto sin necesidad es gasto puro.
    expect(CUERPO.indexOf('pendientes.length === 0')).toBeLessThan(CUERPO.indexOf('leerCasos('))
  })
})
