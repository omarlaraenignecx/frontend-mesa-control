import { describe, expect, it } from 'vitest'
import { esCeldaProtegida, mensajeDeGoogle, razonDeGoogle } from './error-google'

describe('razonDeGoogle', () => {
  it('devuelve la explicación que trae el cuerpo de error de la API', async () => {
    const respuesta = new Response(
      JSON.stringify({
        error: {
          code: 400,
          message: 'Unable to parse range: Respuestas de formulario 1!N0',
          status: 'INVALID_ARGUMENT',
        },
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
    expect(await razonDeGoogle(respuesta)).toBe(
      ' Google explicó: «Unable to parse range: Respuestas de formulario 1!N0»',
    )
  })

  it('no aporta nada cuando el cuerpo no es JSON', async () => {
    const respuesta = new Response('<html>502 Bad Gateway</html>', { status: 502 })
    expect(await razonDeGoogle(respuesta)).toBe('')
  })

  it('no aporta nada cuando el JSON no trae mensaje', async () => {
    const respuesta = new Response(JSON.stringify({ error: { code: 400 } }), { status: 400 })
    expect(await razonDeGoogle(respuesta)).toBe('')
  })

  it('ignora un mensaje en blanco en vez de anunciar comillas vacías', async () => {
    const respuesta = new Response(JSON.stringify({ error: { message: '   ' } }), { status: 400 })
    expect(await razonDeGoogle(respuesta)).toBe('')
  })

  /**
   * Corre dentro de la construcción de un error: si lanzara, taparía el error de
   * verdad con uno suyo y se perdería hasta el número de estado.
   */
  it('no lanza cuando el cuerpo ya se había consumido', async () => {
    const respuesta = new Response(JSON.stringify({ error: { message: 'tarde' } }), { status: 400 })
    await respuesta.text()
    expect(await razonDeGoogle(respuesta)).toBe('')
  })
})

describe('mensajeDeGoogle', () => {
  it('devuelve el mensaje crudo, sin envolverlo', async () => {
    const respuesta = new Response(JSON.stringify({ error: { message: 'No such column' } }), {
      status: 400,
    })
    expect(await mensajeDeGoogle(respuesta)).toBe('No such column')
  })

  it('devuelve null cuando no hay mensaje que leer', async () => {
    expect(await mensajeDeGoogle(new Response('nada', { status: 500 }))).toBeNull()
  })
})

/**
 * Sheets contesta este error **en el idioma de la cuenta**, y la API de valores no
 * trae ningún código que lo distinga: la única señal es el texto. Por eso el
 * reconocimiento busca la raíz de la palabra en los dos idiomas en que puede
 * llegarnos, y por eso el mensaje original viaja igual aunque esto falle.
 */
describe('esCeldaProtegida', () => {
  it('reconoce el rechazo tal como lo manda Sheets en español', () => {
    expect(
      esCeldaProtegida(
        'Invalid data[0]: Estás intentando modificar una celda o un objeto protegido. Si necesitas realizar cambios, comunícate con el propietario de la hoja de cálculo para que quite la protección.',
      ),
    ).toBe(true)
  })

  it('reconoce el mismo rechazo en inglés', () => {
    expect(
      esCeldaProtegida(
        'Invalid data[0]: You are trying to edit a protected cell or object. Please contact the spreadsheet owner to remove protection if you need to edit.',
      ),
    ).toBe(true)
  })

  it('no confunde otros errores de la API', () => {
    expect(esCeldaProtegida('Unable to parse range: Respuestas de formulario 1!N0')).toBe(false)
    expect(esCeldaProtegida(null)).toBe(false)
  })
})
