import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Film, ImagePlus, Link2, Loader2, Star, Trash2, X } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { JEWELLERY_TYPE_LABEL, THEME_BY_JEWELLERY_TYPE } from '@/config/collections'
import { useAsync } from '@/hooks/useAsync'
import { OCCASION_LABEL, STONE_LABEL } from '@/lib/filters'
import { cn, slugify } from '@/lib/format'
import { videoDuration } from '@/lib/media'
import type { PhotoSize } from '@/lib/photoChecklist'
import { toErrorMessage } from '@/lib/supabase'
import { categoriesForSelect, fetchAdminProduct, saveProduct, uploadMedia, uploadProductImage, type MediaInput } from '@/services/admin'
import { JEWELLERY_TYPES, OCCASIONS, STONES, type JewelleryType, type Occasion, type Stone } from '@/types'
import { Toggle } from './AdminProductsPage'
import { PhotoChecklist } from './PhotoChecklist'

const PLATING_PRESETS = [
  'Micro Gold Plated',
  'Micro Gold Plated (Antique Nakshi Finish)',
  'PVD 316L Stainless Steel',
  'PVD 316L Stainless Steel (18K Gold Tone)',
  'Rhodium',
  'Rose Gold Plated',
  '14K Gold Plated Brass, Nickel-Free',
]
const WARRANTY_PRESETS = ['1-Year Re-polishing Guarantee', '1-Year Colour Warranty', '6-Month Stone & Plating Guarantee', '6-Month Plating Warranty']
const SIZE_PRESETS: Record<string, string[]> = {
  Bangles: ['2.2', '2.4', '2.6', '2.8', '2.10'],
  Chains: ['16 inch', '18 inch', '24 inch', '30 inch'],
  Vaddanam: ['28', '30', '32', '34', '36', '38', '40'],
  'Free size': ['Adjustable'],
}
const MAX_REEL_MB = 50

const schema = z
  .object({
    title: z.string().trim().min(3, 'Title is required').max(120),
    telugu_title: z.string().trim().max(160).optional(),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens'),
    description: z.string().max(4000).optional(),
    category_id: z.string().min(1, 'Choose a category'),
    jewellery_type: z.enum(JEWELLERY_TYPES as [JewelleryType, ...JewelleryType[]]),
    mrp: z.number({ invalid_type_error: 'Enter MRP' }).positive(),
    sale_price: z.number({ invalid_type_error: 'Enter sale price' }).positive(),
    plating_type: z.string().max(120).optional(),
    warranty_details: z.string().max(120).optional(),
    available_sizes: z.array(z.string().trim().min(1)).max(20),
    occasions: z.array(z.enum(OCCASIONS as [Occasion, ...Occasion[]])),
    stones: z.array(z.enum(STONES as [Stone, ...Stone[]])),
    stock_count: z.number({ invalid_type_error: 'Enter stock' }).int().min(0),
    in_stock: z.boolean(),
    featured: z.boolean(),
  })
  .refine((v) => v.sale_price <= v.mrp, { path: ['sale_price'], message: 'Sale price cannot exceed MRP' })

type FormValues = z.infer<typeof schema>

interface ImageDraft {
  key: string
  url: string
  thumbUrl?: string | null
  file?: File
}

type ReelDraft = { url: string; file?: File } | null

/** Keyed by id so moving from "edit" to "add product" starts from a clean form. */
export default function ProductFormPage() {
  const { id } = useParams()
  return <ProductForm key={id ?? 'new'} id={id} />
}

function ProductForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { data: categories } = useAsync(categoriesForSelect, [])
  const { data: existing, loading: loadingExisting } = useAsync(() => (id ? fetchAdminProduct(id) : Promise.resolve(null)), [id])

  const [images, setImages] = useState<ImageDraft[]>([])
  const [thumbKey, setThumbKey] = useState<string | null>(null)
  const [photoSizes, setPhotoSizes] = useState<Record<string, PhotoSize>>({})
  const [reel, setReel] = useState<ReelDraft>(null)
  const [reelUrlInput, setReelUrlInput] = useState('')
  const [sizeInput, setSizeInput] = useState('')
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const slugTouched = useRef(isEdit)
  const fileInput = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, watch, setValue, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      telugu_title: '',
      slug: '',
      description: '',
      category_id: '',
      jewellery_type: '1-gram-gold',
      plating_type: 'Micro Gold Plated',
      warranty_details: '1-Year Re-polishing Guarantee',
      available_sizes: [],
      occasions: [],
      stones: [],
      stock_count: 10,
      in_stock: true,
      featured: false,
    },
  })
  const sizes = watch('available_sizes')
  const occasions = watch('occasions')
  const stones = watch('stones')
  const title = watch('title')
  const type = watch('jewellery_type')
  const errors = formState.errors

  useEffect(() => {
    if (!slugTouched.current) setValue('slug', slugify(title ?? ''))
  }, [title, setValue])

  useEffect(() => {
    if (!existing) return
    reset({
      title: existing.title,
      telugu_title: existing.telugu_title ?? '',
      slug: existing.slug,
      description: existing.description ?? '',
      category_id: existing.category_id ?? '',
      jewellery_type: existing.jewellery_type,
      mrp: existing.mrp,
      sale_price: existing.sale_price,
      plating_type: existing.plating_type ?? '',
      warranty_details: existing.warranty_details ?? '',
      available_sizes: existing.available_sizes,
      occasions: existing.occasions ?? [],
      stones: existing.stones ?? [],
      stock_count: existing.stock_count,
      in_stock: existing.in_stock,
      featured: existing.featured,
    })
    const imgs = existing.media.filter((m) => m.media_type === 'image').map((m) => ({ key: m.id, url: m.url, thumbUrl: m.thumb_url ?? null }))
    setImages(imgs)
    setThumbKey(existing.media.find((m) => m.is_thumbnail)?.id ?? imgs[0]?.key ?? null)
    const r = existing.media.find((m) => m.media_type === 'video_reel')
    setReel(r ? { url: r.url } : null)
  }, [existing, reset])

  const addFiles = (files: FileList | File[]) => {
    const drafts = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ key: crypto.randomUUID(), url: URL.createObjectURL(file), file }))
    if (!drafts.length) return
    setImages((list) => [...list, ...drafts])
    setThumbKey((k) => k ?? drafts[0].key)
    setMediaError(null)
  }

  const removeImage = (key: string) => {
    const removed = images.find((i) => i.key === key)
    if (removed?.file) URL.revokeObjectURL(removed.url)
    const next = images.filter((i) => i.key !== key)
    setImages(next)
    if (thumbKey === key) setThumbKey(next[0]?.key ?? null)
  }

  const onReelFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_REEL_MB * 1024 * 1024) return setMediaError(`Reel must be under ${MAX_REEL_MB} MB`)
    try {
      const seconds = await videoDuration(file)
      if (seconds < 3 || seconds > 15) return setMediaError(`Reel is ${seconds.toFixed(1)}s — it must be 3 to 15 seconds long (5–10 works best).`)
      setReel({ url: URL.createObjectURL(file), file })
      setMediaError(null)
    } catch (e) {
      setMediaError(toErrorMessage(e))
    }
  }

  const toggleSize = (s: string) =>
    setValue('available_sizes', sizes.includes(s) ? sizes.filter((x) => x !== s) : [...sizes, s], { shouldDirty: true })
  const toggleOccasion = (o: Occasion) =>
    setValue('occasions', occasions.includes(o) ? occasions.filter((x) => x !== o) : [...occasions, o], { shouldDirty: true })
  const toggleStone = (s: Stone) => setValue('stones', stones.includes(s) ? stones.filter((x) => x !== s) : [...stones, s], { shouldDirty: true })

  const onSubmit = handleSubmit(async (values) => {
    if (!images.length) return setMediaError('Add at least one product image')
    try {
      const uploadedImages: ImageDraft[] = await Promise.all(
        images.map(async (img) => (img.file ? { key: img.key, ...(await uploadProductImage(img.file)) } : img)),
      )
      // Keep the uploaded URLs so a retry after a failed save does not upload the same files again.
      images.forEach((img) => img.file && URL.revokeObjectURL(img.url))
      setImages(uploadedImages)
      let reelUrl = reel?.url
      if (reel?.file) {
        reelUrl = await uploadMedia(reel.file, 'video_reel')
        URL.revokeObjectURL(reel.url)
        setReel({ url: reelUrl })
      }

      const ordered = [...uploadedImages].sort((a, b) => Number(b.key === thumbKey) - Number(a.key === thumbKey))
      const media: MediaInput[] = ordered.map((img, i) => ({ media_type: 'image', url: img.url, thumb_url: img.thumbUrl ?? null, is_thumbnail: i === 0 }))
      if (reelUrl) media.push({ media_type: 'video_reel', url: reelUrl, is_thumbnail: false })

      await saveProduct(
        {
          ...values,
          telugu_title: values.telugu_title || null,
          description: values.description || null,
          plating_type: values.plating_type || null,
          warranty_details: values.warranty_details || null,
          in_stock: values.in_stock && values.stock_count > 0,
        },
        media,
        id,
      )
      toast.success(isEdit ? 'Product updated' : 'Product published to the store')
      navigate('/admin/products')
    } catch (e) {
      toast.error(toErrorMessage(e))
    }
  })

  if (isEdit && loadingExisting) return <Loader2 className="mx-auto mt-20 size-8 animate-spin text-slate-400" />
  if (isEdit && !existing) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        This product could not be found. It may have been deleted.
        <button type="button" onClick={() => navigate('/admin/products')} className="mt-4 block w-full font-semibold text-slate-900 underline">
          Back to products
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-slate-200" aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit product' : 'Add product'}</h1>
          <p className="text-sm text-slate-500">
            Store theme: <strong>{THEME_BY_JEWELLERY_TYPE[type] === 'heritage' ? 'Heritage Vault' : 'Modern Studio'}</strong>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Basics">
            <Field label="Title" error={errors.title?.message}>
              <input className="ak-input" placeholder="Lakshmi Nakshi Temple Vaddanam" {...register('title')} />
            </Field>
            <Field label="Telugu subtitle" error={errors.telugu_title?.message}>
              <input lang="te" className="ak-input" placeholder="లక్ష్మీ నక్షి టెంపుల్ వడ్డాణం" {...register('telugu_title')} />
            </Field>
            <Field label="URL slug" error={errors.slug?.message} hint={`/product/${watch('slug') || '…'}`}>
              <input className="ak-input font-mono text-sm" {...register('slug', { onChange: () => (slugTouched.current = true) })} />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <textarea rows={5} className="ak-input" placeholder="Occasion, craftsmanship, how it drapes…" {...register('description')} />
            </Field>
          </Card>

          <Card title="Media">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInput.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition',
                dragging ? 'border-slate-900 bg-slate-100' : 'border-slate-300 hover:border-slate-400',
              )}
            >
              <ImagePlus className="size-8 text-slate-400" />
              <p className="text-sm font-medium">Drop product photos or click to browse</p>
              <p className="text-xs text-slate-500">JPG / PNG / WebP · auto-resized to 1400px WebP before upload</p>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.currentTarget.value = ''
                }}
              />
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((img) => (
                  <div key={img.key} className={cn('group relative overflow-hidden rounded-lg border-2', img.key === thumbKey ? 'border-amber-500' : 'border-transparent')}>
                    <img
                      src={img.url}
                      alt=""
                      className="aspect-square w-full object-cover"
                      onLoad={(e) => {
                        const { naturalWidth: width, naturalHeight: height } = e.currentTarget
                        setPhotoSizes((m) => ({ ...m, [img.key]: { width, height } }))
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1">
                      <button
                        type="button"
                        onClick={() => setThumbKey(img.key)}
                        className="rounded p-2 text-white hover:bg-white/20"
                        title="Set as thumbnail"
                        aria-label="Set as thumbnail"
                      >
                        <Star className={cn('size-5', img.key === thumbKey && 'fill-amber-400 text-amber-400')} />
                      </button>
                      <button type="button" onClick={() => removeImage(img.key)} className="rounded p-2 text-white hover:bg-white/20" title="Remove" aria-label="Remove image">
                        <Trash2 className="size-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Film className="size-4" /> 5–10 second reel (9:16)
              </p>
              {reel ? (
                <div className="mt-3 flex items-start gap-3">
                  <video src={reel.url} muted loop autoPlay playsInline className="aspect-[9/16] w-24 rounded-lg bg-black object-cover" />
                  <div className="min-w-0 flex-1 text-xs text-slate-500">
                    <p className="truncate">{reel.file ? reel.file.name : reel.url}</p>
                    <button type="button" onClick={() => setReel(null)} className="mt-2 inline-flex items-center gap-1 font-semibold text-red-600">
                      <X className="size-3.5" /> Remove reel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm hover:border-slate-400">
                    <Film className="size-4" /> Upload MP4 / MOV
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      hidden
                      onChange={(e) => {
                        onReelFile(e.target.files?.[0])
                        e.currentTarget.value = ''
                      }}
                    />
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={reelUrlInput}
                      onChange={(e) => setReelUrlInput(e.target.value)}
                      placeholder="…or paste video URL"
                      className="ak-input py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!/^https?:\/\/\S+$/.test(reelUrlInput)) return setMediaError('Enter a valid https:// video URL')
                        setReel({ url: reelUrlInput })
                        setReelUrlInput('')
                      }}
                      className="rounded-lg bg-slate-900 px-3 text-white"
                      aria-label="Use video URL"
                    >
                      <Link2 className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            {mediaError && <p className="ak-error">{mediaError}</p>}
            <PhotoChecklist
              sizes={images.map((img) => photoSizes[img.key] ?? null)}
              main={(thumbKey && photoSizes[thumbKey]) || null}
              hasReel={reel != null}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Organisation">
            <Field label="Category" error={errors.category_id?.message}>
              <select className="ak-input" {...register('category_id')}>
                <option value="">Select…</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jewellery type" error={errors.jewellery_type?.message}>
              <select className="ak-input" {...register('jewellery_type')}>
                {JEWELLERY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {JEWELLERY_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <TagPicker label="Occasions" hint="Powers the shop-by-occasion filters" options={OCCASIONS} labels={OCCASION_LABEL} selected={occasions} onToggle={toggleOccasion} />
            <TagPicker label="Stones" hint="Powers the stone colour filter" options={STONES} labels={STONE_LABEL} selected={stones} onToggle={toggleStone} />
          </Card>

          <Card title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <Field label="MRP (₹)" error={errors.mrp?.message}>
                <input type="number" min={1} className="ak-input" {...register('mrp', { valueAsNumber: true })} />
              </Field>
              <Field label="Sale price (₹)" error={errors.sale_price?.message}>
                <input type="number" min={1} className="ak-input" {...register('sale_price', { valueAsNumber: true })} />
              </Field>
            </div>
          </Card>

          <Card title="Plating & warranty">
            <Field label="Plating specification">
              <input list="plating-presets" className="ak-input" {...register('plating_type')} />
              <datalist id="plating-presets">
                {PLATING_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Warranty">
              <input list="warranty-presets" className="ak-input" {...register('warranty_details')} />
              <datalist id="warranty-presets">
                {WARRANTY_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
          </Card>

          <Card title="Sizes & stock">
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-white">
                  {s}
                  <button type="button" onClick={() => toggleSize(s)} aria-label={`Remove ${s}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {!sizes.length && <span className="text-xs text-slate-500">No sizes — sold as a single free-size piece.</span>}
            </div>
            <div className="flex gap-2">
              <input
                value={sizeInput}
                onChange={(e) => setSizeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (sizeInput.trim() && !sizes.includes(sizeInput.trim())) toggleSize(sizeInput.trim())
                    setSizeInput('')
                  }
                }}
                placeholder="Add size, press Enter"
                className="ak-input py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              {Object.entries(SIZE_PRESETS).map(([group, list]) => (
                <div key={group} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-16 text-xs text-slate-500">{group}</span>
                  {list.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSize(s)}
                      className={cn('rounded-full border px-2 py-0.5 text-xs', sizes.includes(s) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <Field label="Stock count" error={errors.stock_count?.message}>
              <input type="number" min={0} className="ak-input" {...register('stock_count', { valueAsNumber: true })} />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">In stock</span>
              <Toggle checked={watch('in_stock')} onChange={(v) => setValue('in_stock', v)} label="In stock" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Featured on home page</span>
              <Toggle checked={watch('featured')} onChange={(v) => setValue('featured', v)} label="Featured" />
            </div>
          </Card>

          <button type="submit" disabled={formState.isSubmitting} className="ak-btn-primary w-full py-3.5">
            {formState.isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Uploading…
              </>
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Publish product'
            )}
          </button>
        </div>
      </div>
    </form>
  )
}

function TagPicker<T extends string>({
  label,
  hint,
  options,
  labels,
  selected,
  onToggle,
}: {
  label: string
  hint: string
  options: T[]
  labels: Record<T, string>
  selected: T[]
  onToggle: (value: T) => void
}) {
  return (
    <div>
      <span className="ak-label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={selected.includes(o)}
            onClick={() => onToggle(o)}
            className={cn('rounded-full border px-2.5 py-1 text-xs', selected.includes(o) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300')}
          >
            {labels[o]}
          </button>
        ))}
      </div>
      <span className="mt-1 block text-xs text-slate-500">{hint}</span>
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="ak-label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="ak-error block">{error}</span>}
    </label>
  )
}
