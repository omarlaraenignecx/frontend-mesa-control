import Link from 'next/link'
import { ArrowLeft, ShieldCheck, TriangleAlert } from 'lucide-react'
import { requerirUsuario } from '@/lib/auth/guard'
import { normalizarCorreo } from '@/lib/auth/allowlist'
import { SINIESTROS } from '@/lib/modulos/modulo'
import { estadoDelBuzon, scopesFaltantesSiniestros } from '@/lib/siniestros/auth'
import { listarCredencialesSiniestros } from '@/lib/siniestros/credencial'
import {
  buzonProvisional,
  cuentaActiva,
  listarEjecutivos,
  sembrarEjecutivos,
} from '@/lib/siniestros/ejecutivos'
import { BotonDesignar, BotonQuitar, FormularioFicha, InterruptorProvisional } from './controles'

/** El scope completo no le dice nada a nadie; esto sí. */
function nombreDelPermiso(scope: string): string {
  const nombres: Record<string, string> = {
    'https://www.googleapis.com/auth/gmail.send': 'enviar correo',
    'https://www.googleapis.com/auth/gmail.readonly': 'leer correo',
    'https://www.googleapis.com/auth/gmail.modify': 'organizar el correo',
  }
  return nombres[scope] ?? scope
}

function fecha(d: Date): string {
  return d.toLocaleString('es-MX')
}

/**
 * Ajustes del módulo de Atención a Siniestros.
 *
 * Abierta a cualquier usuario autorizado y no solo al administrador, a diferencia de
 * `/ajustes`. La razón es concreta: aquí cada quien autoriza **su propia** cuenta de
 * correo, y exigir que el ejecutivo de siniestros fuera administrador de la mesa
 * entera le daría además la reautorización del Google de la mesa y la edición de sus
 * plantillas, que no le tocan.
 */
