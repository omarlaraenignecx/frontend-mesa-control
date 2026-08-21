import { normalizarTexto } from '@/lib/texto'
import type { Caso } from './caso'

/**
 * El valor con el que el formulario marca una petición del ramo de siniestros, en
 * la pregunta "Áreas de GPLUS SEGUROS". Los otros dos son `Mesa de control` e
 * `Ingresos y Egresos`.
 */
export const AREA_SINIESTROS = 'Siniestros'

/**
 * ¿Esta petición es de siniestros?
 *
 * Se decide por el área declarada en el formulario y por nada más. Medido el
 * 20/8/2026 sobre la hoja: 268 filas dicen `Siniestros` y **ninguna** fila tiene
 * llena la rama de preguntas del ramo sin decirlo. Las 3 que traen el área sin la
 * rama son quejas contra la atención de la aseguradora, que son siniestros
 * legítimos. Así que el área es la regla completa y adivinar por el contenido de
 * otras columnas solo agregaría formas de equivocarse.
 *
 * Un caso sin área es de la mesa: es lo que eran todas las peticiones antes de que
 * el formulario preguntara, y la mesa es donde alguien las va a ver.
 */
export function esSiniestro(caso: Pick<Caso, 'area'>): boolean {
  return normalizarTexto(caso.area ?? '') === normalizarTexto(AREA_SINIESTROS)
}
