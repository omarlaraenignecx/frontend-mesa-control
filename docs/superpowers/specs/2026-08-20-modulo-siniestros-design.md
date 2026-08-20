# Módulo de Atención a Siniestros — Diseño

**Fecha:** 20 de agosto de 2026
**Solicita:** José Juan Mendoza Díaz (`jose.mendoza@gplusseguros.mx`), ejecutivo de siniestros
**Autoriza el alcance:** Omar Lara

## 1. Qué se pide

Un módulo dedicado a las peticiones que llegan al formulario con motivo de un siniestro,
adyacente a la Mesa de Control y dentro de la misma aplicación:

1. Un listado propio, con los mismos filtros que la fila de la mesa, encabezado
   **Atención a Siniestros** en lugar de **Mesa de Control**.
2. Una vista del caso igual a la de la mesa, salvo el chat por correo: los mensajes
   salen del buzón de José, no de `mesadecontrol@gplusseguros.mx`. En Ajustes hay un
   apartado de **Permisos para Módulo de Siniestros** donde José —y quien más lo
   necesite, se anticipa a Norma Zacarías— autoriza su cuenta de Gmail, con la lista de
   quién ya la autorizó.
3. Un correo con presentación distinta, más de atención al cliente, que cierra con los
   datos del ejecutivo que atiende: teléfono 55 4884 2862, puesto Ejecutivo de
   siniestros, nombre Jose Juan Mendoza Diaz, correo `jose.mendoza@gplusseguros.mx`.
4. Los mismos mecanismos de alertas y notificaciones que ya tiene la mesa.

## 2. Lo que dice la hoja

Medido el 20 de agosto de 2026 sobre la copia de la hoja, que es copia de la productiva.

**Los siniestros ya llegan al mismo formulario y hay una columna que los marca.** La
pregunta "Áreas de GPLUS SEGUROS" tiene tres valores: `Mesa de control` (5,524
respuestas), `Siniestros` (250) e `Ingresos y Egresos` (13). Aparece repetida en varios
bloques del formulario: `BE`, `CK`, `CU`, `FD`, `HM` —`CK` con el encabezado
`Gplus Seguros` en lugar de `Áreas de GPLUS SEGUROS:`—.

**El área es la regla completa.** Cruzando el área contra la rama de preguntas propias
del ramo (`¿Tipo de siniestro?`):

| | Filas |
|---|---|
| Área `Siniestros` **y** rama llena | 265 |
| Área `Siniestros` **sin** rama | 3 |
| Rama llena **sin** área `Siniestros` | **0** |

Las 3 sin rama son quejas contra la atención de la aseguradora, que son siniestros
legítimos. Ninguna fila trae la rama sin el área, así que basta el área y no hace falta
ninguna heurística de respaldo.

**Son pocos y ya los atiende José.** En 2026 hay 8 casos de siniestros contra 1,420 de
la mesa: enero 1, marzo 4, mayo 1, julio 1, agosto 1. Los 8 tienen `KE = "José Juan"`.

**Ningún siniestro trae tipo de trámite.** Los 8 de 2026 tienen vacías las columnas de
`Tipo de trámite`. Traen en cambio:

- `¿Tipo de siniestro?` (`C`, `G`, `EN`, `GW`, `JF`): Daño parcial (187), Pérdida total
  (55), Asistencia vial (20), Asistencia legal (3).
- `Tipo de atención:` (`BM`, `EM`, `GV`, `JE`, `JS`): Seguimiento a siniestro (184),
  Queja a la atención de la aseguradora (3).
- `Número de siniestro` (`BH`), `Número de Póliza` (`K`), teléfono y nombre del cliente
  (`BJ`, `BK`), aseguradora (`D`).

Esto tiene dos consecuencias de diseño: la plantilla de correo, que hoy se elige por tipo
de trámite, necesita una propia; y el filtro de tipo de trámite del listado saldría
siempre vacío.

**El folio es el mismo.** Los siniestros de 2026 tienen folio de la serie única de la
hoja (`JY`): 6426, 6708, 6953, 6967. La generación de folios no se toca ni se separa.

**Las columnas de seguimiento son las mismas** (`JZ`, `KA`, `KE`, `KG`, `KH`, `KJ`…), así
que la vista del caso y su escritura se reusan sin cambios.

