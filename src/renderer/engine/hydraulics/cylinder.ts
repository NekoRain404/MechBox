/**
 * 液压气动计算引擎
 * 液压缸/气缸设计与计算
 * DEV_DOC Section 6.9
 */

import { CalcResult, Warning } from '../types'

export type CylinderRodEndCondition =
  | 'fixed-fixed'
  | 'fixed-pinned'
  | 'pinned-pinned'
  | 'fixed-free'

export const cylinderEndConditionOptions: Array<{
  value: CylinderRodEndCondition
  label: string
  factor: number
}> = [
  { value: 'fixed-fixed', label: '两端固定', factor: 0.5 },
  { value: 'fixed-pinned', label: '一端固定一端铰接', factor: 0.7 },
  { value: 'pinned-pinned', label: '两端铰接', factor: 1.0 },
  { value: 'fixed-free', label: '一端固定一端自由', factor: 2.0 },
]

export interface CylinderParams {
  boreDiameter: number       // 缸径 D (mm)
  rodDiameter: number        // 杆径 d (mm)
  pressure: number           // 工作压力 MPa
  stroke: number             // 行程 mm
  unsupportedLength?: number // 受压自由长度 mm
  endCondition?: CylinderRodEndCondition // 杆端支承条件
  flowRate?: number          // 流量 L/min
  targetExtendTime?: number  // 目标伸出时间 s
}

export interface CylinderResult {
  pistonArea: number          // 活塞面积 mm²
  extendForce: number         // 伸出推力 N
  retractForce: number        // 缩回拉力 N
  extendSpeed: number         // 伸出速度 mm/s
  retractSpeed: number        // 缩回速度 mm/s
  extendTime: number          // 伸出时间 s
  retractTime: number         // 缩回时间 s
  requiredExtendFlow: number  // 目标伸出节拍所需流量 L/min
  criticalBucklingForce: number // 欧拉临界载荷 N
  bucklingSafetyFactor: number  // 稳定安全系数
  effectiveLengthFactor: number // 有效长度系数
  bucklingRisk: boolean       // 失稳风险
  warnings: Warning[]
}

// 标准缸径系列 (GB/T 2348)
export const standardBoreSizes = [20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 180, 200, 220, 250, 280, 320]

/**
 * 液压缸计算
 */
export const calcCylinder = (params: CylinderParams): CalcResult<CylinderResult> => {
  const warnings: Warning[] = []
  const {
    boreDiameter: D,
    rodDiameter: d,
    pressure: P,
    stroke,
    unsupportedLength = stroke,
    endCondition = 'fixed-pinned',
    flowRate = 0,
    targetExtendTime = 0,
  } = params

  if (D <= 0 || d <= 0 || stroke <= 0 || unsupportedLength <= 0 || P < 0) {
    warnings.push({ level: 'error', message: '缸径、杆径、行程和受压自由长度必须大于 0，压力不能为负' })
    return {
      value: {
        pistonArea: 0,
        extendForce: 0,
        retractForce: 0,
        extendSpeed: 0,
        retractSpeed: 0,
        extendTime: 0,
        retractTime: 0,
        requiredExtendFlow: 0,
        criticalBucklingForce: 0,
        bucklingSafetyFactor: 0,
        effectiveLengthFactor: 0,
        bucklingRisk: false,
        warnings,
      },
      unit: 'N',
      warnings,
    }
  }

  if (d >= D) {
    warnings.push({ level: 'error', message: '杆径不能大于或等于缸径' })
    return {
      value: {
        pistonArea: 0,
        extendForce: 0,
        retractForce: 0,
        extendSpeed: 0,
        retractSpeed: 0,
        extendTime: 0,
        retractTime: 0,
        requiredExtendFlow: 0,
        criticalBucklingForce: 0,
        bucklingSafetyFactor: 0,
        effectiveLengthFactor: 0,
        bucklingRisk: false,
        warnings,
      },
      unit: 'N',
      warnings,
    }
  }

  // 活塞面积
  const pistonArea = Math.PI * Math.pow(D, 2) / 4

  // 伸出推力
  const extendForce = P * pistonArea

  // 缩回拉力
  const rodArea = Math.PI * Math.pow(d, 2) / 4
  const annulusArea = pistonArea - rodArea
  const retractForce = P * annulusArea

  // 速度计算
  const extendSpeed = flowRate > 0 ? (flowRate * 1e6 / 60) / pistonArea : 0
  const retractSpeed = flowRate > 0 ? (flowRate * 1e6 / 60) / annulusArea : 0

  const extendTime = extendSpeed > 0 ? stroke / extendSpeed : 0
  const retractTime = retractSpeed > 0 ? stroke / retractSpeed : 0
  const requiredExtendFlow =
    targetExtendTime > 0 ? (pistonArea * stroke / targetExtendTime) / 1e6 * 60 : 0

  // 压杆稳定校核 (欧拉公式)
  const E = 2.06e5  // 钢弹性模量 MPa
  const I = Math.PI * Math.pow(d, 4) / 64  // 惯性矩
  const effectiveLengthFactor =
    cylinderEndConditionOptions.find((item) => item.value === endCondition)?.factor ?? 0.7
  const effectiveLength = effectiveLengthFactor * unsupportedLength
  const criticalForce = Math.PI * Math.PI * E * I / Math.pow(effectiveLength, 2)
  const bucklingSafetyFactor = extendForce > 0 ? criticalForce / extendForce : 0

  let bucklingRisk = false
  if (bucklingSafetyFactor < 1) {
    bucklingRisk = true
    warnings.push({
      level: 'error',
      message: `压杆稳定已失效，安全系数仅 ${bucklingSafetyFactor.toFixed(2)}`,
      suggestion: '立即增大杆径、缩短受压自由长度或提高支承刚度',
    })
  } else if (bucklingSafetyFactor < 2) {
    bucklingRisk = true
    warnings.push({
      level: 'warning',
      message: `压杆稳定裕量偏低，安全系数 ${bucklingSafetyFactor.toFixed(2)}`,
      suggestion: '建议把稳定安全系数提高到 2 以上，再结合导向与偏载复核',
    })
  }

  if (unsupportedLength > stroke * 1.2) {
    warnings.push({
      level: 'info',
      message: '受压自由长度明显大于行程，请确认是否已把外伸悬臂段计入稳定计算',
    })
  }

  return {
    value: {
      pistonArea,
      extendForce,
      retractForce,
      extendSpeed,
      retractSpeed,
      extendTime,
      retractTime,
      requiredExtendFlow,
      criticalBucklingForce: criticalForce,
      bucklingSafetyFactor,
      effectiveLengthFactor,
      bucklingRisk,
      warnings
    },
    unit: 'N',
    warnings
  }
}
