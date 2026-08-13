import { Esqueleto } from '@/components/esqueleto'
import { Card } from '@/components/ui/card'

/**
 * Fallback instantáneo al entrar a la fila. Repite la forma del encabezado real
 * —el rótulo y las tres pestañas— para que la transición no parpadee, y deja
 * ocho renglones de tabla, que es el orden de magnitud de la vista por omisión.
 */
export default function Cargando() {
  return (
    <div className="min-h-full">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl space-y-5 px-6 py-5">
          <div className="space-y-1">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Gplus Seguros
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Mesa de Control</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Esqueleto className="h-11 w-48" />
            <Esqueleto className="h-11 w-32" />
            <Esqueleto className="h-11 w-56" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
        <Esqueleto className="h-6 w-96" />
        <Esqueleto className="h-12 w-full" />
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="divide-y">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Esqueleto className="size-3 rounded-full" />
                <Esqueleto className="h-5 w-24" />
                <Esqueleto className="h-5 w-20" />
                <Esqueleto className="h-5 w-16" />
                <Esqueleto className="h-5 w-24" />
                <Esqueleto className="h-5 flex-1" />
              </div>
            ))}
          </div>
        </Card>
      </main>

      <p role="status" className="sr-only">
        Cargando la fila de casos…
      </p>
    </div>
  )
}
