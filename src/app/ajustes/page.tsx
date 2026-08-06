import { redirect } from 'next/navigation'
import { usuarioActual } from '@/lib/auth/usuarios'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { leerCredencial } from '@/lib/google/credencial'
import { leerTituloHoja } from '@/lib/google/sheet-ping'

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
  const usuario = await usuarioActual()
  if (usuario.rol !== 'admin') redirect('/cola')

  const acceso = await estadoDelAcceso()

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-xl font-semibold">Ajustes</h1>

      <section className="space-y-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="font-medium">Acceso a Google de la Mesa de Control</h2>

        {acceso.estado === 'sin-autorizar' && (
          <p className="text-sm text-neutral-500">
            Todavía no se ha autorizado el acceso. La herramienta no puede leer la hoja ni el correo
            hasta que se apruebe el consentimiento con mesadecontrol@gplusseguros.mx.
          </p>
        )}

        {acceso.estado === 'activo' && (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-emerald-600">Consentimiento activo</p>
            <p className="text-neutral-500">
              Autorizado por {acceso.credencial.autorizadoPor} el{' '}
              {acceso.credencial.autorizadoEn.toLocaleString('es-MX')}
            </p>
            <p className="text-neutral-500">
              Hoja alcanzada correctamente: <strong>{acceso.titulo}</strong>
            </p>
            <p className="text-neutral-500">
              Permisos otorgados: {acceso.credencial.scopes.length}
            </p>
          </div>
        )}

        {acceso.estado === 'con-error' && (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-red-600">El acceso a Google necesita reautorizarse</p>
            <p className="text-neutral-500">{acceso.error}</p>
          </div>
        )}

        <a
          href="/api/mesa/autorizar"
          className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {acceso.estado === 'activo' ? 'Volver a autorizar' : 'Autorizar acceso a Google'}
        </a>
      </section>
    </main>
  )
}
