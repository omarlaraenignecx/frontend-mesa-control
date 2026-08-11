import {
  ArrowLeft,
  ClipboardList,
  History,
  Mail,
  MessageSquareText,
  Paperclip,
  UserRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requerirUsuario } from '@/lib/auth/guard'
import { cargarHilo } from '@/lib/casos/hilo'
import { leerPlantilla } from '@/lib/correo/plantillas'
import { sustituirVariables } from '@/lib/correo/render-correo'
import { estaVivo } from '@/lib/casos/caso'
import { leerBitacora } from '@/lib/casos/bitacora'
import { adquirirBloqueo } from '@/lib/casos/bloqueo'
import { agruparCamposExtra } from '@/lib/casos/campos-extra'
import { sinFolio } from '@/lib/casos/caso'
import { Conversacion } from './conversacion'
import { cargarCaso } from '@/lib/casos/consulta'
import { emitirEvento } from '@/lib/casos/eventos'
import { diasDeEspera, semaforoDe } from '@/lib/casos/semaforo'
import { BotonForzar, BotonLiberar } from './bloqueo-acciones'
import { FolioForm } from './folio-form'
import { SeguimientoForm } from './seguimiento-form'

const SEMAFORO = {
  verde: { punto: 'bg-emerald-500', texto: 'text-emerald-700 dark:text-emerald-400', etiqueta: 'En tiempo' },
  ambar: { punto: 'bg-amber-500', texto: 'text-amber-700 dark:text-amber-400', etiqueta: 'Por vencer' },
  rojo: { punto: 'bg-red-500', texto: 'text-red-700 dark:text-red-400', etiqueta: 'Atrasado' },
} as const

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-base font-medium text-muted-foreground">{etiqueta}</dt>
      <dd className="text-base leading-relaxed break-words whitespace-pre-line">{valor}</dd>
    </div>
  )
}

