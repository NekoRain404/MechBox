/**
 * 带传动计算引擎
 * V带、同步带传动基础计算
 * Section 6.3.1
 */

import { CalcResult, Warning } from '../types'

export interface BeltDriveParams {
  power: number          // 传递功率 kW
  speed1: number         // 小带轮转速 rpm
  speed2: number         // 大带轮转速 rpm
  beltType: string       // 带型: A, B, C, D, E
  centerDistance?: number // 中心距 mm
}

export interface BeltDriveResult {
  transmissionRatio: number    // 传动比
  beltSpeed: number            // 带速 m/s
  smallPulleyDiameter: number  // 小带轮直径 mm
  largePulleyDiameter: number  // 大带轮直径 mm
  wrapAngle: number            // 包角 °
  beltLength: number           // 带长 mm
  effectivePull: number        // 有效拉力 N
  warnings: Warning[]
}

// V带型号参数 (GB/T 13575.1)
const beltTypeParams: Record<string, { minPower: number; maxPower: number; standardDiameters: number[] }> = {
  'Y': { minPower: 0, maxPower: 0.5, standardDiameters: [20, 22.4, 25, 28, 31.5, 35.5, 40, 45, 50, 56, 63, 71] },
  'Z': { minPower: 0.2, maxPower: 1.5, standardDiameters: [50, 56, 63, 71, 80, 90, 100, 112, 125, 140] },
  'A': { minPower: 0.8, maxPower: 5, standardDiameters: [75, 80, 85, 90, 95, 100, 106, 112, 118, 125, 132, 140, 150, 160, 170, 180, 190, 200] },
  'B': { minPower: 2, maxPower: 15, standardDiameters: [125, 132, 140, 150, 160, 170, 180, 200, 224, 250, 280, 315, 355] },
  'C': { minPower: 7, maxPower: 50, standardDiameters: [200, 224, 250, 280, 315, 355, 400, 450, 500, 560, 630] },
  'D': { minPower: 20, maxPower: 150, standardDiameters: [355, 400, 450, 500, 560, 630, 710, 800, 900] },
  'E': { minPower: 40, maxPower: 300, standardDiameters: [500, 560, 630, 710, 800, 900, 1000, 1120, 1250] },
}

/**
 * V带传动计算
 */
export const calcVBel = (params: BeltDriveParams): CalcResult<BeltDriveResult> => {
  const warnings: Warning[] = []

  // 传动比
  const transmissionRatio = params.speed1 / params.speed2

  // 推荐带型
  const recommendedType = Object.entries(beltTypeParams).find(([_, p]) => 
    params.power >= p.minPower && params.power <= p.maxPower
  )
  
  const requestedType = params.beltType?.toUpperCase()
  const beltType = requestedType && beltTypeParams[requestedType]
    ? requestedType
    : (recommendedType ? recommendedType[0] : 'B')
  
  if (!recommendedType) {
    warnings.push({
      level: 'warning',
      message: `功率 ${params.power}kW 超出标准V带范围，请考虑多根V带或其他传动方式`
    })
  }

  if (requestedType && recommendedType && requestedType !== recommendedType[0]) {
    warnings.push({
      level: 'info',
      message: `已按指定带型 ${requestedType} 计算，功率推荐带型为 ${recommendedType[0]}`,
    })
  }

  // 小带轮直径 (查表选择)
  const typeParams = beltTypeParams[beltType]
  const smallPulleyDiameter = typeParams.standardDiameters.find(d => d >= 75) || typeParams.standardDiameters[0]

  // 大带轮直径
  const largePulleyDiameter = Math.round(smallPulleyDiameter * transmissionRatio)

  // 带速
  const beltSpeed = Math.PI * smallPulleyDiameter * params.speed1 / 60000  // m/s

  // 带速校验
  if (beltSpeed === 0) {
    warnings.push({ level: 'error', message: '小带轮转速必须大于 0', suggestion: '请输入有效转速' })
  } else if (beltSpeed < 5) {
    warnings.push({ level: 'warning', message: `带速 ${beltSpeed.toFixed(1)}m/s 过低，建议增大带轮直径`, suggestion: 'V带推荐带速 5~25 m/s' })
  } else if (beltSpeed > 30) {
    warnings.push({ level: 'error', message: `带速 ${beltSpeed.toFixed(1)}m/s 过高，离心力过大`, suggestion: '降低转速或减小带轮直径' })
  }

  // 中心距 (推荐范围)
  const centerDistance = params.centerDistance || (0.7 * (smallPulleyDiameter + largePulleyDiameter))

  // 包角
  const wrapAngle = 180 - (largePulleyDiameter - smallPulleyDiameter) * 57.3 / centerDistance

  if (wrapAngle < 120) {
    warnings.push({ level: 'warning', message: `包角 ${wrapAngle.toFixed(1)}° 过小`, suggestion: '增大中心距或减小传动比' })
  }

  // 带长 (近似公式)
  const beltLength = 2 * centerDistance + Math.PI / 2 * (smallPulleyDiameter + largePulleyDiameter) + 
                     Math.pow(largePulleyDiameter - smallPulleyDiameter, 2) / (4 * centerDistance)

  // 有效拉力
  const effectivePull = params.power * 1000 / beltSpeed

  return {
    value: {
      transmissionRatio,
      beltSpeed,
      smallPulleyDiameter,
      largePulleyDiameter,
      wrapAngle,
      beltLength,
      effectivePull,
      warnings
    },
    unit: '',
    warnings
  }
}
