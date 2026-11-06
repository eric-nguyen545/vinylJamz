import { describe, expect, it } from 'vitest'
import { escapeCell, toCsv } from './csv'

describe('csv', () => {
  it('quotes commas, quotes and newlines per RFC 4180', () => {
    expect(escapeCell('a,b')).toBe('"a,b"')
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeCell('plain')).toBe('plain')
  })
  it('renders empty, boolean and numeric cells', () => {
    expect(escapeCell(undefined)).toBe('')
    expect(escapeCell(null)).toBe('')
    expect(escapeCell(true)).toBe('yes')
    expect(escapeCell(false)).toBe('no')
    expect(escapeCell(12.5)).toBe('12.5')
    expect(escapeCell(-3)).toBe('-3')
    expect(escapeCell(Number.NaN)).toBe('')
  })
  it('neutralizes spreadsheet formulas in text but not in numbers', () => {
    expect(escapeCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    for (const s of ['+1', '-1', '@SUM(A1)']) expect(escapeCell(s).startsWith("'")).toBe(true)
  })
  it('builds a header row plus one line per row', () => {
    const csv = toCsv([{ a: 'x', b: 1 }, { a: 'y,z', b: undefined }], [{ header: 'A', value: (r) => r.a }, { header: 'B', value: (r) => r.b }])
    expect(csv).toBe('A,B\r\nx,1\r\n"y,z",\r\n')
  })
})
