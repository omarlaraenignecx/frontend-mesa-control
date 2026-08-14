import type { NextConfig } from 'next'
// Ruta relativa y no el alias `@/`: la configuración se carga antes de que exista
// la resolución de rutas de la aplicación.
import { LIMITE_CUERPO_ACCION_BYTES } from './src/lib/correo/limites'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Los adjuntos del correo viajan dentro de la acción, y el valor por
      // omisión de Next es 1 MB: sin esto, adjuntar un PDF normal aborta la
      // petición con un 413 y el navegador solo muestra una pantalla de error.
      bodySizeLimit: LIMITE_CUERPO_ACCION_BYTES,
    },
  },
  async redirects() {
    return [
      // La bandeja se llamaba /cola hasta el 13 de agosto de 2026. La
      // redirección protege los marcadores que la mesa ya tenga guardados;
      // Next conserva la cadena de consulta al redirigir.
      { source: '/cola', destination: '/fila', permanent: true },
    ]
  },
}

export default nextConfig
