import type { ConfigModulo } from '@/lib/modulos/modulo'
import { esSiniestro } from './area'
import type { Caso } from './caso'

/**
 * Las clasificaciones que la mesa puede ponerle a un caso.
 *
 * Salen de los valores distintos que hay hoy en la columna del tipo de trámite
 * del formulario (N), medidos el 18/9/2026 sobre 5 874 respuestas. Ahí conviven
 * dos cosas: las opciones de la lista del formulario y lo que la gente escribió a
 * mano cuando el bloque que le tocó pedía texto libre. Sólo están las primeras.
 *
 * Las 47 descartadas son frases de un solo caso —«OMEGA», «PDF», «cliente perdió
 * su póliza, desea ver si nos la pueden enviar»— y meterlas volvería inservible el
 * desplegable. Si el área echa en falta alguna, se agrega aquí: es una lista fija
 * a propósito, para que el catálogo no cambie solo cuando alguien vuelva a
 * escribir a mano en el formulario.
 *
 * El orden es el de frecuencia de uso, que es el que hace corto el camino al
 * valor más probable.
 */
export const CLASIFICACIONES = [
  'Cotización',
  'Emisión',
  'Cancelaciones',
  'Endoso',
  'Alta de versión',
  'Devolución de primas no devengadas',
  'Alta de usuarios',
  'Renovaciones',
  'Reexpedición de Póliza',
  'Recibos subsecuentes',
  'Validación de versión',
  'Problema en portales',
  'Homologación',
  'Alta o nueva configuración',
  'Descarga de documentos',
  'Alta de negocio o distribuidor',
] as const

/**
 * Si en esta pantalla y en este caso se puede reclasificar.
 *
 * Sólo depende del módulo y del ramo: los casos de siniestros se clasifican por
 * tipo de siniestro y nadie ha pedido reclasificarlos. A diferencia de la versión
 * anterior, que escribía dentro del formulario, ya no hace falta que el caso
 * traiga un trámite: la reclasificación vive en su propia columna, así que
 * también se le puede poner a un caso que llegó sin clasificar.
 */
export function puedeReclasificar(modulo: ConfigModulo, caso: Caso): boolean {
  return modulo.reclasifica && !esSiniestro(caso)
}

/** Por qué no se puede, dicho para quien está mirando la pantalla. */
export const SIN_RECLASIFICACION =
  'Los casos de siniestros se clasifican por tipo de siniestro y ese dato no se reclasifica aquí.'

/**
 * Las opciones del selector: el catálogo más lo que ya tenga el caso.
 *
 * Lo que ya tiene va aunque no esté en el catálogo, porque si no, abrir un caso
 * reclasificado con un valor viejo y guardarlo se lo cambiaría sin que nadie lo
 * pidiera. Los valores se dejan tal cual, con sus mayúsculas y acentos, por la
 * misma razón que los catálogos de seguimiento: normalizarlos generaría valores
 * nuevos en el histórico y rompería las tablas dinámicas del área.
 */
export function opcionesDeReclasificacion(actual: string | null): string[] {
  const limpio = actual?.trim()
  if (!limpio || (CLASIFICACIONES as readonly string[]).includes(limpio)) {
    return [...CLASIFICACIONES]
  }
  return [limpio, ...CLASIFICACIONES]
}

/**
 * La línea que queda en Observaciones cuando se reclasifica.
 *
 * La bitácora vive en la base de datos y el área trabaja en la hoja. La columna
 * KV ya muestra el valor nuevo, pero no de dónde se venía, y saber que un caso
 * llegó como emisión y se atendió como endoso es justo lo que explica el número
 * en el reporte.
 */
export function lineaDeReclasificacion(caso: Caso, nuevo: string): string {
  const antes = caso.reclasificacion?.trim() || caso.tipoTramite?.trim() || 'sin clasificar'
  const despues = nuevo.trim()
  return despues
    ? `Reclasificado de «${antes}» a «${despues}».`
    : `Se quitó la reclasificación, que era «${antes}».`
}

/**
 * Lo que va a Observaciones en este guardado: la reclasificación, si la hubo, y
 * la nota que haya escrito la persona.
 *
 * Van juntas en una sola entrada porque son un mismo acto, y la de la persona
 * nunca se pierde ni se recorta por el hecho de que además se reclasificara.
 * Cadena vacía significa que no hay nada que anotar.
 */
export function notaDelGuardado(
  caso: Caso,
  propuesta: string | undefined,
  nota: string,
): string {
  const cambia =
    propuesta !== undefined && propuesta.trim() !== (caso.reclasificacion ?? '').trim()
  return [cambia ? lineaDeReclasificacion(caso, propuesta) : '', nota.trim()]
    .filter(Boolean)
    .join(' ')
}
