import { usuarioActual } from '@/lib/auth/usuarios'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { leerTituloHoja } from '@/lib/google/sheet-ping'

export async function GET() {
  await usuarioActual()
  try {
    const accessToken = await accessTokenDeLaMesa()
    const titulo = await leerTituloHoja(process.env.SHEET_ID!, {
      fetch: globalThis.fetch,
      accessToken,
    })
    return Response.json({ ok: true, titulo })
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' },
      { status: 200 },
    )
  }
}
