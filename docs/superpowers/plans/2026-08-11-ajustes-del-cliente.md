# Ajustes pedidos por el cliente — Plan de implementación

> Se ejecuta con la skill `superpowers:executing-plans`. Cada tarea cierra con
> `pnpm test`, `pnpm typecheck` y commit.

**Meta:** seis cambios pedidos por Gplus tras ver la herramienta: reenvío de la
conversación, cursor en todo lo clicable, semáforo por estatus final, columnas y
orden de la cola, filtro múltiple de estatus final, y acceso libre a los casos con
marca de quién atiende.

**Arquitectura:** no cambia. Se toca la capa de dominio (`src/lib/casos`,
`src/lib/correo`) con funciones puras probadas, y las vistas consumen lo nuevo.
El bloqueo desaparece de la aplicación; su tabla queda huérfana en la base y
documentada como tal.

---

## Decisiones tomadas con el área (2026-08-11)

1. **Adjuntos del reenvío:** se listan todos marcados, con casilla para desmarcar.
   Obligado por el límite de 25 MB de Gmail.
2. **El reenvío es "compartir la conversación":** sale como correo aparte, con
   asunto propio. Las respuestas al reenvío no se muestran en la herramienta.
   Por eso el asunto **no** debe contener la frase `Seguimiento de Caso | Gplus
   Seguros`: `consultaDeBusqueda()` busca esa frase como subcadena y el reenvío
   se colaría como hilo del caso si alguna vez se pierde el vínculo guardado.
3. **Modal de reenvío:** antes de enviar muestra cuántos mensajes y cuántos
   archivos se compartirán, con campo de destinatario y campo de CC.
4. **Columnas de la tabla:** se quitan las dos del final (`Estatus`, que en
   realidad mostraba el estatus inicial, y `Atiende`), porque las nuevas del
   inicio las reemplazan.
5. **Marca de quién atiende:** botón "Atender yo este caso" en el encabezado, que
   escribe `Quien Atendio` en la hoja.

## Hallazgos de la hoja que condicionan el diseño

Columna `KA` = *Estatus Final*. Su validación de datos permite exactamente
`Concluida`, `Improcedente`, `Tramite` (sin acento). El histórico completo trae
además `N/A` (570 filas), dos textos sueltos y 164 vacíos, **pero en 2026 —lo
único que la app lee— solo aparecen los tres valores válidos y 10 vacíos**.

Consecuencia: el semáforo mapea los tres valores conocidos, pinta gris cualquier
otro y deja el círculo hueco cuando no hay valor. Nunca truena por un valor
inesperado.

---

## Tarea 1: Cursor en todo lo clicable

Tailwind 4 dejó de poner `cursor: pointer` en los botones; su preflight usa el
valor por omisión del navegador. Se arregla en un solo lugar.

**Archivos:** `src/app/globals.css`, `src/app/estilos-base.test.ts` (crear)

- [x] **Paso 1:** test que lee `globals.css` y exige la regla para `button`,
      `[role="button"]`, `summary`, `select`, `label:has(> input[type="checkbox"])`
      y `a[href]`. El test existe porque `shadcn init` ya reescribió este archivo
      una vez y se llevó la tipografía; que no se lleve también esto en silencio.
- [x] **Paso 2:** ver el test fallar.
- [x] **Paso 3:** agregar en `@layer base`:
      `cursor: pointer` a los selectores anteriores y `cursor: not-allowed` a
      `:disabled`.
- [x] **Paso 4:** test verde; `pnpm build`; revisión visual en `/cola` y en un caso.
- [x] **Paso 5:** commit.

## Tarea 2: Semáforo por Estatus Final

**Archivos:** `src/lib/casos/semaforo.ts`, `src/lib/casos/semaforo.test.ts`,
`src/app/cola/page.tsx`, `src/app/caso/[fila]/page.tsx`

Nueva forma:

```ts
export type NivelSemaforo = 'verde' | 'ambar' | 'rojo' | 'desconocido'
export function semaforoDe(caso: Pick<Caso, 'estatusFinal'>): NivelSemaforo | null
```

`Concluida → verde`, `Improcedente → rojo`, `Tramite → ambar` (comparando sin
acentos ni mayúsculas, para que `Trámite` también entre), sin valor → `null`
(círculo hueco), cualquier otro → `desconocido` (gris).

