# Avance — Frontend Mesa de Control (PJ2859)

Estado consolidado del proyecto. Este documento es la fuente de contexto para retomar el trabajo sin depender del historial de conversación.

| Campo | Valor |
| --- | --- |
| PRD | `enginecx_prd/Gplus-Seguros/PJ2859-frontend-mesa-control/PRD.md` v0.1 |
| Diseño técnico | `docs/superpowers/specs/2026-08-05-frontend-mesa-control-design.md` |
| Repositorio | https://github.com/omarlaraenignecx/frontend-mesa-control |
| Producción | https://frontend-mesa-control.vercel.app |
| Última actualización | 10 de agosto de 2026 |

## Estado por etapas

| Etapa | Estado | Plan |
| --- | --- | --- |
| 0 · Cimientos y accesos | **Completa y en producción** | `docs/superpowers/plans/2026-08-06-etapa-0-cimientos-y-accesos.md` |
| 1 · Lectura del Sheet y cola | **Completa y en producción** | `docs/superpowers/plans/2026-08-06-etapa-1-lectura-y-cola.md` |
| 2 · Vista de caso y escritura | Pendiente | por escribir |
| 3 · Conversación por correo | Pendiente | — |
| 4 · Producción y cierre | Pendiente | — |

Suite: **109 pruebas** en 12 archivos. Comandos: `pnpm test`, `pnpm build`, `pnpm dev`, `pnpm db:push`, `pnpm db:seed`.

## Infraestructura

| Recurso | Identificador |
| --- | --- |
| Proyecto GCP | `mesa-de-control-504618`, dentro de la organización `1029986595993` |
| Cuenta de servicio | `cuenta-de-servicio@mesa-de-control-504618.iam.gserviceaccount.com` (administración y lectura en desarrollo; **no** es la credencial de la app) |
| Cliente OAuth | `Mesa de Control web`, pantalla de consentimiento **Interna** |
| Identidad operativa | `mesadecontrol@gplusseguros.mx`, refresh token cifrado en Supabase |
| Base de datos | Supabase `supabase-cerulean-helmet`, provisionada por el Marketplace de Vercel |
| Proyecto Vercel | `frontend-mesa-control` en el equipo `omarlara-1860s-projects` |
| Hoja de desarrollo | `1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ` — "Prueba formulario mesa de control" |
| Hoja productiva | `1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0` — **no se escribe antes de la Etapa 4** |

El push a GitHub usa un credential helper local que lee el token de `~/.gh-token-mesa`, con una entrada vacía previa para descartar el `osxkeychain` del sistema (que responde con otra cuenta).

## Usuarios

| Correo | Nombre en `KE` | Rol |
| --- | --- | --- |
| `keynor.rivas@gplusseguros.mx` | Keynor | operador |
| `patricia.ramirez@gplusseguros.mx` | Paty | operador |
| `norma.zacarias@gplusseguros.mx` | Norma | operador |
| `juan.palafox@gplusseguros.mx` | José Juan | operador |
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
| Identidad del caso | El **número de fila**. El folio puede faltar y hay folios arrastrados sin petición |
| Orden de la cola | **FIFO**, el abierto más antiguo primero (sustituye a RF-01) |
| Corte de la cola | **30 días**; lo anterior vive en la vista Rezago. Buscar o filtrar desactiva el corte |
| Caso abierto | `KA` distinto de `Concluida` e `Improcedente` |
| Acceso a Google | Todo con OAuth de `mesadecontrol@`; consentimiento Interno aprobado por el admin |
| Identidad de usuario | Cuenta personal del dominio contra allowlist en base; revalidada en cada carga |
| Bloqueo de caso | Se toma al abrir; lo libera el dueño o cualquiera puede forzarlo, con registro |
| Semáforo | Calculado por días de espera (verde ≤2, ámbar 3-5, rojo ≥6). No se captura |
| Fechas `KB` y `KD` | Selladas automáticamente por la app |
| Asunto del correo | `Seguimiento de Caso \| Gplus Seguros \| <folio>` |
| Correos | HTML profesional al enviar, texto plano en el chat |
| Folio faltante | Se pide capturarlo antes de abrir la conversación; la app no genera folios |
| Reactividad | Lectura al cargar más botón Actualizar. Sin polling ni webhooks |
| Plantillas de correo | En base de datos, editables desde la app |
| Firma | Remitente de la mesa, indicando quién atiende |

## Restricciones técnicas aprendidas

1. **El proxy (antes middleware) corre en runtime edge y no alcanza Postgres.** La configuración de Auth.js está partida: `auth.config.ts` sin base para el proxy, `auth.ts` con base para Node. Hay una prueba de arquitectura (`edge-safety.test.ts`) que recorre los imports y falla si el proxy vuelve a alcanzar la base.
2. **El caso no puede contener objetos `Date`.** La caché serializa a JSON y un `Date` vuelve como texto. La fecha viaja como `marcaTemporalIso` y se convierte con `fechaDe()`.
3. **La frontera del esquema es semántica, no posicional.** Se localiza por el encabezado `Folio de atención` y las columnas calculadas se ignoran por su nombre. Fijarla en la columna 285 rompería el seguimiento en cuanto el formulario crezca.
4. **`revalidateTag` exige un segundo argumento en Next 16.** El botón Actualizar usa `updateTag`, que invalida de inmediato.
5. **`unstable_cache` sigue funcionando** pero es legacy; migrar a `use cache` requiere habilitar `cacheComponents`, lo que obliga a revisar las fronteras de Suspense. Pendiente evaluado, no urgente.

## Hallazgos de operación (para conversar con Norma y Keynor)

1. **140 de 200 casos abiertos son rezago**, el más antiguo con **216 días** (folio 5787, del 6 de enero). La mesa no cierra formalmente los casos que quedan esperando al solicitante o a la aseguradora. Es lo que motivó el corte de 30 días.
2. **Aparece "Ernesto"** como responsable histórico, y no está en el catálogo actual de `KE` ni en la allowlist.
3. **Los umbrales del semáforo** (3 y 6 días) los definió el desarrollo, no la operación. Falta validarlos con quien conoce el SLA.
4. **Un caso puede llegar sin folio.** Ya se observó en producción: la fila 7180 y otra que entró el 10 de agosto.
5. **112 columnas sin clasificar** en 34 encabezados: número de póliza, número de siniestro, teléfono del cliente, tipo de endoso, versión de la unidad y similares. Son datos legítimos que varían por trámite y se mostrarán como campos del caso; no requieren entrar al modelo. Posible mejora a consultar: permitir búsqueda por número de póliza, que hoy no está en RF-02.

## Pendientes de verificación

- Que Keynor, Paty, Norma y José Juan **entren en producción**. Si algún correo no coincide con lo sembrado, se corrige con `pnpm db:seed`.
- Conexión de GitHub en la cuenta de Vercel, si se quieren previews automáticos por push (hoy el despliegue es por CLI).
