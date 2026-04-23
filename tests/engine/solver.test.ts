import { describe, test, expect } from 'vitest'
import { 
  bisectionSolver, 
  newtonRaphsonSolver, 
  discreteOptimizer,
  bearingSelectorSolver,
  boltSelectorSolver
} from '../../src/renderer/engine/solver'

describe('Solver Engine - Constraint Solving', () => {
  describe('Bisection Solver', () => {
    test('find root of x² - 4 = 0 (should be x=2)', () => {
      const fn = (x: number) => x * x - 4
      const result = bisectionSolver(fn, 0, 5)
      
      expect(result.converged).toBe(true)
      expect(result.value).toBeCloseTo(2, 4)
      expect(result.iterations).toBeLessThan(30)
    })

    test('find root of sin(x) = 0 in [3, 4] (should be π)', () => {
      const fn = (x: number) => Math.sin(x)
      const result = bisectionSolver(fn, 3, 4)
      
      expect(result.converged).toBe(true)
      expect(result.value).toBeCloseTo(Math.PI, 4)
    })

    test('fail when function has same sign at bounds', () => {
      const fn = (x: number) => x * x + 1  // No real roots
      const result = bisectionSolver(fn, -5, 5)
      
      expect(result.converged).toBe(false)
      expect(result.warnings.some(w => w.level === 'error')).toBe(true)
    })
  })

  describe('Newton-Raphson Solver', () => {
    test('find root of x² - 9 = 0 (should be x=3)', () => {
      const fn = (x: number) => x * x - 9
      const derivative = (x: number) => 2 * x
      const result = newtonRaphsonSolver(fn, derivative, 2)
      
      expect(result.converged).toBe(true)
      expect(result.value).toBeCloseTo(3, 5)
      expect(result.iterations).toBeLessThan(20)
    })

    test('fast convergence for well-behaved functions', () => {
      const fn = (x: number) => Math.exp(x) - 2  // x = ln(2)
      const derivative = (x: number) => Math.exp(x)
      const result = newtonRaphsonSolver(fn, derivative, 0)
      
      expect(result.converged).toBe(true)
      expect(result.value).toBeCloseTo(Math.log(2), 6)
    })

    test('fail when derivative is zero', () => {
      const fn = (x: number) => x * x * x
      const derivative = (x: number) => 3 * x * x
      const result = newtonRaphsonSolver(fn, derivative, 0)
      
      expect(result.converged).toBe(false)
      expect(result.warnings.some(w => w.level === 'error')).toBe(true)
    })
  })

  describe('Discrete Optimizer', () => {
    test('find smallest value satisfying constraint', () => {
      const candidates = [10, 20, 30, 40, 50]
      const objectiveFn = (x: number) => x  // Minimize x
      
      const constraints = [
        {
          check: (x: number) => x >= 25,
          penalty: 1000,
          description: 'x ≥ 25'
        }
      ]
      
      const result = discreteOptimizer(candidates, objectiveFn, constraints, 3)
      
      expect(result.converged).toBe(true)
      expect(result.value[0]).toBe(30)  // Smallest valid value
      expect(result.value.length).toBe(3)
    })

    test('rank by objective when all satisfy constraints', () => {
      const candidates = [
        { id: 'A', cost: 100 },
        { id: 'B', cost: 50 },
        { id: 'C', cost: 75 }
      ]
      
      const objectiveFn = (x: any) => x.cost
      const constraints = []
      
      const result = discreteOptimizer(candidates, objectiveFn, constraints, 3)
      
      expect(result.value[0].id).toBe('B')  // Cheapest first
      expect(result.value[1].id).toBe('C')
      expect(result.value[2].id).toBe('A')
    })
  })

  describe('Bearing Selector Solver', () => {
    test('recommend bearing based on load and life', () => {
      const bearings = [
        { designation: '6005', inner_diameter: 25, outer_diameter: 47, C_r: 11.9, C_0r: 6.55 },
        { designation: '6205', inner_diameter: 25, outer_diameter: 52, C_r: 14.0, C_0r: 7.85 },
        { designation: '6305', inner_diameter: 25, outer_diameter: 62, C_r: 22.5, C_0r: 11.6 },
      ]
      
      const result = bearingSelectorSolver(
        bearings,
        2.0,    // 2 kN radial
        0.5,    // 0.5 kN axial
        1500,   // 1500 rpm
        10000   // 10000 hours target life
      )
      
      expect(result.converged).toBe(true)
      expect(result.value.length).toBeGreaterThan(0)
      // Should recommend smallest valid bearing
    })
  })

  describe('Bolt Selector Solver', () => {
    test('recommend bolt size based on load', () => {
      const bolts = [
        { designation: 'M8', d: 8, stress_area: 36.6 },
        { designation: 'M10', d: 10, stress_area: 58 },
        { designation: 'M12', d: 12, stress_area: 84.3 },
      ]
      
      const result = boltSelectorSolver(
        bolts,
        10,   // 10 kN axial
        0,    // 0 kN shear
        1.5   // Safety factor
      )
      
      expect(result.converged).toBe(true)
      expect(result.value.length).toBeGreaterThan(0)
      // Should recommend M10 or M12 based on stress
    })
  })
})
