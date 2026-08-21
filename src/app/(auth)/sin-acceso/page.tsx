import Link from 'next/link'

const MENSAJES: Record<string, string> = {
  // Ya no es el dominio lo que cierra la puerta, sino no estar en la lista. El
  // mensaje distingue los dos casos porque ayudan a cosas distintas: a alguien de la
  // empresa, saber que hay que agregarlo; a alguien de fuera, que se equivocó de cuenta.
  'dominio-ajeno':
    'Esa cuenta no está autorizada y tampoco es del dominio gplusseguros.mx. Revisa si entraste con la cuenta correcta.',
  'fuera-de-allowlist':
    'Tu cuenta no está en la lista de personas autorizadas de la Mesa de Control.',
  inactivo: 'Tu acceso a la herramienta está desactivado.',
  'sin-correo': 'Google no compartió un correo con el que podamos identificarte.',
}

export default async function SinAcceso({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>
}) {
  const { motivo } = await searchParams
  const mensaje = MENSAJES[motivo ?? ''] ?? 'No pudimos autorizar tu acceso.'

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-9 shadow-lg">
        <h1 className="text-2xl font-semibold">Sin acceso</h1>
        <p className="text-base text-muted-foreground">{mensaje}</p>
        <p className="text-base text-muted-foreground">
          Si crees que deberías tener acceso, solicítalo al administrador de la Mesa de Control.
        </p>
        <Link href="/login" className="inline-block text-base text-primary underline underline-offset-4">
          Intentar con otra cuenta
        </Link>
      </div>
    </main>
  )
}
