# Siniestros: los avisos de correo del módulo — Plan de implementación

**Objetivo:** que una respuesta a un correo de siniestros entre a la campanita del
módulo, con su flujo de n8n propio; y probarlo hoy de punta a punta sin José
disponible y sin aflojar ningún control.

**Etapa:** 5 de `docs/superpowers/specs/2026-08-20-modulo-siniestros-design.md`, más un
cambio a la allowlist que el área pidió aparte.

## Cómo se prueba sin José

Se designa `mesadecontrol@` como la cuenta del módulo. Ya está autorizada con los tres
permisos de Gmail, así que el módulo deja de estar en modo provisional y trabaja con una
credencial propia y real: token, envío, lectura de bandeja, ruta y flujo, todo el camino.

El escenario es además **más exigente** que el definitivo: las conversaciones de los dos
módulos quedan en la **misma** bandeja. Eso obliga a que el filtro por módulo funcione de
verdad, porque si no, cada ruta recogería los hilos de la otra. Con dos buzones distintos
—como será en producción— esa confusión es imposible por construcción, así que si
funciona aquí, funciona allá.

El día del deploy: José autoriza su cuenta y alguien aprieta «Usar esta cuenta para
enviar». Un clic, sin tocar código.

## Global

- No se escribe en la hoja. Nada de esta etapa la toca.
- La ruta nueva se protege con el mismo `NOTIFICACIONES_SECRET`. Ninguna variable de
  entorno nueva.
- El flujo de n8n se crea **desactivado** y apuntando a producción, igual que los dos que
  ya existen: n8n vive en la nube y no alcanza `localhost`, así que la prueba local se
  agenda con un script.
- Verificación: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

---

### Task 1: La lista explícita manda

**Archivos:** `src/lib/auth/allowlist.ts`, su prueba, `src/db/seed-usuarios.ts`,
`src/app/(auth)/sin-acceso/page.tsx` si cambia el texto.

Hoy entrar exige dos cosas: estar en `usuarios_autorizados` **y** que el correo sea del
dominio de la empresa. El área decidió que la lista explícita baste, por una razón
concreta: quien desarrolla la herramienta es externo y hoy entra con la cuenta compartida
de administrador, así que la bitácora le atribuye a `mesadecontrol@` todo lo que hace una
persona identificable. La lista sigue siendo la puerta; nadie que no esté en ella entra.

- [ ] Prueba que falla: una dirección de otro dominio **listada y activa** entra; una de
      otro dominio **no listada** sigue rechazada, y con el motivo `dominio-ajeno`, que
      da un mensaje más útil que «fuera de la lista»; una del dominio no listada sigue
      con `fuera-de-allowlist`; una listada e inactiva sigue con `inactivo`.
- [ ] Implementar en `resolverAcceso`: se busca en la lista primero y el dominio solo
      decide **el mensaje** de quien no está en ella.
- [ ] Agregar `omar.lara@enginecx.com` a la base y a la siembra, con rol `admin`.
- [ ] Anotar en `AVANCE.md` como cambio a RNF-02, con el motivo.
- [ ] Commit.

### Task 2: Designar la cuenta del módulo y apagar el provisional

**Archivos:** ninguno de código; un script temporal, como las migraciones anteriores.

- [ ] Poner `siniestros:cuenta-activa` en `mesadecontrol@gplusseguros.mx` y
      `siniestros:buzon-provisional` en `no`.
- [ ] Llenar la ficha de esa cuenta con los datos de José, que es lo que se está
      simulando, y dejar intacta la ficha de José para el día del deploy.
- [ ] Comprobar que `buzonDelCaso` de un caso del ramo devuelve `provisional: false` y la
      firma correcta.

### Task 3: La ruta de correos del módulo

**Archivos:** crear `src/app/api/notificaciones/siniestros-correos/route.ts` y su prueba;
modificar `src/app/api/notificaciones/correos/route.ts`.

**Lo que no se puede olvidar:** la ruta de la mesa tiene que **restringirse a los hilos de
su módulo**. Con los dos módulos compartiendo bandeja, sin ese filtro la ruta de la mesa
crearía avisos suyos por las respuestas de siniestros, y sería la primera en verlas. En
producción, con buzones distintos, el filtro no hace nada; aquí es lo que sostiene la
separación.

- [ ] Prueba que falla: cada ruta consulta `casos_hilo` filtrando por su módulo; la del
      ramo lee por `buzonDeSiniestros` y no por el buzón de la mesa; los avisos que crea
      llevan `modulo: 'siniestros'`.
- [ ] Implementar. La forma es la de la ruta que ya existe: salida temprana si no hay
      nada nuevo, antes de leer la hoja.
- [ ] Commit.

### Task 4: Agenda local y prueba de punta a punta

- [ ] Script en el scratchpad que despierte las tres rutas cada 45 segundos, como el que
      se usó para los avisos de escritorio.
- [ ] Responder desde una dirección de fuera al correo del caso 9004.
- [ ] Comprobar: el aviso entra con `modulo=siniestros`, aparece en la campanita de
      `/siniestros` y **no** en la de `/fila`, el globo del escritorio abre
      `/siniestros/caso/7184`, y el mensaje aparece en el chat del caso.
- [ ] Comprobar el espejo: responder a un correo de un caso de la mesa y ver que entra a
      la campanita de la mesa y no a la del ramo.

### Task 5: El flujo de n8n

**Archivos:** `docs/n8n-notificaciones.md`.

- [ ] Crear `Atención a Siniestros · Correos recibidos` por la API de n8n: Schedule
      Trigger cada minuto y HTTP Request `POST` a la ruta nueva en producción, con la
      credencial `Mesa de Control · Secreto de notificaciones` que ya existe.
- [ ] Dejarlo **desactivado**, como los otros dos: activarlo antes del deploy generaría
      avisos contra la hoja productiva.
- [ ] Documentar su identificador y cómo se ve una ejecución sana.
- [ ] Commit.

### Task 6: La lista para el día del deploy

**Archivos:** `docs/PASO-A-PRODUCCION-NOTIFICACIONES.md`, `docs/AVANCE.md`.

- [ ] Escribir el cambio a la cuenta de José como pasos numerados: autorizar, designar,
      comprobar que el estado dice «propio», activar el flujo, borrar la credencial de
      `mesadecontrol@` del módulo.
- [ ] Dejar anotado que `ajustes_app` es la misma base para local y producción, así que
      la cuenta designada y el interruptor provisional son **compartidos**: lo que se
      cambie en local queda cambiado en producción.
- [ ] Commit.
