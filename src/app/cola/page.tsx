import { Inbox, Search, Settings, Timer } from 'lucide-react'
import { updateTag } from 'next/cache'
import { PuntoSemaforo } from '@/components/semaforo'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requerirUsuario } from '@/lib/auth/guard'
import {
  VENTANA_COLA_DIAS,
  filtrar,
  opcionesDeFiltro,
  ordenarRecientes,
  type Vista,
} from '@/lib/casos/cola'
import { cargarCola } from '@/lib/casos/consulta'
import { fechaCorta } from '@/lib/fecha'
import { diasDeEspera } from '@/lib/casos/semaforo'
import { CredencialMesaRevocadaError, SinCredencialMesaError } from '@/lib/google/auth-mesa'
import { BotonActualizar } from './actualizar'
import { Filtros } from './filtros'

const ICONO_VISTA = { cola: Inbox, rezago: Timer, todos: Search } as const

/** Lo que va en las celdas de estatus y de responsable cuando la hoja está vacía. */
function Pendiente() {
  return <span className="text-muted-foreground">Pendiente</span>
}

const VISTAS: { clave: Vista; etiqueta: string; ayuda: string }[] = [
  {
    clave: 'cola',
    etiqueta: 'Cola de trabajo',
    ayuda: `Casos sin estatus final de los últimos ${VENTANA_COLA_DIAS} días, del más reciente al más antiguo`,
  },
  {
    clave: 'rezago',
    etiqueta: 'Rezago',
    ayuda: `Casos sin estatus final con más de ${VENTANA_COLA_DIAS} días encima`,
  },
  {
    clave: 'todos',
    etiqueta: 'Todos los pendientes',
    ayuda: 'Todos los casos sin estatus final, sin corte por fecha',
  },
]