export default async function CasoPage({ params }: { params: Promise<{ fila: string }> }) {
  const usuario = await requerirUsuario()
  const { fila: filaTexto } = await params
  const fila = Number(filaTexto)

  if (!Number.isInteger(fila) || fila < 2) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <h1 className="text-2xl font-semibold">Caso no válido</h1>
        <a href="/cola" className="text-base text-primary underline">
          Volver a la cola
        </a>
      </main>
    )
  }

  const cargado = await cargarCaso(fila)
  if (!cargado) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <h1 className="text-2xl font-semibold">Ese caso no está en la hoja</h1>
        <p className="text-base text-muted-foreground">
          Puede que la fila {fila} sea anterior a 2026 o que no tenga fecha de recepción.
        </p>
        <a href="/cola" className="text-base text-primary underline">
          Volver a la cola
        </a>
      </main>
    )
  }

  const { caso, catalogos } = cargado
  const bloqueo = await adquirirBloqueo(fila, usuario.correo)
  const bloqueadoPorOtro = !bloqueo.ok

  await emitirEvento({
    tipo: 'caso_visualizado',
    fila,
    folio: caso.folio,
    tipoTramite: caso.tipoTramite,
    correoUsuario: usuario.correo,
  })
  if (bloqueo.ok) {
    await emitirEvento({
      tipo: 'caso_tomado',
      fila,
      folio: caso.folio,
      tipoTramite: caso.tipoTramite,
      correoUsuario: usuario.correo,
    })
  }

  // El hilo y la plantilla se piden en paralelo: son dos servicios distintos y
  // ninguno depende del otro.
  const [estadoHilo, plantillaCruda] = await Promise.all([
    cargarHilo(fila, caso.folio),
    leerPlantilla(caso.tipoTramite),
  ])
  const plantilla = sustituirVariables(plantillaCruda, {
    solicitante: caso.nombreSolicitante ?? '',
    folio: caso.folio ?? '',
    agencia: caso.agencia ?? '',
    tramite: caso.tipoTramite ?? '',
    atiende: usuario.nombreEnHoja ?? usuario.correo,
  })

  const hoy = new Date()
  const nivel = semaforoDe(caso, hoy)
  const dias = diasDeEspera(caso, hoy)
  const bitacora = await leerBitacora(fila)
  const extras = agruparCamposExtra(caso.camposExtra)

  // Solo los campos que traen dato (RF-03).
  const datos = (
    [
      ['Recibido', caso.marcaTemporalTexto],
      ['Tipo de trámite', caso.tipoTramite],
      ['Solicitante', caso.nombreSolicitante],
      ['Correo', caso.correoSolicitante],
      ['Agencia', caso.agencia],
      ['Tipo de negocio', caso.tipoNegocio],
      ['Cliente', caso.nombreCliente],
      ['Aseguradora declarada', caso.aseguradoraDeclarada],
      ['Motivo de la petición', caso.motivo],
    ] as [string, string | null][]
  )
    .filter((par): par is [string, string] => Boolean(par[1]))
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))

  return (
    <div className="min-h-full bg-background">
      {/* Encabezado del caso, pegado arriba para no perder la referencia al bajar */}
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-7xl space-y-3 px-6 py-4">
          <a
            href="/cola"
            className="inline-flex items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Cola de casos
          </a>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  Caso {caso.folio ?? <span className="text-muted-foreground">sin folio</span>}
                </h1>
                {caso.tipoTramite && (
                  <Badge variant="secondary" className="text-base">
                    {caso.tipoTramite}
                  </Badge>
                )}
                {nivel && (
                  <span className={`inline-flex items-center gap-2 text-base ${SEMAFORO[nivel].texto}`}>
                    <span className={`size-2.5 rounded-full ${SEMAFORO[nivel].punto}`} />
                    {SEMAFORO[nivel].etiqueta}
                    {dias !== null && ` · ${dias} días`}
                  </span>
                )}
              </div>
              <p className="text-base text-muted-foreground">
                Recibido {caso.marcaTemporalTexto} · fila {caso.fila}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {bloqueadoPorOtro ? (
                <>
                  <span className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <UserRound className="size-4" />
                    Lo tiene {bloqueo.bloqueo.correoDueno.split('@')[0]}
                  </span>
                  <BotonForzar fila={fila} dueno={bloqueo.bloqueo.correoDueno} />
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-base text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                    <UserRound className="size-4" />
                    Lo tienes tú
                  </span>
                  <BotonLiberar fila={fila} />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-6 py-6">
        {sinFolio(caso) && !bloqueadoPorOtro && <FolioForm fila={fila} />}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-xl">
                  <ClipboardList className="size-5 text-primary" />
                  Datos de la petición
                  <Badge variant="outline" className="ml-auto text-sm font-normal">
                    {datos.length + extras.length} con dato
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border/70">
                  {datos.map((d) => (
                    <Dato key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
                  ))}
                  {extras.map((d) => (
                    <Dato key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-xl">
                  <Paperclip className="size-5 text-primary" />
                  Adjuntos
                  <Badge variant="outline" className="ml-auto text-sm font-normal">
                    {caso.adjuntos.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {caso.adjuntos.length === 0 ? (
                  <p className="text-base text-muted-foreground">
                    Esta petición no trae archivos adjuntos.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {caso.adjuntos.map((a, i) => (
                      <li key={`${a.url}-${i}`}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-3 rounded-lg border bg-secondary/40 px-3 py-2.5 text-base transition-colors hover:border-primary/40 hover:bg-secondary"
                        >
                          <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <span className="underline-offset-2 group-hover:underline">
                            {a.etiqueta}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {caso.observaciones && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2.5 text-xl">
                    <MessageSquareText className="size-5 text-primary" />
                    Observaciones registradas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="rounded-lg bg-secondary/40 p-4 text-base leading-relaxed whitespace-pre-line">
                    {caso.observaciones}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card className="border-primary/20 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-xl">
                  <ClipboardList className="size-5 text-primary" />
                  Seguimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SeguimientoForm
                  caso={caso}
                  catalogos={catalogos}
                  nombreUsuario={usuario.nombreEnHoja}
                  bloqueado={bloqueadoPorOtro}
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-xl">
                  <Mail className="size-5 text-primary" />
                  Conversación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Conversacion
                  fila={fila}
                  folio={caso.folio}
                  estado={estadoHilo}
                  plantilla={plantilla}
                  destinatario={caso.correoSolicitante}
                  copiaSugerida={
                    caso.correoEjecutivo &&
                    caso.correoEjecutivo.trim().toLowerCase() !==
                      caso.correoSolicitante?.trim().toLowerCase()
                      ? caso.correoEjecutivo
                      : null
                  }
                  casoCerrado={!estaVivo(caso)}
                  bloqueado={bloqueadoPorOtro}
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-xl">
                  <History className="size-5 text-primary" />
                  Bitácora
                  <Badge variant="outline" className="ml-auto text-sm font-normal">
                    {bitacora.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bitacora.length === 0 ? (
                  <p className="text-base text-muted-foreground">
                    Todavía no hay cambios registrados desde la herramienta.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {bitacora.map((b) => (
                      <li key={b.id} className="rounded-lg bg-secondary/40 p-3 text-base">
                        <p className="text-sm text-muted-foreground">
                          {b.creadoEn.toLocaleString('es-MX')} · {b.correoUsuario.split('@')[0]}
                        </p>
                        <p className="mt-1">
                          <strong>{b.campo}</strong>{' '}
                          <span className="text-muted-foreground line-through">
                            {b.valorAnterior ?? 'vacío'}
                          </span>{' '}
                          <span aria-hidden>→</span> {b.valorNuevo ?? 'vacío'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