## 3. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Alcance | Rutas nuevas en la misma aplicación | Comparte base, lectura de la hoja, sesión, notificaciones y avisos de escritorio. Un despliegue aparte duplicaría todo eso y cada corrección futura habría que hacerla dos veces. |
| ¿La mesa sigue viendo los siniestros? | Sí, su fila no cambia | Decisión del área. El listado de siniestros es una vista adicional, no una mudanza. |
| ¿Quién entra al módulo? | Cualquier usuario autorizado del sistema | Decisión del área. El apartado de permisos de Ajustes es entonces solo para la autorización de Gmail, no para controlar el acceso. |
| Cuenta que envía | Una sola cuenta activa del módulo | El remitente y la firma nunca se contradicen, y todas las respuestas de un caso caen en el mismo buzón, así que el chat del caso muestra la conversación completa. |
| Firma del correo | Ficha por ejecutivo, con los datos de José cargados | Cuando Norma autorice, se llena su ficha desde la aplicación sin tocar código. |
| Plantillas | Una sola, `Siniestros` | Con 8 casos al año, cuatro plantillas serían cuatro textos que mantener sin ganancia. Se agregan desde Ajustes si hacen falta. |
| Avisos | Cada campanita lo suyo, la de la mesa sigue mostrando todo | Coherente con que la mesa siga viendo los casos. José no recibe un timbre por cada una de las ~1,400 peticiones al año de la mesa. |

## 4. Cómo se reconoce un siniestro

Se agrega el campo lógico `area` a `sheet-schema.ts`, con los alias normalizados
`areas de gplus seguros` y `gplus seguros`. Cae del lado del formulario, no del
seguimiento, así que el mapeador le asigna el grupo de columnas equivalentes `BE`, `CK`,
`CU`, `FD`, `HM` y el lector toma el primer valor no vacío, igual que con cualquier otro
campo replicado del formulario.

Se agregan también tres campos lógicos que el módulo necesita y que hoy caen en "campos
adicionales": `tipoSiniestro`, `tipoAtencion` y `numeroSiniestro`. Al mapearlos dejan de
aparecer como campos adicionales en la vista del caso y pasan a tener su lugar propio.

Sobre eso, una función pura:

```ts
// src/lib/casos/area.ts
export const AREA_SINIESTROS = 'Siniestros'
export function esSiniestro(caso: Pick<Caso, 'area'>): boolean
```

Compara normalizando acentos y mayúsculas, como el resto del código que compara texto de
la hoja.

**Nada de esto escribe en la hoja.** Son nombres y lectura. Las columnas del formulario
siguen protegidas y la aplicación sigue escribiendo únicamente en la franja de
seguimiento y en `JY` cuando está vacía.

## 5. Estructura del sitio

Un módulo se declara en un archivo pequeño y el resto de la interfaz lo recibe como
parámetro:

```ts
// src/lib/modulos/modulo.ts
export type Modulo = 'mesa' | 'siniestros'
export type ConfigModulo = {
  clave: Modulo
  titulo: string                        // 'Mesa de Control' | 'Atención a Siniestros'
  rutaLista: string                     // '/fila' | '/siniestros'
  rutaCaso: (fila: number) => string    // '/caso/7250' | '/siniestros/caso/7250'
  incluye: (caso: Caso) => boolean      // mesa: todos; siniestros: esSiniestro
}
```

| Ruta | Qué es | Quién entra |
|---|---|---|
| `/fila`, `/caso/[fila]` | Mesa de Control, sin cambios | cualquier usuario autorizado |
| `/siniestros` | Listado, encabezado **Atención a Siniestros** | cualquier usuario autorizado |
| `/siniestros/caso/[fila]` | Vista del caso con el chat por la cuenta de siniestros | cualquier usuario autorizado |
| `/siniestros/ajustes` | Permisos de Gmail, fichas y plantilla del módulo | cualquier usuario autorizado |

### Redirección desde la vista del caso de la mesa

Como la mesa sigue listando los casos de siniestros, alguien puede abrir uno por
`/caso/7250` y responder desde ahí: el correo saldría de `mesadecontrol@`, que es
exactamente lo que el área no quiere. Por eso `/caso/[fila]` comprueba el área del caso y
redirige a `/siniestros/caso/[fila]` cuando es de siniestros. El caso se sigue viendo y se
sigue abriendo desde la fila de la mesa; solo se atiende en un lugar.

