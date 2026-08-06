# Diseño técnico — Frontend Mesa de Control

| Campo | Detalle |
| --- | --- |
| Proyecto | Frontend Mesa de Control (PJ2859) |
| Unidad | Gplus Seguros |
| PRD de referencia | `enginecx_prd/Gplus-Seguros/PJ2859-frontend-mesa-control/PRD.md` v0.1 |
| Fecha | 5 de agosto de 2026 |
| Autor | Omar André Lara Saldaña |
| Alcance | Fase 1 del PRD (MVP): RF-01 a RF-14 |

Este documento traduce el PRD a decisiones técnicas ejecutables. Donde una decisión modifica lo que dice el PRD, se marca explícitamente en la sección 10.

---

## 1. Resumen de la solución

Aplicación web en Next.js desplegada en Vercel que presenta cada petición del formulario de Google como un caso individual: sus campos con dato, sus adjuntos, la conversación por correo con el solicitante y la captura de seguimiento. El Google Sheet permanece como fuente única de datos del negocio; una base propia en Supabase guarda únicamente metadatos operativos.

Todo acceso a Google (Sheets, Drive, Gmail) se ejecuta con la identidad de `mesadecontrol@gplusseguros.mx` mediante un consentimiento OAuth único aprobado por el administrador. Los usuarios de la mesa entran con su cuenta personal del dominio, validada contra una allowlist explícita.

No hay sincronización automática: la app lee de Google al cargar la página y ofrece un botón **Actualizar**. El seguimiento se escribe en el Sheet solo por acción explícita del usuario.

---

## 2. Hallazgos sobre la hoja real

Verificado el 5 de agosto de 2026 leyendo el archivo con la cuenta de servicio en modo lectura.

**Archivo**: `Formulario sin título (Respuestas)`, ID `1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0`.

**Pestañas**:

| sheetId | Dimensión | Nombre |
| --- | --- | --- |
| 1848974510 | 7277 × 307 | `Respuestas de formulario 1` (la que importa) |
| 1593566129 | 1001 × 26 | `CONTEO DE TRAMITES` |
| 361124404 | 1000 × 26 | `Hoja 3` |
| 1067799074 | 102 × 99 | `Datos10-Siniestros-VT-Cerrada-Fuera SLA` |
| 1985536333 | 1000 × 26 | `Catalogo` (incompleta, no se usa) |

**Estructura de `Respuestas de formulario 1`**: encabezados en la fila 1, datos desde la fila 2, tres filas congeladas. Última petición registrada: fila 7178 (5/8/2026 17:33). Distribución por año: 1,277 de 2023, 2,511 de 2024, 1,963 de 2025, **1,424 de 2026**.

**Un caso llena entre 10 y 19 celdas de 307.** Ejemplo real (fila 7176, folio 7000): `A` marca temporal, `N` tipo de trámite, `Q` adjunto de emisión, `AB` nombre del solicitante, `AD` correo, `AJ` motivo, `BC` agencia externa, `BD` tipo de negocio, `BN` causa, `CK` área, `JM` correo del ejecutivo, más las columnas de seguimiento.

**El formulario está replicado en bloques.** El mismo campo lógico existe en múltiples columnas según la rama del formulario que respondió el solicitante. Ejemplos observados:

| Campo lógico | Columnas equivalentes observadas |
| --- | --- |
| Tipo de trámite | `N`, `AS`, `BQ`, `CJ`, `CW`, `CY`, `FF`, `FH`, `HO`, `HQ` |
| Correo del solicitante | `AD`, `JM`, `J` |
| Nombre del solicitante | `AB`, `CL`, `EU`, `HD` |
| Agencia | `AC`, `BC`, `CQ`, `CS`, `EZ`, `FB`, `HI`, `HK` |
| Aseguradora (declarada) | `D`, `BI`, `BZ`, `DG`, `EO`, `FP`, `GX`, `HY`, `JG` |
| Motivo de la petición | `AE`–`AR`, `DJ`–`EA`, `FS`–`GJ`, `IB`–`IS` |
| Adjuntos | una columna por tipo de trámite y por bloque: `P`–`Y`, `BR`, `BT`, `CP`, `DK`–`EB`, `EY`, `FT`–`GK`, `HH`, `IC`–`IT`, `JQ`, `JX` |

