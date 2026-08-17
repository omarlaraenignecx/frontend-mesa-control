'use client'

import { BellRing, MonitorX, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAvisosEscritorio } from './escritorio'
import { guardarTimbre, timbreEncendido, tocarTimbre } from './timbre'

/**
 * El timbre, aparte de los globos.
 *
 * Es su propio interruptor porque las molestias son distintas: hay quien quiere ver
 * los avisos y no oírlos, en una oficina compartida o en una llamada. Y suena al
 * encenderlo, que es la única forma de saber si el volumen alcanza.
 */
function Timbre() {
  const [encendido, setEncendido] = useState(true)

  useEffect(() => {
    queueMicrotask(() => setEncendido(timbreEncendido()))
  }, [])

  function alternar() {
    const siguiente = !encendido
    guardarTimbre(siguiente)
    setEncendido(siguiente)
    if (siguiente) tocarTimbre()
  }

  const Icono = encendido ? Volume2 : VolumeX

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
      <p className="flex items-center gap-2 text-base">
        <Icono className="size-4 text-muted-foreground" />
        Timbre: <span className="font-medium">{encendido ? 'activado' : 'apagado'}</span>
      </p>
      <button
        type="button"
        onClick={alternar}
        className="text-base text-blue-600 underline underline-offset-4 transition-colors hover:text-blue-700 dark:text-blue-400"
      >
        {encendido ? 'Apagar' : 'Encender'}
      </button>
    </div>
  )
}

/**
 * Los avisos del escritorio, dentro del panel de la campanita.
 *
 * Es el lugar donde el usuario acepta o niega el permiso del navegador y donde
 * puede apagarlos después sin ir a la configuración del sitio.
 *
 * Cada estado dice algo distinto porque la salida es distinta: sin decidir hay un
 * botón; concedido, un interruptor; bloqueado, la única salida está en el navegador
 * y hay que decir dónde; sin soporte no hay nada que ofrecer y no se muestra nada.
 */
export function AjusteEscritorio() {
  const { permiso, encendido, pedirPermiso, alternar } = useAvisosEscritorio()

  if (permiso === 'sin-soporte') return null

  if (permiso === 'preguntar') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-blue-50 px-5 py-3.5 dark:bg-blue-950/60">
        <div className="flex items-start gap-2.5">
          <BellRing className="mt-0.5 size-5 shrink-0 text-blue-700 dark:text-blue-300" />
          <div>
            <p className="text-base font-medium text-blue-800 dark:text-blue-200">
              Avisos en el escritorio
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Te avisamos aunque estés trabajando en otra ventana.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void pedirPermiso()}
          className="rounded-lg bg-blue-600 px-3.5 py-2 text-base font-medium text-white transition-colors hover:bg-blue-700"
        >
          Activar
        </button>
      </div>
    )
  }

  if (permiso === 'negado') {
    return (
      <div className="flex items-start gap-2.5 border-b px-5 py-3.5">
        <MonitorX className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Este navegador tiene bloqueados los avisos del sitio. Para recibirlos, ábrelos desde el
          candado de la barra de direcciones y permite las notificaciones.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <p className="flex items-center gap-2 text-base">
          <BellRing className="size-4 text-muted-foreground" />
          Avisos en el escritorio:{' '}
          <span className="font-medium">{encendido ? 'activados' : 'apagados'}</span>
        </p>
        <button
          type="button"
          onClick={alternar}
          className="text-base text-blue-600 underline underline-offset-4 transition-colors hover:text-blue-700 dark:text-blue-400"
        >
          {encendido ? 'Apagar' : 'Encender'}
        </button>
      </div>
      {/* El timbre solo tiene sentido si los globos están prendidos: es su sonido. */}
      {encendido && <Timbre />}
    </>
  )
}
