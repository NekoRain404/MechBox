import {
  APP_LICENSE_SPDX,
  APP_NAME,
  APP_RELEASE_LABEL,
  APP_VERSION,
} from '../../shared/app-meta'
import {
  LAST_ROUTE_STORAGE_KEY,
  loadEnterpriseSettings,
  sanitizeEnterpriseSettings,
  saveEnterpriseSettings,
  type EnterpriseSettings,
} from '../engine/enterprise-settings'
import {
  FORM_DRAFTS_STORAGE_KEY,
  loadPersistedFormDrafts,
  savePersistedFormDrafts,
  type FormDraft,
} from '../store/useFormDraftStore'
import {
  loadStoredFavoriteItems,
  loadStoredRecentCalculationItems,
  loadStoredUnitPreference,
  saveStoredFavoriteItems,
  saveStoredRecentCalculationItems,
  saveStoredUnitPreference,
  type FavoriteItem,
  type RecentCalculationItem,
} from '../store/useStandardStore'
import {
  loadStoredReportDerivationMetaMap,
  loadStoredReports,
  saveStoredReportDerivationMetaMap,
  saveStoredReports,
  type ReportDerivationMeta,
  type ReportRecord,
} from './reporting'
import {
  loadActiveProject,
  loadStoredProjects,
  saveActiveProject,
  saveStoredProjects,
  type WorkspaceProject,
} from './workspace'

export const LOCAL_BACKUP_SCHEMA = 'mechbox-local-backup-v1'
const MAX_BACKUP_QUERY_LIMIT = 5000

type DataVersionRecord = {
  standard_code: string
  version: string
  source: string
  updated_at: string
  checksum: string
}

export interface LocalBackupLocalState {
  settings: EnterpriseSettings
  unit: 'mm' | 'inch'
  favorites: FavoriteItem[]
  recentCalculations: RecentCalculationItem[]
  formDrafts: Record<string, FormDraft>
  lastVisitedRoute: string
  projects: WorkspaceProject[]
  activeProject: WorkspaceProject | null
  reports: ReportRecord[]
  reportDerivationMetaMap: Record<string, ReportDerivationMeta>
}

export interface LocalBackupWorkflowState {
  projects: WorkflowProjectRecord[]
  activeProjectId: string | null
  reports: WorkflowReportRecord[]
  bomDrafts: WorkflowBomDraftRecord[]
  calculationRuns: WorkflowCalculationRunRecord[]
  scenarioSnapshots: WorkflowScenarioSnapshotRecord[]
  calculationResults: WorkflowCalculationResultRecord[]
  changeCases: WorkflowChangeCaseRecord[]
  approvalTasks: WorkflowApprovalTaskRecord[]
  objectEventLogs: WorkflowObjectEventLogRecord[]
  partMasters: WorkflowPartMasterRecord[]
  supplierParts: WorkflowSupplierPartRecord[]
  documentAttachments: WorkflowDocumentAttachmentRecord[]
}

export interface LocalBackupSnapshot {
  schema: typeof LOCAL_BACKUP_SCHEMA
  createdAt: string
  app: {
    name: string
    version: string
    releaseLabel: string
    license: string
  }
  local: LocalBackupLocalState
  workflow: LocalBackupWorkflowState | null
  dataVersion: DataVersionRecord[]
}

export interface BackupDiagnostics {
  snapshot: LocalBackupSnapshot
  localCounts: {
    favorites: number
    recentCalculations: number
    formDrafts: number
    projects: number
    reports: number
  }
  workflowCounts: {
    projects: number
    reports: number
    bomDrafts: number
    calculationRuns: number
    scenarioSnapshots: number
    calculationResults: number
    changeCases: number
    approvalTasks: number
    objectEventLogs: number
    partMasters: number
    supplierParts: number
    documentAttachments: number
  } | null
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input)
}

function readLastVisitedRoute() {
  try {
    const value = localStorage.getItem(LAST_ROUTE_STORAGE_KEY) ?? ''
    return value.startsWith('/') ? value : ''
  } catch (_error) {
    return ''
  }
}

function writeLastVisitedRoute(path: string) {
  if (!path || !path.startsWith('/')) {
    localStorage.removeItem(LAST_ROUTE_STORAGE_KEY)
    return
  }
  localStorage.setItem(LAST_ROUTE_STORAGE_KEY, path)
}

