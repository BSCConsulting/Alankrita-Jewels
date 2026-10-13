import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink, FileSpreadsheet, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { JEWELLERY_TYPE_LABEL } from '@/config/collections'
import { useAsync } from '@/hooks/useAsync'
import { formatINR } from '@/lib/format'
import { toErrorMessage } from '@/lib/supabase'
import { deleteProduct, listAdminProducts, updateProductFlags } from '@/services/admin'
import { productReel, productThumbnail } from '@/services/catalog'
import type { Product } from '@/types'

export default function AdminProductsPage() {
  const { data, loading, error } = useAsync(listAdminProducts, [])
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => setProducts(data ?? []), [data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? products.filter((p) => `${p.title} ${p.telugu_title ?? ''} ${p.slug}`.toLowerCase().includes(q)) : products
  }, [products, query])

  const patch = async (p: Product, change: Partial<Pick<Product, 'in_stock' | 'featured' | 'stock_count'>>) => {
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, ...change } : x)))
    try {
      await updateProductFlags(p.id, change)
    } catch (e) {
      setProducts((list) => list.map((x) => (x.id === p.id ? p : x)))
      toast.error(toErrorMessage(e))
    }
  }

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.title}"? Past orders keep their line items.`)) return
    try {
      await deleteProduct(p.id)
      setProducts((list) => list.filter((x) => x.id !== p.id))
      toast.success('Product deleted')
    } catch (e) {
      toast.error(toErrorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-slate-500">{products.length} products in catalog</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/products/bulk" className="ak-btn-outline bg-white py-2.5">
            <FileSpreadsheet className="size-4" /> Bulk upload
          </Link>
          <Link to="/admin/products/new" className="ak-btn-primary py-2.5">
            <Plus className="size-4" /> Add product
          </Link>
        </div>
      </div>

      <label className="relative block max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="ak-input py-2.5 pl-9" />
      </label>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error.message}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">In stock</th>
              <th className="px-4 py-3">Featured</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={productThumbnail(p)} alt="" className="size-12 rounded-md object-cover" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {p.category?.name ?? 'Uncategorised'} {productReel(p) && '· 🎬 reel'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{JEWELLERY_TYPE_LABEL[p.jewellery_type]}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{formatINR(p.sale_price)}</p>
                  <p className="text-xs text-slate-400 line-through">{formatINR(p.mrp)}</p>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={p.stock_count}
                    onBlur={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0)
                      if (v !== p.stock_count) void patch(p, { stock_count: v, in_stock: v > 0 })
                    }}
                    className="w-20 rounded-md border border-slate-200 px-2 py-1"
                    aria-label={`Stock for ${p.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Toggle checked={p.in_stock} onChange={(v) => patch(p, { in_stock: v })} label="In stock" />
                </td>
                <td className="px-4 py-3">
                  <Toggle checked={p.featured} onChange={(v) => patch(p, { featured: v })} label="Featured" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="rounded-md p-2 hover:bg-slate-100" title="View on store">
                      <ExternalLink className="size-4" />
                    </a>
                    <Link to={`/admin/products/${p.id}/edit`} className="rounded-md p-2 hover:bg-slate-100" title="Edit">
                      <Pencil className="size-4" />
                    </Link>
                    <button onClick={() => remove(p)} className="rounded-md p-2 text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}
