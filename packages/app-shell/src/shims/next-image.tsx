// Shim: next/image → plain <img>. Desktop bundles its own assets, no CDN loader.
import React, { type ImgHTMLAttributes } from 'react'

export interface NextImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | { src: string }
  alt: string
  priority?: boolean
  fill?: boolean
  quality?: number
  /** next/image option; here every image is served as is anyway. */
  unoptimized?: boolean
}

export default function Image({
  src,
  alt,
  priority: _p,
  fill,
  quality: _q,
  unoptimized: _u,
  style,
  ...rest
}: NextImageProps) {
  const resolved = typeof src === 'string' ? src : src.src
  const fillStyle = fill
    ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%' }
    : undefined

  return (
    <img src={resolved} alt={alt} loading="lazy" style={{ ...fillStyle, ...style }} {...rest} />
  )
}
