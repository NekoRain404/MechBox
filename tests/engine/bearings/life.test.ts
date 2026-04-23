import { describe, test, expect } from 'vitest'
import { calcLife, calcEquivalentLoad } from '../../../src/renderer/engine/bearings/life'

describe('BearingEngine - Life Calculations', () => {
  describe('calcLife', () => {
    test('6205 bearing L10 life - known value validation', () => {
      // Known value: 6205 C_r=14kN, P=2kN
      // L10 = (14/2)^3 = 343 million revolutions
      const result = calcLife(14, 2, 'ball', 1500)
      expect(result.value.L10).toBeCloseTo(343, 0)
      expect(result.value.L10h).toBeGreaterThan(0)
    })

    test('roller bearing with p=10/3', () => {
      const result = calcLife(50, 10, 'roller', 1000)
      expect(result.value.L10).toBeCloseTo(Math.pow(5, 10/3), 1)
    })

    test('warning for short life', () => {
      const result = calcLife(10, 9, 'ball', 3000)
      expect(result.warnings.some(w => w.level === 'warning')).toBe(true)
    })

    test('error for zero load', () => {
      const result = calcLife(10, 0, 'ball', 1500)
      expect(result.warnings.some(w => w.level === 'error')).toBe(true)
    })
  })

  describe('calcEquivalentLoad', () => {
    test('standard calculation', () => {
      // P = X × Fr + Y × Fa
      const P = calcEquivalentLoad(2, 0.5, 0.56, 1.5)
      expect(P).toBeCloseTo(1.87, 2)
    })

    test('pure radial load', () => {
      const P = calcEquivalentLoad(5, 0, 1, 0)
      expect(P).toBe(5)
    })

    test('pure axial load', () => {
      const P = calcEquivalentLoad(0, 3, 0, 1.5)
      expect(P).toBeCloseTo(4.5, 2)
    })
  })
})