export default async function AjustesDeSiniestros({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; detalle?: string; buzon?: string }>
}) {
  const usuario = await requerirUsuario()
  const params = await searchParams

  await sembrarEjecutivos()
  const [estado, credenciales, fichas, activa, provisional] = await Promise.all([
    estadoDelBuzon(),
    listarCredencialesSiniestros(),
    listarEjecutivos(),
    cuentaActiva(),
    buzonProvisional(),
  ])
  const credencialDe = new Map(credenciales.map((c) => [c.correo, c]))
  const esAdmin = usuario.rol === 'admin'

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <Link
        href={SINIESTROS.rutaLista}
        prefetch={false}
        className="inline-flex items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {SINIESTROS.titulo}
      </Link>

      <div className="space-y-1">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">Gplus Seguros</p>
        <h1 className="text-3xl font-semibold tracking-tight">Ajustes de {SINIESTROS.titulo}</h1>
      </div>

      {params.estado === 'autorizado' && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-base text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Cuenta autorizada: <strong>{params.buzon}</strong>
        </p>
      )}
      {params.estado === 'error' && (
        <div className="space-y-1 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-700 dark:text-red-300">
            No se pudo autorizar la cuenta
          </p>
          <p className="text-muted-foreground">
            {params.detalle === 'dominio-ajeno'
              ? `La cuenta que autorizaste no es del dominio de la empresa. El buzón de un área tiene que ser una cuenta de Gplus Seguros.`
              : params.detalle === 'sin-refresh-token'
                ? 'Google no entregó el permiso permanente. Vuelve a intentarlo y acepta todas las casillas.'
                : params.detalle === 'sin-buzon'
                  ? 'Google no dijo qué buzón se autorizó, así que no se guardó nada.'
                  : (params.detalle ?? 'Error desconocido')}
          </p>
        </div>
      )}

      {/* ---------- Permisos ---------- */}
      <section className="space-y-4 rounded-xl border bg-card p-7 shadow-sm">
        <h2 className="text-xl font-medium">Permisos para Módulo de Siniestros</h2>

        <div className="space-y-2 text-base text-muted-foreground">
          <p>
            Los correos de los casos de siniestros salen del buzón del ejecutivo que los atiende,
            no del de la Mesa de Control. Para eso hace falta que el dueño de ese buzón lo
            autorice desde aquí, con su propia cuenta.
          </p>
          <p>
            Se piden tres permisos, todos de correo y ninguno más:{' '}
            <strong>enviar correo</strong>, <strong>leer correo</strong> y{' '}
            <strong>organizar el correo</strong>. No se pide acceso a la hoja de cálculo ni a
            Drive: eso sigue pasando por la cuenta de la Mesa de Control.
          </p>
          <p>
            <strong>Qué implica leer el correo:</strong> para que las respuestas de las agencias
            vuelvan al chat del caso, la aplicación revisa la bandeja de entrada de esa cuenta.
            Lista los identificadores de los correos recientes para saber cuáles pertenecen a un
            caso y abre el remitente <em>solo de esos</em>. No lee el contenido del correo
            personal, pero sí pasa por la bandeja. Es el precio de que la conversación viva en esa
            cuenta.
          </p>
        </div>

        <a
          href="/api/siniestros/autorizar"
          className="inline-block rounded-lg bg-primary px-5 py-3 text-base font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          Autorizar mi cuenta de correo
        </a>

        <div className="space-y-3 border-t pt-4">
          <h3 className="text-base font-medium">Cuentas autorizadas</h3>
          {credenciales.length === 0 && (
            <p className="text-base text-muted-foreground">
              Todavía ninguna. Mientras no haya, el módulo no puede enviar correo —salvo que se
              encienda el buzón provisional de más abajo—.
            </p>
          )}
          <ul className="space-y-3">
            {credenciales.map((c) => {
              const faltantes = scopesFaltantesSiniestros(c.scopes)
              const esActiva = c.correo === activa
              const puedeQuitar = esAdmin || normalizarCorreo(usuario.correo) === c.correo
              return (
                <li key={c.correo} className="space-y-1.5 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-600" />
                    <span className="text-base font-medium">{c.correo}</span>
                    {esActiva && (
                      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-sm font-medium text-primary">
                        envía y firma
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Autorizada por {c.autorizadoPor} el {fecha(c.autorizadoEn)} ·{' '}
                    {c.scopes.length} permisos
                    {c.ultimoUso && ` · último uso ${fecha(c.ultimoUso)}`}
                  </p>
                  {faltantes.length > 0 && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Falta el permiso de {faltantes.map(nombreDelPermiso).join(', ')}. Hay que
                      volver a autorizar aceptando todas las casillas.
                    </p>
                  )}
                  {c.ultimoError && (
                    <p className="text-sm text-red-600">Último error: {c.ultimoError}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    {!esActiva && <BotonDesignar correo={c.correo} />}
                    {puedeQuitar && <BotonQuitar correo={c.correo} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* ---------- Buzón provisional ---------- */}
      <section className="space-y-4 rounded-xl border bg-card p-7 shadow-sm">
        <h2 className="text-xl font-medium">Buzón del módulo</h2>

        {estado.estado === 'propio' && (
          <p className="text-base">
            El módulo envía y lee por <strong>{estado.correo}</strong>, la cuenta autorizada.
          </p>
        )}
        {estado.estado === 'provisional' && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <p className="text-base">
              <span className="font-medium">Provisionalmente, por el buzón de la mesa.</span> Los
              correos de siniestros están saliendo de <strong>{estado.correo}</strong> y las
              respuestas llegan ahí. Es para probar; en cuanto se autorice la cuenta del ramo,
              apaga esta opción.
            </p>
          </div>
        )}
        {estado.estado === 'sin-cuenta' && (
          <p className="text-base text-muted-foreground">
            El módulo todavía no tiene buzón, así que no puede enviar correo. Autoriza una cuenta
            arriba, o enciende el provisional para probar.
          </p>
        )}

        <InterruptorProvisional encendido={provisional} puede={esAdmin} />
      </section>

      {/* ---------- Fichas ---------- */}
      <section className="space-y-5 rounded-xl border bg-card p-7 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-medium">Ficha del ejecutivo</h2>
          <p className="text-base text-muted-foreground">
            Con esto cierra cada correo del módulo. La del ejecutivo designado es la que firma.
          </p>
        </div>
        {fichas.map((f) => {
          const editable = esAdmin || normalizarCorreo(usuario.correo) === f.correo
          return (
            <div key={f.correo} className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-medium">{f.correo}</span>
                {f.correo === activa && (
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-sm font-medium text-primary">
                    firma los correos
                  </span>
                )}
                {!credencialDe.has(f.correo) && (
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-sm text-muted-foreground">
                    sin cuenta autorizada
                  </span>
                )}
              </div>
              <FormularioFicha ficha={f} editable={editable} />
            </div>
          )
        })}
      </section>
    </main>
  )
}
