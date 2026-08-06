import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: PostgresJsDatabase<typeof schema> | null = null

/**
 * Inicialización diferida para que `next build` no falle cuando la variable de
 * conexión todavía no existe. No usar un Proxy aquí: rompe las librerías que
 * inspeccionan el objeto de base.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db
  const url = process.env.POSTGRES_URL
  if (!url) throw new Error('Falta POSTGRES_URL: la base de datos no está configurada.')
  _db = drizzle(postgres(url, { prepare: false }), { schema })
  return _db
}

export { schema }
