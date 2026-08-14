# Avance — Frontend Mesa de Control (PJ2859)

Estado consolidado del proyecto. Este documento es la fuente de contexto para retomar el trabajo sin depender del historial de conversación.

| Campo | Valor |
| --- | --- |
| PRD | `enginecx_prd/Gplus-Seguros/PJ2859-frontend-mesa-control/PRD.md` v0.1 |
| Diseño técnico | `docs/superpowers/specs/2026-08-05-frontend-mesa-control-design.md` |
| Repositorio | https://github.com/omarlaraenignecx/frontend-mesa-control |
| Producción | https://frontend-mesa-control.vercel.app |
| Última actualización | 14 de agosto de 2026 (filtro de estatus con los pendientes marcados y aviso de responder en el mismo hilo) |

## Estado por etapas

| Etapa | Estado | Plan |
| --- | --- | --- |
| 0 · Cimientos y accesos | **Completa y en producción** | `docs/superpowers/plans/2026-08-06-etapa-0-cimientos-y-accesos.md` |
| 1 · Lectura del Sheet y cola | **Completa y en producción** | `docs/superpowers/plans/2026-08-06-etapa-1-lectura-y-cola.md` |
| 2 · Vista de caso y escritura | **Completa y en producción** | `docs/superpowers/plans/2026-08-10-etapa-2-caso-y-escritura.md` |
| 3 · Conversación por correo | **Completa y en producción** | `docs/superpowers/plans/2026-08-11-etapa-3-conversacion-por-correo.md` |
| Ajustes del cliente | **Completa y en producción** | `docs/superpowers/plans/2026-08-11-ajustes-del-cliente.md` |
| Fila y loader | **Completa y en producción** | `docs/superpowers/plans/2026-08-13-fila-y-loader.md` |
| Correo, folios y archivos | **Completa y en producción**; Google reautorizado el 13/8/2026 (9 permisos), falta subir un archivo real desde el navegador | `docs/superpowers/plans/2026-08-13-correo-folios-y-archivos.md` |
| Filtros y aviso de respuesta | **Completa en código** | sin plan; dos cambios pedidos el 14/8/2026 |
| 4 · Producción y cierre | En curso: hoja productiva en uso; falta la jornada real y el cierre documental | `docs/superpowers/plans/2026-08-13-etapa-4-produccion-y-cierre.md` |

