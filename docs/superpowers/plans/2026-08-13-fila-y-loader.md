# La fila de casos y los indicadores de carga — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la aplicación llame "fila" a lo que hoy llama "cola", y que cada clic que cambia de vista responda de inmediato con una señal visible.

**Architecture:** Tres cambios en orden. Primero el renombrado, que mueve el directorio de la ruta y por eso conviene hacerlo antes de tocar los enlaces. Después la conversión de la navegación a `next/link`, que es la causa real de la lentitud reportada. Al final los indicadores: `loading.tsx` para los cambios de ruta y `useLinkStatus`/`useTransition` para los cambios de vista dentro de la misma ruta, que son dos mecanismos distintos porque Next los trata distinto.

**Tech Stack:** Next.js 16.3.0 (App Router), React 19, TypeScript estricto, Tailwind CSS 4, lucide-react 1.31, Vitest.

**Hallazgo que motiva la Task 2.** La aplicación **no usa `next/link` en ningún lado**: las trece navegaciones internas son `<a href="/…">`, es decir recargas completas del documento. Cada clic vuelve a descargar el HTML, revalida la sesión y rerenderiza todo desde cero, sin prefetch y sin transición de cliente. Eso explica la lentitud que se percibe, y también por qué no hay ninguna señal de carga: durante una recarga completa el navegador solo muestra su propia ruedita en la pestaña, y la página anterior se queda congelada. Poner un spinner encima sin arreglar esto sería maquillaje: el spinner ni alcanzaría a montarse.

## Global Constraints

- **Decidido con el área el 13/8/2026:** lo visible y la URL pasan a "fila", con redirección permanente desde `/cola`; el **código interno sigue diciendo `cola`** (módulo `src/lib/casos/cola.ts`, `cargarCola`, `VENTANA_COLA_DIAS`). Solo cambia el literal del tipo `Vista`, porque ese valor viaja en la URL.
- **En el código, `fila` es el número de renglón de la hoja** (`caso.fila`, la ruta `/caso/[fila]`) y eso no cambia. Por eso los dos mensajes de interfaz que hoy dicen "fila" hablando del renglón pasan a decir **"registro"**.
- `useLinkStatus` se importa de `next/link` y existe en esta versión (verificado en `node_modules/next/dist/client/link.d.ts:117`). Requiere estar **dentro** de un `<Link>` y en un componente cliente.
- El icono de carga es **`LoaderCircle`** de lucide (`node_modules/lucide-react/dist/esm/icons/loader-circle.mjs`). No usar `Loader2`, que en la 1.x es el alias viejo.
- **No correr `shadcn add`** para el esqueleto: reescribe `globals.css` y en este proyecto eso ya rompió la tipografía una vez (restricción 6 de `AVANCE.md`). El componente se escribe a mano.
- **No usar `prettier`** en este repo (restricción 13).
- El repositorio **no tiene entorno de DOM** para pruebas: `vitest.config.ts` declara `environment: 'node'` y los 28 archivos de prueba son `.ts` de lógica. Agregar jsdom y testing-library solo para esto no se justifica, así que lo que se puede probar automáticamente son las rutas y la existencia de los archivos; el comportamiento visual se verifica a mano con el servidor de desarrollo.
- Comentarios y textos en español con acentos. Sin punto y coma, comillas simples, 100 columnas.

---

### Task 1: La cola se llama fila

**Files:**
- Move: `src/app/cola/` → `src/app/fila/` (con `git mv`, para conservar el historial)
- Modify: `src/app/fila/page.tsx` (etiquetas, título, enlaces de pestañas)
- Modify: `src/app/fila/filtros.tsx:123,187` (dos `router.push`)
- Modify: `src/app/page.tsx:6`, `src/app/(auth)/login/page.tsx:14`, `src/lib/auth/guard.ts:21`, `src/app/ajustes/page.tsx:85-86`, `src/app/caso/[fila]/page.tsx:48,63,136-140`
- Modify: `src/lib/casos/cola.ts:16,116` (literal `'cola'` del tipo `Vista`)
- Modify: `src/lib/casos/cola.test.ts` (cinco usos de `vista: 'cola'`)
- Modify: `src/lib/google/sheet-writer.ts:70` y `src/app/caso/[fila]/seguimiento-form.tsx:196` y `src/app/caso/[fila]/page.tsx:61` ("fila" → "registro")
- Modify: `next.config.ts` (redirección)
- Create: `src/app/rutas.test.ts`

