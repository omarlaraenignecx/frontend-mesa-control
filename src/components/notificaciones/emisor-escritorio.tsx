'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { avisosDeEscritorio } from '@/lib/notificaciones/aviso-escritorio'
import { avisosEncendidos, emitirAviso } from './escritorio'
import { useNotificaciones } from './proveedor'
import { prepararTimbre, tocarTimbre } from './timbre'

/**
 * Saca al escritorio lo que llega a la campanita.
 *
 * No dibuja nada: vive dentro del proveedor solo para engancharse al mismo sondeo
 * que ya alimenta la campanita, las insignias y el aviso del chat. El evento es el
 * mismo, así que no hay forma de que el escritorio muestre algo que la campanita no
 * tenga, ni al revés.
 *
 * Nada se marca leído por mostrar el aviso. Leer sigue siendo abrir el caso.
 */
export function EmisorEscritorio() {
  const { alLlegar } = useNotificaciones()
  const router = useRouter()

  useEffect(() => prepararTimbre(), [])

  useEffect(
    () =>
      alLlegar((nuevas) => {
        // Se pregunta aquí y no al montar: el permiso puede haberse concedido o
        // revocado en medio, desde el panel o desde la configuración del sitio.
        if (!avisosEncendidos()) return
        // Un solo timbre por tanda, antes de los globos: tres avisos juntos no son
        // tres campanadas encimadas.
        tocarTimbre()
        for (const aviso of avisosDeEscritorio(nuevas)) {
          emitirAviso(aviso, (destino) => router.push(destino))
        }
      }),
    [alLlegar, router],
  )

  return null
}
