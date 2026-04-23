import { describe, expect, test } from 'vitest'
import { calcMotorSelection } from '../../../src/renderer/engine/motors/selection'

describe('calcMotorSelection', () => {
  test('continuous torque includes efficiency losses', () => {
    const result = calcMotorSelection({
      loadForce: 10,
      speed: 1500,
      efficiency: 0.8,
      safetyFactor: 1.5,
    })

    expect(result.value.requiredTorque).toBeCloseTo(12.5, 5)
  })

  test('acceleration duty cycle raises peak and rms torque', () => {
    const result = calcMotorSelection({
      loadForce: 10,
      speed: 1500,
      inertia: 0.01,
      acceleration: 100,
      accelDutyCycle: 0.25,
      efficiency: 0.9,
    })

    expect(result.value.peakTorque).toBeGreaterThan(result.value.requiredTorque)
    expect(result.value.rmsTorque).toBeGreaterThan(result.value.requiredTorque)
  })
})
