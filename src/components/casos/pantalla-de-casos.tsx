import Link from 'next/link'
import { ArrowLeftRight, Inbox, Search, Settings, Timer } from 'lucide-react'
import { PuntoDeCarga } from '@/components/punto-de-carga'
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
import { GenerarFolios } from '@/components/generar-folios'
import { Campanita } from '@/components/notificaciones/campanita'
import { InsigniaCorreo } from '@/components/notificaciones/insignia-correo'
import { ProveedorNotificaciones } from '@/components/notificaciones/proveedor'
import { requerirUsuario } from '@/lib/auth/guard'
import { sinFolio } from '@/lib/casos/caso'
import {
  VENTANA_COLA_DIAS,
  filtrar,
  opcionesDeFiltro,
  ordenarRecientes,
  type Vista,
} from '@/lib/casos/cola'
import { cargarCola } from '@/lib/casos/consulta'
import { diasDeEspera } from '@/lib/casos/semaforo'
import { fechaCorta } from '@/lib/fecha'
import { CredencialMesaRevocadaError, SinCredencialMesaError } from '@/lib/google/auth-mesa'
import { MODULOS, type ConfigModulo } from '@/lib/modulos/modulo'
import { actualizar } from '@/app/acciones-casos'
import { BotonActualizar } from './actualizar'
import { AutoActualizarCasos } from './auto-actualizar'
import { Filtros } from './filtros'
import { InvitacionEscritorio } from './invitacion-escritorio'

/**
 * El listado de casos de un módulo.
 *
 * Una sola pantalla para la Mesa de Control y para Atención a Siniestros: cambian el
 * título, qué casos entran, con qué campo se clasifican, a dónde llevan los enlaces
 * y un par de columnas. Todo eso viene en `ConfigModulo`, así que no hay dos
 * pantallas que mantener sincronizadas —el semáforo, el corte por antigüedad, la
 * insignia de correo y el refresco automático son los mismos, y una corrección se
 * hace una vez—.
 *
 * Lee la hoja por `cargarCola()`, que está cacheada con la etiqueta `casos`: dos
 * módulos abiertos a la vez no son dos lecturas de Google.
 */

const ICONO_VISTA = { fila: Inbox, rezago: Timer, todos: Search } as const

/** Lo que va en las celdas de estatus y de responsable cuando la hoja está vacía. */
function Pendiente() {
  return <span className="text-muted-foreground">Pendiente</span>
}

/**
 * Las tres vistas, nombradas con lo que cada módulo considera un caso vivo: la mesa
 * dice "pendientes" y siniestros dice "abiertos", porque no ocultan lo mismo.
 */
function vistasDe(queMuestra: string): { clave: Vista; etiqueta: string; ayuda: string }[] {
  const enMinuscula = queMuestra.toLocaleLowerCase('es')
  return [
    {
      clave: 'fila',
      etiqueta: 'Fila de trabajo',
      ayuda: `Casos ${enMinuscula} de los últimos ${VENTANA_COLA_DIAS} días, del más reciente al más antiguo`,
    },
    {
      clave: 'rezago',
      etiqueta: 'Rezago',
      ayuda: `Casos ${enMinuscula} con más de ${VENTANA_COLA_DIAS} días encima`,
    },
    {
      clave: 'todos',
      etiqueta: `Todos los ${enMinuscula}`,
      ayuda: `Todos los casos ${enMinuscula}, sin corte por fecha`,
    },
  ]
}

/**
 * Columnas comunes a los dos módulos: semáforo, estatus, atiende, folio, recibido,
 * clasificación, solicitante, correo, agencia y espera. Se cuenta aquí y no
 * contando etiquetas `<TableHead>` en el archivo porque las columnas propias del
 * módulo se dibujan en un `map` y no se pueden contar leyendo el código.
 */
const COLUMNAS_COMUNES = 10

export type ParamsListado = Record<string, string | undefined>