Suite: **377 pruebas** en 34 archivos. Comandos: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev`, `pnpm db:push`, `pnpm db:seed`.

## Infraestructura

| Recurso | Identificador |
| --- | --- |
| Proyecto GCP | `mesa-de-control-504618`, dentro de la organización `1029986595993` |
| Cuenta de servicio | `cuenta-de-servicio@mesa-de-control-504618.iam.gserviceaccount.com` (administración y lectura en desarrollo; **no** es la credencial de la app) |
| Cliente OAuth | `Mesa de Control web`, pantalla de consentimiento **Interna** |
| Identidad operativa | `mesadecontrol@gplusseguros.mx`, refresh token cifrado en Supabase |
| Base de datos | Supabase `supabase-cerulean-helmet`, provisionada por el Marketplace de Vercel |
| Proyecto Vercel | `frontend-mesa-control` en el equipo `omarlara-1860s-projects` |
| Hoja de desarrollo | `1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ` — "Prueba formulario mesa de control". Es la que usan `.env.local` y el entorno **Preview**, para que ninguna prueba escriba en el registro real |
| Hoja productiva | `1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0` — "Formulario sin título (Respuestas)". **En uso por producción desde el 13 de agosto de 2026**, con autorización del área. La vuelta atrás es cambiar `SHEET_ID` de Production a la copia y volver a desplegar |

El push a GitHub usa un credential helper local que lee el token de `~/.gh-token-mesa`, con una entrada vacía previa para descartar el `osxkeychain` del sistema (que responde con otra cuenta).

## Usuarios

| Correo | Nombre en `KE` | Rol |
| --- | --- | --- |
| `keynor.rivas@gplusseguros.mx` | Keynor | operador |
| `patricia.ramirez@gplusseguros.mx` | Paty | operador |
| `norma.zacarias@gplusseguros.mx` | Norma | operador |
| `jose.mendoza@gplusseguros.mx` | José Juan | operador |
| `mesadecontrol@gplusseguros.mx` | — | admin |

## Anatomía de la hoja (verificado el 5 de agosto de 2026)

Pestaña `Respuestas de formulario 1`: 307 columnas, encabezados en fila 1, datos desde fila 2. De 297 encabezados con texto salen **92 únicos** al normalizar, porque el formulario está replicado en bloques. 1,426 peticiones de 2026.

**Un caso llena entre 10 y 19 celdas de 307.**

Zona de seguimiento de la mesa, escribible en la Etapa 2:

| Col | Campo | Trato |
| --- | --- | --- |
| `JY` | Folio de atención | Lectura; se escribe solo al capturar un folio faltante |
| `JZ` | Estatus Inicial | Editable, catálogo de validación |
| `KA` | Estatus Final | Editable, catálogo de validación |
| `KB` | Fecha de respuesta por correo | Sellada por la app al enviar el primer correo |
| `KC` | Tiempo entre solicitud y respuesta | **Prohibida** (fórmula) |
| `KD` | Fecha de atención final | Sellada por la app al cerrar |
| `KE` | Quien Atendio | Editable, precargado por usuario |
| `KF` | Folio interno | Editable (es el folio de aseguradora) |
| `KG` | Aseguradora | Editable |
| `KH` | Tenía permisos | Editable |
| `KI` | Causa | Editable |
| `KJ` | Observaciones | Editable, acumulativo |
| `KL`–`KN` | Estatus duplicados | **Prohibidas** (residuales) |
| `KO`–`KU` | Días, SLA, año, mes | **Prohibidas** (fórmulas; `KO` y `KS` tienen `#REF!`) |

Catálogos leídos de la **validación de datos** de las celdas, nunca codificados:

- `JZ`: Atendida / Concluida · Atendida / Con aseguradora · Se redireccionó al área comercial · Atendida/en trámite · Se solicita información complementaria · Validación con TI · Atendida/en trámite con RC · Atendida/en trámite con CAF · Concluida/no se envío la información adicional
- `KA`: Concluida · Improcedente · Tramite
- `KE`: José Juan · Norma · Paty · Keynor
- `KG`: QUALITAS · HDI · CHUBB · GNP · POTOSI · ANA · TODAS LAS ASEGURADORAS · GPLUS · OMEGA · LA LATINO
- `KH`: Si · No · N/A
- `KI`: Falta Capacitación · Mejorar Costo · No quiso Realizarla · Usuario bloqueado · No se pudo emitir en Omega · Siniestros · Falla en portal · Dependencia con Aseguradora · No se emitio en Anfexi · Función de GPLUS · Falta homologación · Problema de homologación · Sin usuarios · Alta de versión

## Decisiones vigentes

