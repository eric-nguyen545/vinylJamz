/**
 * Content Security Policy for the production build (opt-in with VITE_ENABLE_CSP=true).
 * Delivered as a <meta> tag because GitHub Pages can't set headers. apis.google.com and the
 * firebaseapp/web.app frames are allowed because Firebase Auth can proactively load its helper
 * iframe on Safari and mobile browsers.
 */
export function buildCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.googleapis.com https://musicbrainz.org https://nominatim.openstreetmap.org https://api.discogs.com",
    "frame-src https://*.firebaseapp.com https://*.web.app",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