**Interfaces:**
- Produces: la ruta `/fila`, el valor de búsqueda `?vista=fila`, y el archivo de pruebas `src/app/rutas.test.ts`, que la Task 2 amplía.
- Consumes: nada.

- [ ] **Step 1: Escribir la prueba de rutas**

Crear `src/app/rutas.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) return fuentes(ruta)
    const esFuente = ruta.endsWith('.ts') || ruta.endsWith('.tsx')
    return esFuente && !ruta.includes('.test.') ? [ruta] : []
  })
}

const ARCHIVOS = fuentes(SRC).map((ruta) => ({
  ruta: ruta.replace(`${process.cwd()}/`, ''),
  texto: readFileSync(ruta, 'utf8'),
}))

describe('la bandeja de casos vive en /fila', () => {
  // El área pidió que nada en la herramienta dijera "cola". La ruta también,
  // porque se ve en la barra de direcciones.
  it('ningún archivo apunta a /cola', () => {
    const culpables = ARCHIVOS.filter((a) => /['"`]\/cola\b/.test(a.texto)).map((a) => a.ruta)
    expect(culpables).toEqual([])
  })

  it('next.config.ts redirige /cola a /fila, para no romper enlaces guardados', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    expect(config).toContain("source: '/cola'")
    expect(config).toContain("destination: '/fila'")
    expect(config).toContain('permanent: true')
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `pnpm vitest run src/app/rutas.test.ts`
Expected: FAIL. La primera prueba lista siete archivos con `/cola` y la segunda no encuentra la redirección.

- [ ] **Step 3: Mover el directorio de la ruta**

```bash
git mv src/app/cola src/app/fila
```

- [ ] **Step 4: Cambiar los destinos de navegación**

En cada archivo, sustituir la cadena `/cola` por `/fila`:

- `src/app/page.tsx:6` — `redirect(sesion ? '/fila' : '/login')`
- `src/app/(auth)/login/page.tsx:14` — `await signIn('google', { redirectTo: '/fila' })`
- `src/lib/auth/guard.ts:21` — `if (usuario.rol !== 'admin') redirect('/fila')`
- `src/app/ajustes/page.tsx:85` — `href="/fila"`
- `src/app/caso/[fila]/page.tsx:48,63,136` — `href="/fila"`
- `src/app/fila/page.tsx:174` — `href={`/fila?vista=${v.clave}`}`
- `src/app/fila/filtros.tsx:123` — `router.push(`/fila?${nuevos.toString()}`)`
- `src/app/fila/filtros.tsx:187` — `router.push(vista ? `/fila?vista=${vista}` : '/fila')`

- [ ] **Step 5: Cambiar el literal de la vista**

En `src/lib/casos/cola.ts:16`:

```ts
/**
 * Las tres vistas de la bandeja. El literal viaja en la URL como `?vista=…`, y
 * por eso dice `fila`: es el nombre que el área le puso a la bandeja. El módulo
 * sigue llamándose `cola` porque en el código `fila` es el renglón de la hoja.
 */
export type Vista = 'fila' | 'rezago' | 'todos'
```

Y en la línea 116, dentro de `filtrar`:

```ts
      if (vista === 'fila' && !enVentana) return false
```

En `src/lib/casos/cola.test.ts`, cambiar los cinco `vista: 'cola'` por `vista: 'fila'`.

- [ ] **Step 6: Cambiar las etiquetas visibles**

En `src/app/fila/page.tsx`:

- línea 29 — `const ICONO_VISTA = { fila: Inbox, rezago: Timer, todos: Search } as const`
- línea 38 — `clave: 'fila',`
- línea 39 — `etiqueta: 'Fila de trabajo',`
- línea 83 — `<h1 className="text-xl font-semibold">Fila de casos</h1>`
- línea 109 — `: 'fila'`

En `src/app/ajustes/page.tsx:86` — `Volver a la fila`.
En `src/app/caso/[fila]/page.tsx:140` — `Fila de casos`.
En `src/app/caso/[fila]/page.tsx:48-49` y `63-64` — `Volver a la fila`.

- [ ] **Step 7: Desambiguar el renglón de la hoja**

Ahora que "fila" es la bandeja, los tres textos que hablaban del renglón dicen "registro".

En `src/lib/google/sheet-writer.ts:70`, dentro de `FilaCambiadaError`:

```ts
      `El registro cambió desde que abriste el caso: su ${detalle.campo} era "${
        detalle.esperado ?? '(vacío)'
      }" y ahora es "${detalle.encontrado ?? '(vacío)'}".`
