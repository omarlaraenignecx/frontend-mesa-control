'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Notificacion, Sondeo } from '@/lib/notificaciones/tipos'

/**
 * Un solo sondeo por página.
 *
 * Vive en contexto porque tres cosas distintas de la misma pantalla necesitan lo
 * mismo —la campanita, las insignias de la tabla y el aviso del chat— y no tiene
 * sentido que cada una interrogue al servidor por su cuenta.
 *
 * Se detiene con la pestaña oculta: el sondeo existe para quien está mirando, y
 * una pestaña olvidada toda la noche son 960 peticiones que nadie lee. Al volver a
 * ella se consulta de inmediato, así que el costo de la pausa es cero.
 */
const INTERVALO_MS = 30_000

const VACIO: Sondeo = { maxId: 0, noLeidas: [], correosPorFila: {} }

type Contexto = Sondeo & {
  marcarLeidas: (ids: number[]) => Promise<void>
  marcarLeidasDeFila: (fila: number) => Promise<void>
  recargar: () => Promise<void>
  /** Se suscribe a lo que llegue nuevo. Devuelve la función para darse de baja. */
  alLlegar: (escucha: (nuevas: Notificacion[]) => void) => () => void
}

const ctx = createContext<Contexto | null>(null)

export function useNotificaciones(): Contexto {
  const valor = useContext(ctx)
  if (!valor) throw new Error('useNotificaciones necesita ProveedorNotificaciones arriba.')
  return valor
}

export function ProveedorNotificaciones({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Sondeo>(VACIO)
  const conocidas = useRef<Set<number>>(new Set())
  const escuchas = useRef<Set<(nuevas: Notificacion[]) => void>>(new Set())
  const primeraVez = useRef(true)
  const detenido = useRef(false)

  const recargar = useCallback(async () => {
    if (detenido.current) return

    let datos: Sondeo
    try {
      const r = await fetch('/api/notificaciones', { cache: 'no-store' })
      // La sesión venció o se cerró: insistir cada 30 segundos no la recupera.
      if (r.status === 401 || r.status === 403) {
        detenido.current = true
        return
      }
      if (!r.ok) return
      datos = (await r.json()) as Sondeo
    } catch {
      return // un fallo de red no debe romper la pantalla; se reintenta al rato
    }

    const nuevas = datos.noLeidas.filter((n) => !conocidas.current.has(n.id))
    for (const n of datos.noLeidas) conocidas.current.add(n.id)
    setEstado(datos)

    // En la primera carga todo es "desconocido" y no se dispara nada: lo que ya
    // estaba pendiente no es un evento que acabe de ocurrir, y refrescar la tabla
    // por eso sería un salto sin motivo al entrar.
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    if (nuevas.length > 0) for (const escucha of escuchas.current) escucha(nuevas)
  }, [])

  useEffect(() => {
    // En microtarea y no en el cuerpo del efecto: `recargar` termina en un
    // `setState` y llamarla aquí de frente encadena un render extra en cada
    // montaje (lo marca `react-hooks/set-state-in-effect`). El estado igual se
    // actualiza cuando responde el servidor, no ahora.
    queueMicrotask(() => void recargar())

    const reloj = setInterval(() => {
      if (!document.hidden) void recargar()
    }, INTERVALO_MS)
    const alVolver = () => {
      if (!document.hidden) void recargar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [recargar])

  const marcar = useCallback(
    async (cuerpo: { ids?: number[]; fila?: number }) => {
      await fetch('/api/notificaciones/leidas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      await recargar()
    },
    [recargar],
  )

  const alLlegar = useCallback((escucha: (nuevas: Notificacion[]) => void) => {
    escuchas.current.add(escucha)
    return () => {
      escuchas.current.delete(escucha)
    }
  }, [])

  return (
    <ctx.Provider
      value={{
        ...estado,
        recargar,
        alLlegar,
        marcarLeidas: (ids) => marcar({ ids }),
        marcarLeidasDeFila: (fila) => marcar({ fila }),
      }}
    >
      {children}
    </ctx.Provider>
  )
}
