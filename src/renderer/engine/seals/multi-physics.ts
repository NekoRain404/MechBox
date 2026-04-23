/**
 * Section 10.1: 密封系统多场耦合计算
 * 热膨胀补偿 + 介质溶胀率 + 防挤出间隙校核
 */

import { CalcResult, Warning } from '../types'

export interface SealMultiPhysicsParams {
  cs: number           // 线径 mm
  id: number           // 内径 mm
  grooveDepth: number  // 沟槽深度 mm
  grooveWidth: number  // 沟槽宽度 mm
  clearance: number    // 配合间隙 mm
  temperature: number  // 工作温度 °C
  pressure: number     // 工作压力 MPa
  material: 'NBR' | 'FKM' | 'EPDM' | 'VMQ'
  medium: 'mineral_oil' | 'fuel' | 'water' | 'air'
  application: 'static' | 'reciprocating' | 'rotary'
}

// 材料热膨胀系数 (1/°C)
const thermalExpansionCoeff: Record<string, number> = {
  NBR: 180e-6,
  FKM: 190e-6,
  EPDM: 160e-6,
  VMQ: 220e-6,
}

// 介质溶胀率 (%) - 体积膨胀百分比
const swellingRate: Record<string, Record<string, number>> = {
  NBR: { mineral_oil: 5, fuel: 15, water: 2, air: 0 },
  FKM: { mineral_oil: 3, fuel: 5, water: 1, air: 0 },
  EPDM: { mineral_oil: 25, fuel: 30, water: 3, air: 0 },
  VMQ: { mineral_oil: 10, fuel: 20, water: 2, air: 0 },
}

// 极限挤出间隙曲线 (基于硬度和压力)
const extrusionLimit: Record<number, number[]> = {
  70: [0.08, 0.05, 0.03, 0.02],  // Shore A 70
  90: [0.15, 0.10, 0.06, 0.04],  // Shore A 90
}

export interface SealMultiPhysicsResult {
  compressionRatio: number     // 压缩率 %
  thermalExpansion: number     // 热膨胀量 mm
  swellingVolume: number       // 溶胀率 %
  fillRate: number             // 槽满率 %
  extrusionRisk: boolean       // 挤出风险
  adjustedCompression: number  // 修正后压缩率 %
  warnings: Warning[]
}

/**
 * 密封系统热-力-化多场耦合计算
 */
export const calcSealMultiPhysics = (params: SealMultiPhysicsParams): CalcResult<SealMultiPhysicsResult> => {
  const warnings: Warning[] = []
  const refTemp = 20 // 参考温度 °C

  // 1. 基础压缩率
  const baseCompression = ((params.cs - params.grooveDepth) / params.cs) * 100

  // 2. 热膨胀补偿
  const alpha = thermalExpansionCoeff[params.material]
  const tempDiff = params.temperature - refTemp
  const csThermal = params.cs * (1 + alpha * tempDiff)
  const thermalExpansion = csThermal - params.cs

  // 3. 介质溶胀
  const swellPercent = swellingRate[params.material]?.[params.medium] ?? 0
  const csSwollen = csThermal * (1 + swellPercent / 300) // 体积溶胀转为线性 (立方根)

  // 4. 修正后压缩率
  const adjustedCompression = ((csSwollen - params.grooveDepth) / csSwollen) * 100

  // 5. 槽满率
  const grooveVolume = Math.PI * (params.grooveWidth) * params.grooveDepth * (params.id + params.grooveDepth)
  const sealVolume = Math.PI / 4 * csSwollen * csSwollen * (params.id + csSwollen)
  const fillRate = (sealVolume / grooveVolume) * 100

  // 6. 挤出风险校核
  const hardness = params.material === 'FKM' ? 90 : 70 // Shore A
  const limits = extrusionLimit[hardness] || extrusionLimit[70]
  let limitIdx = 0
  if (params.pressure > 10) limitIdx = 1
  if (params.pressure > 20) limitIdx = 2
  if (params.pressure > 35) limitIdx = 3
  
  const maxClearance = limits[limitIdx]
  const extrusionRisk = params.clearance > maxClearance

  if (adjustedCompression < 10) {
    warnings.push({ level: 'warning', message: '修正压缩率过低，高温溶胀后可能泄漏' })
  }
  if (adjustedCompression > 35) {
    warnings.push({ level: 'error', message: '修正压缩率过高，高温下可能"胀死"沟槽' })
  }
  if (extrusionRisk) {
    warnings.push({ level: 'error', message: `配合间隙 ${params.clearance}mm 超出极限 ${maxClearance}mm`, suggestion: '添加挡圈或减小间隙' })
  }
  if (fillRate > 100) {
    warnings.push({ level: 'error', message: `槽满率 ${fillRate.toFixed(1)}% > 100%，高温下会胀出沟槽` })
  }

  // Section 11.4: Manufacturing constraint checks
  // 沟槽深径比过大时的刀具干涉风险
  const depthToWidthRatio = params.grooveDepth / params.grooveWidth
  if (depthToWidthRatio > 0.5) {
    warnings.push({ level: 'warning', message: `沟槽深径比 ${depthToWidthRatio.toFixed(2)} 过大`, suggestion: '需注意非标加长刀具的加工振动风险' })
  }

  return {
    value: {
      compressionRatio: baseCompression,
      thermalExpansion,
      swellingVolume: swellPercent,
      fillRate,
      extrusionRisk,
      adjustedCompression,
      warnings
    },
    unit: '%',
    warnings
  }
}
