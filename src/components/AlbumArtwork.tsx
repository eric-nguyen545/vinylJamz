import { useState } from 'react'
import { thumbUrl } from '../lib/normalize'

interface Props { url?: string; title: string; artist: string; size?: 250 | 500; className?: string; eager?: boolean }

/** Square cover with lazy loading and a vinyl placeholder when art is missing or fails. */
export function AlbumArtwork({ url, title, artist, size = 250, className = '', eager = false }: Props) {
  const [failed, setFailed] = useState(false)
  const src = thumbUrl(url, size)
  return (
    <div className={`relative aspect-square overflow-hidden bg-sleeve-hi ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={`Cover of ${title} by ${artist}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div role="img" aria-label={`No cover for ${title} by ${artist}`} className="flex size-full items-center justify-center">
          <svg viewBox="0 0 64 64" className="w-2/3 text-groove" aria-hidden>
            <circle cx="32" cy="32" r="30" fill="currentColor" />
            <circle cx="32" cy="32" r="21" fill="none" stroke="#14151b" strokeOpacity=".5" />
            <circle cx="32" cy="32" r="10" fill="#e3b04b" />
            <circle cx="32" cy="32" r="2.5" fill="#14151b" />
          </svg>
        </div>
      )}
    </div>
  )
}
