'use client'

import { LoaderCircle, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Sube archivos al caso, sin restricción de tipo: la mesa adjunta capturas, PDF,
 * correos exportados y lo que haga falta.
 *
 * El envío va por `fetch` a una ruta y no por una Server Action, que está
 * limitada a 1 MB de cuerpo.
 */
export function SubirArchivos({ fila }: { fila: number }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function enviar(archivos: FileList) {
    setError(null)
    setSubiendo(true)
    try {
      const datos = new FormData()
      datos.set('fila', String(fila))
      for (const archivo of archivos) datos.append('archivos', archivo)

      const respuesta = await fetch('/api/archivo/subir', { method: 'POST', body: datos })
      const cuerpo = (await respuesta.json()) as { ok: boolean; error?: string }
      if (cuerpo.ok) router.refresh()
      else setError(cuerpo.error ?? 'No se pudieron subir los archivos.')
    } catch {
      setError('Se cortó la conexión durante la subida. Vuelve a intentarlo.')
    } finally {
      setSubiendo(false)
      // Se limpia para que elegir el mismo archivo otra vez vuelva a disparar el
      // cambio; si no, el segundo intento no hace nada.
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={entrada}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void enviar(e.target.files)
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={subiendo}
        onClick={() => entrada.current?.click()}
      >
        {subiendo ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {subiendo ? 'Subiendo…' : 'Agregar archivos'}
      </Button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