**Zona de seguimiento de la mesa** (columnas 285–307):

| Col | Encabezado | Trato en la app |
| --- | --- | --- |
| `JY` (285) | Folio de atención | Lectura. Escritura solo en el caso de captura de folio faltante (sección 6.3) |
| `JZ` (286) | Estatus Inicial | Editable, catálogo de validación |
| `KA` (287) | Estatus Final | Editable, catálogo de validación |
| `KB` (288) | Fecha y hora de respuesta por correo | Sellada por la app al enviar el primer correo |
| `KC` (289) | Tiempo entre solicitud y respuesta | **Prohibida** (fórmula) |
| `KD` (290) | Fecha y hora de Atención Final | Sellada por la app al pasar a estatus terminal |
| `KE` (291) | Quien Atendio | Editable, catálogo de validación, precargado por usuario |
| `KF` (292) | Folio interno | Editable (es el folio de aseguradora del PRD) |
| `KG` (293) | Aseguradora | Editable, catálogo de validación |
| `KH` (294) | El ejecutivo contaba con permisos | Editable, catálogo de validación |
| `KI` (295) | Causa por la que no pudo realizar la actividad | Editable, catálogo de validación |
| `KJ` (296) | Observaciones | Editable, acumulativo |
| `KL`–`KN` (298–300) | Estatus Inicial / Final / Real (duplicados) | **Prohibidas** (residuales) |
| `KO`–`KU` (301–307) | Días de espera, total días, día, SLA, año, mes | **Prohibidas** (fórmulas; `KO` y `KS` hoy tienen `#REF!` en filas vacías) |

**Catálogos reales** (leídos de la validación de datos de las celdas, no de la pestaña `Catalogo`):

- `JZ` Estatus Inicial: `Atendida / Concluida`, `Atendida / Con aseguradora`, `Se redireccionó al área comercial`, `Atendida/en trámite`, `Se solicita información complementaria`, `Validación con TI`, `Atendida/en trámite con RC`, `Atendida/en trámite con CAF`, `Concluida/no se envío la información adicional`
- `KA` Estatus Final: `Concluida`, `Improcedente`, `Tramite`
- `KE` Quien Atendió: `José Juan`, `Norma`, `Paty`, `Keynor`
- `KG` Aseguradora: `QUALITAS`, `HDI`, `CHUBB`, `GNP`, `POTOSI`, `ANA`, `TODAS LAS ASEGURADORAS`, `GPLUS `, `OMEGA`, `LA LATINO`
- `KH` Permisos: `Si`, `No`, `N/A`
- `KI` Causa: `Falta Capacitación`, `Mejorar Costo`, `No quiso Realizarla`, `Usuario bloqueado`, `No se pudo emitir en Omega`, `Siniestros`, `Falla en portal`, `Dependencia con Aseguradora`, `No se emitio en Anfexi`, `Función de GPLUS`, `Falta homologación`, `Problema de homologación`, `Sin usuarios`, `Alta de versión`

Los catálogos se leen en tiempo de ejecución de la validación de datos de la primera fila de datos, nunca se codifican. Si Keynor modifica una lista en la hoja, la app la refleja sin cambios de código, y así jamás escribe una variante de texto que rompa la tabla dinámica.

**El folio no es identificador confiable.** La columna `JY` está pre-arrastrada: las filas 7208–7213 tienen folios 6404–6409 sin petición asociada, y la última petición real (fila 7178) llegó sin folio. El supuesto del PRD "el folio de petición identifica sin ambigüedad cada caso" **no se cumple**.

**Los adjuntos** llegan como `https://drive.google.com/open?id=<fileId>` en la columna del trámite correspondiente.

