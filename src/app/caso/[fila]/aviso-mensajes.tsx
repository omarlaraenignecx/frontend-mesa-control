'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useNotificaciones } from '@/components/notificaciones/proveedor'
import { refrescarConversacion } from './acciones-correo'

/** Segundos con el caso abierto y a la vista que cuentan como haberlos leído. */
const ESPERA_LECTURA_MS = 3_000

/**
 * "N mensajes nuevos" junto al título de la conversación, y el chat que se
 * actualiza solo cuando llega una respuesta con el caso abierto.
 *
 * El aviso se apaga a los tres segundos de tener el caso a la vista: el área pidió
 * que abrirlo y verlo cuente como leerlo, sin un clic extra. Con la pestaña oculta
 * no cuenta, o se marcaría leído lo que nadie miró.
 */
export function AvisoMensajesNuevos({
  fila,
  rutaDelCaso,
}: {
  fila: number
  /** La ruta de este caso en su módulo: es la que hay que revalidar. */
  rutaDelCaso: string
}) {
  const { correosPorFila, alLlegar, marcarLeidasDeFila } = useNotificaciones()
  const router = useRouter()
  const cuantos = correosPorFila[fila] ?? 0

  // Llega una respuesta mientras el caso está abierto: el chat se actualiza solo.
  useEffect(
    () =>
      alLlegar((nuevas) => {
        if (!nuevas.some((n) => n.tipo === 'correo_recibido' && n.fila === fila)) return
        void refrescarConversacion(fila, rutaDelCaso).then(() => router.refresh())
      }),
    [alLlegar, fila, router, rutaDelCaso],
  )

  useEffect(() => {
    if (cuantos === 0) return
    const reloj = setTimeout(() => {
      if (!document.hidden) void marcarLeidasDeFila(fila)
    }, ESPERA_LECTURA_MS)
    return () => clearTimeout(reloj)
  }, [cuantos, fila, marcarLeidasDeFila])

  if (cuantos === 0) return null

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-base font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      {cuantos} {cuantos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}
    </span>
  )
}
