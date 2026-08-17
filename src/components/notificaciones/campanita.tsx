'use client'

import { Bell } from 'lucide-react'
import { useState } from 'react'
import { PanelNotificaciones } from './panel'
import { useNotificaciones } from './proveedor'

/**
 * Campanita al lado del botón Actualizar. El punto azul aparece solo cuando hay
 * avisos sin leer **por este usuario**: que Keynor lea los suyos no le apaga el
 * punto a Paty.
 */
export function Campanita() {
  const { noLeidas } = useNotificaciones()
  const [abierto, setAbierto] = useState(false)
  const hay = noLeidas.length > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={hay ? `Notificaciones: ${noLeidas.length} sin leer` : 'Notificaciones'}
        title={hay ? `${noLeidas.length} sin leer` : 'Sin notificaciones pendientes'}
        className="relative inline-flex size-11 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-xs transition-colors hover:text-foreground"
      >
        <Bell className="size-5" />
        {hay && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-blue-600 ring-2 ring-card"
          />
        )}
      </button>
      {abierto && <PanelNotificaciones cerrar={() => setAbierto(false)} />}
    </>
  )
}
