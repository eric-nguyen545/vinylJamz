import { z } from 'zod'
import type { Timestamp } from 'firebase/firestore'

/** Calendar date, no timezone: YYYY-MM-DD (documented policy for purchase dates). */
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const optionalText = (max = 500) => z.string().trim().max(max).optional()
/** Links must be http(s). A plain z.string().url() also accepts javascript: and data: URLs. */
export const httpUrl = z.string().max(2000).url().refine((u) => /^https?:\/\//i.test(u), 'Use an http or https link')
const currency = z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code')

export const trackSchema = z.object({
  id: z.string().min(1),
  position: z.string().max(20),
  title: z.string().min(1).max(300),
  durationMs: z.number().int().nonnegative().optional(),
})
export type Track = z.infer<typeof trackSchema>

export const CONDITIONS = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'] as const
export const FORMATS = ['LP', '12"', '10"', '7"', 'EP', 'Box set', 'Other'] as const

export const albumInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  sortTitle: z.string().max(300),
  artistNames: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
  primaryArtist: z.string().trim().min(1).max(200),
  releaseDate: optionalText(10),
  releaseYear: z.number().int().min(1850).max(2200).optional(),
  genres: z.array(z.string().max(80)).max(30).default([]),
  styles: z.array(z.string().max(80)).max(30).default([]),
  labelNames: z.array(z.string().max(200)).max(20).default([]),
  description: optionalText(5000),
  artworkUrl: httpUrl.optional(),
  musicBrainzReleaseGroupId: z.string().uuid().optional(),
  musicBrainzReleaseId: z.string().uuid().optional(),
  discogsReleaseId: z.string().max(40).optional(),
  /** Discogs 'master' (the album as a whole), used for stable IDs and duplicate detection. */
  discogsMasterId: z.string().max(40).optional(),
  /** Snapshot of Discogs community numbers, refreshed on demand. */
  discogsStats: z.object({
    rating: z.number().min(0).max(5).optional(), ratingCount: z.number().int().nonnegative().optional(),
    have: z.number().int().nonnegative().optional(), want: z.number().int().nonnegative().optional(),
    forSale: z.number().int().nonnegative().optional(), fetchedAt: z.string().max(40),
  }).optional(),
  tracklist: z.array(trackSchema).max(200).default([]),
  externalIdentifiers: z.record(z.string(), z.string()).default({}),
  metadataSources: z.array(z.string()).default([]),
  /** Owner corrections; original provider metadata is preserved in the main fields. */
  metadataOverrides: z.record(z.string(), z.unknown()).default({}),
  archived: z.boolean().default(false),
  /** Maintained transactionally with copies: true when copyCount > 0. */
  owned: z.boolean().default(false),
  copyCount: z.number().int().nonnegative().default(0),
  /** normalized "artist|title" used only to suggest possible duplicates. */
  normalizedKey: z.string().max(500).optional(),
})
export type AlbumInput = z.infer<typeof albumInputSchema>

export const copyInputSchema = z.object({
  albumId: z.string().min(1),
  releaseId: optionalText(60),
  catalogNumber: optionalText(60),
  barcode: optionalText(32),
  releaseCountry: optionalText(60),
  pressingYear: z.number().int().min(1850).max(2200).optional(),
  releaseDate: optionalText(10),
  label: optionalText(200),
  format: z.enum(FORMATS).default('LP'),
  discCount: z.number().int().min(1).max(50).default(1),
  vinylColor: optionalText(80),
  editionNotes: optionalText(1000),
  recordCondition: z.enum(CONDITIONS).optional(),
  sleeveCondition: z.enum(CONDITIONS).optional(),
  purchaseDate: dateString.optional(),
  purchasePrice: z.number().nonnegative().max(1_000_000).optional(),
  currency: currency.optional(),
  seller: optionalText(200),
  purchaseLocationId: optionalText(60),
  privateNotes: optionalText(5000),
})
export type CopyInput = z.infer<typeof copyInputSchema>

export const reviewInputSchema = z.object({
  /** Always stored on a canonical 0-10 scale; converted to the display scale in the UI. */
  rating: z.number().min(0).max(10).optional(),
  review: optionalText(10000),
  vibes: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  topThreeTrackIds: z.array(z.string()).max(3).default([]),
  trackRatings: z.record(z.string(), z.number().min(0).max(100)).default({}),
  favoriteMoments: z.array(z.string().max(500)).max(50).default([]),
  firstListenedAt: dateString.optional(),
  isFavorite: z.boolean().default(false),
})
export type ReviewInput = z.infer<typeof reviewInputSchema>

