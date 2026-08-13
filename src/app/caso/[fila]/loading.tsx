import { Esqueleto } from '@/components/esqueleto'
import { Card } from '@/components/ui/card'

/**
 * Fallback al abrir un caso. Conserva la barra superior con el enlace de
 * regreso, que es lo primero que la mesa busca si se equivocó de caso.
 */
export default function Cargando() {
  return (
    <div className="min-h-full bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl space-y-3 px-6 py-4">
          <Esqueleto className="h-6 w-36" />
          <div className="flex flex-wrap items-center gap-3">
            <Esqueleto className="h-9 w-56" />
            <Esqueleto className="h-7 w-28" />
          </div>
          <Esqueleto className="h-5 w-72" />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-3 p-6">
            <Esqueleto className="h-6 w-40" />
            {Array.from({ length: 6 }, (_, i) => (
              <Esqueleto key={i} className="h-5 w-full" />
            ))}
          </Card>
          <Card className="space-y-3 p-6">
            <Esqueleto className="h-6 w-52" />
            <Esqueleto className="h-24 w-full" />
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="space-y-3 p-6">
            <Esqueleto className="h-6 w-32" />
            {Array.from({ length: 4 }, (_, i) => (
              <Esqueleto key={i} className="h-10 w-full" />
            ))}
          </Card>
        </div>
      </main>

      <p role="status" className="sr-only">
        Cargando el caso…
      </p>
    </div>
  )
}
