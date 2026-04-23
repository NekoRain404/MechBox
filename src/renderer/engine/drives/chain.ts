/**
 * 链传动计算引擎
 * 滚子链传动基础计算
 * Section 6.3.1
 */

import { CalcResult, Warning } from '../types'

export interface ChainDriveParams {
  power: number          // 传递功率 kW
  speed1: number         // 小链轮转速 rpm
  speed2: number         // 大链轮转速 rpm
  centerDistance?: number // 中心距 mm
}

export interface ChainDriveResult {
  transmissionRatio: number     // 传动比
  recommendedChain: string      // 推荐链号
  chainPitch: number            // 链节距 mm
  smallSprocketTeeth: number    // 小链轮齿数
  largeSprocketTeeth: number    // 大链轮齿数
  chainSpeed: number            // 链速 m/s
  chainLength: number           // 链节数
  actualCenterDistance: number  // 实际中心距 mm
  effectivePull: number         // 有效拉力 N
  warnings: Warning[]
}

// 滚子链型号参数 (GB/T 1243)
const chainSpecs = [
  { chain: '08A', pitch: 12.7, maxPower: 2 },
  { chain: '10A', pitch: 15.875, maxPower: 4 },
  { chain: '12A', pitch: 19.05, maxPower: 7 },
  { chain: '16A', pitch: 25.4, maxPower: 15 },
  { chain: '20A', pitch: 31.75, maxPower: 25 },
  { chain: '24A', pitch: 38.1, maxPower: 40 },
  { chain: '28A', pitch: 44.45, maxPower: 60 },
  { chain: '32A', pitch: 50.8, maxPower: 80 },
  { chain: '40A', pitch: 63.5, maxPower: 120 },
]

/**
 * 链传动计算
 */
export const calcChainDrive = (params: ChainDriveParams): CalcResult<ChainDriveResult> => {
  const warnings: Warning[] = []

  // 传动比
  const transmissionRatio = params.speed1 / params.speed2

  // 推荐链号
  const recommendedChainSpec = chainSpecs.find(c => c.maxPower >= params.power)
  if (!recommendedChainSpec) {
    warnings.push({ level: 'warning', message: '功率超出标准滚子链范围，请考虑多排链或其他传动方式' })
  }

  const chainPitch = recommendedChainSpec?.pitch || 25.4
  const recommendedChain = recommendedChainSpec?.chain || '16A'

  // 小链轮齿数 (推荐 17~25)
  const smallSprocketTeeth = Math.max(17, Math.round(29 - 2 * transmissionRatio))

  // 大链轮齿数
  const largeSprocketTeeth = Math.round(smallSprocketTeeth * transmissionRatio)

  // 链速
  const chainSpeed = chainPitch * smallSprocketTeeth * params.speed1 / 60000  // m/s

  if (chainSpeed < 0.6) {
    warnings.push({ level: 'warning', message: '链速过低' })
  } else if (chainSpeed > 15) {
    warnings.push({ level: 'error', message: '链速过高，请减小链号或降低转速' })
  }

  // 中心距
  const centerDistance = params.centerDistance || (35 * chainPitch)

  if (centerDistance <= 0) {
    warnings.push({ level: 'error', message: '中心距必须大于 0', suggestion: '请输入有效中心距' })
    // Return early to prevent division by zero
    return {
      value: {
        transmissionRatio, recommendedChain, chainPitch,
        smallSprocketTeeth, largeSprocketTeeth, chainSpeed: 0,
        chainLength: 0, actualCenterDistance: 0, effectivePull: 0, warnings
      },
      unit: '',
      warnings
    }
  }

  // 链节数
  const chainPitchLength = 2 * centerDistance / chainPitch +
                           (smallSprocketTeeth + largeSprocketTeeth) / 2 +
                           Math.pow((largeSprocketTeeth - smallSprocketTeeth) / (2 * Math.PI), 2) * chainPitch / centerDistance

  const chainLength = Math.ceil(chainPitchLength / 2) * 2  // 圆整为偶数

  // 实际中心距
  const term1 = chainLength - (smallSprocketTeeth + largeSprocketTeeth) / 2
  const term2 = 8 * Math.pow((largeSprocketTeeth - smallSprocketTeeth) / (2 * Math.PI), 2)
  const sqrtArg = term1 * term1 - term2

  let actualCenterDistance = 0
  if (sqrtArg >= 0) {
    actualCenterDistance = chainPitch / 4 * (term1 + Math.sqrt(sqrtArg))
  } else {
    warnings.push({ level: 'error', message: '链长与齿数不匹配，无法计算实际中心距', suggestion: '请检查链节数或中心距' })
  }

  // 有效拉力
  const effectivePull = chainSpeed > 0 ? params.power * 1000 / chainSpeed : 0

  return {
    value: {
      transmissionRatio,
      recommendedChain,
      chainPitch,
      smallSprocketTeeth,
      largeSprocketTeeth,
      chainSpeed,
      chainLength,
      actualCenterDistance,
      effectivePull,
      warnings
    },
    unit: '',
    warnings
  }
}
