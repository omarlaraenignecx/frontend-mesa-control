'use client'

import { UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { atenderYo, type ResultadoGuardado } from './acciones'

/**
 * Marca de quién lleva el caso. Ya no hay bloqueo: cualquiera entra y modifica
 * cualquier caso, y esto es lo que evita que dos personas trabajen lo mismo sin
 * saberlo.
 *
 * Cuando el caso ya tiene otro responsable, el botón pide confirmación en línea
 * antes de reemplazar el nombre; quitárselo a alguien sin avisar sería peor que
 * el candado que se retiró.
 */
export function Atender({
  fila,
  quienAtiende,
  nombreUsuario,
}: {
  fila: number
  quienAtiende: string | null
  nombreUsuario: string | null
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()

  const responsable = quienAtiende?.trim() || null
  const loLlevoYo = Boolean(nombreUsuario && responsable === nombreUsuario.trim())
  const deOtro = Boolean(responsable && !loLlevoYo)

  function marcar() {
    setConfirmando(false)
    iniciar(async () => {
      const r = await atenderYo(fila)
      setResultado(r)
      if (r.ok) router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-base ${
          responsable
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
        }`}
      >
        <UserRound className="size-4" />
        {responsable ? `Atiende ${responsable}` : 'Sin asignar'}
      </span>

      {!loLlevoYo && !confirmando && (
        <Button
          size="sm"
          variant="outline"
          disabled={pendiente}
          onClick={() => (deOtro ? setConfirmando(true) : marcar())}
          title={
            nombreUsuario
              ? 'Escribe tu nombre en la columna de la hoja'
              : 'Tu cuenta no tiene nombre registrado en la hoja'
          }
        >
          {pendiente ? 'Marcando…' : 'Atender yo este caso'}
        </Button>
      )}

      {confirmando && (
        <span className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-base text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Lo atiende {responsable}. ¿Lo pasas a tu nombre?
          <Button size="sm" onClick={marcar} disabled={pendiente}>
            Sí, a mi nombre
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)}>
            No
          </Button>
        </span>
      )}

      {resultado && !resultado.ok && (
        <span className="text-base text-red-600">{resultado.error}</span>
      )}
    </div>
  )
}
