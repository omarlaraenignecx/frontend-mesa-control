'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'

type Opciones = {
  tiposTramite: string[]
  responsables: string[]
  estatus: string[]
}

export function Filtros({ opciones }: { opciones: Opciones }) {
  const router = useRouter()
  const params = useSearchParams()
  const [texto, setTexto] = useState(params.get('q') ?? '')

  function aplicar(cambios: Record<string, string>) {
    const nuevos = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v) nuevos.set(k, v)
      else nuevos.delete(k)
    }
    router.push(`/cola?${nuevos.toString()}`)
  }

  const selectClase =
    'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none'

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
          className="w-64"
        />
      </form>

      <select
        aria-label="Filtrar por trámite"
        className={selectClase}
        value={params.get('tramite') ?? ''}
        onChange={(e) => aplicar({ tramite: e.target.value })}
      >
        <option value="">Todos los trámites</option>
        {opciones.tiposTramite.map((t) => (
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

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={params.get('cerrados') === '1'}
          onChange={(e) => aplicar({ cerrados: e.target.checked ? '1' : '' })}
        />
        Incluir cerrados
      </label>

      {['q', 'tramite', 'responsable', 'cerrados'].some((k) => params.get(k)) && (
        <button
          type="button"
          onClick={() => {
            setTexto('')
            const vista = params.get('vista')
            router.push(vista ? `/cola?vista=${vista}` : '/cola')
          }}
          className="text-sm underline text-muted-foreground"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