```

La clase conserva su nombre `FilaCambiadaError`: es código, y ahí `fila` sigue siendo el renglón. Las pruebas del escritor comprueban la clase, no el texto, así que no cambian.

En `src/app/caso/[fila]/seguimiento-form.tsx:196`:

```tsx
            {resultado.conflicto ? 'No se guardó: el registro cambió' : 'No se pudo guardar'}
```

En `src/app/caso/[fila]/page.tsx:61`:

```tsx
          Puede que el registro {fila} sea anterior a 2026 o que no tenga fecha de recepción.
```

- [ ] **Step 8: Agregar la redirección**

Reemplazar `next.config.ts` completo:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // La bandeja se llamaba /cola hasta el 13 de agosto de 2026. La
      // redirección protege los marcadores que la mesa ya tenga guardados;
      // Next conserva la cadena de consulta al redirigir.
      { source: '/cola', destination: '/fila', permanent: true },
    ]
  },
}

export default nextConfig
```

Un enlace viejo con `?vista=cola` no necesita nada: `page.tsx` valida el valor contra `VISTAS` y, al no encontrarlo, cae en la vista por omisión, que es justamente la fila de trabajo.

- [ ] **Step 9: Correr la prueba de rutas y la suite**

Run: `pnpm vitest run src/app/rutas.test.ts && pnpm test`
Expected: PASS las dos de rutas y las 324 anteriores.

- [ ] **Step 10: Typecheck y build**

Run: `pnpm typecheck && pnpm build`
Expected: sin errores. El build debe listar la ruta `/fila` y ya no `/cola`.

- [ ] **Step 11: Comprobar la redirección a mano**

