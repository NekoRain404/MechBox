/**
 * 轴强度校核计算引擎
 * 轴强度/挠度/临界转速基础校核
 * DEV_DOC Section 4.2
 */

import { CalcResult, Warning } from '../types'

export interface ShaftParams {
  diameter: number          // 轴径 d (mm)
  length: number            // 跨度 L (mm)
  bendingMoment: number     // 弯矩 M_b (N·mm)
  torque: number            // 扭矩 T (N·mm)
  axialForce?: number       // 轴向力 N
  materialYield: number     // 材料屈服强度 MPa
  supportType?: 'simply' | 'cantilever' | 'fixed'  // 支承类型
}

export interface ShaftResult {
  axialStress: number         // 轴向应力 MPa
  bendingStress: number       // 弯曲应力 MPa
  torsionalStress: number     // 扭转应力 MPa
  vonMisesStress: number      // von Mises 等效应力 MPa
  safetyFactor: number        // 安全系数
  deflection: number          // 最大挠度 mm
  criticalSpeed: number       // 临界转速 rpm
  warnings: Warning[]
}

/**
 * 轴强度校核
 */
export const calcShaftStrength = (params: ShaftParams): CalcResult<ShaftResult> => {
  const warnings: Warning[] = []
  const { diameter: d, length: L, bendingMoment: Mb, torque: T, axialForce = 0, materialYield, supportType = 'simply' } = params

  if (d <= 0 || L <= 0 || materialYield <= 0) {
    warnings.push({ level: 'error', message: '轴径、跨度和材料屈服强度必须大于 0' })
    return {
      value: {
        axialStress: 0,
        bendingStress: 0,
        torsionalStress: 0,
        vonMisesStress: 0,
        safetyFactor: 0,
        deflection: 0,
        criticalSpeed: 0,
        warnings,
      },
      unit: 'MPa',
      warnings,
    }
  }

  // 截面系数
  const area = Math.PI * Math.pow(d, 2) / 4  // 横截面积
  const W = Math.PI * Math.pow(d, 3) / 32  // 抗弯截面系数
  const Wt = Math.PI * Math.pow(d, 3) / 16  // 抗扭截面系数

  // 轴向应力
  const axialStress = axialForce / area

  // 弯曲应力
  const bendingStress = Mb / W

  // 扭转应力
  const torsionalStress = T / Wt

  const normalStress = axialStress + bendingStress

  // von Mises 等效应力
  const vonMisesStress = Math.sqrt(Math.pow(normalStress, 2) + 3 * Math.pow(torsionalStress, 2))

  // 安全系数
  const safetyFactor = vonMisesStress > 0 ? materialYield / vonMisesStress : Infinity

  if (safetyFactor < 1.5) {
    warnings.push({ level: 'error', message: `安全系数 ${safetyFactor.toFixed(2)} 不足`, suggestion: '建议安全系数 ≥ 1.5~2.0' })
  } else if (safetyFactor < 2.0) {
    warnings.push({ level: 'warning', message: '安全系数偏低' })
  }

  // 挠度计算
  const E = 2.06e5  // 钢弹性模量 MPa
  const I = Math.PI * Math.pow(d, 4) / 64  // 惯性矩
  const equivalentPointLoad =
    supportType === 'cantilever'
      ? Mb / L
      : supportType === 'fixed'
        ? (8 * Mb) / L
        : (4 * Mb) / L

  let deflection = 0
  switch (supportType) {
    case 'simply':
      // 按“中点集中载荷与给定最大弯矩等效”估算
      deflection = equivalentPointLoad * Math.pow(L, 3) / (48 * E * I)
      break
    case 'cantilever':
      // 按“端部集中载荷与给定固定端弯矩等效”估算
      deflection = equivalentPointLoad * Math.pow(L, 3) / (3 * E * I)
      break
    case 'fixed':
      // 按“双端固支中点集中载荷与给定最大弯矩等效”估算
      deflection = equivalentPointLoad * Math.pow(L, 3) / (192 * E * I)
      break
  }

  // 一阶临界转速估算，基于挠度的简化 Rayleigh 关系
  const g = 9810  // mm/s²
  const criticalSpeed = deflection > 0 ? 30 * Math.sqrt(g / deflection) : 0

  if (deflection > 0.001 * L) {
    warnings.push({ level: 'warning', message: '挠度过大', suggestion: '建议挠度 < 0.001L' })
  }

  if (Mb > 0) {
    warnings.push({
      level: 'info',
      message: '挠度与临界转速按等效集中载荷估算',
      suggestion: '若需精确结果，请补充载荷位置、支承跨度和台阶轴分段刚度',
    })
  }

  return {
    value: {
      axialStress,
      bendingStress,
      torsionalStress,
      vonMisesStress,
      safetyFactor,
      deflection,
      criticalSpeed,
      warnings
    },
    unit: 'MPa',
    warnings
  }
}
