/**
 * Solver Engine - 约束求解层 (优化版本 - 消除 any 类型)
 * 支持牛顿迭代法、二分法、启发式搜索
 * 用于逆向计算和参数优化
 */

import { Warning } from './types'

export interface SolverResult<T> {
  value: T
  iterations: number
  converged: boolean
  warnings: Warning[]
}

/**
 * 二分法求解器
 * 适用于单调函数的根查找
 */
export const bisectionSolver = (
  fn: (x: number) => number,
  lowerBound: number,
  upperBound: number,
  tolerance: number = 1e-6,
  maxIterations: number = 100
): SolverResult<number> => {
  const warnings: Warning[] = []
  let iterations = 0

  let low = lowerBound
  let high = upperBound
  let mid = (low + high) / 2

  const fnLow = fn(low)
  const fnHigh = fn(high)

  if (fnLow * fnHigh > 0) {
    return {
      value: mid,
      iterations: 0,
      converged: false,
      warnings: [{
        level: 'error',
        message: '函数在给定区间端点同号，无法保证有根',
        suggestion: '请扩大搜索区间或检查函数定义'
      }]
    }
  }

  while (iterations < maxIterations) {
    mid = (low + high) / 2
    const fnMid = fn(mid)
    iterations++

    if (Math.abs(fnMid) < tolerance || (high - low) / 2 < tolerance) {
      return { value: mid, iterations, converged: true, warnings: [] }
    }

    if (fnLow * fnMid < 0) high = mid
    else low = mid
  }

  warnings.push({
    level: 'warning',
    message: `达到最大迭代次数 (${maxIterations})`,
    suggestion: '尝试增大容差或增加最大迭代次数'
  })

  return { value: mid, iterations, converged: false, warnings }
}

/**
 * 牛顿-拉夫逊法求解器
 */
export const newtonRaphsonSolver = (
  fn: (x: number) => number,
  derivative: (x: number) => number,
  initialGuess: number,
  tolerance: number = 1e-8,
  maxIterations: number = 50
): SolverResult<number> => {
  const warnings: Warning[] = []
  let iterations = 0
  let x = initialGuess

  while (iterations < maxIterations) {
    const fx = fn(x)
    const dfx = derivative(x)
    iterations++

    if (Math.abs(dfx) < 1e-12) {
      return {
        value: x,
        iterations,
        converged: false,
        warnings: [{
          level: 'error',
          message: '导数接近零，牛顿法无法继续',
          suggestion: '尝试不同的初始猜测或使用二分法'
        }]
      }
    }

    const xNew = x - fx / dfx

    if (Math.abs(xNew - x) < tolerance || Math.abs(fx) < tolerance) {
      return { value: xNew, iterations, converged: true, warnings: [] }
    }

    x = xNew
  }

  warnings.push({
    level: 'warning',
    message: `达到最大迭代次数 (${maxIterations})`,
    suggestion: '函数可能不收敛，尝试其他初始值'
  })

  return { value: x, iterations, converged: false, warnings }
}

/**
 * 离散值优化器 - 用于从标准库中搜索最优规格
 */
export const discreteOptimizer = <T>(
  candidates: T[],
  objectiveFn: (candidate: T) => number,
  constraints: Array<{
    check: (candidate: T) => boolean
    penalty: number
    description: string
  }>,
  topN: number = 5
): SolverResult<T[]> => {
  const warnings: Warning[] = []

  if (candidates.length === 0) {
    return {
      value: [],
      iterations: 0,
      converged: false,
      warnings: [{ level: 'error', message: '候选列表为空' }]
    }
  }

  const scored = candidates.map(candidate => {
    let score = objectiveFn(candidate)
    let violatedConstraints: string[] = []

    for (const constraint of constraints) {
      if (!constraint.check(candidate)) {
        score += constraint.penalty
        violatedConstraints.push(constraint.description)
      }
    }

    return { candidate, score, violatedConstraints, isValid: violatedConstraints.length === 0 }
  })

  scored.sort((a, b) => a.score - b.score)

  const topCandidates = scored.slice(0, topN).map(s => s.candidate)

  if (scored[0].violatedConstraints.length > 0) {
    warnings.push({
      level: 'warning',
      message: '最优解违反部分约束',
      suggestion: `违反: ${scored[0].violatedConstraints.join(', ')}`
    })
  }

  return { value: topCandidates, iterations: candidates.length, converged: true, warnings }
}

/**
 * 轴承选型求解器 (类型安全版本)
 */
export const bearingSelectorSolver = (
  bearings: Array<{
    designation: string
    inner_diameter: number
    outer_diameter: number
    width: number
    C_r: number
    C_0r: number
    speed_limit_grease: number
    speed_limit_oil: number
    mass: number
  }>,
  radialLoad: number,
  axialLoad: number,
  speed: number,
  targetLife: number,
  maxOuterDiameter?: number
): SolverResult<typeof bearings> => {
  const objectiveFn = (bearing: typeof bearings[0]) => bearing.outer_diameter

  const constraints = [
    {
      check: (bearing: typeof bearings[0]) => {
        const P = 0.56 * radialLoad + 1.5 * axialLoad
        const L10 = Math.pow(bearing.C_r / P, 3) * (1000000 / (60 * speed))
        return L10 >= targetLife
      },
      penalty: 10000,
      description: `寿命 ≥ ${targetLife} 小时`
    },
    {
      check: (bearing: typeof bearings[0]) => {
        if (!maxOuterDiameter) return true
        return bearing.outer_diameter <= maxOuterDiameter
      },
      penalty: 5000,
      description: maxOuterDiameter ? `外径 ≤ ${maxOuterDiameter} mm` : '无限制'
    },
    {
      check: (bearing: typeof bearings[0]) => {
        const P_0 = 0.6 * radialLoad + 0.5 * axialLoad
        return bearing.C_0r >= P_0
      },
      penalty: 8000,
      description: '静强度安全'
    }
  ]

  return discreteOptimizer<typeof bearings[0]>(bearings, objectiveFn, constraints, 5)
}

/**
 * 螺栓规格求解器 (类型安全版本)
 */
export const boltSelectorSolver = (
  bolts: Array<{
    designation: string
    d: number
    stress_area: number
    head_width_s: number
    head_height_k: number
    standard: string
  }>,
  axialLoad: number,
  shearLoad: number,
  safetyFactor: number = 1.5,
  yieldStrength: number = 640
): SolverResult<typeof bolts> => {
  const objectiveFn = (bolt: typeof bolts[0]) => bolt.d

  const constraints = [
    {
      check: (bolt: typeof bolts[0]) => {
        const As = bolt.stress_area
        const sigma = (axialLoad * 1000) / As
        const tau = (shearLoad * 1000) / (Math.PI * Math.pow(bolt.d, 2) / 4)
        const vonMises = Math.sqrt(sigma * sigma + 3 * tau * tau)
        return vonMises <= yieldStrength / safetyFactor
      },
      penalty: 10000,
      description: `强度校核通过 (安全系数≥${safetyFactor})`
    }
  ]

  return discreteOptimizer<typeof bolts[0]>(bolts, objectiveFn, constraints, 5)
}
