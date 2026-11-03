export const DEFAULT_PM25_THRESHOLD = 35
export const DEFAULT_VOC_THRESHOLD = 0.6

export interface ThresholdSource {
  pm25Threshold?: number | null
  vocThreshold?: number | null
}

function firstNum(...vals: Array<number | null | undefined>): number {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return NaN
}

export function effectivePm25Threshold(device?: ThresholdSource | null, settings?: number | null): number {
  const n = firstNum(device?.pm25Threshold, settings, DEFAULT_PM25_THRESHOLD)
  return Number.isFinite(n) ? n : DEFAULT_PM25_THRESHOLD
}

export function effectiveVocThreshold(device?: ThresholdSource | null, settings?: number | null): number {
  const n = firstNum(device?.vocThreshold, settings, DEFAULT_VOC_THRESHOLD)
  return Number.isFinite(n) ? n : DEFAULT_VOC_THRESHOLD
}

export type ReadingLevel = 'normal' | 'warning' | 'critical'

export function classifyReading(value: number, threshold: number): ReadingLevel {
  if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold <= 0) return 'normal'
  if (value >= threshold) return 'critical'
  if (value >= threshold * 0.8) return 'warning'
  return 'normal'
}