| Tema | Decisión |
| --- | --- |
| Escritura a la hoja | Solo 10 columnas por lista blanca, comprobada antes de la llamada HTTP. `JY` solo al generar folios faltantes, y nunca sobre una celda con dato |
| Concurrencia | Revalidación de la fila (marca temporal y folio) antes de escribir; detecta también las ediciones hechas en la hoja |
| Observaciones | Se antepone `D/M/YYYY Nombre: texto` conservando íntegro lo anterior |
| Autocompletado | Solo `KE` precargado y editable, más el sellado de `KB` y `KD`. La app no opina sobre el trámite |
| Tipografía | Geist con nombres literales en `@theme inline`, base de 17px y controles de 44px |
| Destinatarios del correo | `Para` = solicitante, fijo. `CC` = ejecutivo comercial solo si difiere. El usuario puede agregar copias, nunca cambiar el principal; las copias quedan en bitácora |
| Firma del correo | `Mesa de Control — Gplus Seguros`, `Atiende: <nombre>` y el buzón de la mesa |
| Aviso de respuesta | Todos los correos que salen de la mesa llevan un bloque ámbar antes de la firma pidiendo **responder a ese mismo mensaje** y explicando que un correo nuevo separa la respuesta del expediente. Va en el armado del correo (`avisoDeRespuesta`), no en las plantillas que edita el área: en las plantillas se podría borrar al corregir un texto, y responder en el hilo es lo que conserva el `threadId` de la fila. **No** se agregó al reenvío de la conversación, que sale como correo aparte y cuyas respuestas no entran al chat del caso |
| Caso cerrado con respuesta nueva | Se muestra con aviso y se puede contestar; la app no reabre el caso ni toca su estatus |
| Archivos del caso | Tres orígenes en un solo panel: el formulario (Drive), la conversación (Gmail) y **los que sube la mesa**. Sin restricción de tipo: capturas, PDF, lo que haga falta. Van a una carpeta `Mesa de Control · Archivos` del Drive de `mesadecontrol@`, **una por hoja**, para que probar contra la copia no deje archivos en la que ve el área, con el registro en `archivos_caso`; el enlace **no puede** ir a la hoja porque sus columnas de adjuntos están protegidas sin editores. El registro se identifica por **hoja más fila**, no por fila sola |
| Identidad del caso | El **número de fila**. El folio puede faltar y hay folios arrastrados sin petición |
| Orden de la fila | **Del más reciente al más antiguo** (pedido del cliente el 11/8/2026; antes era FIFO) |
| Corte de la fila | **30 días**; lo anterior vive en la vista Rezago. Buscar o filtrar desactiva el corte |
| Filtro de estatus final | Selección múltiple con casillas, incluida la opción "sin estatus". Por omisión **solo los pendientes** (sin estatus final): los de Tramite tampoco entran, porque ese valor significa que alguien ya tomó el caso. Sustituye a la casilla "Incluir cerrados". Desde el 14/8/2026 la casilla de pendientes **se muestra marcada** cuando no hay nada en la URL —antes el panel se veía sin filtro aunque sí lo hubiera— y hay un **"Seleccionar todos"** que marca los estatus de golpe y en el segundo clic regresa a los pendientes. Desmarcar la última casilla también regresa ahí: la tabla nunca se queda sin ningún estatus elegido |
| Reenvío de la conversación | Correo aparte con asunto propio, transcripción legible y los adjuntos que se dejen marcados. Las respuestas al reenvío no entran al chat del caso |
| Columnas de la fila | semáforo · Estatus final · Atiende · Folio · Recibido (solo el día) · Trámite · Solicitante · **Correo** · Agencia · Espera. El correo sale de `correoSolicitante`, que agrupa las columnas `J` y `AD` de la hoja |
| Nombre de la bandeja | **Fila**, no "cola" (pedido del área el 13/8/2026: la palabra resultaba agresiva). Cambian las etiquetas, la ruta `/fila` y el valor `?vista=fila`, con redirección permanente desde `/cola`. En el **código** `fila` sigue siendo el renglón de la hoja, así que el módulo de lógica conserva el nombre `cola.ts` y los mensajes que hablaban del renglón dicen **"registro"** |
| Navegación | De cliente, con `next/link`. Antes eran `<a href>`, o sea una recarga completa del documento por clic. La única excepción es `/api/mesa/autorizar`, que redirige al consentimiento de Google. Vigilado por `src/app/rutas.test.ts` |
| Indicadores de carga | `loading.tsx` con esqueleto para los cambios de ruta (la fila y el caso), `useLinkStatus` en las pestañas y en el folio de cada caso, y `useTransition` en los filtros. Los enlaces de la tabla y las pestañas llevan `prefetch={false}` para no disparar una petición por renglón |
| Caso abierto | `KA` distinto de `Concluida` e `Improcedente`. Distinto de "pendiente", que es `KA` vacío y es lo que la fila muestra por omisión |
| Acceso a Google | Todo con OAuth de `mesadecontrol@`; consentimiento Interno aprobado por el admin |
| Identidad de usuario | Cuenta personal del dominio contra allowlist en base; revalidada en cada carga |
| Bloqueo de caso | **No hay.** Todos los casos están abiertos para todos; la marca de responsable es la columna `KE`, que se llena con el botón "Atender yo este caso" o desde el seguimiento |
| Semáforo | **Por el Estatus Final de `KA`**: verde Concluida, rojo Improcedente, ámbar Tramite, hueco si no hay valor, gris si el valor no está en la validación. Los días de espera se siguen mostrando en su propia columna |
| Fechas `KB` y `KD` | Selladas automáticamente por la app |
| Asunto del correo | `Seguimiento de Caso \| Gplus Seguros \| <folio>` |
| Correos | HTML profesional al enviar, texto plano en el chat |
| Folio faltante | **La app lo genera**, con un aviso ámbar en la fila y en el caso que solo existe mientras haya faltantes (13/8/2026; antes se pedía teclearlo a mano). Continúa la serie desde el **máximo de toda la columna `JY`**, no desde la fila de arriba: el arrastre manual es lo que produjo los 210 folios duplicados de la hoja, porque el formulario inserta la fila nueva arriba de las pre-arrastradas. Escribe todas las pendientes en un lote y aborta completo si una cambió. Tope de 50 por tanda |
| Reactividad | Lectura al cargar más botón Actualizar. Sin polling ni webhooks |
| Plantillas de correo | En base de datos, editables desde la app |
| Firma | Remitente de la mesa, indicando quién atiende |

