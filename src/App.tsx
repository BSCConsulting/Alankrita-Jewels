import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Loader2 } from 'lucide-react'
import { RouteError } from '@/components/layout/RouteError'
import { StoreLayout } from '@/components/layout/StoreLayout'
import { Toaster } from '@/components/ui/Toaster'
import HomePage from '@/pages/HomePage'
import CollectionPage from '@/pages/CollectionPage'
import ProductPage from '@/pages/ProductPage'
import NotFoundPage from '@/pages/NotFoundPage'
import { ThemeProvider } from '@/theme/ThemeProvider'

const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'))
const OrderSuccessPage = lazy(() => import('@/pages/OrderSuccessPage'))
const PolicyPage = lazy(() => import('@/pages/PolicyPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const MyOrdersPage = lazy(() => import('@/pages/MyOrdersPage'))
const WishlistPage = lazy(() => import('@/pages/WishlistPage'))
const BridalSetPage = lazy(() => import('@/pages/BridalSetPage'))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage'))
const ProductFormPage = lazy(() => import('@/pages/admin/ProductFormPage'))
const BulkUploadPage = lazy(() => import('@/pages/admin/BulkUploadPage'))
const OrdersPage = lazy(() => import('@/pages/admin/OrdersPage'))
const ReviewsPage = lazy(() => import('@/pages/admin/ReviewsPage'))
const OffersPage = lazy(() => import('@/pages/admin/OffersPage'))
const StockAlertsPage = lazy(() => import('@/pages/admin/StockAlertsPage'))

const suspend = (node: ReactNode) => (
  <Suspense fallback={<Loader2 className="mx-auto my-24 size-8 animate-spin text-ink-muted" />}>{node}</Suspense>
)

const router = createBrowserRouter([
  {
    path: '/',
    element: <StoreLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'collections/:slug', element: <CollectionPage /> },
      { path: 'collections/:group/:slug', element: <CollectionPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'checkout', element: suspend(<CheckoutPage />) },
      { path: 'order/:orderNumber', element: suspend(<OrderSuccessPage />) },
      { path: 'orders', element: suspend(<MyOrdersPage />) },
      { path: 'search', element: suspend(<SearchPage />) },
      { path: 'wishlist', element: suspend(<WishlistPage />) },
      { path: 'bridal-set', element: suspend(<BridalSetPage />) },
      { path: 'policies/:slug', element: suspend(<PolicyPage />) },
      { path: 'contact', element: suspend(<PolicyPage slug="contact" />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: suspend(<AdminLayout />),
    errorElement: <RouteError />,
    children: [
      { index: true, element: suspend(<AdminDashboard />) },
      { path: 'orders', element: suspend(<OrdersPage />) },
      { path: 'reviews', element: suspend(<ReviewsPage />) },
      { path: 'offers', element: suspend(<OffersPage />) },
      { path: 'stock-alerts', element: suspend(<StockAlertsPage />) },
      { path: 'products', element: suspend(<AdminProductsPage />) },
      { path: 'products/new', element: suspend(<ProductFormPage />) },
      { path: 'products/bulk', element: suspend(<BulkUploadPage />) },
      { path: 'products/:id/edit', element: suspend(<ProductFormPage />) },
    ],
  },
])

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  )
}
