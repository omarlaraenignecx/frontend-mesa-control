'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { useNotificaciones } from '@/components/notificaciones/proveedor'
import { actualizar } from './acciones'

/**
 * Trae a la tabla las peticiones que acaban de llegar, sin que nadie toque
 * Actualizar. Los folios ya vienen escritos: la ruta que crea el aviso los genera
 * antes de insertarlo.
 *
 * El cartel no es decoración. La tabla cambia sola y quien estaba leyendo un
 * renglón tiene derecho a saber por qué se movió; sin aviso, un salto de la lista
 * se siente como un error de la herramienta.
 */
export function AutoActualizarFila() {
  const { alLlegar } = useNotificaciones()
  const router = useRouter()
  const [, iniciar] = useTransition()
  const [cuantas, setCuantas] = useState(0)

  useEffect(
    () =>
      alLlegar((nuevas) => {
        const casos = nuevas.filter((n) => n.tipo === 'caso_nuevo')
        if (casos.length === 0) return // un correo nuevo no mueve esta tabla
        setCuantas((n) => n + casos.length)
        iniciar(async () => {
          // Primero invalidar y luego refrescar: `router.refresh()` a secas
          // reconstruye la página con la lectura cacheada de la hoja, así que la
          // petición nueva no aparecería.
          await actualizar()
          router.refresh()
        })
      }),
    [alLlegar, router],
  )

  if (cuantas === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-base dark:border-blue-900 dark:bg-blue-950">
      <p className="font-medium text-blue-700 dark:text-blue-300">
        {cuantas === 1 ? 'Llegó una petición nueva' : `Llegaron ${cuantas} peticiones nuevas`} y la
        tabla ya se actualizó.
      </p>
      <button
        type="button"
        onClick={() => setCuantas(0)}
        className="text-blue-700 underline underline-offset-4 dark:text-blue-300"
      >
        Entendido
      </button>
    </div>
  )
}
