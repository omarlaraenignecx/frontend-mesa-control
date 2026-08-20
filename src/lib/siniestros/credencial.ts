import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { cifrar } from '@/lib/crypto/secreto'

export type CredencialSiniestros = typeof schema.credencialesSiniestros.$inferSelect

function claveDeCifrado(): string {
  const clave = process.env.CREDENCIAL_ENC_KEY
  if (!clave) throw new Error('Falta CREDENCIAL_ENC_KEY: no se puede cifrar la credencial.')
  return clave
}

/**
 * Guarda el consentimiento de un buzón de siniestros.
 *
 * `correo` es el buzón que **Google** reportó, no el del usuario en sesión: quien da
 * el consentimiento puede estar firmado en la aplicación con una cuenta y elegir otra
 * en la pantalla de Google, y registrar la equivocada haría que el módulo enviara
 * desde un buzón a nombre de otra persona.
 */
export async function guardarCredencialSiniestros(
  correo: string,
  refreshToken: string,
  scopes: string[],
  autorizadoPor: string,
): Promise<void> {
  const cifrado = cifrar(refreshToken, claveDeCifrado())
  await getDb()
    .insert(schema.credencialesSiniestros)
    .values({
      correo,
      refreshTokenCifrado: cifrado,
      scopes,
      autorizadoPor,
      ultimoError: null,
    })
    .onConflictDoUpdate({
      target: schema.credencialesSiniestros.correo,
      set: {
        refreshTokenCifrado: cifrado,
        scopes,
        autorizadoPor,
        autorizadoEn: new Date(),
        ultimoError: null,
      },
    })
}

export async function leerCredencialSiniestros(
  correo: string,
): Promise<CredencialSiniestros | null> {
  const [fila] = await getDb()
    .select()
    .from(schema.credencialesSiniestros)
    .where(eq(schema.credencialesSiniestros.correo, correo))
    .limit(1)
  return fila ?? null
}

export async function listarCredencialesSiniestros(): Promise<CredencialSiniestros[]> {
  return getDb()
    .select()
    .from(schema.credencialesSiniestros)
    .orderBy(asc(schema.credencialesSiniestros.correo))
}

export async function quitarCredencialSiniestros(correo: string): Promise<void> {
  await getDb()
    .delete(schema.credencialesSiniestros)
    .where(eq(schema.credencialesSiniestros.correo, correo))
}

export async function marcarUsoSiniestros(correo: string): Promise<void> {
  await getDb()
    .update(schema.credencialesSiniestros)
    .set({ ultimoUso: new Date(), ultimoError: null })
    .where(eq(schema.credencialesSiniestros.correo, correo))
}

export async function registrarErrorSiniestros(correo: string, mensaje: string): Promise<void> {
  await getDb()
    .update(schema.credencialesSiniestros)
    .set({ ultimoError: mensaje })
    .where(eq(schema.credencialesSiniestros.correo, correo))
}
