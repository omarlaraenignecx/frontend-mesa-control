# Hora de la bitácora en el reloj de la mesa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la bitácora del caso (y cualquier otra hora que se pinte en el servidor) muestre la hora de la mesa (UTC−6) y no la de Vercel (UTC).

**Architecture:** `src/lib/reloj.ts` ya es el único lugar que conoce el desfase, y `formatearFechaHoja` ya da el texto en el formato de la hoja. Los puntos rotos son los que formatean con `toLocaleString`/getters locales sin pasar por ahí. Se cambian a `formatearFechaHoja`/`partesDeLaMesa` y se agrega una prueba guardián que impide volver a meter formateo dependiente de la zona del servidor.

**Tech Stack:** Next.js (App Router, Server Components), TypeScript, Vitest (`pnpm test` corre con `TZ=UTC`, igual que Vercel).

**Spec:** este mismo documento, sección «Investigación».

## Investigación (2026-10-08)

Reporte del área (audio de WhatsApp): movimientos hechos alrededor de la 13:00 aparecen en la bitácora como 7:46 p.m., 8:00 p.m.

- **Raíz:** `src/components/casos/pantalla-de-caso.tsx:442` pinta `b.creadoEn.toLocaleString('es-MX')`. Es Server Component, Vercel corre en UTC → cada hora sale +6 h. Reproducido: `TZ=UTC node -e "new Date('2026-10-08T13:20:00-06:00').toLocaleString('es-MX')"` → `8/10/2026, 7:20:00 p.m.`
- **Producción (base + hoja `1OfK8ve8…`), sólo lectura:** fila 7614, bitácora `creado_en` = 18:45:06 UTC; la hoja tiene KD `8/10/2026 12:45:06`; la pantalla muestra «6:45:06 p.m.». La base guarda bien el instante (`timestamptz`); lo malo es sólo cómo se pinta.
- **El tiempo de atención está bien:** KY recalculado desde A y KD coincide en 7607 (5.73), 7612 (0.22), 7614 (2.51). KD se sella en hora de la mesa. No hay que tocar `tiempo-atencion.ts` ni corregir datos en la hoja.
- **No lo introdujo el tiempo de atención:** la línea viene de `f27fb89` (módulo de siniestros). El área lo notó ahora porque empezó a comparar la bitácora contra KD/KY.
- **Mismo defecto en otros lados:** `src/lib/correo/cadena.ts:52` (`getHours()` en `renderCadena`, que corre en la server action de reenvío: el correo reenviado lleva horas UTC), `src/app/siniestros/ajustes/page.tsx:33` y `src/app/ajustes/page.tsx:73` (Server Components), y `src/lib/google/sheet-reader.ts:102` (filtro de año de la cola con `getFullYear()` en UTC).
- **Hallazgo lateral:** `SHEET_ID` de `.env.local` no es la hoja productiva (llega a la fila 7187; producción va en 7615+). Cualquier script local corre contra esa otra hoja salvo que se pase `SHEET_ID` explícito. Fuera de alcance de este plan; se reporta a Omar.

## Global Constraints

- Ningún formateo de fecha/hora para la mesa usa `toLocaleString`, `toLocaleTimeString` ni getters locales (`getHours`, `getDate`, …) en código que corre en servidor; todo pasa por `src/lib/reloj.ts` o `src/lib/fecha.ts`.
- Formato visible de la bitácora = formato de la hoja (`d/m/aaaa h:mm:ss`), para que la mesa lo compare tal cual contra A y KD.
- No se modifican datos en la base ni en la hoja.

## Review Focus

- Movimiento después de las 18:00 de la mesa (ya es el día siguiente en UTC): la bitácora debe mostrar el día de la mesa → cubierto por `fecha.test.ts` («no escribe el día siguiente…») y por la prueba de Task 2.
- Correo reenviado con mensajes de la tarde: la hora en el cuerpo debe ser la de la mesa → prueba en Task 2.
- `conversacion.tsx` es `'use client'` pero se prerenderiza en el servidor: con `toLocaleString` sin zona el HTML del servidor y el del navegador difieren (hydration mismatch) → se corrige en Task 2.
- Alguien agrega mañana otro `toLocaleString` en un Server Component → prueba guardián de Task 3.
- `plantillas.tsx` (`toLocaleDateString`, sólo fecha, componente cliente) queda permitido explícitamente en la lista de excepciones de Task 3, con su razón.

---

### Task 1: La bitácora y los ajustes muestran la hora de la mesa

