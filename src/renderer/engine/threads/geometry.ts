import { CalcResult, Warning } from '../types'

/**
 * 螺纹计算引擎
 * 参考: ISO 68-1, GB/T 196
 */

/**
 * 计算螺纹几何参数
 * @param designation 螺纹规格 (如 "M10×1.5")
 */
export const calcThreadGeometry = (designation: string): CalcResult<{
  nominal_diameter: number
  pitch: number
  pitch_diameter: number
  minor_diameter: number
  stress_area: number
  tensile_area: number
}> => {
  const warnings: Warning[] = []
  
  const parsed = parseThreadDesignation(designation)
  if (!parsed) {
    warnings.push({ level: 'error', message: '无效的螺纹规格格式' })
    return { 
      value: { 
        nominal_diameter: 0, pitch: 0, pitch_diameter: 0, 
        minor_diameter: 0, stress_area: 0, tensile_area: 0 
      }, 
      unit: 'mm', 
      warnings 
    }
  }
  
  const { d, pitch } = parsed
  
  // 中径 d2 = d - 0.6495 × P
  const d2 = d - 0.6495 * pitch
  
  // 小径 d1 = d - 1.0825 × P
  const d1 = d - 1.0825 * pitch
  
  // 应力截面积 As = π/4 × ((d2 + d1) / 2)²
  const stress_area = (Math.PI / 4) * Math.pow((d2 + d1) / 2, 2)
  
  // 拉伸面积 At = π/4 × d²
  const tensile_area = (Math.PI / 4) * Math.pow(d, 2)
  
  return {
    value: {
      nominal_diameter: d,
      pitch,
      pitch_diameter: d2,
      minor_diameter: d1,
      stress_area,
      tensile_area
    },
    unit: 'mm',
    warnings
  }
}

/**
 * 计算螺纹升角
 * @param pitch 螺距 (mm)
 * @param pitch_diameter 中径 (mm)
 */
export const calcLeadAngle = (pitch: number, pitch_diameter: number): CalcResult<number> => {
  const warnings: Warning[] = []
  
  if (pitch <= 0 || pitch_diameter <= 0) {
    warnings.push({ level: 'error', message: '螺距和中径必须大于 0' })
    return { value: 0, unit: '°', warnings }
  }
  
  // 升角 λ = arctan(P / (π × d2))
  const lead_angle = Math.atan(pitch / (Math.PI * pitch_diameter)) * (180 / Math.PI)
  
  return { value: lead_angle, unit: '°', warnings }
}

/**
 * 校验自锁条件
 * @param lead_angle 升角 (°)
 * @param friction_angle 摩擦角 (°)
 */
export const checkSelfLocking = (lead_angle: number, friction_angle: number = 5.71): CalcResult<{
  is_self_locking: boolean
  safety_margin: number
}> => {
  const warnings: Warning[] = []
  
  // 自锁条件: λ < φ (升角小于摩擦角)
  const is_self_locking = lead_angle < friction_angle
  const safety_margin = friction_angle - lead_angle
  
  if (!is_self_locking) {
    warnings.push({ 
      level: 'warning', 
      message: '不满足自锁条件，需考虑防松措施',
      suggestion: '建议增加弹簧垫圈、锁紧螺母或螺纹锁固胶'
    })
  }
  
  return {
    value: { is_self_locking, safety_margin },
    unit: '°',
    warnings
  }
}

/**
 * 解析螺纹规格字符串
 * @param designation 如 "M10×1.5" 或 "M10"
 */
const parseThreadDesignation = (designation: string): { d: number, pitch: number } | null => {
  // 匹配粗牙螺纹 (如 "M10")
  const coarseMatch = designation.match(/^M(\d+(?:\.\d+)?)$/i)
  if (coarseMatch) {
    const d = parseFloat(coarseMatch[1])
    // 粗牙螺距查表
    const coarsePitchTable: Record<number, number> = {
      2: 0.4, 2.5: 0.45, 3: 0.5, 4: 0.7, 5: 0.8, 6: 1.0,
      8: 1.25, 10: 1.5, 12: 1.75, 16: 2.0, 20: 2.5, 24: 3.0,
      30: 3.5, 36: 4.0, 42: 4.5, 48: 5.0
    }
    const pitch = coarsePitchTable[d]
    if (pitch) return { d, pitch }
  }
  
  // 匹配细牙螺纹 (如 "M10×1.5")
  const fineMatch = designation.match(/^M(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)$/i)
  if (fineMatch) {
    return {
      d: parseFloat(fineMatch[1]),
      pitch: parseFloat(fineMatch[2])
    }
  }
  
  return null
}
