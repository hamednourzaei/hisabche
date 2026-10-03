'use client'

// ============================================
// A product's images (28 Sep 2026, docs/product-images-migration.sql).
//
// Up to 8, in order; the FIRST is the product's cover — the image every list
// shows. Upload, remove, move earlier/later, and alt text (what a screen
// reader and a search engine read). The server decides the type from the
// bytes and refuses a 9th; this panel only says so sooner.
//
// Beside the extra-barcodes panel, in the same shape.
// ============================================

import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react'
import {
  apiErrorMessage,
  PRODUCT_IMAGE_LIMIT,
  useAddProductImage,
  useProductImages,
  useRemoveProductImage,
  useReorderProductImages,
  useSetProductImageAlt,
  type ProductImage,
} from '@hisabche/api'

import { Button } from '../button'

type T = (key: string, fallback?: string) => string

/** Same ceiling as the server (2 MB); checked here only to say so sooner. */
const MAX_BYTES = 2 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'

const IMAGE_ERRORS = [
  'PRODUCT_IMAGE_LIMIT',
  'PRODUCT_IMAGE_TYPE',
  'PRODUCT_IMAGE_TOO_LARGE',
  'PRODUCT_IMAGE_EMPTY',
  'PRODUCT_IMAGES_NOT_CONFIGURED',
] as const

function statusOf(error: unknown): number | null {
  const e = error as { status?: unknown; response?: { status?: unknown } } | null
  const status = e?.status ?? e?.response?.status
  return typeof status === 'number' ? status : null
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

export function ProductImagesPanel({
  t,
  productId,
  productName,
}: {
  t: T
  productId: string
  /** Suggested alt text for a new image. */
  productName: string
}) {
  const images = useProductImages(productId)
  const add = useAddProductImage(productId)
  const remove = useRemoveProductImage(productId)
  const reorder = useReorderProductImages(productId)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const fail = (err: unknown, fallbackKey: string) => {
    const message = apiErrorMessage(err, t(fallbackKey))
    const code = IMAGE_ERRORS.find((c) => message.startsWith(c))
    setError(code ? t(`productImages.errors.${code}`) : message)
  }

  const rows = images.data ?? []
  const full = rows.length >= PRODUCT_IMAGE_LIMIT

  const upload = async (files: FileList | null) => {
    setError(null)
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      // One at a time, in the order chosen: each lands at the end.
      for (const file of Array.from(files).slice(0, PRODUCT_IMAGE_LIMIT - rows.length)) {
        if (file.size > MAX_BYTES) {
          setError(t('productImages.errors.PRODUCT_IMAGE_TOO_LARGE'))
          continue
        }
        await add.mutateAsync({ base64: await readBase64(file), altText: productName })
      }
      if (files.length > PRODUCT_IMAGE_LIMIT - rows.length) {
        setError(t('productImages.errors.PRODUCT_IMAGE_LIMIT'))
      }
    } catch (err) {
      fail(err, 'productImages.addFailed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const move = (index: number, delta: -1 | 1) => {
    const next = rows.map((row) => row.id)
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setError(null)
    reorder.mutate(next, { onError: (err) => fail(err, 'productImages.reorderFailed') })
  }

  const notConfigured = images.isError && statusOf(images.error) === 503

  return (
    <section
      className="space-y-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] p-4"
      data-product-images=""
    >
      <div className="flex items-center gap-2">
        <ImagePlus className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{t('productImages.title')}</h3>
        <span className="ms-auto text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
          {rows.length}/{PRODUCT_IMAGE_LIMIT}
        </span>
      </div>
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('productImages.hint')}</p>

      {/* §7.3/§7.6: not set up, failed and empty are three different answers. */}
      {notConfigured ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('productImages.notConfigured')}</p>
      ) : images.isError ? (
        <div
          role="alert"
          className="flex items-center gap-2 text-xs text-[hsl(var(--color-destructive))]"
        >
          {t('productImages.loadFailed')}
          <Button type="button" size="sm" variant="ghost" onClick={() => void images.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : images.isLoading ? null : (
        <>
          {rows.length === 0 ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('productImages.empty')}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {rows.map((row, index) => (
                <ImageTile
                  key={row.id}
                  t={t}
                  productId={productId}
                  image={row}
                  isFirst={index === 0}
                  isLast={index === rows.length - 1}
                  busy={reorder.isPending || remove.isPending}
                  onMove={(delta) => move(index, delta)}
                  onRemove={() => {
                    setError(null)
                    remove.mutate(row.id, {
                      onError: (err) => fail(err, 'productImages.removeFailed'),
                    })
                  }}
                />
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              id={`product-images-${productId}`}
              disabled={full || uploading}
              onChange={(event) => void upload(event.target.files)}
            />
            <Button
              type="button"
              size="sm"
              disabled={full || uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              {uploading ? t('productImages.uploading') : t('productImages.add')}
            </Button>
            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
              {full ? t('productImages.full') : t('productImages.formats')}
            </span>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function ImageTile({
  t,
  productId,
  image,
  isFirst,
  isLast,
  busy,
  onMove,
  onRemove,
}: {
  t: T
  productId: string
  image: ProductImage
  isFirst: boolean
  isLast: boolean
  busy: boolean
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  const setAlt = useSetProductImageAlt(productId)
  const [alt, setAltValue] = useState(image.altText)

  return (
    <li className="space-y-1.5">
      <div className="relative">
        <img
          src={image.url}
          alt={image.altText}
          width={160}
          height={160}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full rounded-md border border-[hsl(var(--border-default))] object-cover"
        />
        {isFirst ? (
          <span className="absolute start-1 top-1 rounded bg-[hsl(var(--color-primary))] px-1.5 text-[10px] text-[hsl(var(--color-primary-fg))]">
            {t('productImages.cover')}
          </span>
        ) : null}
      </div>
      <input
        value={alt}
        maxLength={200}
        aria-label={t('productImages.altText')}
        placeholder={t('productImages.altText')}
        onChange={(event) => setAltValue(event.target.value)}
        onBlur={() => {
          if (alt.trim() !== image.altText)
            setAlt.mutate({ imageId: image.id, altText: alt.trim() })
        }}
        className="h-8 w-full rounded-md border border-[hsl(var(--border-default))] bg-transparent px-2 text-xs"
      />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t('productImages.moveEarlier')}
          disabled={busy || isFirst}
          onClick={() => onMove(-1)}
        >
          {/* Earlier = up in the reading order, in either direction of text. */}
          <ArrowUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t('productImages.moveLater')}
          disabled={busy || isLast}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ms-auto"
          aria-label={t('productImages.remove')}
          disabled={busy}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}
