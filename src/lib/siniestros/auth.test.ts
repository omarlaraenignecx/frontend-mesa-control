import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SCOPES_SINIESTROS, scopesFaltantesSiniestros } from './auth'

const FUENTE = readFileSync(join(import.meta.dirname, 'auth.ts'), 'utf8')
/** Sin comentarios: los de este archivo nombran las mismas funciones que se miden. */
const CODIGO = FUENTE.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim()))
  .join('\n')

describe('permisos que pide el módulo', () => {
  it('son solo de correo: ni la hoja ni Drive', () => {
    // Lo que hace razonable pedirle a una persona el consentimiento sobre su cuenta
    // de trabajo. La hoja y los archivos siguen pasando por la cuenta de la mesa.
    expect(SCOPES_SINIESTROS).toHaveLength(3)
    for (const s of SCOPES_SINIESTROS) expect(s).toContain('/auth/gmail.')
    expect(SCOPES_SINIESTROS.join(' ')).not.toContain('spreadsheets')
    expect(SCOPES_SINIESTROS.join(' ')).not.toContain('drive')
  })

  it('detecta un permiso que la credencial guardada no tiene', () => {
    const otorgados = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ]
    expect(scopesFaltantesSiniestros(otorgados)).toEqual([
      'https://www.googleapis.com/auth/gmail.modify',
    ])
    expect(scopesFaltantesSiniestros([...SCOPES_SINIESTROS])).toEqual([])
  })
})

describe('de qué buzón escribe el módulo', () => {
  it('la cuenta propia se prefiere siempre a la provisional', () => {
    // Un interruptor olvidado encendido no debe desviar los correos por la mesa
    // cuando el ejecutivo ya autorizó el suyo.
    const propia = CODIGO.indexOf('if (activa && credencial)')
    const provisional = CODIGO.indexOf('if (await buzonProvisional())')
    expect(propia).toBeGreaterThan(0)
    expect(provisional).toBeGreaterThan(propia)
  })

  it('sin cuenta y sin provisional lanza, no cae al buzón de la mesa', () => {
    // Preferimos que el envío falle con un mensaje claro antes que salir de una
    // cuenta que no corresponde: eso es lo que el módulo existe para evitar. Se mide
    // dentro de la función que resuelve el buzón, no en todo el archivo: la que
    // pinta la pantalla también consulta el provisional y no lanza nunca.
    const resolver = CODIGO.slice(
      CODIGO.indexOf('export async function buzonDeSiniestros'),
      CODIGO.indexOf('export type EstadoBuzon'),
    )
    expect(resolver).toContain('throw new SinCuentaSiniestrosError()')
    expect(resolver.indexOf('throw new SinCuentaSiniestrosError()')).toBeGreaterThan(
      resolver.indexOf('buzonProvisional()'),
    )
  })

  it('marca en el resultado cuando el buzón es provisional', () => {
    // Para que la interfaz pueda decirlo. Un módulo que cae al buzón de la mesa en
    // silencio es el error que este módulo existe para evitar.
    expect(CODIGO).toContain('provisional: true')
    expect(CODIGO).toContain('provisional: false')
  })

  it('registra el error en la credencial cuando Google la rechaza', () => {
    expect(CODIGO).toContain('registrarErrorSiniestros(activa')
    expect(CODIGO).toContain('marcarUsoSiniestros(activa)')
  })

  it('el estado para la pantalla no canjea el token ni lanza', () => {
    const estado = CODIGO.slice(CODIGO.indexOf('export async function estadoDelBuzon'))
    expect(estado).not.toContain('intercambiarRefreshToken')
    expect(estado).not.toContain('throw')
  })
})
