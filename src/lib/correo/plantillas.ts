import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { esSiniestro } from '@/lib/casos/area'

/** Clave de la plantilla que se usa cuando el trámite no tiene una propia. */
export const PLANTILLA_GENERAL = 'General'

/**
 * Clave de la plantilla del ramo de siniestros.
 *
 * Ocupa la columna `tipo_tramite` de la tabla como cualquier otra, aunque no sea un
 * trámite: la tabla ya está llave-valor por esa columna y agregar una segunda
 * dimensión para un solo caso sería peor. Los siniestros no traen tipo de trámite
 * —0 de 268—, así que su plantilla se pide por clave y no por el trámite del caso.
 */
export const PLANTILLA_SINIESTROS = 'Siniestros'

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

/**
 * Borrador del ramo. Es un borrador de verdad: el texto bueno lo escribe quien
 * atiende siniestros, desde los ajustes del módulo. Trae las variables del ramo
 * puestas para que se vea de dónde sale cada dato.
 */
const BORRADOR_SINIESTROS = `Estimado(a) {{solicitante}},

Reciba un cordial saludo. Le escribo para dar seguimiento al siniestro {{numeroSiniestro}} de la póliza {{poliza}} con {{aseguradora}}, a nombre de {{cliente}}, registrado con el folio {{folio}}.

[Escribe aquí el estado del siniestro y el siguiente paso]

Quedo a sus órdenes para cualquier duda o para acompañarle en lo que necesite.`

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

/**
 * La plantilla que le toca a un caso.
 *
 * Un siniestro pide la suya por clave: no tiene tipo de trámite del que colgar la
 * búsqueda, así que sin esto caería en la plantilla General de la mesa, que habla de
 * trámites y no de siniestros.
 */
export async function leerPlantillaDeCaso(caso: {
  area: string | null
  tipoTramite: string | null
}): Promise<string> {
  return leerPlantilla(esSiniestro(caso) ? PLANTILLA_SINIESTROS : caso.tipoTramite)
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

  for (const tipo of [...tipos, PLANTILLA_SINIESTROS]) {
    const resultado = await db
      .insert(schema.plantillasCorreo)
      .values({
        tipoTramite: tipo,
        asuntoPlantilla: '',
        cuerpoHtml: tipo === PLANTILLA_SINIESTROS ? BORRADOR_SINIESTROS : BORRADOR,
        activa: true,
        actualizadaPor: null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.plantillasCorreo.id })
    creadas += resultado.length
  }

  return creadas
}
