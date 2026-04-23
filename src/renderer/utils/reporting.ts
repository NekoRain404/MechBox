import { appendWorkflowCalculationRun } from './calculation-runs'
import { resolveLatestWorkflowArtifactLink } from './workflow-artifacts'
import { APP_NAME, APP_VERSION } from '../../shared/app-meta'

export type ReportModuleKey =
  | 'seals'
  | 'bearings'
  | 'bolts'
  | 'tolerances'
  | 'param-scan'
  | 'monte-carlo'
  | 'material-sub'
  | 'reverse-identify'
  | 'bom-export'

export type ReportSourceKind =
  | 'module-result'
  | 'analysis-export'
  | 'archive-report'
  | 'manual-report'

export interface ReportDerivationMeta {
  derivedFromReportId?: string
  sourceRevisionCode?: string
  nextRevisionCode?: string
  derivationNote?: string
  referenceLock?: Record<string, unknown> | null
}

export interface ReportRecord {
  id: string
  title: string
  module: string
  createdAt: string
  type: 'pdf' | 'csv' | 'json'
  status: 'generated' | 'pending'
  projectNumber?: string
  projectId?: string
  projectName?: string
  standardRef?: string
  author?: string
  summary?: string
  sourceKind?: ReportSourceKind
  linkedRunId?: string
  linkedResultId?: string
  revisionCode?: string
  workflowStatus?: 'draft' | 'in-review' | 'approved' | 'released' | 'archived'
  derivationMeta?: ReportDerivationMeta | null
}

export const REPORTS_STORAGE_KEY = 'mechbox-reports'
export const REPORTS_STORAGE_EVENT = 'mechbox:reports-updated'
export const REPORT_DERIVATION_META_STORAGE_KEY = 'mechbox-report-derivation-meta'
let reportHydrationPromise: Promise<void> | null = null
let reportHydrationScheduled = false
const REPORT_HYDRATION_DELAY_MS = 2500

export const reportSourceMetaMap: Record<ReportSourceKind, { label: string; color: string; description: string }> = {
  'module-result': {
    label: '模块结果',
    color: 'blue',
    description: '由计算页面直接导出的结构化结果或 PDF。',
  },
  'analysis-export': {
    label: '分析导出',
    color: 'orange',
    description: '由参数扫描、蒙特卡洛、BOM 等分析页导出的 CSV/JSON 记录。',
  },
  'archive-report': {
    label: '归档报告',
    color: 'green',
    description: '在报告中心直接生成并归档的报告记录。',
  },
  'manual-report': {
    label: '手工编制',
    color: 'purple',
    description: '由计算书编制页手工整理生成的结构化报告。',
  },
}

export const reportModuleMetaMap: Record<string, { label: string; standardRef: string; summary: string; formulas: string[] }> = {
  seals: {
    label: '密封圈计算书',
    standardRef: 'AS568 / ISO 3601',
    summary: '密封圈选型、沟槽几何和材料适配说明',
    formulas: ['Compression = (d2 - h) / d2', 'Fill = A_o-ring / A_gland', 'Stretch = (ID_installed - ID_free) / ID_free'],
  },
  bearings: {
    label: '轴承选型计算书',
    standardRef: 'ISO 281:2007',
    summary: '寿命、载荷和工况筛查结果整理',
    formulas: ['L10 = (C / P)^p × 10^6', 'P = X × Fr + Y × Fa', 'L10h = L10 / (60 × n)'],
  },
  bolts: {
    label: '螺栓连接计算书',
    standardRef: 'VDI 2230 / GB-T 5782',
    summary: '预紧力、强度和连接边界说明',
    formulas: ['T ≈ K × F × d', 'σ = F / A_s', 'Safety = σ_allow / σ_actual'],
  },
  tolerances: {
    label: '公差配合计算书',
    standardRef: 'ISO 286',
    summary: '基本偏差、IT 等级和配合结论整理',
    formulas: ['D_max = D_nom + ES', 'D_min = D_nom + EI', 'Fit = Hole - Shaft'],
  },
  'param-scan': {
    label: '参数扫描分析报告',
    standardRef: 'MechBox Param Scan Internal',
    summary: '设计窗口、敏感参数和危险工况分析',
    formulas: ['y = f(x1, x2, ..., xn)', 'Sensitivity_i = Δy / Δx_i', 'Margin = Limit - Response'],
  },
  'monte-carlo': {
    label: '蒙特卡洛分析报告',
    standardRef: 'MechBox Monte Carlo Internal',
    summary: '分布假设、良率与尾部风险统计',
    formulas: ['x ~ Distribution(μ, σ)', 'Yield = N_pass / N_total', 'P95 = Quantile(x, 0.95)'],
  },
  'material-sub': {
    label: '材料代换报告',
    standardRef: 'Materials Extended JSON',
    summary: '材料相近性、性能差异和替代边界说明',
    formulas: ['Similarity = Σ(w_i × score_i)', 'Gap = Candidate - Baseline', 'Reserve = Allowable / Demand'],
  },
  'reverse-identify': {
    label: '逆向识别记录',
    standardRef: 'ISO / NSK / Fastener Catalogs',
    summary: '按测量值反查候选标准规格的筛查结果',
    formulas: ['Deviation = |Measured - Standard|', 'Score = Σ(w_i × normalized_gap_i)', 'Rank = sort(score ascending)'],
  },
  'bom-export': {
    label: 'BOM 导出记录',
    standardRef: 'MechBox BOM Internal',
    summary: '物料汇总、采购项合并与成本归档记录',
    formulas: ['TotalCost = Σ(q_i × unitCost_i)', 'MergedQty = Σ(q_i)', 'Coverage = completed_fields / required_fields'],
  },
}

