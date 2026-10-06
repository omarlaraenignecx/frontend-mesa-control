# Tiempo de atención — paso a producción

1. Desplegar la rama. Mientras la hoja no tenga la columna, la aplicación guarda
   igual que antes y simplemente no sella el tiempo.
2. Con las variables de producción, correr el simulacro y revisar el reporte:
   columna destino (debe ser la primera libre después de «Reclasificación»),
   cuántos casos se llenan y el promedio resultante.

       pnpm dotenv -e .env.production.local -- pnpm tsx scripts/llenar-tiempo-atencion.ts

3. Si el reporte cuadra, correrlo con `--escribir`. Crea la columna
   «Tiempo de atención (horas)» y llena el histórico. Se puede repetir: no toca
   celdas con dato.
4. Desde ese momento, cada caso de la mesa que se cierre desde la aplicación
   (Concluida o Improcedente) guarda sus horas. El promedio en la hoja:
   `=PROMEDIO(KW2:KW)` (o la letra que haya quedado).

Notas:
- Siniestros no se mide.
- Un caso cerrado a mano en la hoja se completa la próxima vez que alguien lo
  guarde desde la aplicación, o al volver a correr el script.
- Para recalcular un caso, vaciar su celda y volver a guardar o correr el script.
- La mayor parte del histórico de 2023 a 2025 no se llena: su fecha de atención
  final se tecleó sólo con el día («10/08/2023»), sin hora, y con eso no se puede
  medir en horas. En la copia de desarrollo, el 6/10/2026, fueron 3 293 casos así y
  1 224 sin fecha; se llenarían 935. El promedio de la hoja refleja, entonces,
  sobre todo los casos cerrados desde la aplicación.
