import { descifrar } from '@/lib/crypto/secreto'
import { accessTokenDeLaMesa, intercambiarRefreshToken } from '@/lib/google/auth-mesa'
import { CORREO_MESA } from '@/lib/casos/hilo'
import {
  buzonProvisional,
  cuentaActiva,
  leerFicha,
  type Ficha,
} from './ejecutivos'
import {
  leerCredencialSiniestros,
  marcarUsoSiniestros,
  registrarErrorSiniestros,
} from './credencial'

/**
 * Lo único que el módulo pide sobre la cuenta de su ejecutivo: correo, nada más.
 *
 * **No** se piden `spreadsheets` ni Drive. La hoja y los archivos siguen pasando por
 * la credencial de `mesadecontrol@`, que ya está autorizada y funciona. Así el dueño
 * del buzón concede lo mínimo para que su correo funcione y nada más, que es lo que
 * hace razonable pedirle el consentimiento sobre su cuenta personal de trabajo.
 */
export const SCOPES_SINIESTROS = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
] as const

export function scopesFaltantesSiniestros(otorgados: string[]): string[] {
  return SCOPES_SINIESTROS.filter((s) => !otorgados.includes(s))
}

export class SinCuentaSiniestrosError extends Error {
  constructor() {
    super(
      'El módulo de Atención a Siniestros todavía no tiene una cuenta de correo autorizada. ' +
        'Se autoriza desde los ajustes del módulo.',
    )
    this.name = 'SinCuentaSiniestrosError'
  }
}

/**
 * Desde qué buzón escribe y lee el módulo en este momento.
 *
 * `provisional` es lo importante de este tipo. Cuando vale `true`, el correo está
 * saliendo de `mesadecontrol@` porque nadie ha autorizado la cuenta del ramo todavía
 * y alguien encendió el interruptor a mano para poder probar. Quien reciba este objeto
 * **tiene que decirlo en pantalla**: un módulo que cae al buzón de la mesa en silencio
 * es precisamente el error que este módulo existe para evitar.
 */
export type BuzonSiniestros = {
  accessToken: string
  correo: string
  provisional: boolean
  /** La ficha con la que se firma. Puede faltar si nadie ha designado ejecutivo. */
  ficha: Ficha | null
}

/**
 * Resuelve el buzón del módulo, en este orden y sin atajos:
 *
 * 1. La cuenta designada, si tiene credencial. Siempre se prefiere a lo provisional:
 *    de otro modo, un interruptor olvidado encendido mandaría los correos por la mesa
 *    aunque el ejecutivo ya hubiera autorizado el suyo.
 * 2. El buzón de la mesa, solo si alguien encendió el provisional a propósito.
 * 3. Error. **No** cae al buzón de la mesa por descuido: preferimos que el envío falle
 *    con un mensaje claro antes que salir de una cuenta que no corresponde.
 */
export async function buzonDeSiniestros(): Promise<BuzonSiniestros> {
  const activa = await cuentaActiva()
  const ficha = activa ? await leerFicha(activa) : null
  const credencial = activa ? await leerCredencialSiniestros(activa) : null

  if (activa && credencial) {
    const clave = process.env.CREDENCIAL_ENC_KEY
    if (!clave) throw new Error('Falta CREDENCIAL_ENC_KEY: no se puede descifrar la credencial.')
    try {
      const accessToken = await intercambiarRefreshToken(
        descifrar(credencial.refreshTokenCifrado, clave),
        {
          fetch: globalThis.fetch,
          clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        },
      )
      await marcarUsoSiniestros(activa)
      return { accessToken, correo: activa, provisional: false, ficha }
    } catch (e) {
      await registrarErrorSiniestros(activa, e instanceof Error ? e.message : 'Error desconocido')
      throw e
    }
  }

  if (await buzonProvisional()) {
    return {
      accessToken: await accessTokenDeLaMesa(),
      correo: CORREO_MESA,
      provisional: true,
      ficha,
    }
  }

  throw new SinCuentaSiniestrosError()
}

export type EstadoBuzon =
  | { estado: 'sin-cuenta'; provisionalEncendido: false }
  | { estado: 'provisional'; correo: string; ficha: Ficha | null }
  | {
      estado: 'propio'
      correo: string
      ficha: Ficha | null
      faltantes: string[]
      autorizadoPor: string
      autorizadoEn: Date
      ultimoError: string | null
    }

/**
 * Lo mismo que `buzonDeSiniestros` pero para pintar una pantalla: no canjea el token
 * ni lanza. Sirve para decirle al usuario en qué estado está el módulo sin gastar una
 * llamada a Google en cada carga de los ajustes.
 */
export async function estadoDelBuzon(): Promise<EstadoBuzon> {
  const activa = await cuentaActiva()
  const ficha = activa ? await leerFicha(activa) : null
  const credencial = activa ? await leerCredencialSiniestros(activa) : null

  if (activa && credencial) {
    return {
      estado: 'propio',
      correo: activa,
      ficha,
      faltantes: scopesFaltantesSiniestros(credencial.scopes),
      autorizadoPor: credencial.autorizadoPor,
      autorizadoEn: credencial.autorizadoEn,
      ultimoError: credencial.ultimoError,
    }
  }
  if (await buzonProvisional()) {
    return { estado: 'provisional', correo: CORREO_MESA, ficha }
  }
  return { estado: 'sin-cuenta', provisionalEncendido: false }
}
