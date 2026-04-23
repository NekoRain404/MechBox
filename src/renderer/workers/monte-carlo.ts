/**
 * Monte Carlo Worker - 独立线程执行概率模拟
 * Section 1.3.2 - 本地超高频 Monte Carlo 模拟
 */

interface DistributionParams {
  mean: number
  stdDev: number
  distribution?: string
  min?: number
  max?: number
}

interface WorkerMessage {
  inputDistributions: Record<string, DistributionParams>
  numSamples: number
  specLimits?: { lower: number; upper: number }
  computeType: 'bearing' | 'stackup'
}

interface WorkerResult {
  done: boolean
  error?: string
  mean?: number
  stdDev?: number
  min?: number
  max?: number
  p5?: number
  p95?: number
  p99?: number
  yield?: number
  histogram?: { bin: number; count: number }[]
  validSamples?: number
  skipped?: number
  progress?: number
}

// Box-Muller transform for normal distribution
function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function gen(p: DistributionParams): number {
  const d = p.distribution || 'normal'
  if (d === 'normal') return p.mean + p.stdDev * randn()
  const mn = p.min ?? p.mean - p.stdDev * Math.sqrt(3)
  const mx = p.max ?? p.mean + p.stdDev * Math.sqrt(3)
  return mn + (mx - mn) * Math.random()
}

self.onmessage = function(e: MessageEvent<WorkerMessage>) {
  const { inputDistributions, numSamples, specLimits, computeType } = e.data
  const samples: number[] = []
  const names = Object.keys(inputDistributions)
  let skipped = 0

  for (let i = 0; i < numSamples; i++) {
    const p: Record<string, number> = {}
    for (const n of names) p[n] = gen(inputDistributions[n])

    if (computeType === 'bearing') {
      const Fr = Math.max(p.Fr, 0.01)
      const speed = Math.max(p.speed, 10)
      const P = 0.56 * Fr
      if (P > 0.01 && p.C_r > 0) {
        const L10 = Math.pow(p.C_r / P, 3)
        const L10h = (1000000 / (60 * speed)) * L10
        if (L10h > 0 && isFinite(L10h)) samples.push(L10h)
        else skipped++
      } else {
        skipped++
      }
    } else {
      let s = 0
      for (const n of names) s += p[n]
      if (isFinite(s)) samples.push(s)
      else skipped++
    }

    if (i % 5000 === 0) {
      const result: WorkerResult = { done: false, progress: i / numSamples * 100 }
      self.postMessage(result)
    }
  }

  if (samples.length === 0) {
    const result: WorkerResult = {
      done: true,
      error: `无有效样本，请检查参数 (跳过 ${skipped} 次)`,
      validSamples: 0,
      skipped
    }
    self.postMessage(result)
    return
  }

  const sorted = [...samples].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((s, v) => s + v, 0) / n
  const variance = sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)

  let yld = 100
  if (specLimits) {
    const w = sorted.filter(v => v >= specLimits.lower && v <= specLimits.upper)
    yld = (w.length / n) * 100
  }

  const bins = 50
  const range = sorted[n - 1] - sorted[0]
  const bw = range > 0 ? range / bins : 1
  const histogram: { bin: number; count: number }[] = []
  for (let i = 0; i < bins; i++) {
    const bs = sorted[0] + i * bw
    const count = sorted.filter(v => v >= bs && v < bs + bw).length
    histogram.push({ bin: bs, count })
  }

  const result: WorkerResult = {
    done: true,
    mean, stdDev,
    min: sorted[0],
    max: sorted[n - 1],
    p5: sorted[Math.floor(n * 0.05)],
    p95: sorted[Math.floor(n * 0.95)],
    p99: sorted[Math.floor(n * 0.99)],
    yield: yld,
    histogram,
    validSamples: samples.length,
    skipped
  }
  self.postMessage(result)
}
