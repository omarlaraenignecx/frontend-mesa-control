import { describe, expect, it, vi } from 'vitest'
import { CredencialMesaRevocadaError, SCOPES_MESA, intercambiarRefreshToken } from './auth-mesa'

function fetchQueResponde(status: number, cuerpo: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch
}

const DEPS = { clientId: 'id-cliente', clientSecret: 'secreto-cliente' }

describe('SCOPES_MESA', () => {
  it('pide exactamente los cinco scopes del diseño, sin Forms ni Calendar', () => {
    expect([...SCOPES_MESA]).toEqual([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ])
  })
})

describe('intercambiarRefreshToken', () => {
  it('devuelve el access token que responde Google', async () => {
    const fetchMock = fetchQueResponde(200, { access_token: 'ya29.token', expires_in: 3599 })
    const token = await intercambiarRefreshToken('1//refresh', { ...DEPS, fetch: fetchMock })
    expect(token).toBe('ya29.token')
  })

  it('envía el refresh token y las credenciales del cliente al endpoint de Google', async () => {
    const fetchMock = fetchQueResponde(200, { access_token: 'ya29.token' })
    await intercambiarRefreshToken('1//refresh', { ...DEPS, fetch: fetchMock })

    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const cuerpo = new URLSearchParams(init.body as string)
    expect(cuerpo.get('grant_type')).toBe('refresh_token')
    expect(cuerpo.get('refresh_token')).toBe('1//refresh')
    expect(cuerpo.get('client_id')).toBe('id-cliente')
    expect(cuerpo.get('client_secret')).toBe('secreto-cliente')
  })

  it('lanza CredencialMesaRevocadaError cuando Google responde invalid_grant', async () => {
    const fetchMock = fetchQueResponde(400, { error: 'invalid_grant' })
    await expect(
      intercambiarRefreshToken('1//revocado', { ...DEPS, fetch: fetchMock }),
    ).rejects.toBeInstanceOf(CredencialMesaRevocadaError)
  })

  it('lanza un error legible ante cualquier otra falla de Google', async () => {
    const fetchMock = fetchQueResponde(500, { error: 'internal' })
    await expect(
      intercambiarRefreshToken('1//refresh', { ...DEPS, fetch: fetchMock }),
    ).rejects.toThrow(/Google respondió 500/)
  })

  it('lanza error si Google responde 200 pero sin access token', async () => {
    const fetchMock = fetchQueResponde(200, { expires_in: 3599 })
    await expect(
      intercambiarRefreshToken('1//refresh', { ...DEPS, fetch: fetchMock }),
    ).rejects.toThrow(/sin access_token/)
  })
})
