/**
 * DFM (Design for Manufacturing) 辅助引擎
 * 公差-工艺映射，制造成本预估
 * Section 5.4
 */

export interface ToleranceProcessMapping {
  itGrade: string
  process: string
  processEn: string
  relativeCost: number  // 相对成本指数 (IT11=1.0 基准)
  typicalApplications: string[]
  surfaceFinish: string  // 典型表面粗糙度
}

// 公差等级与加工工艺映射表
export const toleranceProcessMap: Record<string, ToleranceProcessMapping> = {
  'IT01': { itGrade: 'IT01', process: '研磨/超精加工', processEn: 'Lapping/Superfinishing', relativeCost: 50, typicalApplications: ['量规', '精密仪器'], surfaceFinish: 'Ra 0.01-0.05' },
  'IT0': { itGrade: 'IT0', process: '精密研磨', processEn: 'Precision Lapping', relativeCost: 40, typicalApplications: ['量块', '标准件'], surfaceFinish: 'Ra 0.02-0.08' },
  'IT1': { itGrade: 'IT1', process: '精密研磨', processEn: 'Precision Lapping', relativeCost: 35, typicalApplications: ['高精度量规'], surfaceFinish: 'Ra 0.04-0.1' },
  'IT2': { itGrade: 'IT2', process: '研磨', processEn: 'Lapping', relativeCost: 28, typicalApplications: ['高精度轴'], surfaceFinish: 'Ra 0.08-0.2' },
  'IT3': { itGrade: 'IT3', process: '精密磨削', processEn: 'Precision Grinding', relativeCost: 22, typicalApplications: ['主轴', '精密轴承轴'], surfaceFinish: 'Ra 0.1-0.4' },
  'IT4': { itGrade: 'IT4', process: '精密磨削', processEn: 'Precision Grinding', relativeCost: 18, typicalApplications: ['精密轴', '量规'], surfaceFinish: 'Ra 0.2-0.4' },
  'IT5': { itGrade: 'IT5', process: '精密磨削', processEn: 'Precision Grinding', relativeCost: 14, typicalApplications: ['精密轴承位', '齿轮轴'], surfaceFinish: 'Ra 0.4-0.8' },
  'IT6': { itGrade: 'IT6', process: '磨削', processEn: 'Cylindrical Grinding', relativeCost: 10, typicalApplications: ['轴承配合位', '齿轮孔'], surfaceFinish: 'Ra 0.8-1.6' },
  'IT7': { itGrade: 'IT7', process: '精车/磨削', processEn: 'Fine Turning/Grinding', relativeCost: 6, typicalApplications: ['一般配合位', '销孔'], surfaceFinish: 'Ra 1.6-3.2' },
  'IT8': { itGrade: 'IT8', process: '精车', processEn: 'Fine Turning', relativeCost: 4, typicalApplications: ['自由公差', '非配合位'], surfaceFinish: 'Ra 3.2-6.3' },
  'IT9': { itGrade: 'IT9', process: '粗车/铣', processEn: 'Rough Turning/Milling', relativeCost: 2.5, typicalApplications: ['一般结构件'], surfaceFinish: 'Ra 6.3-12.5' },
  'IT10': { itGrade: 'IT10', process: '粗加工', processEn: 'Rough Machining', relativeCost: 1.8, typicalApplications: ['焊接结构件'], surfaceFinish: 'Ra 12.5-25' },
  'IT11': { itGrade: 'IT11', process: '粗加工', processEn: 'Rough Machining', relativeCost: 1.0, typicalApplications: ['非关键尺寸'], surfaceFinish: 'Ra 25-50' },
  'IT12': { itGrade: 'IT12', process: '铸造/锻造', processEn: 'Casting/Forging', relativeCost: 0.6, typicalApplications: ['毛坯件'], surfaceFinish: 'Ra 50+' },
}

/**
 * 根据公差等级推荐加工工艺
 */
export const recommendProcess = (itGrade: string): ToleranceProcessMapping | null => {
  return toleranceProcessMap[itGrade] || null
}

/**
 * 计算相对制造成本
 * @param itGrade 公差等级
 * @param baseCost 基准成本 (IT11级)
 */
export const calcManufacturingCost = (itGrade: string, baseCost: number = 100): number => {
  const mapping = toleranceProcessMap[itGrade]
  if (!mapping) return baseCost
  return baseCost * mapping.relativeCost
}

/**
 * DFM 建议生成
 */
export const generateDFMSuggestions = (itGrades: string[]): {
  suggestions: string[]
  totalCostIndex: number
  warnings: string[]
} => {
  const suggestions: string[] = []
  const warnings: string[] = []
  let totalCostIndex = 0

  for (const grade of itGrades) {
    const mapping = toleranceProcessMap[grade]
    if (!mapping) continue

    totalCostIndex += mapping.relativeCost

    if (mapping.relativeCost > 10) {
      warnings.push(`${grade}: ${mapping.process}，成本指数${mapping.relativeCost}，建议复核是否必要`)
    }

    if (mapping.relativeCost >= 14 && mapping.relativeCost <= 18) {
      suggestions.push(`${grade}: 可考虑放宽到IT8以降低成本(节省${Math.round((1 - 6/mapping.relativeCost) * 100)}%)`)
    }
  }

  return { suggestions, totalCostIndex, warnings }
}

/**
 * 装配成本对比分析
 */
export const compareToleranceCosts = (scenarios: { name: string; grades: string[] }[]) => {
  return scenarios.map(scenario => {
    const { suggestions, totalCostIndex, warnings } = generateDFMSuggestions(scenario.grades)
    return {
      name: scenario.name,
      grades: scenario.grades,
      totalCostIndex,
      avgCostPerFeature: scenario.grades.length > 0 ? totalCostIndex / scenario.grades.length : 0,
      suggestions,
      warnings
    }
  })
}
