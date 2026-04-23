/**
 * 电机选型计算引擎
 * 伺服电机、步进电机、普通电机选型计算
 * DEV_DOC Section 6.10
 */

import { CalcResult, Warning } from '../types'

export interface MotorParams {
  loadForce: number         // 当前页面按负载扭矩 N·m 使用
  speed: number             // 转速 rpm
  inertia?: number          // 负载惯量 kg·m²
  motorInertia?: number     // 电机转子惯量 kg·m²
  acceleration?: number     // 加速度 rad/s²
  accelDutyCycle?: number   // 加速段占比 0~1
  efficiency?: number       // 传动效率
  safetyFactor?: number     // 安全系数
}

export interface MotorResult {
  requiredTorque: number      // 所需扭矩 N·m
  requiredPower: number       // 所需功率 kW
  requiredSpeed: number       // 所需转速 rpm
  inertiaRatio: number        // 惯量比
  peakTorque: number          // 峰值扭矩 N·m
  rmsTorque: number           // 均方根扭矩 N·m
  recommendedMotorPower: number  // 推荐电机功率 kW
  warnings: Warning[]
}

/**
 * 电机选型计算
 */
export const calcMotorSelection = (params: MotorParams): CalcResult<MotorResult> => {
  const warnings: Warning[] = []
  const {
    loadForce,
    speed,
    inertia = 0,
    motorInertia,
    acceleration = 0,
    accelDutyCycle = 0.15,
    efficiency = 0.9,
    safetyFactor = 1.5,
  } = params

  if (
    speed <= 0 ||
    efficiency <= 0 ||
    efficiency > 1 ||
    safetyFactor < 1
  ) {
    warnings.push({
      level: 'error',
      message: '转速必须大于 0，效率应在 0~1 之间，安全系数不能小于 1',
    })
    return {
      value: {
        requiredTorque: 0,
        requiredPower: 0,
        requiredSpeed: 0,
        inertiaRatio: 0,
        peakTorque: 0,
        rmsTorque: 0,
        recommendedMotorPower: 0,
        warnings,
      },
      unit: 'kW',
      warnings,
    }
  }

  const normalizedMotorInertia =
    typeof motorInertia === 'number' && Number.isFinite(motorInertia) && motorInertia > 0
      ? motorInertia
      : null

  const loadTorque = Math.max(loadForce, 0)
  const continuousTorque = loadTorque / efficiency

  // 加速扭矩
  const accTorque = (inertia * acceleration) / efficiency

  // 峰值扭矩
  const peakTorque = continuousTorque + accTorque

  const boundedDutyCycle = Math.min(Math.max(accelDutyCycle, 0), 1)
  if (boundedDutyCycle !== accelDutyCycle) {
    warnings.push({ level: 'warning', message: '加速占空比已限制在 0~1 范围内' })
  }

  // 按加速占空比估算 RMS 扭矩
  const rmsTorque = Math.sqrt(
    Math.pow(continuousTorque, 2) * (1 - boundedDutyCycle) +
      Math.pow(peakTorque, 2) * boundedDutyCycle,
  )

  // 所需功率
  const requiredPower = rmsTorque * speed * 2 * Math.PI / 60000  // kW

  // 惯量比
  const inertiaRatio = inertia > 0 && normalizedMotorInertia ? inertia / normalizedMotorInertia : 0

  if (inertia > 0 && !normalizedMotorInertia) {
    warnings.push({
      level: 'info',
      message: '未提供有效的电机转子惯量，惯量比暂按 0 显示',
      suggestion: '如需做惯量匹配筛查，请填写候选电机的转子惯量',
    })
  }

  if (inertiaRatio > 10) {
    warnings.push({ level: 'warning', message: `惯量比 ${inertiaRatio.toFixed(1)} 过大`, suggestion: '伺服系统建议 < 10，高性能 < 3' })
  }

  // 推荐电机功率
  const recommendedMotorPower = requiredPower * safetyFactor

  return {
    value: {
      requiredTorque: continuousTorque,
      requiredPower,
      requiredSpeed: speed,
      inertiaRatio,
      peakTorque,
      rmsTorque,
      recommendedMotorPower,
      warnings
    },
    unit: 'kW',
    warnings
  }
}
