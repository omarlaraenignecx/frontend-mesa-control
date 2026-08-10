import { updateTag } from 'next/cache'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requerirUsuario } from '@/lib/auth/guard'
import { filtrar, opcionesDeFiltro, ordenarFifo } from '@/lib/casos/cola'
import { cargarCola } from '@/lib/casos/consulta'
import { diasDeEspera, semaforoDe } from '@/lib/casos/semaforo'
import { CredencialMesaRevocadaError, SinCredencialMesaError } from '@/lib/google/auth-mesa'
import { BotonActualizar } from './actualizar'
import { Filtros } from './filtros'

const COLOR_SEMAFORO = {
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-red-500',
} as const

export default async function Cola({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tramite?: string; responsable?: string; cerrados?: string }>
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
  const filtrados = ordenarFifo(
    filtrar(resultado.casos, {
      texto: params.q,
      tipoTramite: params.tramite,
      responsable: params.responsable,
      incluirCerrados: params.cerrados === '1',
    }),
  )
  const opciones = opcionesDeFiltro(resultado.casos)

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cola de casos</h1>
          <p className="text-sm text-muted-foreground">
            {filtrados.length} de {resultado.casos.length} casos · del más antiguo al más reciente
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {usuario.nombreEnHoja ?? usuario.correo}
          </span>
          {usuario.rol === 'admin' && (
            <a href="/ajustes" className="text-sm underline">
              Ajustes
            </a>
          )}
          <BotonActualizar accion={actualizar} />
        </div>
      </div>

      <Filtros opciones={opciones} />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Folio</TableHead>
              <TableHead>Recibido</TableHead>
              <TableHead>Trámite</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Agencia</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Atiende</TableHead>
              <TableHead className="text-right">Espera</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((caso) => {
              const nivel = semaforoDe(caso, hoy)
              const dias = diasDeEspera(caso, hoy)
              return (
                <TableRow key={caso.fila}>
                  <TableCell>
                    {nivel && (
                      <span
                        className={`inline-block size-2.5 rounded-full ${COLOR_SEMAFORO[nivel]}`}
                        title={`${dias} días de espera`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {caso.folio ?? (
                      <Badge variant="outline" title="Esta petición llegó sin folio">
                        sin folio
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {caso.marcaTemporalTexto}
                  </TableCell>
                  <TableCell>{caso.tipoTramite ?? '—'}</TableCell>
                  <TableCell>{caso.nombreSolicitante ?? '—'}</TableCell>
                  <TableCell>{caso.agencia ?? '—'}</TableCell>
                  <TableCell>
                    {caso.estatusInicial ?? (
                      <span className="text-muted-foreground">— sin tomar —</span>
                    )}
                  </TableCell>
                  <TableCell>{caso.quienAtendio ?? '—'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {dias === null ? '—' : `${dias} d`}
                  </TableCell>
                </TableRow>
              )
            })}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Ningún caso coincide con lo que buscas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {resultado.sinResolver > 0 && (
        <p className="text-xs text-muted-foreground">
          {resultado.sinResolver} columnas del formulario no están clasificadas; sus datos se
          mostrarán en la vista del caso como campos adicionales.
        </p>
      )}
    </main>
  )
}
