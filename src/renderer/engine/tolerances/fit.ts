import { ToleranceZone, FitResult } from '../types'

/**
 * 配合计算引擎
 * 内部统一使用 mm 作为单位
 */
export const calcFit = (
  size: number,
  holeES: number,   // 孔上偏差 (mm)
  holeEI: number,   // 孔下偏差 (mm)
  shaftes: number,  // 轴上偏差 (mm)
  shaftei: number   // 轴下偏差 (mm)
): FitResult => {
  const maxClearance = holeES - shaftei
  const minClearance = holeEI - shaftes

  let type: 'clearance' | 'transition' | 'interference' = 'clearance'

  if (minClearance >= 0) {
    type = 'clearance'
  } else if (maxClearance <= 0) {
    type = 'interference'
  } else {
    type = 'transition'
  }

  return {
    max_clearance: maxClearance,
    min_clearance: minClearance,
    fit_type: type,
    fit_code: '', // 外部填入
    hole_upper: holeES,
    hole_lower: holeEI,
    shaft_upper: shaftes,
    shaft_lower: shaftei
  }
}
