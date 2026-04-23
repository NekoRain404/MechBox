/**
 * 参数扫描引擎 - DOE (Design of Experiments)
 * 支持单参数/多参数扫描，生成敏感度分析数据
 * Section 5.1
 */

export interface ScanRange {
  param: string
  min: number
  max: number
  steps: number
}

export interface ScanResult {
  params: Record<string, number>
  outputs: Record<string, number>
}

/**
 * 单参数扫描
 * @param baseParams 基础参数
 * @param scanParam 扫描参数名
 * @param range 扫描范围
 * @param computeFn 计算函数
 */
export const singleParamScan = (
  baseParams: Record<string, number>,
  scanParam: string,
  range: { min: number; max: number; steps: number },
  computeFn: (params: Record<string, number>) => Record<string, number>
): ScanResult[] => {
  const results: ScanResult[] = []
  const step = (range.max - range.min) / (range.steps - 1)
  
  for (let i = 0; i < range.steps; i++) {
    const value = range.min + i * step
    const params = { ...baseParams, [scanParam]: value }
    const outputs = computeFn(params)
    results.push({ params: { [scanParam]: value }, outputs })
  }
  
  return results
}

/**
 * 双参数扫描 (用于生成 2D 云图)
 * @param baseParams 基础参数
 * @param param1 参数1
 * @param param2 参数2
 * @param computeFn 计算函数
 */
export const doubleParamScan = (
  baseParams: Record<string, number>,
  param1: { name: string; min: number; max: number; steps: number },
  param2: { name: string; min: number; max: number; steps: number },
  computeFn: (params: Record<string, number>) => Record<string, number>
): { matrix: number[][]; param1Values: number[]; param2Values: number[] } => {
  const param1Values: number[] = []
  const param2Values: number[] = []
  const matrix: number[][] = []
  
  const step1 = (param1.max - param1.min) / (param1.steps - 1)
  const step2 = (param2.max - param2.min) / (param2.steps - 1)
  
  for (let i = 0; i < param1.steps; i++) {
    const v1 = param1.min + i * step1
    param1Values.push(v1)
    matrix[i] = []
    
    for (let j = 0; j < param2.steps; j++) {
      const v2 = param2.min + j * step2
      if (i === 0) param2Values.push(v2)
      
      const params = { ...baseParams, [param1.name]: v1, [param2.name]: v2 }
      const outputs = computeFn(params)
      // 取第一个输出值作为矩阵值
      matrix[i][j] = Object.values(outputs)[0] || 0
    }
  }
  
  return { matrix, param1Values, param2Values }
}

/**
 * 敏感度分析
 * 计算每个参数对输出变量的敏感系数
 */
export const sensitivityAnalysis = (
  baseParams: Record<string, number>,
  paramNames: string[],
  perturbation: number = 0.01,
  computeFn: (params: Record<string, number>) => Record<string, number>
): Record<string, Record<string, number>> => {
  const baseOutputs = computeFn(baseParams)
  const sensitivities: Record<string, Record<string, number>> = {}
  
  for (const paramName of paramNames) {
    sensitivities[paramName] = {}
    const perturbed = { ...baseParams }
    perturbed[paramName] *= (1 + perturbation)
    const perturbedOutputs = computeFn(perturbed)
    
    for (const [outputName, baseValue] of Object.entries(baseOutputs)) {
      const perturbedValue = perturbedOutputs[outputName]
      if (baseValue !== 0) {
        // 敏感系数 = (Δoutput/output) / (Δparam/param)
        sensitivities[paramName][outputName] = 
          ((perturbedValue - baseValue) / baseValue) / perturbation
      } else {
        sensitivities[paramName][outputName] = 0
      }
    }
  }
  
  return sensitivities
}

/**
 * 轴承寿命参数扫描示例
 */
export const bearingLifeScan = (
  radialLoad: { min: number; max: number; steps: number },
  speed: { min: number; max: number; steps: number },
  C_r: number
): { matrix: number[][]; loadValues: number[]; speedValues: number[] } => {
  const result = doubleParamScan(
    { C_r },
    { name: 'Fr', min: radialLoad.min, max: radialLoad.max, steps: radialLoad.steps },
    { name: 'speed', min: speed.min, max: speed.max, steps: speed.steps },
    (params) => {
      const P = 0.56 * params.Fr // 简化当量载荷
      const L10 = Math.pow(C_r / P, 3)
      const L10h = (1000000 / (60 * params.speed)) * L10
      return { L10h }
    }
  )
  return {
    matrix: result.matrix,
    loadValues: result.param1Values,
    speedValues: result.param2Values
  }
}
