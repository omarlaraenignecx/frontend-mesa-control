import { describe, expect, it } from 'vitest'
import { razonDeGoogle } from './error-google'

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
