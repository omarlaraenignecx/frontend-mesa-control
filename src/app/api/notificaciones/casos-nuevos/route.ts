import { revalidateTag } from 'next/cache'
import { depsDeGoogle } from '@/lib/casos/consulta'
import { generarFoliosPendientes } from '@/lib/casos/generacion-folios'
import { leerCasos } from '@/lib/google/sheet-reader'
import {
  guardarMarca,
  guardarNotificaciones,
  hojaActual,
  leerMarca,
} from '@/lib/notificaciones/almacen'
import { claveDeCasoNuevo } from '@/lib/notificaciones/claves'
import { casosNuevos, marcaMasAlta } from '@/lib/notificaciones/deteccion'
import { secretoValido } from '@/lib/notificaciones/secreto'

/**
 * La despierta el flujo "Mesa de Control · Casos nuevos" de n8n cada minuto.
 *
 * La detección vive aquí y no en un disparador de n8n por tres razones medidas: el
 * disparador de hoja identifica filas nuevas por conteo y el formulario inserta la
 * respuesta **arriba** de las filas pre-arrastradas, así que avisaría de las celdas
 * vacías del final; la columna del folio está protegida con editores nombrados y la
 * cuenta de servicio de n8n no es uno; y la serie del folio es "máximo de toda la
 * columna más uno" con revalidación previa, lógica que ya vive en esta aplicación.
 */
export async function POST(request: Request) {
  if (!secretoValido(request.headers.get('authorization'), process.env.NOTIFICACIONES_SECRET)) {
    return Response.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  const hoja = hojaActual()
  const { casos } = await leerCasos(await depsDeGoogle())
  const marca = await leerMarca()
  const tope = marcaMasAlta(casos)

  // Arranque: la primera corrida solo siembra la marca. Avisar del histórico
  // completo llenaría el panel con mil casos viejos el primer minuto.
  if (marca === null) {
    if (tope) await guardarMarca(tope)
    return Response.json({ ok: true, arranque: true, marca: tope, hoja })
  }

  const nuevos = casosNuevos(casos, marca)
  if (nuevos.length === 0) {
    return Response.json({ ok: true, nuevos: 0, foliosGenerados: 0, avisos: 0 })
  }

  const folios = await generarFoliosPendientes('n8n:casos-nuevos')

  // Se relee la hoja solo si se escribió algo, para que el aviso lleve el folio
  // recién puesto.
  const conFolio = folios.ok && folios.generados > 0 ? (await leerCasos(await depsDeGoogle())).casos : casos
  const folioDe = (fila: number) => conFolio.find((c) => c.fila === fila)?.folio ?? null

  const avisos = await guardarNotificaciones(
    nuevos.map((c) => ({
      tipo: 'caso_nuevo' as const,
      fila: c.fila,
      folio: folioDe(c.fila),
      titulo: `Petición nueva de ${c.nombreSolicitante ?? 'un solicitante'}`,
      detalle: [c.tipoTramite, c.agencia].filter(Boolean).join(' · ') || null,
      clave: claveDeCasoNuevo(hoja, c.fila),
    })),
  )

  if (tope) await guardarMarca(tope)

  // Expiración inmediata y no el perfil 'max': ese sirve el dato rancio en la
  // siguiente visita y revalida por detrás, así que quien recargara la fila justo
  // ahora seguiría sin ver la petición nueva. `updateTag`, que es lo que usa el
  // botón Actualizar, no se puede llamar desde una ruta —solo desde una acción—.
  revalidateTag('casos', { expire: 0 })

  return Response.json({
    ok: true,
    nuevos: nuevos.length,
    foliosGenerados: folios.ok ? folios.generados : 0,
    errorDeFolios: folios.ok ? null : folios.error,
    avisos,
  })
}
