'use client'

import { BellRing, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAvisosEscritorio } from '@/components/notificaciones/escritorio'
import {
  CLAVE_INVITACION,
  guardarPreferencia,
  leerPreferencia,
} from '@/components/notificaciones/preferencias'

/**
 * Ofrece los avisos del escritorio en la pantalla que el área tiene abierta todo el
 * día.
 *
 * El panel de la campanita también los ofrece, pero hay que abrirlo para verlo, y
 * quien nunca lo abre nunca los activaría. Aparece solo mientras el permiso está sin
 * decidir: concedido o bloqueado, esta barra no tiene nada que decir y el panel se
 * encarga del resto.
 */
export function InvitacionEscritorio() {
  const { permiso, pedirPermiso } = useAvisosEscritorio()
  const [descartada, setDescartada] = useState(true)

  useEffect(() => {
    // Arranca oculta y aparece después de consultar `localStorage`: al revés
    // parpadearía en cada carga para quien ya la descartó.
    queueMicrotask(() => setDescartada(leerPreferencia(CLAVE_INVITACION, false)))
  }, [])

  if (descartada || permiso !== 'preguntar') return null

  function descartar() {
    // Sin dónde guardarlo vuelve a aparecer en la siguiente carga, que es aceptable.
    guardarPreferencia(CLAVE_INVITACION, true)
    setDescartada(true)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950">
      <div className="flex items-start gap-2.5">
        <BellRing className="mt-0.5 size-5 shrink-0 text-blue-700 dark:text-blue-300" />
        <p className="text-base text-blue-800 dark:text-blue-200">
          <span className="font-medium">Recibe los avisos en el escritorio.</span> Te avisamos de
          las peticiones nuevas y de las respuestas de correo aunque estés en otra ventana.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void pedirPermiso()}
          className="rounded-lg bg-blue-600 px-3.5 py-2 text-base font-medium text-white transition-colors hover:bg-blue-700"
        >
          Activar
        </button>
        <button
          type="button"
          onClick={descartar}
          aria-label="Ahora no"
          title="Ahora no"
          className="inline-flex size-9 items-center justify-center rounded-lg text-blue-700 transition-colors hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}