export function getReportModuleMeta(module: string) {
  return reportModuleMetaMap[module] ?? {
    label: module,
    standardRef: 'MechBox Internal Template',
    summary: '结构化工程报告',
    formulas: ['Result = f(inputs)', 'Safety = Allowable / Actual', 'Margin = Limit - Response'],
  }
}

export function getReportSourceMeta(sourceKind?: string) {
  const normalized = normalizeReportSourceKind(sourceKind)
  return reportSourceMetaMap[normalized]
}

export function normalizeReportSourceKind(sourceKind?: unknown): ReportSourceKind {
  if (
    sourceKind === 'module-result' ||
    sourceKind === 'analysis-export' ||
    sourceKind === 'archive-report' ||
    sourceKind === 'manual-report'
  ) {
    return sourceKind
  }
  return 'module-result'
}

function inferReportSourceKind(item: Record<string, unknown>): ReportSourceKind {
  const explicit = normalizeReportSourceKind(item.sourceKind)
  if (item.sourceKind) return explicit

  const type = item.type === 'csv' || item.type === 'json' ? item.type : 'pdf'
  const module = String(item.module ?? 'unknown')
  const title = String(item.title ?? '')

  if (type === 'csv' || type === 'json' || module === 'bom-export') {
    return 'analysis-export'
  }
  if (title.includes('计算书编制') || title.includes('结构化工程报告')) {
    return 'manual-report'
  }
  return 'module-result'
}

function emitReportsChange(recordCount: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(REPORTS_STORAGE_EVENT, { detail: { recordCount } }))
}

function hasWorkflowBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.workflow)
}

export function loadStoredReportDerivationMetaMap() {
  if (typeof window === 'undefined') return {} as Record<string, ReportDerivationMeta>
  try {
    return JSON.parse(localStorage.getItem(REPORT_DERIVATION_META_STORAGE_KEY) ?? '{}') as Record<string, ReportDerivationMeta>
  } catch {
    return {}
  }
}

export function saveStoredReportDerivationMetaMap(map: Record<string, ReportDerivationMeta>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(REPORT_DERIVATION_META_STORAGE_KEY, JSON.stringify(map))
}

export function upsertStoredReportDerivationMeta(reportId: string, meta: ReportDerivationMeta) {
  const current = loadStoredReportDerivationMetaMap()
  current[reportId] = meta
  saveStoredReportDerivationMetaMap(current)
}

export function removeStoredReportDerivationMeta(reportId: string) {
  const current = loadStoredReportDerivationMetaMap()
  if (!(reportId in current)) return
  delete current[reportId]
  saveStoredReportDerivationMetaMap(current)
}

