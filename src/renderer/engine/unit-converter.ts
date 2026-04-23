/**
 * 单位换算引擎
 * 支持长度、压力、力、扭矩、温度、速度、功率、密度等
 */

export type UnitCategory = 
  | 'length'
  | 'pressure'
  | 'force'
  | 'torque'
  | 'temperature'
  | 'speed'
  | 'power'
  | 'mass'

export interface UnitDefinition {
  name: string
  symbol: string
  toBase: (value: number) => number  // 转换为基本单位
  fromBase: (value: number) => number // 从基本单位转换
}

export const unitDefinitions: Record<UnitCategory, Record<string, UnitDefinition>> = {
  length: {
    mm: { name: '毫米', symbol: 'mm', toBase: v => v, fromBase: v => v },
    cm: { name: '厘米', symbol: 'cm', toBase: v => v * 10, fromBase: v => v / 10 },
    m: { name: '米', symbol: 'm', toBase: v => v * 1000, fromBase: v => v / 1000 },
    inch: { name: '英寸', symbol: 'in', toBase: v => v * 25.4, fromBase: v => v / 25.4 },
    ft: { name: '英尺', symbol: 'ft', toBase: v => v * 304.8, fromBase: v => v / 304.8 },
  },
  pressure: {
    MPa: { name: '兆帕', symbol: 'MPa', toBase: v => v, fromBase: v => v },
    Pa: { name: '帕斯卡', symbol: 'Pa', toBase: v => v / 1e6, fromBase: v => v * 1e6 },
    bar: { name: '巴', symbol: 'bar', toBase: v => v * 0.1, fromBase: v => v / 0.1 },
    psi: { name: '磅/平方英寸', symbol: 'psi', toBase: v => v * 0.00689476, fromBase: v => v / 0.00689476 },
    atm: { name: '标准大气压', symbol: 'atm', toBase: v => v * 0.101325, fromBase: v => v / 0.101325 },
  },
  force: {
    N: { name: '牛顿', symbol: 'N', toBase: v => v, fromBase: v => v },
    kN: { name: '千牛', symbol: 'kN', toBase: v => v * 1000, fromBase: v => v / 1000 },
    kgf: { name: '千克力', symbol: 'kgf', toBase: v => v * 9.80665, fromBase: v => v / 9.80665 },
    lbf: { name: '磅力', symbol: 'lbf', toBase: v => v * 4.44822, fromBase: v => v / 4.44822 },
  },
  torque: {
    'N·m': { name: '牛·米', symbol: 'N·m', toBase: v => v, fromBase: v => v },
    'N·mm': { name: '牛·毫米', symbol: 'N·mm', toBase: v => v / 1000, fromBase: v => v * 1000 },
    'kgf·m': { name: '千克力·米', symbol: 'kgf·m', toBase: v => v * 9.80665, fromBase: v => v / 9.80665 },
    'lbf·ft': { name: '磅力·英尺', symbol: 'lbf·ft', toBase: v => v * 1.35582, fromBase: v => v / 1.35582 },
  },
  temperature: {
    '°C': { name: '摄氏度', symbol: '°C', toBase: v => v + 273.15, fromBase: v => v - 273.15 },
    '°F': { name: '华氏度', symbol: '°F', toBase: v => (v - 32) * 5/9 + 273.15, fromBase: v => (v - 273.15) * 9/5 + 32 },
    K: { name: '开尔文', symbol: 'K', toBase: v => v, fromBase: v => v },
  },
  speed: {
    'm/s': { name: '米/秒', symbol: 'm/s', toBase: v => v, fromBase: v => v },
    'km/h': { name: '千米/时', symbol: 'km/h', toBase: v => v / 3.6, fromBase: v => v * 3.6 },
    'rpm': { name: '转/分', symbol: 'rpm', toBase: v => v, fromBase: v => v },
    'ft/min': { name: '英尺/分', symbol: 'ft/min', toBase: v => v * 0.00508, fromBase: v => v / 0.00508 },
  },
  power: {
    W: { name: '瓦特', symbol: 'W', toBase: v => v, fromBase: v => v },
    kW: { name: '千瓦', symbol: 'kW', toBase: v => v * 1000, fromBase: v => v / 1000 },
    HP: { name: '马力', symbol: 'HP', toBase: v => v * 745.7, fromBase: v => v / 745.7 },
  },
  mass: {
    kg: { name: '千克', symbol: 'kg', toBase: v => v, fromBase: v => v },
    g: { name: '克', symbol: 'g', toBase: v => v / 1000, fromBase: v => v * 1000 },
    lb: { name: '磅', symbol: 'lb', toBase: v => v * 0.453592, fromBase: v => v / 0.453592 },
    ton: { name: '吨', symbol: 't', toBase: v => v * 1000, fromBase: v => v / 1000 },
  },
}

/**
 * 单位换算
 * 针对温度等非线性单位，采用直接转换路径避免浮点漂移 (Section 13.2)
 */
export const convertUnit = (
  value: number,
  category: UnitCategory,
  fromUnit: string,
  toUnit: string
): number => {
  const defs = unitDefinitions[category]
  if (!defs[fromUnit] || !defs[toUnit]) {
    throw new Error(`Unsupported unit: ${fromUnit} or ${toUnit} in category ${category}`)
  }

  // 温度单位特殊处理：直接转换避免浮点漂移 (Section 13.2)
  if (category === 'temperature') {
    return convertTemperature(value, fromUnit, toUnit)
  }

  const baseValue = defs[fromUnit].toBase(value)
  return defs[toUnit].fromBase(baseValue)
}

// 温度直接转换表 (避免经过开尔文中间转换的浮点漂移)
const tempDirect: Record<string, Record<string, (v: number) => number>> = {
  '°C': {
    '°C': v => v,
    '°F': v => v * 9/5 + 32,
    'K': v => v + 273.15,
  },
  '°F': {
    '°C': v => (v - 32) * 5/9,
    '°F': v => v,
    'K': v => (v - 32) * 5/9 + 273.15,
  },
  'K': {
    '°C': v => v - 273.15,
    '°F': v => (v - 273.15) * 9/5 + 32,
    'K': v => v,
  },
}

const convertTemperature = (value: number, from: string, to: string): number => {
  const converter = tempDirect[from]?.[to]
  if (!converter) {
    // Fallback to base conversion if direct path not found
    const defs = unitDefinitions.temperature
    return defs[to].fromBase(defs[from].toBase(value))
  }
  return converter(value)
}

/**
 * 获取单位类别的所有可用单位
 */
export const getAvailableUnits = (category: UnitCategory): string[] => {
  return Object.keys(unitDefinitions[category])
}

/**
 * 获取单位的显示名称
 */
export const getUnitDisplayName = (category: UnitCategory, unit: string): string => {
  const def = unitDefinitions[category]?.[unit]
  return def ? `${def.name} (${def.symbol})` : unit
}
