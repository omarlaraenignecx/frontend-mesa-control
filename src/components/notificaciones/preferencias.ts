'use client'

/**
 * Las preferencias de aviso viven en `localStorage`, una por navegador.
 *
 * No van en la base a propósito: son del aparato y no de la persona. Quien usa la
 * mesa desde su computadora y desde otra en el mostrador puede querer el timbre en
 * una y no en la otra.
 *
 * Todo va envuelto en `try`: `localStorage` **lanza** en ventanas privadas y con el
 * almacenamiento bloqueado por política, y una preferencia no es motivo para tumbar
 * la pantalla.
 */

/** Avisos del escritorio encendidos, con el permiso ya concedido. */
export const CLAVE_AVISOS = 'mesa:avisos-escritorio'

/** Timbre al llegar un aviso. */
export const CLAVE_TIMBRE = 'mesa:timbre-avisos'

/** Ya se descartó la invitación de la fila. */
export const CLAVE_INVITACION = 'mesa:invitacion-escritorio'

export function leerPreferencia(clave: string, omision: boolean): boolean {
  try {
    const valor = window.localStorage.getItem(clave)
    if (valor === null) return omision
    return valor === 'si'
  } catch {
    return omision
  }
}

export function guardarPreferencia(clave: string, encendido: boolean): void {
  try {
    window.localStorage.setItem(clave, encendido ? 'si' : 'no')
  } catch {
    // Sin dónde guardarlo, la preferencia dura lo que dure la pestaña.
  }
}
