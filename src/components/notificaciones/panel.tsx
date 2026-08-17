'use client'

import { FilePlus2, Mail, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { partesDeLaMesa } from '@/lib/reloj'
import type { Notificacion } from '@/lib/notificaciones/tipos'
import { useNotificaciones } from './proveedor'

/**
 * Cuándo llegó, en el reloj de la mesa.
 *
 * Hora absoluta y no "hace 20 minutos": lo relativo exige leer `Date.now()` en el
 * render, que React prohíbe por impuro —el texto cambiaría solo porque el
 * componente se volvió a dibujar—, y en una bandeja de trabajo la hora sirve más,
 * porque es la que se compara contra la hoja y contra el correo.
 */
function cuando(iso: string): string {
  const { dia, mes, horas, minutos } = partesDeLaMesa(new Date(iso))
  return `${dia}/${mes} ${horas}:${String(minutos).padStart(2, '0')}`
}

function Icono({ tipo }: { tipo: Notificacion['tipo'] }) {
  const Componente = tipo === 'correo_recibido' ? Mail : FilePlus2
  return (
    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      <Componente className="size-4" />
    </span>
  )
}

/**
 * Barra lateral sobrepuesta, no un desplegable: los avisos traen dos líneas de
 * texto cada uno y en un menú angosto no se leen.
 *
 * Al entrar a un caso desde aquí, ese aviso se marca leído. No se marcan todos: el
 * resto sigue pendiente porque nadie los ha visto.
 */
export function PanelNotificaciones({ cerrar }: { cerrar: () => void }) {
  const { noLeidas, marcarLeidas } = useNotificaciones()

  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [cerrar])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* El fondo cierra al hacer clic; queda tras el panel, nunca encima. */}
      <button
        type="button"
        aria-label="Cerrar notificaciones"
        onClick={cerrar}
        className="absolute inset-0 bg-black/30"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col border-l bg-card shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Notificaciones</h2>
            <p className="text-sm text-muted-foreground">
              {noLeidas.length === 0
                ? 'Nada pendiente'
                : `${noLeidas.length} sin leer`}
            </p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        {noLeidas.length > 0 && (
          <div className="border-b px-5 py-2.5">
            <button
              type="button"
              onClick={() => void marcarLeidas(noLeidas.map((n) => n.id))}
              className="text-base text-blue-600 underline underline-offset-4 transition-colors hover:text-blue-700 dark:text-blue-400"
            >
              Marcar todas como leídas
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {noLeidas.length === 0 && (
            <p className="px-5 py-10 text-center text-base text-muted-foreground">
              No hay notificaciones pendientes.
            </p>
          )}

          <ul className="divide-y">
            {noLeidas.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/caso/${n.fila}`}
                  prefetch={false}
                  onClick={() => {
                    void marcarLeidas([n.id])
                    cerrar()
                  }}
                  className="flex gap-3 px-5 py-4 transition-colors hover:bg-secondary/60"
                >
                  <Icono tipo={n.tipo} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium">{n.titulo}</span>
                    {n.detalle && (
                      <span className="block truncate text-base text-muted-foreground">
                        {n.detalle}
                      </span>
                    )}
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {n.folio ? `Folio ${n.folio}` : 'Sin folio'} · {cuando(n.creadoEnIso)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
