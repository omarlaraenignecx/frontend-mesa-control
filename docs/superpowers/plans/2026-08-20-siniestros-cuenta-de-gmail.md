# Siniestros: la cuenta de Gmail del módulo — Plan de implementación

**Objetivo:** que el módulo tenga su propia cuenta de correo, autorizada por su dueño
desde la aplicación, con la ficha del ejecutivo que firma; y que se pueda probar hoy
—sin José en la oficina— usando provisionalmente el buzón de la mesa, de forma
explícita y visible.

**Etapa:** 3 de `docs/superpowers/specs/2026-08-20-modulo-siniestros-design.md`.

## Cambio respecto al diseño

El diseño ponía la ficha de la firma dentro de la fila de la credencial. Se separa en
dos tablas, por una razón concreta que apareció al pedirse la prueba sin José: la ficha
tiene que poder existir **antes** de que alguien autorice su cuenta. Si no, la prueba
provisional saldría sin firma o con una escrita en el código.

- `credenciales_siniestros` — quién autorizó su buzón y con qué permisos.
- `ejecutivos_siniestros` — la ficha que firma: nombre, puesto, teléfono.

Quién es el ejecutivo del módulo sigue viviendo en `ajustes_app`, bajo
`siniestros:cuenta-activa`, y ahora apunta a un correo que puede tener ficha sin tener
credencial todavía.

## El buzón provisional

Interruptor en `ajustes_app`, bajo `siniestros:buzon-provisional`, **apagado por
omisión**. Encendido, el módulo envía y lee por la credencial de `mesadecontrol@` y la
interfaz lo dice en cada pantalla donde importa.

Existe porque el área pidió probar el módulo completo sin José disponible. La condición
es que **nunca sea silencioso**: un módulo que cae al buzón de la mesa sin avisar es
exactamente el error que el módulo existe para evitar. Se apaga solo con la mano, al
autorizar la cuenta de verdad.

## Global

- No se escribe en la hoja. Nada de esta etapa la toca.
- El refresh token se cifra con `lib/crypto/secreto.ts` y la `CREDENCIAL_ENC_KEY` que
  ya existe. Ninguna variable de entorno nueva.
- Verificación: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

---

### Task 1: Las dos tablas

**Archivos:** `src/db/schema.ts`; migración aplicada a mano con `ADD COLUMN`/`CREATE
TABLE IF NOT EXISTS`, como la columna `modulo`.

- [ ] `credenciales_siniestros`: `correo` (PK), `refresh_token_cifrado`, `scopes`,
      `autorizado_por`, `autorizado_en`, `ultimo_uso`, `ultimo_error`.
- [ ] `ejecutivos_siniestros`: `correo` (PK), `nombre`, `puesto`, `telefono`,
      `actualizado_por`, `actualizado_en`.
- [ ] Aplicar con `CREATE TABLE IF NOT EXISTS`, revisando el SQL antes de correrlo.
      La base es la misma de producción: solo sentencias aditivas.
- [ ] Commit.

### Task 2: Ficha del ejecutivo y cuenta activa

**Archivos:** crear `src/lib/siniestros/ejecutivos.ts`; prueba
`src/lib/siniestros/ejecutivos.test.ts`.

**Produce:**
```ts
export type Ficha = { correo: string; nombre: string; puesto: string; telefono: string }
export const FICHA_JOSE: Ficha
export async function sembrarEjecutivos(): Promise<void>   // idempotente
export async function listarEjecutivos(): Promise<Ficha[]>
export async function guardarFicha(f: Ficha, por: string): Promise<void>
export async function cuentaActiva(): Promise<string | null>
export async function activarCuenta(correo: string): Promise<void>
export async function buzonProvisional(): Promise<boolean>
export async function guardarBuzonProvisional(encendido: boolean): Promise<void>
```

- [ ] Prueba: la siembra es idempotente y no pisa una ficha ya editada; la primera
      ficha sembrada queda como cuenta activa si no había ninguna.
- [ ] Implementar. `FICHA_JOSE` con los datos que dio el área: Jose Juan Mendoza Diaz,
      Ejecutivo de siniestros, 55 4884 2862, `jose.mendoza@gplusseguros.mx`.
- [ ] Commit.

### Task 3: Credenciales y token del módulo

**Archivos:** crear `src/lib/siniestros/credencial.ts` y `src/lib/siniestros/auth.ts`;
pruebas de las dos.

**Produce:**
```ts
// credencial.ts
export async function guardarCredencialSiniestros(correo, refreshToken, scopes, por): Promise<void>
export async function leerCredencialSiniestros(correo: string): Promise<Fila | null>
export async function listarCredencialesSiniestros(): Promise<Fila[]>
export async function quitarCredencialSiniestros(correo: string): Promise<void>

// auth.ts
export const SCOPES_SINIESTROS = ['gmail.send', 'gmail.readonly', 'gmail.modify']  // completos
export class SinCuentaSiniestrosError extends Error {}
export type BuzonSiniestros = {
  accessToken: string
  correo: string
  provisional: boolean
  ficha: Ficha | null
}
export async function buzonDeSiniestros(): Promise<BuzonSiniestros>
export async function estadoDelBuzon(): Promise<Estado>   // para la pantalla, no lanza
```

Resolución, en este orden y sin atajos: cuenta activa con credencial → ella; si no, y
el buzón provisional está encendido → el token de la mesa con `provisional: true`; si
no → `SinCuentaSiniestrosError`.

- [ ] Prueba: se prefiere siempre la cuenta propia sobre el provisional; sin cuenta y
      sin provisional lanza en lugar de caer al buzón de la mesa por descuido; los
      permisos faltantes se detectan como en la mesa.
- [ ] Implementar reusando `intercambiarRefreshToken`, que ya recibe su `fetch`.
- [ ] Commit.

### Task 4: Autorizar y volver

**Archivos:** crear `src/app/api/siniestros/autorizar/route.ts` y
`src/app/api/siniestros/callback/route.ts`; prueba de las dos.

- [ ] Prueba: el callback pregunta a Google qué buzón se autorizó y guarda **ese**
      correo, no el de la sesión; rechaza un buzón de otro dominio; la primera cuenta
      queda activa.
- [ ] Implementar. `login_hint` con el correo de quien está en sesión. El buzón se lee
      de `gmail/v1/users/me/profile`.
- [ ] Commit.

### Task 5: `/siniestros/ajustes`

**Archivos:** crear `src/app/siniestros/ajustes/page.tsx`, `acciones.ts`, y los
componentes de cliente de la ficha y del interruptor; prueba de la página.

- [ ] Prueba: la página no exige admin; quitar la cuenta de otra persona sí; el aviso
      del buzón provisional aparece cuando está encendido.
- [ ] Implementar: permisos, lista de cuentas, fichas, interruptor del buzón
      provisional con su explicación.
- [ ] Encender `SINIESTROS.ajustes` en `modulo.ts`, con `soloAdmin: false`, y enlazar
      desde `/ajustes` de la mesa.
- [ ] Verificación completa y commit.
