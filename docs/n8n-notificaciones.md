# Flujos de n8n de las notificaciones

Lo que n8n hace por las notificaciones de la Mesa de Control: despertar a la
aplicación cada minuto. La detección, la escritura de folios y la creación de los
avisos viven en la aplicación, no en n8n.

## Por qué n8n solo agenda

Tres hechos medidos el 14 de agosto de 2026 empujaron la detección hacia la app:

1. **El disparador de Google Sheets se equivocaría.** Identifica filas nuevas por
   conteo y lee las últimas. El formulario **inserta** la respuesta arriba de las
   filas que la mesa pre-arrastró para el folio, así que n8n reportaría celdas
   vacías del final en lugar del caso nuevo. Se comprobó insertando una fila real:
   las pre-arrastradas se corren hacia abajo y el caso nuevo no queda al final.
2. **n8n no puede escribir el folio.** La columna `JY` está protegida con editores
   nombrados y la cuenta de servicio de n8n
   (`prod-app-drive@arched-curve-491518-e1.iam.gserviceaccount.com`) no es uno.
   Además la serie es "máximo de toda la columna más uno" con revalidación previa.
3. **El disparador de Gmail necesitaría una credencial nueva.** n8n tiene OAuth de
   Gmail de otras cuentas, ninguna es `mesadecontrol@`. La app ya tiene ese token y
   ya sabe relacionar hilos con casos.

## Lo que quedó armado

| Pieza | Identificador |
| --- | --- |
| Credencial | `Mesa de Control · Secreto de notificaciones` (`5lPR6srAR4sUDQLt`), tipo `httpHeaderAuth`, cabecera `authorization` |
| Flujo de casos nuevos | `Mesa de Control · Casos nuevos` — `eRSxeNUOYFEQBbF5` |
| Flujo de correos | `Mesa de Control · Correos recibidos` — `kRAOw54c5Wfq7GkS` |

Cada flujo son dos nodos: un **Schedule Trigger** cada minuto y un **HTTP Request**
`POST` a la ruta correspondiente, autenticado con la credencial. Sin nodos
posteriores: la respuesta de la app queda en la ejecución y eso es el registro.

El secreto vive en la credencial y no escrito en el nodo, para que no se lea desde
el editor de n8n.

## Estado

**Los dos están desactivados.** Apuntan a `https://frontend-mesa-control.vercel.app`,
que sirve la **hoja productiva**: activarlos empieza a generar avisos y a escribir
folios en la hoja real. Eso es el último paso de la salida a producción, descrito en
`PASO-A-PRODUCCION-NOTIFICACIONES.md`.

## Cómo se ve una ejecución sana

```bash
source ~/Downloads/trabajo/n8n/conectar-api-n8n.env
curl -sS -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.srv1195230.hstgr.cloud/api/v1/executions?workflowId=eRSxeNUOYFEQBbF5&limit=5" \
  | python3 -m json.tool
```

Con `includeData=true` se ve la respuesta de la app. En un minuto sin novedades:

```json
{ "ok": true, "nuevos": 0, "foliosGenerados": 0, "avisos": 0 }
```

La primera vez sobre una hoja nueva:

```json
{ "ok": true, "arranque": true, "marca": "2026-08-17T10:00:33.000Z" }
```

Ese `arranque` siembra la marca de agua sin avisar de nada: sin él, el primer
minuto llenaría el panel con el histórico completo.

## Encender y apagar

```bash
# Activar
curl -sS -X PATCH -H "X-N8N-API-KEY: $N8N_API_KEY" -H 'content-type: application/json' \
  "https://n8n.srv1195230.hstgr.cloud/api/v1/workflows/eRSxeNUOYFEQBbF5" -d '{"active": true}'

# Apagar (la vuelta atrás completa de la funcionalidad)
curl -sS -X PATCH -H "X-N8N-API-KEY: $N8N_API_KEY" -H 'content-type: application/json' \
  "https://n8n.srv1195230.hstgr.cloud/api/v1/workflows/eRSxeNUOYFEQBbF5" -d '{"active": false}'
```

Apagar los dos flujos deja la aplicación funcionando igual: sin avisos nuevos, la
campanita se queda vacía y el botón Actualizar sigue haciendo lo suyo. Nada del
resto de la herramienta depende de las notificaciones.

## Lo que falta y por qué

**Falta ver una ejecución real de n8n contra la aplicación.** La forma de probarlo
sin tocar la hoja productiva era un despliegue Preview —que usa la copia de
pruebas—, pero el proyecto tiene la **protección de despliegues** de Vercel activa y
responde `302` al inicio de sesión de Vercel ante cualquier petición de n8n. Las
dos salidas son:

- Un **token de omisión para automatización** (Deployment Protection → Protection
  Bypass for Automation) y mandarlo en la cabecera `x-vercel-protection-bypass`.
- Un **túnel temporal** al entorno local (`cloudflared tunnel --url http://localhost:3000`),
  que es lo más fiel a probar contra la hoja de prueba.

Mientras eso no ocurra, lo verificado es que las rutas responden correctamente a
las mismas peticiones que hará n8n: `401` sin secreto, `401` con secreto
equivocado, y el trabajo completo con el secreto bueno, incluida la idempotencia al
repetir. Lo único sin comprobar es el salto de red desde n8n.
