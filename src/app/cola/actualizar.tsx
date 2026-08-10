'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'

export function BotonActualizar({ accion }: { accion: () => Promise<void> }) {
  const [pendiente, iniciar] = useTransition()

  return (
    <Button variant="outline" size="sm" disabled={pendiente} onClick={() => iniciar(() => accion())}>
      {pendiente ? 'Actualizando…' : 'Actualizar'}
    </Button>
  )
}