## Restricciones técnicas aprendidas

1. **El proxy (antes middleware) corre en runtime edge y no alcanza Postgres.** La configuración de Auth.js está partida: `auth.config.ts` sin base para el proxy, `auth.ts` con base para Node. Hay una prueba de arquitectura (`edge-safety.test.ts`) que recorre los imports y falla si el proxy vuelve a alcanzar la base.
2. **El caso no puede contener objetos `Date`.** La caché serializa a JSON y un `Date` vuelve como texto. La fecha viaja como `marcaTemporalIso` y se convierte con `fechaDe()`.
3. **La frontera del esquema es semántica, no posicional.** Se localiza por el encabezado `Folio de atención` y las columnas calculadas se ignoran por su nombre. Fijarla en la columna 285 rompería el seguimiento en cuanto el formulario crezca.
4. **`revalidateTag` exige un segundo argumento en Next 16.** El botón Actualizar usa `updateTag`, que invalida de inmediato.
5. **`unstable_cache` sigue funcionando** pero es legacy; migrar a `use cache` requiere habilitar `cacheComponents`, lo que obliga a revisar las fronteras de Suspense. Pendiente evaluado, no urgente.
6. **`shadcn init` rompe la fuente en Tailwind v4**: deja `--font-sans: var(--font-sans)`, una autorreferencia que `@theme inline` resuelve en tiempo de parseo y por tanto no carga nada, con lo que el navegador cae a su serif. Hay que poner los nombres literales de la familia.
7. **Para comparar dos celdas distantes se usa `values:batchGet` con rangos exactos**, no un rango continuo: `A:JY` traería 285 celdas para leer dos.
8. **El `attachmentId` de Gmail no es estable**: se regenera en cada lectura del mensaje. El id del mensaje sí es estable. Por eso los adjuntos se referencian por su **posición** dentro del mensaje y el id se toma de la lectura del momento. Poner el `attachmentId` en una URL y compararlo después nunca coincide.
9. **La hoja tiene sus propias protecciones**, que refuerzan el diseño: columna `A` y columnas `B`–`JX` protegidas sin editores; `JY` protegida con excepción para `omar.lara@enginecx.com`, la cuenta de servicio y `mesadecontrol@`; `JZ`–`KJ` libres. Es un segundo candado sobre la lista blanca del escritor, y por eso no se puede crear una fila de prueba desde la aplicación.
10. **El build de Next no typechequea los archivos de prueba.** Usar `pnpm typecheck` (`tsc --noEmit`) antes de dar por bueno un cambio de tipos.
11. **Tailwind 4 no pone `cursor: pointer` en los botones.** Su preflight deja el valor del navegador, así que hay una regla en `@layer base` de `globals.css` que lo declara para todo lo clicable, con una prueba que lee el CSS (`estilos-base.test.ts`).
12. **La búsqueda de Gmail por asunto encuentra subcadenas.** Por eso el asunto del reenvío evita a propósito la frase `Seguimiento de Caso | Gplus Seguros`: si la llevara, el hilo del reenvío podría devolverse como el hilo del caso cuando se pierda el vínculo guardado en la base.
13. **No usar `prettier` sin configuración en este repo.** Sus valores por omisión (comillas dobles, punto y coma) contradicen el estilo del código y reescriben archivos completos.
14. **El servidor corre en UTC y la hoja vive en UTC−6.** Las dos hojas declaran `locale=es_MX` y `timeZone=Etc/GMT+6` (sin horario de verano, que México eliminó en 2022), pero Vercel ejecuta en UTC y `new Date()` toma la hora local del proceso. Cualquier fecha que se escriba en la hoja o se muestre a la mesa tiene que convertirse a UTC−6 explícitamente.
15. **`loading.tsx` no se vuelve a mostrar cuando solo cambian los parámetros de búsqueda** de la misma ruta, que es lo que hacen las pestañas de vista y los filtros. Para esos casos la señal la dan `useLinkStatus` dentro del `Link` y `useTransition` alrededor del `router.push`. Además `loading.tsx` dejaría de funcionar del todo si el layout raíz empezara a leer datos de runtime —`cookies()`, sesión, un fetch sin caché—: hoy es estático a propósito y la autenticación vive en el proxy y en las páginas.
16. **`valueInputOption=RAW` guarda texto, no fechas.** Las fechas del histórico de `KB` y `KD` son números de serie con formato de fecha; lo que escribe RAW queda como cadena, que no se ordena ni entra en una fórmula. Solo los dos campos de fecha se escriben con `USER_ENTERED`, para que Sheets las interprete; el resto sigue con RAW a propósito, porque `USER_ENTERED` convertiría en fórmula unas Observaciones que empiecen con `=`.
17. **`drizzle-kit push` se cuelga contra la URL agrupada de Supabase.** El pooler corre en modo transacción y no admite las sentencias preparadas que usa drizzle-kit: el comando se queda para siempre en `Pulling schema from database`, sin error ni tiempo de espera. `drizzle.config.ts` usa `POSTGRES_URL_NON_POOLING`. La aplicación sí usa la agrupada, con `prepare: false` en `src/db/index.ts`.
18. **El cuerpo de una Server Action está limitado a 1 MB.** Subir archivos va por una Route Handler (`/api/archivo/subir`), no por acción: elevar `serverActions.bodySizeLimit` expondría todos los formularios de la aplicación a cuerpos grandes para resolver un solo caso.
19. **`fetch` no acepta un `Uint8Array<ArrayBufferLike>` como cuerpo**, que es lo que TypeScript infiere por omisión desde la 5.7. Hay que construirlo con `new Uint8Array(new ArrayBuffer(n))` para fijar el respaldo en un `ArrayBuffer`; si no, `tsc` lo rechaza aunque en ejecución funcione.
20. **La misma base sirve a la copia y a la hoja real**, porque `POSTGRES_URL` tiene un solo valor para Production, Preview y Development. El número de fila por sí solo **no** identifica un caso: la 7181 de la copia y la 7181 de la productiva son casos distintos. `archivos_caso` lleva `sheet_id` por eso. Las tablas anteriores (`bitacora`, `eventos_bi`, `casos_hilo`) no lo llevan, así que una entrada hecha desde `pnpm dev` se ve en el caso de producción con el mismo número; son registros internos y de solo lectura para la mesa, pero conviene saberlo.
21. **Agregar un scope no invalida la credencial guardada.** El refresh token sigue sirviendo para los permisos que sí tiene, así que la falta solo se nota al usar la función nueva —con un 403 opaco de Google—. `scopesFaltantes()` compara lo guardado con lo requerido y Ajustes lo avisa; el 403 se traduce a un mensaje que dice qué hacer.