`diasDeEspera` se queda: la usa la ventana de 30 días y la columna Espera.
`UMBRALES_SEMAFORO` desaparece.

- [x] **Paso 1:** reescribir `semaforo.test.ts`: un caso por valor, el vacío, un
      valor desconocido (`N/A`), y que sobreviva el viaje por JSON del caché.
- [x] **Paso 2:** ver fallar.
- [x] **Paso 3:** implementar.
- [x] **Paso 4:** verde.
- [x] **Paso 5:** actualizar las dos vistas: punto hueco cuando no hay estatus,
      etiqueta = el propio estatus, y quitar el tinte rojo de la fila (ya no
      significa "atrasado").
- [x] **Paso 6:** `pnpm typecheck`, commit.

## Tarea 3: Columnas, fecha y orden de la cola

**Archivos:** `src/lib/fecha.ts` (+ test), `src/lib/casos/cola.ts`,
`src/lib/casos/cola.test.ts`, `src/app/cola/page.tsx`

- [x] **Paso 1:** test de `fechaCorta(marcaTemporalIso, marcaTemporalTexto)`:
      `"11 ago 2026"`. Se compone con un arreglo de meses propio, no con
      `toLocaleDateString`, para que el resultado no dependa del ICU del entorno.
      Sin ISO legible, cae al texto crudo recortado en el primer espacio.
- [x] **Paso 2-4:** implementar y verde.
- [x] **Paso 5:** test de `ordenarRecientes`: el más reciente primero, los sin
      fecha al final, no muta. Sustituye a `ordenarFifo`.
- [x] **Paso 6-7:** implementar y verde.
- [x] **Paso 8:** tabla: `semáforo · Estatus final · Atiende · Folio · Recibido ·
      Trámite · Solicitante · Agencia · Espera`. "Pendiente" cuando no hay estatus
      final o no hay responsable. `colSpan` del vacío a 9. Ajustar los textos de
      ayuda de las vistas, que dicen "del más antiguo al más reciente".
- [x] **Paso 9:** `pnpm typecheck`, commit.

## Tarea 4: Filtro múltiple de Estatus Final

**Archivos:** `src/lib/casos/cola.ts` (+ test), `src/app/cola/filtros.tsx`,
`src/app/cola/page.tsx`

`Filtros` cambia: se van `estatus?: string` e `incluirCerrados?: boolean`, entra
`estatusFinal?: string[]`. El vacío se representa con el testigo `SIN_ESTATUS =
'sin'` para poder viajar en la URL. Sin el parámetro, el filtro por omisión es
`['Tramite', SIN_ESTATUS]`, que es exactamente "los casos abiertos" que pidió el
cliente y coincide con lo que la cola ya mostraba.

`estaVivo` se queda intacta: la usan el cierre y el aviso del caso cerrado.

- [x] **Paso 1:** tests: por omisión solo trámite y sin estatus; selección
      múltiple; `sin` selecciona los vacíos; seleccionar todo trae todo; un
      filtro explícito de estatus desactiva el corte de 30 días.
- [x] **Paso 2-4:** implementar y verde.
- [x] **Paso 5:** `FiltroEstatus` en `filtros.tsx`: botón que abre un panel con
      casillas (los valores presentes en los datos + "Sin estatus"), cierra con
      clic afuera o Escape, escribe `?estatus=Tramite,sin`. Quitar la casilla
      "Incluir cerrados", que este filtro reemplaza.
- [x] **Paso 6:** los conteos de las pestañas usan el filtro por omisión.
- [x] **Paso 7:** `pnpm typecheck`, commit.

## Tarea 5: Reenviar la cadena

**Archivos:** `src/lib/correo/asunto.ts` (+ test), `src/lib/correo/cadena.ts`
(crear + test), `src/app/caso/[fila]/acciones-correo.ts`,
`src/app/caso/[fila]/reenviar-cadena.tsx` (crear),
`src/app/caso/[fila]/conversacion.tsx`, `src/lib/casos/eventos.ts`

**Interfaces:**

