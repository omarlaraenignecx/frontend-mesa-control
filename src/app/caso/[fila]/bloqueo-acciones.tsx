'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { forzar, liberar } from './acciones'

export function BotonLiberar({ fila }: { fila: number }) {
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          await liberar(fila)
          router.push('/cola')
        })
      }
    >
      {pendiente ? 'Liberando…' : 'Liberar caso'}
    </Button>
  )
}

export function BotonForzar({ fila, dueno }: { fila: number; dueno: string }) {
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pendiente}
      title={`Quitarle el caso a ${dueno}. Queda registrado en la bitácora.`}
      onClick={() =>
        iniciar(async () => {
          await forzar(fila)
          router.refresh()
        })
      }
    >
      {pendiente ? 'Liberando…' : 'Forzar liberación'}
    </Button>
  )
}