## Hallazgos de operación (para conversar con Norma y Keynor)

1. **140 de 200 casos abiertos son rezago**, el más antiguo con **216 días** (folio 5787, del 6 de enero). La mesa no cierra formalmente los casos que quedan esperando al solicitante o a la aseguradora. Es lo que motivó el corte de 30 días.
2. **Aparece "Ernesto"** como responsable histórico, y no está en el catálogo actual de `KE` ni en la allowlist. Medido sobre la **hoja productiva** el 13/8/2026: **475 de los 1,466 casos de 2026**, casi un tercio, con un valor que la propia validación de `KE` no permite. El reparto completo del año es Keynor 767, Ernesto 475, Paty 175, Norma 30, José Juan 9 y 10 sin valor. Conviene preguntar quién es y si debe volver al catálogo.
3. **El Estatus Final tiene basura histórica.** La validación de `KA` permite solo `Concluida`, `Improcedente` y `Tramite`, pero el histórico completo trae **570 filas con `N/A`**, una con "Información incompleta" y una con "Trámite de aplicación de pago (ingresos y egresos)", capturadas antes de que existiera la validación. En 2026 no hay ninguna, así que no afecta a la operación diaria; el semáforo las pinta gris en lugar de reventar.
4. **Un caso puede llegar sin folio, y el arrastre manual duplica folios.** La hoja productiva tiene **210 folios repetidos**, y el 13/8/2026 quedó claro el mecanismo: el área arrastra la serie por adelantado —el 13/8 las filas 7228-7230 tenían folio 7052-7054 sin ningún otro dato— y cuando entra una respuesta el formulario **inserta** la fila arriba de esas, así que continuar desde el folio de arriba repite uno que ya existe abajo. El botón de generar folios lo evita tomando el máximo de la columna. Los 90 registros sin folio del histórico son todos anteriores a 2026 y la app no los lee.
5. **112 columnas sin clasificar** en 34 encabezados: número de póliza, número de siniestro, teléfono del cliente, tipo de endoso, versión de la unidad y similares. Son datos legítimos que varían por trámite y se mostrarán como campos del caso; no requieren entrar al modelo. Posible mejora a consultar: permitir búsqueda por número de póliza, que hoy no está en RF-02.
6. **La mesa dejó de llenar `KB` y `KD` el 20 de marzo de 2026** (últimas filas con dato: 6383 y 6363). Unos 837 casos de 2026 no tienen fecha de respuesta ni de atención final. La herramienta las va a sellar de aquí en adelante, así que a partir del cambio habrá dato, pero no hay con qué comparar los meses anteriores. Lo mismo pasa con `KC`, cuya fórmula `=KB−A` tampoco sigue después de la fila 6383.
7. **El catálogo de `KG` cambia según la banda de filas.** Los datos terminan en la fila 7220; la banda de 10 aseguradoras alcanza hasta la 7221 y de la 7222 en adelante hay otra de 8, que pierde `TODAS LAS ASEGURADORAS`, `GPLUS ` (con espacio final) y `LA LATINO`, y agrega `N/A`. Es decir que de la segunda petición nueva en adelante la mesa verá una lista distinta a la del histórico. La app lee el catálogo de la fila del caso, así que refleja fielmente esa inconsistencia; corregirla es editar la validación de la hoja y le toca al área decidir cuál de las dos listas es la correcta.
8. **Puede haber gente de la mesa en el dominio `garantiplus.mx`.** La lista de editores de la protección de `JY` en la hoja productiva incluye `patricia.ramirez@garantiplus.mx`, `israel.escutia@garantiplus.mx` y `mario.luna@garantiplus.mx`, además de `angeles.martinez@` y `jose.mendoza@gplusseguros.mx`. La allowlist tiene a Paty como `patricia.ramirez@gplusseguros.mx`. Si su cuenta real es la de `garantiplus.mx` **no podrá entrar**, porque la pantalla de consentimiento es Interna al dominio `gplusseguros.mx`. **Resuelto en parte el 13 de agosto de 2026:** el área confirmó que José Juan es `jose.mendoza@gplusseguros.mx`; se corrigió la semilla y se borró de la tabla el `juan.palafox@` que habíamos inferido del catálogo de `KE` —no tenía bitácora ni eventos, así que no dejó huérfanos—. Queda por confirmar la cuenta de Paty.

