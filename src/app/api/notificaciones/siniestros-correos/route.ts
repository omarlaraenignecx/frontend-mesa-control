import { revisarCorreos } from '@/lib/notificaciones/correos-recibidos'
import { secretoValido } from '@/lib/notificaciones/secreto'
import { SinCuentaSiniestrosError, buzonDeSiniestros } from '@/lib/siniestros/auth'

/**
 * La despierta el flujo "Atención a Siniestros · Correos recibidos" de n8n cada minuto.
 *
 * Revisa el buzón del módulo —el de su ejecutivo designado— y no el de la mesa. Es una
 * ruta aparte y no un parámetro de la otra porque las dos cosas que las distinguen son
 * de fondo: el token con el que se llama a Gmail y el módulo con el que se sellan los
 * avisos. Un flujo por ruta se activa, se apaga y se audita por separado.
 *
 * Sin cuenta autorizada responde 200 con `sinCuenta: true` en lugar de fallar: el flujo
 * de n8n va a llamar cada minuto desde antes de que el ejecutivo autorice, y un 500 por
 * minuto llenaría el historial de errores rojos que no son errores.
 */
export async function POST(request: Request) {
  if (!secretoValido(request.headers.get('authorization'), process.env.NOTIFICACIONES_SECRET)) {
    return Response.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  let buzon
  try {
    buzon = await buzonDeSiniestros()
  } catch (e) {
    if (e instanceof SinCuentaSiniestrosError) {
      return Response.json({ ok: true, sinCuenta: true, mensajes: 0, avisos: 0 })
    }
    throw e
  }

  const { mensajes, avisos } = await revisarCorreos('siniestros', {
    fetch: globalThis.fetch,
    accessToken: buzon.accessToken,
    correoBuzon: buzon.correo,
  })
  return Response.json({ ok: true, buzon: buzon.correo, provisional: buzon.provisional, mensajes, avisos })
}
