/**
 * Monte Carlo Web Worker - 高性能并行计算
 * Section 1.3.2 - 本地超高频蒙特卡洛模拟
 */

interface DistributionParams {
  mean: number
  stdDev: number
  distribution?: 'normal' | 'uniform' | 'triangular' | string
  min?: number
  max?: number
  mode?: number
}

interface MonteCarloWorkerMessage {
  computeFn: (params: Record<string, number>) => number
  inputDistributions: Record<string, DistributionParams>
  numSamples: number
  specLimits?: { lower: number; upper: number }
}

self.onmessage = function (e: MessageEvent<MonteCarloWorkerMessage>) {
  const { computeFn, inputDistributions, numSamples, specLimits } = e.data

  // Box-Muller 变换生成正态分布随机数
  function randn() {
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  }

  // 生成指定分布的随机数
  function generateRandom(params: DistributionParams): number {
    const dist = params.distribution || 'normal'
    switch (dist) {
      case 'normal':
        return params.mean + params.stdDev * randn()
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

  const samples = []
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
    const withinSpec = sorted.filter((v) => v >= specLimits.lower && v <= specLimits.upper)
    yieldRate = (withinSpec.length / sorted.length) * 100
  }

  // 构建直方图 (50 bins)
  const numBins = 50
  const binWidth = (sorted[sorted.length - 1] - sorted[0]) / numBins
  const histogram: Array<{ bin: number; count: number }> = []
  for (let i = 0; i < numBins; i++) {
    const binStart = sorted[0] + i * binWidth
    const count = sorted.filter((v) => v >= binStart && v < binStart + binWidth).length
    histogram.push({ bin: binStart, count })
  }

  // 返回结果
  self.postMessage({
    mean,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: sorted[Math.floor(sorted.length * 0.05)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    yield: yieldRate,
    histogram,
    samplesCount: numSamples
  })
}
