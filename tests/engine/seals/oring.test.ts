import { describe, test, expect } from 'vitest'
import { calcCompression, calcStretch } from '../../../src/renderer/engine/seals/oring'

describe('SealEngine - O-ring Calculations', () => {
  describe('calcCompression', () => {
    test('normal compression - AS568-010', () => {
      // AS568-010: CS = 1.78mm, groove depth 1.40mm
      // Expected: (1.78 - 1.40) / 1.78 * 100 = 21.35%
      const result = calcCompression(1.78, 1.40)
      expect(result.value).toBeCloseTo(21.35, 1)
      expect(result.warnings).toHaveLength(0)
    })

    test('zero compression (groove depth equals CS)', () => {
      const result = calcCompression(2.62, 2.62)
      expect(result.value).toBe(0)
      // Zero compression triggers warning because it's below 10%
      expect(result.warnings.some(w => w.level === 'warning')).toBe(true)
    })

    test('negative compression (groove too deep)', () => {
      const result = calcCompression(2.62, 3.0)
      expect(result.value).toBeLessThan(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    test('invalid input - zero CS causes division by zero or warning', () => {
      const result = calcCompression(0, 1.5)
      // Zero CS will either error or give NaN/Infinity
      expect(result.value === 0 || !isFinite(result.value) || result.warnings.some(w => w.level === 'warning')).toBe(true)
    })
  })

  describe('calcStretch', () => {
    test('normal stretch calculation', () => {
      // Seal ID: 10mm, Gland ID: 10.5mm
      const result = calcStretch(10, 10.5)
      expect(result.value).toBeCloseTo(5, 1)
    })

    test('zero stretch (gland ID equals seal ID)', () => {
      const result = calcStretch(10, 10)
      expect(result.value).toBe(0)
    })

    test('negative stretch (compression)', () => {
      const result = calcStretch(10, 9.5)
      expect(result.value).toBeLessThan(0)
    })
  })
})
