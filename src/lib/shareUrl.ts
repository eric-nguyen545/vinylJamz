export interface ShareUrlOptions { publicAppUrl?: string; origin: string; basePath: string }

const base = ({ publicAppUrl, origin, basePath }: ShareUrlOptions) => {
  const raw = publicAppUrl?.trim() ? publicAppUrl.trim() : `${origin}${basePath}`
  return raw.endsWith('/') ? raw : `${raw}/`
}

/** Unlisted links use the hash route so they work on GitHub Pages without server rewrites. */
export const buildShareUrl = (shareId: string, o: ShareUrlOptions): string => `${base(o)}#/public/${shareId}`

/** The public website's front page. */
export const buildSiteUrl = (o: ShareUrlOptions): string => `${base(o)}#/view`