## Hallazgo adicional (Etapa 2)

**Las fórmulas de `KL`–`KU` solo están arrastradas hasta la fila 3126**, que corresponde a septiembre de 2024. Estatus Real, Días de Espera, Total Días, SLA, Año y Mes Recibe están vacíos para todos los casos de 2025 y 2026, y en la hoja productiva aparecen como `#REF!`. Explica por qué el semáforo tuvo que calcularse en la aplicación. Si el reporte semanal de Keynor usa esas columnas, hoy no tiene datos de los últimos dos años. Arreglarlo está fuera del alcance de la herramienta —son fórmulas de la hoja— pero conviene plantearlo al área.

## Inspección de la hoja productiva (13 de agosto de 2026)

Hecha con la cuenta de servicio y alcance `spreadsheets.readonly` para que ningún error de un script de inspección pudiera escribir. La única lectura con la credencial de la mesa fue la de protecciones, explicada abajo, y también solo con GET.

**Equivalente a la copia en todo lo que la app necesita:**

| Qué | Resultado |
| --- | --- |
| Pestaña y tamaño | `Respuestas de formulario 1`, 307 columnas, 7,320 filas de cuadrícula (la copia tiene 7,280) |
| Encabezados de la fila 1 | **Cero diferencias** en las 307 columnas; 297 con texto. El mapeador resuelve las mismas columnas |
| Catálogos de `JZ`, `KA`, `KE`, `KH`, `KI` | Idénticos a la copia en la zona de 2026 |
| `KL`–`KU` | Fórmulas arrastradas solo hasta la fila 3126, con `#REF!` en `KO` y `KS`. Confirma el hallazgo de la Etapa 2 sobre la hoja real |
| Protecciones | Misma forma: `A` y `B`–`JX` cerradas para la mesa, `JZ`–`KJ` libres |

