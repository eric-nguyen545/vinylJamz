/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Vitest replaces .css imports with an empty string, so read the stylesheet directly.
const css = readFileSync('src/styles/index.css', 'utf8')

/** WCAG relative luminance and contrast ratio. */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05) }

const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? ''

describe('colour contrast (WCAG AA, 4.5:1 for text)', () => {
  const backgrounds = ['ink', 'sleeve', 'sleeve-hi']
  const textColours = ['paper', 'dust', 'label', 'ok', 'bad', 'warn']
  for (const bg of backgrounds) for (const fg of textColours) {
    it(`${fg} text on ${bg}`, () => { expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5) })
  }
  it('dark text on the gold accent button', () => { expect(ratio(token('label-ink'), token('label'))).toBeGreaterThanOrEqual(4.5) })
  it('dark text on the red delete button', () => { expect(ratio('#000000', token('bad'))).toBeGreaterThanOrEqual(4.5) })
  it('reads every token from the stylesheet', () => { for (const t of [...backgrounds, ...textColours, 'label-ink']) expect(token(t), t).toMatch(/^#/) })
})
