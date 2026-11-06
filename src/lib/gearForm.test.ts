import { describe, expect, it } from 'vitest'
import { emptyGearForm, formToGear, gearToForm } from './gearForm'

const today = '2026-03-10'
describe('gear form', () => {
  it('requires a name', () => {
    const r = formToGear(emptyGearForm(), today)
    expect(!r.ok && r.errors.name).toBeTruthy()
  })
  it('accepts an item with no price or date, and drops the currency', () => {
    const r = formToGear({ ...emptyGearForm('EUR'), name: 'Old amp', category: 'amplifier' }, today)
    expect(r.ok && r.value).toMatchObject({ name: 'Old amp', category: 'amplifier' })
    expect(r.ok && r.value.currency).toBeUndefined()
    expect(r.ok && r.value.purchasePrice).toBeUndefined()
  })
  it('keeps a priced item with its currency, and allows a free item (price 0)', () => {
    const r = formToGear({ ...emptyGearForm('GBP'), name: 'Turntable', purchasePrice: '349.99', purchaseDate: '2025-12-24', condition: 'used' }, today)
    expect(r.ok && r.value).toMatchObject({ purchasePrice: 349.99, currency: 'GBP', purchaseDate: '2025-12-24', condition: 'used' })
    expect(formToGear({ ...emptyGearForm(), name: 'Gift', purchasePrice: '0' }, today).ok).toBe(true)
  })
  it('rejects negative or non-numeric prices and bad or future dates', () => {
    for (const purchasePrice of ['-1', 'abc']) expect(formToGear({ ...emptyGearForm(), name: 'X', purchasePrice }, today).ok).toBe(false)
    expect(formToGear({ ...emptyGearForm(), name: 'X', purchaseDate: '2026-03-11' }, today).ok).toBe(false)
    expect(formToGear({ ...emptyGearForm(), name: 'X', purchaseDate: '10/03/2026' }, today).ok).toBe(false)
  })
  it('round-trips stored values', () => {
    expect(gearToForm({ name: 'Speakers', category: 'speakers', purchasePrice: 500, currency: 'USD', brand: 'KEF' })).toMatchObject({ name: 'Speakers', category: 'speakers', purchasePrice: '500', currency: 'USD', brand: 'KEF' })
  })
})