export function normalizeReportRecords(input: unknown): ReportRecord[] {
  if (!Array.isArray(input)) return []
  const derivationMetaMap = loadStoredReportDerivationMetaMap()

  return input
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => {
      const sourceKind = inferReportSourceKind(item)
      return {
        id: String(item.id ?? `rpt_legacy_${index}`),
        title: String(item.title ?? '未命名报告'),
        module: String(item.module ?? 'unknown'),
        createdAt: String(item.createdAt ?? new Date().toISOString()),
        type: (item.type === 'csv' || item.type === 'json' ? item.type : 'pdf') as 'pdf' | 'csv' | 'json',
        status: (item.status === 'pending' ? 'pending' : 'generated') as 'generated' | 'pending',
        projectNumber: item.projectNumber ? String(item.projectNumber) : undefined,
        projectId: item.projectId ? String(item.projectId) : undefined,
        projectName: item.projectName ? String(item.projectName) : undefined,
        standardRef: item.standardRef ? String(item.standardRef) : undefined,
        author: item.author ? String(item.author) : undefined,
        summary: item.summary ? String(item.summary) : undefined,
        sourceKind,
        linkedRunId: item.linkedRunId ? String(item.linkedRunId) : undefined,
        linkedResultId: item.linkedResultId ? String(item.linkedResultId) : undefined,
        revisionCode: item.revisionCode ? String(item.revisionCode) : 'A',
        workflowStatus:
          item.workflowStatus === 'in-review' ||
          item.workflowStatus === 'approved' ||
          item.workflowStatus === 'released' ||
          item.workflowStatus === 'archived'
            ? item.workflowStatus
            : sourceKind === 'archive-report'
              ? 'approved'
              : 'draft',
        derivationMeta:
          item.derivationMeta && typeof item.derivationMeta === 'object'
            ? (item.derivationMeta as ReportDerivationMeta)
            : derivationMetaMap[String(item.id ?? `rpt_legacy_${index}`)] ?? null,
      }
    })
}

