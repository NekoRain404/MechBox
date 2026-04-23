<script setup lang="ts">
/**
 * ReportCenterPage - 报告中心页面
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { jsPDF } from 'jspdf'
import { useRouter } from 'vue-router'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import PageLoadingState from '../components/PageLoadingState.vue'
import PageSyncStatus from '../components/PageSyncStatus.vue'
import StateEmpty from '../components/StateEmpty.vue'
import { useAppFeedback } from '../composables/useAppFeedback'
import { loadEnterpriseSettings } from '../engine/enterprise-settings'
import { moduleRouteMap } from '../router/route-meta'
import { useStandardStore } from '../store/useStandardStore'
import {
  REPORTS_STORAGE_EVENT,
  appendStoredReport,
  buildReportText,
  fetchStoredReportsFresh,
  getReportModuleMeta,
  getReportSourceMeta,
  isReportLinkedToProject,
  loadStoredReports,
  removeStoredReportDerivationMeta,
  saveStoredReports,
  type ReportSourceKind,
  type ReportRecord,
  upsertStoredReportDerivationMeta,
} from '../utils/reporting'
import { loadActiveProject, WORKSPACE_STORAGE_EVENT } from '../utils/workspace'
import {
  WORKFLOW_ARTIFACTS_EVENT,
  resolveLatestWorkflowArtifactLink,
  type WorkflowCalculationResult,
  type WorkflowScenarioSnapshot,
} from '../utils/workflow-artifacts'
import { fetchWorkflowInsights, type WorkflowInsightsSnapshot } from '../utils/workflow-insights'
import {
  appendObjectEventLog,
  CHANGE_CONTROL_EVENT,
  fetchChangeControlSnapshot,
  filterApprovalTasksByObject,
  filterChangeCasesByObject,
  filterObjectEventsByObject,
  upsertApprovalTask,
  upsertChangeCase,
  type ChangeControlSnapshot,
} from '../utils/change-control'
import {
  ENGINEERING_LIBRARY_EVENT,
  fetchEngineeringLibrarySnapshot,
  upsertDocumentAttachment,
  type EngineeringLibrarySnapshot,
} from '../utils/engineering-library'
import {
  canAdvanceWorkflowStatus,
  canDeleteWorkflowRecord,
  resolveWorkflowFreezeState,
} from '../utils/governance-freeze'
import {
  buildDerivationNote,
  buildDerivedTitle,
  buildReferenceLock,
  getNextRevisionCode,
} from '../utils/revision-derivation'
import {
  analyzeRevisionGovernance,
  getRevisionGovernanceCategoryMeta,
  getRevisionGovernancePriorityMeta,
  getRevisionGovernanceRepairabilityMeta,
  type RevisionGovernanceAlert,
} from '../utils/revision-governance'
import { buildRevisionLineage } from '../utils/revision-lineage'
import {
  FileTextOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  ArrowRightOutlined,
  ApartmentOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'

const reports = ref<ReportRecord[]>([])
const loading = ref(false)
const hasLoadedOnce = ref(false)
const lastSyncedAt = ref<string | null>(null)
const syncError = ref('')
const showPreviewModal = ref(false)
const previewContent = ref('')
const previewingReport = ref<ReportRecord | null>(null)
const showTraceModal = ref(false)
const traceReport = ref<ReportRecord | null>(null)
const feedback = useAppFeedback()
const router = useRouter()
const store = useStandardStore()
const activeProject = ref(loadActiveProject())
const workflowInsights = ref<WorkflowInsightsSnapshot>({
  runs: [],
  results: [],
  snapshots: [],
})
const changeControlSnapshot = ref<ChangeControlSnapshot>({
  changes: [],
  approvals: [],
  events: [],
})
const engineeringSnapshot = ref<EngineeringLibrarySnapshot>({
  partMasters: [],
  supplierParts: [],
  bomRevisionLinks: [],
  documentAttachments: [],
})
const activeProjectOnly = ref(false)
const selectedModule = ref<'all' | string>('all')
const selectedType = ref<'all' | 'pdf' | 'csv' | 'json'>('all')
const selectedSource = ref<'all' | ReportSourceKind>('all')
const selectedWorkflowStatus = ref<'all' | NonNullable<ReportRecord['workflowStatus']>>('all')
const selectedFormalLink = ref<'all' | 'linked' | 'unlinked'>('all')
const selectedResultStatus = ref<'all' | 'missing' | WorkflowCalculationResult['status']>('all')
let reportSyncRequestId = 0

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

const workflowStatusLabels: Record<NonNullable<ReportRecord['workflowStatus']>, string> = {
  draft: '草稿',
  'in-review': '评审中',
  approved: '已批准',
  released: '已发布',
  archived: '已归档',
}

const workflowStatusColors: Record<NonNullable<ReportRecord['workflowStatus']>, string> = {
  draft: 'default',
  'in-review': 'orange',
  approved: 'blue',
  released: 'green',
  archived: 'default',
}

async function syncReportState(options: { silent?: boolean } = {}) {
  const requestId = ++reportSyncRequestId
  loading.value = true

  try {
    const [nextReports, workflowSnapshot, changeSnapshot, engineeringLibrary] = await Promise.all([
      fetchStoredReportsFresh(),
      fetchWorkflowInsights({ runLimit: 160, resultLimit: 280, snapshotLimit: 280 }),
      fetchChangeControlSnapshot({ changeLimit: 200, approvalLimit: 260, eventLimit: 320 }),
      fetchEngineeringLibrarySnapshot(),
    ])

    if (requestId !== reportSyncRequestId) return

    reports.value = nextReports
    activeProject.value = loadActiveProject()
    workflowInsights.value = workflowSnapshot
    changeControlSnapshot.value = changeSnapshot
    engineeringSnapshot.value = engineeringLibrary
    lastSyncedAt.value = new Date().toISOString()
    syncError.value = ''
  } catch (error) {
    if (requestId !== reportSyncRequestId) return

    syncError.value = getErrorMessage(error, '报告中心同步失败')
    if (!options.silent) {
      feedback.error(syncError.value)
    }
  } finally {
    if (requestId === reportSyncRequestId) {
      loading.value = false
      hasLoadedOnce.value = true
    }
  }
}

function handleReportStateChanged() {
  void syncReportState({ silent: true })
}

onMounted(() => {
  void syncReportState({ silent: true })
  window.addEventListener(REPORTS_STORAGE_EVENT, handleReportStateChanged)
  window.addEventListener(WORKSPACE_STORAGE_EVENT, handleReportStateChanged)
  window.addEventListener(WORKFLOW_ARTIFACTS_EVENT, handleReportStateChanged)
  window.addEventListener(CHANGE_CONTROL_EVENT, handleReportStateChanged)
  window.addEventListener(ENGINEERING_LIBRARY_EVENT, handleReportStateChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener(REPORTS_STORAGE_EVENT, handleReportStateChanged)
  window.removeEventListener(WORKSPACE_STORAGE_EVENT, handleReportStateChanged)
  window.removeEventListener(WORKFLOW_ARTIFACTS_EVENT, handleReportStateChanged)
  window.removeEventListener(CHANGE_CONTROL_EVENT, handleReportStateChanged)
  window.removeEventListener(ENGINEERING_LIBRARY_EVENT, handleReportStateChanged)
})

const moduleOptions = computed(() => {
  const modules = Array.from(new Set(reports.value.map((report) => report.module)))
  return modules.map((module) => ({ value: module, label: getReportModuleMeta(module).label }))
})

const filteredReports = computed(() =>
  reports.value.filter((report) => {
    if (activeProjectOnly.value && activeProject.value && !isReportLinkedToProject(report, activeProject.value)) {
      return false
    }
    if (selectedModule.value !== 'all' && report.module !== selectedModule.value) {
      return false
    }
    if (selectedType.value !== 'all' && report.type !== selectedType.value) {
      return false
    }
    if (selectedSource.value !== 'all' && report.sourceKind !== selectedSource.value) {
      return false
    }
    if (selectedWorkflowStatus.value !== 'all' && report.workflowStatus !== selectedWorkflowStatus.value) {
      return false
    }
    if (selectedFormalLink.value === 'linked' && !report.linkedRunId && !report.linkedResultId) {
      return false
    }
    if (selectedFormalLink.value === 'unlinked' && (report.linkedRunId || report.linkedResultId)) {
      return false
    }
    const resultState = getResultStateByReport(report)
    if (selectedResultStatus.value === 'missing' && resultState) {
      return false
    }
    if (
      selectedResultStatus.value !== 'all' &&
      selectedResultStatus.value !== 'missing' &&
      resultState?.status !== selectedResultStatus.value
    ) {
      return false
    }
    if (
      selectedResultStatus.value !== 'all' &&
      selectedResultStatus.value !== 'missing' &&
      !resultState
    ) {
      return false
    }
    return true
  }),
)

const sourceOptions = computed(() => {
  const values = Array.from(new Set(reports.value.map((report) => report.sourceKind).filter(Boolean))) as ReportSourceKind[]
  return values.map((value) => ({
    value,
    label: getReportSourceMeta(value).label,
  }))
})

function getChangeCasesByReport(report: ReportRecord) {
  return filterChangeCasesByObject('report', report.id, changeControlSnapshot.value)
}

function getApprovalTasksByReport(report: ReportRecord) {
  return filterApprovalTasksByObject('report', report.id, changeControlSnapshot.value)
}

function getPendingApprovalsByReport(report: ReportRecord) {
  return getApprovalTasksByReport(report).filter((item) => item.decisionStatus === 'pending')
}

function getEventLogsByReport(report: ReportRecord) {
  return filterObjectEventsByObject('report', report.id, changeControlSnapshot.value)
}

function getDocumentAttachmentsByReport(report: ReportRecord) {
  return engineeringSnapshot.value.documentAttachments.filter(
    (item) => item.objectType === 'report' && item.objectId === report.id,
  )
}

function isReportRecord(record: unknown): record is ReportRecord {
  return Boolean(record && typeof record === 'object' && 'id' in record && 'module' in record && 'title' in record)
}

function getReportLinkSummaryRow(record: unknown) {
  return isReportRecord(record) ? getReportLinkSummary(record) : '未关联'
}

function getResultStateByReportRow(record: unknown) {
  return isReportRecord(record) ? getResultStateByReport(record) : null
}

function getPendingApprovalsByReportRow(record: unknown) {
  return isReportRecord(record) ? getPendingApprovalsByReport(record) : []
}

function getChangeCasesByReportRow(record: unknown) {
  return isReportRecord(record) ? getChangeCasesByReport(record) : []
}

function getDocumentAttachmentsByReportRow(record: unknown) {
  return isReportRecord(record) ? getDocumentAttachmentsByReport(record) : []
}

function previewReportRow(record: unknown) {
  if (!isReportRecord(record)) return
  previewReport(record)
}

function openTraceModalRow(record: unknown) {
  if (!isReportRecord(record)) return
  openTraceModal(record)
}

function exportPDFRow(record: unknown) {
  if (!isReportRecord(record)) return
  exportPDF(record)
}

function deriveReportRevisionRow(record: unknown) {
  if (!isReportRecord(record)) return
  void deriveReportRevision(record)
}

function openReportSourceRow(record: unknown) {
  if (!isReportRecord(record)) return
  openReportSource(record)
}

const reportStats = computed(() => ({
  total: reports.value.length,
  filtered: filteredReports.value.length,
  pdf: filteredReports.value.filter((report) => report.type === 'pdf').length,
  linkedToActiveProject: activeProject.value
    ? reports.value.filter((report) => isReportLinkedToProject(report, activeProject.value!)).length
    : 0,
  exports: filteredReports.value.filter((report) => report.type === 'csv' || report.type === 'json').length,
  pending: filteredReports.value.filter((report) => report.status === 'pending').length,
  inReview: filteredReports.value.filter((report) => report.workflowStatus === 'in-review').length,
  linkedFormal: filteredReports.value.filter((report) => report.linkedRunId || report.linkedResultId).length,
  linkedWarning: filteredReports.value.filter((report) => getResultStateByReport(report)?.status === 'warning').length,
  linkedError: filteredReports.value.filter((report) => getResultStateByReport(report)?.status === 'error').length,
  changeCases: filteredReports.value.reduce((sum, report) => sum + getChangeCasesByReport(report).length, 0),
  pendingApprovals: filteredReports.value.reduce((sum, report) => sum + getPendingApprovalsByReport(report).length, 0),
  attachments: filteredReports.value.reduce((sum, report) => sum + getDocumentAttachmentsByReport(report).length, 0),
}))
const frozenReportCount = computed(() =>
  filteredReports.value.filter((report) => resolveWorkflowFreezeState(report.workflowStatus).isReadOnly).length,
)
const reportGovernanceSnapshot = computed(() =>
  analyzeRevisionGovernance(
    filteredReports.value.map((report) => ({
      id: report.id,
      title: report.title,
      revisionCode: report.revisionCode,
      status: report.workflowStatus,
      updatedAt: report.createdAt,
      parentId: report.derivationMeta?.derivedFromReportId ?? null,
      referenceLock: report.derivationMeta?.referenceLock ?? null,
      objectType: 'report' as const,
      projectId: report.projectId ?? null,
      routePath: moduleRouteMap[report.module] ?? null,
    })),
    resolveWorkflowFreezeState,
  ),
)
const reportGovernanceMetrics = computed(() => [
  { label: '可直接修复', value: reportGovernanceSnapshot.value.repairableAlerts },
  { label: '需人工复核', value: reportGovernanceSnapshot.value.reviewAlerts },
  { label: '基线参考', value: reportGovernanceSnapshot.value.referenceAlerts },
])
const reportGovernanceHealthMetrics = computed(() => [
  { label: '当前最新', value: reportGovernanceSnapshot.value.currentNodes, suffix: `${Math.round(reportGovernanceSnapshot.value.currentRate * 100)}%` },
  { label: '治理完成', value: reportGovernanceSnapshot.value.healthyNodes, suffix: `${Math.round(reportGovernanceSnapshot.value.completionRate * 100)}%` },
])

const pendingArchiveHints = computed(() => {
  if (!activeProject.value) return []
  return store.recentCalculations
    .filter((item) => item.module === activeProject.value?.module)
    .slice(0, 5)
})

const latestReport = computed(() => filteredReports.value[0] ?? reports.value[0] ?? null)

const pageAlerts = computed(() => {
  const items: Array<{ level: 'info' | 'warning'; message: string; description: string }> = []

  if (activeProjectOnly.value && activeProject.value && filteredReports.value.length === 0) {
    items.push({
      level: 'warning',
      message: `当前项目“${activeProject.value.name}”还没有直接关联的报告`,
      description: '可以先在对应模块生成报告，或从 BOM 导出页导出记录后再回到这里复核。',
    })
  }

  if (!latestReport.value) return items

  if (activeProject.value && pendingArchiveHints.value.length > reportStats.value.linkedToActiveProject) {
    items.push({
      level: 'warning',
      message: `当前项目还有 ${pendingArchiveHints.value.length} 条最近计算线索未沉淀到直接关联报告`,
      description: '建议优先把关键结果导出为 PDF/CSV/JSON，或在报告中心补生成归档报告。',
    })
  }

  const moduleMeta = getReportModuleMeta(latestReport.value.module)
  items.push({
      level: 'info' as const,
      message: `最近归档报告为“${latestReport.value.title}”`,
      description: `所属模块 ${moduleMeta.label}，引用标准 ${latestReport.value.standardRef || moduleMeta.standardRef}，当前阶段 ${getWorkflowStatusLabel(latestReport.value.workflowStatus)}，${latestReport.value.linkedResultId ? '已关联正式结果对象。' : '尚未关联正式结果对象。'}`,
    })
  if (getPendingApprovalsByReport(latestReport.value).length > 0) {
    items.push({
      level: 'warning',
      message: `最近报告“${latestReport.value.title}”仍有 ${getPendingApprovalsByReport(latestReport.value).length} 条待审批任务`,
      description: '建议先补齐审批结论，再把报告推进到发布或归档阶段。',
    })
  }
  if (frozenReportCount.value > 0) {
    items.push({
      level: 'info',
      message: `当前筛选结果中有 ${frozenReportCount.value} 份报告处于只读发布态`,
      description: '这些报告适合继续导出、比较和审查，但不应再直接推进阶段或删除。',
    })
  }
  if (reportGovernanceSnapshot.value.staleNodes > 0 || reportGovernanceSnapshot.value.inconsistentNodes > 0) {
    items.push({
      level: 'warning',
      message: `当前筛选报告中有 ${reportGovernanceSnapshot.value.staleNodes} 份滞后修订、${reportGovernanceSnapshot.value.inconsistentNodes} 份一致性告警`,
      description: '建议优先查看修订治理总览，确认哪些报告仍停留在旧基线或冻结引用不一致。',
    })
  }
  if (reportGovernanceSnapshot.value.repairableAlerts > 0) {
    items.push({
      level: 'warning',
      message: `当前报告治理完成度 ${Math.round(reportGovernanceSnapshot.value.completionRate * 100)}%，仍有 ${reportGovernanceSnapshot.value.repairableAlerts} 条可直接修复项。`,
      description: '建议先完成修订治理收口，再继续导出或作为项目正式报告引用。',
    })
  }
  return items
})

const decisionPanel = computed(() => {
  if (!filteredReports.value.length) {
    return {
      conclusion: activeProjectOnly.value && activeProject.value ? '当前项目还没有直接关联的归档报告。' : '当前还没有归档报告。',
      status: 'info' as const,
      risks: ['如果只保留页面截图或临时导出文件，后续追溯计算依据会比较弱。'],
      actions: ['先生成一个模块报告，建立可归档的结果基线。'],
      boundaries: ['当前报告中心保存的是本地报告记录，不替代正式文档管理系统。'],
    }
  }

  return {
    conclusion: `当前筛选范围内共有 ${filteredReports.value.length} 份报告，最近一份为 ${latestReport.value?.title ?? '未知'}，修订 ${latestReport.value?.revisionCode ?? 'A'}。`,
    status: 'success' as const,
    risks: reportStats.value.pending
      ? ['仍有待完成报告，需要补齐后再归档。']
      : reportStats.value.pendingApprovals
        ? ['当前筛选范围内仍有待审批任务，发布前应先完成评审或批准结论。']
        : reportStats.value.inReview
          ? ['当前仍有处于评审中的报告，发布前应完成复核。']
          : frozenReportCount.value > 0
            ? ['部分报告已经进入只读发布态，后续演进应新建修订而不是直接覆盖原报告。']
          : reportStats.value.linkedFormal < filteredReports.value.length
            ? ['部分报告尚未绑定正式结果对象，追溯链仍然不完整。']
            : [],
    actions: ['优先预览并导出关键报告，再纳入项目或外部文档归档。', '报告多时先按项目、来源或阶段过滤，避免不同阶段结果混看。', '对尚未绑定正式结果对象的报告，优先回到模块页重算后再导出。', '阶段推进时同步生成变更单和审批任务，避免报告状态只停留在列表标签上。'],
    boundaries: ['报告中心当前导出的是结构化 PDF 归档件，工程真实性仍需回到对应模块、运行记录与正式结果对象复核。'],
  }
})

function persistReports() {
  saveStoredReports(reports.value)
}

async function appendReportEvent(
  report: ReportRecord,
  eventType: WorkflowObjectEventLogRecord['eventType'],
  summary: string,
  payload?: Record<string, unknown>,
) {
  await appendObjectEventLog({
    id: `evt_report_${report.id}_${Date.now()}`,
    objectType: 'report',
    objectId: report.id,
    projectId: report.projectId,
    module: report.module,
    eventType,
    summary,
    actorName: report.author ?? '系统',
    eventAt: new Date().toISOString(),
    payload: payload ?? null,
  })
}

function resolveDocumentStatusByWorkflowStatus(
  workflowStatus?: ReportRecord['workflowStatus'],
): 'draft' | 'generated' | 'released' | 'archived' {
  switch (workflowStatus) {
    case 'released':
      return 'released'
    case 'archived':
      return 'archived'
    case 'draft':
      return 'draft'
    case 'in-review':
    case 'approved':
    default:
      return 'generated'
  }
}

async function upsertReportDocumentAttachment(
  report: ReportRecord,
  type: 'pdf' | 'csv' | 'json',
  status: 'draft' | 'generated' | 'released' | 'archived' = 'generated',
  extraPayload?: Record<string, unknown>,
) {
  await upsertDocumentAttachment({
    id: `doc_report_${report.id}_${type}`,
    projectId: report.projectId,
    objectType: 'report',
    objectId: report.id,
    module: report.module,
    documentKind: type,
    title: report.title,
    fileName: `${report.title.replace(/\s+/g, '_')}.${type}`,
    mimeType: type === 'pdf' ? 'application/pdf' : type === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
    storageType: 'export-reference',
    revisionCode: report.revisionCode ?? 'A',
    createdAt: new Date().toISOString(),
    createdBy: report.author,
    status,
    payload: {
      linkedRunId: report.linkedRunId ?? null,
      linkedResultId: report.linkedResultId ?? null,
      workflowStatus: report.workflowStatus ?? 'draft',
      derivationMeta: report.derivationMeta ?? null,
      ...extraPayload,
    },
  })
}

async function syncReportDocumentAttachmentState(
  report: ReportRecord,
  overrideStatus?: 'draft' | 'generated' | 'released' | 'archived',
  extraPayload?: Record<string, unknown>,
) {
  await upsertReportDocumentAttachment(
    report,
    report.type,
    overrideStatus ?? resolveDocumentStatusByWorkflowStatus(report.workflowStatus),
    extraPayload,
  )
}

async function appendReportTransitionControl(
  report: ReportRecord,
  nextStatus: NonNullable<ReportRecord['workflowStatus']>,
) {
  const now = new Date().toISOString()
  const changeId = `chg_report_${report.id}_${Date.now()}`
  const approvalId = `apr_report_${report.id}_${Date.now()}`
  const decisionStatus = nextStatus === 'in-review' ? 'pending' : nextStatus === 'draft' ? 'waived' : 'approved'

  await upsertChangeCase({
    id: changeId,
    projectId: report.projectId,
    objectType: 'report',
    objectId: report.id,
    changeCode: `${report.revisionCode ?? 'A'}-${Date.now()}`,
    title: `报告 ${report.title} 阶段推进到 ${getWorkflowStatusLabel(nextStatus)}`,
    module: report.module,
    reason: '报告阶段推进',
    impactSummary: `报告工作流状态从 ${getWorkflowStatusLabel(report.workflowStatus)} 变更到 ${getWorkflowStatusLabel(nextStatus)}`,
    requestedBy: report.author ?? '系统',
    requestedAt: now,
    effectiveAt: decisionStatus === 'pending' ? undefined : now,
    status: nextStatus === 'archived' ? 'archived' : nextStatus,
    revisionCode: report.revisionCode ?? 'A',
    payload: {
      previousWorkflowStatus: report.workflowStatus ?? 'draft',
      nextWorkflowStatus: nextStatus,
      linkedRunId: report.linkedRunId ?? null,
      linkedResultId: report.linkedResultId ?? null,
    },
  })

  await upsertApprovalTask({
    id: approvalId,
    changeId,
    projectId: report.projectId,
    objectType: 'report',
    objectId: report.id,
    module: report.module,
    title: `报告 ${report.title} 审批`,
    approvalRole: nextStatus === 'released' ? '报告发布批准' : '报告复核',
    assigneeName: '待分配',
    decisionStatus,
    dueAt: decisionStatus === 'pending' ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    decidedAt: decisionStatus === 'pending' ? undefined : now,
    comment: decisionStatus === 'pending' ? '等待报告评审' : `已推进到 ${getWorkflowStatusLabel(nextStatus)}`,
    seqNo: 1,
    createdAt: now,
    updatedAt: now,
    payload: {
      nextWorkflowStatus: nextStatus,
      reportType: report.type,
    },
  })
}

function generateReport(module: string) {
  const meta = getReportModuleMeta(module)
  const settings = loadEnterpriseSettings()
  const artifactLink = resolveLatestWorkflowArtifactLink(module, activeProject.value?.id)
  const report: ReportRecord = {
    id: `rpt_${Date.now()}`,
    title: `${meta.label} ${new Date().toLocaleDateString()}`,
    module,
    createdAt: new Date().toISOString(),
    type: 'pdf',
    status: 'generated',
    projectNumber: activeProject.value?.id ?? `AUTO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    projectId: activeProject.value?.id,
    projectName: activeProject.value?.name,
    standardRef: meta.standardRef,
    author: settings.defaultAuthor || '系统',
    summary: activeProject.value ? `${activeProject.value.name}：${meta.summary}` : meta.summary,
    sourceKind: 'archive-report',
    linkedRunId: artifactLink?.runId,
    linkedResultId: artifactLink?.resultId,
    revisionCode: 'A',
    workflowStatus: 'in-review',
  }

  reports.value = appendStoredReport(report)
  void syncReportDocumentAttachmentState(report)
  void appendReportTransitionControl(report, 'in-review')
  void appendReportEvent(report, 'created', `生成报告 ${report.title}`, {
    workflowStatus: report.workflowStatus,
    revisionCode: report.revisionCode,
    linkedRunId: report.linkedRunId ?? null,
    linkedResultId: report.linkedResultId ?? null,
  })
  feedback.notifyGenerated('报告')
}

async function deriveReportRevision(report: ReportRecord) {
  const now = new Date().toISOString()
  const nextRevisionCode = getNextRevisionCode(report.revisionCode)
  const referenceLock = buildReferenceLock({
    sourceObjectType: 'report',
    sourceObjectId: report.id,
    sourceRevisionCode: report.revisionCode,
    sourceStatus: report.workflowStatus,
    lockedAt: now,
  })
  const derivationMeta = {
    derivedFromReportId: report.id,
    sourceRevisionCode: report.revisionCode ?? 'A',
    nextRevisionCode,
    derivationNote: buildDerivationNote({
      sourceTitle: report.title,
      sourceRevisionCode: report.revisionCode,
      nextRevisionCode,
    }),
    referenceLock,
  }
  const derivedReport: ReportRecord = {
    ...report,
    id: `rpt_${Date.now()}`,
    title: buildDerivedTitle(report.title, nextRevisionCode),
    createdAt: now,
    revisionCode: nextRevisionCode,
    workflowStatus: 'draft',
    summary: [report.summary, buildDerivationNote({
      sourceTitle: report.title,
      sourceRevisionCode: report.revisionCode,
      nextRevisionCode,
    })]
      .filter(Boolean)
      .join('\n'),
    derivationMeta,
  }

  upsertStoredReportDerivationMeta(derivedReport.id, derivationMeta)
  reports.value = appendStoredReport(derivedReport)
  await syncReportDocumentAttachmentState(derivedReport, 'draft', {
    derivation: derivationMeta,
    referenceLock,
  })
  await appendReportEvent(report, 'linked', `报告 ${report.title} 派生新修订 ${nextRevisionCode}`, {
    derivedReportId: derivedReport.id,
    sourceRevisionCode: report.revisionCode ?? 'A',
    nextRevisionCode,
    referenceLock,
  })
  await appendReportEvent(derivedReport, 'created', `从 ${report.title} 派生报告修订 ${nextRevisionCode}`, {
    derivedFromReportId: report.id,
    sourceRevisionCode: report.revisionCode ?? 'A',
    nextRevisionCode,
    referenceLock,
  })
  feedback.success(`已派生报告修订 ${nextRevisionCode}`)
}

async function deriveGovernanceSuggested(alert: RevisionGovernanceAlert) {
  if (!alert.suggestedNodeId || alert.suggestedAction !== 'inspect-latest') {
    feedback.info('当前治理建议没有可派生的最新目标')
    return
  }

  const report = reports.value.find((item) => item.id === alert.suggestedNodeId) ?? null
  if (!report) {
    feedback.warning('未找到可派生的报告修订')
    return
  }

  await deriveReportRevision(report)
}

function getNextWorkflowStatus(current: NonNullable<ReportRecord['workflowStatus']>) {
  const order: NonNullable<ReportRecord['workflowStatus']>[] = ['draft', 'in-review', 'approved', 'released', 'archived']
  const currentIndex = order.indexOf(current)
  return order[Math.min(currentIndex + 1, order.length - 1)]
}

function getWorkflowStatusLabel(status?: ReportRecord['workflowStatus']) {
  return workflowStatusLabels[status ?? 'draft']
}

function getWorkflowStatusColor(status?: ReportRecord['workflowStatus']) {
  return workflowStatusColors[status ?? 'draft']
}

function getChangeCaseStatusLabel(status: WorkflowChangeCaseRecord['status']) {
  if (status === 'rejected') return '已驳回'
  return getWorkflowStatusLabel(status as ReportRecord['workflowStatus'])
}

function getReportLinkSummary(report: ReportRecord) {
  if (report.linkedResultId) return `结果 ${report.linkedResultId.replace(/^result_/, '')}`
  if (report.linkedRunId) return `运行 ${report.linkedRunId.replace(/^run_/, '')}`
  return '未关联'
}

function getResultStateByReport(report: ReportRecord) {
  if (!report.linkedResultId) return null
  return workflowInsights.value.results.find((item) => item.id === report.linkedResultId) ?? null
}

function getRunStateByReport(report: ReportRecord) {
  if (!report.linkedRunId) return null
  return workflowInsights.value.runs.find((item) => item.id === report.linkedRunId) ?? null
}

function getSnapshotsByReport(report: ReportRecord) {
  if (!report.linkedRunId) return []
  return workflowInsights.value.snapshots.filter((item) => item.runId === report.linkedRunId)
}

function getResultStatusLabel(status: WorkflowCalculationResult['status']) {
  const map: Record<WorkflowCalculationResult['status'], string> = {
    computed: '已计算',
    warning: '需复核',
    error: '异常',
    archived: '已归档',
  }
  return map[status]
}

function getResultStatusColor(status: WorkflowCalculationResult['status']) {
  const map: Record<WorkflowCalculationResult['status'], string> = {
    computed: 'blue',
    warning: 'orange',
    error: 'red',
    archived: 'green',
  }
  return map[status]
}

function previewReport(report: ReportRecord) {
  previewingReport.value = report
  previewContent.value = buildReportText(report, {
    includeFormulas: true,
    includeStandardRefs: true,
    includeWatermark: false,
  })
  showPreviewModal.value = true
}

function openTraceModal(report: ReportRecord) {
  traceReport.value = report
  showTraceModal.value = true
}

function exportPDF(report: ReportRecord) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const lines = buildReportText(report, {
    includeFormulas: true,
    includeStandardRefs: true,
    includeWatermark: false,
  }).split('\n')
  let currentY = 18

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)

  lines.forEach((line) => {
    if (currentY > 280) {
      pdf.addPage()
      currentY = 18
    }

    const isTitle = line.includes('机械设计计算书')
    const isSection = line.startsWith('【')
    const isDivider = line.startsWith('===')

    if (isDivider) {
      pdf.setDrawColor(148, 163, 184)
      pdf.line(14, currentY, pageWidth - 14, currentY)
      currentY += 6
      return
    }

    if (isTitle) {
      pdf.setFontSize(18)
      pdf.setTextColor(17, 24, 39)
      pdf.text(line, pageWidth / 2, currentY, { align: 'center' })
      pdf.setFontSize(11)
      currentY += 8
      return
    }

    if (isSection) {
      pdf.setFontSize(12)
      pdf.setTextColor(30, 64, 175)
      pdf.text(line, 14, currentY)
      pdf.setFontSize(11)
      pdf.setTextColor(15, 23, 42)
      currentY += 7
      return
    }

    pdf.setTextColor(15, 23, 42)
    pdf.text(line || ' ', 14, currentY)
    currentY += line ? 6 : 4
  })

  pdf.save(`${report.title.replace(/\s+/g, '_')}.pdf`)
  void syncReportDocumentAttachmentState(report)
  void appendReportEvent(report, 'exported', `导出报告 PDF ${report.title}`, {
    workflowStatus: report.workflowStatus,
    linkedResultId: report.linkedResultId ?? null,
  })
  feedback.notifyExported('报告 PDF')
}

async function deleteReport(id: string) {
  const targetReport = reports.value.find((report) => report.id === id) ?? null
  if (targetReport && !canDeleteWorkflowRecord(targetReport.workflowStatus)) {
    feedback.info('当前报告已处于只读发布态，不允许直接删除')
    return
  }
  const confirmed = await feedback.confirmDestructive({
    title: '删除报告',
    content: '确定要删除此报告吗？删除后只能重新生成。',
  })
  if (!confirmed) return

  if (targetReport) {
    removeStoredReportDerivationMeta(targetReport.id)
    await syncReportDocumentAttachmentState(targetReport, 'archived', {
      deletedAt: new Date().toISOString(),
    })
    await appendReportEvent(targetReport, 'deleted', `删除报告 ${targetReport.title}`, {
      workflowStatus: targetReport.workflowStatus,
    })
  }
  reports.value = reports.value.filter((report) => report.id !== id)
  persistReports()
  feedback.notifyDeleted('报告')
}

async function advanceWorkflowStatus(id: string) {
  const targetReport = reports.value.find((report) => report.id === id)
  if (!targetReport) return
  if (!canAdvanceWorkflowStatus(targetReport.workflowStatus)) {
    feedback.info('当前报告已处于只读发布态，不能继续直接推进阶段')
    return
  }

  const nextWorkflowStatus = getNextWorkflowStatus(targetReport.workflowStatus ?? 'draft')
  reports.value = reports.value.map((report) =>
    report.id === id
      ? {
          ...report,
          workflowStatus: nextWorkflowStatus,
        }
      : report,
  )
  persistReports()
  const updatedReport =
    reports.value.find((report) => report.id === id) ??
    {
      ...targetReport,
      workflowStatus: nextWorkflowStatus,
    }
  await syncReportDocumentAttachmentState(updatedReport)
  await appendReportTransitionControl(targetReport, nextWorkflowStatus)
  await appendReportEvent(
    targetReport,
    nextWorkflowStatus === 'in-review' ? 'approval-requested' : 'status-changed',
    `报告 ${targetReport.title} 阶段推进到 ${getWorkflowStatusLabel(nextWorkflowStatus)}`,
    {
      previousWorkflowStatus: targetReport.workflowStatus ?? 'draft',
      nextWorkflowStatus,
    },
  )
  feedback.notifySaved('报告阶段')
}

function closePreview() {
  showPreviewModal.value = false
  previewingReport.value = null
}

function closeTraceModal() {
  showTraceModal.value = false
  traceReport.value = null
}

function resetFilters() {
  activeProjectOnly.value = false
  selectedModule.value = 'all'
  selectedType.value = 'all'
  selectedSource.value = 'all'
  selectedWorkflowStatus.value = 'all'
  selectedFormalLink.value = 'all'
  selectedResultStatus.value = 'all'
}

function openModule(module: string) {
  const target = moduleRouteMap[module]
  if (target) {
    void router.push(target)
  }
}

function openReportSource(report: ReportRecord) {
  openModule(report.module)
}

function openGovernanceRoute(path?: string | null) {
  if (!path) {
    feedback.info('当前治理建议没有可打开的页面')
    return
  }
  void router.push(path)
}

const traceRun = computed(() => (traceReport.value ? getRunStateByReport(traceReport.value) : null))
const traceResult = computed(() => (traceReport.value ? getResultStateByReport(traceReport.value) : null))
const traceSnapshots = computed<WorkflowScenarioSnapshot[]>(() =>
  traceReport.value ? getSnapshotsByReport(traceReport.value) : [],
)
const traceChanges = computed(() => (traceReport.value ? getChangeCasesByReport(traceReport.value) : []))
const traceApprovals = computed(() => (traceReport.value ? getApprovalTasksByReport(traceReport.value) : []))
const traceEvents = computed(() => (traceReport.value ? getEventLogsByReport(traceReport.value) : []))
const traceAttachments = computed(() => (traceReport.value ? getDocumentAttachmentsByReport(traceReport.value) : []))
const traceRevisionLineage = computed(() =>
  buildRevisionLineage(
    reports.value.map((report) => ({
      id: report.id,
      title: report.title,
      revisionCode: report.revisionCode,
      status: report.workflowStatus,
      updatedAt: report.createdAt,
      parentId: report.derivationMeta?.derivedFromReportId ?? null,
      referenceLock: report.derivationMeta?.referenceLock ?? null,
    })),
    traceReport.value?.id ?? null,
    {
      freezeResolver: resolveWorkflowFreezeState,
      typeLabel: '报告',
    },
  ),
)
</script>

<template>
  <div class="report-center-page">
    <PageToolbar title="MechBox" subtitle="报告中心">
      <a-space>
        <a-button size="small" @click="router.push('/documents')">
          文档中心
        </a-button>
        <a-button size="small" :loading="loading" @click="syncReportState()">
          <template #icon><ReloadOutlined /></template>刷新报告台
        </a-button>
        <a-dropdown>
          <a-button type="primary" size="small">
            <template #icon><FileTextOutlined /></template>生成新报告
          </a-button>
          <template #overlay>
            <a-menu @click="(event: any) => generateReport(event.key)">
              <a-menu-item key="seals">密封圈计算报告</a-menu-item>
              <a-menu-item key="bearings">轴承选型报告</a-menu-item>
              <a-menu-item key="bolts">螺栓连接报告</a-menu-item>
              <a-menu-item key="param-scan">参数扫描分析报告</a-menu-item>
              <a-menu-item key="monte-carlo">蒙特卡洛模拟报告</a-menu-item>
              <a-menu-item key="material-sub">材料代换报告</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-space>
    </PageToolbar>

    <PageSyncStatus
      :loading="loading"
      :has-loaded="hasLoadedOnce"
      :last-synced-at="lastSyncedAt"
      :error="syncError"
      loading-label="正在刷新报告、审批与正式结果"
      initial-label="正在准备报告工作台"
    >
      <a-space wrap size="small">
        <a-tag>报告 {{ reports.length }}</a-tag>
        <a-tag>运行 {{ workflowInsights.runs.length }}</a-tag>
        <a-tag>结果 {{ workflowInsights.results.length }}</a-tag>
      </a-space>
    </PageSyncStatus>

    <PageLoadingState
      v-if="loading && !hasLoadedOnce"
      title="正在准备报告工作台"
      description="正在加载报告索引、审批状态、正式结果链和修订治理摘要。"
      :side-cards="4"
      :main-cards="2"
    />

    <div v-else class="content-body" :class="{ 'is-refreshing': loading }">
      <ToolPageLayout :input-span="8" :output-span="16">
        <template #side>
          <a-card title="报告概览" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="报告总数" :value="reportStats.total" /></a-col>
              <a-col :span="12"><a-statistic title="当前筛选" :value="reportStats.filtered" /></a-col>
              <a-col :span="12"><a-statistic title="PDF 报告" :value="reportStats.pdf" /></a-col>
              <a-col :span="12"><a-statistic title="导出记录" :value="reportStats.exports" /></a-col>
              <a-col :span="12"><a-statistic title="当前项目关联" :value="reportStats.linkedToActiveProject" /></a-col>
              <a-col :span="12"><a-statistic title="评审中" :value="reportStats.inReview" /></a-col>
              <a-col :span="12"><a-statistic title="已绑正式结果" :value="reportStats.linkedFormal" /></a-col>
              <a-col :span="12"><a-statistic title="需复核结果" :value="reportStats.linkedWarning" /></a-col>
              <a-col :span="12"><a-statistic title="异常结果" :value="reportStats.linkedError" /></a-col>
              <a-col :span="12"><a-statistic title="变更单" :value="reportStats.changeCases" /></a-col>
              <a-col :span="12"><a-statistic title="待批任务" :value="reportStats.pendingApprovals" /></a-col>
              <a-col :span="12"><a-statistic title="文档附件" :value="reportStats.attachments" /></a-col>
              <a-col :span="24">
                <div class="section-note" style="margin-top: 0">
                  最近报告：{{ latestReport ? `${latestReport.title} · ${getWorkflowStatusLabel(latestReport.workflowStatus)}` : '暂无' }}
                </div>
              </a-col>
            </a-row>
          </a-card>

          <a-card title="活动项目" size="small">
            <StateEmpty v-if="!activeProject" description="暂无活动项目" />
            <a-descriptions v-else bordered size="small" :column="1">
              <a-descriptions-item label="项目名称">{{ activeProject.name }}</a-descriptions-item>
              <a-descriptions-item label="项目模块">{{ getReportModuleMeta(activeProject.module).label }}</a-descriptions-item>
              <a-descriptions-item label="项目摘要">{{ activeProject.inputSummary || '尚未写入摘要' }}</a-descriptions-item>
              <a-descriptions-item label="项目待批报告">
                {{ filteredReports.filter((report) => report.projectId === activeProject?.id).reduce((sum, report) => sum + getPendingApprovalsByReport(report).length, 0) }}
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card title="修订治理总览" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="修订链" :value="reportGovernanceSnapshot.rootChains" /></a-col>
              <a-col :span="12"><a-statistic title="冻结基线" :value="reportGovernanceSnapshot.frozenNodes" /></a-col>
              <a-col :span="12"><a-statistic title="滞后修订" :value="reportGovernanceSnapshot.staleNodes" /></a-col>
              <a-col :span="12"><a-statistic title="一致性告警" :value="reportGovernanceSnapshot.inconsistentNodes" /></a-col>
            </a-row>
            <a-row :gutter="[12, 12]" style="margin-top: 12px">
              <a-col v-for="metric in reportGovernanceMetrics" :key="metric.label" :span="8">
                <a-statistic :title="metric.label" :value="metric.value" />
              </a-col>
            </a-row>
            <a-row :gutter="[12, 12]" style="margin-top: 12px">
              <a-col v-for="metric in reportGovernanceHealthMetrics" :key="metric.label" :span="12">
                <a-statistic :title="metric.label" :value="metric.value" :suffix="metric.suffix" />
              </a-col>
            </a-row>
            <div v-if="reportGovernanceSnapshot.alerts.length" class="trace-lineage-list">
              <article
                v-for="alert in reportGovernanceSnapshot.alerts.slice(0, 4)"
                :key="`${alert.nodeId}-${alert.summary}`"
                class="trace-lineage-item"
              >
                <strong>{{ alert.summary }}</strong>
                <span>{{ alert.title }} · {{ alert.recommendation }}</span>
                <a-space wrap>
                  <a-tag :color="getRevisionGovernanceCategoryMeta(alert.category).color">{{ getRevisionGovernanceCategoryMeta(alert.category).label }}</a-tag>
                  <a-tag :color="getRevisionGovernancePriorityMeta(alert.priority).color">{{ getRevisionGovernancePriorityMeta(alert.priority).label }}</a-tag>
                  <a-tag :color="getRevisionGovernanceRepairabilityMeta(alert.repairability).color">{{ getRevisionGovernanceRepairabilityMeta(alert.repairability).label }}</a-tag>
                  <a-button type="link" size="small" @click="openGovernanceRoute(alert.routePath)">打开对象页</a-button>
                  <a-button
                    v-if="alert.suggestedRoutePath && alert.suggestedAction === 'inspect-latest'"
                    type="link"
                    size="small"
                    @click="openGovernanceRoute(alert.suggestedRoutePath)"
                  >
                    查看最新修订 {{ alert.suggestedRevisionCode || '' }}
                  </a-button>
                  <a-button
                    v-if="alert.suggestedNodeId && alert.suggestedAction === 'inspect-latest'"
                    type="link"
                    size="small"
                    @click="deriveGovernanceSuggested(alert)"
                  >
                    派生最新工作副本
                  </a-button>
                </a-space>
              </article>
            </div>
            <StateEmpty v-else description="当前筛选范围内没有显式的修订治理告警" />
          </a-card>

          <a-card title="筛选条件" size="small">
            <div class="filter-stack">
              <a-form-item label="只看当前项目">
                <a-switch v-model:checked="activeProjectOnly" :disabled="!activeProject" />
              </a-form-item>
              <a-form-item label="按模块">
                <a-select v-model:value="selectedModule" :options="[{ value: 'all', label: '全部模块' }, ...moduleOptions]" />
              </a-form-item>
              <a-form-item label="按类型">
                <a-select
                  v-model:value="selectedType"
                  :options="[
                    { value: 'all', label: '全部类型' },
                    { value: 'pdf', label: 'PDF' },
                    { value: 'csv', label: 'CSV' },
                    { value: 'json', label: 'JSON' }
                  ]"
                />
              </a-form-item>
              <a-form-item label="按来源">
                <a-select
                  v-model:value="selectedSource"
                  :options="[{ value: 'all', label: '全部来源' }, ...sourceOptions]"
                />
              </a-form-item>
              <a-form-item label="按阶段">
                <a-select
                  v-model:value="selectedWorkflowStatus"
                  :options="[
                    { value: 'all', label: '全部阶段' },
                    { value: 'draft', label: '草稿' },
                    { value: 'in-review', label: '评审中' },
                    { value: 'approved', label: '已批准' },
                    { value: 'released', label: '已发布' },
                    { value: 'archived', label: '已归档' }
                  ]"
                />
              </a-form-item>
              <a-form-item label="正式链路">
                <a-select
                  v-model:value="selectedFormalLink"
                  :options="[
                    { value: 'all', label: '全部' },
                    { value: 'linked', label: '已绑定正式对象' },
                    { value: 'unlinked', label: '未绑定正式对象' }
                  ]"
                />
              </a-form-item>
              <a-form-item label="结果状态">
                <a-select
                  v-model:value="selectedResultStatus"
                  :options="[
                    { value: 'all', label: '全部状态' },
                    { value: 'computed', label: '已计算' },
                    { value: 'warning', label: '需复核' },
                    { value: 'error', label: '异常' },
                    { value: 'archived', label: '已归档' },
                    { value: 'missing', label: '未绑定结果' }
                  ]"
                />
              </a-form-item>
              <a-button size="small" @click="resetFilters">重置筛选</a-button>
            </div>
          </a-card>

          <a-card title="待归档线索" size="small">
            <StateEmpty v-if="!activeProject || pendingArchiveHints.length === 0" description="当前没有待归档线索" />
            <a-list v-else :data-source="pendingArchiveHints" size="small">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta>
                    <template #title>{{ item.name }}</template>
                    <template #description>
                      {{ getReportModuleMeta(item.module).label }} · {{ new Date(item.createdAt).toLocaleString() }}
                    </template>
                  </a-list-item-meta>
                  <a-button type="link" size="small" @click="openModule(item.module)">打开模块</a-button>
                </a-list-item>
              </template>
            </a-list>
          </a-card>

          <CalculationDecisionPanel
            title="归档判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
        </template>

        <template #main>
          <AlertStack :items="pageAlerts" />

          <StateEmpty
            v-if="filteredReports.length === 0"
            :icon="FileTextOutlined"
            :description="reports.length === 0 ? '暂无报告，点击生成新报告开始' : '当前筛选条件下没有报告记录'"
          />

          <a-card v-else title="历史报告" size="small">
            <a-table
              :columns="[
                { title: '报告名称', dataIndex: 'title', key: 'title', width: '30%' },
                { title: '模块', dataIndex: 'module', key: 'module', width: '14%' },
                { title: '来源', dataIndex: 'sourceKind', key: 'sourceKind', width: '10%' },
                { title: '阶段', dataIndex: 'workflowStatus', key: 'workflowStatus', width: '10%' },
                { title: '修订', dataIndex: 'revisionCode', key: 'revisionCode', width: '7%' },
                { title: '正式链路', key: 'formalLink', width: '12%' },
                { title: '编号', dataIndex: 'projectNumber', key: 'projectNumber', width: '16%' },
                { title: '生成时间', dataIndex: 'createdAt', key: 'createdAt', width: '16%' },
                { title: '类型', dataIndex: 'type', key: 'type', width: '7%' },
                { title: '操作', key: 'actions', width: '18%' }
              ]"
              :data-source="filteredReports"
              :pagination="{ pageSize: 10 }"
              size="small"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'module'">
                  <a-tag color="blue">{{ getReportModuleMeta(record.module).label }}</a-tag>
                </template>
                <template v-else-if="column.key === 'sourceKind'">
                  <a-tag :color="getReportSourceMeta(record.sourceKind).color">
                    {{ getReportSourceMeta(record.sourceKind).label }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'createdAt'">
                  {{ new Date(record.createdAt).toLocaleString() }}
                </template>
                <template v-else-if="column.key === 'workflowStatus'">
                  <a-space wrap size="small">
                    <a-tag :color="getWorkflowStatusColor(record.workflowStatus)">
                      {{ getWorkflowStatusLabel(record.workflowStatus) }}
                    </a-tag>
                    <a-tag :color="resolveWorkflowFreezeState(record.workflowStatus).color">
                      {{ resolveWorkflowFreezeState(record.workflowStatus).label }}
                    </a-tag>
                  </a-space>
                </template>
                <template v-else-if="column.key === 'type'">
                  <a-tag size="small">{{ record.type.toUpperCase() }}</a-tag>
                </template>
                <template v-else-if="column.key === 'formalLink'">
                  <div class="report-project-cell">
                    <strong>{{ getReportLinkSummaryRow(record) }}</strong>
                    <span v-if="getResultStateByReportRow(record)">
                      {{ getResultStateByReportRow(record)?.resultKind }} / {{ getResultStatusLabel(getResultStateByReportRow(record)!.status) }}
                    </span>
                    <span v-else>未绑定结果状态</span>
                    <span v-if="getPendingApprovalsByReportRow(record).length">
                      待批 {{ getPendingApprovalsByReportRow(record).length }} · 变更 {{ getChangeCasesByReportRow(record).length }}
                    </span>
                    <span v-if="getDocumentAttachmentsByReportRow(record).length">
                      文档 {{ getDocumentAttachmentsByReportRow(record).length }}
                    </span>
                    <a-tag
                      v-if="getResultStateByReportRow(record)"
                      size="small"
                      :color="getResultStatusColor(getResultStateByReportRow(record)!.status)"
                    >
                      {{ getResultStatusLabel(getResultStateByReportRow(record)!.status) }}
                    </a-tag>
                  </div>
                </template>
                <template v-else-if="column.key === 'projectNumber'">
                  <div class="report-project-cell">
                    <strong>{{ record.projectName || '未绑定项目' }}</strong>
                    <span>{{ record.projectNumber || '未编号' }}</span>
                  </div>
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-space>
                    <a-button type="link" size="small" @click="previewReportRow(record)">
                      <template #icon><EyeOutlined /></template>预览
                    </a-button>
                    <a-button type="link" size="small" @click="openTraceModalRow(record)">
                      <template #icon><ApartmentOutlined /></template>查看链路
                    </a-button>
                    <a-button type="link" size="small" @click="exportPDFRow(record)">
                      <template #icon><DownloadOutlined /></template>导出
                    </a-button>
                    <a-button type="link" size="small" @click="deriveReportRevisionRow(record)">
                      派生修订
                    </a-button>
                    <a-button type="link" size="small" :disabled="!canAdvanceWorkflowStatus(record.workflowStatus)" @click="advanceWorkflowStatus(record.id)">
                      推进阶段
                    </a-button>
                    <a-button type="link" size="small" @click="openReportSourceRow(record)">
                      <template #icon><ArrowRightOutlined /></template>回到模块
                    </a-button>
                    <a-button type="link" danger size="small" :disabled="!canDeleteWorkflowRecord(record.workflowStatus)" @click="deleteReport(record.id)">
                      <template #icon><DeleteOutlined /></template>删除
                    </a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-card>
        </template>
      </ToolPageLayout>
    </div>

    <a-modal
      v-model:open="showPreviewModal"
      title="报告预览"
      width="860px"
      @cancel="closePreview"
    >
      <pre class="report-preview">{{ previewContent }}</pre>
      <div v-if="previewingReport" class="section-note">
        当前报告冻结状态：{{ resolveWorkflowFreezeState(previewingReport.workflowStatus).label }}。{{ resolveWorkflowFreezeState(previewingReport.workflowStatus).description }}
      </div>
      <template #footer>
        <a-space>
          <a-button @click="closePreview">关闭</a-button>
          <a-button type="primary" :disabled="!previewingReport" @click="previewingReport && exportPDF(previewingReport)">
            <template #icon><DownloadOutlined /></template>导出 PDF
          </a-button>
        </a-space>
      </template>
    </a-modal>

    <a-modal
      v-model:open="showTraceModal"
      title="正式链路详情"
      width="920px"
      @cancel="closeTraceModal"
    >
      <StateEmpty
        v-if="!traceReport"
        description="当前没有可查看的正式链路"
      />
      <template v-else>
        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item label="报告">{{ traceReport.title }}</a-descriptions-item>
          <a-descriptions-item label="模块">{{ getReportModuleMeta(traceReport.module).label }}</a-descriptions-item>
          <a-descriptions-item label="派生来源">
            {{ traceReport.derivationMeta?.derivedFromReportId || '无' }}
          </a-descriptions-item>
          <a-descriptions-item label="冻结引用">
            {{ traceReport.derivationMeta?.referenceLock ? `${traceReport.derivationMeta.referenceLock.sourceObjectType || 'report'} / ${traceReport.derivationMeta.referenceLock.sourceRevisionCode || 'A'}` : '无' }}
          </a-descriptions-item>
          <a-descriptions-item label="运行记录">{{ traceRun?.name || traceReport.linkedRunId || '未绑定' }}</a-descriptions-item>
          <a-descriptions-item label="结果对象">
            <a-space v-if="traceResult">
              <span>{{ traceResult.resultKind }}</span>
              <a-tag :color="getResultStatusColor(traceResult.status)">{{ getResultStatusLabel(traceResult.status) }}</a-tag>
            </a-space>
            <span v-else>{{ traceReport.linkedResultId || '未绑定' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="运行摘要" :span="2">
            {{ traceRun?.summary || '无运行摘要' }}
          </a-descriptions-item>
          <a-descriptions-item label="结果摘要" :span="2">
            {{ traceResult?.summary || '无结果摘要' }}
          </a-descriptions-item>
          <a-descriptions-item v-if="traceReport.derivationMeta?.derivationNote" label="派生说明" :span="2">
            {{ traceReport.derivationMeta.derivationNote }}
          </a-descriptions-item>
        </a-descriptions>

        <a-card title="场景快照" size="small" style="margin-top: 16px">
          <StateEmpty v-if="traceSnapshots.length === 0" description="当前运行没有保存场景快照" />
          <a-timeline v-else>
            <a-timeline-item v-for="snapshot in traceSnapshots" :key="snapshot.id">
              <strong>{{ snapshot.snapshotKind }}</strong>
              <div>{{ snapshot.title || '未命名快照' }}</div>
              <div class="report-trace-meta">{{ snapshot.summary || '无摘要' }}</div>
            </a-timeline-item>
          </a-timeline>
        </a-card>

        <a-card title="变更与审批" size="small" style="margin-top: 16px">
          <a-row :gutter="[12, 12]">
            <a-col :span="8"><a-statistic title="变更单" :value="traceChanges.length" /></a-col>
            <a-col :span="8"><a-statistic title="审批任务" :value="traceApprovals.length" /></a-col>
            <a-col :span="8"><a-statistic title="事件日志" :value="traceEvents.length" /></a-col>
          </a-row>
          <div class="section-note">
            当前报告已经进入变更单、审批任务和事件日志的最小闭环。
          </div>
          <a-timeline v-if="traceChanges.length || traceApprovals.length || traceEvents.length" style="margin-top: 12px">
            <a-timeline-item v-for="change in traceChanges.slice(0, 3)" :key="change.id">
              <strong>变更</strong> {{ change.title }}
              <div class="report-trace-meta">{{ getChangeCaseStatusLabel(change.status) }} · {{ new Date(change.requestedAt).toLocaleString() }}</div>
            </a-timeline-item>
            <a-timeline-item v-for="task in traceApprovals.slice(0, 3)" :key="task.id">
              <strong>审批</strong> {{ task.title }}
              <div class="report-trace-meta">{{ task.decisionStatus }} · {{ new Date(task.updatedAt).toLocaleString() }}</div>
            </a-timeline-item>
            <a-timeline-item v-for="event in traceEvents.slice(0, 4)" :key="event.id">
              <strong>事件</strong> {{ event.summary }}
              <div class="report-trace-meta">{{ new Date(event.eventAt).toLocaleString() }}</div>
            </a-timeline-item>
          </a-timeline>
          <StateEmpty v-else description="当前报告还没有变更与审批记录" />
        </a-card>

        <a-card title="修订链与一致性" size="small" style="margin-top: 16px">
          <a-row :gutter="[12, 12]">
            <a-col :span="8"><a-statistic title="祖先链" :value="Math.max(traceRevisionLineage.ancestry.length - 1, 0)" /></a-col>
            <a-col :span="8"><a-statistic title="直接下游" :value="traceRevisionLineage.children.length" /></a-col>
            <a-col :span="8"><a-statistic title="全链后代" :value="traceRevisionLineage.descendants.length" /></a-col>
          </a-row>
          <div v-if="traceRevisionLineage.ancestry.length" class="trace-lineage-list">
            <article
              v-for="node in traceRevisionLineage.ancestry"
              :key="node.id"
              class="trace-lineage-item"
            >
              <strong>{{ node.title }}</strong>
              <span>修订 {{ node.revisionCode || 'A' }} · {{ node.status || '未标注状态' }}</span>
            </article>
          </div>
          <StateEmpty v-else description="当前报告没有可识别的修订祖先链" />
          <div class="trace-lineage-list" style="margin-top: 12px">
            <article
              v-for="check in traceRevisionLineage.consistencyChecks"
              :key="`${check.level}-${check.summary}`"
              class="trace-lineage-item"
            >
              <strong>{{ check.level === 'warning' ? '警告' : '信息' }} · {{ check.summary }}</strong>
              <span>{{ check.detail }}</span>
            </article>
          </div>
        </a-card>

        <a-card title="文档附件" size="small" style="margin-top: 16px">
          <StateEmpty v-if="traceAttachments.length === 0" description="当前报告还没有登记的文档附件" />
          <a-list v-else :data-source="traceAttachments" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta>
                  <template #title>{{ item.title }}</template>
                  <template #description>
                    {{ item.documentKind.toUpperCase() }} · {{ item.fileName || '未命名文件' }} · {{ new Date(item.createdAt).toLocaleString() }}
                  </template>
                </a-list-item-meta>
                <a-tag>{{ item.status || 'generated' }}</a-tag>
              </a-list-item>
            </template>
          </a-list>
        </a-card>

        <a-row :gutter="16" style="margin-top: 16px">
          <a-col :span="12">
            <a-card title="运行输出摘要" size="small">
              <pre class="report-trace-json">{{ JSON.stringify(traceRun?.outputData ?? traceRun?.inputData ?? {}, null, 2) }}</pre>
            </a-card>
          </a-col>
          <a-col :span="12">
            <a-card title="结果对象摘要" size="small">
              <pre class="report-trace-json">{{ JSON.stringify(traceResult?.outputData ?? traceResult?.derivedMetrics ?? {}, null, 2) }}</pre>
            </a-card>
          </a-col>
        </a-row>
      </template>
      <template #footer>
        <a-space>
          <a-button @click="closeTraceModal">关闭</a-button>
          <a-button type="primary" :disabled="!traceReport" @click="traceReport && openReportSource(traceReport)">
            <template #icon><ArrowRightOutlined /></template>打开来源模块
          </a-button>
        </a-space>
      </template>
    </a-modal>
  </div>
</template>

<style scoped>
.report-center-page {
  max-width: 1320px;
  margin: 0 auto;
}

.filter-stack {
  display: grid;
  gap: 8px;
}

.report-project-cell {
  display: grid;
  gap: 2px;
}

.report-project-cell span {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.report-preview {
  background: #f8fafc;
  padding: 20px;
  border-radius: 12px;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  max-height: 500px;
  overflow-y: auto;
  white-space: pre-wrap;
  color: #0f172a;
}

.report-trace-meta {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.report-trace-json {
  background: #f8fafc;
  padding: 12px;
  border-radius: 10px;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  color: #0f172a;
}

.trace-lineage-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.trace-lineage-item {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--content-border);
  border-radius: 12px;
  background: var(--surface-raised);
}

.trace-lineage-item span {
  color: var(--text-secondary, #64748b);
  font-size: 12px;
  line-height: 1.6;
}
</style>