La redirección va en la página del caso de la mesa y no en un middleware: la página ya
carga el caso para renderizarlo, así que decidir ahí no cuesta una lectura extra, y un
middleware no tiene la hoja a la mano.

## 6. Listado de siniestros

Reusa `cargarCola()` —la lectura de la hoja ya cacheada con la etiqueta `casos`—, así que
no agrega ni una llamada a Google. Sobre esos casos aplica `incluye` del módulo y después
los mismos `filtrar()` y `ordenarRecientes()` que la mesa, con las mismas tres vistas
(fila de trabajo, rezago, todos los pendientes) y la misma ventana de 30 días.

Filtros: búsqueda por texto, estatus final, responsable y agencia, idénticos. El de **tipo
de trámite** se sustituye por **tipo de siniestro**, porque ninguno de los 268 casos
históricos trae tipo de trámite y ese selector saldría siempre vacío. Para que el
sustituto no sea un caso especial escondido, `Filtros` y `opcionesDeFiltro` reciben qué
campo usar como clasificación, y cada módulo pasa el suyo.

Columnas de la tabla: las mismas, con "Trámite" sustituido por "Tipo de siniestro" y una
columna más de "Número de siniestro". El semáforo, la insignia de correo por renglón, el
botón de actualizar, la auto-actualización y el aviso de generar folios se reusan tal cual.

## 7. La cuenta de Gmail del módulo

### Almacenamiento

Tabla nueva, una fila por ejecutivo de siniestros:

```
credenciales_siniestros
  correo                  text primary key   -- el buzón autorizado, según Google
  refresh_token_cifrado   text not null
  scopes                  jsonb not null
  autorizado_por          text not null      -- quién estaba en sesión al autorizar
  autorizado_en           timestamptz not null default now()
  ultimo_uso              timestamptz
  ultimo_error            text
  nombre                  text not null      -- ficha de la firma
  puesto                  text not null
  telefono                text not null
```

La ficha vive aquí y no en otra tabla porque es de la cuenta: quien envía es quien firma,
y separarlas permitiría que se contradijeran.

Cuál es la cuenta que envía se guarda en `ajustes_app`, bajo la clave
`siniestros:cuenta-activa`. Así el sistema no puede tener dos cuentas activas: no es un
booleano por fila que haya que mantener consistente, es un solo valor.

El cifrado del refresh token es el mismo `lib/crypto/secreto.ts` con la misma
`CREDENCIAL_ENC_KEY`; no se agrega ninguna variable de entorno.

### Permisos que se piden

Solo correo: `gmail.send`, `gmail.readonly`, `gmail.modify`. **No** se piden
`spreadsheets` ni Drive: la hoja y los archivos siguen pasando por la credencial de
`mesadecontrol@`, que ya funciona y ya está autorizada. José concede lo mínimo para que su
correo funcione.

### Flujo de autorización

`GET /api/siniestros/autorizar` arma el consentimiento de Google con `access_type=offline`
y `prompt=consent`, igual que el de la mesa, pero con `login_hint` en el correo del
usuario en sesión. `GET /api/siniestros/callback` canjea el código y, **antes de guardar,
le pregunta a Google qué buzón se autorizó** (`gmail/v1/users/me/profile`), valida que sea
del dominio `gplusseguros.mx` y guarda la credencial con ese correo como llave.

Preguntarle a Google no es un detalle: sin eso, la credencial se guardaría a nombre de
quien está en sesión, y una persona que otorgue el consentimiento con otra cuenta de
Google quedaría registrada como dueña de un buzón que no es el suyo. Si el buzón
autorizado no es del dominio, no se guarda y se explica por qué.

La primera vez que se guarda una cuenta y no hay ninguna activa, esa queda activa.

`accessTokenDeSiniestros()` es la única puerta por la que el módulo obtiene acceso: lee la
cuenta activa, descifra, canjea el refresh token con `intercambiarRefreshToken()` —que ya
existe y ya recibe su `fetch` por parámetro— y registra uso o error en la fila.

### `/siniestros/ajustes`

Abierta a cualquier usuario autorizado, no solo al admin. Hoy `/ajustes` es exclusiva de
administradores, y exigir que José sea admin de la mesa entera para autorizar su propio
correo le daría además el botón de reautorizar el Google de la mesa y la edición de sus
plantillas.

