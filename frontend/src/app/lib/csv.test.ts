import { describe, it, expect } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('returns empty string for no rows', () => {
    expect(toCsv([])).toBe('')
  })
  it('writes header + rows from object keys', () => {
    expect(toCsv([{ a: 1, b: 2 }])).toBe('a,b\r\n1,2')
  })
  it('escapes commas, quotes, and newlines', () => {
    const csv = toCsv([{ name: 'CR 2F, west', note: 'he said "hi"\nbye' }])
    expect(csv).toBe('name,note\r\n"CR 2F, west","he said ""hi""\nbye"')
  })
  it('respects an explicit column order and null/undefined', () => {
    expect(toCsv([{ a: 1, b: null }], ['b', 'a'])).toBe('b,a\r\n,1')
  })
})