export async function PantallaDeCasos({
  modulo,
  params,
}: {
  modulo: ConfigModulo
  params: ParamsListado
}) {
  const usuario = await requerirUsuario()

  let resultado: Awaited<ReturnType<typeof cargarCola>>
  try {
    resultado = await cargarCola()
  } catch (e) {
    const necesitaAutorizar =
      e instanceof SinCredencialMesaError || e instanceof CredencialMesaRevocadaError
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-xl font-semibold">{modulo.titulo}</h1>
        <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-700 dark:text-red-300">
            No se pudieron leer los casos de la hoja
          </p>
          <p className="text-muted-foreground">
            {e instanceof Error ? e.message : 'Error desconocido'}
          </p>
          {necesitaAutorizar && usuario.rol === 'admin' && (
            <Link href="/ajustes" className="inline-block underline">
              Ir a Ajustes para autorizar el acceso a Google
            </Link>
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
  const VISTAS = vistasDe(modulo.estatusPorOmision.etiqueta)
  const vista: Vista = VISTAS.some((v) => v.clave === params.vista)
    ? (params.vista as Vista)
    : 'fila'

  // Los casos del módulo, antes de cualquier filtro: los conteos de las pestañas y
  // las opciones de los selectores tienen que hablar de lo que este módulo atiende.
  const delModulo = resultado.casos.filter(modulo.incluye)

  // El parámetro ausente significa "los abiertos", que es lo que filtrar()
  // aplica por omisión; no se traduce aquí para no duplicar esa decisión.
  const estatusElegidos = (params.estatus ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  const filtrosBase = {
    texto: params.q,
    clasificacion: params[modulo.clasificacion.param],
    campoClasificacion: modulo.clasificacion.campo,
    responsable: params.responsable,
    estatusFinal: estatusElegidos,
    estatusPorOmision: modulo.estatusPorOmision.valores,
  }

  const filtrados = ordenarRecientes(filtrar(delModulo, { ...filtrosBase, vista }, hoy))
  const conteos = Object.fromEntries(
    VISTAS.map((v) => [
      v.clave,
      filtrar(
        delModulo,
        { vista: v.clave, estatusPorOmision: modulo.estatusPorOmision.valores },
        hoy,
      ).length,
    ]),
  ) as Record<Vista, number>

  const opciones = opcionesDeFiltro(delModulo, modulo.clasificacion.campo)
  const hayBusqueda = Boolean(
    params.q ||
      params[modulo.clasificacion.param] ||
      params.responsable ||
      estatusElegidos.length > 0,
  )
  const descripcion = VISTAS.find((v) => v.clave === vista)!.ayuda
  // Sobre todos los casos leídos y no sobre los del módulo: el arrastre llena la
  // columna entera de la hoja, no la vista que se esté mirando.
  const faltanFolio = resultado.casos.filter(sinFolio).length
  const otrosModulos = MODULOS.filter((m) => m.clave !== modulo.clave)
  const totalColumnas = COLUMNAS_COMUNES + modulo.columnasExtra.length

  return (
    <ProveedorNotificaciones>
      <div className="min-h-full">
        <header className="border-b bg-card">
          <div className="mx-auto max-w-7xl px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium tracking-wide text-primary uppercase">
                  Gplus Seguros
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">{modulo.titulo}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-base text-muted-foreground">
                  {usuario.nombreEnHoja ?? usuario.correo}
                </span>
                {/* Sin esto el otro módulo solo se alcanza escribiendo la URL, así que
                    tiene aspecto de botón y no de enlace discreto: es la puerta al
                    otro módulo y quien no sepa que existe no la va a buscar. */}
                {otrosModulos.map((otro) => (
                  <Link
                    key={otro.clave}
                    href={otro.rutaLista}
                    prefetch={false}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
                  >
                    <ArrowLeftRight aria-hidden className="size-4" />
                    {otro.titulo}
                    <PuntoDeCarga />
                  </Link>
                ))}
                {modulo.ajustes && (!modulo.ajustes.soloAdmin || usuario.rol === 'admin') && (
                  <Link
                    href={modulo.ajustes.ruta}
                    className="inline-flex items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Settings className="size-4" />
                    Ajustes
                  </Link>
                )}
                <Campanita />
                <BotonActualizar accion={actualizar} />
              </div>
            </div>

            <nav className="mt-5 flex flex-wrap gap-2">
              {VISTAS.map((v) => {
                const activa = v.clave === vista && !hayBusqueda
                const Icono = ICONO_VISTA[v.clave]
                return (
                  <Link
                    key={v.clave}
                    href={`${modulo.rutaLista}?vista=${v.clave}`}
                    prefetch={false}
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
                    <PuntoDeCarga />
                  </Link>
                )
              })}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
          <AutoActualizarCasos />
          <InvitacionEscritorio />
          {modulo.generaFolios && <GenerarFolios faltantes={faltanFolio} />}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base text-muted-foreground">
              {hayBusqueda
                ? `${filtrados.length} casos encontrados en todo el histórico de 2026`
                : descripcion}
            </p>
          </div>

          <Filtros modulo={modulo.clave} opciones={opciones} />

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
                    <TableHead className="w-20" />
                    <TableHead className="text-base">Estatus final</TableHead>
                    <TableHead className="text-base">Atiende</TableHead>
                    <TableHead className="text-base">Folio</TableHead>
                    <TableHead className="text-base">Recibido</TableHead>
                    <TableHead className="text-base">{modulo.clasificacion.columna}</TableHead>
                    {modulo.columnasExtra.map((c) => (
                      <TableHead key={c.campo} className="text-base">
                        {c.encabezado}
                      </TableHead>
                    ))}
                    <TableHead className="text-base">Solicitante</TableHead>
                    <TableHead className="text-base">Correo</TableHead>
                    <TableHead className="text-base">Agencia</TableHead>
                    <TableHead className="text-right text-base">Espera</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((caso) => {
                    const dias = diasDeEspera(caso, hoy)
                    return (
                      <TableRow
                        key={caso.fila}
                        className="text-base transition-colors hover:bg-secondary/60"
                      >
                        <TableCell className="relative pl-10">
                          <InsigniaCorreo fila={caso.fila} />
                          <PuntoSemaforo estatusFinal={caso.estatusFinal} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {caso.estatusFinal?.trim() || <Pendiente />}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {caso.quienAtendio?.trim() || <Pendiente />}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={modulo.rutaCaso(caso.fila)}
                            prefetch={false}
                            className="inline-flex items-center gap-1.5 text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary"
                            title="Abrir el caso"
                          >
                            {caso.folio ?? (
                              <Badge variant="outline" title="Esta petición llegó sin folio">
                                sin folio
                              </Badge>
                            )}
                            <PuntoDeCarga />
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {fechaCorta(caso.marcaTemporalIso, caso.marcaTemporalTexto)}
                        </TableCell>
                        <TableCell>{caso[modulo.clasificacion.campo] ?? '—'}</TableCell>
                        {modulo.columnasExtra.map((c) => (
                          <TableCell key={c.campo} className="whitespace-nowrap">
                            {caso[c.campo] ?? '—'}
                          </TableCell>
                        ))}
                        <TableCell>{caso.nombreSolicitante ?? '—'}</TableCell>
                        {/* break-all: un correo largo no tiene espacios donde cortar y
                            sin esto estira la tabla hasta sacar la columna de espera. */}
                        <TableCell className="break-all text-muted-foreground">
                          {caso.correoSolicitante ?? '—'}
                        </TableCell>
                        <TableCell>{caso.agencia ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {dias === null ? '—' : `${dias} d`}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filtrados.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={totalColumnas}
                        className="py-12 text-center text-base text-muted-foreground"
                      >
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
            {delModulo.length} peticiones de 2026 leídas de la hoja
            {resultado.sinResolver > 0 &&
              ` · ${resultado.sinResolver} columnas del formulario sin clasificar, sus datos aparecen como campos adicionales en la vista del caso`}
          </p>
        </main>
      </div>
    </ProveedorNotificaciones>
  )
}