function toTimestampToken(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

export function createLocalBackupFilename(date = new Date()) {
  return `mechbox-local-backup-${toTimestampToken(date)}.json`
}

function normalizeLocalBackupState(input: unknown): LocalBackupLocalState {
  const local = isRecord(input) ? input : {}

  return {
    settings: sanitizeEnterpriseSettings(local.settings as Partial<EnterpriseSettings> | undefined),
    unit: local.unit === 'inch' ? 'inch' : 'mm',
    favorites: Array.isArray(local.favorites) ? (local.favorites as FavoriteItem[]) : [],
    recentCalculations: Array.isArray(local.recentCalculations)
      ? (local.recentCalculations as RecentCalculationItem[])
      : [],
    formDrafts: isRecord(local.formDrafts) ? (local.formDrafts as Record<string, FormDraft>) : {},
    lastVisitedRoute:
      typeof local.lastVisitedRoute === 'string' && local.lastVisitedRoute.startsWith('/')
        ? local.lastVisitedRoute
        : '',
    projects: Array.isArray(local.projects) ? (local.projects as WorkspaceProject[]) : [],
    activeProject: isRecord(local.activeProject) ? (local.activeProject as unknown as WorkspaceProject) : null,
    reports: Array.isArray(local.reports) ? (local.reports as ReportRecord[]) : [],
    reportDerivationMetaMap: isRecord(local.reportDerivationMetaMap)
      ? (local.reportDerivationMetaMap as Record<string, ReportDerivationMeta>)
      : {},
  }
}

function normalizeWorkflowBackupState(input: unknown): LocalBackupWorkflowState | null {
  if (!isRecord(input)) return null

  return {
    projects: Array.isArray(input.projects) ? (input.projects as WorkflowProjectRecord[]) : [],
    activeProjectId: typeof input.activeProjectId === 'string' ? input.activeProjectId : null,
    reports: Array.isArray(input.reports) ? (input.reports as WorkflowReportRecord[]) : [],
    bomDrafts: Array.isArray(input.bomDrafts) ? (input.bomDrafts as WorkflowBomDraftRecord[]) : [],
    calculationRuns: Array.isArray(input.calculationRuns)
      ? (input.calculationRuns as WorkflowCalculationRunRecord[])
      : [],
    scenarioSnapshots: Array.isArray(input.scenarioSnapshots)
      ? (input.scenarioSnapshots as WorkflowScenarioSnapshotRecord[])
      : [],
    calculationResults: Array.isArray(input.calculationResults)
      ? (input.calculationResults as WorkflowCalculationResultRecord[])
      : [],
    changeCases: Array.isArray(input.changeCases) ? (input.changeCases as WorkflowChangeCaseRecord[]) : [],
    approvalTasks: Array.isArray(input.approvalTasks) ? (input.approvalTasks as WorkflowApprovalTaskRecord[]) : [],
    objectEventLogs: Array.isArray(input.objectEventLogs)
      ? (input.objectEventLogs as WorkflowObjectEventLogRecord[])
      : [],
    partMasters: Array.isArray(input.partMasters) ? (input.partMasters as WorkflowPartMasterRecord[]) : [],
    supplierParts: Array.isArray(input.supplierParts) ? (input.supplierParts as WorkflowSupplierPartRecord[]) : [],
    documentAttachments: Array.isArray(input.documentAttachments)
      ? (input.documentAttachments as WorkflowDocumentAttachmentRecord[])
      : [],
  }
}

export function parseLocalBackupPayload(input: unknown): LocalBackupSnapshot {
  if (!isRecord(input) || input.schema !== LOCAL_BACKUP_SCHEMA) {
    throw new Error('不是有效的 MechBox 本地备份文件')
  }

  const app = isRecord(input.app) ? input.app : {}

  return {
    schema: LOCAL_BACKUP_SCHEMA,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
    app: {
      name: typeof app.name === 'string' ? app.name : APP_NAME,
      version: typeof app.version === 'string' ? app.version : APP_VERSION,
      releaseLabel: typeof app.releaseLabel === 'string' ? app.releaseLabel : APP_RELEASE_LABEL,
      license: typeof app.license === 'string' ? app.license : APP_LICENSE_SPDX,
    },
    local: normalizeLocalBackupState(input.local),
    workflow: normalizeWorkflowBackupState(input.workflow),
    dataVersion: Array.isArray(input.dataVersion) ? (input.dataVersion as DataVersionRecord[]) : [],
  }
}

function hasWorkflowBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.workflow)
}

function hasDataVersionBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.db?.queryDataVersion)
}

