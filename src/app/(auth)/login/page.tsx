import { signIn } from '@/auth'

export default function Login() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-neutral-200 p-8 dark:border-neutral-800">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Mesa de Control</h1>
          <p className="text-sm text-neutral-500">Gplus Seguros</p>
        </div>
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/cola' })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Entrar con Google
          </button>
        </form>
        <p className="text-xs text-neutral-500">
          Solo cuentas autorizadas del dominio gplusseguros.mx.
        </p>
      </div>
    </main>
  )
}