**No existe columna de semáforo.** Lo más cercano son las columnas calculadas de días de espera y SLA (`KO`–`KS`).

---

## 3. Arquitectura

### 3.1 Stack

| Capa | Elección |
| --- | --- |
| Framework | Next.js 16, App Router, Server Components y Server Actions |
| Lenguaje | TypeScript en modo estricto |
| Gestor de paquetes | pnpm |
| UI | Tailwind CSS + shadcn/ui, tema sobrio corporativo, modo claro y oscuro |
| Hosting | Vercel, runtime Node (Fluid Compute). Sin Edge Runtime |
| Base de datos | Supabase Postgres, provisionado por el Marketplace de Vercel |
| ORM | Drizzle con migraciones versionadas en el repositorio |
| Autenticación de usuarios | Auth.js v5, proveedor Google |
| Pruebas | Vitest para lógica; APIs de Google simuladas |
| Repositorio | `https://github.com/omarlaraenignecx/frontend-mesa-control` |
| Equipo de Vercel | `omarlara-1860's projects` |

### 3.2 Módulos y sus fronteras

Cada módulo tiene una responsabilidad, se prueba solo y no conoce las internas de los demás.

```
src/
  lib/google/
    auth-mesa.ts        Cliente autenticado como mesadecontrol@; renueva y descifra el token
    sheet-schema.ts     Mapeador: encabezados -> campos lógicos. Sin efectos
    sheet-reader.ts     Lee filas y construye casos. Solo lectura
    sheet-writer.ts     Único con permiso de escritura. Lista blanca de columnas
    sheet-catalogs.ts   Extrae catálogos de la validación de datos
    drive-links.ts      Normaliza URLs de Drive a enlaces navegables
    gmail-thread.ts     Localiza, lee y normaliza hilos a mensajes de chat
    gmail-send.ts       Compone MIME (HTML + adjuntos) y envía
  lib/casos/
    caso.ts             Modelo de dominio del caso y su estado derivado
    cola.ts             Orden FIFO y criterio de caso vivo
    semaforo.ts         Días de espera -> indicador visual
    bloqueo.ts          Adquirir, liberar y forzar bloqueos
    bitacora.ts         Registro de cambios
    eventos.ts          Los 7 eventos de BI
  lib/correo/
    plantillas.ts       Plantillas con variables, leídas de base
    html-a-texto.ts     HTML de Gmail -> texto plano sin citas ni firmas
    render-html.ts      Texto del usuario -> correo HTML con identidad Gplus
  db/
    schema.ts           Esquema Drizzle
  app/
    (auth)/             Inicio de sesión y rechazo por allowlist
    cola/               Cola de casos
    caso/[fila]/        Vista de caso: datos, seguimiento y conversación
    ajustes/            Plantillas, estado del consentimiento, bitácora (admin)
    api/                Descarga de adjuntos y callback de autorización de la mesa
```

Regla estructural: solo `sheet-writer.ts` escribe en el Sheet, y solo `gmail-send.ts` envía correo. Ninguna vista llama a Google directamente; todo pasa por estos módulos.

### 3.3 Modelo de datos propio (Supabase)

```
usuarios_autorizados   correo (PK), nombre_en_hoja, rol ('operador'|'admin'), activo
credencial_mesa        id (PK), refresh_token_cifrado, scopes, autorizado_por,
                       autorizado_en, ultimo_error, ultimo_uso
bloqueos               fila (PK), correo_dueno, tomado_en, ultimo_latido
casos_hilo             fila (PK), thread_id, asunto_normalizado, folio_usado, creado_en
bitacora               id (PK), fila, folio, correo_usuario, campo, valor_anterior,
                       valor_nuevo, tipo ('guardado'|'bloqueo_forzado'|'folio_capturado'),
                       creado_en
plantillas_correo      id (PK), tipo_tramite, asunto_plantilla, cuerpo_html, activa,
                       actualizada_por, actualizada_en
eventos_bi             id (PK), tipo, fila, folio, tipo_tramite, estatus_resultante,
                       motivo, correo_usuario, creado_en
```