function readReportsFromStorage() {
  try {
    return normalizeReportRecords(JSON.parse(localStorage.getItem(REPORTS_STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

function writeReportsToStorage(records: ReportRecord[]) {
  localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(records))
}

async function replaceReportsInDb(records: ReportRecord[]) {
  if (!hasWorkflowBridge()) return
  try {
    await window.electron.workflow.replaceReports(records)
  } catch (error) {
    console.warn('同步报告到 SQLite 失败:', error)
  }
}

function hydrateReportsFromDb() {
  if (!hasWorkflowBridge()) return
  if (reportHydrationPromise) return

  reportHydrationPromise = (async () => {
    const dbReports = normalizeReportRecords(await window.electron.workflow.listReports())
    const localReports = readReportsFromStorage()

    if (!dbReports.length && localReports.length) {
      await window.electron.workflow.replaceReports(localReports)
      return
    }

    if (!dbReports.length) return

    writeReportsToStorage(dbReports)
    emitReportsChange(dbReports.length)
  })().catch((error) => {
    console.warn('从 SQLite 水合报告数据失败:', error)
  })
}

function scheduleReportHydration() {
  if (!hasWorkflowBridge()) return
  if (reportHydrationPromise || reportHydrationScheduled) return

  reportHydrationScheduled = true
  window.setTimeout(() => {
    reportHydrationScheduled = false
    hydrateReportsFromDb()
  }, REPORT_HYDRATION_DELAY_MS)
}

export function loadStoredReports() {
  scheduleReportHydration()
  return readReportsFromStorage()
}

export async function fetchStoredReportsFresh() {
  hydrateReportsFromDb()

  if (!hasWorkflowBridge()) {
    return readReportsFromStorage()
  }

  try {
    const dbReports = normalizeReportRecords(await window.electron.workflow.listReports())
    writeReportsToStorage(dbReports)
    return dbReports
  } catch (error) {
    console.warn('显式读取报告对象失败:', error)
    return readReportsFromStorage()
  }
}

export function saveStoredReports(records: ReportRecord[]) {
  writeReportsToStorage(records)
  emitReportsChange(records.length)
  const persistTask = reportHydrationPromise
    ? reportHydrationPromise.finally(() => replaceReportsInDb(records))
    : replaceReportsInDb(records)
  void persistTask
}

export function appendStoredReport(record: ReportRecord) {
  const artifactLink =
    record.linkedRunId || record.linkedResultId
      ? null
      : resolveLatestWorkflowArtifactLink(record.module, record.projectId)
  const normalizedRecord: ReportRecord = {
    ...record,
    linkedRunId: record.linkedRunId ?? artifactLink?.runId,
    linkedResultId: record.linkedResultId ?? artifactLink?.resultId,
  }
  const records = loadStoredReports()
  const nextRecords = [normalizedRecord, ...records.filter((item) => item.id !== record.id)]
  saveStoredReports(nextRecords)
  void appendWorkflowCalculationRun({
    id: `run_report_${normalizedRecord.id}`,
    module: normalizedRecord.module,
    name: normalizedRecord.title,
    createdAt: normalizedRecord.createdAt,
    projectId: normalizedRecord.projectId,
    projectNumber: normalizedRecord.projectNumber,
    projectName: normalizedRecord.projectName,
    sourceKind:
      normalizedRecord.sourceKind === 'analysis-export' ||
      normalizedRecord.sourceKind === 'archive-report' ||
      normalizedRecord.sourceKind === 'manual-report'
        ? normalizedRecord.sourceKind
        : normalizedRecord.type === 'pdf'
          ? 'pdf-export'
          : 'analysis-export',
    summary: normalizedRecord.summary,
    linkedReportId: normalizedRecord.id,
    outputData: {
      type: normalizedRecord.type,
      status: normalizedRecord.status,
      standardRef: normalizedRecord.standardRef,
      author: normalizedRecord.author,
      linkedRunId: normalizedRecord.linkedRunId,
      linkedResultId: normalizedRecord.linkedResultId,
      revisionCode: normalizedRecord.revisionCode ?? 'A',
      workflowStatus: normalizedRecord.workflowStatus ?? 'draft',
    },
    metadata: {
      reportId: normalizedRecord.id,
      linkedRunId: normalizedRecord.linkedRunId ?? null,
      linkedResultId: normalizedRecord.linkedResultId ?? null,
    },
  })
  return nextRecords
}

export function mergeStoredReports(records: ReportRecord[]) {
  const imported = normalizeReportRecords(records)
  if (!imported.length) return loadStoredReports()

  const existing = loadStoredReports()
  const nextRecords = [...imported, ...existing].filter(
    (record, index, list) => list.findIndex((item) => item.id === record.id) === index,
  )
  saveStoredReports(nextRecords)
  return nextRecords
}

export function isReportLinkedToProject(
  report: Pick<ReportRecord, 'projectId' | 'projectName' | 'projectNumber'>,
  project: { id: string; name: string },
) {
  if (report.projectId && report.projectId === project.id) return true
  if (report.projectName && report.projectName === project.name) return true
  if (report.projectNumber && (report.projectNumber === project.id || report.projectNumber === project.name)) return true
  return false
}

export function buildReportText(record: Pick<ReportRecord, 'id' | 'title' | 'module' | 'createdAt' | 'projectNumber' | 'standardRef' | 'author' | 'summary'>, options?: {
  includeFormulas?: boolean
  includeStandardRefs?: boolean
  includeWatermark?: boolean
}) {
  const moduleMeta = getReportModuleMeta(record.module)
  const standardRef = record.standardRef || moduleMeta.standardRef
  const summary = record.summary || moduleMeta.summary
  const formulas = moduleMeta.formulas.length
    ? moduleMeta.formulas
    : ['Result = f(inputs)', 'Safety = Allowable / Actual', 'Margin = Limit - Response']

  const lines = [
    '========================================',
    '机械设计计算书',
    'MechBox Engineering Calculation Report',
    '========================================',
    '',
    `报告标题: ${record.title}`,
    `报告编号: ${record.projectNumber || record.id}`,
    `生成时间: ${new Date(record.createdAt).toLocaleString()}`,
    `计算模块: ${moduleMeta.label}`,
    `编制人: ${record.author || '未标注'}`,
    '----------------------------------------',
    '',
    '【报告摘要】',
    summary,
    '',
  ]

  if (options?.includeStandardRefs !== false) {
    lines.push('【引用标准】')
    lines.push(standardRef)
    lines.push('')
  }

  if (options?.includeFormulas !== false) {
    lines.push('【代表性公式】')
    lines.push(...formulas)
    lines.push('')
  }

  lines.push('【归档说明】')
  lines.push('1. 本报告用于结构化归档与评审沟通。')
  lines.push('2. 关键工程结论仍应回到对应模块与来源链复核。')
  lines.push('')
  lines.push(`Generated by ${APP_NAME} v${APP_VERSION}`)
  lines.push('========================================')

  return lines.join('\n')
}
