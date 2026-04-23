import { CalcResult, Warning } from '../types'

/**
 * 螺栓计算引擎
 * 参考: GB/T 5782, VDI 2230
 */

// 螺栓性能等级数据
const PROPERTY_CLASSES: Record<string, { tensile_strength: number, yield_strength: number }> = {
  '4.8': { tensile_strength: 400, yield_strength: 320 },
  '8.8': { tensile_strength: 800, yield_strength: 640 },
  '10.9': { tensile_strength: 1000, yield_strength: 900 },
  '12.9': { tensile_strength: 1200, yield_strength: 1080 },
}

// 推荐预紧扭矩表 (8.8级, 干摩擦 K=0.2)
const TORQUE_TABLE_8_8: Record<string, number> = {
  'M6': 10, 'M8': 25, 'M10': 49, 'M12': 85,
  'M16': 250, 'M20': 500, 'M24': 860, 'M30': 1650
}

/**
 * 计算预紧力
 * @param torque 预紧扭矩 (N·m)
 * @param diameter 螺栓公称直径 (mm)
 * @param K 扭矩系数 (默认0.2, 干摩擦)
 */
export const calcPreload = (torque: number, diameter: number, K: number = 0.2): CalcResult<number> => {
  const warnings: Warning[] = []
  
  if (torque <= 0) {
    warnings.push({ level: 'error', message: '预紧扭矩必须大于 0' })
    return { value: 0, unit: 'kN', warnings }
  }
  
  if (diameter <= 0) {
    warnings.push({ level: 'error', message: '螺栓直径必须大于 0' })
    return { value: 0, unit: 'kN', warnings }
  }
  
  // T = K × d × F_preload => F_preload = T / (K × d)
  const F_preload = (torque * 1000) / (K * diameter) // 转换为 N
  
  return { 
    value: F_preload / 1000, // 转换为 kN
    unit: 'kN', 
    warnings 
  }
}

/**
 * 计算螺栓应力
 * @param bolt 螺栓规格
 * @param axialForce 轴向力 (kN)
 * @param shearForce 剪切力 (kN)
 */
export const calcStress = (
  bolt: { stress_area?: number, designation: string, nominal_d?: number },
  axialForce: number,
  shearForce: number = 0
): CalcResult<{ tensile_stress: number, shear_stress: number, von_mises: number }> => {
  const warnings: Warning[] = []
  const diameter = bolt.nominal_d ?? extractDiameter(bolt.designation)
  const stressArea = bolt.stress_area ?? (diameter > 0 ? Math.PI * Math.pow(diameter, 2) / 4 : 0)
  
  if (stressArea <= 0) {
    warnings.push({ level: 'error', message: '螺栓应力截面积必须大于 0' })
    return { value: { tensile_stress: 0, shear_stress: 0, von_mises: 0 }, unit: 'MPa', warnings }
  }
  
  // 拉伸应力 σ = F / As
  const tensile_stress = (axialForce * 1000) / stressArea // MPa
  
  // 剪切应力 τ = F / (π × d² / 4)
  const shear_stress = shearForce > 0 
    ? (shearForce * 1000) / (Math.PI * Math.pow(diameter, 2) / 4)
    : 0
  
  // von Mises 等效应力 σ_eq = √(σ² + 3τ²)
  const von_mises = Math.sqrt(Math.pow(tensile_stress, 2) + 3 * Math.pow(shear_stress, 2))
  
  return { 
    value: { tensile_stress, shear_stress, von_mises }, 
    unit: 'MPa', 
    warnings 
  }
}

/**
 * 推荐螺栓规格
 * @param load 载荷 (kN)
 * @param propertyClass 性能等级 (如 "8.8")
 * @param safetyFactor 安全系数 (默认1.5)
 */
export const recommendSize = (
  load: number,
  propertyClass: string = '8.8',
  safetyFactor: number = 1.5
): CalcResult<string[]> => {
  const warnings: Warning[] = []
  
  const pc = PROPERTY_CLASSES[propertyClass]
  if (!pc) {
    warnings.push({ level: 'error', message: `未知的性能等级: ${propertyClass}` })
    return { value: [], unit: '', warnings }
  }
  
  if (load <= 0) {
    warnings.push({ level: 'error', message: '载荷必须大于 0' })
    return { value: [], unit: '', warnings }
  }
  
  // 所需应力截面积 As = F × S / σ_yield
  const required_area = (load * 1000 * safetyFactor) / pc.yield_strength
  
  return { 
    value: [`所需应力截面积 ≥ ${required_area.toFixed(1)} mm²`], 
    unit: 'mm²', 
    warnings 
  }
}

/**
 * 计算推荐预紧扭矩
 * @param designation 螺栓规格 (如 "M10")
 * @param propertyClass 性能等级
 */
export const recommendTorque = (designation: string, propertyClass: string = '8.8'): number => {
  const pc = PROPERTY_CLASSES[propertyClass]
  if (!pc) return 0
  
  // 基于8.8级的扭矩表进行换算
  const baseTorque = TORQUE_TABLE_8_8[designation]
  if (baseTorque === undefined) return 0
  
  // 扭矩与屈服强度成正比
  return baseTorque * (pc.yield_strength / 640)
}

/**
 * 从规格字符串中提取直径 (Section 13.4: 修复小数规格和公差带)
 */
const extractDiameter = (designation: string): number => {
  // 匹配 M1.6, M10, M10-6g, M10×1.5 等格式
  const match = designation.match(/M(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : 0
}
