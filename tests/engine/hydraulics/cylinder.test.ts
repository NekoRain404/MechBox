import { describe, expect, test } from 'vitest'
import { calcCylinder } from '../../../src/renderer/engine/hydraulics/cylinder'

describe('calcCylinder', () => {
  test('computes extend and retract timing from supplied flow', () => {
    const result = calcCylinder({
      boreDiameter: 50,
      rodDiameter: 28,
      pressure: 10,
      stroke: 300,
      flowRate: 10,
      targetExtendTime: 3,
    })

    expect(result.value.extendSpeed).toBeGreaterThan(0)
    expect(result.value.extendTime).toBeGreaterThan(0)
    expect(result.value.retractTime).toBeGreaterThan(0)
    expect(result.value.requiredExtendFlow).toBeGreaterThan(0)
  })

  test('guards invalid bore and stroke inputs', () => {
    const result = calcCylinder({
      boreDiameter: 0,
      rodDiameter: 10,
      pressure: 10,
      stroke: 0,
    })

    expect(result.warnings.some((warning) => warning.level === 'error')).toBe(true)
  })
})
