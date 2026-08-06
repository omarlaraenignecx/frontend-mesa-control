# Etapa 0 — Cimientos y accesos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar en pie una aplicación Next.js desplegada en Vercel donde los cinco correos autorizados entran, cualquier otro es rechazado, y la aplicación puede operar Google Sheets, Drive y Gmail con la identidad de `mesadecontrol@gplusseguros.mx` mediante un consentimiento OAuth aprobado por el administrador.

**Architecture:** Next.js 16 App Router con Server Components. Dos identidades separadas: los usuarios entran con Auth.js v5 (sesión JWT, sin adaptador de base) validados contra una allowlist en Postgres; la aplicación opera Google con un refresh token único de `mesadecontrol@` guardado cifrado con AES-256-GCM en Supabase. Toda llamada a Google pasa por un solo módulo (`lib/google/auth-mesa.ts`) que intercambia ese refresh token por un access token de vida corta.

**Tech Stack:** Next.js 16, TypeScript estricto, pnpm, Tailwind CSS 4, shadcn/ui, Auth.js v5 (`next-auth@beta`), Supabase Postgres, Drizzle ORM, Vitest, Vercel.

## Global Constraints

- Gestor de paquetes: **pnpm**. Nunca `npm install` ni `yarn`.
- Runtime de Vercel: **Node**. Prohibido `export const runtime = 'edge'`.
- TypeScript en modo estricto. Prohibido `any` explícito salvo en pruebas con justificación en comentario.
- Proyecto GCP: `mesa-de-control-504618`. Organización padre: `1029986595993`.
- Hoja de **desarrollo**: `1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ` ("Prueba formulario mesa de control").
- Hoja **productiva**: `1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0`. **No se escribe en ella en ninguna etapa antes de la 4.**
- Pestaña de trabajo: `Respuestas de formulario 1`, encabezados en fila 1, datos desde fila 2.
- Scopes OAuth de la mesa, exactamente estos cinco: `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive.readonly`, `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.modify`.
- Dominio de login permitido: `gplusseguros.mx`. Además allowlist explícita; el dominio por sí solo no autoriza.
- Allowlist y su mapeo al catálogo `KE` de la hoja:

  | Correo | `nombre_en_hoja` | `rol` |
  | --- | --- | --- |
  | `keynor.rivas@gplusseguros.mx` | `Keynor` | `operador` |
  | `patricia.ramirez@gplusseguros.mx` | `Paty` | `operador` |
  | `norma.zacarias@gplusseguros.mx` | `Norma` | `operador` |
  | `juan.palafox@gplusseguros.mx` | `José Juan` | `operador` |
  | `mesadecontrol@gplusseguros.mx` | `null` | `admin` |

- Ningún secreto en el repositorio. `.env.local` está en `.gitignore`; las variables viven en Vercel.
- Todo texto visible al usuario en español, con acentuación correcta.
- Repositorio remoto: `https://github.com/omarlaraenignecx/frontend-mesa-control.git`
- Equipo de Vercel: `omarlara-1860's projects`.

---

## File Structure

| Archivo | Responsabilidad |
| --- | --- |
| `package.json`, `tsconfig.json`, `next.config.ts` | Configuración del proyecto |
| `vitest.config.ts` | Configuración de pruebas |
| `.env.example` | Nombres de todas las variables, sin valores |
| `src/db/schema.ts` | Esquema Drizzle: las 7 tablas del diseño |
| `src/db/index.ts` | Cliente Drizzle con inicialización diferida |
| `src/db/seed-usuarios.ts` | Siembra de la allowlist |
| `drizzle.config.ts` | Configuración de migraciones |
| `src/lib/crypto/secreto.ts` | Cifrado y descifrado AES-256-GCM del refresh token |
| `src/lib/auth/allowlist.ts` | Resolución pura de un correo contra la allowlist |
| `src/lib/auth/usuarios.ts` | Consulta de la allowlist en base |
| `src/auth.ts` | Configuración de Auth.js v5 |
| `src/middleware.ts` | Protección de rutas |
| `src/lib/google/auth-mesa.ts` | Access token de la mesa a partir del refresh token cifrado |
| `src/lib/google/credencial.ts` | Guardar, leer y marcar error de la credencial de la mesa |
| `src/app/layout.tsx` | Layout raíz, tema claro y oscuro |
| `src/app/page.tsx` | Redirección a la cola o al login |
| `src/app/(auth)/login/page.tsx` | Pantalla de inicio de sesión |
| `src/app/(auth)/sin-acceso/page.tsx` | Rechazo por allowlist |
| `src/app/ajustes/page.tsx` | Estado del consentimiento de la mesa (solo admin) |
| `src/app/api/mesa/autorizar/route.ts` | Inicia el consentimiento de la mesa |
| `src/app/api/mesa/callback/route.ts` | Recibe el código y guarda el refresh token cifrado |
| `src/app/api/mesa/verificar/route.ts` | Prueba de vida: lee el título de la hoja de desarrollo |

Las etapas 1 a 4 tendrán su propio plan, escrito al cerrar la etapa anterior.

---

## Task 1: Andamiaje del proyecto y pruebas

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/fecha.ts`
- Create: `src/lib/fecha.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada.
- Produces: proyecto Next.js ejecutable con `pnpm dev`, suite de pruebas ejecutable con `pnpm test`, y `formatearFechaHoja(d: Date): string` que produce el formato `D/M/YYYY H:mm:ss` que usa la hoja.

- [ ] **Step 1: Crear el proyecto Next.js**

El directorio ya contiene `docs/` y `.git`, así que se scaffoldea en sitio con `.`:

```bash
cd /Users/omarsaldanna/Downloads/trabajo/frontend-mesa-control
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --use-pnpm --import-alias "@/*" --yes
```

Si el comando se niega por directorio no vacío, scaffoldear en `.tmp-scaffold` y mover el contenido:

```bash
pnpm create next-app@latest .tmp-scaffold --ts --tailwind --eslint --app --src-dir --use-pnpm --import-alias "@/*" --yes
rsync -a --exclude=.git .tmp-scaffold/ ./ && rm -rf .tmp-scaffold
```

- [ ] **Step 2: Instalar dependencias de la etapa**

```bash
pnpm add next-auth@beta drizzle-orm postgres
pnpm add -D vitest drizzle-kit dotenv-cli tsx @types/node
```

