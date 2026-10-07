'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Cambio, Seguimiento } from '@/lib/casos/seguimiento'
import { ETIQUETAS_SEGUIMIENTO, calcularDiff } from '@/lib/casos/seguimiento'
import type { Caso } from '@/lib/casos/caso'
import type { Catalogos } from '@/lib/google/sheet-catalogs'
import { notaDelGuardado, opcionesDeReclasificacion } from '@/lib/casos/reclasificacion'
import { guardarSeguimiento, type ResultadoGuardado } from './acciones'

type Props = {
  caso: Caso
  catalogos: Catalogos
  nombreUsuario: string | null
  /** Si en este caso se puede reclasificar; ver `lib/casos/reclasificacion.ts`. */
  puedeReclasificar: boolean
}

const CAMPOS_SELECT = [
  'estatusInicial',
  'estatusFinal',
  'quienAtendio',
  'aseguradoraSeguimiento',
  'teniaPermisos',
  'causaSeguimiento',
] as const

export function SeguimientoForm({
  caso,
  catalogos,
  nombreUsuario,
  puedeReclasificar,
}: Props) {
  // El responsable llega precargado con quien está trabajando, y es editable.
  const [valores, setValores] = useState<Seguimiento>({
    estatusInicial: caso.estatusInicial ?? '',
    estatusFinal: caso.estatusFinal ?? '',
    quienAtendio: caso.quienAtendio ?? nombreUsuario ?? '',
    aseguradoraSeguimiento: caso.aseguradoraSeguimiento ?? '',
    teniaPermisos: caso.teniaPermisos ?? '',
    causaSeguimiento: caso.causaSeguimiento ?? '',
    folioInterno: caso.folioInterno ?? '',
    // Solo viaja si este caso admite reclasificación: si no, no debe entrar al
    // diff ni aunque alguien manipule el formulario.
    ...(puedeReclasificar ? { reclasificacion: caso.reclasificacion ?? '' } : {}),
  })
  const [nota, setNota] = useState('')
  const [porConfirmar, setPorConfirmar] = useState<Cambio[] | null>(null)
  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()

  function cambiar(campo: keyof Seguimiento, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setResultado(null)
  }

  function revisar() {
    const propuesto: Seguimiento = { ...valores }
    // La misma función que usa el servidor, para que el panel anuncie exactamente
    // lo que se va a escribir: reclasificar deja línea en observaciones aunque
    // quien atiende no haya escrito ninguna nota.
    const aAnotar = notaDelGuardado(caso, valores.reclasificacion, nota)
    if (aAnotar) {
      // El diff solo necesita saber que las observaciones cambian; el texto
      // definitivo lo compone el servidor para no perder lo ya escrito.
      propuesto.observaciones = `${aAnotar}\n${caso.observaciones ?? ''}`.trim()
    }
    const cambios = calcularDiff(caso, propuesto)
    if (cambios.length === 0) {
      setResultado({ ok: true, cambios: 0 })
      return
    }
    setPorConfirmar(cambios)
  }

  function confirmar() {
    iniciar(async () => {
      const sinObservaciones = { ...valores }
      delete sinObservaciones.observaciones
      const r = await guardarSeguimiento(caso.fila, sinObservaciones, nota)
      setResultado(r)
      setPorConfirmar(null)
      if (r.ok) {
        setNota('')
        router.refresh()
      }
    })
  }

  const selectClase =
    'h-11 w-full rounded-lg border border-input bg-background px-3 text-base shadow-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30'

  const opcionesReclasificacion = opcionesDeReclasificacion(caso.reclasificacion)

  return (
    <div className="space-y-5">
      {/*
        La reclasificación va aparte de la rejilla y arriba de todo porque es lo
        que clasifica el caso. Muestra al lado lo que pidió el solicitante, que no
        se toca: es su registro, y la comparación entre los dos es justo el dato.
      */}
      <div className="space-y-1.5 rounded-xl border border-dashed p-4">
        <label
          className="block text-base font-medium text-muted-foreground"
          htmlFor="reclasificacion"
        >
          {ETIQUETAS_SEGUIMIENTO.reclasificacion}
        </label>
        <p className="text-sm text-muted-foreground">
          El solicitante pidió:{' '}
          <span className="text-foreground">{caso.tipoTramite?.trim() || '—'}</span>
        </p>
        {puedeReclasificar && (
          <>
            <select
              id="reclasificacion"
              className={selectClase}
              value={valores.reclasificacion ?? ''}
              onChange={(e) => cambiar('reclasificacion', e.target.value)}
            >
              <option value="">Sin reclasificar</option>
              {opcionesReclasificacion.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">
              Úsalo cuando el solicitante se equivocó de opción. Se escribe en la columna
              Reclasificación de la hoja, sin tocar lo que él eligió; el cambio queda en la
              bitácora del caso y en una línea de observaciones.
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_SELECT.map((campo) => {
          const opciones = catalogos[campo]
          return (
            <label key={campo} className="space-y-1.5">
              <span className="block text-base font-medium text-muted-foreground">
                {ETIQUETAS_SEGUIMIENTO[campo]}
              </span>
              {opciones ? (
                <select
                  className={selectClase}
                  value={valores[campo] ?? ''}
                  onChange={(e) => cambiar(campo, e.target.value)}
                >
                  <option value="">— sin valor —</option>
                  {opciones.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className="h-11 text-base"
                  value={valores[campo] ?? ''}
                  onChange={(e) => cambiar(campo, e.target.value)}
                />
              )}
            </label>
          )
        })}

        <label className="space-y-1.5">
          <span className="block text-base font-medium text-muted-foreground">
            {ETIQUETAS_SEGUIMIENTO.folioInterno}
          </span>
          <Input
            className="h-11 text-base"
            value={valores.folioInterno ?? ''}
            onChange={(e) => cambiar('folioInterno', e.target.value)}
            placeholder="Folio que generó la aseguradora"
          />
        </label>
      </div>

      <div className="space-y-1">
        <label className="block text-base font-medium text-muted-foreground" htmlFor="nota">
          Agregar una observación
        </label>
        <textarea
          id="nota"
          value={nota}
          onChange={(e) => {
            setNota(e.target.value)
            setResultado(null)
          }}
          rows={3}
          className="w-full rounded-lg border border-input bg-background p-3 text-base leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
          placeholder="Qué hiciste, qué falta, con quién quedó…"
        />
        <p className="text-sm text-muted-foreground">
          Tu nota se agrega arriba con tu nombre y la fecha. Nada de lo anterior se borra.
        </p>
      </div>

      {porConfirmar && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-base shadow-sm dark:border-amber-900 dark:bg-amber-950">
          <p className="font-medium">
            Vas a guardar {porConfirmar.length} {porConfirmar.length === 1 ? 'cambio' : 'cambios'} en
            la hoja:
          </p>
          <ul className="space-y-1">
            {porConfirmar.map((c) => (
              <li key={c.campo}>
                <span className="text-muted-foreground">{c.etiqueta}:</span>{' '}
                <span className="line-through opacity-60">{c.anterior ?? '(vacío)'}</span>{' '}
                <span aria-hidden>→</span> <strong>{c.nuevo || '(vacío)'}</strong>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button onClick={confirmar} disabled={pendiente}>
              {pendiente ? 'Guardando…' : 'Confirmar y guardar'}
            </Button>
            <Button variant="outline" onClick={() => setPorConfirmar(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!porConfirmar && (
        <Button size="lg" className="text-base" onClick={revisar} disabled={pendiente}>
          Guardar cambios
        </Button>
      )}

      {resultado?.ok && resultado.cambios === 0 && (
        <p className="text-base text-muted-foreground">No hay cambios que guardar.</p>
      )}
      {resultado?.ok && resultado.cambios > 0 && (
        <p className="text-base font-medium text-emerald-600">
          Guardado en la hoja: {resultado.cambios}{' '}
          {resultado.cambios === 1 ? 'campo' : 'campos'}.
        </p>
      )}
      {resultado?.ok && resultado.aviso && (
        <p className="text-base text-amber-700 dark:text-amber-400">{resultado.aviso}</p>
      )}
      {resultado && !resultado.ok && (
        <div className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-4 text-base shadow-sm dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-700 dark:text-red-300">
            {resultado.conflicto ? 'No se guardó: el registro cambió' : 'No se pudo guardar'}
          </p>
          <p className="text-muted-foreground">{resultado.error}</p>
          <p className="text-muted-foreground">
            Lo que capturaste sigue aquí. Puedes reintentar sin volver a escribirlo.
          </p>
          <Button size="sm" variant="outline" onClick={confirmar} disabled={pendiente}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}
