import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El middleware de Next.js corre en el runtime edge, donde el driver `postgres`
 * (sockets TCP de Node) no funciona. Si el grafo de imports del middleware
 * alcanza la base de datos, los callbacks jwt/session de Auth.js fallan en edge
 * con JWTSessionError y el usuario nunca obtiene sesión.
 *
 * Esta prueba recorre los imports locales y falla si alguno llega a la base.
 */

const RAIZ = path.resolve(__dirname, '../../..')
const PROHIBIDOS = ['postgres', 'drizzle-orm/postgres-js', '@/db']

function resolverModulo(especificador: string, desde: string): string | null {
  let base: string
  if (especificador.startsWith('@/')) {
    base = path.join(RAIZ, 'src', especificador.slice(2))
  } else if (especificador.startsWith('.')) {
    base = path.resolve(path.dirname(desde), especificador)
  } else {
    return null // dependencia externa: no se recorre
  }

  for (const candidato of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    try {
      const contenido = readFileSync(candidato, 'utf8')
      if (contenido) return candidato
    } catch {
      continue
    }
  }
  return null
}

function importsDe(archivo: string): string[] {
  const fuente = readFileSync(archivo, 'utf8')
  const especificadores: string[] = []
  const patron = /(?:from\s+|import\s+)['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = patron.exec(fuente)) !== null) especificadores.push(m[1])
  return especificadores
}

/** Devuelve la cadena de imports que lleva del punto de entrada a la base, o null. */
function rutaHastaLaBase(entrada: string): string[] | null {
  const visitados = new Set<string>()
  const pila: { archivo: string; cadena: string[] }[] = [
    { archivo: entrada, cadena: [path.relative(RAIZ, entrada)] },
  ]

  while (pila.length > 0) {
    const { archivo, cadena } = pila.pop()!
    if (visitados.has(archivo)) continue
    visitados.add(archivo)

    for (const especificador of importsDe(archivo)) {
      if (PROHIBIDOS.includes(especificador)) {
        return [...cadena, especificador]
      }
      const resuelto = resolverModulo(especificador, archivo)
      if (resuelto) {
        pila.push({ archivo: resuelto, cadena: [...cadena, path.relative(RAIZ, resuelto)] })
      }
    }
  }
  return null
}

describe('seguridad del runtime edge', () => {
  it('el middleware no alcanza la base de datos por ningún camino de imports', () => {
    const ruta = rutaHastaLaBase(path.join(RAIZ, 'src/middleware.ts'))
    expect(
      ruta,
      ruta ? `El middleware llega a la base así: ${ruta.join(' -> ')}` : '',
    ).toBeNull()
  })

  it('la configuración compartida de Auth.js tampoco alcanza la base de datos', () => {
    const ruta = rutaHastaLaBase(path.join(RAIZ, 'src/auth.config.ts'))
    expect(
      ruta,
      ruta ? `auth.config.ts llega a la base así: ${ruta.join(' -> ')}` : '',
    ).toBeNull()
  })

  it('en cambio la configuración completa sí usa la base, que es donde vive la allowlist', () => {
    expect(rutaHastaLaBase(path.join(RAIZ, 'src/auth.ts'))).not.toBeNull()
  })
})
