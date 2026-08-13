import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