async function collectWorkflowBackupState(): Promise<LocalBackupWorkflowState | null> {
  if (!hasWorkflowBridge()) return null

  const workflow = window.electron.workflow
  const [
    projects,
    activeProjectId,
    reports,
    bomDrafts,
    calculationRuns,
    scenarioSnapshots,
    calculationResults,
    changeCases,
    approvalTasks,
    objectEventLogs,
    partMasters,
    supplierParts,
    documentAttachments,
  ] = await Promise.all([
    workflow.listProjects(),
    workflow.getActiveProjectId(),
    workflow.listReports(),
    workflow.listBomDrafts(200),
    workflow.listCalculationRuns(MAX_BACKUP_QUERY_LIMIT),
    workflow.listScenarioSnapshots(MAX_BACKUP_QUERY_LIMIT),
    workflow.listCalculationResults(MAX_BACKUP_QUERY_LIMIT),
    workflow.listChangeCases(MAX_BACKUP_QUERY_LIMIT),
    workflow.listApprovalTasks(MAX_BACKUP_QUERY_LIMIT),
    workflow.listObjectEventLogs(MAX_BACKUP_QUERY_LIMIT),
    workflow.listPartMasters(MAX_BACKUP_QUERY_LIMIT),
    workflow.listSupplierParts(MAX_BACKUP_QUERY_LIMIT),
    workflow.listDocumentAttachments(MAX_BACKUP_QUERY_LIMIT),
  ])

  return {
    projects,
    activeProjectId,
    reports,
    bomDrafts,
    calculationRuns,
    scenarioSnapshots,
    calculationResults,
    changeCases,
    approvalTasks,
    objectEventLogs,
    partMasters,
    supplierParts,
    documentAttachments,
  }
}

export async function collectLocalBackupSnapshot(): Promise<LocalBackupSnapshot> {
  const [workflow, dataVersion] = await Promise.all([
    collectWorkflowBackupState(),
    hasDataVersionBridge()
      ? window.electron.db.queryDataVersion().catch(() => [] as DataVersionRecord[])
      : Promise.resolve([] as DataVersionRecord[]),
  ])

  return {
    schema: LOCAL_BACKUP_SCHEMA,
    createdAt: new Date().toISOString(),
    app: {
      name: APP_NAME,
      version: APP_VERSION,
      releaseLabel: APP_RELEASE_LABEL,
      license: APP_LICENSE_SPDX,
    },
    local: {
      settings: loadEnterpriseSettings(),
      unit: loadStoredUnitPreference(),
      favorites: loadStoredFavoriteItems(),
      recentCalculations: loadStoredRecentCalculationItems(),
      formDrafts: loadPersistedFormDrafts(),
      lastVisitedRoute: readLastVisitedRoute(),
      projects: loadStoredProjects(),
      activeProject: loadActiveProject(),
      reports: loadStoredReports(),
      reportDerivationMetaMap: loadStoredReportDerivationMetaMap(),
    },
    workflow,
    dataVersion,
  }
}

function triggerTextDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}

export function downloadLocalBackup(snapshot: LocalBackupSnapshot) {
  const filename = createLocalBackupFilename(new Date(snapshot.createdAt))
  triggerTextDownload(filename, `${JSON.stringify(snapshot, null, 2)}\n`)
  return filename
}

export async function importLocalBackup(snapshot: LocalBackupSnapshot) {
  saveEnterpriseSettings(snapshot.local.settings)
  saveStoredUnitPreference(snapshot.local.unit)
  saveStoredFavoriteItems(snapshot.local.favorites)
  saveStoredRecentCalculationItems(snapshot.local.recentCalculations)
  savePersistedFormDrafts(snapshot.local.formDrafts)
  saveStoredProjects(snapshot.local.projects)
  saveActiveProject(snapshot.local.activeProject)
  saveStoredReports(snapshot.local.reports)
  saveStoredReportDerivationMetaMap(snapshot.local.reportDerivationMetaMap)
  writeLastVisitedRoute(snapshot.local.lastVisitedRoute)

  if (!snapshot.workflow || !hasWorkflowBridge()) {
    return
  }

  const workflow = window.electron.workflow
  await workflow.replaceProjects(snapshot.workflow.projects)
  await workflow.setActiveProjectId(
    snapshot.workflow.activeProjectId ?? snapshot.local.activeProject?.id ?? null,
  )
  await workflow.replaceReports(snapshot.workflow.reports)
  await workflow.replaceCalculationRuns(snapshot.workflow.calculationRuns)

  const snapshotsByRunId = new Map<string, WorkflowScenarioSnapshotRecord[]>()
  snapshot.workflow.scenarioSnapshots.forEach((record) => {
    const existing = snapshotsByRunId.get(record.runId) ?? []
    existing.push(record)
    snapshotsByRunId.set(record.runId, existing)
  })

  const resultsByRunId = new Map<string, WorkflowCalculationResultRecord[]>()
  snapshot.workflow.calculationResults.forEach((record) => {
    const existing = resultsByRunId.get(record.runId) ?? []
    existing.push(record)
    resultsByRunId.set(record.runId, existing)
  })

  for (const run of snapshot.workflow.calculationRuns) {
    const snapshots = snapshotsByRunId.get(run.id) ?? []
    const results = resultsByRunId.get(run.id) ?? []
    if (!snapshots.length && !results.length) continue
    await workflow.recordCalculationArtifacts({ run, snapshots, results })
  }

  for (const draft of snapshot.workflow.bomDrafts) {
    await workflow.saveBomDraft(draft)
  }

  for (const record of snapshot.workflow.changeCases) {
    await workflow.upsertChangeCase(record)
  }

  for (const record of snapshot.workflow.approvalTasks) {
    await workflow.upsertApprovalTask(record)
  }

  for (const record of snapshot.workflow.partMasters) {
    await workflow.upsertPartMaster(record)
  }

  for (const record of snapshot.workflow.supplierParts) {
    await workflow.upsertSupplierPart(record)
  }

  for (const record of snapshot.workflow.documentAttachments) {
    await workflow.upsertDocumentAttachment(record)
  }

  for (const record of snapshot.workflow.objectEventLogs) {
    await workflow.appendObjectEventLog(record)
  }
}

