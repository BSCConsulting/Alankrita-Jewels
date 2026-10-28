import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import {
  BellRing,
  FileSpreadsheet,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquareHeart,
  Package,
  PlusCircle,
  ShoppingCart,
  TicketPercent,
  X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { cn } from '@/lib/format'
import { useSeo } from '@/lib/seo'
import { adminSignOut, currentAdminEmail } from '@/services/admin'
import { useAdminStore } from '@/stores/useAdminStore'
import AdminLogin from './AdminLogin'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareHeart },
  { to: '/admin/offers', label: 'Offers & Gift Cards', icon: TicketPercent },
  { to: '/admin/stock-alerts', label: 'Stock Alerts', icon: BellRing },
  { to: '/admin/products', label: 'Products', icon: Package, end: true },
  { to: '/admin/products/new', label: 'Add Product', icon: PlusCircle },
  { to: '/admin/products/bulk', label: 'Bulk Upload', icon: FileSpreadsheet },
]

export default function AdminLayout() {
  useSeo({ title: 'Admin', noindex: true })
  const { adminEmail, sessionChecked, setSession } = useAdminStore()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    currentAdminEmail().then(setSession, () => setSession(null))
    if (!supabase) return
    // An expired or revoked session would otherwise leave the panel open while every save silently fails.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setSession(null)
      else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Supabase calls must not run inside this callback (it holds the auth lock).
        setTimeout(() => currentAdminEmail().then(setSession, () => setSession(null)), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [setSession])

  const shell = (children: ReactNode) => (
    <div data-theme="modern" className="min-h-screen bg-slate-50 font-admin text-slate-800">
      {children}
    </div>
  )

  if (!sessionChecked) return shell(<Loader2 className="mx-auto mt-40 size-8 animate-spin text-slate-400" />)
  if (!adminEmail) return shell(<AdminLogin />)

  const sidebar = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setNavOpen(false)}
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')
          }
        >
          <Icon className="size-4" /> {label}
        </NavLink>
      ))}
    </nav>
  )

  const account = (
    <div className="mt-auto border-t border-slate-200 p-3">
      <p className="truncate px-3 pb-2 text-xs text-slate-500">{adminEmail}</p>
      <button
        onClick={async () => {
          await adminSignOut()
          setNavOpen(false)
          setSession(null)
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  )

  return shell(
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="font-bold">Alankrita Admin</p>
          <p className="text-xs text-slate-500">{isSupabaseConfigured ? 'Supabase connected' : 'Mock mode (local data)'}</p>
        </div>
        {sidebar}
        {account}
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white pt-[env(safe-area-inset-top)] shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="font-bold">Alankrita Admin</p>
              <button onClick={() => setNavOpen(false)} className="-m-2 p-2" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {sidebar}
            {account}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <button onClick={() => setNavOpen(true)} className="-m-2 p-2" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <p className="font-semibold">Alankrita Admin</p>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>,
  )
}
