import { useState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import {
  PRODUCT_COLUMNS as ALL_COLUMNS,
  PRODUCT_OPTIONAL_COLUMNS as OPTIONAL_COLUMNS,
  PRODUCT_REQUIRED_COLUMNS as REQUIRED_COLUMNS,
} from '@/lib/csv'
import { cn, formatINR, safeHttpUrl, slugify } from '@/lib/format'
import { toErrorMessage } from '@/lib/supabase'
import { bulkInsertProducts, existingSlugs, fetchCategories, type BulkProductRow } from '@/services/admin'
import { JEWELLERY_TYPES, OCCASIONS, STONES, type JewelleryType, type Occasion, type Stone } from '@/types'

const isHttpsUrl = (value: string) => safeHttpUrl(value)?.startsWith('https://') ?? false

const list = (v: unknown) =>
  String(v ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
const bool = (fallback: boolean) => (v: unknown) =>
  v === '' || v === undefined || v === null ? fallback : ['true', 'yes', 'y', '1'].includes(String(v).trim().toLowerCase())
const num = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(String(v).replace(/[₹,\s]/g, '')))
const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

const rowSchema = z
  .object({
    title: z.preprocess(text, z.string().min(3, 'title is required')),
    slug: z.preprocess(text, z.string()),
    telugu_title: z.preprocess(text, z.string()),
    description: z.preprocess(text, z.string()),
    category_slug: z.preprocess(text, z.string().min(1, 'category_slug is required')),
    mrp: z.preprocess(num, z.number({ required_error: 'mrp is required', invalid_type_error: 'mrp must be a number' }).positive('mrp must be > 0')),
    sale_price: z.preprocess(num, z.number({ required_error: 'sale_price is required', invalid_type_error: 'sale_price must be a number' }).positive()),
    jewellery_type: z.preprocess(
      (v) => text(v).toLowerCase(),
      z.enum(JEWELLERY_TYPES as [JewelleryType, ...JewelleryType[]], { message: `jewellery_type must be one of ${JEWELLERY_TYPES.join(', ')}` }),
    ),
    plating_type: z.preprocess(text, z.string()),
    warranty_details: z.preprocess(text, z.string()),
    available_sizes: z.preprocess(list, z.array(z.string())),
    stock_count: z.preprocess((v) => num(v) ?? 10, z.number().int('stock_count must be a whole number').min(0)),
    in_stock: z.preprocess(bool(true), z.boolean()),
    featured: z.preprocess(bool(false), z.boolean()),
    image_urls: z.preprocess(
      list,
      z.array(z.string().refine(isHttpsUrl, 'image_urls must be full https:// URLs')).min(1, 'at least one image URL is required'),
    ),
    reel_url: z.preprocess(text, z.union([z.literal(''), z.string().refine(isHttpsUrl, 'reel_url must be a full https:// URL')])),
    occasions: z.preprocess(
      (v) => list(v).map((s) => s.toLowerCase()),
      z.array(z.enum(OCCASIONS as [Occasion, ...Occasion[]], { message: `occasions must be from ${OCCASIONS.join(', ')}` })),
    ),
    stones: z.preprocess(
      (v) => list(v).map((s) => s.toLowerCase()),
      z.array(z.enum(STONES as [Stone, ...Stone[]], { message: `stones must be from ${STONES.join(', ')}` })),
    ),
  })
  .refine((r) => r.sale_price <= r.mrp, { path: ['sale_price'], message: 'sale_price cannot exceed mrp' })

interface PreviewRow {
  line: number
  raw: Record<string, unknown>
  parsed?: BulkProductRow
  errors: string[]
}

const TEMPLATE = [
  ALL_COLUMNS.join(','),
  [
    'Lakshmi Kasu Haram', '1-gram-gold-jewellery', '8999', '5499', 'nakshi-temple',
    'https://example.com/kasu-1.jpg|https://example.com/kasu-2.jpg', 'lakshmi-kasu-haram', 'లక్ష్మీ కాసుల హారం',
    '"Antique Lakshmi coin haram for weddings"', 'Micro Gold Plated', '1-Year Re-polishing Guarantee', 'Adjustable', '8', 'true', 'true',
    'https://example.com/kasu-reel.mp4', 'wedding|festival', 'kempu',
  ].join(','),
  [
    'PVD Twisted Hoop Earrings', 'anti-tarnish-waterproof-jewellery', '999', '599', 'anti-tarnish',
    'https://example.com/hoops.jpg', '', '', '', 'PVD 316L Stainless Steel', '1-Year Colour Warranty', '', '25', '', '', '', 'daily|office', 'plain',
  ].join(','),
].join('\n')

async function readRows(file: File): Promise<Record<string, unknown>[]> {
  const normalizeKey = (k: string) => k.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import('read-excel-file')
    const [header = [], ...body] = await readXlsxFile(file)
    const keys = header.map((h) => normalizeKey(String(h ?? '')))
    return body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, cells[i]])))
  }
  const { default: Papa } = await import('papaparse')
  return new Promise((resolve, reject) =>
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeKey,
      complete: (res) => resolve(res.data),
      error: reject,
    }),
  )
}