**Files:**
- Modify: `src/components/casos/pantalla-de-caso.tsx:442`
- Modify: `src/app/siniestros/ajustes/page.tsx:32-34`
- Modify: `src/app/ajustes/page.tsx:73`
- Test: `src/lib/fecha.test.ts`

(Esta tarea no tiene prueba que falle antes del cambio porque `pantalla-de-caso.tsx` no tiene pruebas de render; la regresión la atrapa la prueba guardián de Task 3.)

**Interfaces:**
- Consumes: `formatearFechaHoja(instante: Date): string` de `@/lib/fecha`.
- Produces: nada nuevo.

- [ ] **Step 1: Prueba que fija el caso real del reporte**

Agregar en `src/lib/fecha.test.ts`, dentro de `describe('formatearFechaHoja', …)`:

```ts
  it('pinta el movimiento de la bitácora a la hora en que la mesa lo hizo', () => {
    // Fila 7614 en producción: creado_en 18:45:06 UTC, KD 8/10/2026 12:45:06.
    // Con toLocaleString en Vercel salía «6:45:06 p.m.».
    expect(formatearFechaHoja(new Date('2026-10-08T18:45:06Z'))).toBe('8/10/2026 12:45:06')
  })
```

- [ ] **Step 2: Correrla**

Run: `pnpm test src/lib/fecha.test.ts`
Expected: PASS (la función ya es correcta; la prueba documenta el contrato que la bitácora va a usar).

- [ ] **Step 3: Usar `formatearFechaHoja` en los tres lugares**

`src/components/casos/pantalla-de-caso.tsx`: agregar `import { formatearFechaHoja } from '@/lib/fecha'` y cambiar la línea 442 a:

```tsx
                          {formatearFechaHoja(b.creadoEn)} · {b.correoUsuario.split('@')[0]}
```

`src/app/siniestros/ajustes/page.tsx`: agregar el import y cambiar la función:

```ts
function fecha(d: Date): string {
  return formatearFechaHoja(d)
}
```

`src/app/ajustes/page.tsx`: agregar el import y cambiar la línea 73 a:

```tsx
              {formatearFechaHoja(acceso.credencial.autorizadoEn)}
```

- [ ] **Step 4: Verificar**

Run: `pnpm test && pnpm tsc --noEmit && pnpm lint`
Expected: todo verde.

- [ ] **Step 5: Commit**

```bash
git add src/components/casos/pantalla-de-caso.tsx src/app/siniestros/ajustes/page.tsx src/app/ajustes/page.tsx src/lib/fecha.test.ts
git commit -m "fix: la bitácora muestra la hora de la mesa, no la del servidor"
```

### Task 2: La cadena de correo y la conversación usan el reloj de la mesa

**Files:**
- Modify: `src/lib/correo/cadena.ts:48-53`
- Modify: `src/app/caso/[fila]/conversacion.tsx:29-36`
- Test: `src/lib/correo/cadena.test.ts`

**Interfaces:**
- Consumes: `partesDeLaMesa(instante: Date): PartesDeFecha` de `@/lib/reloj`.
- Produces: nada nuevo.

- [ ] **Step 1: Prueba que falla**

En `src/lib/correo/cadena.test.ts` agregar (reusar el helper/fixture de hilo que ya usa el archivo para construir `hilo` y `v`; sólo cambia `fechaIso` del mensaje):

```ts
it('fecha cada mensaje con la hora de la mesa, no la del servidor', () => {
  const hilo = hiloDePrueba([{ fechaIso: '2026-10-08T19:20:00.000Z' }])
  const { texto, html } = renderCadena(hilo, variables)
  // 19:20 UTC son las 13:20 en la mesa.
  expect(texto).toContain('8 oct 2026, 13:20')
  expect(html).toContain('8 oct 2026, 13:20')
  expect(texto).not.toContain('19:20')
})
```

Si el archivo no tiene un helper así, construir el `Hilo` en línea copiando la forma del primer caso del archivo (líneas 10-30) y cambiando `fechaIso`.

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test src/lib/correo/cadena.test.ts`
Expected: FAIL — el texto contiene `19:20`.

- [ ] **Step 3: Implementar**

`src/lib/correo/cadena.ts`:

```ts
import { partesDeLaMesa } from '@/lib/reloj'

function fechaLegible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dos = (n: number) => String(n).padStart(2, '0')
  const { dia, mes, anio, horas, minutos } = partesDeLaMesa(d)
  return `${dia} ${MESES[mes - 1]} ${anio}, ${horas}:${dos(minutos)}`
}
```

`src/app/caso/[fila]/conversacion.tsx` (se prerenderiza en el servidor; con `toLocaleString` el HTML del servidor y el del navegador no coinciden):

```ts
import { partesDeLaMesa } from '@/lib/reloj'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function horaDe(iso: string): string {
  const { dia, mes, horas, minutos } = partesDeLaMesa(new Date(iso))
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(dia)} ${MESES[mes - 1]} ${dos(horas)}:${dos(minutos)}`
}
```

