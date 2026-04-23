/**
 * 齿轮几何计算引擎
 * 渐开线圆柱齿轮几何尺寸计算
 * DEV_DOC Section 6.3
 */

import { CalcResult, Warning } from '../types'

export interface GearParams {
  module: number          // 模数 m (mm)
  teeth1: number          // 小齿轮齿数 z1
  teeth2: number          // 大齿轮齿数 z2
  pressureAngle: number   // 压力角 α (°), 通常20°
  helixAngle?: number     // 螺旋角 β (°), 直齿轮=0
  x1?: number             // 小齿轮变位系数
  x2?: number             // 大齿轮变位系数
  faceWidth?: number      // 齿宽 b (mm)
}

export interface GearGeometry {
  d1: number       // 小齿轮分度圆 mm
  d2: number       // 大齿轮分度圆 mm
  da1: number      // 小齿轮齿顶圆 mm
  da2: number      // 大齿轮齿顶圆 mm
  df1: number      // 小齿轮齿根圆 mm
  df2: number      // 大齿轮齿根圆 mm
  db1: number      // 小齿轮基圆 mm
  db2: number      // 大齿轮基圆 mm
  centerDistance: number  // 中心距 mm
  contactRatio: number   // 重合度
  warnings: Warning[]
}

/**
 * 标准模数系列 (GB/T 1357)
 */
export const standardModules = [
  1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50
]

/**
 * 推荐模数 (根据中心距)
 */
export const recommendModule = (centerDistance: number): number => {
  // 经验公式: m ≈ (0.01~0.02) × a
  const m = 0.015 * centerDistance
  return standardModules.find(sm => sm >= m) || standardModules[standardModules.length - 1]
}

/**
 * 齿轮几何计算
 */
export const calcGearGeometry = (params: GearParams): CalcResult<GearGeometry> => {
  const warnings: Warning[] = []
  const { module: m, teeth1: z1, teeth2: z2, pressureAngle: alpha, helixAngle = 0, x1 = 0, x2 = 0, faceWidth = 0 } = params

  if (m <= 0 || z1 <= 0 || z2 <= 0 || alpha <= 0) {
    warnings.push({ level: 'error', message: '模数、齿数和压力角必须大于 0' })
    return {
      value: {
        d1: 0,
        d2: 0,
        da1: 0,
        da2: 0,
        df1: 0,
        df2: 0,
        db1: 0,
        db2: 0,
        centerDistance: 0,
        contactRatio: 0,
        warnings,
      },
      unit: 'mm',
      warnings,
    }
  }
  
  const betaRad = helixAngle * Math.PI / 180
  const alphaRad = alpha * Math.PI / 180
  const alphaT = Math.atan(Math.tan(alphaRad) / Math.cos(betaRad))  // 端面压力角

  // 分度圆直径
  const d1 = m * z1 / Math.cos(betaRad)
  const d2 = m * z2 / Math.cos(betaRad)

  // 齿顶高系数和顶隙系数
  const haStar = 1.0
  const cStar = 0.25

  // 齿顶圆直径
  const da1 = d1 + 2 * m * (haStar + x1)
  const da2 = d2 + 2 * m * (haStar + x2)

  // 齿根圆直径
  const df1 = d1 - 2 * m * (haStar + cStar - x1)
  const df2 = d2 - 2 * m * (haStar + cStar - x2)

  // 基圆直径
  const db1 = d1 * Math.cos(alphaT)
  const db2 = d2 * Math.cos(alphaT)

  // 中心距
  const centerDistance = (d1 + d2) / 2

  // 重合度计算 (简化)
  const ra1 = da1 / 2
  const ra2 = da2 / 2
  const rb1 = db1 / 2
  const rb2 = db2 / 2
  const pitchBase = Math.PI * m * Math.cos(alphaRad) / Math.cos(betaRad)
  const pathTerm1 = ra1 * ra1 - rb1 * rb1
  const pathTerm2 = ra2 * ra2 - rb2 * rb2
  const safePath1 = pathTerm1 >= 0 ? Math.sqrt(pathTerm1) : 0
  const safePath2 = pathTerm2 >= 0 ? Math.sqrt(pathTerm2) : 0

  if (pathTerm1 < 0) {
    warnings.push({ level: 'error', message: '小齿轮齿顶圆已低于基圆，当前几何无法形成有效啮合路径' })
  }
  if (pathTerm2 < 0) {
    warnings.push({ level: 'error', message: '大齿轮齿顶圆已低于基圆，当前几何无法形成有效啮合路径' })
  }
  
  const epsilonAlpha = pitchBase > 0
    ? (safePath1 + safePath2 - centerDistance * Math.sin(alphaT)) / pitchBase
    : 0

  const epsilonBeta = faceWidth * Math.sin(betaRad) / (Math.PI * m)
  const contactRatio = Number.isFinite(epsilonAlpha + epsilonBeta) ? epsilonAlpha + epsilonBeta : 0

  // 根切检查
  const minTeeth = Math.ceil(2 * haStar / Math.pow(Math.sin(alphaRad), 2))
  if (z1 < minTeeth && x1 === 0) {
    warnings.push({ level: 'error', message: `小齿轮齿数 ${z1} 小于最小齿数 ${minTeeth}，会发生根切`, suggestion: '增加变位系数或增大齿数' })
  }

  // 齿顶变尖检查
  if (da1 < db1) {
    warnings.push({ level: 'error', message: '小齿轮齿顶圆小于基圆，齿形异常' })
  }
  if (da2 < db2) {
    warnings.push({ level: 'error', message: '大齿轮齿顶圆小于基圆，齿形异常' })
  }

  if (contactRatio < 1.2) {
    warnings.push({ level: 'warning', message: `重合度 ${contactRatio.toFixed(2)} 偏小`, suggestion: '建议重合度 ≥ 1.2' })
  }

  return {
    value: {
      d1, d2, da1, da2, df1, df2, db1, db2, centerDistance, contactRatio,
      warnings
    },
    unit: 'mm',
    warnings
  }
}
