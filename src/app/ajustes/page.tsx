import Link from 'next/link'
import { requerirAdmin } from '@/lib/auth/guard'
import { listarPlantillas, sembrarPlantillas } from '@/lib/correo/plantillas'
import { AdminPlantillas } from './plantillas'
import { accessTokenDeLaMesa, scopesFaltantes } from '@/lib/google/auth-mesa'
import { leerCredencial } from '@/lib/google/credencial'
import { leerTituloHoja } from '@/lib/google/sheet-ping'
import { SINIESTROS } from '@/lib/modulos/modulo'

/** El scope completo no le dice nada a nadie; esto sí. */
function nombreDelPermiso(scope: string): string {
  const nombres: Record<string, string> = {
    'https://www.googleapis.com/auth/drive.file': 'crear archivos en Drive',
    'https://www.googleapis.com/auth/drive.readonly': 'leer archivos de Drive',
    'https://www.googleapis.com/auth/spreadsheets': 'editar la hoja de cálculo',
    'https://www.googleapis.com/auth/gmail.send': 'enviar correo',
    'https://www.googleapis.com/auth/gmail.readonly': 'leer correo',
    'https://www.googleapis.com/auth/gmail.modify': 'organizar el correo',
  }
  return nombres[scope] ?? scope
}

async function estadoDelAcceso() {
  const credencial = await leerCredencial()
  if (!credencial) return { estado: 'sin-autorizar' as const }
  try {
    const accessToken = await accessTokenDeLaMesa()
    const titulo = await leerTituloHoja(process.env.SHEET_ID!, {
      fetch: globalThis.fetch,
      accessToken,
    })
    return { estado: 'activo' as const, credencial, titulo }
  } catch (e) {
    return {
      estado: 'con-error' as const,
      credencial,
      error: e instanceof Error ? e.message : 'Error desconocido',
    }
  }
}

export default async function Ajustes() {
  await requerirAdmin()

  const acceso = await estadoDelAcceso()
  // La credencial se guardó con los permisos de entonces: si después se agregó
  // uno, el token sigue sirviendo para lo demás y solo hay que avisar.
  const faltantes =
    acceso.estado === 'sin-autorizar' ? [] : scopesFaltantes(acceso.credencial.scopes)
  // La siembra es idempotente: si alguien ya editó una plantilla, no se toca.
  await sembrarPlantillas()
  const plantillas = await listarPlantillas()

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1>

      <section className="space-y-4 rounded-xl border bg-card p-7 shadow-sm">
        <h2 className="text-xl font-medium">Acceso a Google de la Mesa de Control</h2>

        {acceso.estado === 'sin-autorizar' && (
          <p className="text-base text-muted-foreground">
            Todavía no se ha autorizado el acceso. La herramienta no puede leer la hoja ni el correo
            hasta que se apruebe el consentimiento con mesadecontrol@gplusseguros.mx.
          </p>
        )}

        {acceso.estado === 'activo' && (
          <div className="space-y-1.5 text-base">
            <p className="font-medium text-emerald-600">Consentimiento activo</p>
            <p className="text-muted-foreground">
              Autorizado por {acceso.credencial.autorizadoPor} el{' '}
              {acceso.credencial.autorizadoEn.toLocaleString('es-MX')}
            </p>
            <p className="text-muted-foreground">
              Hoja alcanzada correctamente: <strong>{acceso.titulo}</strong>
            </p>
            <p className="text-muted-foreground">
              Permisos otorgados: {acceso.credencial.scopes.length}
            </p>
          </div>
        )}

        {acceso.estado === 'con-error' && (
          <div className="space-y-1.5 text-base">
            <p className="font-medium text-red-600">El acceso a Google necesita reautorizarse</p>
            <p className="text-muted-foreground">{acceso.error}</p>
          </div>
        )}

        {acceso.estado !== 'sin-autorizar' && faltantes.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-base dark:border-amber-900 dark:bg-amber-950">
            <p className="font-medium">Falta un permiso que se agregó después</p>
            <p className="text-muted-foreground">
              La autorización guardada no incluye {faltantes.map(nombreDelPermiso).join(', ')}.
              Hasta que vuelvas a autorizar, la mesa no podrá subir archivos a los casos; todo lo
              demás sigue funcionando igual.
            </p>
          </div>
        )}

        {/* Ruta de servidor que redirige al consentimiento de Google: tiene que
            ser una navegación del documento, no un Link de cliente. */}
        <a
          href="/api/mesa/autorizar"
          className="inline-block rounded-lg bg-primary px-5 py-3 text-base font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          {acceso.estado === 'activo' ? 'Volver a autorizar' : 'Autorizar acceso a Google'}
        </a>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-7 shadow-sm">
        <h2 className="text-xl font-medium">Plantillas de correo</h2>
        <AdminPlantillas plantillas={plantillas} />
      </section>

      {/* El módulo de siniestros tiene su propio acceso a Google y sus propios
          ajustes, porque su correo sale de otro buzón. Aquí queda el puente para
          que el administrador no tenga que saberse la ruta. */}
      <section className="space-y-3 rounded-xl border bg-card p-7 shadow-sm">
        <h2 className="text-xl font-medium">Atención a Siniestros</h2>
        <p className="text-base text-muted-foreground">
          Los permisos de Gmail del módulo, la ficha del ejecutivo que firma sus correos y el
          buzón desde el que salen se administran en su propia pantalla.
        </p>
        <Link
          href={SINIESTROS.ajustes!.ruta}
          className="inline-block text-base text-primary underline underline-offset-4"
        >
          Ir a los ajustes de Atención a Siniestros
        </Link>
      </section>

      <Link href="/fila" className="inline-block text-base text-primary underline underline-offset-4">
        Volver a la fila
      </Link>
    </main>
  )
}
