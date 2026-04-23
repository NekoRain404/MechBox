import { describe, test, expect } from 'vitest'
import { calcGearISO6336, recommendModificationCoefficients } from '../../../src/renderer/engine/gears/iso6336'

describe('ISO 6336 Gear Strength (Section 10.4)', () => {
  describe('calcGearISO6336', () => {
    test('basic calculation with standard gears', () => {
      const result = calcGearISO6336({
        module: 2,
        teeth1: 20,
        teeth2: 40,
        faceWidth: 20,
        pressureAngle: 20,
        torque1: 50,
        sigmaHlim: 1500,
        sigmaFlim: 400
      })
      
      expect(result.value.d1).toBeCloseTo(40, 0)
      expect(result.value.d2).toBeCloseTo(80, 0)
      expect(result.value.Ft).toBeGreaterThan(0)
      expect(result.value.SH).toBeGreaterThan(1.0)
      expect(result.value.SF1).toBeGreaterThan(1.4)
    })

    test('root cut warning for teeth < 17', () => {
      const result = calcGearISO6336({
        module: 2,
        teeth1: 12,
        teeth2: 30,
        faceWidth: 20,
        pressureAngle: 20,
        torque1: 50,
        sigmaHlim: 1500,
        sigmaFlim: 400
      })
      
      expect(result.value.warnings.some(w => w.message.includes('根切'))).toBe(true)
    })

    test('contact safety factor warning', () => {
      const result = calcGearISO6336({
        module: 1,
        teeth1: 20,
        teeth2: 40,
        faceWidth: 10,
        pressureAngle: 20,
        torque1: 100,  // High torque
        sigmaHlim: 800,  // Low limit
        sigmaFlim: 400
      })
      
      // Should have low safety factor warning
      expect(result.value.SH < 1.5 || result.value.warnings.length > 0).toBe(true)
    })

    test('helical gear calculation', () => {
      const result = calcGearISO6336({
        module: 2,
        teeth1: 20,
        teeth2: 40,
        faceWidth: 30,
        pressureAngle: 20,
        torque1: 50,
        sigmaHlim: 1500,
        sigmaFlim: 400,
        helixAngle: 15
      })
      
      expect(result.value.d1).toBeGreaterThan(40)  // Helical has larger pitch diameter
      expect(result.value.tipRelief).toBeGreaterThan(0)
    })

    test('tip relief recommendation', () => {
      const result = calcGearISO6336({
        module: 3,
        teeth1: 20,
        teeth2: 40,
        faceWidth: 30,
        pressureAngle: 20,
        torque1: 50,
        sigmaHlim: 1500,
        sigmaFlim: 400
      })
      
      // Tip relief should be 5 + 3*m = 14 μm for m=3
      expect(result.value.tipRelief).toBeCloseTo(14, 0)
    })
  })

  describe('recommendModificationCoefficients', () => {
    test('no modification needed for z >= 17', () => {
      const { x1, x2 } = recommendModificationCoefficients(20, 40)
      expect(x1).toBe(0)
      expect(x2).toBe(0)  // z2=40 doesn't need modification
    })

    test('positive modification for z < 17', () => {
      const { x1, x2 } = recommendModificationCoefficients(12, 30)
      expect(x1).toBeGreaterThan(0.2)  // Should recommend significant modification
    })

    test('both gears need modification', () => {
      const { x1, x2 } = recommendModificationCoefficients(14, 16)
      expect(x1).toBeGreaterThan(0)
      expect(x2).toBeGreaterThan(0)
    })
  })
})
