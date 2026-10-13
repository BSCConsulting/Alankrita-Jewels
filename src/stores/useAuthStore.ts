import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { isFirebaseConfigured } from '@/lib/firebaseConfig'
import { restoreCustomerSession, sendFirebaseOtp, signOutCustomer, verifyFirebaseOtp } from '@/lib/customerSession'

/** Development OTP accepted when Supabase is not configured. */
export const MOCK_OTP = '123456'

/** Element id for Firebase's invisible reCAPTCHA; rendered by MobileVerificationStep. */
export const RECAPTCHA_CONTAINER_ID = 'ak-recaptcha'

interface AuthState {
  phone: string | null
  userId: string | null
  fullName: string | null
  pendingPhone: string | null
  initialized: boolean
  init: () => Promise<void>
  sendOtp: (phoneE164: string) => Promise<void>
  verifyOtp: (code: string) => Promise<void>
  setFullName: (name: string) => void
  signOut: () => Promise<void>
}

const phoneFromUser = (user: User | null | undefined) => (user?.phone ? `+${user.phone.replace(/^\+/, '')}` : null)

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      phone: null,
      userId: null,
      fullName: null,
      pendingPhone: null,
      initialized: false,

      init: async () => {
        if (get().initialized) return
        if (!supabase) {
          set({ initialized: true })
          return
        }
        if (isFirebaseConfigured) {
          const session = await restoreCustomerSession()
          set({ initialized: true, userId: session?.userId ?? null, phone: session?.phone ?? null })
          return
        }
        const { data } = await supabase.auth.getSession()
        const user = data.session?.user
        set({ initialized: true, userId: user?.id ?? null, phone: phoneFromUser(user) })
        supabase.auth.onAuthStateChange((_event, session) => {
          set({ userId: session?.user.id ?? null, phone: phoneFromUser(session?.user) })
        })
      },

      sendOtp: async (phoneE164) => {
        if (supabase && isFirebaseConfigured) {
          await sendFirebaseOtp(phoneE164, RECAPTCHA_CONTAINER_ID)
        } else if (supabase) {
          const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 })
          if (error) throw error
        }
        set({ pendingPhone: phoneE164 })
      },

      verifyOtp: async (code) => {
        const phone = get().pendingPhone
        if (!phone) throw new Error('Please request an OTP first')
        if (!supabase) {
          if (code !== MOCK_OTP) throw new Error('Incorrect OTP. Please try again.')
          set({ phone, userId: `mock-${phone}`, pendingPhone: null })
          return
        }
        if (isFirebaseConfigured) {
          const session = await verifyFirebaseOtp(code)
          set({ phone: session.phone, userId: session.userId, pendingPhone: null })
          return
        }
        const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
        if (error) throw error
        set({ phone: phoneFromUser(data.user) ?? phone, userId: data.user?.id ?? null, pendingPhone: null })
      },

      setFullName: (fullName) => set({ fullName }),

      signOut: async () => {
        if (isFirebaseConfigured) await signOutCustomer()
        else await supabase?.auth.signOut()
        set({ phone: null, userId: null, pendingPhone: null })
      },
    }),
    {
      name: 'ak-auth',
      // With Supabase the session itself is the source of truth; only persist identity in mock mode.
      partialize: (s) => (supabase ? { fullName: s.fullName } : { phone: s.phone, userId: s.userId, fullName: s.fullName }),
    },
  ),
)
