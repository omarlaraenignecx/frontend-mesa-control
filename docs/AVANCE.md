# Avance — Frontend Mesa de Control (PJ2859)

Estado consolidado del proyecto. Este documento es la fuente de contexto para retomar el trabajo sin depender del historial de conversación.

| Campo | Valor |
| --- | --- |
| PRD | `enginecx_prd/Gplus-Seguros/PJ2859-frontend-mesa-control/PRD.md` v0.1 |
| Diseño técnico | `docs/superpowers/specs/2026-08-05-frontend-mesa-control-design.md` |
| Repositorio | https://github.com/omarlaraenignecx/frontend-mesa-control |
| Producción | https://frontend-mesa-control.vercel.app |
| Última actualización | 20 de agosto de 2026 (módulo de Atención a Siniestros: etapas 1 y 2 de 6, en rama `siniestros`) |

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
| Notificaciones en vivo | **Completa y en producción** desde el 17/8/2026, con los dos flujos de n8n activos | `docs/superpowers/plans/2026-08-14-notificaciones.md` · salida: `docs/PASO-A-PRODUCCION-NOTIFICACIONES.md` |
| Avisos de escritorio | **Completa y en producción**, probada en local contra la copia con ocho peticiones simuladas y un correo real | `docs/superpowers/plans/2026-08-17-avisos-escritorio.md` · salida: punto 11 de `docs/PASO-A-PRODUCCION-NOTIFICACIONES.md` |
| 4 · Producción y cierre | En curso: hoja productiva en uso; falta la jornada real y el cierre documental | `docs/superpowers/plans/2026-08-13-etapa-4-produccion-y-cierre.md` |
| Atención a Siniestros · 1 cimientos y 2 listado | **Completas en la rama `siniestros`**, verificadas contra la copia de la hoja; sin desplegar | `docs/superpowers/plans/2026-08-20-siniestros-cimientos-y-listado.md` · diseño: `docs/superpowers/specs/2026-08-20-modulo-siniestros-design.md` |
| Atención a Siniestros · 5 avisos (parte) | **Hecha en la rama `siniestros`**: columna `notificaciones.modulo` aplicada a la base, sondeo y avisos de escritorio separados por módulo. Falta la ruta de correos del buzón de siniestros, que depende de la etapa 3 | mismo diseño, sección 9 |
| Atención a Siniestros · 3, 4 y 6 | Pendientes: cuenta de Gmail de José, vista del caso y su correo, prueba y despliegue | mismo diseño, sección 10 |

