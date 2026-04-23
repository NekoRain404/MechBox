export interface Warning {
  level: 'error' | 'warning' | 'info'
  message: string
  suggestion?: string
}

export interface CalcResult<T> {
  value: T
  unit: string
  warnings: Warning[]
}

export interface ValidationResult {
  valid: boolean
  level: 'pass' | 'warning' | 'fail'
  message: string
}

export type UnitSystem = 'mm' | 'inch'

export interface ToleranceZone {
  grade: string     // 公差等级，如 "IT7"
  position: string  // 基本偏差代号，如 "H", "g"
}

export interface FitResult {
  max_clearance: number   // 最大间隙
  min_clearance: number   // 最小间隙 (负值 = 过盈)
  fit_type: 'clearance' | 'transition' | 'interference'
  fit_code: string        // 如 "H7/g6"
  hole_upper: number      // 孔上偏差
  hole_lower: number      // 孔下偏差
  shaft_upper: number     // 轴上偏差
  shaft_lower: number     // 轴下偏差
}