La identidad del caso es **el número de fila** de `Respuestas de formulario 1`. Es estable porque las filas del formulario no se reordenan ni se borran. El folio es un dato de negocio que se muestra y se usa en el asunto del correo, no la llave.

Si Supabase quedara inaccesible, el negocio no pierde nada: la hoja conserva todo el seguimiento. Solo se pierden bloqueos, vínculos de hilo, bitácora y eventos.

---

## 4. Identidad y accesos a Google

### 4.1 Dos identidades separadas

**Identidad del usuario.** Auth.js v5 con Google, restringido al dominio `gplusseguros.mx` y además a la allowlist. Tener cuenta del dominio no basta (RNF-02).

| Correo | Nombre en `KE` | Rol |
| --- | --- | --- |
| `keynor.rivas@gplusseguros.mx` | Keynor | operador |
| `patricia.ramirez@gplusseguros.mx` | Paty | operador |
| `norma.zacarias@gplusseguros.mx` | Norma | operador |
| `juan.palafox@gplusseguros.mx` | José Juan | operador |
| `mesadecontrol@gplusseguros.mx` | — | admin |

El rol admin es el único que puede autorizar o reautorizar el consentimiento de Google, editar plantillas, forzar liberaciones y lanzar importaciones históricas. Como `mesadecontrol@` no existe en el catálogo de `KE`, al guardar un caso el admin elige el valor del desplegable en lugar de recibirlo precargado.

**Identidad de la mesa.** Un único consentimiento OAuth de `mesadecontrol@gplusseguros.mx`, aprobado por el administrador, cuyo refresh token se guarda cifrado con AES-256-GCM en `credencial_mesa`. La clave de cifrado vive en una variable de entorno de Vercel, nunca en el repositorio (RNF-03).

Scopes solicitados, y ninguno más:

- `https://www.googleapis.com/auth/spreadsheets` — leer y escribir la hoja
- `https://www.googleapis.com/auth/drive.readonly` — adjuntos del formulario
- `https://www.googleapis.com/auth/gmail.send` — enviar correo
- `https://www.googleapis.com/auth/gmail.readonly` — leer hilos y adjuntos
- `https://www.googleapis.com/auth/gmail.modify` — marcar mensajes como leídos

Forms y Calendar están habilitados en el proyecto GCP pero no se usan ni se piden.

### 4.2 Configuración de Google Cloud

Proyecto `mesa-de-control-504618`, dentro de la organización `1029986595993`. Que el proyecto pertenezca a una organización es la razón por la que la pantalla de consentimiento se configura como **Interna**: sin proceso de verificación de Google, sin advertencia de aplicación no verificada y sin la expiración de refresh token a los 7 días que sufren las apps externas en modo prueba. Este punto es una precondición del diseño: si el consentimiento tuviera que ser externo, la arquitectura de credenciales tendría que replantearse.

APIs ya habilitadas: `sheets`, `drive`, `gmail`, `forms`, `calendar-json`, más `cloudresourcemanager` habilitada durante el análisis.

La cuenta de servicio `cuenta-de-servicio@mesa-de-control-504618.iam.gserviceaccount.com` (rol propietario) se usa para administrar el proyecto con gcloud y, en desarrollo local, para leer la hoja de pruebas. **No es la credencial de la aplicación en producción.**

La creación de la pantalla de consentimiento y del cliente OAuth de tipo aplicación web se realiza en la consola de Google Cloud: no existe API pública para crearlos. Los pasos exactos se documentan y ejecuta el administrador; todo lo demás (habilitar APIs, verificar configuración, obtener y cifrar el token) se automatiza.

---

## 5. Lectura del Sheet

### 5.1 Mapeador de esquema

Lee la fila 1 y construye el mapa `campo lógico → lista ordenada de columnas`, por nombre de encabezado y nunca por posición (RNF-11). La resolución de un campo es "el primer valor no vacío recorriendo su lista de columnas". Los 10 encabezados vacíos de la hoja se ignoran.

