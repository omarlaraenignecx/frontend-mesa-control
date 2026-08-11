'use client'

import { Download, Paperclip, RefreshCw, Send, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EstadoHilo } from '@/lib/casos/hilo'
import { LIMITE_GMAIL_BYTES } from '@/lib/correo/mime'
import { enviarMensaje, refrescarConversacion, type ResultadoEnvio } from './acciones-correo'

type Props = {
  fila: number
  folio: string | null
  estado: EstadoHilo
  plantilla: string
  destinatario: string | null
  copiaSugerida: string | null
  casoCerrado: boolean
  bloqueado: boolean
}

const enMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)

function horaDe(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Conversacion({
  fila,
  folio,
  estado,
  plantilla,
  destinatario,
  copiaSugerida,
  casoCerrado,
  bloqueado,
}: Props) {
  const hayHilo = estado.estado === 'con-conversacion'
  const [cuerpo, setCuerpo] = useState(hayHilo ? '' : plantilla)
  const [copias, setCopias] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null)
  const [pendiente, iniciar] = useTransition()
  const inputArchivos = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const pesoCrudo = archivos.reduce((t, a) => t + a.size, 0)
  const pesoEstimado = Math.ceil(pesoCrudo / 3) * 4
  const excede = pesoEstimado > LIMITE_GMAIL_BYTES

  function enviar() {
    iniciar(async () => {
      const datos = new FormData()
      datos.set('cuerpo', cuerpo)
      datos.set('copias', copias)
      for (const a of archivos) datos.append('archivos', a)

      const r = await enviarMensaje(fila, datos)
      setResultado(r)
      if (r.ok) {
        setCuerpo('')
        setArchivos([])
        setCopias('')
        if (inputArchivos.current) inputArchivos.current.value = ''
        router.refresh()
      }
    })
  }

  if (!folio) {
    return (
      <p className="rounded-xl border border-dashed bg-secondary/30 p-4 text-base text-muted-foreground">
        Captura el folio del caso para poder escribirle a la agencia: el número identifica la
        conversación.
      </p>
    )
  }

  if (estado.estado === 'error') {
    return (
      <div className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-4 text-base dark:border-red-900 dark:bg-red-950">
        <p className="font-medium text-red-700 dark:text-red-300">
          No se pudo leer la conversación
        </p>
        <p className="text-muted-foreground">{estado.mensaje}</p>
        <Button
          variant="outline"
          size="sm"
          disabled={pendiente}
          onClick={() => iniciar(async () => { await refrescarConversacion(fila); router.refresh() })}
        >
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base text-muted-foreground">
          {hayHilo
            ? `${estado.hilo.mensajes.length} ${estado.hilo.mensajes.length === 1 ? 'mensaje' : 'mensajes'}`
            : 'Todavía no hay conversación con la agencia'}
        </p>
        {hayHilo && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pendiente}
            onClick={() => iniciar(async () => { await refrescarConversacion(fila); router.refresh() })}
          >
            <RefreshCw className="mr-1.5 size-4" />
            {pendiente ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
      </div>

      {casoCerrado && hayHilo && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-base text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Este caso está cerrado. Puedes responder igual; el estatus no cambia por sí solo.
        </p>
      )}

      {hayHilo && (
        <ol className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {estado.hilo.mensajes.map((m) => (
            <li key={m.id} className={m.deLaMesa ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] space-y-1.5 rounded-2xl px-4 py-3 text-base ${
                  m.deLaMesa
                    ? 'bg-primary/10 rounded-br-md'
                    : 'bg-secondary rounded-bl-md'
                }`}
              >
                <p className="text-sm text-muted-foreground">
                  {m.deLaMesa ? 'Mesa de Control' : m.autor} · {horaDe(m.fechaIso)}
                </p>
                <p className="leading-relaxed whitespace-pre-line">
                  {m.texto || <span className="text-muted-foreground">(sin texto)</span>}
                </p>
                {m.adjuntos.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {m.adjuntos.map((a) => (
                      <li key={a.id}>
                        <a
                          href={`/api/adjunto/${fila}/${m.id}/${a.id}`}
                          className="inline-flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm transition-colors hover:border-primary/40"
                        >
                          <Download className="size-3.5" />
                          {a.nombre}
                          <span className="text-muted-foreground">{enMb(a.bytes)} MB</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {bloqueado ? (
        <p className="rounded-xl border border-dashed bg-secondary/30 p-4 text-base text-muted-foreground">
          Otra persona tiene el caso abierto; no puedes escribir hasta que lo libere.
        </p>
      ) : (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium">Para:</span> {destinatario ?? '(sin correo)'}
            </p>
            {copiaSugerida && (
              <p>
                <span className="font-medium">Copia:</span> {copiaSugerida}
              </p>
            )}
            <p>
              <span className="font-medium">Asunto:</span> Seguimiento de Caso | Gplus Seguros |{' '}
              {folio}
            </p>
          </div>

          <textarea
            value={cuerpo}
            onChange={(e) => {
              setCuerpo(e.target.value)
              setResultado(null)
            }}
            rows={hayHilo ? 4 : 9}
            className="w-full rounded-lg border border-input bg-background p-3 text-base leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
            placeholder={hayHilo ? 'Escribe tu respuesta…' : 'Mensaje de apertura del caso…'}
          />

          <Input
            value={copias}
            onChange={(e) => setCopias(e.target.value)}
            placeholder="Agregar copias (opcional, separadas por coma)"
            className="h-11 text-base"
          />

          {archivos.length > 0 && (
            <ul className="space-y-1">
              {archivos.map((a, i) => (
                <li
                  key={`${a.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-sm"
                >
                  <Paperclip className="size-3.5 shrink-0" />
                  <span className="truncate">{a.name}</span>
                  <span className="text-muted-foreground">{enMb(a.size)} MB</span>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Quitar ${a.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {excede && (
            <p className="text-base text-red-600">
              Los archivos pesan {enMb(pesoEstimado)} MB al enviarse y Gmail acepta hasta{' '}
              {enMb(LIMITE_GMAIL_BYTES)} MB. Quita o comprime alguno.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputArchivos}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setArchivos([...archivos, ...Array.from(e.target.files ?? [])])}
            />
            <Button variant="outline" onClick={() => inputArchivos.current?.click()}>
              <Paperclip className="mr-1.5 size-4" />
              Adjuntar
            </Button>
            <Button
              className="text-base"
              disabled={pendiente || excede || !cuerpo.trim()}
              onClick={enviar}
            >
              <Send className="mr-1.5 size-4" />
              {pendiente ? 'Enviando…' : hayHilo ? 'Responder' : 'Abrir conversación'}
            </Button>
            {!hayHilo && (
              <Badge variant="outline" className="text-sm font-normal">
                Sella la fecha de respuesta en la hoja
              </Badge>
            )}
          </div>

          {resultado?.ok && (
            <p className="text-base font-medium text-emerald-600">Correo enviado.</p>
          )}
          {resultado && !resultado.ok && (
            <p className="text-base text-red-600">{resultado.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