Contiene:

- **Permisos para Módulo de Siniestros**: explicación de qué se concede y para qué, botón
  para autorizar la propia cuenta, y la lista de cuentas autorizadas con su correo, quién
  la autorizó, cuándo, si tiene permisos faltantes y cuál está activa.
- **Ficha del ejecutivo** por cuenta: nombre, puesto y teléfono.
- **Plantilla de siniestros**, con el mismo editor que ya usan las plantillas de la mesa.

Reglas de quién puede qué: autorizar y editar la ficha, la propia cuenta —o cualquiera si
es admin—. Designar la cuenta activa, cualquier usuario autorizado. Quitar la cuenta de
alguien más, solo admin.

En `/ajustes` de la mesa queda una tarjeta con el estado del módulo y un enlace aquí, para
que el administrador vea de un golpe si el correo de siniestros está en pie.

### Lo que José debe saber antes de autorizar

Para que las respuestas de las agencias vuelvan al chat del caso, la aplicación consulta
su bandeja de entrada: lista los identificadores de los correos recientes para saber
cuáles pertenecen a un caso y abre el remitente **solo de esos**. No lee el contenido de
su correo personal, pero sí pasa por su bandeja. Es el precio de que la conversación viva
en su cuenta; la única alternativa sería que las respuestas llegaran a `mesadecontrol@`,
que es lo contrario de lo pedido. Queda escrito en la pantalla de permisos, antes del
botón, no en un pie de página.

## 8. El correo de siniestros

`renderCorreo()` pasa a recibir una **marca**: título de la banda, color y bloque de
firma.

```ts
export type MarcaCorreo = {
  titulo: string        // 'Mesa de Control' | 'Atención a Siniestros'
  color: string
  firma: { nombre: string; puesto: string | null; telefono: string | null; correo: string }
}
```

La Mesa de Control conserva su marca actual exactamente como está —misma banda azul
`#005ba9`, mismo pie— para que no haya un solo cambio visible en los correos que ya salen
a diario. Siniestros trae la suya, más sobria y de atención al cliente, cerrando con la
ficha del ejecutivo:

```
Jose Juan Mendoza Diaz
Ejecutivo de siniestros
TEL 55 4884 2862
jose.mendoza@gplusseguros.mx
```

Los datos salen de la ficha de la cuenta activa, no del código.

Se conserva el aviso de "Responde en este mismo correo" que ya llevan los correos de la
mesa, por la misma razón por la que existe: es lo que mantiene la respuesta dentro del
hilo del caso.

`enviarCorreo()` deja de tomar el remitente de una constante del módulo y lo recibe en el
mensaje, porque ahora hay dos. `DepsGmail.correoMesa` se renombra a `correoBuzon`: el
campo sirve para reconocer los mensajes propios dentro del hilo y ya no siempre es el de
la mesa.

### Plantilla

Una plantilla `Siniestros` en la tabla que ya existe, sembrada con un borrador que José
corrige desde la aplicación. Variables: `{{solicitante}}`, `{{folio}}`, `{{agencia}}`,
`{{cliente}}`, `{{aseguradora}}`, `{{numeroSiniestro}}`, `{{poliza}}`,
`{{tipoSiniestro}}`, `{{atiende}}`.

Como los siniestros no traen tipo de trámite, la búsqueda de plantilla por trámite no les
sirve: el módulo pide su plantilla por clave.

### Hilos

`casos_hilo` gana una columna `modulo` con omisión `mesa`. Un `threadId` solo existe
dentro del buzón que lo emitió, así que sin la columna la ruta de avisos de siniestros
tendría que buscar hilos de la mesa en el buzón de José. Es aditiva: las filas existentes
quedan como `mesa`, que es lo que son.

## 9. Alertas y notificaciones

`notificaciones` gana una columna `modulo` con omisión `mesa`.

- **Peticiones nuevas**: la ruta `/api/notificaciones/casos-nuevos` ya lee la hoja
  completa, así que clasifica cada caso nuevo por su área y sella el módulo sin trabajo
  extra. Una sola ruta sigue sirviendo a los dos módulos.
