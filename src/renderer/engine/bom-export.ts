import { BOM_EXPORT_VERSION } from '@shared/app-meta'

/**
 * BOM (Bill of Materials) 导出引擎
 * Section 5.3: 轻量级本地项目与版本管理 - BOM表格自动汇总
 */

export interface BOMItem {
  id: string
  category: 'bearing' | 'bolt' | 'seal' | 'gear' | 'spring' | 'shaft' | 'motor' | 'material' | 'other'
  designation: string       // 型号/规格
  description: string       // 描述
  quantity: number          // 数量
  standard?: string         // 标准号
  material?: string         // 材质
  notes?: string            // 备注
  supplier?: string         // 供应商 (SKF/NSK/FAG/MISUMI等)
  supplierPartNo?: string   // 供应商订货号
  unitCost?: number         // 单价 (元)
  totalCost: number         // 总价
  /** Section 11.4: ERP/BOM 企业物料编码 (Section 11.4) */
  enterpriseCode?: string   // 企业内部物料编码 (如: ERP-001234)
}

export interface BOMReport {
  projectName: string
  projectNumber: string
  revision: string
  date: string
  author: string
  items: BOMItem[]
  totalCost: number
  itemCount: number
}

/**
 * 根据类别生成供应商订货号
 */
export const generateSupplierPartNo = (item: BOMItem): string => {
  if (item.supplierPartNo) return item.supplierPartNo
  
  switch (item.category) {
    case 'bearing':
      return `${item.supplier || 'SKF'}-${item.designation}`
    case 'bolt':
      return `${item.designation}-${item.standard || 'GB5782'}`
    case 'seal':
      return `ORING-${item.designation}`
    case 'gear':
      return `GEAR-${item.designation}`
    case 'spring':
      return `SPRING-${item.designation}`
    case 'motor':
      return `${item.supplier || 'SIEMENS'}-${item.designation}`
    default:
      return item.designation
  }
}

/**
 * 汇总BOM - 合并重复项并计算成本
 */
export const aggregateBOM = (items: BOMItem[]): BOMItem[] => {
  const map = new Map<string, BOMItem>()
  
  for (const item of items) {
    const key = `${item.category}-${item.designation}-${item.supplier}`
    if (map.has(key)) {
      const existing = map.get(key)!
      existing.quantity += item.quantity
      existing.totalCost = existing.quantity * (existing.unitCost || 0)
    } else {
      item.supplierPartNo = generateSupplierPartNo(item)
      item.unitCost = item.unitCost || 0
      item.totalCost = item.quantity * item.unitCost
      map.set(key, { ...item })
    }
  }
  
  return Array.from(map.values()).sort((a, b) => {
    const order = ['bearing', 'bolt', 'seal', 'gear', 'spring', 'shaft', 'motor', 'material', 'other']
    return order.indexOf(a.category) - order.indexOf(b.category)
  })
}

/**
 * 生成BOM报告
 */
export const generateBOMReport = (
  projectName: string,
  projectNumber: string,
  author: string,
  items: BOMItem[]
): BOMReport => {
  const aggregated = aggregateBOM(items)
  const totalCost = aggregated.reduce((sum, item) => sum + item.totalCost, 0)
  
  return {
    projectName,
    projectNumber,
    revision: 'A',
    date: new Date().toISOString().slice(0, 10),
    author,
    items: aggregated,
    totalCost,
    itemCount: aggregated.length
  }
}

/**
 * 导出BOM为CSV
 */
export const exportBOMToCSV = (report: BOMReport): string => {
  const headers = ['序号', '类别', '型号', '描述', '标准', '材质', '数量', '供应商', '订货号', '单价(元)', '总价(元)', '备注']
  const categoryLabels: Record<string, string> = {
    bearing: '轴承', bolt: '螺栓', seal: '密封圈', gear: '齿轮',
    spring: '弹簧', shaft: '轴', motor: '电机', material: '材料', other: '其他'
  }
  
  let csv = headers.join(',') + '\n'
  report.items.forEach((item, i) => {
    const row = [
      i + 1,
      categoryLabels[item.category] || item.category,
      item.designation,
      item.description,
      item.standard || '',
      item.material || '',
      item.quantity,
      item.supplier || '',
      item.supplierPartNo || '',
      item.unitCost?.toFixed(2) || '0.00',
      item.totalCost.toFixed(2),
      item.notes || ''
    ]
    csv += row.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(',') + '\n'
  })
  
  csv += `\n项目号,${report.projectNumber}\n`
  csv += `项目名称,${report.projectName}\n`
  csv += `合计项数,${report.itemCount}\n`
  csv += `总成本,${report.totalCost.toFixed(2)} 元\n`
  
  return csv
}

/**
 * 导出BOM为JSON (用于项目文件)
 */
export const exportBOMToJSON = (report: BOMReport): any => {
  return {
    format: 'MechBox BOM',
    version: BOM_EXPORT_VERSION,
    project: {
      name: report.projectName,
      number: report.projectNumber,
      revision: report.revision,
      date: report.date,
      author: report.author
    },
    summary: {
      itemCount: report.itemCount,
      totalCost: report.totalCost,
      currency: 'CNY'
    },
    items: report.items
  }
}
