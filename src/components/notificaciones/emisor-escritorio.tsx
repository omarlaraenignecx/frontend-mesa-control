'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { moduloPorClave } from '@/lib/modulos/modulo'
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
  const { alLlegar, modulo } = useNotificaciones()
  const router = useRouter()

  useEffect(() => prepararTimbre(), [])

  useEffect(
    () =>
      alLlegar((nuevas) => {
        // El timbre va **antes** de la guarda del permiso, y eso es el arreglo del
        // 21/8/2026. Estaba detrás de ella, así que quien no concedía las
        // notificaciones del navegador —o las tenía bloqueadas— se quedaba también
        // sin timbre, con su interruptor encendido y sin ninguna explicación. Son dos
        // molestias distintas y dos permisos distintos: el globo lo autoriza el
        // sistema operativo; el sonido es de la página y ya tiene su interruptor,
        // que `tocarTimbre` consulta por su cuenta.
        //
        // Un solo timbre por tanda: tres avisos juntos no son tres campanadas
        // encimadas.
        tocarTimbre()

        // Se pregunta aquí y no al montar: el permiso puede haberse concedido o
        // revocado en medio, desde el panel o desde la configuración del sitio.
        if (!avisosEncendidos()) return
        for (const aviso of avisosDeEscritorio(nuevas, moduloPorClave(modulo))) {
          emitirAviso(aviso, (destino) => router.push(destino))
        }
      }),
    [alLlegar, modulo, router],
  )

  return null
}
