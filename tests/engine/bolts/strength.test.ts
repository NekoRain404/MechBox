import { describe, test, expect } from 'vitest'
import { calcPreload, calcStress, recommendTorque } from '../../../src/renderer/engine/bolts/strength'

describe('BoltEngine - Strength Calculations', () => {
  describe('calcPreload', () => {
    test('M10 bolt with 49 N·m torque (K=0.2)', () => {
      // F = T / (K × d) = 49000 / (0.2 × 10) = 24500 N = 24.5 kN
      const result = calcPreload(49, 10, 0.2)
      expect(result.value).toBeCloseTo(24.5, 1)
    })

    test('error for zero torque', () => {
      const result = calcPreload(0, 10)
      expect(result.warnings.some(w => w.level === 'error')).toBe(true)
    })

    test('error for zero diameter', () => {
      const result = calcPreload(50, 0)
      expect(result.warnings.some(w => w.level === 'error')).toBe(true)
    })
  })

  describe('calcStress', () => {
    test('tensile stress only', () => {
      const bolt = { stress_area: 58, designation: 'M10' }
      const result = calcStress(bolt, 10, 0)
      // σ = F / As = 10000 / 58 = 172.4 MPa
      expect(result.value.tensile_stress).toBeCloseTo(172.4, 1)
      expect(result.value.shear_stress).toBe(0)
    })

    test('combined tensile and shear stress', () => {
      const bolt = { stress_area: 58, designation: 'M10' }
      const result = calcStress(bolt, 10, 5)
      expect(result.value.tensile_stress).toBeGreaterThan(0)
      expect(result.value.shear_stress).toBeGreaterThan(0)
      expect(result.value.von_mises).toBeGreaterThan(result.value.tensile_stress)
    })
  })

  describe('recommendTorque', () => {
    test('M10 8.8 grade should return 49 N·m', () => {
      const torque = recommendTorque('M10', '8.8')
      expect(torque).toBe(49)
    })

    test('M12 8.8 grade', () => {
      const torque = recommendTorque('M12', '8.8')
      expect(torque).toBe(85)
    })

    test('unknown size should return 0', () => {
      const torque = recommendTorque('M14', '8.8')
      expect(torque).toBe(0)
    })
  })
})
