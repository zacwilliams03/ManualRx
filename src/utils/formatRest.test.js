import { describe, it, expect } from 'vitest'
import { formatRest } from './formatRest'

describe('formatRest', () => {
  it('returns null for null', () => {
    expect(formatRest(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatRest(undefined)).toBeNull()
  })

  it('returns null for 0', () => {
    expect(formatRest(0)).toBeNull()
  })

  it('formats seconds under 60', () => {
    expect(formatRest(30)).toBe('30s')
    expect(formatRest(45)).toBe('45s')
  })

  it('formats exact minutes', () => {
    expect(formatRest(60)).toBe('1m')
    expect(formatRest(120)).toBe('2m')
  })

  it('formats minutes and seconds', () => {
    expect(formatRest(90)).toBe('1m 30s')
    expect(formatRest(75)).toBe('1m 15s')
  })
})
