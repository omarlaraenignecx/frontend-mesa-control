import { PantallaDeCasos, type ParamsListado } from '@/components/casos/pantalla-de-casos'
import { SINIESTROS } from '@/lib/modulos/modulo'

export default async function PaginaDeSiniestros({
  searchParams,
}: {
  searchParams: Promise<ParamsListado>
}) {
  return <PantallaDeCasos modulo={SINIESTROS} params={await searchParams} />
}
