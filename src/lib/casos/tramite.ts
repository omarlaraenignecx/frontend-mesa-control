import type { ConfigModulo } from '@/lib/modulos/modulo'
import { esSiniestro } from './area'
import type { Caso } from './caso'

/**
 * Los tres motivos por los que una corrección no procede. Viven aquí, en un solo
 * sitio, porque los dice la pantalla antes de intentarlo y el servidor al
 * rechazarlo, y que las dos digan lo mismo es parte de que se entienda.
 */
export const SIN_CORRECCION = {
  ramo: 'Los casos de siniestros se clasifican por tipo de siniestro y ese dato no se corrige aquí.',
  sinOrigen:
    'Este caso no trae tipo de trámite en el formulario, así que no hay ninguna celda donde escribir una corrección.',
  vacio: 'El tipo de trámite no se puede dejar vacío: se corrige por otro valor, no se borra.',
} as const

/**
 * Si el caso en sí admite que le corrijan el trámite, sin mirar el módulo.
 *
 * Dos condiciones por razones distintas: no puede ser del ramo, que clasifica por
 * tipo de siniestro; y tiene que traer ya un trámite, porque sin valor no hay
 * forma de saber qué bloque del formulario llenó esa fila —está replicado en
 * cinco— y por lo tanto no hay celda donde escribir la corrección.
 */
export function casoAdmiteCorreccion(caso: Caso): boolean {
  return !esSiniestro(caso) && Boolean(caso.tipoTramite?.trim())
}

/** Si en esta pantalla y en este caso se puede corregir el tipo de trámite. */
export function puedeCorregirTramite(modulo: ConfigModulo, caso: Caso): boolean {
  return modulo.corrigeTipoTramite && casoAdmiteCorreccion(caso)
}

/** Por qué no se puede corregir, dicho para quien está mirando la pantalla. */
export function motivoSinCorreccion(modulo: ConfigModulo, caso: Caso): string | null {
  if (puedeCorregirTramite(modulo, caso)) return null
  if (!modulo.corrigeTipoTramite || esSiniestro(caso)) return SIN_CORRECCION.ramo
  return SIN_CORRECCION.sinOrigen
}

/**
 * Por qué el servidor rechaza una corrección, o `null` si la acepta.
 *
 * La pantalla ya impide llegar aquí, pero `guardarSeguimiento` la comparten los
 * dos módulos y es una acción de servidor: se puede invocar sin pasar por la
 * pantalla, así que la última palabra tiene que estar de este lado.
 */
export function rechazoDeCorreccion(caso: Caso, propuesto: string): string | null {
  if (esSiniestro(caso)) return SIN_CORRECCION.ramo
  if (!propuesto.trim()) return SIN_CORRECCION.vacio
  if (!caso.tipoTramite?.trim()) return SIN_CORRECCION.sinOrigen
  return null
}

/**
 * Las opciones del selector: los trámites que de verdad existen en la hoja, más
 * el del propio caso.
 *
 * El actual va siempre aunque la lista no lo traiga. Sale del mismo arreglo de
 * casos, así que en la práctica ya está; ponerlo igual evita que un desajuste
 * entre las dos lecturas convierta el selector en una forma silenciosa de
 * cambiarle el trámite a un caso al abrirlo.
 *
 * Los valores se dejan tal cual, con sus espacios e inconsistencias, por la misma
 * razón que los catálogos de seguimiento: normalizarlos generaría valores nuevos
 * en el histórico y rompería las tablas dinámicas del área.
 */
export function opcionesDeTramite(usados: string[], actual: string | null): string[] {
  const limpio = actual?.trim()
  const todos = [...usados, ...(limpio ? [limpio] : [])].filter((v) => v.trim())
  return [...new Set(todos)].sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * La línea que queda en Observaciones cuando se corrige el trámite.
 *
 * La bitácora vive en la base de datos y el área trabaja en la hoja: sin esto, el
 * valor que eligió el solicitante desaparecería de la única vista que ellos
 * abren. `componerObservaciones` le antepone después la fecha y el autor.
 */
export function lineaDeCorreccion(anterior: string | null, nuevo: string): string {
  return `Tipo de trámite corregido de «${anterior?.trim() || 'sin valor'}» a «${nuevo.trim()}».`
}

/**
 * Lo que va a Observaciones en este guardado: la corrección del trámite, si la
 * hubo, y la nota que haya escrito la persona.
 *
 * Van juntas en una sola entrada porque son un mismo acto, y la de la persona
 * nunca se pierde ni se recorta por el hecho de que además se corrigiera el
 * trámite. Cadena vacía significa que no hay nada que anotar.
 */
export function notaDelGuardado(
  caso: Pick<Caso, 'tipoTramite'>,
  propuesto: string | undefined,
  nota: string,
): string {
  const corrige = propuesto !== undefined && propuesto.trim() !== (caso.tipoTramite ?? '').trim()
  return [corrige ? lineaDeCorreccion(caso.tipoTramite, propuesto) : '', nota.trim()]
    .filter(Boolean)
    .join(' ')
}
