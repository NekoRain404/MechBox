import { describe, test, expect } from 'vitest'
import { calcVDI2230 } from '../../../src/renderer/engine/bolts/vdi2230'

describe('VDI 2230 Bolt Lifecycle (Section 10.3)', () => {
  describe('calcVDI2230', () => {
    test('basic calculation with 8.8 bolt', () => {
      const result = calcVDI2230({
        boltDiameter: 10,
        boltClass: '8.8',
        preloadForce: 20,
        axialWorkingForce: 5,
        shearWorkingForce: 0
      })
      expect(result.value.yieldSafety).toBeGreaterThan(1.4)
      expect(result.value.residualClampForce).toBeGreaterThan(0)
    })

    test('settling loss calculation', () => {
      const result = calcVDI2230({
        boltDiameter: 10,
        boltClass: '8.8',
        preloadForce: 20,
        axialWorkingForce: 5,
        shearWorkingForce: 0,
        surfaceRoughness: 6.3  // Rough surface
      })
      expect(result.value.settlingLoss).toBeGreaterThan(0)
    })

    test('fatigue warning for high cycles', () => {
      const result = calcVDI2230({
        boltDiameter: 10,
        boltClass: '8.8',
        preloadForce: 20,
        axialWorkingForce: 15,  // High working load
        shearWorkingForce: 0,
        cycles: 1000000
      })
      if (result.value.fatigueSafety !== undefined) {
        expect(result.value.fatigueSafety).toBeGreaterThan(0)
      }
    })

    test('thread shear check for aluminum nut', () => {
      const result = calcVDI2230({
        boltDiameter: 10,
        boltClass: '8.8',
        preloadForce: 25,
        axialWorkingForce: 5,
        shearWorkingForce: 0,
        nutMaterial: 'aluminum'
      })
      if (result.value.threadShearSafety !== undefined) {
        expect(result.value.threadShearSafety).toBeGreaterThan(0)
      }
    })

    test('negative residual clamp force warning', () => {
      const result = calcVDI2230({
        boltDiameter: 10,
        boltClass: '8.8',
        preloadForce: 5,  // Low preload
        axialWorkingForce: 30,  // High working load
        shearWorkingForce: 0
      })
      expect(result.value.residualClampForce).toBeLessThan(0)
      expect(result.value.warnings.some(w => w.message.includes('夹紧力'))).toBe(true)
    })

    test('unknown bolt class error', () => {
      const result = calcVDI2230({
        boltDiameter: 10,
        boltClass: 'unknown',
        preloadForce: 20,
        axialWorkingForce: 5,
        shearWorkingForce: 0
      })
      expect(result.value.warnings.some(w => w.level === 'error')).toBe(true)
    })
  })
})