Suite: **583 pruebas** en 57 archivos. Comandos: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev`, `pnpm db:push`, `pnpm db:seed`.

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
| Qué caso es de siniestros | El área declarada en el formulario ("Áreas de GPLUS SEGUROS" / "Gplus Seguros", columnas `BE`, `CK`, `CU`, `FD`, `HM`) y nada más. Medido el 20/8/2026: 268 filas dicen `Siniestros` y ninguna trae la rama de preguntas del ramo sin decirlo |
| Separación de los dos módulos | La fila de la mesa sigue listando los siniestros —lo pidió el área—, pero abrir uno redirige a `/siniestros/caso/[fila]`: si se atendiera desde la mesa, la respuesta saldría de `mesadecontrol@` con la plantilla equivocada |
| Acceso al módulo de siniestros | Cualquier usuario autorizado del sistema. El apartado de permisos de Ajustes es solo para la autorización de Gmail, no para controlar quién entra |
| Clasificación del listado | Configurable por módulo: la mesa por tipo de trámite, siniestros por tipo de siniestro. Ninguna de las 268 peticiones del ramo trae tipo de trámite, así que ese selector saldría siempre vacío |
| Estatus por omisión del listado | También por módulo: la mesa muestra solo los pendientes —"Tramite" ahí significa que un compañero ya lo tomó—; siniestros muestra pendientes y en trámite, porque los atiende una sola persona y esconderlos dejaba su pantalla vacía teniendo dos casos abiertos |
| Navegación entre módulos | Un botón azul en el encabezado de cada listado al otro módulo. Sin él, el segundo módulo solo se alcanza escribiendo la URL; como enlace discreto no se veía |
| Avisos por módulo | Separación estricta: cada campanita solo lo de su módulo. La columna `notificaciones.modulo` se sella al crear el aviso, por el área declarada en el formulario; deducirla al leer obligaría a releer la hoja treinta veces por minuto y por persona. Marcar leído sí ignora el módulo: abrir un caso lee todos sus avisos |
| Aviso de respuesta | Todos los correos que salen de la mesa llevan un bloque ámbar antes de la firma pidiendo **responder a ese mismo mensaje** y explicando que un correo nuevo separa la respuesta del expediente. Va en el armado del correo (`avisoDeRespuesta`), no en las plantillas que edita el área: en las plantillas se podría borrar al corregir un texto, y responder en el hilo es lo que conserva el `threadId` de la fila. **No** se agregó al reenvío de la conversación, que sale como correo aparte y cuyas respuestas no entran al chat del caso |
| Caso cerrado con respuesta nueva | Se muestra con aviso y se puede contestar; la app no reabre el caso ni toca su estatus |
| Archivos del caso | Tres orígenes en un solo panel: el formulario (Drive), la conversación (Gmail) y **los que sube la mesa**. Sin restricción de tipo: capturas, PDF, lo que haga falta. Van a una carpeta `Mesa de Control · Archivos` del Drive de `mesadecontrol@`, **una por hoja**, para que probar contra la copia no deje archivos en la que ve el área, con el registro en `archivos_caso`; el enlace **no puede** ir a la hoja porque sus columnas de adjuntos están protegidas sin editores. El registro se identifica por **hoja más fila**, no por fila sola |
| Identidad del caso | El **número de fila**. El folio puede faltar y hay folios arrastrados sin petición |
| Orden de la fila | **Del más reciente al más antiguo** (pedido del cliente el 11/8/2026; antes era FIFO) |
| Corte de la fila | **30 días**; lo anterior vive en la vista Rezago. Buscar o filtrar desactiva el corte |
| Filtro de estatus final | Selección múltiple con casillas, incluida la opción "sin estatus". Por omisión **solo los pendientes** (sin estatus final): los de Tramite tampoco entran, porque ese valor significa que alguien ya tomó el caso. Sustituye a la casilla "Incluir cerrados". Desde el 14/8/2026 la casilla de pendientes **se muestra marcada** cuando no hay nada en la URL —antes el panel se veía sin filtro aunque sí lo hubiera— y hay un **"Seleccionar todos"** que marca los estatus de golpe y en el segundo clic regresa a los pendientes. Desmarcar la última casilla también regresa ahí: la tabla nunca se queda sin ningún estatus elegido |
| Notificaciones | **n8n agenda, la app detecta.** Dos flujos con Schedule Trigger cada minuto llaman dos rutas protegidas por secreto compartido (`/api/notificaciones/casos-nuevos` y `/correos`); la app lee la hoja y el buzón con la credencial que ya tiene y escribe en `notificaciones`. Los disparadores nativos de n8n se descartaron por tres hechos medidos: el de Sheets detecta filas por conteo y el formulario **inserta** la respuesta arriba de las pre-arrastradas; la columna del folio está protegida y la cuenta de servicio de n8n no es editora; y el de Gmail exigiría autorizar `mesadecontrol@` en n8n, token que la app ya tiene |
| Aviso de caso nuevo | Se detecta por **marca temporal** contra una marca de agua en `ajustes_app`, no por número de fila —el `insert` del formulario mueve las filas de abajo—. La comparación es "mayor o igual" para no perder dos peticiones del mismo segundo, y la clave única de la tabla descarta el repetido. La primera corrida sobre una hoja **siembra la marca en silencio**: avisar del histórico completo llenaría el panel |
| Folio automático | La ruta de casos nuevos genera los folios faltantes **antes** de crear el aviso, para que el refresco de la tabla ya los muestre. La bitácora lo atribuye a `n8n:casos-nuevos`, distinguible de una persona. Se apaga quitando una llamada, sin tocar el resto |
| Aviso de correo nuevo | El mensaje se relaciona con su caso por el **folio del hilo**, buscado en la hoja que sirve ese despliegue, y no por `casos_hilo.fila`: esa tabla no lleva hoja, así que su fila 7181 puede ser de la copia o de la real. Verificado con datos reales: cinco respuestas de casos productivos no generaron ningún aviso en la copia. La ventana del buzón es de **7 días**, porque en el buzón real las respuestas llegan con dos y tres días de separación y una pausa de los flujos perdería avisos |
| Sondeo del navegador | Cada **30 segundos**, en un solo lugar por página (contexto), **en pausa con la pestaña oculta** y consultando al volver a ella. Se detiene solo si la sesión vence. Se eligió sondeo y no push (Supabase Realtime) porque el resto del mecanismo es idéntico en los dos y el sondeo sobrevive a que n8n falle; cambiarlo después no toca la interfaz |
| Notificaciones leídas | **Por usuario**, en `notificaciones_leidas`: que Keynor lea un aviso no se lo quita a Paty. En la vista del caso se marcan leídas a los 3 segundos de tenerla a la vista —abrir y ver cuenta como leer—, nunca con la pestaña oculta |
| Panel de notificaciones | Barra lateral sobrepuesta en un **portal a `document.body`**: la cabecera del caso lleva `backdrop-blur`, y un elemento con `backdrop-filter` se vuelve el bloque contenedor de sus descendientes `position: fixed`, lo que recortaba el panel a la altura de esa barra |
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
| Avisos de escritorio | Sobre el mismo sondeo, con la API `Notification` y **sin service worker ni Web Push**: llegan mientras la pestaña esté abierta, que es como trabaja el área. El permiso se pide siempre desde un clic —Chrome ignora la petición sin gesto del usuario— y al concederlo se manda un globo de prueba, porque el sistema puede estar silenciando al navegador con el permiso ya dado. Cada usuario los apaga desde el panel sin tocar la configuración del sitio (`localStorage`) |
| Sondeo con la pestaña oculta | Pausado, **salvo** que los avisos de escritorio estén encendidos; entonces sigue a la mitad del ritmo (una petición por minuto). Pausarlo siempre dejaba el aviso sin llegar en el único momento para el que existe: cuando el usuario está en otra pestaña o en otra aplicación |
| Tanda de avisos | Más de tres en un mismo ciclo se juntan en un solo globo de resumen que lleva a la fila. Sin eso, una tanda de correos tapa la pantalla y se cierra sin leer. El timbre también es uno por tanda |
| Timbre | Sintetizado con WebAudio, dos notas, volumen 0.95 —el techo útil; 1.0 recorta—. Sin archivo de audio porque la opción `sound` de `Notification` está deprecada y ningún navegador la implementa, así que el sonido sale de la página de todos modos. Interruptor propio con botón Probar, aparte de los globos: hay quien quiere verlos y no oírlos |

## Restricciones técnicas aprendidas

1. **El proxy (antes middleware) corre en runtime edge y no alcanza Postgres.** La configuración de Auth.js está partida: `auth.config.ts` sin base para el proxy, `auth.ts` con base para Node. Hay una prueba de arquitectura (`edge-safety.test.ts`) que recorre los imports y falla si el proxy vuelve a alcanzar la base.
2. **El caso no puede contener objetos `Date`.** La caché serializa a JSON y un `Date` vuelve como texto. La fecha viaja como `marcaTemporalIso` y se convierte con `fechaDe()`.
3. **La frontera del esquema es semántica, no posicional.** Se localiza por el encabezado `Folio de atención` y las columnas calculadas se ignoran por su nombre. Fijarla en la columna 285 rompería el seguimiento en cuanto el formulario crezca.
4. **`revalidateTag` exige un segundo argumento en Next 16, y `updateTag` solo corre en Server Actions.** El botón Actualizar y el refresco automático de la fila usan `updateTag`, que invalida de inmediato; desde una Route Handler eso no se puede, así que ahí va `revalidateTag(tag, { expire: 0 })`. El perfil `'max'` no sirve para este caso: entrega el dato rancio en la siguiente visita y revalida por detrás.
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
18. **El cuerpo de una Server Action está limitado a 1 MB por omisión, y eso rompió el envío de correo con adjuntos.** La subida de archivos al caso va por una Route Handler (`/api/archivo/subir`) para no depender de ese tope, pero el **adjunto del correo sí viaja dentro de la acción**, y ahí el límite nunca se configuró: el compositor solo revisaba el tope de Gmail (25 MB ya codificados, ~18.7 MB de archivo real), así que un PDF de tres megas pasaba la revisión y Next abortaba la petición con un **413 antes de ejecutar la acción**. En el navegador eso se ve como "This page couldn't load", sin explicación y perdiendo el mensaje escrito. Se corrigió el 14/8/2026 fijando `serverActions.bodySizeLimit` desde `LIMITE_CUERPO_ACCION_BYTES` (`src/lib/correo/limites.ts`), con una prueba que falla si el tope de la acción deja de cubrir lo que Gmail acepta. El costo asumido es que **todos** los formularios admiten cuerpos de hasta 25 MB; están detrás del proxy autenticado y solo el compositor tiene campo de archivos. Aparte, los dos compositores ahora atrapan lo que lance la acción: una falla anterior a ella ya no se lleva la página.
19. **En un archivo con `'use server'`, toda función exportada es un punto de entrada llamable desde el navegador.** Una que no revise la sesión es una puerta abierta, no un detalle interno: al implementar las notificaciones, poner la generación de folios ahí para reusarla desde una ruta habría dejado la escritura en la hoja al alcance de cualquiera. Lo que no revisa sesión vive en `lib/`. Vigilado por `src/app/acciones-con-guardia.test.ts`, que recorre todos esos archivos y exige `requerirUsuario` o `requerirAdmin` en cada función exportada.
20. **Un ancestro con `backdrop-filter`, `transform`, `filter` o `contain` se vuelve el bloque contenedor de sus descendientes `position: fixed`.** El panel de notificaciones se recortaba a la altura de la cabecera del caso por su `backdrop-blur`. La solución es un portal a `document.body`.
21. **El linter de React prohíbe `Date.now()` en el render y `setState` en el cuerpo de un efecto.** Lo primero obliga a mostrar horas absolutas o a mover el reloj a estado; lo segundo, a diferir la primera carga con `queueMicrotask`.
22. **`fetch` no acepta un `Uint8Array<ArrayBufferLike>` como cuerpo**, que es lo que TypeScript infiere por omisión desde la 5.7. Hay que construirlo con `new Uint8Array(new ArrayBuffer(n))` para fijar el respaldo en un `ArrayBuffer`; si no, `tsc` lo rechaza aunque en ejecución funcione.
23. **La misma base sirve a la copia y a la hoja real**, porque `POSTGRES_URL` tiene un solo valor para Production, Preview y Development. El número de fila por sí solo **no** identifica un caso: la 7181 de la copia y la 7181 de la productiva son casos distintos. `archivos_caso` lleva `sheet_id` por eso. Las tablas anteriores (`bitacora`, `eventos_bi`, `casos_hilo`) no lo llevan, así que una entrada hecha desde `pnpm dev` se ve en el caso de producción con el mismo número; son registros internos y de solo lectura para la mesa, pero conviene saberlo.
24. **Agregar un scope no invalida la credencial guardada.** El refresh token sigue sirviendo para los permisos que sí tiene, así que la falta solo se nota al usar la función nueva —con un 403 opaco de Google—. `scopesFaltantes()` compara lo guardado con lo requerido y Ajustes lo avisa; el 403 se traduce a un mensaje que dice qué hacer.

25. **La API `Notification` exige HTTPS y un gesto del usuario, y el permiso concedido no garantiza que el globo se vea.** `localhost` está exento del primero, y Vercel ya sirve por HTTPS. Lo segundo obliga a que el permiso se pida desde un botón. Lo tercero es lo que más engaña: con el permiso dado, el modo concentración de macOS o los avisos de Chrome apagados en Windows silencian todo sin decir nada, así que la app manda un globo de prueba al activar para que la falla se vea en ese momento y no el día que se pierda un caso.

26. **El navegador solo permite audio en una página que ya recibió un clic o una tecla, y Chrome no avisa cuando lo niega: deja `resume()` pendiente.** Las dos consecuencias se pagaron el 17/8/2026. La primera: el timbre del primer aviso tras recargar llega mudo si nadie tocó la pantalla —no es evitable, ni con Web Push, porque el sonido saldría igual de la pestaña; se explica en el cartel de la fila cuando pasa—. La segunda, más engañosa: sin un tope de espera, la promesa pendiente se resolvía con el primer clic del usuario y soltaba el timbre de un aviso de siete minutos antes. Hay 2 segundos de límite, y programar las notas antes de que el contexto esté `running` no sirve: con el reloj de audio congelado, las rampas de ganancia quedan en el pasado y el oscilador suena en silencio.

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
- **Las notificaciones en el navegador del área**: la campanita con su punto azul, el panel lateral, la tabla que se actualiza sola al llegar una petición y el aviso "N mensajes nuevos" en el chat. Todo probado en local contra la copia —incluido el circuito completo de n8n por un túnel: petición insertada a las 16:35 y detectada por el flujo a las 16:35:48, con folio 9005 y su aviso— pero falta verlo con una sesión real del área. El detalle de la salida está en `docs/PASO-A-PRODUCCION-NOTIFICACIONES.md`.
- **Los avisos de escritorio en producción, con la sesión del área**: activar el permiso desde la barra azul de la fila y comprobar el globo de prueba en cada navegador que usen. En local quedó probado el circuito completo contra la copia —ocho peticiones simuladas con su folio automático, y una respuesta de correo real— con globo y timbre.
- **Que n8n alcance producción.** Preview no sirvió para probarlo porque la protección de despliegues de Vercel responde 302 a n8n. Se comprueba en el primer ciclo tras activar los flujos.
- **Restaurar las protecciones de la copia de pruebas** (columnas `A` y `B–JX`), que se quitaron para poder simular peticiones con `scripts/simular-peticion.ts`. Las de la hoja productiva nunca se tocaron. Las nueve filas simuladas del 17/8/2026 (7184–7192) ya se borraron, junto con sus avisos en la base.
- Conexión de GitHub en la cuenta de Vercel, si se quieren previews automáticos por push (hoy el despliegue es por CLI).
- **Sellado de `KD` en vivo**: cerrar un caso desde la interfaz y comprobar que la fecha de atención final se llena sola y el caso sale de la fila. La lógica tiene 9 pruebas unitarias, pero no se ha ejercido desde la aplicación.
- **La ventana de 30 días del rezago** la definió el desarrollo; falta validarla con quien conoce el SLA. (Los umbrales de 3 y 6 días desaparecieron con el cambio de semáforo.)
- **Reenvío de la conversación con adjuntos**: la bitácora registra un `cadena_reenviada` del 12/8/2026 a la 1:23 pm sobre la fila 7182, así que el reenvío ya se ejerció en vivo; falta confirmar que fue con archivos adjuntos y que la respuesta del tercero **no** aparece en el chat del caso.
- **Botón "Atender yo este caso"** con una cuenta de operador. Con `mesadecontrol@` no funciona a propósito: ese usuario no tiene nombre en `KE` y la app avisa en lugar de inventar un valor para la columna.
- **Los textos de las 14 plantillas** siguen siendo borradores con un `[Escribe aquí…]`. Keynor los corrige desde Ajustes; el texto real lo conoce la mesa.
- **Respuestas fuera del hilo**: si una agencia contesta con un asunto distinto, ese mensaje no llega al caso. Riesgo ya reconocido en el PRD; se decidirá con Keynor si vale la pena atacarlo cuando se vea su frecuencia real.
