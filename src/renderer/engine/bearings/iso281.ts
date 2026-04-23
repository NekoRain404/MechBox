/**
 * Section 10.2: 轴承系统 - ISO 281 修正寿命计算
 * 从基础 L10 到修正额定寿命
 */

import { CalcResult, Warning } from '../types'

export interface ISO281Params {
  C_r: number            // 额定动载荷 kN
  P: number              // 当量动载荷 kN
  n: number              // 转速 rpm
  bearingType: 'ball' | 'roller'
  kappa?: number         // 润滑膜厚度比 (粘度比)
  a_1?: number           // 可靠性系数
  eta_c?: number         // 污染系数
  P_u?: number           // 疲劳极限载荷 kN
}

export interface ISO281Result {
  L10_basic: number      // 基础额定寿命 (百万转)
  L10h_basic: number     // 基础小时寿命 (h)
  a_ISO: number          // ISO 修正系数
  L10m: number           // 修正额定寿命 (百万转)
  L10mh: number          // 修正小时寿命 (h)
  warnings: Warning[]
}

/**
 * ISO 281 修正额定寿命计算
 */
export const calcISO281Life = (params: ISO281Params): CalcResult<ISO281Result> => {
  const warnings: Warning[] = []
  
  if (params.P <= 0) {
    warnings.push({ level: 'error', message: '当量动载荷必须大于 0' })
    return { value: { L10_basic: 0, L10h_basic: 0, a_ISO: 1, L10m: 0, L10mh: 0, warnings }, unit: 'h', warnings }
  }
  
  // 基础 L10 寿命
  const p = params.bearingType === 'ball' ? 3 : 10 / 3
  const L10_basic = Math.pow(params.C_r / params.P, p)
  const L10h_basic = (1000000 / (60 * params.n)) * L10_basic
  
  // ISO 281 修正系数 a_ISO
  const kappa = params.kappa ?? 1.0  // 默认正常润滑
  const a_1 = params.a_1 ?? 1.0      // 默认 90% 可靠性
  const eta_c = params.eta_c ?? 1.0  // 默认按洁净工况估算
  const P_u = params.P_u ?? params.C_r * 0.05  // 疲劳极限载荷估算
  
  // 简化版 a_ISO 计算 (基于润滑和污染)
  let a_ISO = 1.0
  
  if (kappa >= 4) {
    a_ISO = 1.0 + 0.4 * Math.pow(kappa - 1, 0.5)
  } else if (kappa >= 1) {
    a_ISO = 1.0
  } else if (kappa > 0.1) {
    a_ISO = Math.pow(kappa, 0.5)
  } else {
    a_ISO = 0.1
    warnings.push({ level: 'error', message: '润滑膜厚度比过低，轴承寿命将严重缩短' })
  }
  
  // 污染系数修正
  a_ISO *= eta_c
  
  // 上限 50
  a_ISO = Math.min(a_ISO, 50)
  
  // 修正额定寿命
  const L10m = L10_basic * a_1 * a_ISO
  const L10mh = (1000000 / (60 * params.n)) * L10m
  
  // 最小载荷校核 (防止 skidding)
  const P_min = params.bearingType === 'ball' 
    ? params.C_r * 0.01  // 球轴承 1% C_r
    : params.C_r * 0.02  // 滚子轴承 2% C_r
  
  if (params.P < P_min) {
    warnings.push({ 
      level: 'warning', 
      message: `当量载荷过低，存在 skidding 风险 (${params.P.toFixed(2)} kN < ${P_min.toFixed(2)} kN)`,
      suggestion: '可能发生滚动体滑动 (skidding)，导致轴承擦伤'
    })
  }
  
  // 可靠性警告
  if (a_1 < 0.5) {
    warnings.push({ level: 'warning', message: `可靠性系数 ${a_1} 过低，寿命已大幅缩减` })
  }
  
  return {
    value: {
      L10_basic,
      L10h_basic,
      a_ISO,
      L10m,
      L10mh,
      warnings
    },
    unit: 'h',
    warnings
  }
}

/**
 * 润滑膜厚度比 (κ) 计算
 * @param nu_operating 工作温度下润滑油运动粘度 (mm²/s)
 * @param nu_rated 轴承额定粘度 (mm²/s)
 */
export const calcKappa = (nu_operating: number, nu_rated: number): number => {
  if (nu_rated <= 0) return 0
  return nu_operating / nu_rated
}

/**
 * 可靠性系数 a_1 查询
 * @param reliability 要求可靠性 (%)
 */
export const getA1Factor = (reliability: number): number => {
  const table: Record<number, number> = {
    90: 1.0,
    95: 0.64,
    96: 0.55,
    97: 0.47,
    98: 0.37,
    99: 0.25,
    99.5: 0.18,
    99.9: 0.10
  }
  
  // 查找最接近的值
  const closest = Object.keys(table)
    .map(Number)
    .sort((a, b) => Math.abs(a - reliability) - Math.abs(b - reliability))[0]
  
  return table[closest] ?? 1.0
}
