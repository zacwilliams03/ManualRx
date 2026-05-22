import { sanitise, weightDisplay } from './pdfUtils'

// sanitise: strips special chars, collapses hyphens, trims leading/trailing hyphens
describe('sanitise', () => {
  test('leaves alphanumeric strings unchanged', () => {
    expect(sanitise('JohnSmith')).toBe('JohnSmith')
  })

  test('replaces spaces with hyphens', () => {
    expect(sanitise('John Smith')).toBe('John-Smith')
  })

  test('replaces slashes and special characters with hyphens', () => {
    expect(sanitise('Session/One')).toBe('Session-One')
    expect(sanitise('Smith & Jones')).toBe('Smith-Jones')
  })

  test('collapses multiple consecutive hyphens into one', () => {
    expect(sanitise('Smith  Jones')).toBe('Smith-Jones')
    expect(sanitise('a---b')).toBe('a-b')
  })

  test('trims leading and trailing hyphens', () => {
    expect(sanitise('-hello-')).toBe('hello')
    expect(sanitise('!hello!')).toBe('hello')
  })

  test('handles a realistic client name', () => {
    expect(sanitise('Dr. Jane O\'Brien')).toBe('Dr-Jane-O-Brien')
  })

  test('handles a realistic prescription name', () => {
    expect(sanitise('Rotator Cuff Session 1')).toBe('Rotator-Cuff-Session-1')
  })
})

// weightDisplay: formats weight for PDF — shows formatted string or 'Bodyweight' when null
describe('weightDisplay', () => {
  test('returns Bodyweight when weight is null', () => {
    expect(weightDisplay(null, 'kg')).toBe('Bodyweight')
  })

  test('returns Bodyweight when weight is undefined', () => {
    expect(weightDisplay(undefined, 'kg')).toBe('Bodyweight')
  })

  test('formats kg weight correctly', () => {
    expect(weightDisplay(20, 'kg')).toBe('20 kg')
  })

  test('converts canonical kg to lb for display', () => {
    // 20 kg = 44.09 lb, rounded to 1dp = 44.1
    const result = weightDisplay(20, 'lb')
    expect(result).toBe('44.1 lb')
  })

  test('returns Bodyweight when weight is zero', () => {
    expect(weightDisplay(0, 'kg')).toBe('Bodyweight')
  })
})
