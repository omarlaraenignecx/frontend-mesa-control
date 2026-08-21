import { depsGmail } from '@/lib/casos/hilo'
import { revisarCorreos } from '@/lib/notificaciones/correos-recibidos'
import { secretoValido } from '@/lib/notificaciones/secreto'

/**
 * La despierta el flujo "Mesa de Control · Correos recibidos" de n8n cada minuto.
 *
 * Revisa el buzón de la mesa y solo mira los hilos que son suyos: ver
 * `revisarCorreos`, donde está explicado por qué el filtro por módulo importa aunque
 * hoy parezca redundante.
 */
export async function POST(request: Request) {
  if (!secretoValido(request.headers.get('authorization'), process.env.NOTIFICACIONES_SECRET)) {
    return Response.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  const { mensajes, avisos } = await revisarCorreos('mesa', await depsGmail())
  return Response.json({ ok: true, mensajes, avisos })
}
