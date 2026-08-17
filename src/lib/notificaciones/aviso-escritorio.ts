import type { Notificacion } from './tipos'

/**
 * Lo que el navegador necesita para mostrar un aviso del sistema, ya resuelto y
 * sin nada del DOM. Vive aparte del componente para poder probarlo: en las pruebas
 * no hay `Notification` ni ventana.
 */
export type AvisoEscritorio = {
  /** Identifica el aviso para el navegador. Dos pestañas con el mismo `tag` muestran uno. */
  tag: string
  titulo: string
  cuerpo: string
  /** A dónde llevar al usuario cuando le da clic. */
  destino: string
}

export type PermisoEscritorio = 'sin-soporte' | 'preguntar' | 'concedido' | 'negado'

/**
 * Traduce lo que dice el navegador a los cuatro estados que la interfaz sabe
 * explicar. Se separan `sin-soporte` y `negado` porque piden textos distintos: en
 * el primero no hay nada que el usuario pueda hacer; en el segundo sí, pero desde
 * la configuración del sitio y no desde nuestro botón.
 */
export function permisoDeEscritorio(
  soporta: boolean,
  valor: NotificationPermission | null,
): PermisoEscritorio {
  if (!soporta || valor === null) return 'sin-soporte'
  if (valor === 'granted') return 'concedido'
  if (valor === 'denied') return 'negado'
  return 'preguntar'
}

/**
 * Cuántos avisos se muestran uno por uno antes de juntarlos en un resumen.
 *
 * Una tanda de correos que entra en el mismo ciclo de sondeo taparía la pantalla
 * con globos apilados, y el usuario acabaría cerrándolos sin leer ninguno.
 */
export const TOPE_AVISOS = 3

function cuerpoDe(n: Notificacion): string {
  const partes = [n.detalle, n.folio ? `Folio ${n.folio}` : null].filter(Boolean)
  return partes.join(' · ')
}

/**
 * Qué se le muestra al usuario en el escritorio por lo que acaba de llegar.
 *
 * El `tag` se arma con el id de la notificación, que es único y estable: si el
 * mismo usuario tiene la fila abierta en dos pestañas, ambas emiten y el navegador
 * deja una sola.
 */
export function avisosDeEscritorio(nuevas: Notificacion[]): AvisoEscritorio[] {
  if (nuevas.length === 0) return []

  if (nuevas.length > TOPE_AVISOS) {
    // El resumen lleva a la fila y no a un caso: no hay un caso al que llevar.
    return [
      {
        tag: 'mesa-resumen',
        titulo: `Llegaron ${nuevas.length} avisos nuevos`,
        cuerpo: 'Ábrelos desde la campanita de la mesa de control.',
        destino: '/fila',
      },
    ]
  }

  return nuevas.map((n) => ({
    tag: `mesa-${n.id}`,
    titulo: n.titulo,
    cuerpo: cuerpoDe(n),
    destino: `/caso/${n.fila}`,
  }))
}
