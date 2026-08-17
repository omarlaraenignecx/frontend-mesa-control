# Paso a producción de las notificaciones

Todo lo de este documento está **probado contra la copia de pruebas**
(`1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ`) y **nada de esto se ha ejecutado
todavía contra la hoja productiva** (`1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0`).

Los pasos van en orden. El 4 es el delicado.

---

## 1. La variable de entorno, antes de desplegar

El secreto que comparten la aplicación y los flujos de n8n. Ya está en `Preview`;
falta `Production`. Tiene que ser **el mismo valor** que guarda la credencial de n8n
`Mesa de Control · Secreto de notificaciones` (`5lPR6srAR4sUDQLt`), que es el que
está en `.env.local` como `NOTIFICACIONES_SECRET`.

```bash
cd ~/Downloads/trabajo/frontend-mesa-control
set -a; . ./.env.local; set +a
printf '%s' "$NOTIFICACIONES_SECRET" | vercel env add NOTIFICACIONES_SECRET production
vercel env ls | grep NOTIFICACIONES        # debe aparecer en Production y Preview
```

**Si falta, las dos rutas responden 401 a todo** —así están escritas: sin secreto
configurado quedan cerradas, no abiertas—. Por eso va antes del despliegue.

## 2. El esquema: nada que hacer

Las tablas `notificaciones` y `notificaciones_leidas` **ya existen** en producción:
la base de Supabase es la misma para los tres entornos y se crearon el 17 de agosto
de 2026 con `pnpm db:push`. Comprobarlo antes de seguir:

```bash
pnpm dotenv -e .env.local -- pnpm tsx -e "
import { sql } from 'drizzle-orm'
import { getDb } from './src/db'
getDb().execute(sql\`select count(*) from notificaciones\`).then(r => { console.log(r); process.exit(0) })
"
```

No hay migración pendiente. Los dos cambios de esquema son **aditivos**: ninguna
tabla ni columna anterior se tocó, así que la versión previa de la aplicación sigue
funcionando con esta base.

## 3. Desplegar

```bash
git checkout main && git pull
vercel deploy --prod --yes
```

Comprobar que la ruta llegó y está cerrada:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://frontend-mesa-control.vercel.app/api/notificaciones/casos-nuevos       # 401

set -a; . ./.env.local; set +a
curl -s -X POST https://frontend-mesa-control.vercel.app/api/notificaciones/casos-nuevos \
  -H "authorization: Bearer $NOTIFICACIONES_SECRET"                              # 200
```

## 4. El arranque silencioso — el paso delicado

**La primera llamada en producción no debe avisar de nada.** Siembra la marca de
agua con la petición más reciente de la hoja; sin ella, el primer minuto llenaría la
campanita con las 1,400 peticiones de 2026.

La respuesta correcta de esa primera llamada es:

```json
{ "ok": true, "arranque": true, "marca": "…", "hoja": "1OfK8ve8twu5…" }
```

Confirmar que la tabla no creció:

```sql
select tipo, count(*) from notificaciones
where sheet_id = '1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0' group by tipo;
```

Si por error se hubiera avisado del histórico, la reparación es borrar y volver a
sembrar:

```sql
delete from notificaciones where sheet_id = '1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0';
delete from ajustes_app where clave = 'ultima_marca_caso:1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0';
```

Y volver a llamar la ruta, que vuelve a arrancar en silencio.

**Detalle conocido:** la corrida siguiente al arranque anuncia **una vez** la
petición más reciente que ya existía. Es consecuencia deliberada de comparar la marca
con "mayor o igual", que existe para no perder dos peticiones llegadas en el mismo
segundo. Un aviso de más el primer minuto, nunca uno de menos.

## 5. Apuntar n8n a producción y encender

Los flujos ya apuntan a `https://frontend-mesa-control.vercel.app` y están
**apagados**. Solo falta activarlos:

```bash
source ~/Downloads/trabajo/n8n/conectar-api-n8n.env
for id in eRSxeNUOYFEQBbF5 kRAOw54c5Wfq7GkS; do
  curl -sS -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "https://n8n.srv1195230.hstgr.cloud/api/v1/workflows/$id/activate"
done
```

