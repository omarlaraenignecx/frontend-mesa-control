'use client'

import { Forward, Paperclip, X } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ResumenDeCadena } from '@/lib/correo/cadena'
import { LIMITE_GMAIL_BYTES } from '@/lib/correo/mime'
import { reenviarCadena, type ResultadoReenvio } from './acciones-correo'

const enMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)

/** Clave con la que viaja cada archivo: su mensaje y la posición que ocupa. */
const claveDe = (a: { mensajeId: string; indice: number }) => `${a.mensajeId}:${a.indice}`

export function ReenviarCadena({
  fila,
  folio,
  resumen,
}: {
  fila: number
  folio: string
  resumen: ResumenDeCadena
}) {
  const [abierto, setAbierto] = useState(false)
  const [para, setPara] = useState('')
  const [copias, setCopias] = useState('')
  const [nota, setNota] = useState('')
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(resumen.adjuntos.map(claveDe)),
  )
  const [resultado, setResultado] = useState<ResultadoReenvio | null>(null)
  const [pendiente, iniciar] = useTransition()
  const primerCampo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!abierto) return
    primerCampo.current?.focus()
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pendiente) setAbierto(false)
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [abierto, pendiente])

  const elegidos = resumen.adjuntos.filter((a) => marcados.has(claveDe(a)))
  const pesoEstimado = elegidos.reduce((t, a) => t + Math.ceil(a.bytes / 3) * 4, 0)
  const excede = pesoEstimado > LIMITE_GMAIL_BYTES

  function alternar(clave: string) {
    setMarcados((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(clave)) nuevo.delete(clave)
      else nuevo.add(clave)
      return nuevo
    })
    setResultado(null)
  }

  function enviar() {
    iniciar(async () => {
      const datos = new FormData()
      datos.set('para', para)
      datos.set('copias', copias)
      datos.set('nota', nota)
      for (const a of elegidos) datos.append('adjuntos', claveDe(a))

      const r = await reenviarCadena(fila, datos)
      setResultado(r)
      if (r.ok) {
        setPara('')
        setCopias('')
        setNota('')
      }
    })
  }

  if (!abierto) {
    return (
      <>
        <Button variant="outline" className="text-base" onClick={() => setAbierto(true)}>
          <Forward className="mr-1.5 size-4" />
          Reenviar cadena
        </Button>
        {resultado?.ok && (
          <span className="text-base font-medium text-emerald-600">
            Conversación reenviada a {resultado.destinatarios.join(', ')}.
          </span>
        )}
      </>
    )
  }

  return (
    <>
      <Button variant="outline" className="text-base" disabled>
        <Forward className="mr-1.5 size-4" />
        Reenviar cadena
      </Button>

      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
        onClick={(e) => {
          if (e.target === e.currentTarget && !pendiente) setAbierto(false)
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-reenvio"
          className="w-full max-w-xl space-y-4 rounded-2xl border bg-card p-6 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 id="titulo-reenvio" className="text-xl font-semibold">
                Compartir la conversación
              </h2>
              <p className="text-base text-muted-foreground">
                Se enviará la conversación completa del caso {folio}:{' '}
                <strong className="text-foreground">
                  {resumen.mensajes} {resumen.mensajes === 1 ? 'mensaje' : 'mensajes'}
                </strong>{' '}
                y{' '}
                <strong className="text-foreground">
                  {elegidos.length} de {resumen.adjuntos.length}{' '}
                  {resumen.adjuntos.length === 1 ? 'archivo' : 'archivos'}
                </strong>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              disabled={pendiente}
              aria-label="Cerrar"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reenvio-para" className="block text-base font-medium">
              Para
            </label>
            <Input
              id="reenvio-para"
              ref={primerCampo}
              value={para}
              onChange={(e) => {
                setPara(e.target.value)
                setResultado(null)
              }}
              placeholder="correo@empresa.mx"
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reenvio-cc" className="block text-base font-medium">
              Copia (opcional)
            </label>
            <Input
              id="reenvio-cc"
              value={copias}
              onChange={(e) => {
                setCopias(e.target.value)
                setResultado(null)
              }}
              placeholder="Separa varios correos con coma"
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reenvio-nota" className="block text-base font-medium">
              Nota para quien la recibe (opcional)
            </label>
            <textarea
              id="reenvio-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-background p-3 text-base leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder="Por qué le estás compartiendo este caso…"
            />
          </div>

          {resumen.adjuntos.length > 0 && (
            <div className="space-y-2">
              <p className="text-base font-medium">
                Archivos de la conversación
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {enMb(pesoEstimado)} MB al enviarse
                </span>
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {resumen.adjuntos.map((a) => (
                  <li key={claveDe(a)}>
                    <label className="flex items-center gap-2.5 rounded-lg bg-secondary/50 px-2.5 py-2 text-base">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={marcados.has(claveDe(a))}
                        onChange={() => alternar(claveDe(a))}
                      />
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">{a.nombre}</span>
                      <span className="ml-auto shrink-0 text-sm text-muted-foreground">
                        {enMb(a.bytes)} MB
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {excede && (
                <p className="text-base text-red-600">
                  Los archivos marcados pesan {enMb(pesoEstimado)} MB y Gmail acepta hasta{' '}
                  {enMb(LIMITE_GMAIL_BYTES)} MB. Desmarca alguno para poder enviar.
                </p>
              )}
            </div>
          )}

          {resultado && !resultado.ok && (
            <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-base text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {resultado.error}
            </p>
          )}
          {resultado?.ok && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-base text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              Conversación reenviada a {resultado.destinatarios.join(', ')}: {resultado.mensajes}{' '}
              mensajes y {resultado.adjuntos} archivos.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              className="text-base"
              onClick={enviar}
              disabled={pendiente || excede || !para.trim()}
            >
              <Forward className="mr-1.5 size-4" />
              {pendiente ? 'Enviando…' : 'Reenviar conversación'}
            </Button>
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={pendiente}>
              {resultado?.ok ? 'Cerrar' : 'Cancelar'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
