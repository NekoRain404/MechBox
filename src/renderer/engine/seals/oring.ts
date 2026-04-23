import { CalcResult, Warning } from '../types'

/**
 * 密封圈计算引擎
 */
export const calcCompression = (cs: number, depth: number): CalcResult<number> => {
  const warnings: Warning[] = []
  
  // Check for division by zero
  if (cs === 0) {
    return { value: 0, unit: '%', warnings: [{ level: 'error', message: '线径不能为 0', suggestion: '请输入密封圈线径' }] }
  }

  const value = ((cs - depth) / cs) * 100

  if (value < 10) {
    warnings.push({ level: 'warning', message: '压缩率过低，可能导致泄漏', suggestion: '减小沟槽深度或增大线径' })
  } else if (value > 30) {
    warnings.push({ level: 'error', message: '压缩率过高，可能损坏密封圈', suggestion: '增大沟槽深度或减小线径' })
  }

  return { value, unit: '%', warnings }
}

export const calcStretch = (oringID: number, glandID: number): CalcResult<number> => {
  const warnings: Warning[] = []

  // Check for division by zero
  if (oringID === 0) {
    return { value: 0, unit: '%', warnings: [{ level: 'error', message: '密封圈 ID 不能为 0', suggestion: '请输入有效内径' }] }
  }

  const value = ((glandID - oringID) / oringID) * 100

  if (value > 5) {
    warnings.push({ level: 'warning', message: '拉伸率过高，可能缩短寿命', suggestion: '选择更大内径的密封圈' })
  }

  return { value, unit: '%', warnings }
}
