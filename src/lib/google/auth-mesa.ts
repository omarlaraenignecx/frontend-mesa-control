import { descifrar } from '@/lib/crypto/secreto'
import { leerCredencial, marcarUso, registrarErrorCredencial } from './credencial'

/** Los únicos permisos que la herramienta pide sobre la cuenta de la mesa. */
export const SCOPES_MESA = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
] as const

const ENDPOINT_TOKEN = 'https://oauth2.googleapis.com/token'

export class SinCredencialMesaError extends Error {
  constructor() {
    super('La Mesa de Control aún no ha autorizado el acceso a Google.')
    this.name = 'SinCredencialMesaError'
  }
}

export class CredencialMesaRevocadaError extends Error {
  constructor() {
    super('El acceso a Google fue revocado o expiró; hay que volver a autorizarlo.')
    this.name = 'CredencialMesaRevocadaError'
  }
}

export type DepsToken = {
  fetch: typeof globalThis.fetch
  clientId: string
  clientSecret: string
}

/** Recibe su `fetch` por parámetro para poder probarse sin red. */
export async function intercambiarRefreshToken(
  refreshToken: string,
  deps: DepsToken,
): Promise<string> {
  const respuesta = await deps.fetch(ENDPOINT_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: deps.clientId,
      client_secret: deps.clientSecret,
    }).toString(),
  })

  const cuerpo = (await respuesta.json().catch(() => ({}))) as {
    access_token?: string
    error?: string
  }

  if (!respuesta.ok) {
    if (cuerpo.error === 'invalid_grant') throw new CredencialMesaRevocadaError()
    throw new Error(`Google respondió ${respuesta.status} al renovar el token de la mesa.`)
  }
  if (!cuerpo.access_token) {
    throw new Error('Google respondió sin access_token al renovar el token de la mesa.')
  }
  return cuerpo.access_token
}

/** Única puerta por la que el resto de la aplicación obtiene acceso a Google. */
export async function accessTokenDeLaMesa(): Promise<string> {
  const credencial = await leerCredencial()
  if (!credencial) throw new SinCredencialMesaError()

  const clave = process.env.CREDENCIAL_ENC_KEY
  if (!clave) throw new Error('Falta CREDENCIAL_ENC_KEY: no se puede descifrar la credencial.')

  const refreshToken = descifrar(credencial.refreshTokenCifrado, clave)

  try {
    const token = await intercambiarRefreshToken(refreshToken, {
      fetch: globalThis.fetch,
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    })
    await marcarUso()
    return token
  } catch (e) {
    await registrarErrorCredencial(e instanceof Error ? e.message : 'Error desconocido')
    throw e
  }
}