export const WANT_STATUSES = ['want', 'researching', 'found', 'purchased', 'no-longer-interested'] as const
export type WantStatus = (typeof WANT_STATUSES)[number]
export const ACTIVE_WANT_STATUSES: WantStatus[] = ['want', 'researching', 'found']
export const wantlistInputSchema = z.object({
  albumId: z.string().min(1),
  desiredReleaseId: optionalText(60),
  desiredPressingNotes: optionalText(1000),
  targetPrice: z.number().nonnegative().optional(),
  currency: currency.optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(WANT_STATUSES).default('want'),
  notes: optionalText(5000),
  purchasedCopyId: optionalText(60),
  /** Display snapshot of the album so the wantlist page needs no per-item album reads. */
  albumTitle: optionalText(300),
  primaryArtist: optionalText(200),
  artworkUrl: httpUrl.optional(),
  releaseYear: z.number().int().min(1850).max(2200).optional(),
})
export type WantlistInput = z.infer<typeof wantlistInputSchema>

export const listeningSessionInputSchema = z.object({
  albumId: z.string().min(1),
  date: z.string().min(10).max(32),
  completedAlbum: z.boolean().default(true),
  locationText: optionalText(200),
  vibeTags: z.array(z.string().max(40)).max(30).default([]),
  notes: optionalText(5000),
  /** Display snapshot so the journal needs no per-session album reads. */
  albumTitle: optionalText(300),
  primaryArtist: optionalText(200),
  artworkUrl: httpUrl.optional(),
})
export type ListeningSessionInput = z.infer<typeof listeningSessionInputSchema>

export const purchaseLocationInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: optionalText(400),
  /** Never geocoded automatically; missing coordinates mean "unlocated". */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  coordinatesVerified: z.boolean().default(false),
  source: z.enum(['manual', 'geocoder']).default('manual'),
  notes: optionalText(2000),
})
export type PurchaseLocationInput = z.infer<typeof purchaseLocationInputSchema>

export const OBSERVATION_TYPES = ['listing', 'sold', 'estimate', 'manual'] as const
export const priceObservationInputSchema = z.object({
  albumId: z.string().min(1),
  copyId: optionalText(60),
  releaseId: optionalText(60),
  provider: z.string().min(1).max(40),
  observationType: z.enum(OBSERVATION_TYPES),
  price: z.number().nonnegative(),
  currency,
  condition: optionalText(20),
  observedAt: z.string().min(10).max(32),
  sourceUrl: httpUrl.optional(),
  dataQuality: z.enum(['exact-match', 'probable-match', 'album-level', 'manual']).default('manual'),
})
export type PriceObservationInput = z.infer<typeof priceObservationInputSchema>

export const preferencesSchema = z.object({
  ratingMax: z.union([z.literal(5), z.literal(10), z.literal(100)]).default(10),
  defaultCurrency: currency.default('USD'),
})
export type Preferences = z.infer<typeof preferencesSchema>
export const defaultPreferences: Preferences = preferencesSchema.parse({})

/** Firestore bookkeeping attached to a validated input. */
export type Stored<T> = T & { id: string; createdAt: Timestamp; updatedAt: Timestamp }

/* ---------------- public sharing ---------------- */
export const publicFieldOptionsSchema = z.object({
  artwork: z.boolean(),
  tracklist: z.boolean(),
  rating: z.boolean(),
  review: z.boolean(),
  vibes: z.boolean(),
  topTracks: z.boolean(),
  pressingSummary: z.boolean(),
  /** Discogs community numbers snapshot (rating, have/want, for sale). */
  discogsStats: z.boolean().default(false),
  /** Notes on listening-journal entries. Places are never published. */
  journalNotes: z.boolean().default(false),
  /** What you paid: album purchases, gear costs, wantlist target prices. */
  money: z.boolean().default(false),
})
export type PublicFieldOptions = z.infer<typeof publicFieldOptionsSchema>

/** Nothing sensitive is public until the owner opts in per field. */
export const defaultPublicFieldOptions: PublicFieldOptions = {
  artwork: true, tracklist: true, rating: false, review: false, vibes: false, topTracks: false, pressingSummary: false,
  discogsStats: false, journalNotes: false, money: false,
}

export const PUBLIC_SECTIONS = ['collection', 'wantlist', 'journal', 'gear', 'places', 'stats'] as const
export type PublicSection = (typeof PUBLIC_SECTIONS)[number]
export const publicSectionsSchema = z.object({
  collection: z.boolean().default(true), wantlist: z.boolean().default(false), journal: z.boolean().default(false),
  gear: z.boolean().default(false), places: z.boolean().default(false), stats: z.boolean().default(false),
})
export type PublicSections = z.infer<typeof publicSectionsSchema>
export const defaultPublicSections: PublicSections = { collection: true, wantlist: false, journal: false, gear: false, places: false, stats: false }

