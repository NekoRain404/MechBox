import { describe, expect, test } from 'vitest'
import { calcShaftStrength } from '../../../src/renderer/engine/shafts/strength'

describe('calcShaftStrength', () => {
  test('includes axial stress in equivalent stress', () => {
    const withoutAxial = calcShaftStrength({
      diameter: 30,
      length: 200,
      bendingMoment: 50000,
      torque: 30000,
      materialYield: 355,
    })

    const withAxial = calcShaftStrength({
      diameter: 30,
      length: 200,
      bendingMoment: 50000,
      torque: 30000,
      axialForce: 5000,
      materialYield: 355,
    })

    expect(withAxial.value.axialStress).toBeGreaterThan(0)
    expect(withAxial.value.vonMisesStress).toBeGreaterThan(withoutAxial.value.vonMisesStress)
  })

  test('deflection estimate stays finite for loaded shaft', () => {
    const result = calcShaftStrength({
      diameter: 30,
      length: 300,
      bendingMoment: 60000,
      torque: 20000,
      materialYield: 355,
      supportType: 'simply',
    })

    expect(result.value.deflection).toBeGreaterThan(0)
    expect(result.value.criticalSpeed).toBeGreaterThan(0)
  })
})
