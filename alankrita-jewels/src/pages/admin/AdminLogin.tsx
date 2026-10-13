import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Lock } from 'lucide-react'
import { isSupabaseConfigured, toErrorMessage } from '@/lib/supabase'
import { adminSignIn, currentAdminEmail } from '@/services/admin'
import { useAdminStore } from '@/stores/useAdminStore'

const schema = z.object({
  email: isSupabaseConfigured ? z.string().email('Enter a valid email') : z.string(),
  password: z.string().min(1, 'Required'),
})

export default function AdminLogin() {
  const setSession = useAdminStore((s) => s.setSession)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await adminSignIn(email, password)
      setSession(await currentAdminEmail())
    } catch (e) {
      setError(toErrorMessage(e, 'Sign in failed'))
    }
  })

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" noValidate>
        <div className="grid size-12 place-items-center rounded-full bg-slate-900 text-white">
          <Lock className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Alankrita Admin</h1>
          <p className="text-sm text-slate-500">
            {isSupabaseConfigured ? 'Sign in with your admin account.' : 'Mock mode — enter the dev passcode (VITE_ADMIN_DEV_PASSCODE).'}
          </p>
        </div>
        {isSupabaseConfigured && (
          <label className="block">
            <span className="ak-label">Email</span>
            <input type="email" autoComplete="username" className="ak-input" {...register('email')} />
            {formState.errors.email && <span className="ak-error block">{formState.errors.email.message}</span>}
          </label>
        )}
        <label className="block">
          <span className="ak-label">{isSupabaseConfigured ? 'Password' : 'Passcode'}</span>
          <input type="password" autoComplete="current-password" className="ak-input" {...register('password')} />
          {formState.errors.password && <span className="ak-error block">{formState.errors.password.message}</span>}
        </label>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={formState.isSubmitting} className="ak-btn-primary w-full">
          {formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
