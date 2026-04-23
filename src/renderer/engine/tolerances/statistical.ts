/**
 * 统计公差分析引擎 (Section 1.2)
 * 从极值法 (Worst-case) 升级到统计学方法
 * 支持 RSS (Root Sum Square) 和 Monte Carlo 公差分析
 */

import { Warning } from '../types'

export interface ToleranceDimension {
  nominal: number      // 名义尺寸 mm
  tolerance_plus: number   // 上偏差 mm
  tolerance_minus: number  // 下偏差 mm
  distribution?: 'uniform' | 'normal' | 'triangular'  // 分布类型
  processCapability?: number  // 工序能力指数 Cp (默认 1.33)
}

export interface StatisticalResult {
  nominal: number          // 名义总尺寸
  worstCaseTolerance: number  // 极值法公差
  rssTolerance: number     // RSS 统计公差
  simulatedMean: number    // 模拟均值
  simulatedStdDev: number  // 模拟标准差
  yieldRate: number        // 良品率 (%)
  cp: number               // 工序能力指数
  cpk: number              // 修正工序能力指数
  warnings: Warning[]
}

/**
 * RSS (Root Sum Square) 统计公差分析
 * 假设各尺寸独立正态分布
 */
export const calcRSS = (
  dimensions: ToleranceDimension[],
  upperSpec: number,
  lowerSpec: number
): StatisticalResult => {
  const warnings: Warning[] = []
  
  // 名义尺寸
  const nominal = dimensions.reduce((sum, d) => sum + d.nominal, 0)
  
  // 极值法公差 (最坏情况)
  const worstCaseTolerance = dimensions.reduce(
    (sum, d) => sum + Math.max(d.tolerance_plus, d.tolerance_minus), 0
  )
  
  // RSS 统计公差 (假设正态分布)
  const rssTolerance = Math.sqrt(
    dimensions.reduce(
      (sum, d) => sum + Math.pow(Math.max(d.tolerance_plus, d.tolerance_minus) / 3, 2), 0
    )
  ) * 3  // 3σ 覆盖 99.73%
  
  // 简化 Monte Carlo 模拟 (10000 次抽样)
  const samples: number[] = []
  for (let i = 0; i < 10000; i++) {
    let sample = 0
    for (const dim of dimensions) {
      const dist = dim.distribution || 'normal'
      const tol = Math.max(dim.tolerance_plus, dim.tolerance_minus)
      
      if (dist === 'normal') {
        // Box-Muller 变换
        const u1 = Math.random()
        const u2 = Math.random()
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        sample += dim.nominal + (tol / 3) * z
      } else if (dist === 'uniform') {
        sample += dim.nominal + (Math.random() - 0.5) * 2 * tol
      } else {
        // Triangular distribution
        const a = dim.nominal - tol
        const b = dim.nominal + tol
        const c = dim.nominal
        const u = Math.random()
        const fc = (c - a) / (b - a)
        sample += u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c))
      }
    }
    samples.push(sample)
  }
  
  const simulatedMean = samples.reduce((s, v) => s + v, 0) / samples.length
  const simulatedStdDev = Math.sqrt(
    samples.reduce((s, v) => s + Math.pow(v - simulatedMean, 2), 0) / samples.length
  )
  
  // 良品率
  const withinSpec = samples.filter(v => v >= lowerSpec && v <= upperSpec).length
  const yieldRate = (withinSpec / samples.length) * 100

  // 工序能力指数
  let cp = Infinity
  let cpk = Infinity
  
  if (simulatedStdDev > 0) {
    cp = (upperSpec - lowerSpec) / (6 * simulatedStdDev)
    const cpu = (upperSpec - simulatedMean) / (3 * simulatedStdDev)
    const cpl = (simulatedMean - lowerSpec) / (3 * simulatedStdDev)
    cpk = Math.min(cpu, cpl)
  } else {
    // 如果标准差为 0，且均值在规格内，则能力无限大
    const inSpec = simulatedMean >= lowerSpec && simulatedMean <= upperSpec
    cp = inSpec ? Infinity : 0
    cpk = inSpec ? Infinity : 0
  }
  
  // 警告检查
  if (cp < 1.0) {
    warnings.push({
      level: 'error',
      message: `工序能力不足 (Cp=${cp.toFixed(2)} < 1.0)`,
      suggestion: '放宽公差要求或提高加工精度'
    })
  } else if (cp < 1.33) {
    warnings.push({
      level: 'warning',
      message: `工序能力偏低 (Cp=${cp.toFixed(2)})`,
      suggestion: '建议 Cp ≥ 1.33 以保证稳定生产'
    })
  }
  
  if (cpk < cp) {
    warnings.push({
      level: 'warning',
      message: `分布中心偏移 (Cpk=${cpk.toFixed(2)} < Cp=${cp.toFixed(2)})`,
      suggestion: '检查名义尺寸设计是否居中'
    })
  }
  
  if (yieldRate < 99.73) {
    warnings.push({
      level: 'warning',
      message: `模拟良品率 ${(yieldRate).toFixed(2)}% < 99.73%`,
      suggestion: '考虑调整公差分配以提高良品率'
    })
  }
  
  return {
    nominal,
    worstCaseTolerance,
    rssTolerance,
    simulatedMean,
    simulatedStdDev,
    yieldRate,
    cp,
    cpk,
    warnings
  }
}

/**
 * 快速公差叠加分析 (Worst-case vs RSS 对比)
 */
export const quickToleranceStack = (
  dimensions: ToleranceDimension[]
): { worstCase: number, rss: number, savings: number } => {
  const worstCase = dimensions.reduce(
    (sum, d) => sum + Math.max(d.tolerance_plus, d.tolerance_minus), 0
  )

  const rss = Math.sqrt(
    dimensions.reduce(
      (sum, d) => sum + Math.pow(Math.max(d.tolerance_plus, d.tolerance_minus), 2), 0
    )
  )

  // 防止除以零
  const savings = worstCase > 0 ? ((1 - rss / worstCase) * 100) : 0

  return { worstCase, rss, savings }
}
