import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'

/** Clave de la plantilla que se usa cuando el trámite no tiene una propia. */
export const PLANTILLA_GENERAL = 'General'

/**
 * Tipos de trámite observados en la hoja. Cada uno arranca con un borrador que
 * Keynor corrige desde Ajustes: el texto real lo conoce la mesa, no el
 * desarrollo.
 */
const TIPOS_OBSERVADOS = [
  'Cotización',
  'Emisión',
  'Endoso',
  'Cancelación',
  'Cancelaciones',
  'Renovaciones',
  'Reexpedición',
  'Alta de versión',
  'Alta de usuarios',
  'Descarga de documentos',
  'Homologación',
  'Validación de versión',
  'Devolución de primas no devengadas',
]

const BORRADOR = `Buen día {{solicitante}},

Recibimos tu solicitud de {{tramite}} con folio {{folio}} para {{agencia}}.

[Escribe aquí lo que necesitas o el estado del trámite]

Quedamos pendientes de tu respuesta para continuar.`

export type Plantilla = {
  id: number
  tipoTramite: string
  cuerpo: string
  activa: boolean
  actualizadaPor: string | null
  actualizadaEn: Date
}

function aPlantilla(f: typeof schema.plantillasCorreo.$inferSelect): Plantilla {
  return {
    id: f.id,
    tipoTramite: f.tipoTramite,
    cuerpo: f.cuerpoHtml,
    activa: f.activa,
    actualizadaPor: f.actualizadaPor,
    actualizadaEn: f.actualizadaEn,
  }
}

export async function listarPlantillas(): Promise<Plantilla[]> {
  const filas = await getDb()
    .select()
    .from(schema.plantillasCorreo)
    .orderBy(asc(schema.plantillasCorreo.tipoTramite))
  return filas.map(aPlantilla)
}

/** La del trámite si existe; si no, la general; si no hay ninguna, el borrador. */
export async function leerPlantilla(tipoTramite: string | null): Promise<string> {
  const db = getDb()

  if (tipoTramite?.trim()) {
    const [propia] = await db
      .select()
      .from(schema.plantillasCorreo)
      .where(eq(schema.plantillasCorreo.tipoTramite, tipoTramite.trim()))
      .limit(1)
    if (propia?.activa) return propia.cuerpoHtml
  }

  const [general] = await db
    .select()
    .from(schema.plantillasCorreo)
    .where(eq(schema.plantillasCorreo.tipoTramite, PLANTILLA_GENERAL))
    .limit(1)

  return general?.cuerpoHtml ?? BORRADOR
}

export async function guardarPlantilla(
  tipoTramite: string,
  cuerpo: string,
  correoUsuario: string,
): Promise<void> {
  await getDb()
    .insert(schema.plantillasCorreo)
    .values({
      tipoTramite,
      asuntoPlantilla: '', // el asunto lo fija la app, no la plantilla
      cuerpoHtml: cuerpo,
      activa: true,
      actualizadaPor: correoUsuario,
      actualizadaEn: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.plantillasCorreo.tipoTramite,
      set: { cuerpoHtml: cuerpo, actualizadaPor: correoUsuario, actualizadaEn: new Date() },
    })
}

/** Idempotente: no sobrescribe una plantilla que ya editó alguien. */
export async function sembrarPlantillas(): Promise<number> {
  const db = getDb()
  const tipos = [PLANTILLA_GENERAL, ...TIPOS_OBSERVADOS]
  let creadas = 0

  for (const tipo of tipos) {
    const resultado = await db
      .insert(schema.plantillasCorreo)
      .values({
        tipoTramite: tipo,
        asuntoPlantilla: '',
        cuerpoHtml: BORRADOR,
        activa: true,
        actualizadaPor: null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.plantillasCorreo.id })
    creadas += resultado.length
  }

  return creadas
}
