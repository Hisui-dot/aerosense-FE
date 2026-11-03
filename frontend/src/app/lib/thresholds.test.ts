import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PM25_THRESHOLD,
  effectivePm25Threshold,
  effectiveVocThreshold,
  classifyReading,
} from './thresholds'

describe('thresholds', () => {
  it('prefers device threshold, then settings, then default', () => {
    expect(effectivePm25Threshold({ pm25Threshold: 50 }, 42)).toBe(50)
    expect(effectivePm25Threshold({ pm25Threshold: null }, 42)).toBe(42)
    expect(effectivePm25Threshold(null, null)).toBe(DEFAULT_PM25_THRESHOLD)
    expect(effectiveVocThreshold(null, null)).toBe(0.6)
  })
  it('classifies readings relative to threshold', () => {
    expect(classifyReading(20, 35)).toBe('normal')
    expect(classifyReading(30, 35)).toBe('warning')
    expect(classifyReading(40, 35)).toBe('critical')
  })
  it('is safe on bad input', () => {
    expect(classifyReading(NaN, 35)).toBe('normal')
    expect(classifyReading(10, 0)).toBe('normal')
  })
})