**`mesadecontrol@` sí puede escribir `JY`.** La API oculta la lista de editores de una protección a quien no es editor de ella, así que desde la cuenta de servicio la respuesta era indistinguible de "nadie puede". Se resolvió preguntando con la credencial de la mesa: la lista aparece visible, y ese hecho es la prueba. La captura de folio faltante funcionará, lo cual importa de inmediato porque **los tres casos más recientes (filas 7218–7220) llegaron sin folio**.

**Datos de 2026 en la hoja real:** 1,466 casos en las filas 5755–7220, de 7,218 peticiones en total (2023: 1,277 · 2024: 2,511 · 2025: 1,963; dos filas con marca temporal ilegible, ninguna de 2026). Estatus Final: 1,158 Concluida, 206 Tramite, 94 Improcedente y **8 sin valor**.

**Lo que mostrará la fila al cambiar de hoja:** 8 casos sin estatus final, de los cuales **6 caen en la ventana de 30 días** y 2 van a Rezago. Los 206 de Tramite quedan detrás del filtro. Conviene anticipárselo al área para que una fila de 6 casos no se lea como una falla.

## Caso de prueba

Fila **7181** de la copia, folio **9001**, con `omar.lara@enginecx.com` como solicitante. Es un caso simulado creado a mano para probar el correo; se puede seguir usando o limpiar sus columnas de seguimiento cuando estorbe.

## Defecto abierto: las fechas que sella la app

Detectado en la inspección del 13 de agosto de 2026 y **hay que corregirlo antes de apuntar a la hoja productiva**, porque escribe datos incorrectos en el registro real del cliente. Son dos problemas en la misma línea de código, `formatearFechaHoja(new Date())`:

