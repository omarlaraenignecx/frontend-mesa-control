'use client'

import { LoaderCircle, TicketPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { generarFolios } from '@/app/acciones-folios'
import { Button } from '@/components/ui/button'

/**
 * Aviso con el botón que llena los folios faltantes. Solo se dibuja cuando hay
 * algo que llenar: con la columna completa, la funcionalidad desaparece de la
 * interfaz en lugar de quedarse ahí sin efecto.
 */
export function GenerarFolios({ faltantes }: { faltantes: number }) {
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()

  if (faltantes === 0) return null

  const plural = faltantes === 1 ? 'petición' : 'peticiones'

  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-medium">
            {faltantes} {plural} sin folio de atención
          </p>
          <p className="text-sm text-muted-foreground">
            El folio continúa la serie desde el número más alto de la hoja, en orden de llegada. Se
            escribe en la columna de folio de cada registro.
          </p>
        </div>
        <Button
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              setError(null)
              const r = await generarFolios()
              if (r.ok) router.refresh()
              else setError(r.error)
            })
          }
        >
          {pendiente ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <TicketPlus className="size-4" />
          )}
          {pendiente ? 'Generando…' : `Generar ${faltantes === 1 ? 'el folio' : 'los folios'}`}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
