'use client'

import { Eye, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import type { Plantilla } from '@/lib/correo/plantillas'
import { guardarPlantillaAccion, type ResultadoPlantilla } from './acciones-plantillas'

const VARIABLES = ['solicitante', 'folio', 'agencia', 'tramite', 'atiende'] as const

const EJEMPLO = {
  solicitante: 'Ricardo Hernandez',
  folio: '7000',
  agencia: 'CHEVROLET CAMPESTRE',
  tramite: 'Emisión',
  atiende: 'Keynor Rivas',
}

function conEjemplo(texto: string): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (todo, nombre: string) => {
    const valor = (EJEMPLO as Record<string, string | undefined>)[nombre]
    return valor ?? todo
  })
}

export function AdminPlantillas({ plantillas }: { plantillas: Plantilla[] }) {
  const [activa, setActiva] = useState(plantillas[0]?.tipoTramite ?? '')
  const [cuerpos, setCuerpos] = useState<Record<string, string>>(
    Object.fromEntries(plantillas.map((p) => [p.tipoTramite, p.cuerpo])),
  )
  const [vistaPrevia, setVistaPrevia] = useState(false)
  const [resultado, setResultado] = useState<ResultadoPlantilla | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()

  const plantilla = plantillas.find((p) => p.tipoTramite === activa)
  const cuerpo = cuerpos[activa] ?? ''
  const sinGuardar = plantilla ? cuerpo !== plantilla.cuerpo : false

  return (
    <div className="space-y-4">
      <p className="text-base text-muted-foreground">
        El texto que la mesa envía al abrir un caso, según su tipo de trámite. Se puede editar aquí
        sin esperar un despliegue. Variables disponibles:{' '}
        {VARIABLES.map((v) => (
          <code key={v} className="mx-0.5 rounded bg-secondary px-1.5 py-0.5 text-sm">
            {`{{${v}}}`}
          </code>
        ))}
      </p>

      <div className="flex flex-wrap gap-2">
        {plantillas.map((p) => (
          <button
            key={p.tipoTramite}
            type="button"
            onClick={() => {
              setActiva(p.tipoTramite)
              setResultado(null)
            }}
            className={`rounded-lg border px-3 py-2 text-base transition-colors ${
              p.tipoTramite === activa
                ? 'border-primary/30 bg-primary/10 font-medium text-primary'
                : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.tipoTramite}
            {cuerpos[p.tipoTramite] !== p.cuerpo && <span className="ml-1.5 text-amber-600">•</span>}
          </button>
        ))}
      </div>

      {plantilla && (
        <div className="space-y-3">
          {vistaPrevia ? (
            <div className="rounded-lg border bg-secondary/30 p-4">
              <p className="mb-2 text-sm text-muted-foreground">
                Así se lee con datos de ejemplo:
              </p>
              <p className="text-base leading-relaxed whitespace-pre-line">{conEjemplo(cuerpo)}</p>
            </div>
          ) : (
            <textarea
              value={cuerpo}
              onChange={(e) => {
                setCuerpos((prev) => ({ ...prev, [activa]: e.target.value }))
                setResultado(null)
              }}
              rows={12}
              className="w-full rounded-lg border border-input bg-background p-3 text-base leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={pendiente || !sinGuardar}
              onClick={() =>
                iniciar(async () => {
                  const r = await guardarPlantillaAccion(activa, cuerpo)
                  setResultado(r)
                  if (r.ok) router.refresh()
                })
              }
            >
              <Save className="mr-1.5 size-4" />
              {pendiente ? 'Guardando…' : 'Guardar plantilla'}
            </Button>
            <Button variant="outline" onClick={() => setVistaPrevia(!vistaPrevia)}>
              <Eye className="mr-1.5 size-4" />
              {vistaPrevia ? 'Editar' : 'Vista previa'}
            </Button>
            {plantilla.actualizadaPor && (
              <span className="text-sm text-muted-foreground">
                Última edición: {plantilla.actualizadaPor.split('@')[0]} ·{' '}
                {plantilla.actualizadaEn.toLocaleDateString('es-MX')}
              </span>
            )}
          </div>

          {resultado?.ok && (
            <p className="text-base font-medium text-emerald-600">Plantilla guardada.</p>
          )}
          {resultado && !resultado.ok && (
            <p className="text-base text-red-600">{resultado.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
