/**
 * Rehace el logo que va dentro de los correos, a partir del SVG de la marca.
 *
 *   pnpm tsx scripts/generar-logo-correo.ts ~/Downloads/logos-by-engine-02.svg
 *
 * Escribe los dos archivos que consume `src/lib/correo/marca/`: el PNG —que se
 * conserva para poder verlo— y el módulo con el mismo PNG en base64, que es el que
 * de verdad se envía. Ver `marca/logo.ts` para por qué va incrustado en el código.
 *
 * `sharp` es dependencia de desarrollo y solo se usa aquí, nunca en tiempo de
 * ejecución: el correo no rehace el logo, lo lleva ya hecho.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/** Se muestra a 180 px; el archivo mide el doble para las pantallas de densidad alta. */
const ANCHO_MOSTRADO = 180
const ESCALA = 2

const aqui = dirname(fileURLToPath(import.meta.url))
const destinoPng = resolve(aqui, '../src/lib/correo/marca/gplus-seguros.png')
const destinoTs = resolve(aqui, '../src/lib/correo/marca/logo.ts')

const svg = process.argv[2]
if (!svg) {
  console.error('Falta la ruta del SVG. Uso: pnpm tsx scripts/generar-logo-correo.ts <ruta.svg>')
  process.exit(1)
}

async function generar() {
  const png = await sharp(readFileSync(resolve(svg)), { density: 600 })
    .resize({ width: ANCHO_MOSTRADO * ESCALA })
    // Fondo blanco y no transparencia: la cabecera del correo es blanca, y así el logo
    // sigue siendo legible cuando el cliente de correo pinta el mensaje en modo oscuro
    // —que invierte el fondo pero no la imagen—.
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer()

  const { width = 0, height = 0 } = await sharp(png).metadata()
  writeFileSync(destinoPng, png)

  // Se reescriben las tres cosas que dependen del archivo: los dos tamaños y el
  // base64. Lo demás del módulo —el porqué, el Content-ID— lo escribe una persona.
  const cuerpo = readFileSync(destinoTs, 'utf8')
    .replace(/(ancho: )\d+/, `$1${Math.round(width / ESCALA)}`)
    .replace(/(alto: )\d+/, `$1${Math.round(height / ESCALA)}`)
    .replace(/(')[A-Za-z0-9+/=]{100,}(')/, `$1${png.toString('base64')}$2`)
  writeFileSync(destinoTs, cuerpo)

  console.log(
    `Logo regenerado: ${width}×${height} px, ${(png.length / 1024).toFixed(1)} KB` +
      ` (se muestra a ${Math.round(width / ESCALA)} px).`,
  )
}

generar().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
