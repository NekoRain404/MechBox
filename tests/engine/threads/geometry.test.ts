import { describe, test, expect } from 'vitest'
import { calcThreadGeometry, calcLeadAngle, checkSelfLocking } from '../../../src/renderer/engine/threads/geometry'

describe('ThreadEngine - Geometry Calculations', () => {
  describe('calcThreadGeometry', () => {
    test('M10 coarse thread (pitch=1.5)', () => {
      const result = calcThreadGeometry('M10')
      expect(result.value.nominal_diameter).toBe(10)
      expect(result.value.pitch).toBe(1.5)
      // d2 = d - 0.6495 × P = 10 - 0.6495 × 1.5 = 9.026
      expect(result.value.pitch_diameter).toBeCloseTo(9.026, 2)
      // d1 = d - 1.0825 × P = 10 - 1.0825 × 1.5 = 8.376
      expect(result.value.minor_diameter).toBeCloseTo(8.376, 2)
    })

    test('M10x1.25 fine thread', () => {
      const result = calcThreadGeometry('M10×1.25')
      expect(result.value.nominal_diameter).toBe(10)
      expect(result.value.pitch).toBe(1.25)
    })

    test('invalid thread specification', () => {
      const result = calcThreadGeometry('invalid')
      expect(result.warnings.some(w => w.level === 'error')).toBe(true)
    })
  })

  describe('calcLeadAngle', () => {
    test('normal lead angle calculation', () => {
      const result = calcLeadAngle(1.5, 9.026)
      expect(result.value).toBeGreaterThan(0)
      expect(result.value).toBeLessThan(90)
    })

    test('error for zero pitch', () => {
      const result = calcLeadAngle(0, 9.026)
      expect(result.warnings.some(w => w.level === 'error')).toBe(true)
    })
  })

  describe('checkSelfLocking', () => {
    test('self-locking condition satisfied', () => {
      const result = checkSelfLocking(3, 5.71)
      expect(result.value.is_self_locking).toBe(true)
      expect(result.value.safety_margin).toBeCloseTo(2.71, 2)
    })

    test('self-locking condition not satisfied', () => {
      const result = checkSelfLocking(8, 5.71)
      expect(result.value.is_self_locking).toBe(false)
      expect(result.warnings.some(w => w.level === 'warning')).toBe(true)
    })
  })
})
