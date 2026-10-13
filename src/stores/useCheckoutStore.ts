import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PaymentMode, ShippingAddress } from '@/types'

export interface CheckoutDetails extends ShippingAddress {
  fullName: string
}

interface CheckoutState {
  paymentMode: PaymentMode
  details: Partial<CheckoutDetails>
  setPaymentMode: (mode: PaymentMode) => void
  saveDetails: (details: Partial<CheckoutDetails>) => void
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      paymentMode: 'PREPAID_UPI',
      details: { state: 'Telangana' },
      setPaymentMode: (paymentMode) => set({ paymentMode }),
      saveDetails: (details) => set((s) => ({ details: { ...s.details, ...details } })),
    }),
    { name: 'ak-checkout' },
  ),
)
