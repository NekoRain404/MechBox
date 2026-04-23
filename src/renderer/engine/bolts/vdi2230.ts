/**
 * Section 10.3: 螺栓连接 - VDI 2230 全生命周期强度校核
 * 包含：嵌入损失、循环疲劳、螺纹啮合强度
 */

import { CalcResult, Warning } from '../types'

export interface VDI2230Params {
  boltDiameter: number       // 螺栓公称直径 mm
  boltClass: string          // 性能等级 (如 "8.8", "10.9")
  preloadForce: number       // 预紧力 kN
  axialWorkingForce: number  // 轴向工作载荷 kN
  shearWorkingForce: number  // 剪切工作载荷 kN
  cycles?: number            // 循环次数
  nutMaterial?: string       // 螺母材料 (用于螺纹啮合校核)
  surfaceRoughness?: number  // 表面粗糙度 Ra (μm) - 用于沉降计算
}

export interface VDI2230Result {
  yieldSafety: number        // 屈服安全系数
  fatigueSafety?: number     // 疲劳安全系数
  threadShearSafety?: number // 螺纹剪切安全系数
  settlingLoss: number       // 沉降损失 kN
  residualClampForce: number // 残余夹紧力 kN
  warnings: Warning[]
}

// 性能等级数据
const propertyClasses: Record<string, { yieldStrength: number; tensileStrength: number; fatigueLimit?: number }> = {
  '4.8': { yieldStrength: 320, tensileStrength: 400, fatigueLimit: 80 },
  '8.8': { yieldStrength: 640, tensileStrength: 800, fatigueLimit: 140 },
  '10.9': { yieldStrength: 900, tensileStrength: 1000, fatigueLimit: 200 },
  '12.9': { yieldStrength: 1080, tensileStrength: 1200, fatigueLimit: 240 },
}

/**
 * VDI 2230 全生命周期强度校核
 */
export const calcVDI2230 = (params: VDI2230Params): CalcResult<VDI2230Result> => {
  const warnings: Warning[] = []
  
  const pc = propertyClasses[params.boltClass]
  if (!pc) {
    warnings.push({ level: 'error', message: `未知性能等级: ${params.boltClass}` })
    return { value: { yieldSafety: 0, settlingLoss: 0, residualClampForce: 0, warnings }, unit: '', warnings }
  }
  
  // 应力截面积 (简化计算)
  const stressArea = Math.PI / 4 * Math.pow(params.boltDiameter * 0.85, 2)  // mm² (近似 0.85d)
  
  // 1. 屈服安全系数
  const totalStress = (params.preloadForce + params.axialWorkingForce) * 1000 / stressArea  // MPa
  const yieldSafety = pc.yieldStrength / totalStress
  
  // 2. 嵌入与沉降损失 (Settling)
  // 基于表面粗糙度的沉降量估算 (μm)
  const roughness = params.surfaceRoughness ?? 3.2  // 默认 Ra 3.2
  const settlingAmount = roughness * 0.5  // 简化估算 (μm)
  const boltStiffnessPerMm = 210000 * stressArea / (params.boltDiameter * 5)  // N/mm (假设 5d 夹持长度)
  const boltStiffness = boltStiffnessPerMm / 1000  // N/μm
  const settlingLoss = settlingAmount * boltStiffness / 1000  // kN
  
  // 残余夹紧力
  const residualClampForce = params.preloadForce - settlingLoss - params.axialWorkingForce * 0.2  // 20% 工作载荷影响
  
  // 3. 循环疲劳校核
  let fatigueSafety: number | undefined
  if (params.cycles && params.cycles > 10000) {
    const stressAmplitude = params.axialWorkingForce * 1000 / stressArea / 2
    const fatigueLimit = pc.fatigueLimit ?? pc.yieldStrength * 0.3
    fatigueSafety = fatigueLimit / stressAmplitude
    
    if (fatigueSafety < 1.5) {
      warnings.push({ level: 'warning', message: `疲劳安全系数过低 (${fatigueSafety.toFixed(2)})`, suggestion: '建议增大螺栓直径或提高等级' })
    }
  }
  
  // 4. 螺纹啮合强度 (针对软材料基体)
  let threadShearSafety: number | undefined
  if (params.nutMaterial === 'aluminum' || params.nutMaterial === 'soft_steel') {
    // 内螺纹剪切面积 (简化)
    const threadShearArea = Math.PI * params.boltDiameter * 0.6 * params.boltDiameter * 0.8  // mm² (近似)
    const threadShearStress = params.preloadForce * 1000 / threadShearArea  // MPa
    const nutYieldStrength = params.nutMaterial === 'aluminum' ? 150 : 300  // MPa
    threadShearSafety = nutYieldStrength / threadShearStress
    
    if (threadShearSafety < 1.5) {
      warnings.push({ level: 'error', message: `螺纹啮合强度不足 (安全系数 ${threadShearSafety.toFixed(2)})`, suggestion: '使用钢螺母或增加啮合长度' })
    }
  }
  
  // 通用警告
  if (yieldSafety < 1.5) {
    warnings.push({ level: 'error', message: `屈服安全系数过低 (${yieldSafety.toFixed(2)})` })
  } else if (yieldSafety < 2.0) {
    warnings.push({ level: 'warning', message: `屈服安全系数偏低 (${yieldSafety.toFixed(2)})` })
  }
  
  if (residualClampForce < 0) {
    warnings.push({ level: 'error', message: '残余夹紧力为负，连接将松开', suggestion: '增大预紧力或减小工作载荷' })
  }
  
  if (settlingLoss > params.preloadForce * 0.1) {
    warnings.push({ level: 'warning', message: `沉降损失过大 (${settlingLoss.toFixed(1)} kN, ${(settlingLoss/params.preloadForce*100).toFixed(1)}%)`, suggestion: '降低表面粗糙度或使用硬化垫圈' })
  }
  
  return {
    value: {
      yieldSafety,
      fatigueSafety,
      threadShearSafety,
      settlingLoss,
      residualClampForce,
      warnings
    },
    unit: '',
    warnings
  }
}
