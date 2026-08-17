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
const DURACION = 0.22

/**
 * Se subió de 0.14 a 0.95 el 17/8/2026, en tres pasos y a pedido del área: con el
 * primer valor apenas se oía sobre el ruido de una oficina.
 *
 * Aquí se acaba el margen. Es un seno puro y las dos notas no se suman —cuando entra
 * la segunda, la primera ya decayó a milésimas—, así que a 0.95 todavía no recorta,
 * pero 1.0 es el techo del formato. Si aún hiciera falta más presencia, la palanca ya
 * no es el nivel sino el patrón: repetir el din-don, o cambiar el seno por una onda
 * triangular, que al mismo nivel se percibe bastante más fuerte.
 */
const VOLUMEN = 0.95

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
  let listo = false
  const desbloquear = () => {
    if (listo) return
    const ctx = obtenerContexto()
    if (!ctx) {
      listo = true
      return
    }
    void asegurarActivo(ctx).then((activo) => {
      listo = activo
    })
  }
  // Sin `once`: se reintenta en cada gesto hasta lograrlo. Un primer gesto que no
  // baste —o que ocurra antes de que exista el contexto— dejaba, con `once`, la
  // página entera sin timbre y sin más intentos.
  document.addEventListener('pointerdown', desbloquear)
  document.addEventListener('keydown', desbloquear)
  return () => {
    document.removeEventListener('pointerdown', desbloquear)
    document.removeEventListener('keydown', desbloquear)
  }
}

/**
 * ¿El navegador tiene el timbre callado ahora mismo?
 *
 * Sirve para decírselo al usuario en el momento en que le importa: llegó un aviso y
 * no se oyó. Con el timbre apagado a propósito no hay nada que reportar.
 */
export function audioBloqueado(): boolean {
  if (!timbreEncendido()) return false
  const ctx = obtenerContexto()
  return ctx !== null && ctx.state !== 'running'
}

/**
 * Deja el contexto corriendo, esperando a que el navegador lo confirme.
 *
 * Esperar es el punto. `resume()` es asíncrono, y en un contexto suspendido el reloj
 * de audio está **congelado**: programar las notas antes de que reanude las agenda
 * contra un tiempo que no avanza, y cuando por fin arranca, sus rampas de ganancia ya
 * quedaron en el pasado —la ganancia se queda en el valor final, casi cero—. El
 * oscilador suena, pero en silencio. Eso es lo que se vio el 17/8/2026: el timbre
 * funcionaba mientras el contexto ya estuviera activo por el clic de Activar, y
 * enmudecía al recargar la página sin tocar nada.
 */
/**
 * Cuánto se espera a que el navegador reanude el audio antes de rendirse.
 *
 * Rendirse es lo importante. Chrome no rechaza `resume()` cuando la página no tiene
 * gesto del usuario: **deja la promesa pendiente** hasta que ocurra uno, aunque sea
 * media hora después. Sin este límite, el timbre de una petición de las 15:28 sonaba
 * al cerrar el cartel a las 15:35 —pasó el 17/8/2026—, y un aviso que suena siete
 * minutos tarde, fuera de contexto, enseña a desconfiar del timbre.
 */
const ESPERA_ACTIVACION_MS = 2_000

async function asegurarActivo(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'running') return true
  try {
    await Promise.race([
      ctx.resume(),
      new Promise((_, rechazar) => setTimeout(rechazar, ESPERA_ACTIVACION_MS)),
    ])
  } catch {
    return false
  }
  // El casteo es necesario: la salida temprana de arriba estrechó el tipo de
  // `ctx.state`, y TypeScript no sabe que `resume()` acaba de cambiarlo.
  return (ctx.state as AudioContextState) === 'running'
}

function programarNotas(ctx: AudioContext): void {
  try {
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
    // Nunca se rompe nada por un timbre; el globo aparece de todas formas.
  }
}

/** Suena el timbre, si el usuario lo quiere y el navegador lo permite. */
export function tocarTimbre(): void {
  if (!timbreEncendido()) return
  const ctx = obtenerContexto()
  if (!ctx) return
  void asegurarActivo(ctx).then((activo) => {
    if (activo) programarNotas(ctx)
  })
}

/**
 * Suena a pedido, ignorando la preferencia, y **dice si se pudo**.
 *
 * El valor de retorno es lo que hace visible una falla que antes era muda: si el
 * navegador no deja activar el audio, el panel lo dice en lugar de dejar al usuario
 * creyendo que su timbre quedó listo.
 */
export async function probarTimbre(): Promise<boolean> {
  const ctx = obtenerContexto()
  if (!ctx) return false
  const activo = await asegurarActivo(ctx)
  if (activo) programarNotas(ctx)
  return activo
}
