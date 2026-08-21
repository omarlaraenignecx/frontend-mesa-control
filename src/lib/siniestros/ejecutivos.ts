import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'

/**
 * La ficha con la que firma un correo de siniestros. Es lo que el cliente lee al
 * final del mensaje, así que sale de la base y no del código: el área la corrige sin
 * esperar un despliegue.
 */
export type Ficha = {
  correo: string
  nombre: string
  puesto: string
  telefono: string
}

/**
 * Los datos que dio el área el 20 de agosto de 2026. Se siembran para que el módulo
 * pueda firmar desde el primer correo, incluso antes de que su dueño autorice el
 * buzón; él los corrige desde la aplicación si algo cambia.
 */
export const FICHA_JOSE: Ficha = {
  correo: 'jose.mendoza@gplusseguros.mx',
  nombre: 'Jose Juan Mendoza Diaz',
  puesto: 'Ejecutivo de siniestros',
  telefono: '55 4884 2862',
}

/** Quién es el ejecutivo del módulo: el que envía y el que firma. */
export const CLAVE_CUENTA_ACTIVA = 'siniestros:cuenta-activa'

/**
 * Si el módulo está usando provisionalmente el buzón de la Mesa de Control.
 *
 * Apagado por omisión y nunca silencioso: existe para poder probar el módulo sin su
 * ejecutivo disponible, y un módulo que cae al buzón de la mesa sin avisar es
 * exactamente el error que este módulo existe para evitar.
 */
export const CLAVE_BUZON_PROVISIONAL = 'siniestros:buzon-provisional'

async function leerAjuste(clave: string): Promise<string | null> {
  const [fila] = await getDb()
    .select()
    .from(schema.ajustesApp)
    .where(eq(schema.ajustesApp.clave, clave))
    .limit(1)
  return fila?.valor ?? null
}

async function guardarAjuste(clave: string, valor: string): Promise<void> {
  await getDb()
    .insert(schema.ajustesApp)
    .values({ clave, valor })
    .onConflictDoUpdate({ target: schema.ajustesApp.clave, set: { valor } })
}

function aFicha(f: typeof schema.ejecutivosSiniestros.$inferSelect): Ficha {
  return { correo: f.correo, nombre: f.nombre, puesto: f.puesto, telefono: f.telefono }
}

export async function listarEjecutivos(): Promise<Ficha[]> {
  const filas = await getDb()
    .select()
    .from(schema.ejecutivosSiniestros)
    .orderBy(asc(schema.ejecutivosSiniestros.correo))
  return filas.map(aFicha)
}

export async function leerFicha(correo: string): Promise<Ficha | null> {
  const [fila] = await getDb()
    .select()
    .from(schema.ejecutivosSiniestros)
    .where(eq(schema.ejecutivosSiniestros.correo, correo))
    .limit(1)
  return fila ? aFicha(fila) : null
}

export async function guardarFicha(ficha: Ficha, por: string): Promise<void> {
  await getDb()
    .insert(schema.ejecutivosSiniestros)
    .values({ ...ficha, actualizadoPor: por, actualizadoEn: new Date() })
    .onConflictDoUpdate({
      target: schema.ejecutivosSiniestros.correo,
      set: {
        nombre: ficha.nombre,
        puesto: ficha.puesto,
        telefono: ficha.telefono,
        actualizadoPor: por,
        actualizadoEn: new Date(),
      },
    })
}

/**
 * Deja la ficha del ejecutivo conocido y, si nadie está designado, lo designa.
 *
 * Idempotente por `onConflictDoNothing`: una ficha que el área ya corrigió no se
 * pisa. Se llama al abrir los ajustes del módulo, como la siembra de plantillas.
 */
export async function sembrarEjecutivos(): Promise<void> {
  await getDb()
    .insert(schema.ejecutivosSiniestros)
    .values({ ...FICHA_JOSE, actualizadoPor: null })
    .onConflictDoNothing({ target: schema.ejecutivosSiniestros.correo })

  if ((await cuentaActiva()) === null) await activarCuenta(FICHA_JOSE.correo)
}

export async function cuentaActiva(): Promise<string | null> {
  return leerAjuste(CLAVE_CUENTA_ACTIVA)
}

export async function activarCuenta(correo: string): Promise<void> {
  await guardarAjuste(CLAVE_CUENTA_ACTIVA, correo)
}

export async function buzonProvisional(): Promise<boolean> {
  return (await leerAjuste(CLAVE_BUZON_PROVISIONAL)) === 'si'
}

export async function guardarBuzonProvisional(encendido: boolean): Promise<void> {
  await guardarAjuste(CLAVE_BUZON_PROVISIONAL, encendido ? 'si' : 'no')
}
