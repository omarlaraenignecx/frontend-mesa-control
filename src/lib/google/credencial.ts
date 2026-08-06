import { eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { cifrar } from '@/lib/crypto/secreto'

/** Hay una sola credencial de mesa en todo el sistema. */
const ID_UNICO = 1

function claveDeCifrado(): string {
  const clave = process.env.CREDENCIAL_ENC_KEY
  if (!clave) throw new Error('Falta CREDENCIAL_ENC_KEY: no se puede cifrar la credencial.')
  return clave
}

export async function guardarCredencial(
  refreshToken: string,
  scopes: string[],
  autorizadoPor: string,
): Promise<void> {
  const cifrado = cifrar(refreshToken, claveDeCifrado())
  await getDb()
    .insert(schema.credencialMesa)
    .values({
      id: ID_UNICO,
      refreshTokenCifrado: cifrado,
      scopes,
      autorizadoPor,
      ultimoError: null,
    })
    .onConflictDoUpdate({
      target: schema.credencialMesa.id,
      set: {
        refreshTokenCifrado: cifrado,
        scopes,
        autorizadoPor,
        autorizadoEn: new Date(),
        ultimoError: null,
      },
    })
}

export async function leerCredencial() {
  const [fila] = await getDb()
    .select()
    .from(schema.credencialMesa)
    .where(eq(schema.credencialMesa.id, ID_UNICO))
    .limit(1)
  return fila ?? null
}

export async function registrarErrorCredencial(mensaje: string): Promise<void> {
  await getDb()
    .update(schema.credencialMesa)
    .set({ ultimoError: mensaje })
    .where(eq(schema.credencialMesa.id, ID_UNICO))
}

export async function marcarUso(): Promise<void> {
  await getDb()
    .update(schema.credencialMesa)
    .set({ ultimoUso: new Date(), ultimoError: null })
    .where(eq(schema.credencialMesa.id, ID_UNICO))
}
