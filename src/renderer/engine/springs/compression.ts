/**
 * 弹簧计算引擎
 * 压缩/拉伸弹簧设计计算
 * DEV_DOC Section 6.6
 */

import { CalcResult, Warning } from '../types'

export interface SpringParams {
  wireDiameter: number     // 线径 d (mm)
  meanDiameter: number     // 中径 D (mm)
  activeCoils: number      // 有效圈数 n
  shearModulus: number     // 剪切模量 G (MPa), 钢≈79000
  load?: number            // 工作载荷 F (N)
  freeLength?: number      // 自由长度 (mm)
  springIndex?: number     // 弹簧指数 C = D/d
}

export interface SpringResult {
  springRate: number          // 弹簧刚度 N/mm
  deflection: number          // 变形量 mm
  shearStress: number         // 切应力 MPa
  springIndex: number         // 弹簧指数 C
  curvatureFactor: number     // 曲度系数 K
  solidLength: number         // 并紧长度 mm
  naturalFreq: number         // 固有频率 Hz
  warnings: Warning[]
}

/**
 * 弹簧指数颜色标识 (ISO 10243)
 */
export const getSpringColorGrade = (springRate: number, maxDeflection: number): string => {
  const ratio = maxDeflection / 100  // 变形百分比
  if (ratio <= 0.25) return '绿 / 超重载'
  if (ratio <= 0.30) return '红 / 重载'
  if (ratio <= 0.35) return '蓝 / 中载'
  return '黄 / 轻载'
}

/**
 * 压缩弹簧计算
 */
export const calcCompressionSpring = (params: SpringParams): CalcResult<SpringResult> => {
  const warnings: Warning[] = []
  const { wireDiameter: d, meanDiameter: D, activeCoils: n, shearModulus: G, load = 0 } = params

  if (d <= 0 || D <= 0 || n <= 0) {
    warnings.push({ level: 'error', message: '线径、中径和圈数必须大于 0' })
    return { value: { springRate: 0, deflection: 0, shearStress: 0, springIndex: 0, curvatureFactor: 0, solidLength: 0, naturalFreq: 0, warnings }, unit: '', warnings }
  }

  // 弹簧指数
  const springIndex = D / d

  if (springIndex < 4) {
    warnings.push({ level: 'warning', message: '弹簧指数过小，制造困难', suggestion: '推荐 C = 4~16' })
  } else if (springIndex > 16) {
    warnings.push({ level: 'warning', message: '弹簧指数过大，易失稳', suggestion: '推荐 C = 4~16' })
  }

  // 曲度系数 (Wahl 公式)
  const curvatureFactor = (4 * springIndex - 1) / (4 * springIndex - 4) + 0.615 / springIndex

  // 弹簧刚度
  const springRate = G * Math.pow(d, 4) / (8 * Math.pow(D, 3) * n)

  // 变形量
  const deflection = load > 0 ? load / springRate : 0

  // 最大切应力
  const shearStress = load > 0 ? (8 * load * D * curvatureFactor) / (Math.PI * Math.pow(d, 3)) : 0

  // 并紧长度
  const solidLength = (n + 1.5) * d  // 假设两端各磨平 0.75 圈

  // 固有频率 (假设弹簧质量)
  const springMass = Math.PI / 4 * Math.pow(d, 2) * (n + 2) * D * 7.85e-6  // kg (钢密度 7.85 g/cm³)
  const naturalFreq = springMass > 0 ? (1 / (2 * Math.PI)) * Math.sqrt(springRate / springMass * 1000) : 0

  if (naturalFreq < 100 && load > 0) {
    warnings.push({ level: 'info', message: '固有频率较低，避免共振' })
  }

  return {
    value: {
      springRate,
      deflection,
      shearStress,
      springIndex,
      curvatureFactor,
      solidLength,
      naturalFreq,
      warnings
    },
    unit: 'N/mm',
    warnings
  }
}
