import { PantallaDeCasos, type ParamsListado } from '@/components/casos/pantalla-de-casos'
import { MESA } from '@/lib/modulos/modulo'

export default async function PaginaDeLaFila({
  searchParams,
}: {
  searchParams: Promise<ParamsListado>
}) {
  return <PantallaDeCasos modulo={MESA} params={await searchParams} />
}
