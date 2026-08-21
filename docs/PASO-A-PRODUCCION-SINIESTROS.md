# Atención a Siniestros: salida a producción

Qué falta para entregar el módulo, en el orden en que hay que hacerlo. Todo lo demás
—código, base y flujo— ya está listo en la rama `siniestros`.

## Lo que ya está aplicado a la base

La base es **la misma para local y para producción**, así que estos cambios ya están
puestos y son aditivos: la versión desplegada hoy no los conoce y sigue funcionando.

- `notificaciones.modulo` y `casos_hilo.modulo`, con omisión `mesa`.
- Tablas `credenciales_siniestros` y `ejecutivos_siniestros`.
- `omar.lara@enginecx.com` en la allowlist, con rol `admin`. En producción no surte
  efecto hasta el despliegue, porque el código actual todavía exige el dominio.

## Cuidado: `ajustes_app` es compartida

La cuenta designada del módulo (`siniestros:cuenta-activa`) y el interruptor del buzón
provisional (`siniestros:buzon-provisional`) viven en `ajustes_app`, **sin separar por
hoja**. Lo que se cambie en local queda cambiado en producción.

Estado al 21 de agosto de 2026:

| Clave | Valor | Por qué |
| --- | --- | --- |
| `siniestros:cuenta-activa` | `mesadecontrol@gplusseguros.mx` | Para probar el módulo sin José disponible |
| `siniestros:buzon-provisional` | `no` | No hace falta: la cuenta designada tiene credencial propia |

**Si se despliega sin cambiar esto**, el módulo funciona pero manda los correos del ramo
desde el buzón de la mesa, firmados con la ficha de José. Es coherente y no rompe nada,
pero no es lo que el área pidió: hay que hacer el paso 1.

## Paso 1 · La cuenta de José

Necesita a José unos diez minutos, con su sesión de Google.

1. Entra a `/siniestros/ajustes` y aprieta **Autorizar mi cuenta de correo**.
2. En la pantalla de Google elige `jose.mendoza@gplusseguros.mx` y acepta las tres
   casillas. Si elige otra cuenta, se registra esa: el callback pregunta a Google qué
   buzón se autorizó y no supone nada.
3. De vuelta en la pantalla, en la lista de cuentas autorizadas aparece la suya. Aprieta
   **Usar esta cuenta para enviar**.
4. Comprueba que la sección «Buzón del módulo» diga *El módulo envía y lee por
   jose.mendoza@gplusseguros.mx*. Si dice «Provisionalmente, por el buzón de la mesa»,
   algo del paso 3 no se guardó.
5. Revisa su ficha —nombre, puesto, teléfono— y corrígela si hace falta. Es lo que
   firma cada correo del ramo.
6. **Quita del módulo la credencial de `mesadecontrol@`**, que se autorizó solo para
   probar. Con la de José designada ya no se usa, pero dejarla es dejar una llave de más.

## Paso 2 · El texto de la plantilla

La plantilla `Siniestros` sigue con el borrador y su marcador
`[Escribe aquí el estado del siniestro y el siguiente paso]`. La escribe José desde
`/siniestros/ajustes`. Puede usar las variables del ramo, que el editor lista: número de
siniestro, póliza, aseguradora, cliente, tipo de siniestro.

## Paso 3 · Desplegar

1. Fusionar `siniestros` en `main` y empujar.
2. Desplegar a Vercel. **No hay variables de entorno nuevas.**
3. Comprobar en producción: `/login` responde, `/siniestros` lista los casos del ramo,
   y `/api/notificaciones/siniestros-correos` responde **401 sin el secreto** y
   `{"ok":true,…}` con él.

## Paso 4 · El flujo de n8n

`Atención a Siniestros · Correos recibidos` — `MXctPqIoE61JGvoR`. Está **desactivado**.
Se activa aquí, cuando la ruta ya existe en producción y hay cuenta autorizada.

Antes de activarlo conviene una corrida a mano con el secreto: si responde
`{"ok":true,"sinCuenta":true}`, es que nadie autorizó todavía y el paso 1 quedó a medias.

## Paso 5 · Limpiar la copia de pruebas

Cuatro filas simuladas, **de mayor a menor** —borrar una corre hacia arriba las de
abajo, y los avisos guardan el número de fila—:

```bash
for F in 7187 7186 7185 7184; do
  pnpm dotenv -e .env.local -- pnpm tsx scripts/simular-peticion.ts borrar $F
done
```

Después hay que limpiar de la base los avisos y los hilos de esas filas, o quedan
apuntando a un caso que no es. Y devolver las protecciones de las columnas `A` y
`B–JX` de la copia, que se quitaron para poder simular peticiones.

## Paso 6 · Verificar con el área

Cada persona que vaya a usar `/siniestros` tiene que conceder ahí el permiso de avisos
del navegador y comprobar el timbre con el botón **Probar**, en cada navegador que use.
El permiso es del sitio, no de la pantalla, así que quien ya lo concedió en la mesa lo
tiene; lo que hay que comprobar es el timbre, porque el audio depende de que haya habido
un clic en la página.

## Lo que se decidió no hacer

- **Separar la serie de folios.** Sigue siendo una sola para toda la hoja.
- **Quitar los siniestros de la fila de la mesa.** Es decisión del área que sigan ahí;
  abrir uno redirige al módulo del ramo.
- **Un formulario propio de siniestros.** Las peticiones siguen llegando por el
  formulario actual, marcadas con el área.
