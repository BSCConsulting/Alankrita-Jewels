import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, Loader2, Smartphone } from 'lucide-react'
import { isSupabaseConfigured, toErrorMessage } from '@/lib/supabase'
import { maskPhone, normalizeIndianMobile } from '@/lib/format'
import { MOCK_OTP, useAuthStore } from '@/stores/useAuthStore'

const phoneSchema = z.object({
  phone: z.string().refine((v) => normalizeIndianMobile(v) !== null, 'Enter a valid 10-digit Indian mobile number'),
})
const otpSchema = z.object({ otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP') })

const RESEND_SECONDS = 30

export function MobileVerificationStep() {
  const { pendingPhone, sendOtp, verifyOtp } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: '' } })
  const otpForm = useForm<z.infer<typeof otpSchema>>({ resolver: zodResolver(otpSchema), defaultValues: { otp: '' } })

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const requestOtp = async (phone: string) => {
    setServerError(null)
    try {
      await sendOtp(phone)
      setCooldown(RESEND_SECONDS)
      otpForm.reset({ otp: '' })
    } catch (e) {
      setServerError(toErrorMessage(e, 'Could not send OTP. Please try again.'))
    }
  }

  const onPhone = phoneForm.handleSubmit(({ phone }) => requestOtp(normalizeIndianMobile(phone)!))
  const onOtp = otpForm.handleSubmit(async ({ otp }) => {
    setServerError(null)
    try {
      await verifyOtp(otp)
    } catch (e) {
      setServerError(toErrorMessage(e, 'Incorrect OTP. Please try again.'))
      otpForm.setFocus('otp')
    }
  })

  return (
    <div className="ak-card p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-ink">
          <Smartphone className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold">Verify your mobile</h2>
          <p className="text-sm text-ink-muted">One-time mobile registration. No passwords to remember.</p>
        </div>
      </div>

      {!pendingPhone ? (
        <form onSubmit={onPhone} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="phone" className="ak-label">
              Mobile number
            </label>
            <div className="flex">
              <span className="grid place-items-center rounded-l-md border border-r-0 border-line bg-surface-muted px-3 text-sm font-semibold">+91</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                maxLength={14}
                className="ak-input rounded-l-none text-lg tracking-wide"
                {...phoneForm.register('phone')}
              />
            </div>
            {phoneForm.formState.errors.phone && <p className="ak-error">{phoneForm.formState.errors.phone.message}</p>}
          </div>
          <button type="submit" disabled={phoneForm.formState.isSubmitting} className="ak-btn-primary w-full py-3.5 text-base">
            {phoneForm.formState.isSubmitting ? <Loader2 className="size-5 animate-spin" /> : 'Send OTP'}
          </button>
          <p className="text-center text-xs text-ink-muted">We’ll only use your number for order updates on SMS & WhatsApp.</p>
        </form>
      ) : (
        <form onSubmit={onOtp} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="otp" className="ak-label">
              Enter the OTP sent to {maskPhone(pendingPhone)}
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              autoFocus
              className="ak-input text-center text-2xl font-semibold tracking-[0.6em]"
              {...otpForm.register('otp', {
                onChange: (e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                  otpForm.setValue('otp', digits)
                  if (digits.length === 6) void onOtp()
                },
              })}
            />
            {otpForm.formState.errors.otp && <p className="ak-error">{otpForm.formState.errors.otp.message}</p>}
            {!isSupabaseConfigured && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                <KeyRound className="size-3.5" /> Dev mode: use OTP <strong>{MOCK_OTP}</strong>
              </p>
            )}
          </div>
          <button type="submit" disabled={otpForm.formState.isSubmitting} className="ak-btn-primary w-full py-3.5 text-base">
            {otpForm.formState.isSubmitting ? <Loader2 className="size-5 animate-spin" /> : 'Verify & Continue'}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => useAuthStore.setState({ pendingPhone: null })} className="text-ink-muted hover:text-primary">
              Change number
            </button>
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={() => requestOtp(pendingPhone)}
              className="font-semibold text-primary disabled:font-normal disabled:text-ink-muted"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </form>
      )}

      {serverError && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
    </div>
  )
}