- [ ] **Step 4: Verificar**

Run: `pnpm test && pnpm tsc --noEmit && pnpm lint`
Expected: todo verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/correo/cadena.ts src/lib/correo/cadena.test.ts "src/app/caso/[fila]/conversacion.tsx"
git commit -m "fix: el correo reenviado y la conversación usan la hora de la mesa"
```

### Task 3: Prueba guardián contra el formateo con la zona del servidor

**Files:**
- Create: `src/lib/reloj-guardian.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Escribir la prueba**

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Vercel corre en UTC y la mesa en UTC−6: cualquier hora formateada con la zona
 * del proceso sale seis horas adelantada. Ya pasó con la bitácora (8/10/2026).
 * Toda hora para la mesa pasa por `lib/reloj.ts` o `lib/fecha.ts`.
 */
const PROHIBIDO = /\.(toLocaleString|toLocaleTimeString|getHours|getMinutes|getDate|getMonth|getFullYear)\(/

// Excepciones con su razón. Agregar aquí sólo con una razón igual de concreta.
const PERMITIDOS = new Set([
  'src/lib/reloj.ts', // usa getters UTC, el regex no los toca, pero es el dueño del desfase
  'src/app/ajustes/plantillas.tsx', // componente cliente, sólo fecha de edición de plantilla
])

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === '__fixtures__' ? [] : archivos(p)
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : []
  })
}

describe('formateo de horas', () => {
  it('nadie formatea con la zona del servidor', () => {
    const raiz = process.cwd()
    const culpables = archivos(join(raiz, 'src'))
      .map((p) => relative(raiz, p))
      .filter((p) => !PERMITIDOS.has(p))
      .filter((p) => PROHIBIDO.test(readFileSync(p, 'utf8')))
    expect(culpables).toEqual([])
  })
})
```

- [ ] **Step 2: Correrla y verla fallar**

Run: `pnpm test src/lib/reloj-guardian.test.ts`
Expected: FAIL con `culpables = ['src/lib/google/sheet-reader.ts']` (línea 102: `marcaTemporal.getFullYear() < anioMinimo` usa el año UTC; un caso recibido el 31/12 después de las 18:00 de la mesa entra a la cola del año siguiente).

- [ ] **Step 3: Corregir `sheet-reader.ts` con su prueba**

En `src/lib/google/sheet-reader.test.ts` agregar un caso que construya una fila con marca temporal `31/12/2025 20:00:00` y verifique que `leerCasos(deps, 2026)` (o `construirCasos(…, 2026)`, según lo que ya use el archivo) **no** la incluye. Correrla: debe fallar.

Cambiar `src/lib/google/sheet-reader.ts`:

```ts
import { partesDeLaMesa } from '@/lib/reloj'
// …
    if (!marcaTemporal || partesDeLaMesa(marcaTemporal).anio < anioMinimo) return
```

Correr `pnpm test src/lib/google/sheet-reader.test.ts src/lib/reloj-guardian.test.ts`: ambas en verde.

- [ ] **Step 4: Comprobar el resto**

Si aparece otro archivo en `culpables`, revisarlo: si pinta una hora para la mesa, corregirlo con `formatearFechaHoja`/`partesDeLaMesa`; si no (p. ej. `toLocaleLowerCase` no aplica, el regex no lo atrapa), justificar en `PERMITIDOS`. Comprobar que la prueba sí muerde: revertir temporalmente la línea 442 de `pantalla-de-caso.tsx` y ver que falla.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reloj-guardian.test.ts src/lib/google/sheet-reader.ts src/lib/google/sheet-reader.test.ts
git commit -m "fix: el año de la cola y las horas visibles salen del reloj de la mesa"
```

### Task 4: Verificación en producción

- [ ] **Step 1:** Desplegar (merge a `main` como en los cambios anteriores).
- [ ] **Step 2:** Abrir en producción un caso con movimientos de hoy (p. ej. fila 7614) y comprobar que la bitácora muestra `8/10/2026 12:45:06` para el cierre, igual que KD en la hoja.
- [ ] **Step 3:** Avisar al área: la bitácora ya muestra la hora real; los registros anteriores también se ven bien porque la base siempre guardó el instante correcto. KD y el tiempo de atención (KY) nunca estuvieron mal.
