/**
 * ISO 6336 齿轮强度校核引擎 (Section 10.4)
 * 弯曲疲劳 + 接触疲劳 + 修形建议
 */

import { CalcResult, Warning } from '../types'

export interface GearISO6336Params {
  module: number           // 模数 m (mm)
  teeth1: number           // 小齿轮齿数 z1
  teeth2: number           // 大齿轮齿数 z2
  faceWidth: number        // 齿宽 b (mm)
  pressureAngle: number    // 压力角 α (°), 通常20°
  torque1: number          // 小齿轮扭矩 T1 (N·m)
  sigmaHlim: number        // 接触疲劳极限 MPa
  sigmaFlim: number        // 弯曲疲劳极限 MPa
  helixAngle?: number      // 螺旋角 β (°)
  KA?: number              // 使用系数
  KV?: number              // 动载系数
}

export interface GearISO6336Result {
  d1: number               // 小齿轮分度圆 mm
  d2: number               // 大齿轮分度圆 mm
  Ft: number               // 切向力 N
  sigmaH: number           // 接触应力 MPa
  sigmaF1: number          // 小齿轮弯曲应力 MPa
  sigmaF2: number          // 大齿轮弯曲应力 MPa
  SH: number               // 接触安全系数
  SF1: number              // 小齿轮弯曲安全系数
  SF2: number              // 大齿轮弯曲安全系数
  tipRelief: number        // 齿顶修缘量 μm
  warnings: Warning[]
}

/**
 * ISO 6336 齿轮强度校核
 * 包含接触疲劳和弯曲疲劳校核
 */
export const calcGearISO6336 = (params: GearISO6336Params): CalcResult<GearISO6336Result> => {
  const warnings: Warning[] = []

  if (
    params.module <= 0 ||
    params.teeth1 <= 0 ||
    params.teeth2 <= 0 ||
    params.faceWidth <= 0 ||
    params.pressureAngle <= 0 ||
    params.torque1 <= 0 ||
    params.sigmaHlim <= 0 ||
    params.sigmaFlim <= 0
  ) {
    warnings.push({ level: 'error', message: '模数、齿数、齿宽、扭矩和材料许用应力必须大于 0' })
    return {
      value: {
        d1: 0,
        d2: 0,
        Ft: 0,
        sigmaH: 0,
        sigmaF1: 0,
        sigmaF2: 0,
        SH: 0,
        SF1: 0,
        SF2: 0,
        tipRelief: 0,
        warnings,
      },
      unit: 'MPa',
      warnings,
    }
  }

  const beta = params.helixAngle ?? 0
  const KA = params.KA ?? 1.0
  const KV = params.KV ?? 1.1
  
  const betaRad = beta * Math.PI / 180
  const alphaRad = params.pressureAngle * Math.PI / 180
  
  // 分度圆直径
  const d1 = params.module * params.teeth1 / Math.cos(betaRad)
  const d2 = params.module * params.teeth2 / Math.cos(betaRad)
  
  // 切向力
  const Ft = 2000 * params.torque1 / d1  // N
  
  // 重合度计算 (简化)
  const epsilonAlpha = 1.7  // 端面重合度
  const epsilonBeta = params.faceWidth * Math.sin(betaRad) / (Math.PI * params.module)
  const epsilonGamma = Math.max(0.1, epsilonAlpha + epsilonBeta)
  
  // 接触应力计算 (ISO 6336-2)
  const ZH = 2.49  // 区域系数 (20°)
  const ZE = 189.8  // 弹性系数 (钢-钢)
  const Zepsilon = Math.sqrt((4 - epsilonAlpha) / 3 * (1 / epsilonGamma))  // 重合度系数
  const Zbeta = Math.cos(betaRad)  // 螺旋角系数
  
  const sigmaH = ZH * ZE * Zepsilon * Zbeta * 
    Math.sqrt(Ft * KA * KV / (params.faceWidth * d1) * (params.teeth2 / params.teeth1 + 1))
  
  // 弯曲应力计算 (ISO 6336-3)
  // 齿形系数 YFa (简化计算)
  const calcYFa = (z: number) => {
    if (z < 17) return 2.9  // 根切风险区
    if (z < 20) return 2.6
    if (z < 30) return 2.4
    if (z < 50) return 2.3
    return 2.2
  }
  
  const YFa1 = calcYFa(params.teeth1)
  const YFa2 = calcYFa(params.teeth2)
  
  const YSa1 = 1.55  // 应力修正系数
  const YSa2 = 1.55
  const Yepsilon = 0.25 + 0.75 / epsilonGamma  // 弯曲重合度系数
  const Ybeta = 1.0 - beta / 120  // 弯曲螺旋角系数
  
  const sigmaF1 = Ft * KA * KV * YFa1 * YSa1 * Yepsilon * Ybeta / (params.faceWidth * params.module)
  const sigmaF2 = Ft * KA * KV * YFa2 * YSa2 * Yepsilon * Ybeta / (params.faceWidth * params.module)
  
  // 安全系数
  const SH = params.sigmaHlim / sigmaH
  const SF1 = params.sigmaFlim / sigmaF1
  const SF2 = params.sigmaFlim / sigmaF2
  
  // 齿顶修缘建议 (经验公式)
  const tipRelief = 5 + 3 * params.module  // μm
  
  // 警告检查
  if (params.teeth1 < 17) {
    warnings.push({ 
      level: 'error', 
      message: `小齿轮齿数 ${params.teeth1} < 17，存在根切风险`,
      suggestion: '采用正变位齿轮 (x > 0) 避免根切'
    })
  }
  
  if (SH < 1.0) {
    warnings.push({ level: 'error', message: `接触安全系数不足 (SH=${SH.toFixed(2)} < 1.0)`, suggestion: '增大模数、齿宽或提高材料硬度' })
  } else if (SH < 1.5) {
    warnings.push({ level: 'warning', message: `接触安全系数偏低 (SH=${SH.toFixed(2)})` })
  }
  
  if (SF1 < 1.4) {
    warnings.push({ level: 'error', message: `小齿轮弯曲安全系数不足 (SF1=${SF1.toFixed(2)} < 1.4)`, suggestion: '增大模数或提高材料强度' })
  } else if (SF1 < 2.0) {
    warnings.push({ level: 'warning', message: `小齿轮弯曲安全系数偏低 (SF1=${SF1.toFixed(2)})` })
  }
  
  if (epsilonGamma < 1.2) {
    warnings.push({ level: 'warning', message: `重合度 ${epsilonGamma.toFixed(2)} < 1.2，传动平稳性差`, suggestion: '增大齿宽或减小模数' })
  }
  
  return {
    value: {
      d1, d2, Ft, sigmaH, sigmaF1, sigmaF2, SH, SF1, SF2, tipRelief,
      warnings
    },
    unit: 'MPa',
    warnings
  }
}

/**
 * 齿轮变位系数推荐
 * 避免根切并优化性能
 */
export const recommendModificationCoefficients = (z1: number, z2: number): { x1: number, x2: number } => {
  // 避免根切的最小变位系数
  const x1_min = (17 - z1) / 17
  const x2_min = (17 - z2) / 17
  
  // 推荐值 (留有余量)
  const x1 = Math.max(0, x1_min + 0.1)
  const x2 = Math.max(0, x2_min + 0.1)
  
  return { x1, x2 }
}
