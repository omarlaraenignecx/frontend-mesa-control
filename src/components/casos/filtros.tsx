'use client'

import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { SIN_ESTATUS } from '@/lib/casos/cola'
import { moduloPorClave, type Modulo } from '@/lib/modulos/modulo'
import {
  alternarEstatus,
  alternarTodos,
  seleccionVisible,
  todosSeleccionados,
} from '@/lib/casos/seleccion-estatus'

type Opciones = {
  clases: string[]
  responsables: string[]
  estatus: string[]
}

const ETIQUETA_SIN_ESTATUS = 'Pendiente (sin estatus)'

const selectClase =
  'h-11 rounded-lg border border-input bg-card px-3 text-base shadow-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30'

/**
 * Filtro de varios valores a la vez. Es un panel con casillas y no un
 * `<select multiple>`: el nativo obliga a arrastrar o a usar Ctrl para elegir
 * más de uno, y la gente que trabaja aquí no tiene por qué saber eso.
 */
function FiltroEstatus({
  valores,
  seleccion,
  omision,
  onCambio,
}: {
  valores: string[]
  seleccion: string[]
  /** Cómo se llama la selección por omisión del módulo: "Pendientes", "Abiertos". */
  omision: string
  onCambio: (nueva: string[]) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function afuera(e: PointerEvent) {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', afuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', afuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  const todos = [...valores, SIN_ESTATUS]
  const visible = seleccionVisible(seleccion)
  const marcados = new Set(visible)
  const completo = todosSeleccionados(seleccion, todos)
  const etiquetaDe = (v: string) => (v === SIN_ESTATUS ? ETIQUETA_SIN_ESTATUS : v)
  const resumen = completo
    ? 'Todos'
    : seleccion.length === 0
      ? omision
      : seleccion.length <= 2
        ? seleccion.map(etiquetaDe).join(', ')
        : `${seleccion.length} seleccionados`

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className={`${selectClase} inline-flex items-center gap-2`}
      >
        <span className="text-muted-foreground">Estatus final:</span>
        <span className="font-medium">{resumen}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      {abierto && (
        <div className="absolute z-20 mt-1 min-w-64 space-y-1 rounded-lg border bg-card p-2 shadow-lg">
          <label className="flex items-center gap-2.5 rounded-md px-2 py-2 text-base font-medium hover:bg-secondary">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={completo}
              onChange={() => onCambio(alternarTodos(seleccion, todos))}
            />
            Seleccionar todos
          </label>

          <div className="my-1 border-t" />

          {todos.map((v) => (
            <label
              key={v}
              className="flex items-center gap-2.5 rounded-md px-2 py-2 text-base hover:bg-secondary"
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={marcados.has(v)}
                onChange={() => onCambio(alternarEstatus(seleccion, v))}
              />
              {etiquetaDe(v)}
            </label>
          ))}

          {seleccion.length > 0 && (
            <button
              type="button"
              onClick={() => onCambio([])}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-base text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Check className="size-4" />
              Volver a {omision.toLocaleLowerCase('es')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Recibe la clave del módulo y no su configuración: las funciones de
 * `ConfigModulo` no viajan del servidor al cliente.
 */
export function Filtros({ modulo, opciones }: { modulo: Modulo; opciones: Opciones }) {
  const { rutaLista, clasificacion, estatusPorOmision } = moduloPorClave(modulo)
  const router = useRouter()
  // Cambiar de filtro no cambia de ruta, solo los parámetros, y en ese caso
  // `loading.tsx` no se vuelve a mostrar: el aviso de aquí es la única señal de
  // que el clic se recibió.
  const [pendiente, iniciarTransicion] = useTransition()
  const params = useSearchParams()
  const [texto, setTexto] = useState(params.get('q') ?? '')

  function aplicar(cambios: Record<string, string>) {
    const nuevos = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v) nuevos.set(k, v)
      else nuevos.delete(k)
    }
    iniciarTransicion(() => {
      router.push(`${rutaLista}?${nuevos.toString()}`)
    })
  }

  const estatusElegidos = (params.get('estatus') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          aplicar({ q: texto })
        }}
      >
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Folio, solicitante, agencia…"
          className="h-11 w-72 bg-card text-base"
        />
      </form>

      <FiltroEstatus
        valores={opciones.estatus}
        seleccion={estatusElegidos}
        omision={estatusPorOmision.etiqueta}
        onCambio={(nueva) => aplicar({ estatus: nueva.join(',') })}
      />

      <select
        aria-label={clasificacion.filtro}
        className={selectClase}
        value={params.get(clasificacion.param) ?? ''}
        onChange={(e) => aplicar({ [clasificacion.param]: e.target.value })}
      >
        <option value="">{clasificacion.todos}</option>
        {opciones.clases.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrar por responsable"
        className={selectClase}
        value={params.get('responsable') ?? ''}
        onChange={(e) => aplicar({ responsable: e.target.value })}
      >
        <option value="">Cualquier responsable</option>
        {opciones.responsables.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      {['q', clasificacion.param, 'responsable', 'estatus'].some((k) => params.get(k)) && (
        <button
          type="button"
          onClick={() => {
            setTexto('')
            const vista = params.get('vista')
            iniciarTransicion(() => {
              router.push(vista ? `${rutaLista}?vista=${vista}` : rutaLista)
            })
          }}
          className="text-base text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Limpiar
        </button>
      )}

      {pendiente && (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          Filtrando…
        </span>
      )}
    </div>
  )
}
