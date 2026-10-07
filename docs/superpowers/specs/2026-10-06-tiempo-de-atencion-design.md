# Tiempo de atención por caso — Diseño

**Fecha:** 6 de octubre de 2026
**Autoriza el alcance:** Omar Lara

## 1. Qué se pide

Saber cuánto tarda en promedio la Mesa de Control en atender un caso. Para eso, cada
caso de la mesa guarda su tiempo de atención en una columna nueva al final de la hoja,
y el promedio lo saca el área desde la propia hoja.

- **Inicio del contador:** la marca temporal de la respuesta del formulario (columna A).
- **Fin del contador:** el momento en que el Estatus Final (KA) pasa a un estatus de
  cierre. Son los dos que la aplicación ya trata como terminales: **Concluida** e
  **Improcedente**. En la petición original se habló de «no procedente, finalizada o
  cerrada», y el 6/10/2026 se confirmó que equivalen a Improcedente y Concluida.
  «Tramite» deja el caso abierto.
- **Sólo Mesa de Control.** Los casos de siniestros (`esSiniestro`) no llevan valor.

## 2. Decisiones

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Unidad | Horas naturales, número decimal con 2 decimales (ej. `26.5`) | `PROMEDIO()` y las tablas dinámicas funcionan directo; las horas hábiles exigirían definir un horario que nadie ha pedido |
| Cómo se guarda | Valor escrito por la aplicación, no una fórmula | Se pidió que el valor quede guardado; además «Total Dias» ya es una fórmula parecida |
| Fecha de cierre | La de KD «Fecha y hora de Atención Final» | Es la que la aplicación ya sella al cerrar, y si la mesa la tecleó antes, esa manda |
| Alcance | Casos nuevos más el histórico | El promedio tiene datos desde el primer día |
| Interfaz | Ninguna por ahora | El promedio se calcula en la hoja; en pantalla no hace falta todavía |

## 3. La columna

- Encabezado: **«Tiempo de atención (horas)»**, en la primera columna libre después de
  KV «Reclasificación». Hoy es **KW** (309).
- Es de la zona de la mesa, igual que KV: se localiza por encabezado y nunca por
  posición (RNF-11).
- La crea el script del histórico (sección 5) si no existe. Si la cuadrícula de la
  pestaña no llega a la columna 309, primero le agrega una columna
  (`appendDimension`), porque escribir fuera de la cuadrícula falla.

## 4. Escritura desde la aplicación

### 4.1 Esquema y lista blanca

- `sheet-schema.ts`: nuevo `CampoLogico` `tiempoAtencion`, con el alias
  `tiempo de atencion (horas)`, dentro de `CAMPOS_COLUMNA_UNICA`.
- `sheet-reader.ts` / `Caso`: nuevo campo `tiempoAtencion: string | null`, que se lee
  como texto igual que los demás.
- `sheet-writer.ts`: `tiempoAtencion` entra a `CampoEscribible` y a
  `CAMPOS_ESCRIBIBLES`. Se escribe como **número JSON**, no como cadena, y en el mismo
  lote que la fecha de atención final (`USER_ENTERED`): si KD no llega a la hoja, el
  tiempo que depende de ella tampoco. Como cadena, `"26.5"` quedaría como texto con
  RAW —y `PROMEDIO` la ignoraría— o dependería de la configuración regional del libro
  con `USER_ENTERED`; un número JSON se guarda como número con los dos modos. `Seguimiento`, el diff y la bitácora siguen
  trabajando con cadenas (`"26.5"`). Es `escribirSeguimiento` quien convierte este
  campo con `Number()` justo antes de mandarlo, y rechaza el lote sin llamar a Google
  si el texto no es un número finito. Sólo este campo se manda como número.
- El cliente nunca decide este valor: `guardarSeguimiento` descarta cualquier
  `tiempoAtencion` que llegue del formulario antes de calcular el suyo.

### 4.2 Regla de cálculo — `lib/casos/tiempo-atencion.ts` (nuevo, puro)

- `horasDeAtencion(recibido: Date, cierre: Date): number | null` devuelve
  `(cierre − recibido)` en horas, redondeado a 2 decimales. Devuelve `null` si el
  cierre es anterior a la llegada (un dato mal capturado no se convierte en un tiempo
  negativo).
