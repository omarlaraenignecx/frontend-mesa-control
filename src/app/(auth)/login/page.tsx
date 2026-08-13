import { signIn } from '@/auth'

export default function Login() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-7 rounded-2xl border bg-card p-9 shadow-lg">
        <div className="space-y-1">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Gplus Seguros</p>
          <h1 className="text-3xl font-semibold tracking-tight">Mesa de Control</h1>
        </div>
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/fila' })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Entrar con Google
          </button>
        </form>
        <p className="text-sm text-muted-foreground">
          Solo cuentas autorizadas del dominio gplusseguros.mx.
        </p>
      </div>
    </main>
  )
}
