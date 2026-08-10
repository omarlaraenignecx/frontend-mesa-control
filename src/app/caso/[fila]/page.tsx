import { requerirUsuario } from '@/lib/auth/guard'
import { leerBitacora } from '@/lib/casos/bitacora'
import { adquirirBloqueo } from '@/lib/casos/bloqueo'
import { agruparCamposExtra } from '@/lib/casos/campos-extra'
import { sinFolio } from '@/lib/casos/caso'
import { cargarCaso } from '@/lib/casos/consulta'
import { emitirEvento } from '@/lib/casos/eventos'
import { diasDeEspera, semaforoDe } from '@/lib/casos/semaforo'
import { BotonForzar, BotonLiberar } from './bloqueo-acciones'
import { FolioForm } from './folio-form'
import { SeguimientoForm } from './seguimiento-form'

const COLOR_SEMAFORO = {
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-red-500',
} as const

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="break-words whitespace-pre-line">{valor}</dd>
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
        <h1 className="text-lg font-semibold">Caso no válido</h1>
        <a href="/cola" className="text-sm underline">
          Volver a la cola
        </a>
      </main>
    )
  }

  const cargado = await cargarCaso(fila)
  if (!cargado) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <h1 className="text-lg font-semibold">Ese caso no está en la hoja</h1>
        <p className="text-sm text-muted-foreground">
          Puede que la fila {fila} sea anterior a 2026 o que no tenga fecha de recepción.
        </p>
        <a href="/cola" className="text-sm underline">
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

  const hoy = new Date()
  const nivel = semaforoDe(caso, hoy)
  const dias = diasDeEspera(caso, hoy)
  const bitacora = await leerBitacora(fila)
  const extras = agruparCamposExtra(caso.camposExtra)

  // Solo los campos que traen dato (RF-03).
  const datos: { etiqueta: string; valor: string }[] = [
    ['Recibido', caso.marcaTemporalTexto],
    ['Tipo de trámite', caso.tipoTramite],
    ['Solicitante', caso.nombreSolicitante],
    ['Correo', caso.correoSolicitante],
    ['Agencia', caso.agencia],
    ['Tipo de negocio', caso.tipoNegocio],
    ['Cliente', caso.nombreCliente],
    ['Aseguradora declarada', caso.aseguradoraDeclarada],
    ['Motivo de la petición', caso.motivo],
  ]
    .filter((par): par is [string, string] => Boolean(par[1]))
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <a href="/cola" className="text-sm text-muted-foreground underline">
            ← Cola de casos
          </a>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {nivel && <span className={`inline-block size-2.5 rounded-full ${COLOR_SEMAFORO[nivel]}`} />}
            Caso {caso.folio ?? 'sin folio'}
            {caso.tipoTramite && (
              <span className="font-normal text-muted-foreground">· {caso.tipoTramite}</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Fila {caso.fila} · recibido {caso.marcaTemporalTexto}
            {dias !== null && ` · ${dias} días de espera`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bloqueadoPorOtro ? (
            <>
              <span className="text-sm text-amber-600">
                Lo tiene {bloqueo.bloqueo.correoDueno} desde{' '}
                {bloqueo.bloqueo.tomadoEn.toLocaleString('es-MX')}
              </span>
              <BotonForzar fila={fila} dueno={bloqueo.bloqueo.correoDueno} />
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">Lo tienes tú</span>
              <BotonLiberar fila={fila} />
            </>
          )}
        </div>
      </div>

      {sinFolio(caso) && !bloqueadoPorOtro && <FolioForm fila={fila} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="rounded-lg border p-5">
            <h2 className="mb-2 font-medium">
              Datos de la petición{' '}
              <span className="text-sm font-normal text-muted-foreground">
                ({datos.length + extras.length} con dato)
              </span>
            </h2>
            <dl className="divide-y">
              {datos.map((d) => (
                <Dato key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
              ))}
              {extras.map((d) => (
                <Dato key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
              ))}
            </dl>
          </section>

          <section className="rounded-lg border p-5">
            <h2 className="mb-2 font-medium">
              Adjuntos{' '}
              <span className="text-sm font-normal text-muted-foreground">
                ({caso.adjuntos.length})
              </span>
            </h2>
            {caso.adjuntos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta petición no trae archivos adjuntos.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {caso.adjuntos.map((a, i) => (
                  <li key={`${a.url}-${i}`}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {a.etiqueta}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {caso.observaciones && (
            <section className="rounded-lg border p-5">
              <h2 className="mb-2 font-medium">Observaciones registradas</h2>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {caso.observaciones}
              </p>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border p-5">
            <h2 className="mb-3 font-medium">Seguimiento</h2>
            <SeguimientoForm
              caso={caso}
              catalogos={catalogos}
              nombreUsuario={usuario.nombreEnHoja}
              bloqueado={bloqueadoPorOtro}
            />
          </section>

          <section className="rounded-lg border p-5">
            <h2 className="mb-2 font-medium">Conversación</h2>
            <p className="text-sm text-muted-foreground">
              El panel de correo con el solicitante llega en la siguiente etapa.
            </p>
          </section>

          <section className="rounded-lg border p-5">
            <h2 className="mb-2 font-medium">
              Bitácora{' '}
              <span className="text-sm font-normal text-muted-foreground">({bitacora.length})</span>
            </h2>
            {bitacora.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay cambios registrados desde la herramienta.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bitacora.map((b) => (
                  <li key={b.id} className="border-b pb-2 last:border-0">
                    <span className="text-muted-foreground">
                      {b.creadoEn.toLocaleString('es-MX')} · {b.correoUsuario}
                    </span>
                    <br />
                    <strong>{b.campo}</strong>:{' '}
                    <span className="line-through opacity-60">{b.valorAnterior ?? '(vacío)'}</span>{' '}
                    → {b.valorNuevo ?? '(vacío)'}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
