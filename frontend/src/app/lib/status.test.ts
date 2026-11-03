import { describe, it, expect } from 'vitest'
import { deviceStatus, alertStatus, severityStatus, toneClasses } from './status'

describe('status mapping', () => {
  it('maps device online to success', () => {
    expect(deviceStatus('online')).toEqual({ label: 'Online', tone: 'success' })
  })
  it('maps device offline to danger', () => {
    expect(deviceStatus('offline').tone).toBe('danger')
  })
  it('alert status is case-insensitive', () => {
    expect(alertStatus('active').tone).toBe('danger')
    expect(alertStatus('RESOLVED').tone).toBe('success')
    expect(alertStatus('false_alarm').label).toBe('False alarm')
  })
  it('severity critical is danger', () => {
    expect(severityStatus('critical').tone).toBe('danger')
  })
  it('unknown falls back to neutral with raw label', () => {
    expect(deviceStatus('weird')).toEqual({ label: 'weird', tone: 'neutral' })
    expect(alertStatus(undefined)).toEqual({ label: 'Unknown', tone: 'neutral' })
  })
  it('exposes a class string per tone', () => {
    expect(typeof toneClasses.success).toBe('string')
    expect(Object.keys(toneClasses)).toHaveLength(5)
  })
})