Con `pnpm dev`, entrar a `http://localhost:3000/cola` y confirmar que la barra de direcciones queda en `/fila` con la bandeja cargada.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: la cola de casos ahora se llama fila"
```

---

### Task 2: Navegación de cliente con next/link

Convertir las trece navegaciones internas a `<Link>`. Esto es lo que de verdad quita la lentitud: la transición deja de ser una recarga del documento, el layout y la sesión se conservan, y Next puede precargar el destino.

**Files:**
- Modify: `src/app/fila/page.tsx` (pestañas de vista, enlace a Ajustes ×2, enlace de cada caso)
- Modify: `src/app/caso/[fila]/page.tsx` (tres enlaces a `/fila`)
- Modify: `src/app/ajustes/page.tsx` (enlace a `/fila`; **no** el de `/api/mesa/autorizar`)
- Modify: `src/app/(auth)/sin-acceso/page.tsx:25` (enlace a `/login`)
- Modify: `src/app/rutas.test.ts` (prueba nueva)

**Interfaces:**
- Consumes: las rutas ya renombradas en la Task 1.
- Produces: nada nuevo de API; deja los `<Link>` sobre los que la Task 3 monta los indicadores.

- [ ] **Step 1: Escribir la prueba de que no queda navegación con recarga**

Agregar a `src/app/rutas.test.ts`:

```ts
describe('la navegación interna es de cliente', () => {
  // Un <a href="/…"> recarga el documento completo: vuelve a pedir el HTML,
  // revalida la sesión y rerenderiza todo. Era la causa de la lentitud que
  // reportó el área el 13/8/2026, y además impide cualquier indicador de carga,
  // porque durante la recarga la página anterior queda congelada.
  const ANCLA_INTERNA = /<a[\s\S]{0,200}?href=["'`]\/(?!api\/)/

  it('ninguna página navega dentro de la app con <a>', () => {
    const culpables = ARCHIVOS.filter(
      (a) => a.ruta.startsWith('src/app/') && ANCLA_INTERNA.test(a.texto),
    ).map((a) => a.ruta)
    expect(culpables).toEqual([])
  })

  it('las rutas de API sí se visitan con <a>, porque redirigen fuera de la app', () => {
    // /api/mesa/autorizar manda a la pantalla de consentimiento de Google: un
    // Link de cliente no puede seguir esa redirección.
    const ajustes = ARCHIVOS.find((a) => a.ruta === 'src/app/ajustes/page.tsx')!
    expect(ajustes.texto).toContain('href="/api/mesa/autorizar"')
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `pnpm vitest run src/app/rutas.test.ts`
Expected: FAIL en la primera prueba nueva, con la lista de archivos que todavía usan `<a>`: `src/app/fila/page.tsx`, `src/app/caso/[fila]/page.tsx`, `src/app/ajustes/page.tsx`, `src/app/(auth)/sin-acceso/page.tsx`. La segunda pasa desde el principio.

- [ ] **Step 3: Convertir los enlaces de la fila**

En `src/app/fila/page.tsx`, agregar el import:

```tsx
import Link from 'next/link'
```

Cambiar `<a` por `<Link` y `</a>` por `</Link>` en los tres enlaces del archivo: el de Ajustes de la pantalla de error (línea ~92), el de Ajustes del encabezado (línea ~156) y el de cada caso de la tabla (línea ~247). Las pestañas de vista se convierten en el mismo paso:

```tsx
                <Link
                  key={v.clave}
                  href={`/fila?vista=${v.clave}`}
                  prefetch={false}
                  title={v.ayuda}
                  className={...}
                >
```

`prefetch={false}` en las pestañas y en los enlaces de la tabla es deliberado: la vista "Todos los pendientes" puede traer cientos de renglones y el prefetch por omisión dispararía una petición por cada enlace que entre en pantalla. La Task 3 le pone a estos enlaces un indicador de clic, que es justo el caso de uso que la documentación de `useLinkStatus` describe.

El enlace de cada caso queda así:

```tsx
                    <Link
                      href={`/caso/${caso.fila}`}
                      prefetch={false}
                      className="text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary"
                      title="Abrir el caso"
                    >
```

- [ ] **Step 4: Convertir los enlaces del caso, de Ajustes y de sin-acceso**

En `src/app/caso/[fila]/page.tsx`, importar `Link` y convertir los tres enlaces a `/fila`. El del encabezado **sí** lleva prefetch por omisión —es uno solo por página y hace que volver sea instantáneo—, así que basta cambiar la etiqueta:

```tsx
          <Link
            href="/fila"
            className="inline-flex items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Fila de casos
          </Link>
```

En `src/app/ajustes/page.tsx`, importar `Link` y convertir **solo** el enlace a `/fila`. El de `/api/mesa/autorizar` se queda como `<a>`; agregarle este comentario para que nadie lo "arregle" después:

```tsx
        {/* Ruta de servidor que redirige al consentimiento de Google: tiene que
            ser una navegación del documento, no un Link de cliente. */}
```

En `src/app/(auth)/sin-acceso/page.tsx:25`, importar `Link` y convertir el enlace a `/login`.

- [ ] **Step 5: Correr las pruebas y el typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS, con las cuatro pruebas de `rutas.test.ts` en verde.

- [ ] **Step 6: Comprobar a mano que la navegación ya no recarga**

Con `pnpm dev`, abrir las herramientas de desarrollo en la pestaña de red y navegar de la fila a un caso y de vuelta. Antes había una petición de documento (`Doc`) por clic; ahora deben verse solo peticiones de datos (`Fetch`), y el encabezado no debe parpadear.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "perf: navegación de cliente en lugar de recargar el documento"
```

---

### Task 3: Indicadores de carga

Dos mecanismos, porque Next trata distinto los dos tipos de navegación:

| Interacción | Tipo | Qué la cubre |
| --- | --- | --- |
| Abrir un caso desde la fila | cambio de ruta | `caso/[fila]/loading.tsx` + indicador en el enlace |
| Volver a la fila | cambio de ruta | `fila/loading.tsx` + prefetch |
| Cambiar entre Fila de trabajo, Rezago y Todos | misma ruta, otro `?vista=` | `useLinkStatus` en la pestaña |
| Filtrar o buscar | misma ruta, `router.push` | `useTransition` en `filtros.tsx` |

`loading.tsx` **no** se vuelve a mostrar cuando solo cambian los parámetros de búsqueda de la misma ruta, y por eso las dos últimas filas necesitan otra cosa. A favor: el layout raíz de este proyecto es estático —no lee `cookies()` ni sesión—, así que `loading.tsx` sí puede mostrarse de inmediato; si algún día el layout leyera datos de runtime, la navegación volvería a bloquearse (está en la documentación de `loading.js`).

**Files:**
- Create: `src/components/esqueleto.tsx`
- Create: `src/components/punto-de-carga.tsx`
- Create: `src/app/fila/loading.tsx`
- Create: `src/app/caso/[fila]/loading.tsx`
- Modify: `src/app/fila/page.tsx` (indicador en pestañas y en el enlace de cada caso)
- Modify: `src/app/fila/filtros.tsx` (`useTransition`)
- Modify: `src/app/rutas.test.ts` (prueba de que los `loading.tsx` existen)

**Interfaces:**
- Consumes: los `<Link>` de la Task 2. `useLinkStatus` no funciona fuera de un `Link`.
- Produces: `Esqueleto({ className })` y `PuntoDeCarga({ className })`.

- [ ] **Step 1: Escribir la prueba de que las pantallas de carga existen**

Agregar a `src/app/rutas.test.ts`:

```ts
describe('cada vista lenta tiene su pantalla de carga', () => {
  // Son las dos navegaciones que cambian de ruta y leen la hoja de cálculo.
  it('la fila y el caso declaran loading.tsx', () => {
    const rutas = ARCHIVOS.map((a) => a.ruta)
    expect(rutas).toContain('src/app/fila/loading.tsx')
    expect(rutas).toContain('src/app/caso/[fila]/loading.tsx')
  })

  it('el indicador de clic vive dentro de un Link y es de cliente', () => {
    const punto = ARCHIVOS.find((a) => a.ruta === 'src/components/punto-de-carga.tsx')!
    expect(punto.texto).toContain("'use client'")
    expect(punto.texto).toContain('useLinkStatus')
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `pnpm vitest run src/app/rutas.test.ts`
Expected: FAIL, los archivos no existen.

- [ ] **Step 3: Escribir el esqueleto**

Crear `src/components/esqueleto.tsx`:

```tsx
/**
 * Bloque que late mientras algo carga. Es propio y no el de shadcn porque
 * `shadcn add` reescribe `globals.css`, y eso ya rompió la tipografía una vez
 * (restricción 6 de docs/AVANCE.md).
 */
export function Esqueleto({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-secondary ${className}`} />
}
```

- [ ] **Step 4: Escribir el indicador de clic**

Crear `src/components/punto-de-carga.tsx`:

```tsx
'use client'

import { useLinkStatus } from 'next/link'
import { LoaderCircle } from 'lucide-react'

/**
 * Señal de "ya recibimos el clic" para las navegaciones que no cambian de ruta,
 * donde `loading.tsx` no se vuelve a mostrar: cambiar de vista o de filtro.
 *
 * Ocupa su lugar siempre y solo cambia de opacidad, para no mover el texto de al
 * lado al aparecer. El retraso de la transición evita el parpadeo cuando la
 * navegación es rápida: si termina antes de los 200 ms, nunca llega a verse.
 */
export function PuntoDeCarga({ className = '' }: { className?: string }) {
  const { pending } = useLinkStatus()
  return (
    <LoaderCircle
      aria-hidden
      className={`size-4 shrink-0 animate-spin transition-opacity delay-200 duration-150 ${
        pending ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    />
  )
}
```

- [ ] **Step 5: Escribir la pantalla de carga de la fila**

Crear `src/app/fila/loading.tsx`:

```tsx
import { Esqueleto } from '@/components/esqueleto'
import { Card } from '@/components/ui/card'

/**
 * Fallback instantáneo al entrar a la fila. Repite la forma del encabezado real
 * —el rótulo y las tres pestañas— para que la transición no parpadee, y deja
 * ocho renglones de tabla, que es el orden de magnitud de la vista por omisión.
 */
export default function Cargando() {
  return (
    <div className="min-h-full">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl space-y-5 px-6 py-5">
          <div className="space-y-1">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Gplus Seguros
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Mesa de Control</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Esqueleto className="h-11 w-48" />
            <Esqueleto className="h-11 w-32" />
            <Esqueleto className="h-11 w-56" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
        <Esqueleto className="h-6 w-96" />
        <Esqueleto className="h-12 w-full" />
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="divide-y">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Esqueleto className="size-3 rounded-full" />
                <Esqueleto className="h-5 w-24" />
                <Esqueleto className="h-5 w-20" />
                <Esqueleto className="h-5 w-16" />
                <Esqueleto className="h-5 w-24" />
                <Esqueleto className="h-5 flex-1" />
              </div>
            ))}
          </div>
        </Card>
      </main>

      <p role="status" className="sr-only">
        Cargando la fila de casos…
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Escribir la pantalla de carga del caso**

Crear `src/app/caso/[fila]/loading.tsx`:

```tsx
import { Esqueleto } from '@/components/esqueleto'
import { Card } from '@/components/ui/card'

/**
 * Fallback al abrir un caso. Conserva la barra superior con el enlace de
 * regreso, que es lo primero que la mesa busca si se equivocó de caso.
 */
export default function Cargando() {
  return (
    <div className="min-h-full bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl space-y-3 px-6 py-4">
          <Esqueleto className="h-6 w-36" />
          <div className="flex flex-wrap items-center gap-3">
            <Esqueleto className="h-9 w-56" />
            <Esqueleto className="h-7 w-28" />
          </div>
          <Esqueleto className="h-5 w-72" />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-3 p-6">
            <Esqueleto className="h-6 w-40" />
            {Array.from({ length: 6 }, (_, i) => (
              <Esqueleto key={i} className="h-5 w-full" />
            ))}
          </Card>
          <Card className="space-y-3 p-6">
            <Esqueleto className="h-6 w-52" />
            <Esqueleto className="h-24 w-full" />
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="space-y-3 p-6">
            <Esqueleto className="h-6 w-32" />
            {Array.from({ length: 4 }, (_, i) => (
              <Esqueleto key={i} className="h-10 w-full" />
            ))}
          </Card>
        </div>
      </main>

      <p role="status" className="sr-only">
        Cargando el caso…
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Poner el indicador en las pestañas y en los casos**

En `src/app/fila/page.tsx`, importar el componente:

```tsx
import { PuntoDeCarga } from '@/components/punto-de-carga'
```

Dentro de cada pestaña, después del contador:

```tsx
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-sm tabular-nums ${
                      activa ? 'bg-primary/15' : 'bg-secondary'
                    }`}
                  >
                    {conteos[v.clave]}
                  </span>
                  <PuntoDeCarga />
```

Y dentro del `<Link>` del folio de cada caso, envolviendo el contenido para que el punto quede a su derecha:

```tsx
                    <Link
                      href={`/caso/${caso.fila}`}
                      prefetch={false}
                      className="inline-flex items-center gap-1.5 text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary"
                      title="Abrir el caso"
                    >
                      {caso.folio ?? (
                        <Badge variant="outline" title="Esta petición llegó sin folio">
                          sin folio
                        </Badge>
                      )}
                      <PuntoDeCarga />
                    </Link>
```

Conservar el resto del contenido del enlace tal como esté; lo único que se agrega es `inline-flex items-center gap-1.5` en la clase y el `<PuntoDeCarga />` al final.

- [ ] **Step 8: Indicar el estado pendiente de los filtros**

En `src/app/fila/filtros.tsx`, los dos `router.push` no avisan nada. Los dos están dentro del mismo componente `Filtros` —el de `aplicar()`, línea ~123, y el del botón "Limpiar", línea ~187—, así que una sola transición cubre ambos.

Agregar `useTransition` al import de React que ya existe en el archivo, y dentro de `Filtros`, junto a `const router = useRouter()`:

```tsx
  const [pendiente, iniciarTransicion] = useTransition()
```

Cada `router.push(...)` queda dentro de la transición:

```tsx
    iniciarTransicion(() => {
      router.push(`/fila?${nuevos.toString()}`)
    })
```

Y junto a los controles, un aviso que solo aparece mientras dura:

```tsx
      {pendiente && (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          Filtrando…
        </span>
      )}
```

Importar `LoaderCircle` de `lucide-react` en ese archivo. El aviso va en el contenedor de los controles de `Filtros`, al lado del botón "Limpiar", que es donde el ojo ya está mirando cuando se filtra.

- [ ] **Step 9: Correr las pruebas, el typecheck y el build**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: PASS. El build debe mostrar las rutas `/fila` y `/caso/[fila]`.

- [ ] **Step 10: Comprobar los cuatro casos a mano, con la red frenada**

Con `pnpm dev` y la red limitada a "Slow 4G" en las herramientas de desarrollo, para que los estados de carga duren lo suficiente:

1. Desde la fila, abrir un caso: el punto debe girar en el folio en cuanto se hace clic, y luego aparecer el esqueleto del caso.
2. Volver con "Fila de casos": el esqueleto de la fila debe aparecer de inmediato.
3. Cambiar entre las tres pestañas: el punto debe girar en la pestaña clicada, sin que el resto de la pantalla se mueva.
4. Aplicar un filtro: debe verse "Filtrando…".

Confirmar además que en una navegación rápida —sin frenar la red— **no** se alcanza a ver el punto: es lo que evita el retraso de 200 ms de la transición.

- [ ] **Step 11: Anotar las decisiones en `docs/AVANCE.md`**

En la tabla de decisiones vigentes, agregar dos renglones: que la bandeja se llama **fila** en la interfaz y en la URL mientras el código sigue diciendo `cola`, con `fila` reservado para el renglón de la hoja; y que la navegación interna es de cliente con `next/link`, con `loading.tsx` para los cambios de ruta y `useLinkStatus`/`useTransition` para los cambios de parámetros.

Agregar también a las restricciones aprendidas: que `loading.tsx` no se vuelve a mostrar cuando solo cambian los parámetros de búsqueda de la misma ruta, y que dejaría de funcionar del todo si el layout raíz empezara a leer datos de runtime.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: indicadores de carga en los cambios de vista"
```
