import { CalcResult, Warning } from '../types'

/**
 * 轴承计算引擎
 */

// L10 寿命计算 (ISO 281)
export const calcLife = (C: number, P: number, type: 'ball' | 'roller', speed: number): CalcResult<{ L10: number, L10h: number }> => {
  const warnings: Warning[] = []
  const p = type === 'ball' ? 3 : 10/3

  if (P <= 0) {
      warnings.push({ level: 'error', message: '当量动载荷必须大于 0' })
      return { value: { L10: 0, L10h: 0 }, unit: '', warnings }
  }

  if (speed <= 0) {
      warnings.push({ level: 'error', message: '转速必须大于 0' })
      return { value: { L10: 0, L10h: 0 }, unit: '', warnings }
  }

  const L10 = Math.pow((C / P), p) // 百万转
  const L10h = (1000000 / (60 * speed)) * L10 // 小时

  if (L10h < 500) {
      warnings.push({ level: 'warning', message: '寿命过短，建议更换更大额定载荷的轴承' })
  } else if (L10h > 100000) {
      warnings.push({ level: 'info', message: '寿命极大，可考虑降低轴承规格以节省成本' })
  }

  return { value: { L10, L10h }, unit: 'h', warnings }
}

// 简单当量动载荷计算
export const calcEquivalentLoad = (Fr: number, Fa: number, X: number, Y: number): number => {
    return X * Fr + Y * Fa
}