- [ ] **Step 3: Configurar Vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Agregar a `package.json` en `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escribir la prueba que falla**

Crear `src/lib/fecha.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatearFechaHoja } from './fecha'

describe('formatearFechaHoja', () => {
  it('usa el formato D/M/YYYY H:mm:ss de la hoja', () => {
    const d = new Date(2026, 7, 5, 15, 14, 58) // 5 de agosto de 2026
    expect(formatearFechaHoja(d)).toBe('5/8/2026 15:14:58')
  })

  it('no rellena con ceros el día ni el mes', () => {
    const d = new Date(2026, 0, 9, 9, 5, 3)
    expect(formatearFechaHoja(d)).toBe('9/1/2026 9:05:03')
  })
})
```

- [ ] **Step 5: Ejecutar la prueba y verificar que falla**

Run: `pnpm test src/lib/fecha.test.ts`
Expected: FAIL — no existe el módulo `./fecha`.

- [ ] **Step 6: Implementar el mínimo**

Crear `src/lib/fecha.ts`:

```ts
/**
 * Formato con el que la hoja "Respuestas de formulario 1" guarda las fechas:
 * día y mes sin cero inicial, hora sin cero inicial, minutos y segundos con dos dígitos.
 */
export function formatearFechaHoja(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`
}
```

- [ ] **Step 7: Ejecutar la prueba y verificar que pasa**

Run: `pnpm test src/lib/fecha.test.ts`
Expected: PASS, 2 pruebas.

- [ ] **Step 8: Verificar que el proyecto compila y arranca**

Run: `pnpm build`
Expected: build exitoso sin errores de TypeScript.

- [ ] **Step 9: Conectar el remoto y commit**

```bash
git remote add origin https://github.com/omarlaraenignecx/frontend-mesa-control.git
git add -A
git commit -m "feat: andamiaje Next.js con pnpm, Tailwind y Vitest"
```

---

## Task 2: Esquema de base de datos y allowlist sembrada

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `src/db/seed-usuarios.ts`, `drizzle.config.ts`, `.env.example`
- Test: `src/lib/auth/allowlist.test.ts`
- Create: `src/lib/auth/allowlist.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - Tablas Drizzle exportadas: `usuariosAutorizados`, `credencialMesa`, `bloqueos`, `casosHilo`, `bitacora`, `plantillasCorreo`, `eventosBi`.
  - `getDb(): PostgresJsDatabase<typeof schema>` en `src/db/index.ts`.
  - `type UsuarioAutorizado = { correo: string; nombreEnHoja: string | null; rol: 'operador' | 'admin'; activo: boolean }`
  - `resolverAcceso(correo: string | null | undefined, autorizados: UsuarioAutorizado[]): ResultadoAcceso` en `src/lib/auth/allowlist.ts`, donde `type ResultadoAcceso = { autorizado: true; usuario: UsuarioAutorizado } | { autorizado: false; motivo: 'sin-correo' | 'dominio-ajeno' | 'fuera-de-allowlist' | 'inactivo' }`.

- [ ] **Step 1: Provisionar Supabase desde el Marketplace de Vercel**

```bash
pnpm add -g vercel@latest
vercel link --yes
vercel integration add supabase --yes
```

Si el comando delega a la interfaz web (Supabase es *connectable*), ejecutar `vercel integration open supabase` y completar el enlace en el navegador. No continuar con un mock ni con una base local: la etapa requiere la base real.

Al terminar, traer las variables:

```bash
vercel env pull .env.local --yes
grep -o '^[A-Z_]*' .env.local | sort -u
```

Expected: aparecen variables de conexión de Postgres. Anotar el nombre exacto de la cadena de conexión (típicamente `POSTGRES_URL`).

- [ ] **Step 2: Escribir la prueba que falla**

Crear `src/lib/auth/allowlist.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolverAcceso, type UsuarioAutorizado } from './allowlist'

const AUTORIZADOS: UsuarioAutorizado[] = [
  { correo: 'keynor.rivas@gplusseguros.mx', nombreEnHoja: 'Keynor', rol: 'operador', activo: true },
  { correo: 'mesadecontrol@gplusseguros.mx', nombreEnHoja: null, rol: 'admin', activo: true },
  { correo: 'norma.zacarias@gplusseguros.mx', nombreEnHoja: 'Norma', rol: 'operador', activo: false },
]

describe('resolverAcceso', () => {
  it('autoriza a un operador de la allowlist y expone su nombre en la hoja', () => {
    const r = resolverAcceso('keynor.rivas@gplusseguros.mx', AUTORIZADOS)
    expect(r).toEqual({
      autorizado: true,
      usuario: AUTORIZADOS[0],
    })
  })

  it('autoriza al administrador aunque no tenga nombre en la hoja', () => {
    const r = resolverAcceso('mesadecontrol@gplusseguros.mx', AUTORIZADOS)
    expect(r.autorizado).toBe(true)
    if (r.autorizado) expect(r.usuario.rol).toBe('admin')
  })

  it('rechaza una cuenta del dominio que no está en la allowlist', () => {
    expect(resolverAcceso('otra.persona@gplusseguros.mx', AUTORIZADOS)).toEqual({
      autorizado: false,
      motivo: 'fuera-de-allowlist',
    })
  })

  it('rechaza un correo de otro dominio aunque estuviera en la lista', () => {
    expect(resolverAcceso('keynor.rivas@gmail.com', AUTORIZADOS)).toEqual({
      autorizado: false,
      motivo: 'dominio-ajeno',
    })
  })

  it('rechaza a un usuario desactivado', () => {
    expect(resolverAcceso('norma.zacarias@gplusseguros.mx', AUTORIZADOS)).toEqual({
      autorizado: false,
      motivo: 'inactivo',
    })
  })

  it('rechaza cuando no hay correo', () => {
    expect(resolverAcceso(undefined, AUTORIZADOS)).toEqual({ autorizado: false, motivo: 'sin-correo' })
    expect(resolverAcceso('', AUTORIZADOS)).toEqual({ autorizado: false, motivo: 'sin-correo' })
  })

  it('ignora diferencias de mayúsculas y espacios en el correo recibido de Google', () => {
    const r = resolverAcceso('  Keynor.Rivas@GplusSeguros.MX ', AUTORIZADOS)
    expect(r.autorizado).toBe(true)
  })
})
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/auth/allowlist.test.ts`
Expected: FAIL — no existe `./allowlist`.

- [ ] **Step 4: Implementar la resolución de acceso**

Crear `src/lib/auth/allowlist.ts`:

```ts
export const DOMINIO_PERMITIDO = 'gplusseguros.mx'

