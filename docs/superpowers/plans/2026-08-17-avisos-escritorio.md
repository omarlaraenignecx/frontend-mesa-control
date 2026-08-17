# Avisos de escritorio (notificaciones del navegador)

**Meta:** que todo lo que llega a la campanita salga además como notificación del
sistema operativo, con el usuario decidiendo si acepta o niega el permiso.

**Arquitectura:** el sondeo que ya existe es la única fuente del evento. El
proveedor de notificaciones ya avisa a quien se suscriba con `alLlegar`; un
componente nuevo se suscribe ahí y llama a la API `Notification` del navegador.
No hay nada nuevo del lado del servidor: ni rutas, ni tablas, ni variables de
entorno, ni flujos de n8n.

## Decisiones

1. **Sin service worker ni Web Push.** La notificación se emite desde la pestaña
   abierta. El usuario dijo que su área tiene el sitio abierto todo el día, y ese
   es exactamente el caso que cubre la API directa. Con Web Push llegarían avisos
   incluso con el navegador cerrado, pero eso exige claves VAPID, un service
   worker, una tabla de suscripciones por dispositivo y un emisor en el servidor:
   mucha maquinaria para una ganancia que aquí no se necesita. Queda anotado como
   el camino a seguir si algún día se pide.

2. **El permiso se pide con un clic, nunca al cargar la página.** Chrome ignora
   `Notification.requestPermission()` sin gesto del usuario, y los navegadores
   castigan a los sitios que piden permisos al entrar. Hay dos lugares para
   activarlo: un bloque en el panel de la campanita y una barra descartable en la
   vista de la fila.

3. **`tag` por id de notificación.** Quien tenga dos pestañas del sitio abiertas
   recibiría dos veces el mismo aviso; con el mismo `tag`, el navegador reemplaza
   en lugar de apilar y solo se ve uno.

4. **Resumen cuando llegan varias de golpe.** Más de tres avisos en un mismo
   ciclo de sondeo se juntan en uno solo ("Llegaron 6 avisos nuevos"). Sin esto,
   una tanda de correos tapa la pantalla.

5. **Interruptor propio, aparte del permiso.** Quitar el permiso del navegador
   obliga a entrar a la configuración del sitio; apagarlos desde el panel tiene
   que ser un clic. La preferencia vive en `localStorage`, por navegador.

6. **Nada se marca leído por mostrar el aviso.** Leer sigue siendo abrir el caso.
   El aviso del escritorio es un llamado de atención, no una lectura.

## Tareas

### Tarea 1 — Lógica pura (`src/lib/notificaciones/aviso-escritorio.ts`)

- `permisoDeEscritorio(soporta, valor)` → `'sin-soporte' | 'preguntar' | 'concedido' | 'negado'`
- `avisosDeEscritorio(nuevas)` → `AvisoEscritorio[]` con `tag`, `titulo`, `cuerpo`, `destino`
- Pruebas: un aviso, varios, el resumen al pasar del tope, y los cuatro estados
  del permiso.

### Tarea 2 — Permiso (`src/components/notificaciones/escritorio.ts` + bloque en `panel.tsx`)

- `useAvisosEscritorio()`: estado del permiso, `pedirPermiso()`, `encendido`,
  `alternar()`. Lectura del navegador en efecto y no en render (SSR y
  `react-hooks/purity`).
- `avisosEncendidos()`: función suelta que lee permiso y preferencia en el
  momento de emitir, sin estado de React.
- Bloque en el panel con los cuatro estados, incluyendo qué hacer si el permiso
  quedó negado (candado de la barra de direcciones).

### Tarea 3 — Emisor (`src/components/notificaciones/emisor-escritorio.tsx`)

- Montado dentro de `ProveedorNotificaciones`, así que entra solo en las páginas
  que ya tienen notificaciones.
- Al llegar avisos: si no están encendidos, no hace nada. Si sí, emite y engancha
  el clic → `window.focus()` + `router.push(destino)`.

### Tarea 4 — Invitación en la fila (`src/app/fila/invitacion-escritorio.tsx`)

- Barra discreta solo cuando el permiso está sin decidir y no se descartó antes.

### Tarea 5 — Prueba en local con la hoja de prueba

- `pnpm dev` contra la hoja de prueba, fila nueva con
  `scripts/simular-peticion.ts crear` y un correo real de respuesta.

### Tarea 6 — Traza de producción

- Anexo en `docs/PASO-A-PRODUCCION-NOTIFICACIONES.md` y `AVANCE.md`.
