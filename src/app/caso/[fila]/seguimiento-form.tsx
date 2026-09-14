'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Cambio, Seguimiento } from '@/lib/casos/seguimiento'
import { ETIQUETAS_SEGUIMIENTO, calcularDiff } from '@/lib/casos/seguimiento'
import type { Caso } from '@/lib/casos/caso'
import type { Catalogos } from '@/lib/google/sheet-catalogs'
import { notaDelGuardado, opcionesDeTramite } from '@/lib/casos/tramite'
import { guardarSeguimiento, type ResultadoGuardado } from './acciones'

type Props = {
  caso: Caso
  catalogos: Catalogos
  nombreUsuario: string | null
  /** Trámites que existen en la hoja, para el selector de corrección. */
  tramites: string[]
  /** Si en este caso se puede corregir el trámite; ver `lib/casos/tramite.ts`. */
  puedeCorregirTramite: boolean
  /** Por qué no se puede, cuando no se puede. */
  motivoSinCorreccion: string | null
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
  tramites,
  puedeCorregirTramite,
  motivoSinCorreccion,
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
    // Solo viaja si este caso admite corrección: si no, no debe entrar al diff ni
    // aunque alguien manipule el formulario.
    ...(puedeCorregirTramite ? { tipoTramite: caso.tipoTramite ?? '' } : {}),
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
    // lo que se va a escribir: corregir el trámite deja línea en observaciones
    // aunque quien atiende no haya escrito ninguna nota.
    const aAnotar = notaDelGuardado(caso, valores.tipoTramite, nota)
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

  const opcionesTramite = opcionesDeTramite(tramites, caso.tipoTramite)

  return (
    <div className="space-y-5">
      {/*
        El trámite va aparte de la rejilla y arriba de todo: es lo que clasifica el
        caso, y es el único campo de aquí que sobrescribe una respuesta del
        solicitante. Por eso lleva su propia explicación y no la opción de vaciarlo.
      */}
      <div className="space-y-1.5 rounded-xl border border-dashed p-4">
        <label className="block text-base font-medium text-muted-foreground" htmlFor="tipoTramite">
          {ETIQUETAS_SEGUIMIENTO.tipoTramite}
        </label>
        {puedeCorregirTramite ? (
          <>
            <select
              id="tipoTramite"
              className={selectClase}
              value={valores.tipoTramite ?? ''}
              onChange={(e) => cambiar('tipoTramite', e.target.value)}
            >
              {opcionesTramite.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">
              Corrige lo que eligió el solicitante cuando se equivocó de opción. Se sobrescribe en
              la hoja; el valor anterior queda en la bitácora del caso y en una línea de
              observaciones.
            </p>
          </>
        ) : (
          <>
            <p className="text-base">{caso.tipoTramite?.trim() || '—'}</p>
            <p className="text-sm text-muted-foreground">{motivoSinCorreccion}</p>
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
          {porConfirmar.some((c) => c.campo === 'tipoTramite') && (
            <p className="text-sm">
              El tipo de trámite es una respuesta del formulario: al guardarlo se sustituye lo que
              eligió el solicitante.
            </p>
          )}
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
