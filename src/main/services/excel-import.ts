/**
 * 结构化导入引擎 - 主进程
 * CSV 解析 + JSON Schema 校验 (Section 2.3.3)
 */

import Ajv from 'ajv'
import { extname } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseCsvText, stringifyCsv } from '../../shared/csv'

const ajv = new Ajv()

// 标准模板定义
export const importTemplates = {
  bearing: {
    name: '轴承数据模板',
    schema: {
      type: 'object',
      required: ['designation', 'inner_diameter', 'outer_diameter', 'width'],
      properties: {
        designation: { type: 'string' },
        inner_diameter: { type: 'number' },
        outer_diameter: { type: 'number' },
        width: { type: 'number' },
        C_r: { type: 'number' },
        C_0r: { type: 'number' },
        speed_limit_grease: { type: 'number' },
        speed_limit_oil: { type: 'number' },
        mass: { type: 'number' },
      }
    }
  },
  bolt: {
    name: '螺栓数据模板',
    schema: {
      type: 'object',
      required: ['designation', 'd', 'head_width_s', 'head_height_k'],
      properties: {
        designation: { type: 'string' },
        d: { type: 'number' },
        head_width_s: { type: 'number' },
        head_height_k: { type: 'number' },
        standard: { type: 'string' },
      }
    }
  },
  material: {
    name: '材料数据模板',
    schema: {
      type: 'object',
      required: ['designation', 'name_zh', 'yield_strength', 'tensile_strength'],
      properties: {
        designation: { type: 'string' },
        name_zh: { type: 'string' },
        density: { type: 'number' },
        E: { type: 'number' },
        yield_strength: { type: 'number' },
        tensile_strength: { type: 'number' },
        elongation: { type: 'number' },
        applications: { type: 'string' },
      }
    }
  },
}

/**
 * 解析导入文件
 */
export const parseExcel = (filePath: string, templateType: keyof typeof importTemplates): {
  success: boolean
  recordsImported: number
  errors: string[]
  data: any[]
} => {
  const result = {
    success: false,
    recordsImported: 0,
    errors: [] as string[],
    data: [] as any[]
  }

  try {
    const extension = extname(filePath).toLowerCase()
    if (extension !== '.csv') {
      result.errors.push('0.1 预览版当前仅支持 CSV 导入，请使用模板导出的 CSV 文件。')
      return result
    }

    const fileText = readFileSync(filePath, 'utf8')
    const parsed = parseCsvText(fileText)
    const rawData = parsed.rows

    if (rawData.length === 0) {
      result.errors.push('CSV 文件为空')
      return result
    }

    // 获取模板和 Schema
    const template = importTemplates[templateType]
    if (!template) {
      result.errors.push(`未知模板类型: ${templateType}`)
      return result
    }

    // 创建校验器
    const validate = ajv.compile(template.schema)
    let validCount = 0

    // 逐行校验
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const valid = validate(row)
      
      if (valid) {
        result.data.push(row)
        validCount++
      } else {
        const errors = validate.errors?.map(e => `第${i + 2}行: ${e.message}`).join('; ')
        result.errors.push(errors || `第${i + 2}行: 未知错误`)
      }
    }

    result.success = validCount > 0
    result.recordsImported = validCount

  } catch (err: any) {
    result.errors.push(`解析失败: ${err.message}`)
  }

  return result
}

/**
 * 生成导入模板 CSV 文件
 */
export const generateTemplate = (templateType: keyof typeof importTemplates, outputPath: string): boolean => {
  try {
    const template = importTemplates[templateType]
    if (!template) return false

    const fields = Object.keys(template.schema.properties)
    const exampleRow: Record<string, any> = {}

    // 根据模板类型生成示例数据
    if (templateType === 'bearing') {
      exampleRow.designation = '6205'
      exampleRow.inner_diameter = 25
      exampleRow.outer_diameter = 52
      exampleRow.width = 15
      exampleRow.C_r = 14.0
      exampleRow.C_0r = 7.85
    } else if (templateType === 'bolt') {
      exampleRow.designation = 'M10'
      exampleRow.d = 10
      exampleRow.head_width_s = 17
      exampleRow.head_height_k = 6.4
      exampleRow.standard = 'GB/T 5782'
    } else if (templateType === 'material') {
      exampleRow.designation = 'Q235B'
      exampleRow.name_zh = '碳素结构钢'
      exampleRow.density = 7.85
      exampleRow.E = 206000
      exampleRow.yield_strength = 235
      exampleRow.tensile_strength = 370
      exampleRow.elongation = 26
      exampleRow.applications = '一般结构,焊接结构'
    }

    const csv = stringifyCsv([fields.reduce((acc, field) => ({ ...acc, [field]: field }), {}), exampleRow])
    writeFileSync(outputPath, csv, 'utf8')
    return true
  } catch (err) {
    return false
  }
}
