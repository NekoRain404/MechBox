/**
 * Section 10.5: 弹簧失稳 (Buckling) 校核
 * 基于 Haringx 理论，计算临界压缩变形量，防止侧向失稳
 */
import { Warning } from '../types'

export interface SpringBucklingParams {
  freeLength: number       // L0 自由长度 mm
  meanDiameter: number     // D 中径 mm
  endCondition: 'fixed-fixed' | 'fixed-hinged' | 'hinged-hinged' | 'fixed-free'
  workingDeflection: number // δ 工作压缩量 mm
}

export interface SpringBucklingResult {
  criticalLength: number   // Lcr 临界长度 mm
  safetyFactor: number     // 失稳安全系数
  maxDeflection: number    // δmax 允许最大压缩量 mm
  warnings: Warning[]
}

// 端部约束系数 μ (Haringx theory)
const endConditionMu: Record<string, number> = {
  'fixed-fixed': 0.5,
  'fixed-hinged': 0.707,
  'hinged-hinged': 1.0,
  'fixed-free': 2.0
}

export const calcSpringBuckling = (params: SpringBucklingParams): SpringBucklingResult => {
  const warnings: Warning[] = []
  const mu = endConditionMu[params.endCondition] || 1.0
  
  // Haringx 临界自由长度近似
  // Lcr ≈ (2.63 * D) / μ
  const criticalLength = (2.63 * params.meanDiameter) / mu

  // 这里将 Lcr 视作“无导向条件下的最大推荐自由长度”。
  // 如果 L0 已经大于 Lcr，则自由状态就偏细长；压缩到 Lcr 以下才算进入相对稳定区。
  const effectiveLength = Math.max(0.1, params.freeLength - params.workingDeflection)
  const requiredDeflectionToStable = Math.max(0, params.freeLength - criticalLength)
  const safetyFactor = criticalLength / Math.max(0.1, params.freeLength)

  if (params.freeLength > criticalLength) {
    warnings.push({
      level: 'error',
      message: `自由长度 ${params.freeLength.toFixed(1)}mm 超出临界长度 ${criticalLength.toFixed(1)}mm`,
      suggestion: '缩短自由长度，或增加导杆/导套与端部约束',
    })

    if (params.workingDeflection < requiredDeflectionToStable) {
      warnings.push({
        level: 'warning',
        message: `当前工作压缩量 ${params.workingDeflection.toFixed(1)}mm 仍不足以进入稳定区`,
        suggestion: `至少压缩 ${requiredDeflectionToStable.toFixed(1)}mm 后，自由长度才会降到临界长度以内`,
      })
    }
  } else if (safetyFactor < 1.5) {
    warnings.push({ level: 'warning', message: `失稳安全系数偏低 (SF=${safetyFactor.toFixed(2)})` })
  }

  if (effectiveLength > criticalLength) {
    warnings.push({
      level: 'warning',
      message: `工作状态下有效长度 ${effectiveLength.toFixed(1)}mm 仍高于临界长度`,
      suggestion: '当前压缩量下仍应优先考虑导向结构或重新设计长径比',
    })
  }
  
  return {
    criticalLength,
    safetyFactor: safetyFactor > 0 ? safetyFactor : 0,
    maxDeflection: requiredDeflectionToStable,
    warnings,
  }
}
