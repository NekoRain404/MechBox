/**
 * Section 10.5: 轴系疲劳强度准则
 * Goodman / Soderberg / Gerber 疲劳安全系数计算
 */
import { Warning } from '../types'

export interface ShaftFatigueParams {
  alternatingStress: number // σ_a 交变应力 MPa
  meanStress: number        // σ_m 平均应力 MPa
  enduranceLimit: number    // S_e 修正后疲劳极限 MPa
  yieldStrength: number     // S_y 屈服强度 MPa
  ultimateStrength: number  // S_u 抗拉强度 MPa
  criterion: 'goodman' | 'soderberg'
}

export interface FatigueResult {
  fatigueSafetyFactor: number // 疲劳安全系数 n
  staticYieldSF: number       // 静态屈服安全系数
  criterion: string
  warnings: Warning[]
}

export const calcShaftFatigue = (params: ShaftFatigueParams): FatigueResult => {
  const warnings: Warning[] = []
  const { alternatingStress: sa, meanStress: sm, enduranceLimit: Se, yieldStrength: Sy, ultimateStrength: Su, criterion } = params
  
  if (Se <= 0 || Su <= 0 || Sy <= 0) {
    return { fatigueSafetyFactor: 0, staticYieldSF: 0, criterion, warnings: [{ level: 'error', message: '材料强度参数必须大于 0' }] }
  }

  let n = 0
  if (criterion === 'goodman') {
    // Goodman 直线准则: sa/Se + sm/Su = 1/n
    const denom = (sa / Se) + (sm / Su)
    n = denom > 0 ? 1 / denom : Infinity
  } else {
    // Soderberg 直线准则: sa/Se + sm/Sy = 1/n (更保守)
    const denom = (sa / Se) + (sm / Sy)
    n = denom > 0 ? 1 / denom : Infinity
  }
  
  const staticSF = Sy / (sa + sm)
  
  if (n < 1.5) {
    warnings.push({ level: 'error', message: `疲劳安全系数不足 (n=${n.toFixed(2)} < 1.5)`, suggestion: '增大轴径、降低应力集中或改用高强度材料' })
  } else if (n < 2.5) {
    warnings.push({ level: 'warning', message: `疲劳安全系数偏低 (${n.toFixed(2)})` })
  }
  
  if (staticSF < 1.5) {
    warnings.push({ level: 'error', message: '静态屈服风险', suggestion: '峰值交变+平均应力超过材料屈服强度' })
  }
  
  return { fatigueSafetyFactor: n, staticYieldSF: staticSF, criterion: criterion.toUpperCase(), warnings }
}