El mapa se construye por convención sobre el texto del encabezado (normalizado sin acentos, minúsculas, sin espacios múltiples) más una tabla de sinónimos versionada en el repositorio para los casos que la convención no cubre. Se cachea por proceso y se reconstruye al pulsar Actualizar. Si un campo obligatorio (marca temporal, correo del solicitante) no se resuelve en ninguna columna, la app lo reporta como advertencia visible en Ajustes en lugar de fallar en silencio.

### 5.2 Lector de casos

Una sola petición por carga trae el rango de columnas necesarias desde la fila 2 de 2026 en adelante; no una petición por caso. Construye para cada fila: identidad (fila), folio, marca temporal, tipo de trámite, solicitante, correo, agencia y su clasificación, línea de negocio, motivo, adjuntos, y los valores actuales de seguimiento. Descarta las filas sin marca temporal, que son las pre-arrastradas.

Los campos vacíos no se incluyen: la vista de caso muestra exactamente lo que trae dato (RF-03).

### 5.3 Adjuntos

Toda URL de Drive se presenta como enlace navegable con el nombre del campo que la contiene (RF-04). Nunca se muestra como texto plano. Si Drive niega el acceso a un archivo, el enlace se conserva con la nota de que requiere permiso: no se oculta información del caso.

### 5.4 Cola de casos

Orden **FIFO**: el caso vivo más antiguo primero, los que llegan se forman al final. Un caso es vivo mientras `KA` (Estatus Final) no sea terminal — `Concluida` o `Improcedente`. Los cerrados salen de la cola y se consultan con el buscador y los filtros (RF-02: folio, solicitante, agencia, tipo de trámite, estatus, responsable).

El semáforo es un indicador visual calculado a partir de los días hábiles entre la marca temporal y hoy: verde hasta 2 días, ámbar de 3 a 5, rojo a partir de 6. Los umbrales viven en un solo lugar del código y quedan sujetos a validación con Keynor y Norma, que son quienes conocen el SLA real del área. No se captura ni se escribe en la hoja.

Los casos sin folio aparecen en la cola con la marca "sin folio" en lugar de quedar ocultos (RF-14).

---

## 6. Escritura y concurrencia

### 6.1 Escritor de seguimiento

Única pieza con permiso de escritura. Opera con lista blanca: `JZ, KA, KB, KD, KE, KF, KG, KH, KI, KJ`. Cualquier intento de escribir fuera de ese conjunto lanza error antes de llamar a Google. Están explícitamente prohibidas las columnas del formulario (`A`–`JX`), las fórmulas (`KC`, `KO`–`KU`), los duplicados residuales (`KL`–`KN`) y `JY`, salvo el caso de captura de folio faltante de 6.3.

Antes de escribir revalida que la fila siga siendo el mismo caso comparando marca temporal y folio contra lo que se leyó al abrir. Si no coinciden, aborta y muestra qué cambió. Esto cubre el hueco que el bloqueo interno no puede cerrar: la edición hecha directamente en la hoja, riesgo que el PRD asume conscientemente.

La escritura es una sola llamada por lote de celdas de la fila, para no dejar escrituras parciales (RNF-06).

### 6.2 Guardado explícito

El guardado ocurre solo al confirmar (RF-06). El flujo es: el usuario captura, pulsa Guardar, ve el diff campo por campo (`Estatus final: Tramite → Concluida`), confirma, y entonces la app en una sola transacción lógica escribe las celdas, registra la bitácora (RNF-04) y emite el evento `caso_guardado`.

Sellado automático de fechas:

- Al enviar el primer correo del caso, `KB` (fecha y hora de respuesta por correo) se escribe con el momento del envío.
- Al guardar con `KA` terminal, `KD` (fecha y hora de atención final) se escribe con el momento del guardado.

Ambas son columnas que hoy se teclean a mano y de las que depende el cálculo de SLA de la hoja.

Si la escritura falla, la captura permanece en pantalla, el error se explica en español y hay botón de reintentar (RNF-05).

