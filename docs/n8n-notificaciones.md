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

## Verificado de punta a punta el 17 de agosto de 2026

La protección de despliegues de Vercel bloquea a n8n en Preview (responde `302` al
inicio de sesión de Vercel), así que la prueba se hizo con un **túnel temporal** de
`cloudflared` al entorno local, que apunta a la copia de pruebas. Los dos flujos se
apuntaron al túnel, se activaron, se dejaron correr y se devolvieron a producción
apagados. Lo que se observó, sin intervención humana entre una cosa y la otra:

| Ejecución | Respuesta de la app |
| --- | --- |
| 16:33:48 | `{"nuevos":1,"foliosGenerados":0,"avisos":0}` — régimen normal |
| 16:34:48 | igual |
| **16:35:48** | `{"nuevos":2,"foliosGenerados":1,"avisos":1}` — la petición insertada a las 16:35 |
| 16:36:48 | vuelve al régimen normal: `avisos: 0` |

En la hoja quedó el folio **9005** (máximo de la columna más uno) y en la base el
aviso con la fila y el folio correctos. Las siete ejecuciones de los dos flujos
terminaron en `success`.

Queda sin comprobar una sola cosa: que n8n alcance **producción**. Es la misma
petición por la misma red, con otra URL; se verifica en el primer ciclo del paso a
producción, descrito en `PASO-A-PRODUCCION-NOTIFICACIONES.md`.

Si en el futuro hace falta repetir la prueba contra el local:

```bash
cloudflared tunnel --url http://localhost:3000     # da una URL de trycloudflare.com
# apuntar los nodos HTTP de los dos flujos a esa URL, activarlos, observar, y
# devolverlos a https://frontend-mesa-control.vercel.app apagados
```
