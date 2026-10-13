import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OrderFilters } from '@/services/admin'

const DEFAULT_FILTERS: OrderFilters = { paymentStatus: 'ALL', orderStatus: 'ALL', paymentMode: 'ALL', search: '' }

interface AdminState {
  adminEmail: string | null
  sessionChecked: boolean
  filters: OrderFilters
  setSession: (email: string | null) => void
  setFilter: <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) => void
  resetFilters: () => void
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      adminEmail: null,
      sessionChecked: false,
      filters: DEFAULT_FILTERS,
      setSession: (adminEmail) => set({ adminEmail, sessionChecked: true }),
      setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
    }),
    { name: 'ak-admin-filters', partialize: (s) => ({ filters: s.filters }) },
  ),
)