export async function collectBackupDiagnostics(): Promise<BackupDiagnostics> {
  const snapshot = await collectLocalBackupSnapshot()

  return {
    snapshot,
    localCounts: {
      favorites: snapshot.local.favorites.length,
      recentCalculations: snapshot.local.recentCalculations.length,
      formDrafts: Object.keys(snapshot.local.formDrafts).length,
      projects: snapshot.local.projects.length,
      reports: snapshot.local.reports.length,
    },
    workflowCounts: snapshot.workflow
      ? {
          projects: snapshot.workflow.projects.length,
          reports: snapshot.workflow.reports.length,
          bomDrafts: snapshot.workflow.bomDrafts.length,
          calculationRuns: snapshot.workflow.calculationRuns.length,
          scenarioSnapshots: snapshot.workflow.scenarioSnapshots.length,
          calculationResults: snapshot.workflow.calculationResults.length,
          changeCases: snapshot.workflow.changeCases.length,
          approvalTasks: snapshot.workflow.approvalTasks.length,
          objectEventLogs: snapshot.workflow.objectEventLogs.length,
          partMasters: snapshot.workflow.partMasters.length,
          supplierParts: snapshot.workflow.supplierParts.length,
          documentAttachments: snapshot.workflow.documentAttachments.length,
        }
      : null,
  }
}

export function formatBackupDiagnosticsText(diagnostics: BackupDiagnostics) {
  const lines = [
    `${APP_NAME} 运行诊断`,
    `版本: ${diagnostics.snapshot.app.version} (${diagnostics.snapshot.app.releaseLabel})`,
    `协议: ${diagnostics.snapshot.app.license}`,
    `诊断时间: ${diagnostics.snapshot.createdAt}`,
    `本地单位: ${diagnostics.snapshot.local.unit}`,
    `上次页面: ${diagnostics.snapshot.local.lastVisitedRoute || '未记录'}`,
    `本地记录: 收藏 ${diagnostics.localCounts.favorites} / 最近计算 ${diagnostics.localCounts.recentCalculations} / 草稿 ${diagnostics.localCounts.formDrafts} / 项目 ${diagnostics.localCounts.projects} / 报告 ${diagnostics.localCounts.reports}`,
  ]

  if (diagnostics.workflowCounts) {
    lines.push(
      `工作流记录: 项目 ${diagnostics.workflowCounts.projects} / 报告 ${diagnostics.workflowCounts.reports} / BOM ${diagnostics.workflowCounts.bomDrafts} / 计算 ${diagnostics.workflowCounts.calculationRuns} / 快照 ${diagnostics.workflowCounts.scenarioSnapshots} / 结果 ${diagnostics.workflowCounts.calculationResults}`,
    )
    lines.push(
      `扩展记录: 变更 ${diagnostics.workflowCounts.changeCases} / 审批 ${diagnostics.workflowCounts.approvalTasks} / 事件 ${diagnostics.workflowCounts.objectEventLogs} / 零件 ${diagnostics.workflowCounts.partMasters} / 供应商 ${diagnostics.workflowCounts.supplierParts} / 文档 ${diagnostics.workflowCounts.documentAttachments}`,
    )
  } else {
    lines.push('工作流桥接: 不可用')
  }

  if (diagnostics.snapshot.dataVersion.length) {
    lines.push('标准数据版本:')
    diagnostics.snapshot.dataVersion.forEach((item) => {
      lines.push(`- ${item.standard_code}: ${item.version} (${item.updated_at})`)
    })
  } else {
    lines.push('标准数据版本: 未读取到')
  }

  return lines.join('\n')
}

export function readRawBackupText(file: File) {
  return file.text()
}

export const LOCAL_BACKUP_STORAGE_KEYS = {
  formDrafts: FORM_DRAFTS_STORAGE_KEY,
  lastRoute: LAST_ROUTE_STORAGE_KEY,
} as const
