'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { useNotificaciones } from '@/components/notificaciones/proveedor'
import { audioBloqueado } from '@/components/notificaciones/timbre'
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
  const [sinTimbre, setSinTimbre] = useState(false)

  useEffect(
    () =>
      alLlegar((nuevas) => {
        const casos = nuevas.filter((n) => n.tipo === 'caso_nuevo')
        if (casos.length === 0) return // un correo nuevo no mueve esta tabla
        setCuantas((n) => n + casos.length)
        // Si el navegador tenía el audio callado, este aviso llegó en silencio. Vale
        // decirlo aquí: es el momento en que el usuario descubre que no lo oyó.
        if (audioBloqueado()) setSinTimbre(true)
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
    <div className="space-y-1.5 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-base dark:border-blue-900 dark:bg-blue-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
      {sinTimbre && (
        <p className="text-sm text-blue-700 dark:text-blue-300">
          El timbre no sonó: el navegador solo permite audio después de un clic en la página. Ya
          está desbloqueado para los siguientes avisos.
        </p>
      )}
    </div>
  )
}