### 6.3 Folio faltante

Si un caso no tiene folio y el usuario intenta abrir la conversación, la app pide capturarlo y lo escribe en `JY`. La app no genera folios por su cuenta: el número lo teclea la persona. La captura queda en bitácora con tipo `folio_capturado`. Es la única circunstancia en que se escribe `JY`.

### 6.4 Bloqueo de caso

Se adquiere al abrir el caso (RF-07). Si otro usuario lo tiene, el caso se muestra en modo lectura con quién lo tiene y desde cuándo, y con el botón **Forzar liberación** disponible para cualquier usuario; el forzado se registra en bitácora con tipo `bloqueo_forzado`. El dueño libera con **Liberar** o al salir del caso. El bloqueo no expira por tiempo, por decisión explícita: el forzado manual es el mecanismo de recuperación.

Un latido mientras la pestaña está abierta actualiza `ultimo_latido`, que sirve para mostrar "sin actividad desde las 10:32" y ayudar a decidir si conviene forzar.

---

## 7. Conversación por correo

### 7.1 Identificación del hilo

El asunto normalizado es `Seguimiento de Caso | Gplus Seguros | <folio>`. La app siempre abre la conversación (RF-08): el usuario no teclea destinatario ni asunto. El destinatario se toma del correo del solicitante resuelto del formulario.

Al enviar, el `threadId` se guarda en `casos_hilo` (RF-09). La recuperación del hilo usa ese identificador y, como respaldo, una búsqueda por el asunto exacto. El respaldo importa: si el solicitante responde creando un correo nuevo pero conservando el asunto, el mensaje aterriza igual en el chat del caso. Si responde con asunto distinto, ese mensaje no llega al caso, riesgo ya reconocido en el PRD.

No hay notificación push ni polling: el hilo se lee al abrir el caso y con el botón Actualizar.

### 7.2 Presentación

El chat muestra los mensajes en orden cronológico (RF-10), con burbujas alineadas según quién escribió, autor y hora. **El contenido se muestra como texto plano**: la app despoja el HTML, descarta las citas del mensaje anterior y las firmas, y deja solo lo que la persona escribió en ese mensaje.

### 7.3 Envío

Los correos salen **en HTML profesional**: encabezado con la identidad Gplus Seguros – Mesa de Control, cuerpo formateado y firma que indica quién atiende el caso (`Atiende: Keynor Rivas`). El remitente es `Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>`, de modo que las respuestas llegan al buzón de la mesa y no a un buzón personal.

Cada correo se envía con su alternativa en texto plano en el mismo MIME, por compatibilidad.

Responder dentro del hilo conserva asunto y destinatarios (RF-11) e incluye los encabezados `In-Reply-To` y `References` para que los clientes de correo del solicitante lo agrupen correctamente.

### 7.4 Plantillas

Una plantilla por tipo de trámite, guardada en `plantillas_correo` y editable desde Ajustes sin desplegar código. Variables disponibles: `{{solicitante}}`, `{{folio}}`, `{{agencia}}`, `{{tramite}}`, `{{atiende}}`. El desarrollo arranca con borradores; Keynor los corrige él mismo desde la app. Al redactar, el usuario elige plantilla, la app precarga el cuerpo y él lo ajusta libremente antes de enviar.

### 7.5 Adjuntos

**Entrantes**: cada mensaje lista sus adjuntos como elementos descargables. La descarga pasa por una ruta de la propia app que valida la sesión, pide el adjunto a Gmail con la credencial de la mesa y lo entrega al navegador. Los archivos no se almacenan.

**Salientes**: el archivo viaja del navegador a la Server Action y de ahí al MIME del correo, sin almacenamiento intermedio. El límite de Gmail (25 MB por correo) se valida antes de intentar el envío, avisando el tamaño concreto.

---

## 8. Bitácora, eventos y observabilidad