export default function BulkUploadPage() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [columnError, setColumnError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)

  const valid = rows.filter((r) => r.parsed && !r.errors.length)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!/\.(csv|xlsx)$/i.test(file.name)) return toast.error('Upload a .csv or .xlsx file')
    setFileName(file.name)
    setParsing(true)
    setColumnError(null)
    setRows([])
    try {
      const [raw, categories, slugs] = await Promise.all([readRows(file), fetchCategories(true), existingSlugs()])
      const columns = new Set(Object.keys(raw[0] ?? {}))
      const missing = REQUIRED_COLUMNS.filter((c) => !columns.has(c))
      if (!raw.length) return setColumnError('The file has no data rows.')
      if (missing.length) return setColumnError(`Missing required column(s): ${missing.join(', ')}`)

      const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]))
      const seen = new Set<string>()

      setRows(
        raw.map((r, i) => {
          const result = rowSchema.safeParse(r)
          if (!result.success) return { line: i + 2, raw: r, errors: result.error.issues.map((iss) => iss.message) }
          const v = result.data
          const slug = slugify(v.slug || v.title)
          const errors: string[] = []
          const categoryId = categoryBySlug.get(v.category_slug)
          if (!categoryId) errors.push(`unknown category_slug "${v.category_slug}"`)
          if (!slug) errors.push('add an English title or a slug column (letters, numbers, hyphens)')
          else if (slugs.has(slug)) errors.push(`slug "${slug}" already exists in the catalog`)
          if (slug && seen.has(slug)) errors.push(`duplicate slug "${slug}" in this file`)
          seen.add(slug)

          return {
            line: i + 2,
            raw: r,
            errors,
            parsed: {
              product: {
                title: v.title,
                telugu_title: v.telugu_title || null,
                slug,
                description: v.description || null,
                category_id: categoryId ?? '',
                mrp: v.mrp,
                sale_price: v.sale_price,
                jewellery_type: v.jewellery_type,
                plating_type: v.plating_type || null,
                warranty_details: v.warranty_details || null,
                available_sizes: v.available_sizes,
                occasions: [...new Set(v.occasions)],
                stones: [...new Set(v.stones)],
                stock_count: v.stock_count,
                in_stock: v.in_stock && v.stock_count > 0,
                featured: v.featured,
              },
              imageUrls: v.image_urls,
              reelUrl: v.reel_url || null,
            },
          }
        }),
      )
    } catch (e) {
      setColumnError(toErrorMessage(e, 'Could not read this file'))
    } finally {
      setParsing(false)
    }
  }

  const importValid = async () => {
    setImporting(true)
    try {
      const count = await bulkInsertProducts(valid.map((r) => r.parsed!))
      toast.success(`Imported ${count} products`)
      setRows((list) => list.filter((r) => !valid.includes(r)))
    } catch (e) {
      toast.error(toErrorMessage(e))
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'alankrita-products-template.csv' })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/products" className="rounded-lg p-2 hover:bg-slate-200" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Bulk upload</h1>
            <p className="text-sm text-slate-500">CSV or Excel (.xlsx). Separate multiple sizes / image URLs with “|”.</p>
          </div>
        </div>
        <button onClick={downloadTemplate} className="ak-btn-outline bg-white py-2.5">
          <Download className="size-4" /> CSV template
        </button>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFile(e.dataTransfer.files[0])
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed bg-white p-10 text-center transition',
          dragging ? 'border-slate-900 bg-slate-100' : 'border-slate-300 hover:border-slate-400',
        )}
      >
        {parsing ? <Loader2 className="size-10 animate-spin text-slate-400" /> : <FileSpreadsheet className="size-10 text-slate-400" />}
        <p className="font-medium">{fileName ?? 'Drag & drop your product sheet here'}</p>
        <p className="text-xs text-slate-500">
          Required: {REQUIRED_COLUMNS.join(', ')} · Optional: {OPTIONAL_COLUMNS.join(', ')}
        </p>
        <input
          type="file"
          accept=".csv,.xlsx"
          hidden
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            e.currentTarget.value = ''
          }}
        />
      </label>

      {columnError && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-4" /> {columnError}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm">
              <strong className="text-emerald-700">{valid.length} valid</strong> ·{' '}
              <strong className="text-red-600">{rows.length - valid.length} with errors</strong> of {rows.length} rows
            </p>
            <button onClick={importValid} disabled={!valid.length || importing} className="ak-btn-primary py-2.5">
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import {valid.length} valid rows
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-3">Row</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Title / slug</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Sizes</th>
                  <th className="px-3 py-3">Media</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const p = r.parsed?.product
                  const ok = !r.errors.length
                  return (
                    <tr key={r.line} className={ok ? '' : 'bg-red-50/50'}>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{r.line}</td>
                      <td className="px-3 py-2.5">
                        {ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="size-4" /> Ready
                          </span>
                        ) : (
                          <ul className="space-y-0.5 text-xs text-red-700">
                            {r.errors.map((e) => (
                              <li key={e}>• {e}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{p?.title ?? String(r.raw.title ?? '—')}</p>
                        {p && <p className="font-mono text-xs text-slate-500">{p.slug}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{String(r.raw.category_slug ?? '—')}</td>
                      <td className="px-3 py-2.5 text-xs">{p?.jewellery_type ?? String(r.raw.jewellery_type ?? '—')}</td>
                      <td className="px-3 py-2.5 text-xs">{p ? `${formatINR(p.sale_price)} / ${formatINR(p.mrp)}` : '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{p?.available_sizes.join(', ') || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.parsed ? `${r.parsed.imageUrls.length} img${r.parsed.reelUrl ? ' + reel' : ''}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
