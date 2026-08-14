import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // La conexión directa y no la agrupada: el pooler de Supabase corre en modo
  // transacción y no admite las sentencias preparadas que usa drizzle-kit, así
  // que `push` se queda colgado en "Pulling schema from database" para siempre.
  // La aplicación sí usa la agrupada, con `prepare: false` (ver src/db/index.ts).
  dbCredentials: { url: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL! },
})
