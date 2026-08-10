'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { capturarFolio } from './acciones'

/**
 * Un caso puede llegar sin folio: la columna JY se llena a mano en la hoja y a
 * veces la petición entra antes. El número lo teclea la persona; la aplicación
 * no genera folios por su cuenta.
 */
export function FolioForm({ fila }: { fila: number }) {
  const [folio, setFolio] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()

  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
      <p className="font-medium">Esta petición llegó sin folio</p>
      <p className="text-muted-foreground">
        Captúralo para poder identificar el caso ante la agencia. Se escribirá en la hoja.
      </p>
      <div className="flex gap-2">
        <Input
          value={folio}
          onChange={(e) => {
            setFolio(e.target.value)
            setError(null)
          }}
          placeholder="Ej. 7010"
          className="w-40"
        />
        <Button
          size="sm"
          disabled={pendiente || !folio.trim()}
          onClick={() =>
            iniciar(async () => {
              const r = await capturarFolio(fila, folio)
              if (r.ok) router.refresh()
              else setError(r.error)
            })
          }
        >
          {pendiente ? 'Guardando…' : 'Guardar folio'}
        </Button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  )
}
