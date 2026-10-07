# Tiempo de atención — paso a producción

En producción la columna es **KY**, con el encabezado **«Tiempo de Atención»**, que el
área abrió a mano el 7 de octubre de 2026. La aplicación la reconoce por ese encabezado
o por «Tiempo de atención (horas)», el que pone el script cuando la crea él, nunca por
su posición. Si el formulario o el área agregan columnas, la letra puede cambiar.

## Paso 1 · La columna — **hecho el 7 de octubre de 2026**

Creada a mano por el área en KY. El simulacro contra la hoja productiva la reconoce
como «KY (ya existe)».

Si algún día hiciera falta crearla en otra hoja, el script lo hace solo con
`--escribir`: la abre en la primera columna libre después de la última con
encabezado y le pone «Tiempo de atención (horas)».

## Paso 2 · Desplegar — **hecho el 7 de octubre de 2026**

`vercel deploy --prod` desde la rama `tiempo-de-atencion`. No hay variables de entorno
nuevas. Mientras una hoja no tenga la columna, la aplicación guarda igual que antes y
simplemente no sella el tiempo.

Desde el despliegue, cada caso de la mesa que se cierra desde la aplicación (Concluida o
Improcedente) guarda sus horas en KY.

## Paso 3 · Llenar el histórico

Las variables de la hoja productiva están marcadas como *sensitive* en Vercel y no se
pueden bajar con `vercel env pull`. La base de datos —donde vive la credencial de la
mesa— es la misma que la de `.env.local`, así que basta con apuntar a la hoja
productiva:

    SHEET_ID=1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0 SHEET_PESTANA="Respuestas de formulario 1" \
      pnpm dotenv -e .env.local -- pnpm tsx scripts/llenar-tiempo-atencion.ts

Sin `--escribir` es un simulacro: dice la columna destino, cuántos casos llenaría y el
promedio, y no escribe nada. El 7/10/2026 dio «KY (ya existe)», 1 274 casos por llenar y
un promedio de 30.94 h.

Si el reporte cuadra, el mismo comando con `--escribir` al final. Antes de escribir
vuelve a comprobar el encabezado de la columna y que cada fila siga siendo el caso que
leyó, y se salta las celdas que ya tengan dato. Se puede repetir sin riesgo: sirve
también para completar los casos que se cierren a mano en la hoja.

## El promedio

    =PROMEDIO(KY2:KY)

(o la letra que tenga la columna si se movió).

## Notas

- Siniestros no se mide.
- Un caso cerrado a mano en la hoja se completa la próxima vez que alguien lo guarde
  desde la aplicación, o al volver a correr el script.
- Para recalcular un caso, vaciar su celda y volver a guardar o correr el script.
- La mayor parte del histórico de 2023 a 2025 no se llena: su fecha de atención final
  se tecleó sólo con el día («10/08/2023»), sin hora, y con eso no se puede medir en
  horas. En la hoja productiva, el 7/10/2026, fueron 4 701 casos cerrados sin fecha de
  cierre utilizable (sin hora o vacía). El promedio de la hoja refleja, entonces, sobre
  todo los casos cerrados desde la aplicación.
- Hay valores atípicos que vienen de los datos, no del cálculo: la fila 5107 mide
  4 027 h (unos 168 días).