export const VISIBILITY_MODES = ['off', 'unlisted', 'public'] as const
export type VisibilityMode = (typeof VISIBILITY_MODES)[number]

export const sharingSettingsSchema = z.preprocess(
  // Settings saved before visibility modes existed had a boolean `enabled`.
  (v) => (v && typeof v === 'object' && !('mode' in v) ? { ...(v as Record<string, unknown>), mode: (v as { enabled?: unknown }).enabled === true ? 'unlisted' : 'off' } : v),
  z.object({
    shareId: z.string().regex(/^[0-9a-f]{32}$/),
    mode: z.enum(VISIBILITY_MODES).default('off'),
    displayName: z.string().trim().min(1).max(80).default('My vinyl collection'),
    bio: z.string().trim().max(500).optional(),
    sections: publicSectionsSchema.default(defaultPublicSections),
    fieldOptions: publicFieldOptionsSchema.default(defaultPublicFieldOptions),
  }),
)
export type SharingSettings = z.infer<typeof sharingSettingsSchema>

/** Shape of a published album document (lenient: it is read by anonymous visitors). */
export const publicAlbumSchema = z.object({
  title: z.string(),
  artistNames: z.array(z.string()).default([]),
  releaseYear: z.number().optional(),
  genres: z.array(z.string()).default([]),
  artworkUrl: httpUrl.optional(),
  tracklist: z.array(trackSchema).optional(),
  rating: z.number().min(0).max(10).optional(),
  review: z.string().optional(),
  vibes: z.array(z.string()).optional(),
  topThreeTracks: z.array(z.string()).optional(),
  publicPressingSummary: z.array(z.string()).optional(),
  discogs: z.object({
    rating: z.number().optional(), ratingCount: z.number().optional(), have: z.number().optional(), want: z.number().optional(),
    forSale: z.number().optional(), url: httpUrl.optional(),
  }).optional(),
  purchases: z.array(z.object({ date: z.string().optional(), price: z.number(), currency: z.string() })).optional(),
})

export const publicWantSchema = z.object({
  albumTitle: z.string(), primaryArtist: z.string().optional(), artworkUrl: httpUrl.optional(), releaseYear: z.number().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'), status: z.string().optional(), desiredPressingNotes: z.string().optional(),
  targetPrice: z.number().optional(), currency: z.string().optional(),
})
export const publicListenSchema = z.object({
  albumTitle: z.string(), primaryArtist: z.string().optional(), artworkUrl: httpUrl.optional(), date: z.string(),
  completedAlbum: z.boolean().default(true), vibeTags: z.array(z.string()).default([]), notes: z.string().optional(),
})
export const publicGearSchema = z.object({
  name: z.string(), category: z.string().default('other'), brand: z.string().optional(), model: z.string().optional(), condition: z.string().optional(),
  purchaseDate: z.string().optional(), purchasePrice: z.number().optional(), currency: z.string().optional(),
})
export const publicPlaceSchema = z.object({ name: z.string(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })

export const pricingSettingsSchema = z.object({
  /** Personal Discogs token; stored in the owner's private settings and only sent to api.discogs.com. */
  discogsToken: z.string().trim().min(10).max(200).optional(),
  /** Alternative: a Discogs application's consumer key and secret (both required together). */
  discogsKey: z.string().trim().min(8).max(100).optional(),
  discogsSecret: z.string().trim().min(8).max(100).optional(),
}).refine((v) => (v.discogsKey === undefined) === (v.discogsSecret === undefined), { message: 'Enter both the key and the secret.' })
export type PricingSettings = z.infer<typeof pricingSettingsSchema>

/* ---------------- gear (equipment and accessories) ---------------- */
export const GEAR_CATEGORIES = ['turntable', 'cartridge', 'phono-preamp', 'amplifier', 'speakers', 'headphones', 'cables', 'cleaning', 'storage', 'accessories', 'other'] as const
export type GearCategory = (typeof GEAR_CATEGORIES)[number]
export const GEAR_CONDITIONS = ['new', 'used', 'refurbished'] as const

export const gearInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(GEAR_CATEGORIES).default('other'),
  brand: optionalText(100),
  model: optionalText(100),
  condition: z.enum(GEAR_CONDITIONS).optional(),
  purchaseDate: dateString.optional(),
  purchasePrice: z.number().nonnegative().max(1_000_000).optional(),
  currency: currency.optional(),
  seller: optionalText(200),
  notes: optionalText(5000),
})
export type GearInput = z.infer<typeof gearInputSchema>
