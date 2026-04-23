/**
 * Monte Carlo 概率模拟引擎
 * 用于批量生产良品率预测、公差统计分析
 * Section 1.3.2
 */

export interface DistributionParams {
  mean: number       // 均值
  stdDev: number     // 标准差
  distribution?: 'normal' | 'uniform' | 'triangular'
  min?: number       // uniform/triangular 最小值
  max?: number       // uniform/triangular 最大值
  mode?: number      // triangular 众数
}

export interface MonteCarloResult {
  mean: number
  stdDev: number
  min: number
  max: number
  p5: number   // 5th percentile
  p95: number  // 95th percentile
  p99: number  // 99th percentile
  yield: number  // 良品率 (%)
  samples: number[]
  histogram: { bin: number; count: number }[]
}

/**
 * Box-Muller 变换生成正态分布随机数
 */
const randn = (): number => {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/**
 * 生成指定分布的随机数
 */
const generateRandom = (params: DistributionParams): number => {
  const dist = params.distribution || 'normal'
  
  switch (dist) {
    case 'normal': {
      return params.mean + params.stdDev * randn()
    }
    case 'uniform': {
      const min = params.min ?? params.mean - params.stdDev * Math.sqrt(3)
      const max = params.max ?? params.mean + params.stdDev * Math.sqrt(3)
      return min + (max - min) * Math.random()
    }
    case 'triangular': {
      const min = params.min ?? params.mean - params.stdDev * 2
      const max = params.max ?? params.mean + params.stdDev * 2
      const mode = params.mode ?? params.mean
      const u = Math.random()
      const fc = (mode - min) / (max - min)
      if (u < fc) {
        return min + Math.sqrt(u * (max - min) * (mode - min))
      } else {
        return max - Math.sqrt((1 - u) * (max - min) * (max - mode))
      }
    }
    default:
      return params.mean
  }
}

/**
 * 蒙特卡洛模拟
 * @param computeFn 计算函数，输入参数对象，输出单个数值
 * @param inputDistributions 输入参数的分布定义
 * @param numSamples 模拟次数 (默认 100000)
 * @param specLimits 规格限 { lower, upper }
 */
export const monteCarloSimulate = (
  computeFn: (params: Record<string, number>) => number,
  inputDistributions: Record<string, DistributionParams>,
  numSamples: number = 100000,
  specLimits?: { lower: number; upper: number }
): MonteCarloResult => {
  const samples: number[] = []
  const paramNames = Object.keys(inputDistributions)
  
  // 执行模拟
  for (let i = 0; i < numSamples; i++) {
    const params: Record<string, number> = {}
    for (const name of paramNames) {
      params[name] = generateRandom(inputDistributions[name])
    }
    samples.push(computeFn(params))
  }
  
  // 统计分析
  const sorted = [...samples].sort((a, b) => a - b)
  const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length
  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length
  const stdDev = Math.sqrt(variance)
  
  // 计算良品率
  let yieldRate = 100
  if (specLimits) {
    const withinSpec = sorted.filter(v => v >= specLimits.lower && v <= specLimits.upper)
    yieldRate = (withinSpec.length / sorted.length) * 100
  }
  
  // 构建直方图 (50 bins)
  const numBins = 50
  const binWidth = (sorted[sorted.length - 1] - sorted[0]) / numBins
  const histogram: { bin: number; count: number }[] = []
  
  for (let i = 0; i < numBins; i++) {
    const binStart = sorted[0] + i * binWidth
    const count = sorted.filter(v => v >= binStart && v < binStart + binWidth).length
    histogram.push({ bin: binStart, count })
  }
  
  return {
    mean,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: sorted[Math.floor(sorted.length * 0.05)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    yield: yieldRate,
    samples,
    histogram
  }
}

/**
 * 轴承寿命蒙特卡洛模拟
 * 考虑载荷、转速、材料强度的随机波动
 */
export const bearingLifeMonteCarlo = (
  nominalLoad: number,
  loadVariation: number,  // 载荷标准差 kN
  nominalSpeed: number,
  speedVariation: number,  // 转速标准差 rpm
  C_r: number,
  numSamples: number = 100000,
  minLifeHours?: number
): MonteCarloResult => {
  return monteCarloSimulate(
    (params) => {
      const Fr = params.Fr
      const speed = params.speed
      const P = 0.56 * Fr  // 简化当量载荷
      const L10 = Math.pow(C_r / P, 3)
      const L10h = (1000000 / (60 * speed)) * L10
      return L10h
    },
    {
      Fr: { mean: nominalLoad, stdDev: loadVariation, distribution: 'normal' },
      speed: { mean: nominalSpeed, stdDev: speedVariation, distribution: 'normal' }
    },
    numSamples,
    minLifeHours ? { lower: minLifeHours, upper: Infinity } : undefined
  )
}

/**
 * 公差堆叠分析 - 蒙特卡洛方法
 */
export const toleranceStackupMonteCarlo = (
  dimensions: { nominal: number; tolerance: number; distribution?: string }[],
  numSamples: number = 100000,
  specLimits?: { lower: number; upper: number }
): MonteCarloResult => {
  const inputDist: Record<string, DistributionParams> = {}
  
  dimensions.forEach((dim, idx) => {
    const key = `dim${idx}`
    // 假设公差为 +/- 3σ (99.73% 覆盖)
    const stdDev = dim.tolerance / 3
    inputDist[key] = {
      mean: dim.nominal,
      stdDev,
      distribution: (dim.distribution as any) || 'normal'
    }
  })
  
  return monteCarloSimulate(
    (params) => {
      let stackup = 0
      dimensions.forEach((dim, idx) => {
        stackup += params[`dim${idx}`]
      })
      return stackup
    },
    inputDist,
    numSamples,
    specLimits
  )
}