```ts
// asunto.ts
export function asuntoDeReenvio(folio: string): string
// cadena.ts
export type AdjuntoDeCadena = { mensajeId: string; indice: number; nombre: string; bytes: number }
export function resumenDeCadena(hilo: Hilo): { mensajes: number; adjuntos: AdjuntoDeCadena[] }
export function renderCadena(hilo: Hilo, v: { folio: string; tramite: string; nota: string; atiende: string }): { html: string; texto: string }
// acciones-correo.ts
export async function reenviarCadena(fila: number, datos: FormData): Promise<ResultadoReenvio>
```

- [x] **Paso 1:** test de `asuntoDeReenvio`: incluye el folio y **no** contiene
      `PREFIJO_ASUNTO`, para que el reenvío nunca se confunda con el hilo del caso.
- [x] **Paso 2-3:** implementar y verde.
- [x] **Paso 4:** tests de `cadena.ts`: el resumen cuenta mensajes y adjuntos con
      su posición; el render lista los mensajes del más antiguo al más reciente,
      distingue quién escribió, nombra los archivos de cada mensaje y escapa el
      texto del usuario.
- [x] **Paso 5-6:** implementar y verde.
- [x] **Paso 7:** `reenviarCadena`: exige folio y conversación; valida los
      correos con `esCorreoValido`; baja los adjuntos elegidos con
      `ubicarAdjunto` + `leerAdjunto`; rechaza antes de llamar a Gmail si
      `pesoCodificado` excede el límite; envía **sin** `threadId` ni
      `enRespuestaA`; registra en bitácora y emite el evento `cadena_reenviada`.
- [x] **Paso 8:** `reenviar-cadena.tsx`: botón junto al de enviar y modal con el
      conteo de mensajes y archivos, campo Para, campo CC, nota opcional,
      casillas por archivo con su peso, total y aviso al pasarse de 25 MB.
- [x] **Paso 9:** `pnpm typecheck`, `pnpm build`, prueba real de envío a
      `omar.lara@enginecx.com`, commit.

## Tarea 6: Casos abiertos para todos, marcados con quién atiende

**Archivos:** borrar `src/lib/casos/bloqueo.ts` y
`src/app/caso/[fila]/bloqueo-acciones.tsx`; crear
`src/app/caso/[fila]/atender.tsx`; tocar `src/app/caso/[fila]/page.tsx`,
`acciones.ts`, `seguimiento-form.tsx`, `conversacion.tsx`,
`src/lib/casos/eventos.ts`, `src/db/schema.ts`

- [x] **Paso 1:** quitar el bloqueo: nada de `adquirirBloqueo` al abrir, fuera la
      prop `bloqueado` de los dos formularios, fuera las acciones `liberar`,
      `forzar` y `mantenerBloqueo`, fuera el evento `caso_tomado`.
- [x] **Paso 2:** `atenderYo(fila)` en `acciones.ts`: escribe `quienAtendio` con
      `usuario.nombreEnHoja` (si no tiene nombre en la hoja, devuelve error
      explicándolo), registra en bitácora, `updateTag('casos')`.
- [x] **Paso 3:** encabezado del caso: "Atiende: X" o "Sin asignar", con el botón
      "Atender yo este caso". Si ya lo atiende otra persona, el botón pide
      confirmación en línea antes de reemplazar el nombre.
- [x] **Paso 4:** dejar la tabla `bloqueos` en el esquema con un comentario de que
      quedó sin uso; borrarla es una migración destructiva que decide el área.
- [x] **Paso 5:** `pnpm test`, `pnpm typecheck`, `pnpm build`, commit.

## Ajuste posterior (mismo día, tras la revisión del cliente)

Con la cola ya funcionando, el área pidió que **los casos en "Tramite" tampoco
aparezcan por omisión**: ese valor significa que alguien ya tomó el caso. La
selección por omisión del filtro queda en solo los pendientes (`KA` vacío) y las
tres vistas se renombran en consecuencia.

Efecto medido en la copia el 12/8/2026: la cola pasa de 62 a **8** casos, el
rezago de 142 a **2**. Los **54 casos en Tramite de los últimos 30 días** que
salen de la vista quedan a un clic en el filtro.

## Cierre

- [x] Actualizar `docs/AVANCE.md`: el semáforo ya no mide antigüedad, la cola va
      del más reciente al más antiguo, no hay bloqueo, y los hallazgos de `N/A` y
      de "Ernesto" en `Quien Atendio` (475 filas de 2026, fuera de la validación
      de la hoja) como preguntas para Norma.
- [x] Desplegar y avisar.
