'use client'

import { CLAVE_TIMBRE, leerPreferencia, guardarPreferencia } from './preferencias'

/**
 * El timbre de los avisos, sintetizado con WebAudio.
 *
 * No hay archivo de sonido en el repositorio y no es por ahorrar bytes: la opción
 * `sound` de la API `Notification` está **deprecada y ningún navegador la
 * implementa**, así que el sonido tiene que salir de la página de todos modos. Dos
 * senos cortos hacen el "din-don" sin descargar nada, sin depender de un formato que
 * un navegador pueda no soportar y sin un binario que nadie pueda revisar en un
 * diff.
 *
 * Dos notas y no una: un solo tono se confunde con los mil sonidos de un escritorio;
 * un intervalo ascendente se reconoce como "algo llegó".
 */
const NOTAS_HZ = [880, 1318.5]

/** Cada nota, en segundos. Corto: es un aviso, no una alarma. */
const DURACION = 0.18

/** Discreto a propósito: la mesa trabaja en una oficina compartida. */
const VOLUMEN = 0.14

let contexto: AudioContext | null = null

/**
 * El contexto se crea una vez y se reusa. Los navegadores limitan cuántos se pueden
 * abrir, y uno nuevo por aviso los agota en una jornada.
 */
function obtenerContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Constructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Constructor) return null
  contexto ??= new Constructor()
  return contexto
}

export function timbreEncendido(): boolean {
  return leerPreferencia(CLAVE_TIMBRE, true)
}

export function guardarTimbre(encendido: boolean): void {
  guardarPreferencia(CLAVE_TIMBRE, encendido)
}

/**
 * Deja el audio listo con el primer gesto del usuario en la página.
 *
 * Sin esto había una falla silenciosa: el navegador mantiene el contexto de audio
 * suspendido hasta que la página recibe un gesto, así que quien recargara la fila y
 * se fuera a otra ventana sin tocar nada se quedaba sin timbre en el primer aviso
 * —con el permiso concedido y todo—. Cualquier clic o tecla basta, y en una jornada
 * de trabajo eso ocurre en los primeros segundos.
 *
 * Devuelve la función para darse de baja.
 */
export function prepararTimbre(): () => void {
  const desbloquear = () => {
    const ctx = obtenerContexto()
    if (ctx?.state === 'suspended') void ctx.resume()
  }
  document.addEventListener('pointerdown', desbloquear, { once: true })
  document.addEventListener('keydown', desbloquear, { once: true })
  return () => {
    document.removeEventListener('pointerdown', desbloquear)
    document.removeEventListener('keydown', desbloquear)
  }
}

/**
 * Suena el timbre, si el usuario lo quiere.
 *
 * El contexto arranca suspendido cuando la página todavía no ha recibido un gesto
 * del usuario —política de reproducción automática— y hay que reanudarlo. En la
 * práctica el gesto ya ocurrió: activar los avisos es un clic. Si el navegador se
 * niega igual, se queda sin sonido y el globo aparece de todas formas; nunca se rompe
 * nada por un timbre.
 */
export function tocarTimbre(): void {
  if (!timbreEncendido()) return
  const ctx = obtenerContexto()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') void ctx.resume()

    NOTAS_HZ.forEach((hz, i) => {
      const oscilador = ctx.createOscillator()
      const ganancia = ctx.createGain()
      oscilador.type = 'sine'
      oscilador.frequency.value = hz

      // Las notas se encadenan con un traslape leve para que suene a una sola cosa.
      const inicio = ctx.currentTime + i * DURACION * 0.8
      // Con envolvente y no a secas: un seno que arranca y corta de golpe produce un
      // chasquido en las bocinas.
      ganancia.gain.setValueAtTime(0, inicio)
      ganancia.gain.linearRampToValueAtTime(VOLUMEN, inicio + 0.012)
      ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + DURACION)

      oscilador.connect(ganancia)
      ganancia.connect(ctx.destination)
      oscilador.start(inicio)
      oscilador.stop(inicio + DURACION)
    })
  } catch {
    // Un contexto cerrado por el navegador, o WebAudio bloqueado: sin sonido y ya.
  }
}