export default async function Cola({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    tramite?: string
    responsable?: string
    estatus?: string
    vista?: string
  }>
}) {
  const usuario = await requerirUsuario()
  const params = await searchParams

  async function actualizar() {
    'use server'
    // updateTag y no revalidateTag: el usuario pidió los datos frescos ahora,
    // no en la siguiente visita. Es la semántica del botón Actualizar.
    updateTag('casos')
  }

  let resultado: Awaited<ReturnType<typeof cargarCola>>
  try {
    resultado = await cargarCola()
  } catch (e) {
    const necesitaAutorizar =
      e instanceof SinCredencialMesaError || e instanceof CredencialMesaRevocadaError
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-xl font-semibold">Cola de casos</h1>
        <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-700 dark:text-red-300">
            No se pudieron leer los casos de la hoja
          </p>
          <p className="text-muted-foreground">
            {e instanceof Error ? e.message : 'Error desconocido'}
          </p>
          {necesitaAutorizar && usuario.rol === 'admin' && (
            <a href="/ajustes" className="inline-block underline">
              Ir a Ajustes para autorizar el acceso a Google
            </a>
          )}
          {necesitaAutorizar && usuario.rol !== 'admin' && (
            <p className="text-muted-foreground">
              Avisa al administrador de la Mesa de Control para que reautorice el acceso.
            </p>
          )}
        </div>
      </main>
    )
  }

  const hoy = new Date()
  const vista: Vista = VISTAS.some((v) => v.clave === params.vista)
    ? (params.vista as Vista)
    : 'cola'

  // El parámetro ausente significa "los abiertos", que es lo que filtrar()
  // aplica por omisión; no se traduce aquí para no duplicar esa decisión.
  const estatusElegidos = (params.estatus ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  const filtrosBase = {
    texto: params.q,
    tipoTramite: params.tramite,
    responsable: params.responsable,
    estatusFinal: estatusElegidos,
  }

  const filtrados = ordenarRecientes(filtrar(resultado.casos, { ...filtrosBase, vista }, hoy))
  const conteos = Object.fromEntries(
    VISTAS.map((v) => [
      v.clave,
      filtrar(resultado.casos, { vista: v.clave }, hoy).length,
    ]),
  ) as Record<Vista, number>

  const opciones = opcionesDeFiltro(resultado.casos)
  const hayBusqueda = Boolean(
    params.q || params.tramite || params.responsable || estatusElegidos.length > 0,
  )
  const descripcion = VISTAS.find((v) => v.clave === vista)!.ayuda

  return (
    <div className="min-h-full">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium tracking-wide text-primary uppercase">
                Gplus Seguros
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">Mesa de Control</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base text-muted-foreground">
                {usuario.nombreEnHoja ?? usuario.correo}
              </span>
              {usuario.rol === 'admin' && (
                <a
                  href="/ajustes"
                  className="inline-flex items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Settings className="size-4" />
                  Ajustes
                </a>
              )}
              <BotonActualizar accion={actualizar} />
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            {VISTAS.map((v) => {
              const activa = v.clave === vista && !hayBusqueda
              const Icono = ICONO_VISTA[v.clave]
              return (
                <a
                  key={v.clave}
                  href={`/cola?vista=${v.clave}`}
                  title={v.ayuda}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-base transition-colors ${
                    activa
                      ? 'border-primary/30 bg-primary/10 font-medium text-primary'
                      : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icono className="size-4" />
                  {v.etiqueta}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-sm tabular-nums ${
                      activa ? 'bg-primary/15' : 'bg-secondary'
                    }`}
                  >
                    {conteos[v.clave]}
                  </span>
                </a>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-muted-foreground">
            {hayBusqueda
              ? `${filtrados.length} casos encontrados en todo el histórico de 2026`
              : descripcion}
          </p>
        </div>

        <Filtros opciones={opciones} />

        {hayBusqueda && (
          <p className="text-sm text-muted-foreground">
            Al buscar o filtrar se recorre todo 2026, sin el corte de {VENTANA_COLA_DIAS} días.
          </p>
        )}

      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10" />
              <TableHead className="text-base">Estatus final</TableHead>
              <TableHead className="text-base">Atiende</TableHead>
              <TableHead className="text-base">Folio</TableHead>
              <TableHead className="text-base">Recibido</TableHead>
              <TableHead className="text-base">Trámite</TableHead>
              <TableHead className="text-base">Solicitante</TableHead>
              <TableHead className="text-base">Agencia</TableHead>
              <TableHead className="text-right text-base">Espera</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((caso) => {
              const dias = diasDeEspera(caso, hoy)
              return (
                <TableRow key={caso.fila} className="text-base transition-colors hover:bg-secondary/60">
                  <TableCell>
                    <PuntoSemaforo estatusFinal={caso.estatusFinal} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {caso.estatusFinal?.trim() || <Pendiente />}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {caso.quienAtendio?.trim() || <Pendiente />}
                  </TableCell>
                  <TableCell className="font-medium">
                    <a
                      href={`/caso/${caso.fila}`}
                      className="text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary"
                      title="Abrir el caso"
                    >
                      {caso.folio ?? (
                        <Badge variant="outline" title="Esta petición llegó sin folio">
                          sin folio
                        </Badge>
                      )}
                    </a>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fechaCorta(caso.marcaTemporalIso, caso.marcaTemporalTexto)}
                  </TableCell>
                  <TableCell>{caso.tipoTramite ?? '—'}</TableCell>
                  <TableCell>{caso.nombreSolicitante ?? '—'}</TableCell>
                  <TableCell>{caso.agencia ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {dias === null ? '—' : `${dias} d`}
                  </TableCell>
                </TableRow>
              )
            })}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-base text-muted-foreground">
                  {hayBusqueda
                    ? 'Ningún caso coincide con lo que buscas.'
                    : 'No hay casos en esta vista.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      <p className="text-sm text-muted-foreground">
        {resultado.casos.length} peticiones de 2026 leídas de la hoja
        {resultado.sinResolver > 0 &&
          ` · ${resultado.sinResolver} columnas del formulario sin clasificar, sus datos aparecen como campos adicionales en la vista del caso`}
        </p>
      </main>
    </div>
  )
}