**Bitácora de cambios** (RNF-04): cada guardado registra fila, folio, usuario, campo, valor anterior, valor nuevo y fecha. También se registran los forzados de bloqueo y las capturas de folio. Es consultable desde el caso y, completa, desde Ajustes.

**Bitácora de observaciones** (RF-12): las notas internas se acumulan en `KJ` sin sobrescribir las anteriores, con autor y fecha al frente de cada entrada, que es el uso real que la mesa le da hoy a ese campo.

**Eventos de BI** (sección 11 del PRD): `caso_visualizado`, `caso_tomado`, `conversacion_iniciada`, `respuesta_enviada`, `caso_guardado`, `caso_cerrado`, `importacion_solicitada`. Cada uno con fecha, usuario, fila, folio, tipo de trámite, estatus resultante y motivo cuando aplique. Se escriben en `eventos_bi` como insumo de la Fase 2.

**Observabilidad** (RNF-10): se registran las operaciones contra las APIs de Google y sus fallos. Si el consentimiento de la mesa se revoca o expira, la app muestra un banner en todas las pantallas y bloquea las operaciones sobre Sheet y correo hasta que el admin reautorice; el enlace de reautorización está en Ajustes.

---

## 9. Errores y límites

| Situación | Comportamiento |
| --- | --- |
| Consentimiento revocado o expirado | Banner global, operaciones de Google bloqueadas, enlace de reautorización para el admin |
| Cuota de la API agotada | Reintento con espera creciente y aviso claro. Mitigación de diseño: una lectura por carga, por lote, nunca una llamada por caso (RNF-08) |
| Escritura al Sheet falla | La captura no se pierde, error en español, botón de reintentar |
| La fila cambió desde que se abrió el caso | Escritura abortada, se muestra qué cambió y quién |
| Caso tomado por otro | Modo lectura con dueño visible y opción de forzar |
| Adjunto mayor a 25 MB | Aviso previo al envío con el tamaño concreto |
| Drive niega un adjunto | Enlace visible con nota de permiso requerido |
| Campo lógico no resuelto en el esquema | Advertencia visible en Ajustes; la app sigue operando con lo que sí resolvió |

---

## 10. Desviaciones respecto al PRD v0.1

| Punto del PRD | Decisión de este diseño | Razón |
| --- | --- | --- |
| RF-01: bandeja ordenada de más reciente a más antiguo | **Una sola vista FIFO**: el caso vivo más antiguo primero | Decisión del solicitante: la vista es una cola de trabajo y evita que un caso se añeje. El historial se alcanza con buscador y filtros |
| RNF-03: cuenta de servicio para Sheets y Drive | **Todo por OAuth de `mesadecontrol@`**; la cuenta de servicio solo administra GCP y lee la hoja de pruebas en desarrollo | Decisión del solicitante: una sola identidad operativa, con consentimiento aprobado por el administrador |
| Captura de semáforo | **No se captura**: es indicador calculado por días de espera | No existe columna de semáforo en la hoja; lo más cercano son las fórmulas de SLA |
| Supuesto "el folio identifica sin ambigüedad cada caso" | **Falso en la hoja real.** La identidad interna es el número de fila; el folio es dato de negocio | Verificado: hay folios arrastrados sin petición y peticiones sin folio |
| Bloqueo con expiración por tiempo (pregunta abierta) | **Sin expiración**; liberación manual por el dueño o forzada por cualquiera, registrada en bitácora | Decisión del solicitante |
| `KB` y `KD` capturadas a mano | **Selladas por la app** al enviar el primer correo y al cerrar el caso | Reducen captura y mejoran la exactitud del SLA que ya calcula la hoja |
| Buzón compartido por definir (pregunta abierta) | **Resuelto**: `mesadecontrol@gplusseguros.mx` | Ya creado por el solicitante |
| Reactividad a filas nuevas | **Lectura al cargar más botón Actualizar**, sin polling ni webhook | Decisión del solicitante; él añadirá después un aviso al equipo cuando entre una fila |

---

## 11. Etapas de entrega

Cada etapa cierra con verificación del solicitante antes de continuar.

