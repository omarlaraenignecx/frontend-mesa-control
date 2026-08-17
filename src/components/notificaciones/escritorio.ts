'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  permisoDeEscritorio,
  type AvisoEscritorio,
  type PermisoEscritorio,
} from '@/lib/notificaciones/aviso-escritorio'

/**
 * Trato con la API `Notification` del navegador, en un solo lugar.
 *
 * Todo aquí toca `window`, así que nada de esto puede correr en el servidor: cada
 * lectura pregunta primero si hay soporte, y el estado del hook arranca en
 * `sin-soporte` para que el primer render del servidor y el del navegador digan lo
 * mismo y no haya desajuste de hidratación.
 */

/** Apagar los avisos sin tener que revocar el permiso en la configuración del sitio. */
const CLAVE_PREFERENCIA = 'mesa:avisos-escritorio'

/** Solo el ícono del sitio: el aviso del sistema es angosto y no cabe más. */
const ICONO = '/favicon.ico'

function soporta(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function permisoActual(): PermisoEscritorio {
  return permisoDeEscritorio(soporta(), soporta() ? Notification.permission : null)
}

/**
 * `localStorage` lanza en ventanas privadas y con el almacenamiento bloqueado por
 * política. Que eso no tumbe la pantalla: sin preferencia guardada, encendidos.
 */
function apagadoPorElUsuario(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_PREFERENCIA) === 'no'
  } catch {
    return false
  }
}

function guardarPreferencia(encendido: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_PREFERENCIA, encendido ? 'si' : 'no')
  } catch {
    // Sin dónde guardar, la preferencia dura lo que dure la pestaña. No es grave.
  }
}

/**
 * ¿Hay que emitir avisos del sistema ahora mismo?
 *
 * Se pregunta al navegador en el momento de emitir y no a un estado de React: el
 * permiso puede cambiar desde la configuración del sitio, sin que la página se
 * enterara nunca.
 */
export function avisosEncendidos(): boolean {
  return permisoActual() === 'concedido' && !apagadoPorElUsuario()
}

/**
 * Muestra el aviso del sistema y engancha el clic.
 *
 * `requireInteraction` mantiene el globo en pantalla hasta que alguien lo atienda.
 * Es a propósito: un correo del asegurado o una petición nueva son cosas que
 * alguien tiene que ver, y un aviso que se esfuma en cinco segundos mientras el
 * usuario estaba en otra ventana no sirve de nada. Firefox y Safari lo ignoran, sin
 * más consecuencia que el comportamiento normal.
 */
export function emitirAviso(aviso: AvisoEscritorio, alAbrir: (destino: string) => void): void {
  if (!soporta()) return
  try {
    const globo = new Notification(aviso.titulo, {
      body: aviso.cuerpo,
      tag: aviso.tag,
      icon: ICONO,
      requireInteraction: true,
    })
    globo.onclick = () => {
      // Traer la ventana al frente antes de navegar: el clic llega desde el
      // escritorio, con el navegador posiblemente detrás de otra aplicación.
      window.focus()
      globo.close()
      alAbrir(aviso.destino)
    }
  } catch {
    // Algunos contextos (iOS, ciertos modos empresariales) tienen `Notification`
    // pero lanzan al construirla. Se pierde el aviso del escritorio; la campanita
    // sigue teniéndolo.
  }
}

/**
 * Un aviso de cortesía al activar.
 *
 * Vale la pena: en macOS y Windows el navegador puede tener el permiso concedido y
 * el sistema silenciándolo igual (modo concentración, avisos del navegador
 * apagados). Sin esta prueba, el usuario creería que quedó listo y se enteraría
 * hasta el día que se pierda un caso.
 */
export function emitirPrueba(): void {
  if (!soporta()) return
  try {
    new Notification('Avisos activados', {
      body: 'Así se verán las notificaciones de la mesa de control.',
      tag: 'mesa-prueba',
      icon: ICONO,
    })
  } catch {
    // Igual que arriba: no es motivo para romper nada.
  }
}

export type ControlEscritorio = {
  permiso: PermisoEscritorio
  /** Con el permiso dado, si además el usuario los quiere prendidos. */
  encendido: boolean
  pedirPermiso: () => Promise<void>
  alternar: () => void
}

/**
 * Estado para la interfaz que ofrece y apaga los avisos.
 *
 * El permiso se pide siempre desde un clic. Chrome ignora la petición sin gesto del
 * usuario, y pedirla al entrar es de las cosas que más molestan de un sitio.
 */
export function useAvisosEscritorio(): ControlEscritorio {
  const [permiso, setPermiso] = useState<PermisoEscritorio>('sin-soporte')
  const [encendido, setEncendido] = useState(false)

  useEffect(() => {
    // En microtarea, no en el cuerpo del efecto: dos `setState` seguidos ahí son lo
    // que marca `react-hooks/set-state-in-effect`.
    queueMicrotask(() => {
      setPermiso(permisoActual())
      setEncendido(!apagadoPorElUsuario())
    })
  }, [])

  const pedirPermiso = useCallback(async () => {
    if (!soporta()) return
    const valor = await Notification.requestPermission()
    setPermiso(permisoDeEscritorio(true, valor))
    if (valor !== 'granted') return
    guardarPreferencia(true)
    setEncendido(true)
    emitirPrueba()
  }, [])

  // Se calcula fuera del `setState` a propósito: escribir en `localStorage` dentro
  // de la función actualizadora es un efecto en un lugar que React puede volver a
  // ejecutar, y eso es justo lo que prohíbe `react-hooks/purity`.
  const alternar = useCallback(() => {
    const siguiente = !encendido
    guardarPreferencia(siguiente)
    setEncendido(siguiente)
  }, [encendido])

  return { permiso, encendido, pedirPermiso, alternar }
}