1. **Seis horas de desfase.** No hay manejo de zona horaria en el código y Vercel corre en UTC. Comprobado con evidencia: el evento `conversacion_iniciada` de la fila 7182 quedó en la bitácora a las 16:07 de la Ciudad de México y el sello de `KB` en la hoja dice `11/8/2026 22:07:11`. Afecta a `KB`, a `KD` y al prefijo de fecha de las Observaciones, que después de las 18:00 locales escribe además el día siguiente.
2. **Se guardan como texto.** Con `valueInputOption=RAW` el sello queda como cadena, mientras el histórico de esas columnas son fechas de verdad. Hoy no rompe nada porque la fórmula de `KC` no llega a las filas nuevas, pero el valor no sirve para ordenar ni calcular.

Decidido con el área el 13/8/2026: **`USER_ENTERED` solo para `KB` y `KD`**, para que Sheets las interprete como fecha, y el resto de las columnas se sigue escribiendo con RAW a propósito (ver restricción 15). Más la conversión a UTC−6 en un solo lugar.

## Pendientes de verificación

- Que Keynor, Paty, Norma y José Juan **entren en producción**. La cuenta de José Juan ya quedó confirmada; falta la de Paty, por la duda del dominio `garantiplus.mx` del hallazgo 8. Si un correo no coincide con lo sembrado se corrige en `src/db/seed-usuarios.ts` y se corre `pnpm db:seed`; ojo, el *upsert* es por correo, así que cambiar una dirección **agrega** la nueva y deja la anterior activa: hay que borrar la vieja a mano.
- **Reautorizar el acceso a Google** desde Ajustes, con la cuenta admin: la credencial guardada es anterior al permiso `drive.file` y hasta entonces la subida de archivos responde con el aviso correspondiente. La pantalla de consentimiento debe pedir "ver, editar, crear y eliminar solo los archivos específicos de Google Drive que uses con esta app". Después: subir una captura y un PDF a un caso, comprobar que se descargan, y que en el Drive de `mesadecontrol@` aparece la carpeta **Mesa de Control · Archivos** con los archivos nombrados `[fila] nombre`.
- **El botón de generar folios en la hoja real.** Se ejercitó contra la copia (fila 7180 → folio 9003, guardado como número, y el reintento rechazado), pero el 13/8/2026 no había ningún caso de 2026 sin folio en producción, así que el aviso nace invisible. Hay que verlo cuando llegue la primera petición nueva: el aviso ámbar debe aparecer en la fila y en el caso, el folio debe ser el máximo de la columna + 1, y el aviso debe desaparecer después.
- Conexión de GitHub en la cuenta de Vercel, si se quieren previews automáticos por push (hoy el despliegue es por CLI).
- **Sellado de `KD` en vivo**: cerrar un caso desde la interfaz y comprobar que la fecha de atención final se llena sola y el caso sale de la fila. La lógica tiene 9 pruebas unitarias, pero no se ha ejercido desde la aplicación.
- **La ventana de 30 días del rezago** la definió el desarrollo; falta validarla con quien conoce el SLA. (Los umbrales de 3 y 6 días desaparecieron con el cambio de semáforo.)
- **Reenvío de la conversación con adjuntos**: la bitácora registra un `cadena_reenviada` del 12/8/2026 a la 1:23 pm sobre la fila 7182, así que el reenvío ya se ejerció en vivo; falta confirmar que fue con archivos adjuntos y que la respuesta del tercero **no** aparece en el chat del caso.
- **Botón "Atender yo este caso"** con una cuenta de operador. Con `mesadecontrol@` no funciona a propósito: ese usuario no tiene nombre en `KE` y la app avisa en lugar de inventar un valor para la columna.
- **Los textos de las 14 plantillas** siguen siendo borradores con un `[Escribe aquí…]`. Keynor los corrige desde Ajustes; el texto real lo conoce la mesa.
- **Respuestas fuera del hilo**: si una agencia contesta con un asunto distinto, ese mensaje no llega al caso. Riesgo ya reconocido en el PRD; se decidirá con Keynor si vale la pena atacarlo cuando se vea su frecuencia real.
