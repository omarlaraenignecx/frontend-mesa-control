'use client'

import { Mail } from 'lucide-react'
import { useNotificaciones } from './proveedor'

/**
 * Marca en la tabla los casos que recibieron correo sin leer, con el número de
 * mensajes.
 *
 * Cuelga del borde izquierdo del renglón, pegada al filo y con el lado derecho
 * redondeado. No sobresale por fuera con un desplazamiento negativo porque la tabla
 * vive dentro de un contenedor con `overflow-x-auto`, que recortaría cualquier cosa
 * fuera de su área; queda dentro de la primera celda, que se ensancha para darle
 * lugar al lado del semáforo.
 */
export function InsigniaCorreo({ fila }: { fila: number }) {
  const { correosPorFila } = useNotificaciones()
  const cuantos = correosPorFila[fila] ?? 0
  if (cuantos === 0) return null

  return (
    <span
      title={`${cuantos} ${cuantos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en este caso`}
      className="absolute top-1/2 left-0 inline-flex -translate-y-1/2 items-center gap-1 rounded-r-full bg-blue-600 py-1 pr-2.5 pl-2 text-sm font-medium text-white shadow-sm"
    >
      <Mail aria-hidden className="size-3.5" />
      {cuantos}
      <span className="sr-only">
        {cuantos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en este caso
      </span>
    </span>
  )
}
