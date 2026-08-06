# Configuración de Google Cloud — Mesa de Control

Procedimiento que ejecuta el administrador (`mesadecontrol@gplusseguros.mx`) en la consola de Google Cloud. No existe API pública para crear la pantalla de consentimiento ni un cliente OAuth de tipo aplicación web, así que estos pasos no se pueden automatizar; todo lo demás sí.

| Dato | Valor |
| --- | --- |
| Proyecto | `mesa-de-control-504618` |
| Organización padre | `1029986595993` |
| Cuenta administradora | `mesadecontrol@gplusseguros.mx` |
| Cuenta de servicio (solo administración y lectura en desarrollo) | `cuenta-de-servicio@mesa-de-control-504618.iam.gserviceaccount.com` |

## 1. Pantalla de consentimiento

https://console.cloud.google.com/auth/overview?project=mesa-de-control-504618

- Tipo de usuario: **Interno**. Es la decisión crítica: al pertenecer el proyecto a una organización, el tipo Interno evita el proceso de verificación de Google, la advertencia de aplicación no verificada y —lo más importante— la expiración del refresh token a los 7 días que sufren las aplicaciones externas en modo prueba.
- Nombre de la aplicación: `Mesa de Control Gplus`
- Correo de asistencia y de contacto: `mesadecontrol@gplusseguros.mx`

## 2. Acceso a datos (scopes)

Registrar exactamente estos cinco, ni uno más:

```
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
```

Forms y Calendar están habilitados en el proyecto pero la aplicación no los usa ni los solicita.

## 3. Cliente OAuth

Tipo **Aplicación web**, nombre `Mesa de Control web`. Un mismo cliente atiende los dos flujos: el inicio de sesión de los usuarios y el consentimiento de la cuenta de la mesa.

Orígenes autorizados de JavaScript:

```
http://localhost:3000
```

URI de redirección autorizados:

```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/mesa/callback
```

Cuando Vercel asigne el dominio de producción, agregar sus equivalentes:

```
https://<dominio>
https://<dominio>/api/auth/callback/google
https://<dominio>/api/mesa/callback
```

El ID de cliente y el secreto se cargan en `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`. Nunca al repositorio.

## 4. Secretos generados localmente

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # CREDENCIAL_ENC_KEY
```

`CREDENCIAL_ENC_KEY` cifra el refresh token de la mesa. Si se pierde, hay que volver a autorizar el consentimiento; si se filtra, hay que rotarla y reautorizar.

## 5. Verificación por CLI

```bash
gcloud config set project mesa-de-control-504618
gcloud services list --enabled --format="value(config.name)" | grep -E "sheets|gmail|drive"
```

Deben aparecer `sheets.googleapis.com`, `gmail.googleapis.com` y `drive.googleapis.com`.

## 6. Autorización del consentimiento

1. Entrar a la aplicación con `mesadecontrol@gplusseguros.mx`.
2. Ir a `/ajustes` y pulsar **Autorizar acceso a Google**.
3. Google debe pedir los cinco permisos **sin** mostrar la pantalla de aplicación no verificada. Si la muestra, el consentimiento quedó configurado como Externo y hay que corregirlo.
4. Al volver, Ajustes debe reportar el consentimiento activo y el título de la hoja alcanzada.

## Hojas de cálculo

| Uso | Identificador |
| --- | --- |
| Desarrollo | `1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ` — "Prueba formulario mesa de control" |
| Producción | `1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0` — "Formulario sin título (Respuestas)" |

La hoja productiva no se escribe en ninguna etapa anterior a la 4. El cambio se hace con la variable `SHEET_ID`.
