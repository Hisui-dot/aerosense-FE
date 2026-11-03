import { describe, it, expect } from 'vitest'
import { brand, status, chart } from '../tokens'

describe('tokens', () => {
  it('exposes brand navy and blue', () => {
    expect(brand.navy).toBe('#0B1847')
    expect(brand.blue).toBe('#1B44CC')
  })
  it('has all five status tones', () => {
    expect(Object.keys(status)).toEqual(['success', 'warning', 'danger', 'info', 'neutral'])
  })
  it('maps pm25 chart color to brand blue and threshold to danger', () => {
    expect(chart.pm25).toBe(brand.blue)
    expect(chart.threshold).toBe(status.danger)
  })
})