export type UsuarioAutorizado = {
  correo: string
  nombreEnHoja: string | null
  rol: 'operador' | 'admin'
  activo: boolean
}

export type ResultadoAcceso =
  | { autorizado: true; usuario: UsuarioAutorizado }
  | { autorizado: false; motivo: 'sin-correo' | 'dominio-ajeno' | 'fuera-de-allowlist' | 'inactivo' }

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase()
}

export function resolverAcceso(
  correo: string | null | undefined,
  autorizados: UsuarioAutorizado[],
): ResultadoAcceso {
  if (!correo || !correo.trim()) return { autorizado: false, motivo: 'sin-correo' }

  const normalizado = normalizarCorreo(correo)
  if (!normalizado.endsWith(`@${DOMINIO_PERMITIDO}`)) {
    return { autorizado: false, motivo: 'dominio-ajeno' }
  }

  const usuario = autorizados.find((u) => normalizarCorreo(u.correo) === normalizado)
  if (!usuario) return { autorizado: false, motivo: 'fuera-de-allowlist' }
  if (!usuario.activo) return { autorizado: false, motivo: 'inactivo' }

  return { autorizado: true, usuario }
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/auth/allowlist.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 6: Definir el esquema Drizzle**

Crear `src/db/schema.ts`:

```ts
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const usuariosAutorizados = pgTable('usuarios_autorizados', {
  correo: text('correo').primaryKey(),
  nombreEnHoja: text('nombre_en_hoja'),
  rol: text('rol', { enum: ['operador', 'admin'] }).notNull(),
  activo: boolean('activo').notNull().default(true),
})

export const credencialMesa = pgTable('credencial_mesa', {
  id: integer('id').primaryKey().default(1),
  refreshTokenCifrado: text('refresh_token_cifrado').notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  autorizadoPor: text('autorizado_por').notNull(),
  autorizadoEn: timestamp('autorizado_en', { withTimezone: true }).notNull().defaultNow(),
  ultimoUso: timestamp('ultimo_uso', { withTimezone: true }),
  ultimoError: text('ultimo_error'),
})

export const bloqueos = pgTable('bloqueos', {
  fila: integer('fila').primaryKey(),
  correoDueno: text('correo_dueno').notNull(),
  tomadoEn: timestamp('tomado_en', { withTimezone: true }).notNull().defaultNow(),
  ultimoLatido: timestamp('ultimo_latido', { withTimezone: true }).notNull().defaultNow(),
})

export const casosHilo = pgTable('casos_hilo', {
  fila: integer('fila').primaryKey(),
  threadId: text('thread_id').notNull(),
  asuntoNormalizado: text('asunto_normalizado').notNull(),
  folioUsado: text('folio_usado').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

export const bitacora = pgTable('bitacora', {
  id: serial('id').primaryKey(),
  fila: integer('fila').notNull(),
  folio: text('folio'),
  correoUsuario: text('correo_usuario').notNull(),
  campo: text('campo').notNull(),
  valorAnterior: text('valor_anterior'),
  valorNuevo: text('valor_nuevo'),
  tipo: text('tipo', {
    enum: ['guardado', 'bloqueo_forzado', 'folio_capturado'],
  }).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

export const plantillasCorreo = pgTable(
  'plantillas_correo',
  {
    id: serial('id').primaryKey(),
    tipoTramite: text('tipo_tramite').notNull(),
    asuntoPlantilla: text('asunto_plantilla').notNull(),
    cuerpoHtml: text('cuerpo_html').notNull(),
    activa: boolean('activa').notNull().default(true),
    actualizadaPor: text('actualizada_por'),
    actualizadaEn: timestamp('actualizada_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('plantillas_tipo_tramite_idx').on(t.tipoTramite)],
)

export const eventosBi = pgTable('eventos_bi', {
  id: serial('id').primaryKey(),
  tipo: text('tipo', {
    enum: [
      'caso_visualizado',
      'caso_tomado',
      'conversacion_iniciada',
      'respuesta_enviada',
      'caso_guardado',
      'caso_cerrado',
      'importacion_solicitada',
    ],
  }).notNull(),
  fila: integer('fila'),
  folio: text('folio'),
  tipoTramite: text('tipo_tramite'),
  estatusResultante: text('estatus_resultante'),
  motivo: text('motivo'),
  correoUsuario: text('correo_usuario').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

```

- [ ] **Step 7: Cliente Drizzle con inicialización diferida**

Crear `src/db/index.ts`. La inicialización diferida evita que `next build` falle cuando la variable de conexión aún no existe. **No usar un `Proxy`** para esto: rompe librerías que inspeccionan el objeto de base.

```ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: PostgresJsDatabase<typeof schema> | null = null

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db
  const url = process.env.POSTGRES_URL
  if (!url) throw new Error('Falta POSTGRES_URL: la base de datos no está configurada.')
  _db = drizzle(postgres(url, { prepare: false }), { schema })
  return _db
}

export { schema }
```

- [ ] **Step 8: Configurar Drizzle Kit y aplicar el esquema**

Crear `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.POSTGRES_URL! },
})
```

Agregar a `scripts` de `package.json`:

```json
"db:push": "dotenv -e .env.local -- drizzle-kit push",
"db:seed": "dotenv -e .env.local -- tsx src/db/seed-usuarios.ts"
```

Instalar `tsx`: `pnpm add -D tsx`

Run: `pnpm db:push`
Expected: las 7 tablas se crean en Supabase.

- [ ] **Step 9: Sembrar la allowlist**

Crear `src/db/seed-usuarios.ts`:

```ts
import { getDb } from './index'
import { usuariosAutorizados } from './schema'

const USUARIOS = [
  { correo: 'keynor.rivas@gplusseguros.mx', nombreEnHoja: 'Keynor', rol: 'operador' as const, activo: true },
  { correo: 'patricia.ramirez@gplusseguros.mx', nombreEnHoja: 'Paty', rol: 'operador' as const, activo: true },
  { correo: 'norma.zacarias@gplusseguros.mx', nombreEnHoja: 'Norma', rol: 'operador' as const, activo: true },
  { correo: 'juan.palafox@gplusseguros.mx', nombreEnHoja: 'José Juan', rol: 'operador' as const, activo: true },
  { correo: 'mesadecontrol@gplusseguros.mx', nombreEnHoja: null, rol: 'admin' as const, activo: true },
]

async function main() {
  const db = getDb()
  for (const u of USUARIOS) {
    await db
      .insert(usuariosAutorizados)
      .values(u)
      .onConflictDoUpdate({
        target: usuariosAutorizados.correo,
        set: { nombreEnHoja: u.nombreEnHoja, rol: u.rol, activo: u.activo },
      })
  }
  console.log(`Allowlist sembrada: ${USUARIOS.length} usuarios.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

Run: `pnpm db:seed`
Expected: `Allowlist sembrada: 5 usuarios.`

- [ ] **Step 10: Documentar las variables y commit**

Crear `.env.example` con nombres y sin valores:

```
# Base de datos (provista por la integración de Supabase en Vercel)
POSTGRES_URL=

# Auth.js
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Credencial de la mesa (mismo cliente OAuth, flujo aparte)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
MESA_CORREO=mesadecontrol@gplusseguros.mx

# Clave de cifrado del refresh token: 32 bytes en base64
CREDENCIAL_ENC_KEY=

# Hojas
SHEET_ID=1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ
SHEET_PESTANA=Respuestas de formulario 1
```

```bash
git add -A
git commit -m "feat: esquema de base, allowlist sembrada y resolución de acceso"
```

---

## Task 3: Cifrado del refresh token

**Files:**
- Create: `src/lib/crypto/secreto.ts`
- Test: `src/lib/crypto/secreto.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `cifrar(textoClaro: string, claveBase64: string): string` y `descifrar(paquete: string, claveBase64: string): string`. El paquete es una cadena `iv.tagAuth.cifrado`, cada parte en base64url. `generarClave(): string` produce una clave de 32 bytes en base64, para uso en la línea de comandos.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/crypto/secreto.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cifrar, descifrar, generarClave } from './secreto'

const CLAVE = generarClave()

describe('cifrado del refresh token', () => {
  it('descifra lo que cifró', () => {
    const secreto = '1//0gRefreshTokenDeGoogleConCaracteres-_'
    expect(descifrar(cifrar(secreto, CLAVE), CLAVE)).toBe(secreto)
  })

  it('produce un paquete distinto cada vez para el mismo texto', () => {
    const a = cifrar('mismo-secreto', CLAVE)
    const b = cifrar('mismo-secreto', CLAVE)
    expect(a).not.toBe(b)
    expect(descifrar(a, CLAVE)).toBe(descifrar(b, CLAVE))
  })

  it('el paquete no contiene el texto claro', () => {
    expect(cifrar('token-secreto', CLAVE)).not.toContain('token-secreto')
  })

  it('falla al descifrar con una clave distinta', () => {
    const paquete = cifrar('secreto', CLAVE)
    expect(() => descifrar(paquete, generarClave())).toThrow()
  })

  it('falla si el paquete fue alterado, porque la autenticación no cuadra', () => {
    const paquete = cifrar('secreto', CLAVE)
    const partes = paquete.split('.')
    const alterado = [partes[0], partes[1], Buffer.from('otracosa').toString('base64url')].join('.')
    expect(() => descifrar(alterado, CLAVE)).toThrow()
  })

  it('rechaza una clave que no mide 32 bytes', () => {
    expect(() => cifrar('secreto', Buffer.from('corta').toString('base64'))).toThrow(
      /32 bytes/,
    )
  })

  it('rechaza un paquete con formato inválido', () => {
    expect(() => descifrar('no-es-un-paquete', CLAVE)).toThrow(/formato/)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/crypto/secreto.test.ts`
Expected: FAIL — no existe `./secreto`.

- [ ] **Step 3: Implementar**

Crear `src/lib/crypto/secreto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITMO = 'aes-256-gcm'
const LARGO_IV = 12
const LARGO_CLAVE = 32

function leerClave(claveBase64: string): Buffer {
  const clave = Buffer.from(claveBase64, 'base64')
  if (clave.length !== LARGO_CLAVE) {
    throw new Error(`La clave de cifrado debe medir 32 bytes; mide ${clave.length}.`)
  }
  return clave
}

export function generarClave(): string {
  return randomBytes(LARGO_CLAVE).toString('base64')
}

export function cifrar(textoClaro: string, claveBase64: string): string {
  const iv = randomBytes(LARGO_IV)
  const cipher = createCipheriv(ALGORITMO, leerClave(claveBase64), iv)
  const cifrado = Buffer.concat([cipher.update(textoClaro, 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), cifrado.toString('base64url')].join('.')
}

export function descifrar(paquete: string, claveBase64: string): string {
  const partes = paquete.split('.')
  if (partes.length !== 3) {
    throw new Error('El paquete cifrado no tiene el formato iv.tag.cifrado.')
  }
  const [iv, tag, cifrado] = partes.map((p) => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv(ALGORITMO, leerClave(claveBase64), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/crypto/secreto.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: cifrado autenticado del refresh token de la mesa"
```

---

## Task 4: Inicio de sesión con allowlist

**Files:**
- Create: `src/auth.ts`, `src/middleware.ts`, `src/lib/auth/usuarios.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/sin-acceso/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `resolverAcceso`, `UsuarioAutorizado`, `normalizarCorreo` de `src/lib/auth/allowlist.ts`; `getDb`, `schema` de `src/db/index.ts`.
- Produces:
  - `auth()`, `signIn()`, `signOut()`, `handlers` exportados de `src/auth.ts`.
  - `listarAutorizados(): Promise<UsuarioAutorizado[]>` en `src/lib/auth/usuarios.ts`.
  - La sesión lleva `session.user.rol: 'operador' | 'admin'` y `session.user.nombreEnHoja: string | null`.
  - `usuarioActual(): Promise<{ correo: string; rol: 'operador' | 'admin'; nombreEnHoja: string | null }>` en `src/lib/auth/usuarios.ts`, que lanza error si no hay sesión. Es la función que usarán todas las etapas siguientes para saber quién opera.

- [ ] **Step 1: Consulta de la allowlist en base**

Crear `src/lib/auth/usuarios.ts`:

```ts
import { getDb, schema } from '@/db'
import type { UsuarioAutorizado } from './allowlist'

export async function listarAutorizados(): Promise<UsuarioAutorizado[]> {
  const filas = await getDb().select().from(schema.usuariosAutorizados)
  return filas.map((f) => ({
    correo: f.correo,
    nombreEnHoja: f.nombreEnHoja,
    rol: f.rol,
    activo: f.activo,
  }))
}
```

- [ ] **Step 2: Configurar Auth.js**

Crear `src/auth.ts`:

```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { DOMINIO_PERMITIDO, resolverAcceso } from '@/lib/auth/allowlist'
import { listarAutorizados } from '@/lib/auth/usuarios'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: { hd: DOMINIO_PERMITIDO, prompt: 'select_account' },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/sin-acceso' },
  callbacks: {
    async signIn({ profile }) {
      const resultado = resolverAcceso(profile?.email, await listarAutorizados())
      // Devolver una ruta en lugar de false permite explicar el motivo del rechazo.
      return resultado.autorizado ? true : `/sin-acceso?motivo=${resultado.motivo}`
    },
    async jwt({ token }) {
      if (!token.email) return token
      const resultado = resolverAcceso(token.email, await listarAutorizados())
      if (resultado.autorizado) {
        token.rol = resultado.usuario.rol
        token.nombreEnHoja = resultado.usuario.nombreEnHoja
      }
      return token
    },
    async session({ session, token }) {
      session.user.rol = (token.rol as 'operador' | 'admin') ?? 'operador'
      session.user.nombreEnHoja = (token.nombreEnHoja as string | null) ?? null
      return session
    },
  },
})
```

Crear `src/types/next-auth.d.ts` para que TypeScript conozca los campos añadidos:

```ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      rol: 'operador' | 'admin'
      nombreEnHoja: string | null
    } & DefaultSession['user']
  }
}
```

Crear `src/app/api/auth/[...nextauth]/route.ts`. En Auth.js v5 los manejadores salen de `handlers`, no se exportan como `GET`/`POST` desde `src/auth.ts`:

```ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 3: Agregar `usuarioActual` al módulo de usuarios**