- **Correos recibidos**: hace falta una ruta nueva, `/api/notificaciones/siniestros-correos`,
  que revisa el buzón de la cuenta activa igual que la actual revisa el de la mesa, mapea
  mensaje a caso por el folio del hilo y guarda los avisos con `modulo = 'siniestros'`. La
  ruta existente restringe su consulta a los hilos de la mesa.
- **Sondeo del navegador**: `/api/notificaciones` acepta el módulo y filtra. Sin módulo
  devuelve todo, que es lo que necesita la campanita de la mesa; con
  `?modulo=siniestros` devuelve solo lo del ramo.
- **Interfaz**: `ProveedorNotificaciones` recibe el módulo y la ruta del caso; la
  campanita, el panel, los avisos de escritorio y la insignia por renglón se reusan sin
  cambios de comportamiento. El destino de un aviso de escritorio se arma con la ruta del
  módulo, así que un aviso de siniestros abre el caso en su módulo.
- **n8n**: un flujo nuevo que despierte la ruta de correos de siniestros cada minuto, con
  el mismo secreto `NOTIFICACIONES_SECRET` y la misma forma que los dos que ya existen. No
  hay variables de entorno nuevas.

El timbre, el permiso del navegador, el tope de avisos, el resumen cuando llegan muchos, la
invitación a activar y el aviso de audio bloqueado se reusan enteros.

## 10. Etapas

| # | Etapa | Entrega | Depende de |
|---|---|---|---|
| 1 | Cimientos | `area`, `tipoSiniestro`, `tipoAtencion`, `numeroSiniestro` en el esquema y en `Caso`; `esSiniestro`; configuración de módulos | — |
| 2 | Listado | `/siniestros` con filtros y vistas; redirección desde `/caso/[fila]` | 1 |
| 3 | Cuenta de Gmail | `credenciales_siniestros`, rutas OAuth, `accessTokenDeSiniestros`, `/siniestros/ajustes` | 1 |
| 4 | Caso y correo | `/siniestros/caso/[fila]`, marca y firma del correo, plantilla del ramo, `casos_hilo.modulo` | 2, 3 |
| 5 | Avisos | `notificaciones.modulo`, ruta de correos de siniestros, campanita y avisos por módulo | 4 |
| 6 | Prueba y producción | Petición de siniestro simulada en la copia, correo real de prueba, despliegue, flujo de n8n, documentación | 5 |

Las etapas 1 y 2 no dependen de que nadie autorice nada. La 3 necesita a José disponible
para dar el consentimiento con su cuenta.

## 11. Pruebas

Se sigue el patrón del repositorio: lógica pura en módulos sin DOM ni red, probada
directamente; componentes de cliente verificados leyendo su código fuente con el ayudante
`soloCodigo()`; dependencias de Google inyectadas por parámetro para probar sin red.

Lo que se prueba en cada etapa:

1. El mapeador reconoce `area` en las cinco columnas y en sus dos encabezados distintos;
   `esSiniestro` normaliza acentos y mayúsculas; el área no se confunde con una columna de
   la franja de seguimiento; los campos nuevos dejan de aparecer como campos adicionales.
2. El listado incluye los casos de área `Siniestros` y excluye los demás; los filtros y
   las tres vistas se comportan igual que en la mesa; la clasificación configurable
   devuelve tipos de siniestro y no tipos de trámite.
3. El callback rechaza un buzón de otro dominio; guarda la credencial a nombre del buzón
   que Google reporta y no del usuario en sesión; la primera cuenta queda activa; los
   permisos faltantes se detectan como en la mesa.
4. El correo de siniestros lleva la firma de la cuenta activa y el de la mesa no cambia;
   el remitente sale del mensaje; la plantilla del ramo se busca por clave y no por
   trámite.
5. Un aviso se guarda con su módulo; el sondeo filtra por módulo y sin módulo devuelve
   todo; el destino de un aviso de escritorio usa la ruta del módulo.

## 12. Fuera de alcance

- Un formulario propio de siniestros. Las peticiones seguirán llegando por el formulario
  actual, marcadas con el área.
- Separar la serie de folios. Sigue siendo una sola para toda la hoja.
- Quitar los casos de siniestros de la fila de la mesa. Es decisión del área que sigan
  ahí.
- Enviar desde el buzón de cada persona que escribe. El módulo tiene una cuenta activa.
- Cualquier cambio a las columnas del formulario o a la estructura de la hoja.