Y mirar las tres primeras ejecuciones de cada uno (`docs/n8n-notificaciones.md`
explica cómo leerlas). Deben decir `success`, la primera con `arranque: true` si el
paso 4 no se hizo a mano.

## 6. Vigilancia del primer día

- Las ejecuciones de n8n: cualquiera en `error` significa que la app no respondió.
- El conteo por tipo, dos o tres veces en el día:
  ```sql
  select tipo, count(*), max(creado_en) from notificaciones
  where sheet_id = '1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0' group by tipo;
  ```
  Un salto grande de `caso_nuevo` de golpe significa que la marca de agua se perdió.
- Los folios que escribió el automático, que son distinguibles de los de una persona:
  ```sql
  select fila, folio, creado_en from bitacora
  where tipo = 'folio_capturado' and correo_usuario = 'n8n:casos-nuevos'
  order by id desc limit 20;
  ```

## 7. Vuelta atrás

Apagar los dos flujos:

```bash
for id in eRSxeNUOYFEQBbF5 kRAOw54c5Wfq7GkS; do
  curl -sS -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "https://n8n.srv1195230.hstgr.cloud/api/v1/workflows/$id/deactivate"
done
```

Con eso la aplicación sigue igual: sin avisos nuevos la campanita se queda vacía, la
tabla no se mueve sola y el botón Actualizar hace lo de siempre. **Nada del resto de
la herramienta depende de las notificaciones**, así que no hay que revertir código ni
tocar la base.

## 8. Lo que cuesta

- **n8n:** dos llamadas por minuto, unas 86,000 al mes. Cada una lee la hoja (y una
  de ellas el buzón), así que son también llamadas a Google, muy por debajo de sus
  cuotas.
- **Los navegadores:** una petición cada 30 segundos por pestaña abierta, y solo
  mientras la pestaña está a la vista. Con cinco personas y jornadas de ocho horas,
  del orden de 105,000 al mes.
- Anotar aquí el número real observado en la primera semana.

## 9. El riesgo asumido: el folio automático

La ruta de casos nuevos **escribe en la columna `JY` de la hoja productiva sin que
nadie apriete un botón**. Es lo que el área pidió, y está acotado:

- Solo toca celdas **vacías**; nunca sobrescribe un folio existente.
- Continúa la serie desde el **máximo de toda la columna**, que es lo que impide
  repetir un número (el arrastre manual es el origen de los 210 folios duplicados que
  tiene la hoja).
- Revalida la fila antes de escribir y **aborta el lote completo** si algo cambió.
- Tope de **50 por tanda**; más que eso se rechaza con un mensaje y no escribe nada.
- Cada folio queda en la bitácora atribuido a `n8n:casos-nuevos`, distinguible de lo
  que hizo una persona.

**Si el área prefiere que la app no escriba folios sola**, se apaga quitando la
llamada a `generarFoliosPendientes` de
`src/app/api/notificaciones/casos-nuevos/route.ts`. Los avisos siguen llegando igual
y el folio se genera con el botón, como hasta ahora.

## 10. Pendientes que no bloquean

- **Restaurar las protecciones de la copia de pruebas.** Para poder simular
  peticiones se quitaron las protecciones de las columnas `A` y `B–JX` de la copia
  (`Datos → Proteger hojas y rangos`). Conviene devolverlas cuando ya no se necesiten,
  para que la copia siga pareciéndose a la hoja real. **Las de la hoja productiva
  nunca se tocaron.**
- **Fila de prueba en la copia.** Queda una petición simulada
  (`PRUEBA DE NOTIFICACIONES`, folio 9005). Se quita con
  `pnpm dotenv -e .env.local -- pnpm tsx scripts/simular-peticion.ts borrar <fila>`,
  recordando limpiar después sus avisos en la base (ver el comentario del script:
  borrar una fila corre las de abajo y los avisos guardan el número de fila).
- **Que n8n alcance producción.** Es lo único del circuito sin comprobar; se ve en el
  primer ciclo del paso 5.
- **La verificación en el navegador**: campanita, panel, la tabla que se mueve sola y
  el aviso del chat. Probado en local; falta verlo con una sesión real del área.