Añadir a `src/lib/auth/usuarios.ts`:

```ts
import { auth } from '@/auth'

export async function usuarioActual() {
  const sesion = await auth()
  const correo = sesion?.user?.email
  if (!correo) throw new Error('No hay sesión activa.')
  return {
    correo,
    rol: sesion.user.rol,
    nombreEnHoja: sesion.user.nombreEnHoja,
  }
}
```

- [ ] **Step 4: Proteger las rutas**

Crear `src/middleware.ts`:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export default auth((req) => {
  const publica = ['/login', '/sin-acceso'].some((p) => req.nextUrl.pathname.startsWith(p))
  if (!req.auth && !publica) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 5: Pantallas de login y rechazo**

Crear `src/app/(auth)/login/page.tsx`:

```tsx
import { signIn } from '@/auth'

export default function Login() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Mesa de Control</h1>
          <p className="text-sm text-muted-foreground">Gplus Seguros</p>
        </div>
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/cola' })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Entrar con Google
          </button>
        </form>
        <p className="text-xs text-muted-foreground">
          Solo cuentas autorizadas del dominio gplusseguros.mx.
        </p>
      </div>
    </main>
  )
}
```

Crear `src/app/(auth)/sin-acceso/page.tsx`:

```tsx
const MENSAJES: Record<string, string> = {
  'dominio-ajeno': 'Esa cuenta no pertenece al dominio gplusseguros.mx.',
  'fuera-de-allowlist': 'Tu cuenta no está en la lista de personas autorizadas de la Mesa de Control.',
  inactivo: 'Tu acceso a la herramienta está desactivado.',
  'sin-correo': 'Google no compartió un correo con el que podamos identificarte.',
}

export default async function SinAcceso({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>
}) {
  const { motivo } = await searchParams
  const mensaje = MENSAJES[motivo ?? ''] ?? 'No pudimos autorizar tu acceso.'

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border p-8">
        <h1 className="text-lg font-semibold">Sin acceso</h1>
        <p className="text-sm text-muted-foreground">{mensaje}</p>
        <p className="text-sm text-muted-foreground">
          Si crees que deberías tener acceso, solicítalo al administrador de la Mesa de Control.
        </p>
        <a href="/login" className="inline-block text-sm underline">
          Intentar con otra cuenta
        </a>
      </div>
    </main>
  )
}
```

Reemplazar `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function Inicio() {
  const sesion = await auth()
  redirect(sesion ? '/cola' : '/login')
}
```

- [ ] **Step 6: Ejecutar toda la suite y el build**

Run: `pnpm test && pnpm build`
Expected: todas las pruebas pasan; el build compila. La ruta `/cola` aún no existe: crear `src/app/cola/page.tsx` con un marcador mínimo para que la redirección no rompa el build:

```tsx
import { usuarioActual } from '@/lib/auth/usuarios'

export default async function Cola() {
  const usuario = await usuarioActual()
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Cola de casos</h1>
      <p className="text-sm text-muted-foreground">
        Sesión de {usuario.correo} · rol {usuario.rol}
      </p>
    </main>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: inicio de sesión con Google restringido a la allowlist"
```

---

## Task 5: Pantalla de consentimiento y cliente OAuth (pasos del administrador)

**Files:**
- Create: `docs/operacion/configuracion-google-cloud.md`

**Interfaces:**
- Consumes: nada de código.
- Produces: los valores de `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` cargados en `.env.local` y en Vercel. Un mismo cliente OAuth sirve a los dos flujos (login de usuarios y consentimiento de la mesa), con dos URI de redirección distintas.

Esta tarea la ejecuta el administrador en la consola de Google Cloud: no existe API pública para crear la pantalla de consentimiento ni un cliente OAuth de tipo aplicación web. El agente documenta, verifica por CLI y no puede sustituirla.

- [ ] **Step 1: Escribir el documento de operación**

Crear `docs/operacion/configuracion-google-cloud.md` con el contenido exacto de los pasos 2 a 5 de esta tarea, para que el procedimiento quede en el repositorio y sea repetible.

- [ ] **Step 2: Pedir al administrador que configure la pantalla de consentimiento**

Instrucciones textuales a entregar:

1. Entrar a `https://console.cloud.google.com/auth/overview?project=mesa-de-control-504618` con la cuenta `mesadecontrol@gplusseguros.mx`.
2. Tipo de usuario: **Interno**. Es la opción disponible porque el proyecto pertenece a la organización `1029986595993`, y es la que evita el proceso de verificación de Google y la expiración del refresh token a los 7 días.
3. Nombre de la aplicación: `Mesa de Control Gplus`.
4. Correo de asistencia y de contacto: `mesadecontrol@gplusseguros.mx`.
5. Guardar.

- [ ] **Step 3: Pedir el registro de los cinco scopes**

En la sección de **Acceso a datos**, agregar exactamente:

```
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
```

Los tres de Gmail y el de Sheets son restringidos o sensibles; en una aplicación Interna no requieren verificación.

- [ ] **Step 4: Pedir la creación del cliente OAuth**

En **Clientes**, crear cliente de tipo **Aplicación web**, nombre `Mesa de Control web`, con:

Orígenes autorizados de JavaScript:
```
http://localhost:3000
```

URI de redirección autorizados:
```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/mesa/callback
```

Cuando exista el dominio de Vercel se añaden sus equivalentes en la Task 8. Copiar el **ID de cliente** y el **secreto**.

- [ ] **Step 5: Cargar los secretos**

En `.env.local`, con los valores recibidos:

```bash
# El mismo cliente sirve para los dos flujos
AUTH_GOOGLE_ID=<id de cliente>
AUTH_GOOGLE_SECRET=<secreto>
GOOGLE_OAUTH_CLIENT_ID=<id de cliente>
GOOGLE_OAUTH_CLIENT_SECRET=<secreto>
AUTH_SECRET=<generado con: openssl rand -base64 32>
CREDENCIAL_ENC_KEY=<generado con: openssl rand -base64 32>
```

- [ ] **Step 6: Verificar por CLI que el proyecto quedó listo**

```bash
gcloud config set project mesa-de-control-504618
gcloud services list --enabled --format="value(config.name)" | grep -E "sheets|gmail|drive"
```

Expected: las tres APIs aparecen habilitadas.

- [ ] **Step 7: Probar el login de punta a punta**

```bash
pnpm dev
```

Verificaciones manuales, todas obligatorias:
1. Entrar a `http://localhost:3000` → redirige a `/login`.
2. Entrar con `mesadecontrol@gplusseguros.mx` → llega a `/cola` mostrando rol `admin`.
3. Cerrar sesión y entrar con una cuenta de otro dominio → `/sin-acceso` con el mensaje de dominio ajeno.
4. Si hay a mano una cuenta del dominio fuera de la allowlist, verificar el mensaje de fuera de allowlist.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: procedimiento de configuración de OAuth en Google Cloud"
```

---

## Task 6: Credencial de la mesa — autorización y access token

**Files:**
- Create: `src/lib/google/credencial.ts`, `src/lib/google/auth-mesa.ts`
- Create: `src/app/api/mesa/autorizar/route.ts`, `src/app/api/mesa/callback/route.ts`
- Test: `src/lib/google/auth-mesa.test.ts`

**Interfaces:**
- Consumes: `cifrar`, `descifrar` de `src/lib/crypto/secreto.ts`; `getDb`, `schema` de `src/db/index.ts`; `usuarioActual` de `src/lib/auth/usuarios.ts`.
- Produces:
  - `SCOPES_MESA: readonly string[]` en `src/lib/google/auth-mesa.ts`.
  - `intercambiarRefreshToken(refreshToken: string, deps: DepsToken): Promise<string>` — función pura respecto a la red, recibe su `fetch` por parámetro para poder probarse. `type DepsToken = { fetch: typeof globalThis.fetch; clientId: string; clientSecret: string }`.
  - `accessTokenDeLaMesa(): Promise<string>` — lee la credencial de base, la descifra, obtiene el access token y actualiza `ultimoUso`. Es la única función que las etapas siguientes usan para hablar con Google.
  - `guardarCredencial(refreshToken: string, scopes: string[], autorizadoPor: string): Promise<void>` y `leerCredencial(): Promise<{ refreshTokenCifrado: string; scopes: string[]; autorizadoPor: string; autorizadoEn: Date; ultimoError: string | null } | null>` y `registrarErrorCredencial(mensaje: string): Promise<void>` en `src/lib/google/credencial.ts`.
  - `class SinCredencialMesaError extends Error` y `class CredencialMesaRevocadaError extends Error`, ambas exportadas de `src/lib/google/auth-mesa.ts`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/lib/google/auth-mesa.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  CredencialMesaRevocadaError,
  SCOPES_MESA,
  intercambiarRefreshToken,
} from './auth-mesa'

function fetchQueResponde(status: number, cuerpo: unknown) {
  return vi.fn(async () =>
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/google/auth-mesa.test.ts`
Expected: FAIL — no existe `./auth-mesa`.

- [ ] **Step 3: Implementar la credencial en base**

Crear `src/lib/google/credencial.ts`:

```ts
import { eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { cifrar } from '@/lib/crypto/secreto'

const ID_UNICO = 1

function claveDeCifrado(): string {
  const clave = process.env.CREDENCIAL_ENC_KEY
  if (!clave) throw new Error('Falta CREDENCIAL_ENC_KEY: no se puede cifrar la credencial.')
  return clave
}

export async function guardarCredencial(
  refreshToken: string,
  scopes: string[],
  autorizadoPor: string,
): Promise<void> {
  const cifrado = cifrar(refreshToken, claveDeCifrado())
  await getDb()
    .insert(schema.credencialMesa)
    .values({
      id: ID_UNICO,
      refreshTokenCifrado: cifrado,
      scopes,
      autorizadoPor,
      ultimoError: null,
    })
    .onConflictDoUpdate({
      target: schema.credencialMesa.id,
      set: {
        refreshTokenCifrado: cifrado,
        scopes,
        autorizadoPor,
        autorizadoEn: new Date(),
        ultimoError: null,
      },
    })
}

export async function leerCredencial() {
  const [fila] = await getDb()
    .select()
    .from(schema.credencialMesa)
    .where(eq(schema.credencialMesa.id, ID_UNICO))
    .limit(1)
  return fila ?? null
}

export async function registrarErrorCredencial(mensaje: string): Promise<void> {
  await getDb()
    .update(schema.credencialMesa)
    .set({ ultimoError: mensaje })
    .where(eq(schema.credencialMesa.id, ID_UNICO))
}

export async function marcarUso(): Promise<void> {
  await getDb()
    .update(schema.credencialMesa)
    .set({ ultimoUso: new Date(), ultimoError: null })
    .where(eq(schema.credencialMesa.id, ID_UNICO))
}
```

- [ ] **Step 4: Implementar el intercambio de token**

Crear `src/lib/google/auth-mesa.ts`:

```ts
import { descifrar } from '@/lib/crypto/secreto'
import { leerCredencial, marcarUso, registrarErrorCredencial } from './credencial'

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
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/google/auth-mesa.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 6: Ruta que inicia el consentimiento**

Crear `src/app/api/mesa/autorizar/route.ts`:

```ts
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/lib/auth/usuarios'
import { SCOPES_MESA } from '@/lib/google/auth-mesa'

export async function GET(request: Request) {
  const usuario = await usuarioActual()
  if (usuario.rol !== 'admin') {
    return new Response('Solo el administrador puede autorizar el acceso a Google.', { status: 403 })
  }

  const origen = new URL(request.url).origin
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_OAUTH_CLIENT_ID!)
  url.searchParams.set('redirect_uri', `${origen}/api/mesa/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES_MESA.join(' '))
  // offline + consent es lo que garantiza que Google entregue un refresh token.
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('login_hint', process.env.MESA_CORREO ?? 'mesadecontrol@gplusseguros.mx')

  redirect(url.toString())
}
```

- [ ] **Step 7: Ruta de callback que guarda el refresh token**

Crear `src/app/api/mesa/callback/route.ts`:

```ts
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/lib/auth/usuarios'
import { guardarCredencial } from '@/lib/google/credencial'

export async function GET(request: Request) {
  const usuario = await usuarioActual()
  if (usuario.rol !== 'admin') {
    return new Response('Solo el administrador puede autorizar el acceso a Google.', { status: 403 })
  }

  const url = new URL(request.url)
  const codigo = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (error) redirect(`/ajustes?estado=error&detalle=${encodeURIComponent(error)}`)
  if (!codigo) redirect('/ajustes?estado=error&detalle=sin-codigo')

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: `${url.origin}/api/mesa/callback`,
    }).toString(),
  })

  const cuerpo = (await respuesta.json().catch(() => ({}))) as {
    refresh_token?: string
    scope?: string
  }

  if (!respuesta.ok || !cuerpo.refresh_token) {
    redirect('/ajustes?estado=error&detalle=sin-refresh-token')
  }

  await guardarCredencial(
    cuerpo.refresh_token!,
    (cuerpo.scope ?? '').split(' ').filter(Boolean),
    usuario.correo,
  )

  redirect('/ajustes?estado=autorizado')
}
```

- [ ] **Step 8: Ejecutar la suite completa y el build**

Run: `pnpm test && pnpm build`
Expected: todo pasa y compila.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: consentimiento de la mesa y obtención de access token de Google"
```

---

## Task 7: Ajustes con prueba de vida contra la hoja

**Files:**
- Create: `src/app/ajustes/page.tsx`, `src/app/api/mesa/verificar/route.ts`
- Create: `src/lib/google/sheet-ping.ts`
- Test: `src/lib/google/sheet-ping.test.ts`

**Interfaces:**
- Consumes: `accessTokenDeLaMesa`, `SinCredencialMesaError`, `CredencialMesaRevocadaError` de `src/lib/google/auth-mesa.ts`; `leerCredencial` de `src/lib/google/credencial.ts`; `usuarioActual` de `src/lib/auth/usuarios.ts`.
- Produces: `leerTituloHoja(sheetId: string, deps: { fetch: typeof globalThis.fetch; accessToken: string }): Promise<string>` en `src/lib/google/sheet-ping.ts`. Es la prueba de vida mínima del acceso a Sheets y la base sobre la que la Etapa 1 construirá el lector.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/google/sheet-ping.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { leerTituloHoja } from './sheet-ping'

function fetchQueResponde(status: number, cuerpo: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof globalThis.fetch
}

describe('leerTituloHoja', () => {
  it('devuelve el título del archivo', async () => {
    const fetchMock = fetchQueResponde(200, {
      properties: { title: 'Prueba formulario mesa de control' },
    })
    const titulo = await leerTituloHoja('sheet-123', {
      fetch: fetchMock,
      accessToken: 'ya29.token',
    })
    expect(titulo).toBe('Prueba formulario mesa de control')
  })

  it('pide solo el título y manda el token en el encabezado', async () => {
    const fetchMock = fetchQueResponde(200, { properties: { title: 'X' } })
    await leerTituloHoja('sheet-123', { fetch: fetchMock, accessToken: 'ya29.token' })

    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('/spreadsheets/sheet-123')
    expect(String(url)).toContain('fields=properties.title')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ya29.token')
  })

  it('explica el 403 como falta de permiso sobre la hoja', async () => {
    const fetchMock = fetchQueResponde(403, {
      error: { code: 403, message: 'The caller does not have permission' },
    })
    await expect(
      leerTituloHoja('sheet-123', { fetch: fetchMock, accessToken: 'ya29.token' }),
    ).rejects.toThrow(/no tiene permiso/)
  })

  it('explica el 404 como hoja inexistente', async () => {
    const fetchMock = fetchQueResponde(404, { error: { code: 404, message: 'Not found' } })
    await expect(
      leerTituloHoja('sheet-inexistente', { fetch: fetchMock, accessToken: 'ya29.token' }),
    ).rejects.toThrow(/no existe/)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/google/sheet-ping.test.ts`
Expected: FAIL — no existe `./sheet-ping`.

- [ ] **Step 3: Implementar**

Crear `src/lib/google/sheet-ping.ts`:

```ts
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export async function leerTituloHoja(
  sheetId: string,
  deps: { fetch: typeof globalThis.fetch; accessToken: string },
): Promise<string> {
  const url = `${BASE}/${sheetId}?fields=properties.title`
  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })

  if (respuesta.status === 403) {
    throw new Error('La cuenta de la mesa no tiene permiso sobre esa hoja de cálculo.')
  }
  if (respuesta.status === 404) {
    throw new Error('La hoja de cálculo no existe o el identificador es incorrecto.')
  }
  if (!respuesta.ok) {
    throw new Error(`Sheets respondió ${respuesta.status} al leer la hoja.`)
  }

  const cuerpo = (await respuesta.json()) as { properties?: { title?: string } }
  const titulo = cuerpo.properties?.title
  if (!titulo) throw new Error('Sheets respondió sin el título de la hoja.')
  return titulo
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/google/sheet-ping.test.ts`
Expected: PASS, 4 pruebas.

- [ ] **Step 5: Ruta de verificación**

Crear `src/app/api/mesa/verificar/route.ts`:

```ts
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
```

- [ ] **Step 6: Página de ajustes**

Crear `src/app/ajustes/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/lib/auth/usuarios'
import { leerCredencial } from '@/lib/google/credencial'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { leerTituloHoja } from '@/lib/google/sheet-ping'

async function estadoDelAcceso() {
  const credencial = await leerCredencial()
  if (!credencial) return { estado: 'sin-autorizar' as const }
  try {
    const accessToken = await accessTokenDeLaMesa()
    const titulo = await leerTituloHoja(process.env.SHEET_ID!, {
      fetch: globalThis.fetch,
      accessToken,
    })
    return { estado: 'activo' as const, credencial, titulo }
  } catch (e) {
    return {
      estado: 'con-error' as const,
      credencial,
      error: e instanceof Error ? e.message : 'Error desconocido',
    }
  }
}

export default async function Ajustes() {
  const usuario = await usuarioActual()
  if (usuario.rol !== 'admin') redirect('/cola')

  const acceso = await estadoDelAcceso()

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-xl font-semibold">Ajustes</h1>

      <section className="space-y-3 rounded-lg border p-6">
        <h2 className="font-medium">Acceso a Google de la Mesa de Control</h2>

        {acceso.estado === 'sin-autorizar' && (
          <p className="text-sm text-muted-foreground">
            Todavía no se ha autorizado el acceso. La herramienta no puede leer la hoja ni el
            correo hasta que se apruebe el consentimiento con mesadecontrol@gplusseguros.mx.
          </p>
        )}

        {acceso.estado === 'activo' && (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-emerald-600">Consentimiento activo</p>
            <p className="text-muted-foreground">
              Autorizado por {acceso.credencial.autorizadoPor} el{' '}
              {acceso.credencial.autorizadoEn.toLocaleString('es-MX')}
            </p>
            <p className="text-muted-foreground">
              Hoja alcanzada correctamente: <strong>{acceso.titulo}</strong>
            </p>
            <p className="text-muted-foreground">
              Permisos otorgados: {acceso.credencial.scopes.length}
            </p>
          </div>
        )}

        {acceso.estado === 'con-error' && (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-red-600">El acceso a Google necesita reautorizarse</p>
            <p className="text-muted-foreground">{acceso.error}</p>
          </div>
        )}

        <a
          href="/api/mesa/autorizar"
          className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {acceso.estado === 'activo' ? 'Volver a autorizar' : 'Autorizar acceso a Google'}
        </a>
      </section>
    </main>
  )
}
```

- [ ] **Step 7: Verificación manual de punta a punta**

```bash
pnpm dev
```

1. Entrar con `mesadecontrol@gplusseguros.mx` e ir a `/ajustes`. Debe decir "Todavía no se ha autorizado el acceso".
2. Pulsar **Autorizar acceso a Google**. Google debe pedir el consentimiento de los cinco permisos, **sin** pantalla de aplicación no verificada (confirma que el consentimiento quedó Interno).
3. Aceptar. Al volver, Ajustes debe mostrar "Consentimiento activo" y el título `Prueba formulario mesa de control`, que es la prueba de que la app leyó la hoja de desarrollo con la identidad de la mesa.
4. Entrar con `keynor.rivas@gplusseguros.mx` e ir a `/ajustes`: debe redirigir a `/cola` por no ser admin.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: ajustes con estado del consentimiento y prueba de vida contra la hoja"
```

---

## Task 8: Despliegue a Vercel

**Files:**
- Modify: `docs/operacion/configuracion-google-cloud.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: despliegue de producción funcionando con el consentimiento autorizado en el dominio de Vercel.

- [ ] **Step 1: Publicar el repositorio**

```bash
git push -u origin main
```

- [ ] **Step 2: Cargar las variables en Vercel**

Para cada variable de `.env.local` que no venga de la integración de Supabase (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CREDENCIAL_ENC_KEY`, `MESA_CORREO`, `SHEET_ID`, `SHEET_PESTANA`):

```bash
vercel env add <NOMBRE> production
vercel env add <NOMBRE> preview
vercel env add <NOMBRE> development
```

Verificar que están, sin exponer valores:

```bash
vercel env ls
```

- [ ] **Step 3: Desplegar a producción**

```bash
vercel --prod
```

Anotar el dominio asignado.

- [ ] **Step 4: Registrar las URI de redirección de producción**

Pedir al administrador que añada al cliente OAuth `Mesa de Control web`, sustituyendo `<dominio>` por el dominio real:

Orígenes autorizados:
```
https://<dominio>
```

URI de redirección:
```
https://<dominio>/api/auth/callback/google
https://<dominio>/api/mesa/callback
```

Actualizar `docs/operacion/configuracion-google-cloud.md` con los valores definitivos.

- [ ] **Step 5: Autorizar el consentimiento en producción**

El refresh token guardado sirve para cualquier entorno porque la credencial vive en la base de datos compartida. Aun así, verificar en el dominio de producción:

1. Entrar con `mesadecontrol@gplusseguros.mx`.
2. Ir a `/ajustes`: debe mostrar "Consentimiento activo" y el título de la hoja de desarrollo.
3. Si muestra error, pulsar **Volver a autorizar** desde el dominio de producción.

- [ ] **Step 6: Verificación final de la etapa**

Lista completa, toda manual y toda obligatoria:

1. Los cinco correos de la allowlist entran al despliegue de producción.
2. Una cuenta ajena al dominio es rechazada con mensaje claro.
3. `/ajustes` solo es accesible para `mesadecontrol@`.
4. `/ajustes` muestra el consentimiento activo y el título `Prueba formulario mesa de control`.
5. `pnpm test` pasa en local.
6. No hay secretos en el repositorio: `git log -p | grep -iE "AUTH_SECRET|CLIENT_SECRET|ENC_KEY|POSTGRES_URL" ` no devuelve valores.

- [ ] **Step 7: Commit y cierre de etapa**

```bash
git add -A
git commit -m "chore: despliegue de la etapa 0 en Vercel"
git push
```

---

## Criterio de cierre de la Etapa 0

La etapa está terminada cuando, en el despliegue de producción: los cinco correos autorizados entran y cualquier otro es rechazado con motivo explicado; `/ajustes` reporta el consentimiento de la mesa activo y demuestra acceso real a Google leyendo el título de la hoja de desarrollo; y la suite de pruebas pasa completa. Ninguna escritura se ha ejecutado sobre ninguna hoja.

Al cerrar, se escribe el plan de la Etapa 1 (lectura del Sheet y cola de casos).
