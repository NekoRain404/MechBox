import { describe, test, expect } from 'vitest'
import { calcISO281Life, calcKappa, getA1Factor } from '../../../src/renderer/engine/bearings/iso281'

describe('ISO 281 Bearing Life (Section 10.2)', () => {
  describe('calcISO281Life', () => {
    test('basic life calculation', () => {
      const result = calcISO281Life({
        C_r: 14,
        P: 2,
        n: 1500,
        bearingType: 'ball'
      })
      expect(result.value.L10_basic).toBeCloseTo(343, 0)
      expect(result.value.a_ISO).toBe(1.0)  // default conditions
    })

    test('good lubrication increases life', () => {
      const result = calcISO281Life({
        C_r: 14,
        P: 2,
        n: 1500,
        bearingType: 'ball',
        kappa: 4,
        eta_c: 1.0
      })
      expect(result.value.a_ISO).toBeGreaterThan(1.0)
      expect(result.value.L10mh).toBeGreaterThan(result.value.L10h_basic)
    })

    test('poor lubrication reduces life', () => {
      const result = calcISO281Life({
        C_r: 14,
        P: 2,
        n: 1500,
        bearingType: 'ball',
        kappa: 0.1
      })
      expect(result.value.a_ISO).toBeLessThan(1.0)
      expect(result.value.warnings.some(w => w.level === 'error')).toBe(true)
    })

    test('minimum load warning', () => {
      const result = calcISO281Life({
        C_r: 14,
        P: 0.05,  // Very low load
        n: 3000,
        bearingType: 'ball'
      })
      expect(result.value.warnings.some(w => w.message.includes('skidding'))).toBe(true)
    })

    test('roller bearing with p=10/3', () => {
      const result = calcISO281Life({
        C_r: 50,
        P: 10,
        n: 1000,
        bearingType: 'roller'
      })
      expect(result.value.L10_basic).toBeCloseTo(Math.pow(5, 10/3), 1)
    })
  })

  describe('calcKappa', () => {
    test('normal lubrication', () => {
      expect(calcKappa(32, 16)).toBe(2.0)
    })

    test('zero rated viscosity', () => {
      expect(calcKappa(32, 0)).toBe(0)
    })
  })

  describe('getA1Factor', () => {
    test('90% reliability', () => {
      expect(getA1Factor(90)).toBe(1.0)
    })

    test('99.9% reliability', () => {
      expect(getA1Factor(99.9)).toBe(0.10)
    })

    test('close match for 95%', () => {
      expect(getA1Factor(95)).toBe(0.64)
    })
  })
})