- `tiempoASellar(caso, estatusFinalResultante, fechaCierreTexto): number | null`
  devuelve el valor que hay que escribir, o `null` si no toca. Toca cuando se cumplen
  todas estas condiciones:
  1. el caso no es de siniestros;
  2. el estatus resultante es terminal (`!estaVivo`);
  3. la columna del tiempo está vacía (no se sobrescribe);
  4. hay marca temporal legible y fecha de cierre legible (`parsearFechaHoja`), y la
     fecha de cierre trae hora. Una KD tecleada sólo con el día («5/8/2026») mediría
     hasta la medianoche y daría un tiempo falso, así que no se usa.

No hace falta que el cierre ocurra en ese mismo guardado. Así, un caso cerrado a mano
en la hoja se completa la próxima vez que alguien lo guarde desde la aplicación.

### 4.3 En `guardarSeguimiento`

Después de calcular el sello de KD:

```ts
const cierre = valores.fechaAtencionFinal ?? caso.fechaAtencionFinal
const horas = tiempoASellar(caso, valores.estatusFinal ?? caso.estatusFinal, cierre)
if (horas !== null && mapa.columnasPorCampo.tiempoAtencion.length) {
  valores.tiempoAtencion = horas
}
```

Va en el mismo `escribirSeguimiento`, así que pasa por la confirmación de fila
(`confirmarFila`) y queda en la bitácora como cualquier otro cambio.

### 4.4 Reapertura

Si un caso cerrado vuelve a «Tramite», el valor **no se borra**, igual que hoy no se
borra KD. Al cerrarlo otra vez tampoco se recalcula, porque la columna ya tiene dato.
Si el área necesita recalcular un caso, basta con vaciar la celda.

## 5. Script del histórico — `scripts/llenar-tiempo-atencion.ts`

Se corre una sola vez y se puede volver a correr sin riesgo. Usa la misma credencial y
las mismas variables que la aplicación (`.env.local`).

1. Lee los encabezados. Si no existe «Tiempo de atención (horas)»:
   - si la cuadrícula no tiene columna libre, agrega una con `appendDimension`;
   - escribe el encabezado en la fila 1 de la primera columna vacía después de la
     última con encabezado.
2. Lee los casos con `leerCasos` y aplica `tiempoASellar` a cada uno, con su estatus
   final y su KD actuales.
3. Escribe todos los valores en un solo `values:batchUpdate`, con RAW y números.
4. Por omisión corre en **simulacro**: dice qué columna crearía y cuántas filas
   llenaría, con una muestra y el promedio resultante, sin escribir nada. Sólo escribe
   con `--escribir`.
5. Antes de escribir relee el encabezado de la columna destino y aborta si no es el
   esperado (que nadie haya movido la columna entre la lectura y la escritura).

Los casos cerrados sin KD, con KD ilegible o sin hora se cuentan en el reporte como
«sin fecha de cierre utilizable» y se dejan vacíos. No se inventa una fecha. El script
lee todos los años (`anioMinimo = 0`), no sólo 2026 como la cola.

## 6. Errores

- La columna no existe en la hoja (todavía no se corre el script): `columnaDe` lanza
  `ColumnaNoEscribibleError` y el guardado completo fallaría. Para no frenar a la mesa,
  `guardarSeguimiento` sólo agrega `tiempoAtencion` si el mapa tiene la columna. Si
  no, el guardado sigue sin el tiempo.
- Fallo de Google al escribir: el tiempo viaja en el mismo lote de texto que el resto
  del seguimiento, así que se comporta igual que hoy (error visible, nada a medias).

## 7. Pruebas

- `tiempo-atencion.test.ts`: cálculo y redondeo; cierre anterior a la llegada da
  `null`; siniestros da `null`; estatus abierto da `null`; columna con dato da `null`;
  fechas ilegibles dan `null`; Concluida e Improcedente sí sellan.
- `sheet-schema.test.ts`: con el encabezado en la posición 309, el mapa lo resuelve a
  `tiempoAtencion` y no lo cuenta como sin resolver.
- `sheet-writer.test.ts`: `tiempoAtencion` se manda como número y con RAW; sigue
  rechazando campos fuera de la lista blanca.

## 8. Fuera de alcance

- Mostrar el promedio o el tiempo en la interfaz.
- Horas hábiles.
- Medir siniestros.
