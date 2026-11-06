import { dateString, gearInputSchema, GEAR_CATEGORIES, type GearCategory, type GearInput } from './schemas'
import type { FormErrors, Result } from './formState'
import { todayLocal } from './format'

export const GEAR_CATEGORY_LABEL: Record<GearCategory, string> = {
  turntable: 'Turntable', cartridge: 'Cartridge and stylus', 'phono-preamp': 'Phono preamp', amplifier: 'Amplifier or receiver', speakers: 'Speakers',
  headphones: 'Headphones', cables: 'Cables and power', cleaning: 'Cleaning and care', storage: 'Shelving and storage', accessories: 'Accessories', other: 'Other',
}

export interface GearFormState {
  name: string; category: GearCategory; brand: string; model: string; condition: '' | 'new' | 'used' | 'refurbished'
  purchaseDate: string; purchasePrice: string; currency: string; seller: string; notes: string
}

export const emptyGearForm = (currency = 'USD'): GearFormState => ({ name: '', category: 'turntable', brand: '', model: '', condition: '', purchaseDate: '', purchasePrice: '', currency, seller: '', notes: '' })

export const gearToForm = (g: Partial<GearInput>, currency = 'USD'): GearFormState => ({
  name: g.name ?? '', category: g.category ?? 'other', brand: g.brand ?? '', model: g.model ?? '', condition: g.condition ?? '',
  purchaseDate: g.purchaseDate ?? '', purchasePrice: g.purchasePrice === undefined ? '' : String(g.purchasePrice), currency: g.currency ?? currency, seller: g.seller ?? '', notes: g.notes ?? '',
})

export function formToGear(f: GearFormState, today = todayLocal()): Result<GearInput> {
  const errors: FormErrors = {}
  const priced = f.purchasePrice.trim() !== ''
  const price = priced ? Number(f.purchasePrice) : undefined
  if (priced && (!Number.isFinite(price) || (price ?? 0) < 0)) errors.purchasePrice = 'Enter a price of 0 or more.'
  if (f.purchaseDate) {
    if (!dateString.safeParse(f.purchaseDate).success) errors.purchaseDate = 'Enter a valid date.'
    else if (f.purchaseDate > today) errors.purchaseDate = 'The date can’t be in the future.'
  }
  if (Object.keys(errors).length) return { ok: false, errors }
  const parsed = gearInputSchema.safeParse({
    name: f.name, category: f.category, brand: f.brand.trim() || undefined, model: f.model.trim() || undefined, condition: f.condition || undefined,
    purchaseDate: f.purchaseDate || undefined, purchasePrice: price, currency: priced ? f.currency : undefined,
    seller: f.seller.trim() || undefined, notes: f.notes.trim() || undefined,
  })
  if (parsed.success) return { ok: true, value: parsed.data }
  for (const i of parsed.error.issues) errors[String(i.path[0] ?? 'form')] ??= i.message
  return { ok: false, errors }
}

export { GEAR_CATEGORIES }
