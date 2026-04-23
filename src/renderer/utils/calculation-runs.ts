export type CalculationRunSourceKind =
  | 'recent-calculation'
  | 'pdf-export'
  | 'analysis-export'
  | 'archive-report'
  | 'manual-report'

export interface CalculationRunRecord {
  id: string
  module: string
  name: string
  createdAt: string
  projectId?: string
  projectNumber?: string
  projectName?: string
  sourceKind: CalculationRunSourceKind
  summary?: string
  linkedReportId?: string
  inputData?: unknown
  outputData?: unknown
  metadata?: Record<string, unknown> | null
}

export const CALCULATION_RUNS_EVENT = 'mechbox:calculation-runs-updated'

function emitCalculationRunsChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CALCULATION_RUNS_EVENT))
}

function hasWorkflowBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.workflow)
}

function normalizeRecord(input: unknown): CalculationRunRecord | null {
  if (!input || typeof input !== 'object') return null
  const item = input as Record<string, unknown>
  const sourceKind = item.sourceKind
  const normalizedSourceKind: CalculationRunSourceKind =
    sourceKind === 'pdf-export' ||
    sourceKind === 'analysis-export' ||
    sourceKind === 'archive-report' ||
    sourceKind === 'manual-report'
      ? sourceKind
      : 'recent-calculation'

  return {
    id: String(item.id ?? `calc_${Date.now()}`),
    module: String(item.module ?? 'unknown'),
    name: String(item.name ?? '未命名运行记录'),
    createdAt: String(item.createdAt ?? new Date().toISOString()),
    projectId: item.projectId ? String(item.projectId) : undefined,
    projectNumber: item.projectNumber ? String(item.projectNumber) : undefined,
    projectName: item.projectName ? String(item.projectName) : undefined,
    sourceKind: normalizedSourceKind,
    summary: item.summary ? String(item.summary) : undefined,
    linkedReportId: item.linkedReportId ? String(item.linkedReportId) : undefined,
    inputData: item.inputData,
    outputData: item.outputData,
    metadata: item.metadata && typeof item.metadata === 'object' ? (item.metadata as Record<string, unknown>) : null,
  }
}

export async function listWorkflowCalculationRuns(limit = 20) {
  if (!hasWorkflowBridge()) return []
  try {
    const rows = await window.electron.workflow.listCalculationRuns(limit)
    return rows.map((row) => normalizeRecord(row)).filter((row): row is CalculationRunRecord => Boolean(row))
  } catch (error) {
    console.warn('读取 CalculationRun 失败:', error)
    return []
  }
}

export async function replaceWorkflowCalculationRuns(records: CalculationRunRecord[]) {
  if (!hasWorkflowBridge()) return []
  try {
    const rows = await window.electron.workflow.replaceCalculationRuns(records)
    emitCalculationRunsChange()
    return rows.map((row) => normalizeRecord(row)).filter((row): row is CalculationRunRecord => Boolean(row))
  } catch (error) {
    console.warn('替换 CalculationRun 失败:', error)
    return []
  }
}

export async function appendWorkflowCalculationRun(record: CalculationRunRecord) {
  if (!hasWorkflowBridge()) return null
  try {
    const row = await window.electron.workflow.appendCalculationRun(record)
    emitCalculationRunsChange()
    return normalizeRecord(row)
  } catch (error) {
    console.warn('追加 CalculationRun 失败:', error)
    return null
  }
}