| Etapa | Contenido | Verificación |
| --- | --- | --- |
| 0 · Cimientos | Scaffold Next.js con pnpm, repo conectado a Vercel, Supabase provisionado, esquema Drizzle, Auth.js con allowlist, pantalla de consentimiento Interna y cliente OAuth, autorización de la mesa, token cifrado | Los cinco correos entran, uno ajeno es rechazado, Ajustes muestra el consentimiento activo |
| 1 · Lectura y cola | Mapeador de esquema, lector de casos, cola FIFO, buscador, filtros, semáforo, botón Actualizar | La cola lista los casos vivos reales de 2026, el folio 7000 se encuentra por búsqueda, el caso de la fila 7178 aparece marcado sin folio |
| 2 · Caso y escritura | Vista de caso con campos con dato, adjuntos clicables, catálogos desde validación, bloqueo, guardado con diff, bitácora, sellado de `KB` y `KD`, revalidación de fila | Un cambio guardado aparece en la celda correcta de la hoja de pruebas, sin que nada más se mueva |
| 3 · Conversación | Hilo por asunto normalizado, envío HTML, chat en texto plano, adjuntos en ambos sentidos, plantillas editables, captura de folio faltante | Correo enviado desde la app, respondido desde Gmail con archivo, visible en el chat con el adjunto descargable |
| 4 · Producción | Los 7 eventos de BI, importación bajo demanda, afinado de errores, apuntar a la hoja productiva, despliegue a producción, `PLAN.md` y `AVANCE.md` al repo de PRDs | Keynor y Paty trabajan una jornada real en la herramienta |

Las etapas 0 y 1 no escriben en ningún destino. La primera escritura ocurre en la etapa 2, sobre una **copia de la hoja** creada para desarrollo; el cambio a la hoja productiva es una variable de entorno y ocurre en la etapa 4.

---

## 12. Pruebas

Se escriben antes del código en las tres piezas donde un error es caro:

1. **Mapeador de esquema**, contra un fixture con los 307 encabezados reales ya extraídos: que `tipoDeTramite`, `correoSolicitante` y `agencia` resuelvan al valor correcto entre columnas equivalentes, y que agregar o mover una columna del formulario no rompa la resolución.
2. **Escritor de seguimiento**: que escribir en cualquier columna fuera de la lista blanca lance error antes de llamar a Google, y que la revalidación de fila aborte cuando la marca temporal no coincide.
3. **Parseo de correo**: que un mensaje HTML de Gmail con citas anidadas y firma se convierta en el texto plano esperado, y que la composición MIME con adjunto sea válida.

Las APIs de Google se simulan; ninguna prueba automatizada escribe en una hoja real ni envía correo. Cada etapa cierra además con verificación manual sobre el despliegue.

---

## 13. Fuera de alcance

Se mantiene lo declarado en la sección 6 del PRD: reporteo automatizado (Fase 2), peticiones de siniestros (Fase 3), integración con Sigma, WhatsApp, checklist de documentos obligatorios, portal para agencias, migración del histórico anterior a 2026 y cualquier cambio al formulario o a la estructura de la hoja.

Se añade a lo fuera de alcance, por decisión de este diseño: notificaciones push o en vivo (Gmail watch con Pub/Sub, polling automático, webhook de Apps Script sobre el Sheet). La app lee al cargar y con el botón Actualizar.

---

## 14. Dependencias del solicitante

| Qué | Cuándo se necesita |
| --- | --- |
| Copia de la hoja para desarrollo, compartida con `mesadecontrol@` y con la cuenta de servicio, y su URL | Antes de la etapa 2 |
| Crear la pantalla de consentimiento Interna y el cliente OAuth web en la consola de GCP, siguiendo los pasos documentados | Etapa 0 |
| Aprobar el consentimiento con `mesadecontrol@` | Etapa 0 |
| Corregir los borradores de plantillas por tipo de trámite | Etapa 3 |
| Autorizar el cambio a la hoja productiva | Etapa 4 |
