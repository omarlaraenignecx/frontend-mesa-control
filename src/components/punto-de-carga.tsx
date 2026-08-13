'use client'

import { LoaderCircle } from 'lucide-react'
import { useLinkStatus } from 'next/link'

/**
 * Señal de "ya recibimos el clic" para las navegaciones que no cambian de ruta,
 * donde `loading.tsx` no se vuelve a mostrar: cambiar de vista o de filtro.
 *
 * Ocupa su lugar siempre y solo cambia de opacidad, para no mover el texto de al
 * lado al aparecer. El retraso de la transición evita el parpadeo cuando la
 * navegación es rápida: si termina antes de los 200 ms, nunca llega a verse.
 */
export function PuntoDeCarga({ className = '' }: { className?: string }) {
  const { pending } = useLinkStatus()
  return (
    <LoaderCircle
      aria-hidden
      className={`size-4 shrink-0 animate-spin transition-opacity delay-200 duration-150 ${
        pending ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    />
  )
}
