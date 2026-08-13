/**
 * Bloque que late mientras algo carga. Es propio y no el de shadcn porque
 * `shadcn add` reescribe `globals.css`, y eso ya rompió la tipografía una vez
 * (restricción 6 de docs/AVANCE.md).
 */
export function Esqueleto({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-secondary ${className}`} />
}
