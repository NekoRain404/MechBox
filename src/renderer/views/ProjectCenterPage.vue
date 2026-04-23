<script setup lang="ts">
/**
 * ProjectCenterPage - 项目中心页面
 * 项目保存/打开/管理，版本追踪
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import PageLoadingState from '../components/PageLoadingState.vue'
import PageSyncStatus from '../components/PageSyncStatus.vue'
import StateEmpty from '../components/StateEmpty.vue'
import { useAppFeedback } from '../composables/useAppFeedback'
import { moduleRouteMap } from '../router/route-meta'
import { useStandardStore } from '../store/useStandardStore'
import {
  appendStoredReport,
  REPORTS_STORAGE_EVENT,
  isReportLinkedToProject,
  loadStoredReports,
  mergeStoredReports,
  normalizeReportRecords,
  saveStoredReports,
  type ReportRecord,
  upsertStoredReportDerivationMeta,
} from '../utils/reporting'
import {
  createWorkspaceProject,
  fetchWorkspaceSnapshot,
  loadActiveProject,
  loadStoredProjects,
  removeStoredProject,
  saveActiveProject,
  saveStoredProjects,
  upsertStoredProject,
  WORKSPACE_STORAGE_EVENT,
  type WorkspaceProject,
  updateStoredProject,
} from '../utils/workspace'
import {
  PlusOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ImportOutlined,
  InboxOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { WORKFLOW_ARTIFACTS_EVENT, importWorkflowArtifactBundles, type WorkflowArtifactBundle } from '../utils/workflow-artifacts'
import { buildWorkflowProjectInsight, fetchWorkflowInsights } from '../utils/workflow-insights'
import { listBomDrafts, loadLatestBomDraft, saveBomDraft } from '../utils/bomDrafts'
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
  notifyEngineeringLibraryUpdated,
  upsertDocumentAttachment,
  upsertPartMaster,
  upsertSupplierPart,
  type EngineeringLibrarySnapshot,
} from '../utils/engineering-library'
import {
  canActivateProjectWorkspace,
  canAdvanceWorkflowStatus,
  canDeleteWorkflowRecord,
  resolveWorkflowFreezeState,
} from '../utils/governance-freeze'
import {
  buildDerivationNote,
  buildDerivedFileName,
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
import { APP_VERSION, DEFAULT_PROJECT_VERSION, RULESET_VERSION, WORKSPACE_PACKAGE_FORMAT_VERSION } from '@shared/app-meta'

const projects = ref<WorkspaceProject[]>([])
const activeProject = ref<WorkspaceProject | null>(null)
const loading = ref(false)
const hasLoadedOnce = ref(false)
const lastSyncedAt = ref<string | null>(null)
const syncError = ref('')
const showNewProjectModal = ref(false)
const newProjectName = ref('')
const selectedModule = ref('seals')
const importInputRef = ref<HTMLInputElement | null>(null)
const router = useRouter()
const store = useStandardStore()
const feedback = useAppFeedback()
const lifecycleOrder: WorkspaceProject['lifecycleStatus'][] = ['draft', 'in-review', 'approved', 'released', 'archived']

const moduleLabels: Record<string, string> = {
  seals: '密封圈',
  bearings: '轴承',
  bolts: '螺栓',
  tolerances: '公差配合',
  'param-scan': '参数扫描',
  'monte-carlo': '蒙特卡洛',
  'bom-export': 'BOM 导出',
  'material-sub': '材料代换',
}

const lifecycleLabels: Record<WorkspaceProject['lifecycleStatus'], string> = {
  draft: '草稿',
  'in-review': '评审中',
  approved: '已批准',
  released: '已发布',
  archived: '已归档',
}

const lifecycleColors: Record<WorkspaceProject['lifecycleStatus'], string> = {
  draft: 'default',
  'in-review': 'orange',
  approved: 'blue',
  released: 'green',
  archived: 'default',
}
const workflowInsightSnapshot = ref<Awaited<ReturnType<typeof fetchWorkflowInsights>>>({
  runs: [],
  results: [],
  snapshots: [],
})
const changeControlSnapshot = ref<ChangeControlSnapshot>({
  changes: [],
  approvals: [],
  events: [],
})
const engineeringLibrarySnapshot = ref<EngineeringLibrarySnapshot>({
  partMasters: [],
  supplierParts: [],
  bomRevisionLinks: [],
  documentAttachments: [],
})
const showReleasePanelModal = ref(false)
const releaseProject = ref<WorkspaceProject | null>(null)
const releasePanelLoading = ref(false)
const releasePanelBomDraft = ref<Awaited<ReturnType<typeof loadLatestBomDraft>> | null>(null)
let workspaceSyncRequestId = 0

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

async function syncWorkspaceState(options: { silent?: boolean } = {}) {
  const requestId = ++workspaceSyncRequestId
  loading.value = true

  try {
    const [snapshot, workflowSnapshot, changeSnapshot, engineeringSnapshot] = await Promise.all([
      fetchWorkspaceSnapshot(),
      fetchWorkflowInsights({ runLimit: 200, resultLimit: 320, snapshotLimit: 320 }),
      fetchChangeControlSnapshot({ changeLimit: 200, approvalLimit: 320, eventLimit: 420 }),
      fetchEngineeringLibrarySnapshot(),
    ])

    if (requestId !== workspaceSyncRequestId) return

    projects.value = snapshot.projects
    activeProject.value = snapshot.activeProject
    reports.value = loadStoredReports()
    workflowInsightSnapshot.value = workflowSnapshot
    changeControlSnapshot.value = changeSnapshot
    engineeringLibrarySnapshot.value = engineeringSnapshot
    lastSyncedAt.value = new Date().toISOString()
    syncError.value = ''
  } catch (error) {
    if (requestId !== workspaceSyncRequestId) return

    syncError.value = getErrorMessage(error, '项目工作台同步失败')
    if (!options.silent) {
      feedback.error(syncError.value)
    }
  } finally {
    if (requestId === workspaceSyncRequestId) {
      loading.value = false
      hasLoadedOnce.value = true
    }
  }
}

function isWorkspaceProjectRecord(record: unknown): record is WorkspaceProject {
  return Boolean(record && typeof record === 'object' && 'id' in record && 'module' in record && 'lifecycleStatus' in record)
}

function openProjectRow(record: unknown) {
  if (!isWorkspaceProjectRecord(record)) return
  openProject(record)
}

function toggleArchiveRow(record: unknown) {
  if (!isWorkspaceProjectRecord(record)) return
  void toggleArchive(record)
}

function advanceLifecycleRow(record: unknown) {
  if (!isWorkspaceProjectRecord(record)) return
  void advanceLifecycle(record)
}

function exportProjectRow(record: unknown) {
  if (!isWorkspaceProjectRecord(record)) return
  void exportProject(record)
}

function openReleasePanelRow(record: unknown) {
  if (!isWorkspaceProjectRecord(record)) return
  void openReleasePanel(record)
}

function exportProjectReleaseBriefRow(record: unknown) {
  if (!isWorkspaceProjectRecord(record)) return
  exportProjectReleaseBrief(record)
}

function exportProjectFreezeSnapshotRow(record: unknown) {
  if (!isWorkspaceProjectRecord(record)) return
  void exportProjectFreezeSnapshot(record)
}

function deriveProjectRevisionRow(record: unknown) {
  if (!isWorkspaceProjectRecord(record)) return
  void deriveProjectRevision(record)
}

const projectStats = computed(() => ({
  total: projects.value.length,
  active: projects.value.filter((project) => project.status === 'active').length,
  archived: projects.value.filter((project) => project.status === 'archived').length,
}))

const reports = ref(loadStoredReports())

function buildProjectChangeStats(project: WorkspaceProject) {
  const changes = filterChangeCasesByObject('project', project.id, changeControlSnapshot.value)
  const approvals = filterApprovalTasksByObject('project', project.id, changeControlSnapshot.value)
  const events = filterObjectEventsByObject('project', project.id, changeControlSnapshot.value)
  const pendingApprovalCount = approvals.filter((item) => item.decisionStatus === 'pending').length
  const openChangeCount = changes.filter(
    (item) => item.status !== 'released' && item.status !== 'archived' && item.status !== 'rejected' && item.status !== 'approved',
  ).length
  return {
    changeCount: changes.length,
    openChangeCount,
    approvalCount: approvals.length,
    pendingApprovalCount,
    eventCount: events.length,
    latestChangeStatus: changes[0]?.status,
  }
}

function buildProjectEngineeringStats(project: WorkspaceProject) {
  const partMasters = engineeringLibrarySnapshot.value.partMasters.filter((item) => item.projectId === project.id)
  const partIds = new Set(partMasters.map((item) => item.id))
  const supplierParts = engineeringLibrarySnapshot.value.supplierParts.filter((item) => partIds.has(item.partId))
  const attachments = engineeringLibrarySnapshot.value.documentAttachments.filter((item) => item.projectId === project.id)
  const bomIds = new Set(
    attachments
      .filter((item) => item.objectType === 'bom')
      .map((item) => item.objectId),
  )
  const bomRevisionLinks = engineeringLibrarySnapshot.value.bomRevisionLinks.filter((item) => bomIds.has(item.bomId))
  return {
    partCount: partMasters.length,
    supplierPartCount: supplierParts.length,
    attachmentCount: attachments.length,
    bomRevisionCount: bomRevisionLinks.length,
    releasedAttachmentCount: attachments.filter((item) => item.status === 'released').length,
  }
}

function buildProjectReleaseStats(project: WorkspaceProject) {
  const engineering = buildProjectEngineeringStats(project)
  const changeControl = buildProjectChangeStats(project)
  const reportCount = getProjectReportCount(project)
  const workflowInsight = buildWorkflowProjectInsight(project, workflowInsightSnapshot.value, reportCount)
  const hasReleasedDocuments = engineering.attachmentCount > 0 && engineering.attachmentCount === engineering.releasedAttachmentCount
  const hasFormalBaseline = engineering.attachmentCount > 0 && reportCount > 0 && workflowInsight.resultCount > 0
  const blockers = [
    ...(changeControl.pendingApprovalCount > 0 ? [`${changeControl.pendingApprovalCount} 条待批`] : []),
    ...(changeControl.openChangeCount > 0 ? [`${changeControl.openChangeCount} 条未闭环变更`] : []),
    ...(workflowInsight.errorCount > 0 ? [`${workflowInsight.errorCount} 条异常结果`] : []),
    ...(engineering.attachmentCount === 0 ? ['暂无受控文档'] : []),
    ...(engineering.attachmentCount > engineering.releasedAttachmentCount ? ['存在未发布文档'] : []),
    ...(reportCount === 0 ? ['暂无归档报告'] : []),
    ...(workflowInsight.resultCount === 0 ? ['暂无正式结果对象'] : []),
  ]
  const readinessStatus =
    changeControl.pendingApprovalCount > 0 || changeControl.openChangeCount > 0 || workflowInsight.errorCount > 0
      ? 'blocked'
      : !hasFormalBaseline || !hasReleasedDocuments
        ? 'warning'
        : 'ready'

  return {
    ...engineering,
    ...changeControl,
    ...workflowInsight,
    blockers,
    readinessStatus,
  }
}

const recentByModule = computed(() => {
  const groups = new Map<string, number>()
  for (const item of store.recentCalculations) {
    groups.set(item.module, (groups.get(item.module) ?? 0) + 1)
  }
  return Array.from(groups.entries()).map(([module, count]) => ({ module, count }))
})

function getProjectReportCount(project: WorkspaceProject) {
  return reports.value.filter((report) => isReportLinkedToProject(report, project)).length
}

function buildProjectCollections(project: WorkspaceProject) {
  const linkedReports = reports.value.filter((report) => isReportLinkedToProject(report, project))
  const workflowInsight = buildWorkflowProjectInsight(project, workflowInsightSnapshot.value, linkedReports.length)
  const projectRuns = workflowInsightSnapshot.value.runs.filter(
    (run) => run.projectId === project.id || run.projectName === project.name || run.projectNumber === project.id,
  )
  const runIds = new Set(projectRuns.map((run) => run.id))
  const projectResults = workflowInsightSnapshot.value.results.filter((result) => runIds.has(result.runId))
  const projectSnapshots = workflowInsightSnapshot.value.snapshots.filter((snapshot) => runIds.has(snapshot.runId))
  const artifactBundles: WorkflowArtifactBundle[] = projectRuns.map((run) => ({
    run,
    results: projectResults.filter((result) => result.runId === run.id),
    snapshots: projectSnapshots.filter((snapshot) => snapshot.runId === run.id),
  }))
  const moduleReports = reports.value
    .filter((report) => !isReportLinkedToProject(report, project) && report.module === project.module)
    .slice(0, 10)
  const projectPartMasters = engineeringLibrarySnapshot.value.partMasters.filter((item) => item.projectId === project.id)
  const projectDocumentAttachments = engineeringLibrarySnapshot.value.documentAttachments.filter((item) => item.projectId === project.id)
  const projectPartIds = new Set(projectPartMasters.map((item) => item.id))
  const projectSupplierParts = engineeringLibrarySnapshot.value.supplierParts.filter((item) => projectPartIds.has(item.partId))
  const projectBomIds = new Set(
    projectDocumentAttachments
      .filter((item) => item.objectType === 'bom')
      .map((item) => item.objectId),
  )
  const projectBomRevisionLinks = engineeringLibrarySnapshot.value.bomRevisionLinks.filter((item) => projectBomIds.has(item.bomId))
  const projectChangeCases = changeControlSnapshot.value.changes.filter(
    (item) => item.projectId === project.id || (item.objectType === 'project' && item.objectId === project.id),
  )
  const projectApprovalTasks = changeControlSnapshot.value.approvals.filter(
    (item) => item.projectId === project.id || (item.objectType === 'project' && item.objectId === project.id),
  )
  const projectEventLogs = changeControlSnapshot.value.events.filter(
    (item) => item.projectId === project.id || (item.objectType === 'project' && item.objectId === project.id),
  )

  return {
    linkedReports,
    moduleReports,
    workflowInsight,
    projectRuns,
    projectResults,
    projectSnapshots,
    artifactBundles,
    projectPartMasters,
    projectSupplierParts,
    projectBomRevisionLinks,
    projectDocumentAttachments,
    projectChangeCases,
    projectApprovalTasks,
    projectEventLogs,
  }
}

function buildReleaseChecks(
  project: WorkspaceProject,
  linkedBomDraft: Awaited<ReturnType<typeof loadLatestBomDraft>> | null,
) {
  const release = buildProjectReleaseStats(project)
  const collections = buildProjectCollections(project)
  const changeControl = buildProjectChangeStats(project)

  return [
    {
      key: 'deliverables',
      label: '发布交付物',
      status:
        collections.linkedReports.length > 0 && collections.workflowInsight.resultCount > 0
          ? 'pass'
          : 'warning',
      description:
        collections.linkedReports.length > 0 && collections.workflowInsight.resultCount > 0
          ? `已具备 ${collections.linkedReports.length} 条归档报告和 ${collections.workflowInsight.resultCount} 条正式结果对象。`
          : '正式结果对象或归档报告仍不完整，发布说明链不够稳定。',
    },
    {
      key: 'documents',
      label: '文档冻结',
      status:
        release.attachmentCount === 0
          ? 'warning'
          : release.attachmentCount === release.releasedAttachmentCount
            ? 'pass'
            : 'warning',
      description:
        release.attachmentCount === 0
          ? '当前还没有受控文档附件。'
          : `已发布 ${release.releasedAttachmentCount} / ${release.attachmentCount} 份文档附件。`,
    },
    {
      key: 'workflow',
      label: '审批与变更',
      status:
        changeControl.pendingApprovalCount > 0 || changeControl.openChangeCount > 0
          ? 'blocked'
          : 'pass',
      description:
        changeControl.pendingApprovalCount > 0 || changeControl.openChangeCount > 0
          ? `当前还有 ${changeControl.pendingApprovalCount} 条待批、${changeControl.openChangeCount} 条未闭环变更。`
          : '当前没有未闭环审批或变更阻塞。',
    },
    {
      key: 'bom',
      label: 'BOM 冻结',
      status:
        release.bomRevisionCount > 0 || linkedBomDraft
          ? 'pass'
          : 'warning',
      description:
        release.bomRevisionCount > 0
          ? `已形成 ${release.bomRevisionCount} 条 BOM 修订链。`
          : linkedBomDraft
            ? '已存在最近 BOM 草稿，但还没有正式修订链。'
            : '当前没有 BOM 草稿或正式修订链。',
    },
  ] as Array<{ key: string; label: string; status: 'pass' | 'warning' | 'blocked'; description: string }>
}

const activeProjectSummary = computed(() => {
  if (!activeProject.value) return null
  const project = activeProject.value

  const favoriteCount = store.favorites.filter((item) => item.module === project.module).length
  const recentCount = store.recentCalculations.filter((item) => item.module === project.module).length
  const reportCount = getProjectReportCount(project)
  const workflowInsight = buildWorkflowProjectInsight(project, workflowInsightSnapshot.value, reportCount)

  return {
    favoriteCount,
    recentCount,
    reportCount,
    workflowInsight,
    changeControl: buildProjectChangeStats(project),
    engineering: buildProjectEngineeringStats(project),
    release: buildProjectReleaseStats(project),
  }
})

const projectRows = computed(() =>
  projects.value.map((project) => {
    const changeControl = buildProjectChangeStats(project)
    const engineering = buildProjectEngineeringStats(project)
    const favoriteCount = store.favorites.filter((item) => item.module === project.module).length
    const recentCount = store.recentCalculations.filter((item) => item.module === project.module).length
    const reportCount = getProjectReportCount(project)
    const workflowInsight = buildWorkflowProjectInsight(project, workflowInsightSnapshot.value, reportCount)
    const release = buildProjectReleaseStats(project)
    return {
      ...project,
      favoriteCount,
      recentCount,
      reportCount,
      resultCount: workflowInsight.resultCount,
      snapshotCount: workflowInsight.snapshotCount,
      formalRunCount: workflowInsight.runCount,
      warningCount: workflowInsight.warningCount,
      errorCount: workflowInsight.errorCount,
      lastResultAt: workflowInsight.lastResultAt,
      changeCount: changeControl.changeCount,
      openChangeCount: changeControl.openChangeCount,
      pendingApprovalCount: changeControl.pendingApprovalCount,
      eventCount: changeControl.eventCount,
      partCount: engineering.partCount,
      attachmentCount: engineering.attachmentCount,
      bomRevisionCount: engineering.bomRevisionCount,
      releasedAttachmentCount: engineering.releasedAttachmentCount,
      releaseStatus: release.readinessStatus,
      releaseBlockers: release.blockers,
    }
  }),
)

const releaseOverview = computed(() => ({
  ready: projectRows.value.filter((item) => item.releaseStatus === 'ready').length,
  warning: projectRows.value.filter((item) => item.releaseStatus === 'warning').length,
  blocked: projectRows.value.filter((item) => item.releaseStatus === 'blocked').length,
}))
const frozenProjectCount = computed(() =>
  projects.value.filter((project) => resolveWorkflowFreezeState(project.lifecycleStatus).isReadOnly).length,
)
const releasePanelData = computed(() => {
  if (!releaseProject.value) return null

  const project = releaseProject.value
  const collections = buildProjectCollections(project)
  const release = buildProjectReleaseStats(project)
  const changeControl = buildProjectChangeStats(project)
  const engineering = buildProjectEngineeringStats(project)

  return {
    project,
    release,
    changeControl,
    engineering,
    linkedBomDraft: releasePanelBomDraft.value,
    gateChecks: buildReleaseChecks(project, releasePanelBomDraft.value),
    pendingApprovals: collections.projectApprovalTasks
      .filter((item) => item.decisionStatus === 'pending')
      .slice(0, 8),
    abnormalResults: collections.projectResults
      .filter((item) => item.status === 'error' || item.status === 'warning')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 8),
    unreleasedDocuments: collections.projectDocumentAttachments
      .filter((item) => item.status !== 'released')
      .slice(0, 8),
    releasedDocuments: collections.projectDocumentAttachments
      .filter((item) => item.status === 'released')
      .slice(0, 8),
    linkedReports: collections.linkedReports.slice(0, 8),
    recentEvents: collections.projectEventLogs
      .sort((left, right) => right.eventAt.localeCompare(left.eventAt))
      .slice(0, 8),
  }
})
const releaseProjectLineage = computed(() => {
  const derivationMap = new Map<string, { parentId: string | null; referenceLock: Record<string, unknown> | null }>()

  for (const event of changeControlSnapshot.value.events) {
    if (event.objectType !== 'project' || event.payload == null || typeof event.payload !== 'object') continue
    const payload = event.payload as Record<string, unknown>
    const derivedFromProjectId =
      'derivedFromProjectId' in payload && typeof payload.derivedFromProjectId === 'string'
        ? payload.derivedFromProjectId
        : null
    const referenceLock =
      'referenceLock' in payload && payload.referenceLock && typeof payload.referenceLock === 'object'
        ? (payload.referenceLock as Record<string, unknown>)
        : null
    if (derivedFromProjectId) {
      derivationMap.set(event.objectId, {
        parentId: derivedFromProjectId,
        referenceLock,
      })
    }
  }

  return buildRevisionLineage(
    projects.value.map((project) => ({
      id: project.id,
      title: project.name,
      revisionCode: project.revisionCode,
      status: project.lifecycleStatus,
      updatedAt: project.updatedAt,
      parentId: derivationMap.get(project.id)?.parentId ?? null,
      referenceLock: derivationMap.get(project.id)?.referenceLock ?? null,
    })),
    releaseProject.value?.id ?? activeProject.value?.id ?? null,
    {
      freezeResolver: resolveWorkflowFreezeState,
      typeLabel: '项目',
    },
  )
})
const projectDerivationMap = computed(() => {
  const map = new Map<string, { parentId: string | null; referenceLock: Record<string, unknown> | null }>()
  for (const event of changeControlSnapshot.value.events) {
    if (event.objectType !== 'project' || event.payload == null || typeof event.payload !== 'object') continue
    const payload = event.payload as Record<string, unknown>
    const parentId =
      'derivedFromProjectId' in payload && typeof payload.derivedFromProjectId === 'string'
        ? payload.derivedFromProjectId
        : null
    const referenceLock =
      'referenceLock' in payload && payload.referenceLock && typeof payload.referenceLock === 'object'
        ? (payload.referenceLock as Record<string, unknown>)
        : null
    if (parentId) {
      map.set(event.objectId, { parentId, referenceLock })
    }
  }
  return map
})
const governanceSnapshot = computed(() =>
  analyzeRevisionGovernance(
    [
      ...projects.value.map((project) => ({
        id: project.id,
        title: project.name,
        revisionCode: project.revisionCode,
        status: project.lifecycleStatus,
        updatedAt: project.updatedAt,
        parentId: projectDerivationMap.value.get(project.id)?.parentId ?? null,
        referenceLock: projectDerivationMap.value.get(project.id)?.referenceLock ?? null,
        objectType: 'project' as const,
        projectId: project.id,
        routePath: '/projects',
      })),
      ...reports.value.map((report) => ({
        id: report.id,
        title: report.title,
        revisionCode: report.revisionCode,
        status: report.workflowStatus,
        updatedAt: report.createdAt,
        parentId: report.derivationMeta?.derivedFromReportId ?? null,
        referenceLock: report.derivationMeta?.referenceLock ?? null,
        objectType: 'report' as const,
        projectId: report.projectId ?? null,
        routePath: '/reports',
      })),
      ...engineeringLibrarySnapshot.value.documentAttachments.map((document) => {
        const payload = document.payload as Record<string, unknown> | null
        const parentId =
          payload && typeof payload === 'object' && 'derivedFromDocumentId' in payload && typeof payload.derivedFromDocumentId === 'string'
            ? payload.derivedFromDocumentId
            : null
        const referenceLock =
          payload && typeof payload === 'object' && 'referenceLock' in payload && payload.referenceLock && typeof payload.referenceLock === 'object'
            ? (payload.referenceLock as Record<string, unknown>)
            : null
        return {
          id: document.id,
          title: document.title,
          revisionCode: document.revisionCode,
          status: document.status,
          updatedAt: document.createdAt,
          parentId,
          referenceLock,
          objectType: 'document' as const,
          projectId: document.projectId ?? null,
          routePath: '/documents',
        }
      }),
    ],
    resolveWorkflowFreezeState,
  ),
)
const releasePanelGovernanceAlerts = computed(() => {
  if (!releaseProject.value) return []
  return governanceSnapshot.value.alerts.filter((alert) => {
    const node = [
      ...projects.value.map((project) => ({ id: project.id, projectId: project.id })),
      ...reports.value.map((report) => ({ id: report.id, projectId: report.projectId ?? null })),
      ...engineeringLibrarySnapshot.value.documentAttachments.map((document) => ({ id: document.id, projectId: document.projectId ?? null })),
    ].find((item) => item.id === alert.nodeId)
    return node?.projectId === releaseProject.value?.id
  })
})
const governanceExecutionMetrics = computed(() => [
  { label: '可直接修复', value: governanceSnapshot.value.repairableAlerts },
  { label: '需人工复核', value: governanceSnapshot.value.reviewAlerts },
  { label: '基线参考', value: governanceSnapshot.value.referenceAlerts },
])
const activeGovernanceProjectSummary = computed(() =>
  governanceSnapshot.value.projectSummaries.find((item) => item.projectId === (activeProject.value?.id ?? null)) ?? null,
)
const releaseGovernanceProjectSummary = computed(() =>
  governanceSnapshot.value.projectSummaries.find((item) => item.projectId === (releaseProject.value?.id ?? null)) ?? null,
)

const pageAlerts = computed(() => {
  const items: Array<{ level: 'info' | 'warning'; message: string; description?: string }> = []

  if (!activeProject.value) {
    items.push({
      level: 'warning',
      message: '当前没有活动项目上下文。',
      description: '跨页面工作时建议先打开或创建项目，避免报告、收藏和导出记录彼此游离。',
    })
  }

  if (activeProject.value && activeProjectSummary.value) {
    items.push({
      level: 'info',
      message: `活动项目“${activeProject.value.name}”当前处于${lifecycleLabels[activeProject.value.lifecycleStatus]}阶段，已关联 ${activeProjectSummary.value.reportCount} 条报告、${activeProjectSummary.value.workflowInsight.resultCount} 条正式结果、${activeProjectSummary.value.workflowInsight.snapshotCount} 条场景快照。`,
      description: '当前页面优先读取 SQLite 中的 workflow_project / calculation_run / calculation_result 正式对象，再同步到本地兼容缓存。',
    })
    if (activeProjectSummary.value.changeControl.pendingApprovalCount > 0) {
      items.push({
        level: 'warning',
        message: `当前活动项目还有 ${activeProjectSummary.value.changeControl.pendingApprovalCount} 条待审批任务。`,
        description: '建议先完成项目变更评审，再继续发布报告或向下游导出。',
      })
    }
    if (activeProjectSummary.value.release.readinessStatus !== 'ready') {
      items.push({
        level: 'warning',
        message: `当前活动项目发布就绪状态为 ${activeProjectSummary.value.release.readinessStatus === 'blocked' ? '阻塞' : '待完善'}。`,
        description: activeProjectSummary.value.release.blockers.join('；') || '当前仍有未闭环的发布前置项。',
      })
    }
  }

  if (frozenProjectCount.value > 0) {
    items.push({
      level: 'info',
      message: `当前共有 ${frozenProjectCount.value} 个项目处于只读发布态。`,
      description: '这些项目适合用作比较、导出和基线审查，不应再直接作为活动编辑上下文。',
    })
  }
  if (governanceSnapshot.value.staleNodes > 0 || governanceSnapshot.value.inconsistentNodes > 0) {
    items.push({
      level: 'warning',
      message: `当前工作区有 ${governanceSnapshot.value.staleNodes} 个滞后修订、${governanceSnapshot.value.inconsistentNodes} 个一致性告警。`,
      description: '建议在项目发布前先检查修订治理总览，确认项目、报告和文档是否仍引用旧基线。',
    })
  }
  if (activeProject.value && activeGovernanceProjectSummary.value && activeGovernanceProjectSummary.value.repairableAlerts > 0) {
    items.push({
      level: 'warning',
      message: `当前活动项目治理完成度 ${Math.round(activeGovernanceProjectSummary.value.completionRate * 100)}%，仍有 ${activeGovernanceProjectSummary.value.repairableAlerts} 条可直接修复项。`,
      description: '建议优先从修订治理总览或发布面板进入治理动作，再推进正式发布。',
    })
  }

  return items
})

const decisionPanel = computed(() => {
  if (!projects.value.length) {
    return {
      conclusion: '当前还没有项目记录。',
      status: 'info' as const,
      risks: ['如果直接在各模块里计算而不建项目，后续追踪版本和结果来源会比较松散。'],
      actions: ['先建立项目并绑定计算模块，再把阶段结果逐步沉淀到项目记录中。'],
      boundaries: ['当前项目中心现在会读取正式结果对象，但仍不会替代完整版本控制系统或审批系统。'],
    }
  }

  return {
    conclusion: `当前共有 ${projectStats.value.total} 个项目，其中进行中 ${projectStats.value.active} 个，最近活动项目为 ${activeProject.value?.name ?? '未设置'}。`,
    status: (projectStats.value.active > 0 ? 'success' : 'info') as 'success' | 'info',
    risks: activeProject.value
      ? (activeProjectSummary.value?.workflowInsight.errorCount ?? 0) > 0
        ? ['当前活动项目下存在状态为异常的正式结果对象，发布前应回到对应模块复核。']
        : (activeProjectSummary.value?.changeControl.pendingApprovalCount ?? 0) > 0
          ? ['当前活动项目存在待审批的变更任务，阶段推进前应先补齐审批结论。']
          : []
      : ['当前没有活动项目，跨页面工作时缺少统一上下文。'],
    actions: activeProject.value
      ? ['继续在对应模块推进计算，并定期导出项目包归档。', '必要时把阶段性结果同步到报告中心和 BOM。', '阶段推进或归档时同步补齐变更单和审批任务。']
      : ['打开一个已有项目，或先新建项目作为当前工作上下文。'],
    boundaries: [
      '项目导出目前以元信息、最近计算摘要、正式结果概览和直接关联报告为主，不替代完整版本控制系统。',
      '项目中心当前已纳入变更与审批骨架，但仍不是完整 PLM/PDM 审批系统。',
    ],
  }
})

function getNextLifecycleStatus(current: WorkspaceProject['lifecycleStatus']) {
  const currentIndex = lifecycleOrder.indexOf(current)
  return lifecycleOrder[Math.min(currentIndex + 1, lifecycleOrder.length - 1)]
}

function getLifecycleLabel(status?: WorkspaceProject['lifecycleStatus']) {
  return lifecycleLabels[status ?? 'draft']
}

function getLifecycleColor(status?: WorkspaceProject['lifecycleStatus']) {
  return lifecycleColors[status ?? 'draft']
}

function handleExternalStateChanged() {
  void syncWorkspaceState({ silent: true })
}

onMounted(() => {
  void syncWorkspaceState({ silent: true })
  window.addEventListener(WORKSPACE_STORAGE_EVENT, handleExternalStateChanged)
  window.addEventListener(REPORTS_STORAGE_EVENT, handleExternalStateChanged)
  window.addEventListener(WORKFLOW_ARTIFACTS_EVENT, handleExternalStateChanged)
  window.addEventListener(CHANGE_CONTROL_EVENT, handleExternalStateChanged)
  window.addEventListener(ENGINEERING_LIBRARY_EVENT, handleExternalStateChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener(WORKSPACE_STORAGE_EVENT, handleExternalStateChanged)
  window.removeEventListener(REPORTS_STORAGE_EVENT, handleExternalStateChanged)
  window.removeEventListener(WORKFLOW_ARTIFACTS_EVENT, handleExternalStateChanged)
  window.removeEventListener(CHANGE_CONTROL_EVENT, handleExternalStateChanged)
  window.removeEventListener(ENGINEERING_LIBRARY_EVENT, handleExternalStateChanged)
})

async function appendProjectEvent(
  project: WorkspaceProject,
  eventType: WorkflowObjectEventLogRecord['eventType'],
  summary: string,
  payload?: Record<string, unknown>,
) {
  await appendObjectEventLog({
    id: `evt_project_${project.id}_${Date.now()}`,
    objectType: 'project',
    objectId: project.id,
    projectId: project.id,
    module: project.module,
    eventType,
    summary,
    actorName: '系统',
    eventAt: new Date().toISOString(),
    payload: payload ?? null,
  })
}

async function appendProjectTransitionControl(
  project: WorkspaceProject,
  nextStatus: WorkspaceProject['lifecycleStatus'],
  title: string,
  reason: string,
) {
  const now = new Date().toISOString()
  const changeId = `chg_project_${project.id}_${Date.now()}`
  const approvalId = `apr_project_${project.id}_${Date.now()}`
  const decisionStatus =
    nextStatus === 'in-review' ? 'pending' : nextStatus === 'draft' ? 'waived' : 'approved'

  await upsertChangeCase({
    id: changeId,
    projectId: project.id,
    objectType: 'project',
    objectId: project.id,
    changeCode: `${project.revisionCode}-${Date.now()}`,
    title,
    module: project.module,
    reason,
    impactSummary: `项目阶段切换到 ${getLifecycleLabel(nextStatus)}`,
    requestedBy: '系统',
    requestedAt: now,
    effectiveAt: decisionStatus === 'pending' ? undefined : now,
    status: nextStatus === 'draft' ? 'draft' : nextStatus,
    revisionCode: project.revisionCode,
    payload: {
      previousLifecycleStatus: project.lifecycleStatus,
      nextLifecycleStatus: nextStatus,
      version: project.version,
    },
  })

  await upsertApprovalTask({
    id: approvalId,
    changeId,
    projectId: project.id,
    objectType: 'project',
    objectId: project.id,
    module: project.module,
    title: `${title} 审批`,
    approvalRole: nextStatus === 'released' ? '发布批准' : '工程复核',
    assigneeName: '待分配',
    decisionStatus,
    dueAt: decisionStatus === 'pending' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    decidedAt: decisionStatus === 'pending' ? undefined : now,
    comment: decisionStatus === 'pending' ? '等待评审结论' : `已自动记录为 ${getLifecycleLabel(nextStatus)} 阶段推进`,
    seqNo: 1,
    createdAt: now,
    updatedAt: now,
    payload: {
      lifecycleStatus: nextStatus,
    },
  })
}

function createProject() {
  if (!newProjectName.value.trim()) return

  const project = createWorkspaceProject({
    name: newProjectName.value.trim(),
    module: selectedModule.value,
  })

  upsertStoredProject(project)
  saveActiveProject(project)
  void syncWorkspaceState()
  void appendProjectEvent(project, 'created', `创建项目 ${project.name}`, {
    lifecycleStatus: project.lifecycleStatus,
    revisionCode: project.revisionCode,
  })
  showNewProjectModal.value = false
  newProjectName.value = ''
  feedback.notifySaved('项目')
}

function openProject(project: WorkspaceProject) {
  if (!canActivateProjectWorkspace(project.lifecycleStatus)) {
    feedback.info('当前项目已处于只读发布态，已按参考模式打开模块，不切换活动项目')
    const targetRoute = moduleRouteMap[project.module]
    if (targetRoute) {
      void router.push(targetRoute)
    }
    return
  }

  const nextProject: WorkspaceProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    status: 'active',
  }

  saveStoredProjects(projects.value.map((item) => (item.id === project.id ? nextProject : item)))
  saveActiveProject(nextProject)
  void syncWorkspaceState()
  void appendProjectEvent(nextProject, 'opened', `打开项目 ${nextProject.name}`, {
    lifecycleStatus: nextProject.lifecycleStatus,
  })
  feedback.notifyOpened('项目')
  const targetRoute = moduleRouteMap[project.module]
  if (targetRoute) {
    void router.push(targetRoute)
  }
}

async function toggleArchive(project: WorkspaceProject) {
  const isRestoring = project.status === 'archived'
  const nextLifecycleStatus = isRestoring ? 'draft' : 'archived'
  updateStoredProject(project.id, (current) => ({
    ...current,
    status: current.status === 'archived' ? 'active' : 'archived',
    lifecycleStatus: nextLifecycleStatus,
    updatedAt: new Date().toISOString(),
  }))
  await appendProjectTransitionControl(
    project,
    nextLifecycleStatus,
    isRestoring ? `项目 ${project.name} 恢复工作区` : `项目 ${project.name} 归档`,
    isRestoring ? '恢复项目继续迭代' : '项目进入归档状态',
  )
  await appendProjectEvent(
    project,
    isRestoring ? 'restored' : 'archived',
    isRestoring ? `恢复项目 ${project.name}` : `归档项目 ${project.name}`,
    { nextLifecycleStatus },
  )
  void syncWorkspaceState()
}

async function advanceLifecycle(project: WorkspaceProject) {
  if (!canAdvanceWorkflowStatus(project.lifecycleStatus)) {
    feedback.info('当前项目已处于只读发布态，不能再直接推进阶段')
    return
  }

  const nextLifecycleStatus = getNextLifecycleStatus(project.lifecycleStatus)
  updateStoredProject(project.id, (current) => ({
    ...current,
    lifecycleStatus: nextLifecycleStatus,
    updatedAt: new Date().toISOString(),
  }))
  await appendProjectTransitionControl(
    project,
    nextLifecycleStatus,
    `项目 ${project.name} 阶段推进到 ${getLifecycleLabel(nextLifecycleStatus)}`,
    '项目阶段推进',
  )
  await appendProjectEvent(project, nextLifecycleStatus === 'in-review' ? 'approval-requested' : 'status-changed', `项目 ${project.name} 阶段推进到 ${getLifecycleLabel(nextLifecycleStatus)}`, {
    previousLifecycleStatus: project.lifecycleStatus,
    nextLifecycleStatus,
  })
  void syncWorkspaceState()
  feedback.notifySaved('项目阶段')
}

async function deriveProjectRevision(project: WorkspaceProject) {
  const now = new Date().toISOString()
  const nextRevisionCode = getNextRevisionCode(project.revisionCode)
  const derivedProject: WorkspaceProject = {
    ...project,
    id: `proj_${Date.now()}`,
    name: buildDerivedTitle(project.name, nextRevisionCode),
    createdAt: now,
    updatedAt: now,
    revisionCode: nextRevisionCode,
    lifecycleStatus: 'draft',
    status: 'active',
    inputSummary: [project.inputSummary, buildDerivationNote({
      sourceTitle: project.name,
      sourceRevisionCode: project.revisionCode,
      nextRevisionCode,
    })]
      .filter(Boolean)
      .join('\n'),
  }

  upsertStoredProject(derivedProject)
  saveActiveProject(derivedProject)

  await appendProjectEvent(project, 'linked', `项目 ${project.name} 派生新修订 ${nextRevisionCode}`, {
    derivedProjectId: derivedProject.id,
    sourceRevisionCode: project.revisionCode,
    nextRevisionCode,
    referenceLock: buildReferenceLock({
      sourceObjectType: 'project',
      sourceObjectId: project.id,
      sourceRevisionCode: project.revisionCode,
      sourceStatus: project.lifecycleStatus,
      lockedAt: now,
    }),
  })
  await appendProjectEvent(derivedProject, 'created', `从 ${project.name} 派生项目修订 ${nextRevisionCode}`, {
    derivedFromProjectId: project.id,
    sourceRevisionCode: project.revisionCode,
    nextRevisionCode,
    referenceLock: buildReferenceLock({
      sourceObjectType: 'project',
      sourceObjectId: project.id,
      sourceRevisionCode: project.revisionCode,
      sourceStatus: project.lifecycleStatus,
      lockedAt: now,
    }),
  })

  void syncWorkspaceState()
  feedback.success(`已派生项目修订 ${nextRevisionCode}`)
}

async function deriveReportRevisionFromGovernance(reportId: string) {
  const report = loadStoredReports().find((item) => item.id === reportId) ?? null
  if (!report) {
    feedback.warning('未找到可派生的报告修订')
    return false
  }

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
    summary: [report.summary, derivationMeta.derivationNote]
      .filter(Boolean)
      .join('\n'),
    derivationMeta,
  }

  upsertStoredReportDerivationMeta(derivedReport.id, derivationMeta)
  appendStoredReport(derivedReport)
  await upsertDocumentAttachment({
    id: `doc_report_${derivedReport.id}_${derivedReport.type}`,
    projectId: derivedReport.projectId,
    objectType: 'report',
    objectId: derivedReport.id,
    module: derivedReport.module,
    documentKind: derivedReport.type,
    title: derivedReport.title,
    fileName: `${derivedReport.title.replace(/\s+/g, '_')}.${derivedReport.type}`,
    mimeType:
      derivedReport.type === 'pdf'
        ? 'application/pdf'
        : derivedReport.type === 'csv'
          ? 'text/csv;charset=utf-8'
          : 'application/json',
    storageType: 'export-reference',
    revisionCode: derivedReport.revisionCode ?? 'A',
    createdAt: now,
    createdBy: derivedReport.author,
    status: 'draft',
    payload: {
      linkedRunId: derivedReport.linkedRunId ?? null,
      linkedResultId: derivedReport.linkedResultId ?? null,
      workflowStatus: derivedReport.workflowStatus ?? 'draft',
      derivationMeta,
      referenceLock,
    },
  })
  await appendObjectEventLog({
    id: `evt_report_${report.id}_${Date.now()}`,
    objectType: 'report',
    objectId: report.id,
    projectId: report.projectId,
    module: report.module,
    eventType: 'linked',
    summary: `报告 ${report.title} 派生新修订 ${nextRevisionCode}`,
    actorName: derivedReport.author ?? '系统',
    eventAt: now,
    payload: {
      derivedReportId: derivedReport.id,
      sourceRevisionCode: report.revisionCode ?? 'A',
      nextRevisionCode,
      referenceLock,
    },
  })
  await appendObjectEventLog({
    id: `evt_report_${derivedReport.id}_${Date.now()}`,
    objectType: 'report',
    objectId: derivedReport.id,
    projectId: derivedReport.projectId,
    module: derivedReport.module,
    eventType: 'created',
    summary: `从 ${report.title} 派生报告修订 ${nextRevisionCode}`,
    actorName: derivedReport.author ?? '系统',
    eventAt: now,
    payload: {
      derivedFromReportId: report.id,
      sourceRevisionCode: report.revisionCode ?? 'A',
      nextRevisionCode,
      referenceLock,
    },
  })
  void syncWorkspaceState()
  feedback.success(`已派生报告修订 ${nextRevisionCode}`)
  return true
}

async function deriveDocumentRevisionFromGovernance(documentId: string) {
  const document = engineeringLibrarySnapshot.value.documentAttachments.find((item) => item.id === documentId) ?? null
  if (!document) {
    feedback.warning('未找到可派生的文档修订')
    return false
  }

  const now = new Date().toISOString()
  const nextRevisionCode = getNextRevisionCode(document.revisionCode)
  const referenceLock = buildReferenceLock({
    sourceObjectType: document.objectType,
    sourceObjectId: document.objectId,
    sourceRevisionCode: document.revisionCode,
    sourceStatus: document.status,
    lockedAt: now,
  })

  await upsertDocumentAttachment({
    ...document,
    id: `doc_der_${Date.now()}`,
    title: buildDerivedTitle(document.title, nextRevisionCode),
    fileName: buildDerivedFileName(document.fileName, nextRevisionCode),
    revisionCode: nextRevisionCode,
    createdAt: now,
    status: 'draft',
    payload: {
      ...(document.payload ?? {}),
      derivedFromDocumentId: document.id,
      sourceRevisionCode: document.revisionCode ?? 'A',
      derivationNote: buildDerivationNote({
        sourceTitle: document.title,
        sourceRevisionCode: document.revisionCode,
        nextRevisionCode,
      }),
      referenceLock,
    },
  })
  await appendObjectEventLog({
    id: `evt_document_derive_${Date.now()}`,
    objectType: document.objectType,
    objectId: document.objectId,
    projectId: document.projectId,
    module: document.module,
    eventType: 'linked',
    summary: `文档 ${document.title} 派生新修订 ${nextRevisionCode}`,
    actorName: '系统',
    eventAt: now,
    payload: {
      derivedFromDocumentId: document.id,
      sourceRevisionCode: document.revisionCode ?? 'A',
      nextRevisionCode,
      referenceLock,
    },
  })
  void syncWorkspaceState()
  feedback.success(`已派生文档修订 ${nextRevisionCode}`)
  return true
}

async function deriveGovernanceSuggested(alert: RevisionGovernanceAlert) {
  if (!alert.suggestedNodeId || alert.suggestedAction !== 'inspect-latest') {
    feedback.info('当前治理建议没有可派生的最新目标')
    return
  }

  if (alert.objectType === 'project') {
    const project = projects.value.find((item) => item.id === alert.suggestedNodeId) ?? null
    if (!project) {
      feedback.warning('未找到可派生的项目修订')
      return
    }
    await deriveProjectRevision(project)
    return
  }

  if (alert.objectType === 'report') {
    const derived = await deriveReportRevisionFromGovernance(alert.suggestedNodeId)
    if (derived && alert.suggestedRoutePath) {
      openGovernanceRoute(alert.suggestedRoutePath)
    }
    return
  }

  if (alert.objectType === 'document') {
    const derived = await deriveDocumentRevisionFromGovernance(alert.suggestedNodeId)
    if (derived && alert.suggestedRoutePath) {
      openGovernanceRoute(alert.suggestedRoutePath)
    }
  }
}

async function deleteProject(id: string) {
  const targetProject = projects.value.find((project) => project.id === id) ?? null
  if (targetProject && !canDeleteWorkflowRecord(targetProject.lifecycleStatus)) {
    feedback.info('当前项目已处于只读发布态，不允许直接删除')
    return
  }
  const confirmed = await feedback.confirmDestructive({
    title: '删除项目',
    content: '确定要删除此项目吗？该操作不会恢复。',
  })
  if (!confirmed) return

  if (targetProject) {
    const existingReports = loadStoredReports()
    const detachedReports = existingReports.map((report) => {
      if (!isReportLinkedToProject(report, targetProject)) {
        return report
      }

      return {
        ...report,
        projectId: report.projectId === targetProject.id ? undefined : report.projectId,
        projectName: report.projectName === targetProject.name ? undefined : report.projectName,
        projectNumber:
          report.projectNumber === targetProject.id || report.projectNumber === targetProject.name
            ? undefined
            : report.projectNumber,
      }
    })
    if (detachedReports.some((report, index) => report !== existingReports[index])) {
      saveStoredReports(detachedReports)
    }

    await appendProjectEvent(targetProject, 'deleted', `删除项目 ${targetProject.name}`, {
      lifecycleStatus: targetProject.lifecycleStatus,
      revisionCode: targetProject.revisionCode,
    })
  }
  removeStoredProject(id)
  void syncWorkspaceState()
  feedback.notifyDeleted('项目')
}

async function exportProject(project: WorkspaceProject) {
  const collections = buildProjectCollections(project)
  const linkedBomDraft = await loadLatestBomDraft(project.id)
  const relatedRecent = store.recentCalculations
    .filter((item) => item.module === project.module)
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
    }))

  const relatedFavorites = store.favorites
    .filter((item) => item.module === project.module)
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
    }))

  const projectBomIds = new Set(collections.projectBomRevisionLinks.map((item) => item.bomId))
  if (linkedBomDraft?.bomId) {
    projectBomIds.add(linkedBomDraft.bomId)
  }
  const projectBomRevisionLinks = collections.projectBomRevisionLinks.filter((item) => projectBomIds.has(item.bomId))

  const data = {
    format: 'MechBox Workspace Package',
    version: WORKSPACE_PACKAGE_FORMAT_VERSION,
    project,
    exportMeta: {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      ruleVersion: RULESET_VERSION,
    },
    bomDraft: linkedBomDraft,
    activitySummary: {
      activeProjectId: activeProject.value?.id ?? null,
      moduleRecentCalculations: relatedRecent,
      moduleFavorites: relatedFavorites,
      linkedReports: collections.linkedReports.slice(0, 20),
      moduleReports: collections.moduleReports,
      formalRunCount: collections.workflowInsight.runCount,
      formalResultCount: collections.workflowInsight.resultCount,
      scenarioSnapshotCount: collections.workflowInsight.snapshotCount,
      hasBomDraft: Boolean(linkedBomDraft),
    },
    workflowArtifacts: {
      bundles: collections.artifactBundles,
      runCount: collections.projectRuns.length,
      resultCount: collections.projectResults.length,
      snapshotCount: collections.projectSnapshots.length,
    },
    changeControl: {
      changes: collections.projectChangeCases,
      approvals: collections.projectApprovalTasks,
      events: collections.projectEventLogs,
    },
    engineeringLibrary: {
      partMasters: collections.projectPartMasters,
      supplierParts: collections.projectSupplierParts,
      bomRevisionLinks: projectBomRevisionLinks,
      documentAttachments: collections.projectDocumentAttachments,
    },
    snapshots: collections.projectSnapshots,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.name.replace(/\s+/g, '_')}.mechbox`
  anchor.click()
  URL.revokeObjectURL(url)
  await appendProjectEvent(project, 'exported', `导出项目包 ${project.name}`, {
    linkedReportCount: collections.linkedReports.length,
    runCount: collections.projectRuns.length,
    resultCount: collections.projectResults.length,
  })
  feedback.notifyExported('项目包')
}

function exportProjectReleaseBrief(project: WorkspaceProject) {
  const collections = buildProjectCollections(project)
  const release = buildProjectReleaseStats(project)
  const payload = {
    exportedAt: new Date().toISOString(),
    packageType: 'MechBox Project Release Brief',
    project,
    release,
    gateChecks: buildReleaseChecks(project, null),
    reports: collections.linkedReports,
    documents: collections.projectDocumentAttachments,
    changes: collections.projectChangeCases,
    approvals: collections.projectApprovalTasks,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.name.replace(/\s+/g, '_')}-release-brief.json`
  anchor.click()
  URL.revokeObjectURL(url)
  feedback.notifyExported('项目发布摘要')
}

async function exportProjectFreezeSnapshot(project: WorkspaceProject) {
  const collections = buildProjectCollections(project)
  const release = buildProjectReleaseStats(project)
  const linkedBomDraft = await loadLatestBomDraft(project.id)
  const payload = {
    exportedAt: new Date().toISOString(),
    packageType: 'MechBox Project Freeze Snapshot',
    freezeLevel: release.readinessStatus === 'ready' ? 'release-candidate' : 'working-baseline',
    project,
    release,
    gateChecks: buildReleaseChecks(project, linkedBomDraft),
    baseline: {
      lifecycleStatus: project.lifecycleStatus,
      revisionCode: project.revisionCode,
      version: project.version,
      updatedAt: project.updatedAt,
    },
    summary: {
      reportCount: collections.linkedReports.length,
      formalRunCount: collections.workflowInsight.runCount,
      formalResultCount: collections.workflowInsight.resultCount,
      snapshotCount: collections.workflowInsight.snapshotCount,
      partCount: collections.projectPartMasters.length,
      supplierPartCount: collections.projectSupplierParts.length,
      documentCount: collections.projectDocumentAttachments.length,
      releasedDocumentCount: collections.projectDocumentAttachments.filter((item) => item.status === 'released').length,
      bomRevisionCount: collections.projectBomRevisionLinks.length,
      changeCount: collections.projectChangeCases.length,
      pendingApprovalCount: collections.projectApprovalTasks.filter((item) => item.decisionStatus === 'pending').length,
      eventCount: collections.projectEventLogs.length,
      hasBomDraft: Boolean(linkedBomDraft),
    },
    linkedObjects: {
      reports: collections.linkedReports,
      runs: collections.projectRuns,
      results: collections.projectResults,
      snapshots: collections.projectSnapshots,
      partMasters: collections.projectPartMasters,
      supplierParts: collections.projectSupplierParts,
      documentAttachments: collections.projectDocumentAttachments,
      bomRevisionLinks: collections.projectBomRevisionLinks,
      changes: collections.projectChangeCases,
      approvals: collections.projectApprovalTasks,
      events: collections.projectEventLogs,
      bomDraft: linkedBomDraft,
    },
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.name.replace(/\s+/g, '_')}-freeze-snapshot.json`
  anchor.click()
  URL.revokeObjectURL(url)
  await appendProjectEvent(project, 'exported', `导出项目冻结快照 ${project.name}`, {
    packageType: 'freeze-snapshot',
    readinessStatus: release.readinessStatus,
    reportCount: collections.linkedReports.length,
    resultCount: collections.workflowInsight.resultCount,
  })
  feedback.notifyExported('项目冻结快照')
}

async function openReleasePanel(project: WorkspaceProject) {
  releaseProject.value = project
  showReleasePanelModal.value = true
  releasePanelLoading.value = true
  try {
    releasePanelBomDraft.value = await loadLatestBomDraft(project.id)
  } finally {
    releasePanelLoading.value = false
  }
}

function closeReleasePanel() {
  showReleasePanelModal.value = false
  releaseProject.value = null
  releasePanelBomDraft.value = null
}

function openGovernanceRoute(path?: string | null) {
  if (!path) {
    feedback.info('当前治理建议没有可打开的页面')
    return
  }
  void router.push(path)
}

function triggerImport() {
  importInputRef.value?.click()
}

function slugImportIdentifier(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 36) || 'item'
}

function createUniqueImportedId(
  originalId: unknown,
  prefix: string,
  existingIds: Set<string>,
  sessionId: string,
  forceNew = false,
) {
  const baseId = String(originalId ?? '').trim() || `${prefix}_${sessionId}`
  if (!forceNew && !existingIds.has(baseId)) {
    existingIds.add(baseId)
    return baseId
  }

  let index = 1
  let candidate = ''
  do {
    candidate = `${prefix}_import_${sessionId}_${index}_${slugImportIdentifier(baseId)}`
    index += 1
  } while (existingIds.has(candidate))

  existingIds.add(candidate)
  return candidate
}

async function handleImportPackage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const rawProject = parsed?.project
    if (!rawProject || typeof rawProject !== 'object') {
      throw new Error('导入文件缺少 project 字段')
    }

    const importSessionId = Date.now().toString(36)
    const rawProjectRecord = rawProject as Record<string, unknown>
    const rawProjectId = String(rawProjectRecord.id ?? `proj_import_${importSessionId}`)
    const rawProjectName = String(rawProjectRecord.name ?? '导入项目')
    const existingProjectIds = new Set(loadStoredProjects().map((project) => project.id))
    const projectIdConflict = existingProjectIds.has(rawProjectId)
    const importedProjectId = createUniqueImportedId(rawProjectId, 'proj', existingProjectIds, importSessionId, projectIdConflict)

    const importedProject = createWorkspaceProject({
      name: projectIdConflict ? `${rawProjectName}（导入副本）` : rawProjectName,
      module: String(rawProjectRecord.module ?? 'seals'),
      inputSummary: String(rawProjectRecord.inputSummary ?? '来自项目包导入'),
    })

    importedProject.id = importedProjectId
    importedProject.createdAt = String(rawProjectRecord.createdAt ?? importedProject.createdAt)
    importedProject.updatedAt = new Date().toISOString()
    importedProject.version = String(rawProjectRecord.version ?? DEFAULT_PROJECT_VERSION)
    importedProject.revisionCode = String(rawProjectRecord.revisionCode ?? 'A')
    importedProject.status = rawProjectRecord.status === 'archived' ? 'archived' : 'active'
    importedProject.lifecycleStatus =
      rawProjectRecord.lifecycleStatus === 'in-review' ||
      rawProjectRecord.lifecycleStatus === 'approved' ||
      rawProjectRecord.lifecycleStatus === 'released' ||
      rawProjectRecord.lifecycleStatus === 'archived'
        ? (rawProjectRecord.lifecycleStatus as WorkspaceProject['lifecycleStatus'])
        : 'draft'

    if (projectIdConflict) {
      importedProject.inputSummary = [
        importedProject.inputSummary,
        `导入时检测到原项目 ID ${rawProjectId} 已存在，已改用 ${importedProject.id}。`,
      ]
        .filter(Boolean)
        .join('\n')
    }

    const activitySummary = parsed?.activitySummary as Record<string, unknown> | undefined
    const importedFavorites = Array.isArray(activitySummary?.moduleFavorites)
      ? activitySummary.moduleFavorites
      : Array.isArray(activitySummary?.favorites)
        ? activitySummary.favorites
        : []
    const importedRecent = Array.isArray(activitySummary?.moduleRecentCalculations)
      ? activitySummary.moduleRecentCalculations
      : Array.isArray(activitySummary?.recentCalculations)
        ? activitySummary.recentCalculations
        : []
    const importedReports = normalizeReportRecords([
      ...(Array.isArray(activitySummary?.linkedReports) ? activitySummary.linkedReports : []),
      ...(Array.isArray(activitySummary?.moduleReports) ? activitySummary.moduleReports : []),
      ...(Array.isArray(activitySummary?.reports) ? activitySummary.reports : []),
    ])
    const importedArtifactBundles = Array.isArray(parsed?.workflowArtifacts?.bundles)
      ? (parsed.workflowArtifacts.bundles as WorkflowArtifactBundle[])
      : []
    const importedChangeCases = Array.isArray(parsed?.changeControl?.changes)
      ? (parsed.changeControl.changes as WorkflowChangeCaseRecord[])
      : []
    const importedApprovalTasks = Array.isArray(parsed?.changeControl?.approvals)
      ? (parsed.changeControl.approvals as WorkflowApprovalTaskRecord[])
      : []
    const importedEventLogs = Array.isArray(parsed?.changeControl?.events)
      ? (parsed.changeControl.events as WorkflowObjectEventLogRecord[])
      : []
    const importedPartMasters = Array.isArray(parsed?.engineeringLibrary?.partMasters)
      ? (parsed.engineeringLibrary.partMasters as WorkflowPartMasterRecord[])
      : []
    const importedSupplierParts = Array.isArray(parsed?.engineeringLibrary?.supplierParts)
      ? (parsed.engineeringLibrary.supplierParts as WorkflowSupplierPartRecord[])
      : []
    const importedDocumentAttachments = Array.isArray(parsed?.engineeringLibrary?.documentAttachments)
      ? (parsed.engineeringLibrary.documentAttachments as WorkflowDocumentAttachmentRecord[])
      : []
    const importedBomDraft =
      parsed?.bomDraft && typeof parsed.bomDraft === 'object'
        ? (parsed.bomDraft as {
            bomId?: string
            projectName?: string
            projectNumber?: string
            author?: string
            date?: string
            revision?: string
            summary?: string
            status?: 'draft' | 'in-review' | 'approved' | 'released' | 'archived'
            sourceKind?: 'manual' | 'derived' | 'imported'
            items?: unknown[]
          })
        : null

    const existingRunIds = new Set(workflowInsightSnapshot.value.runs.map((item) => item.id))
    const existingResultIds = new Set(workflowInsightSnapshot.value.results.map((item) => item.id))
    const existingSnapshotIds = new Set(workflowInsightSnapshot.value.snapshots.map((item) => item.id))
    const existingReportIds = new Set(loadStoredReports().map((report) => report.id))
    const existingChangeIds = new Set(changeControlSnapshot.value.changes.map((item) => item.id))
    const existingApprovalIds = new Set(changeControlSnapshot.value.approvals.map((item) => item.id))
    const existingEventIds = new Set(changeControlSnapshot.value.events.map((item) => item.id))
    const existingPartIds = new Set(engineeringLibrarySnapshot.value.partMasters.map((item) => item.id))
    const existingSupplierPartIds = new Set(engineeringLibrarySnapshot.value.supplierParts.map((item) => item.id))
    const existingDocumentIds = new Set(engineeringLibrarySnapshot.value.documentAttachments.map((item) => item.id))
    const existingBomIds = new Set(engineeringLibrarySnapshot.value.bomRevisionLinks.map((item) => item.bomId))
    const existingBomItemIds = new Set<string>()
    if (importedBomDraft) {
      const existingBomDrafts = await listBomDrafts(500)
      existingBomDrafts.forEach((draft) => {
        if (draft.bomId) {
          existingBomIds.add(draft.bomId)
        }
        draft.items.forEach((item) => {
          if (item.id) {
            existingBomItemIds.add(item.id)
          }
        })
      })

      if (importedBomDraft.bomId) {
        const latestSameBom = await loadLatestBomDraft(importedProject.id)
        if (latestSameBom?.bomId) {
          existingBomIds.add(latestSameBom.bomId)
        }
      }
    }

    const projectIdMap = new Map<string, string>([[rawProjectId, importedProject.id]])
    const reportIdMap = new Map<string, string>()
    const runIdMap = new Map<string, string>()
    const resultIdMap = new Map<string, string>()
    const snapshotIdMap = new Map<string, string>()
    const partIdMap = new Map<string, string>()
    const documentIdMap = new Map<string, string>()
    const bomIdMap = new Map<string, string>()

    const remapProjectId = (projectId?: string | null) => {
      if (!projectId) return importedProject.id
      return projectIdMap.get(projectId) ?? projectId
    }

    const isProjectScopedReport = (report: ReportRecord) =>
      report.projectId === rawProjectId ||
      report.projectName === rawProjectName ||
      report.projectNumber === rawProjectId ||
      report.projectNumber === rawProjectName

    const remapObjectId = (objectType: WorkflowChangeObjectType | 'bom', objectId: string) => {
      switch (objectType) {
        case 'project':
          return projectIdMap.get(objectId) ?? objectId
        case 'report':
          return reportIdMap.get(objectId) ?? objectId
        case 'run':
          return runIdMap.get(objectId) ?? objectId
        case 'result':
          return resultIdMap.get(objectId) ?? objectId
        case 'part':
          return partIdMap.get(objectId) ?? objectId
        case 'document':
          return documentIdMap.get(objectId) ?? objectId
        case 'bom':
          return bomIdMap.get(objectId) ?? objectId
        default:
          return objectId
      }
    }

    const remappedArtifactBundles = importedArtifactBundles.map((bundle) => {
      const nextRunId = createUniqueImportedId(
        bundle.run.id,
        'run',
        existingRunIds,
        importSessionId,
        projectIdConflict,
      )
      runIdMap.set(bundle.run.id, nextRunId)

      const snapshots = (bundle.snapshots ?? []).map((snapshot) => {
        const nextSnapshotId = createUniqueImportedId(
          snapshot.id,
          'snapshot',
          existingSnapshotIds,
          importSessionId,
          projectIdConflict,
        )
        snapshotIdMap.set(snapshot.id, nextSnapshotId)
        return {
          ...snapshot,
          id: nextSnapshotId,
          runId: nextRunId,
        }
      })

      const results = (bundle.results ?? []).map((result) => {
        const nextResultId = createUniqueImportedId(
          result.id,
          'result',
          existingResultIds,
          importSessionId,
          projectIdConflict,
        )
        resultIdMap.set(result.id, nextResultId)
        return {
          ...result,
          id: nextResultId,
          runId: nextRunId,
        }
      })

      return {
        run: {
          ...bundle.run,
          id: nextRunId,
          projectId: remapProjectId(bundle.run.projectId),
          projectName: bundle.run.projectId === rawProjectId || !bundle.run.projectId ? importedProject.name : bundle.run.projectName,
          projectNumber:
            bundle.run.projectNumber === rawProjectId || !bundle.run.projectNumber
              ? importedProject.id
              : bundle.run.projectNumber,
        },
        snapshots,
        results,
      } satisfies WorkflowArtifactBundle
    })

    const remappedReports = importedReports.map((report) => {
      const nextReportId = createUniqueImportedId(
        report.id,
        'rpt',
        existingReportIds,
        importSessionId,
        projectIdConflict,
      )
      reportIdMap.set(report.id, nextReportId)
      const projectScoped = isProjectScopedReport(report)
      return {
        ...report,
        id: nextReportId,
        projectId: projectScoped ? importedProject.id : report.projectId,
        projectName: projectScoped ? importedProject.name : report.projectName,
        projectNumber:
          projectScoped && (report.projectNumber === rawProjectId || report.projectNumber === rawProjectName)
            ? importedProject.id
            : report.projectNumber,
        linkedRunId: report.linkedRunId ? runIdMap.get(report.linkedRunId) ?? report.linkedRunId : undefined,
        linkedResultId: report.linkedResultId ? resultIdMap.get(report.linkedResultId) ?? report.linkedResultId : undefined,
      }
    })

    const bomIdConflict = Boolean(importedBomDraft?.bomId && existingBomIds.has(importedBomDraft.bomId))
    const remappedBomId = importedBomDraft?.bomId
      ? createUniqueImportedId(importedBomDraft.bomId, 'bom', existingBomIds, importSessionId, projectIdConflict || bomIdConflict)
      : undefined
    if (importedBomDraft?.bomId && remappedBomId) {
      bomIdMap.set(importedBomDraft.bomId, remappedBomId)
    }
    const shouldRemapBomItems = projectIdConflict || bomIdConflict || (remappedBomId && remappedBomId !== importedBomDraft?.bomId)
    const remappedBomItems = Array.isArray(importedBomDraft?.items)
      ? importedBomDraft.items.map((item, index) => {
          if (!item || typeof item !== 'object') return item
          const rawBomItem = item as Record<string, unknown>
          const originalItemId = rawBomItem.id ?? (importedBomDraft?.bomId ? `${importedBomDraft.bomId}_item_${index + 1}` : undefined)
          return {
            ...rawBomItem,
            id: createUniqueImportedId(
              originalItemId,
              'bomitem',
              existingBomItemIds,
              importSessionId,
              Boolean(shouldRemapBomItems),
            ),
          }
        })
      : []

    const remappedPartMasters = importedPartMasters.map((part) => {
      const nextPartId = createUniqueImportedId(
        part.id,
        'part',
        existingPartIds,
        importSessionId,
        projectIdConflict,
      )
      partIdMap.set(part.id, nextPartId)
      return {
        ...part,
        id: nextPartId,
        projectId: remapProjectId(part.projectId),
      }
    })

    const remappedSupplierParts = importedSupplierParts.map((supplierPart) => ({
      ...supplierPart,
      id: createUniqueImportedId(
        supplierPart.id,
        'sp',
        existingSupplierPartIds,
        importSessionId,
        projectIdConflict,
      ),
      partId: partIdMap.get(supplierPart.partId) ?? supplierPart.partId,
    }))

    const remappedDocumentAttachments = importedDocumentAttachments.map((attachment) => {
      const nextDocumentId = createUniqueImportedId(
        attachment.id,
        'doc',
        existingDocumentIds,
        importSessionId,
        projectIdConflict,
      )
      documentIdMap.set(attachment.id, nextDocumentId)
      return {
        ...attachment,
        id: nextDocumentId,
        projectId: remapProjectId(attachment.projectId),
        objectId: remapObjectId(attachment.objectType, attachment.objectId),
      }
    })

    const remappedChangeCases = importedChangeCases.map((change) => ({
      ...change,
      id: createUniqueImportedId(change.id, 'chg', existingChangeIds, importSessionId, projectIdConflict),
      projectId: remapProjectId(change.projectId),
      objectId: remapObjectId(change.objectType, change.objectId),
    }))

    const changeIdMap = new Map<string, string>()
    importedChangeCases.forEach((change, index) => {
      changeIdMap.set(change.id, remappedChangeCases[index].id)
    })

    const remappedApprovalTasks = importedApprovalTasks.map((task) => ({
      ...task,
      id: createUniqueImportedId(task.id, 'apr', existingApprovalIds, importSessionId, projectIdConflict),
      changeId: task.changeId ? changeIdMap.get(task.changeId) ?? task.changeId : undefined,
      projectId: remapProjectId(task.projectId),
      objectId: remapObjectId(task.objectType, task.objectId),
    }))

    const remappedEventLogs = importedEventLogs.map((eventLog) => ({
      ...eventLog,
      id: createUniqueImportedId(eventLog.id, 'evt', existingEventIds, importSessionId, projectIdConflict),
      projectId: remapProjectId(eventLog.projectId),
      objectId: remapObjectId(eventLog.objectType, eventLog.objectId),
    }))

    upsertStoredProject(importedProject)
    saveActiveProject(importedProject)

    if (importedFavorites.length) {
      store.mergeImportedFavorites(importedFavorites)
    }
    if (importedRecent.length) {
      store.mergeImportedRecentCalculations(importedRecent)
    }
    if (remappedReports.length) {
      mergeStoredReports(remappedReports)
    }
    if (remappedArtifactBundles.length) {
      await importWorkflowArtifactBundles(remappedArtifactBundles)
    }
    if (remappedChangeCases.length) {
      for (const change of remappedChangeCases) {
        await upsertChangeCase(change)
      }
    }
    if (remappedApprovalTasks.length) {
      for (const task of remappedApprovalTasks) {
        await upsertApprovalTask(task)
      }
    }
    if (remappedEventLogs.length) {
      for (const eventLog of remappedEventLogs) {
        await appendObjectEventLog(eventLog)
      }
    }
    if (remappedPartMasters.length) {
      for (const part of remappedPartMasters) {
        await upsertPartMaster(part)
      }
    }
    if (remappedSupplierParts.length) {
      for (const supplierPart of remappedSupplierParts) {
        await upsertSupplierPart(supplierPart)
      }
    }
    if (remappedDocumentAttachments.length) {
      for (const attachment of remappedDocumentAttachments) {
        await upsertDocumentAttachment(attachment)
      }
    }
    if (importedBomDraft && Array.isArray(importedBomDraft.items)) {
      await saveBomDraft({
        bomId: remappedBomId,
        projectId: importedProject.id,
        projectName: importedBomDraft.projectName || importedProject.name,
        projectNumber: importedBomDraft.projectNumber || importedProject.id.replace('proj_', 'BOM-'),
        author: importedBomDraft.author,
        date: importedBomDraft.date,
        revision: importedBomDraft.revision,
        summary: importedBomDraft.summary,
        status: importedBomDraft.status ?? 'draft',
        sourceKind: importedBomDraft.sourceKind ?? 'imported',
        items: remappedBomItems as any[],
      })
      notifyEngineeringLibraryUpdated()
    }

    await appendProjectEvent(importedProject, 'imported', `导入项目包 ${importedProject.name}`, {
      importedFavorites: importedFavorites.length,
      importedRecent: importedRecent.length,
      importedReports: remappedReports.length,
      importedArtifactBundles: remappedArtifactBundles.length,
      projectIdConflict,
      sourceProjectId: rawProjectId,
      importedProjectId: importedProject.id,
      hasBomDraft: Boolean(importedBomDraft),
    })

    void syncWorkspaceState()
    feedback.notifyOpened('导入项目')
    if (
      importedFavorites.length ||
      importedRecent.length ||
      remappedReports.length ||
      remappedArtifactBundles.length ||
      remappedChangeCases.length ||
      remappedApprovalTasks.length ||
      remappedEventLogs.length ||
      remappedPartMasters.length ||
      remappedSupplierParts.length ||
      remappedDocumentAttachments.length ||
      importedBomDraft
    ) {
      feedback.info(
        `已恢复 ${importedFavorites.length} 条收藏模板、${importedRecent.length} 条最近计算、${remappedReports.length} 条报告记录、${remappedArtifactBundles.length} 组正式对象链、${remappedChangeCases.length} 条变更单、${remappedApprovalTasks.length} 条审批任务、${remappedEventLogs.length} 条事件日志、${remappedPartMasters.length} 条零件主数据、${remappedSupplierParts.length} 条供应商料号、${remappedDocumentAttachments.length} 条文档附件${importedBomDraft ? '、1 份 BOM 草稿' : ''}${projectIdConflict ? '；检测到项目 ID 冲突，已导入为副本' : ''}`,
      )
    }
  } catch (error: any) {
    feedback.error(error.message || '项目包导入失败')
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="project-center-page">
    <PageToolbar title="MechBox" subtitle="项目中心">
      <a-space>
        <a-button size="small" @click="router.push('/documents')">
          文档中心
        </a-button>
        <a-button size="small" :loading="loading" @click="syncWorkspaceState()">
          <template #icon><ReloadOutlined /></template>刷新项目台
        </a-button>
        <a-button size="small" @click="triggerImport">
          <template #icon><ImportOutlined /></template>导入项目包
        </a-button>
        <a-button type="primary" size="small" @click="showNewProjectModal = true">
          <template #icon><PlusOutlined /></template>新建项目
        </a-button>
      </a-space>
    </PageToolbar>

    <PageSyncStatus
      :loading="loading"
      :has-loaded="hasLoadedOnce"
      :last-synced-at="lastSyncedAt"
      :error="syncError"
      loading-label="正在刷新项目、结果与治理数据"
      initial-label="正在准备项目工作台"
    >
      <a-space wrap size="small">
        <a-tag>项目 {{ projects.length }}</a-tag>
        <a-tag>报告 {{ reports.length }}</a-tag>
        <a-tag>结果 {{ workflowInsightSnapshot.results.length }}</a-tag>
      </a-space>
    </PageSyncStatus>

    <input
      ref="importInputRef"
      type="file"
      accept=".mechbox,.json"
      class="hidden-input"
      @change="handleImportPackage"
    />

    <PageLoadingState
      v-if="loading && !hasLoadedOnce"
      title="正在准备项目工作台"
      description="正在加载项目、报告、审批、修订治理与工程对象摘要。"
      :side-cards="4"
      :main-cards="2"
    />

    <div v-else class="content-body" :class="{ 'is-refreshing': loading }">

      <ToolPageLayout :input-span="8" :output-span="16">
        <template #side>
          <a-card title="项目概览" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="项目总数" :value="projectStats.total" /></a-col>
              <a-col :span="12"><a-statistic title="进行中" :value="projectStats.active" /></a-col>
              <a-col :span="12"><a-statistic title="已归档" :value="projectStats.archived" /></a-col>
              <a-col :span="12"><a-statistic title="最近计算模块" :value="recentByModule.length" /></a-col>
              <a-col :span="12"><a-statistic title="正式结果" :value="workflowInsightSnapshot.results.length" /></a-col>
              <a-col :span="12"><a-statistic title="待批任务" :value="changeControlSnapshot.approvals.filter((item) => item.decisionStatus === 'pending').length" /></a-col>
            </a-row>
          </a-card>

          <a-card title="发布就绪概览" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="8"><a-statistic title="就绪" :value="releaseOverview.ready" /></a-col>
              <a-col :span="8"><a-statistic title="待完善" :value="releaseOverview.warning" /></a-col>
              <a-col :span="8"><a-statistic title="阻塞" :value="releaseOverview.blocked" /></a-col>
            </a-row>
            <div class="section-note">
              发布就绪度按待审批任务、异常结果和文档发布状态综合判断，用于快速识别哪些项目已经接近正式发版。
            </div>
          </a-card>

          <a-card title="修订治理总览" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="治理对象" :value="governanceSnapshot.totalNodes" /></a-col>
              <a-col :span="12"><a-statistic title="修订根链" :value="governanceSnapshot.rootChains" /></a-col>
              <a-col :span="12"><a-statistic title="滞后修订" :value="governanceSnapshot.staleNodes" /></a-col>
              <a-col :span="12"><a-statistic title="一致性告警" :value="governanceSnapshot.inconsistentNodes" /></a-col>
            </a-row>
            <a-row :gutter="[12, 12]" style="margin-top: 12px">
              <a-col v-for="metric in governanceExecutionMetrics" :key="metric.label" :span="8">
                <a-statistic :title="metric.label" :value="metric.value" />
              </a-col>
            </a-row>
            <div v-if="activeGovernanceProjectSummary" class="section-note">
              当前活动项目治理完成度 {{ Math.round(activeGovernanceProjectSummary.completionRate * 100) }}%，当前最新占比 {{ Math.round(activeGovernanceProjectSummary.currentRate * 100) }}%，仍有 {{ activeGovernanceProjectSummary.repairableAlerts }} 条可直接修复项。
            </div>
            <div class="section-note">
              当前已把项目、报告、文档三类对象一起纳入修订治理分析。
            </div>
            <div v-if="governanceSnapshot.alerts.length" class="release-check-list">
              <article
                v-for="alert in governanceSnapshot.alerts.slice(0, 4)"
                :key="`${alert.objectType}-${alert.nodeId}-${alert.summary}`"
                class="release-check-item"
              >
                <div class="release-check-item__head">
                  <strong>{{ alert.summary }}</strong>
                </div>
                <div class="release-check-item__desc">{{ alert.title }} · {{ alert.recommendation }}</div>
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
            <StateEmpty v-else description="当前工作区没有显式的修订治理告警" />
          </a-card>

          <a-card title="当前活动项目" size="small">
            <StateEmpty v-if="!activeProject" description="暂无活动项目" />
            <a-descriptions v-else bordered size="small" :column="1">
              <a-descriptions-item label="项目名称">{{ activeProject.name }}</a-descriptions-item>
              <a-descriptions-item label="所属模块">{{ moduleLabels[activeProject.module] || activeProject.module }}</a-descriptions-item>
              <a-descriptions-item label="修订 / 阶段">{{ activeProject.revisionCode }} / {{ getLifecycleLabel(activeProject.lifecycleStatus) }}</a-descriptions-item>
              <a-descriptions-item label="最后更新时间">{{ new Date(activeProject.updatedAt).toLocaleString() }}</a-descriptions-item>
              <a-descriptions-item label="工作流关联">
                模块收藏 {{ activeProjectSummary?.favoriteCount ?? 0 }} · 模块最近计算 {{ activeProjectSummary?.recentCount ?? 0 }} · 项目报告 {{ activeProjectSummary?.reportCount ?? 0 }}
              </a-descriptions-item>
              <a-descriptions-item label="正式对象链">
                运行 {{ activeProjectSummary?.workflowInsight.runCount ?? 0 }} · 结果 {{ activeProjectSummary?.workflowInsight.resultCount ?? 0 }} · 快照 {{ activeProjectSummary?.workflowInsight.snapshotCount ?? 0 }}
              </a-descriptions-item>
              <a-descriptions-item label="变更 / 审批 / 事件">
                变更 {{ activeProjectSummary?.changeControl.changeCount ?? 0 }} · 待批 {{ activeProjectSummary?.changeControl.pendingApprovalCount ?? 0 }} · 事件 {{ activeProjectSummary?.changeControl.eventCount ?? 0 }}
              </a-descriptions-item>
              <a-descriptions-item label="零件 / 修订 / 文档">
                零件 {{ activeProjectSummary?.engineering.partCount ?? 0 }} · BOM 修订 {{ activeProjectSummary?.engineering.bomRevisionCount ?? 0 }} · 文档 {{ activeProjectSummary?.engineering.attachmentCount ?? 0 }}
              </a-descriptions-item>
              <a-descriptions-item label="发布就绪">
                {{
                  activeProjectSummary?.release.readinessStatus === 'ready'
                    ? '就绪'
                    : activeProjectSummary?.release.readinessStatus === 'warning'
                      ? '待完善'
                      : '阻塞'
                }}
              </a-descriptions-item>
              <a-descriptions-item label="冻结状态">
                <a-tag v-if="activeProject" :color="resolveWorkflowFreezeState(activeProject.lifecycleStatus).color">
                  {{ resolveWorkflowFreezeState(activeProject.lifecycleStatus).label }}
                </a-tag>
              </a-descriptions-item>
            </a-descriptions>
            <a-space v-if="activeProject" wrap style="margin-top: 12px">
              <a-button size="small" type="primary" @click="openReleasePanel(activeProject)">
                发布面板
              </a-button>
              <a-button size="small" @click="exportProjectFreezeSnapshot(activeProject)">
                冻结快照
              </a-button>
              <a-button size="small" @click="deriveProjectRevision(activeProject)">
                派生修订
              </a-button>
            </a-space>
            <div class="section-note">
              项目导出现在会附带模块收藏模板、最近计算摘要、正式对象概览和直接关联报告；发布摘要则专门用于看项目当前离正式发版还有哪些阻塞。
            </div>
          </a-card>

          <AlertStack :items="pageAlerts" />

          <CalculationDecisionPanel
            title="项目判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
        </template>

        <template #main>
          <StateEmpty v-if="projects.length === 0" :icon="InboxOutlined" description="暂无项目，点击新建项目或导入项目包开始" />

          <a-card v-else title="我的项目" size="small">
            <a-table
              :columns="[
                { title: '项目名称', dataIndex: 'name', key: 'name', width: '24%' },
                { title: '模块', dataIndex: 'module', key: 'module', width: '12%' },
                { title: '工作区', dataIndex: 'status', key: 'status', width: '9%' },
                { title: '阶段', dataIndex: 'lifecycleStatus', key: 'lifecycleStatus', width: '12%' },
                { title: '发布就绪', key: 'release', width: '11%' },
                { title: '模板/最近/报告', key: 'workspace', width: '14%' },
                { title: '运行/结果/快照', key: 'formal', width: '14%' },
                { title: '版本', dataIndex: 'version', key: 'version', width: '8%' },
                { title: '修订', dataIndex: 'revisionCode', key: 'revisionCode', width: '7%' },
                { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: '14%' },
                { title: '操作', key: 'actions', width: '18%' }
              ]"
              :data-source="projectRows"
              :pagination="{ pageSize: 10 }"
              size="small"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'module'">
                  <a-tag color="blue">{{ moduleLabels[record.module] || record.module }}</a-tag>
                </template>
                <template v-else-if="column.key === 'status'">
                  <a-tag :color="record.status === 'archived' ? 'default' : 'green'">
                    {{ record.status === 'archived' ? '已归档' : '进行中' }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'lifecycleStatus'">
                  <a-space wrap size="small">
                    <a-tag :color="getLifecycleColor(record.lifecycleStatus)">
                      {{ getLifecycleLabel(record.lifecycleStatus) }}
                    </a-tag>
                    <a-tag :color="resolveWorkflowFreezeState(record.lifecycleStatus).color">
                      {{ resolveWorkflowFreezeState(record.lifecycleStatus).label }}
                    </a-tag>
                  </a-space>
                </template>
                <template v-else-if="column.key === 'release'">
                  <div class="project-formal-cell">
                    <a-tag :color="record.releaseStatus === 'ready' ? 'green' : record.releaseStatus === 'warning' ? 'orange' : 'red'">
                      {{
                        record.releaseStatus === 'ready'
                          ? '就绪'
                          : record.releaseStatus === 'warning'
                            ? '待完善'
                            : '阻塞'
                      }}
                    </a-tag>
                    <small v-if="record.releaseBlockers.length">{{ record.releaseBlockers.join('；') }}</small>
                  </div>
                </template>
                <template v-else-if="column.key === 'workspace'">
                  <span>{{ record.favoriteCount }} / {{ record.recentCount }} / {{ record.reportCount }}</span>
                </template>
                <template v-else-if="column.key === 'formal'">
                  <div class="project-formal-cell">
                    <span>{{ record.formalRunCount }} / {{ record.resultCount }} / {{ record.snapshotCount }}</span>
                    <small v-if="record.warningCount || record.errorCount">
                      警告 {{ record.warningCount }} · 异常 {{ record.errorCount }}
                    </small>
                    <small v-else-if="record.pendingApprovalCount || record.changeCount">
                      变更 {{ record.changeCount }} · 待批 {{ record.pendingApprovalCount }} · 事件 {{ record.eventCount }}
                    </small>
                    <small v-else-if="record.partCount || record.attachmentCount">
                      零件 {{ record.partCount }} · 修订 {{ record.bomRevisionCount }} · 文档 {{ record.attachmentCount }}
                    </small>
                    <small v-else-if="record.lastResultAt">
                      最近 {{ new Date(record.lastResultAt).toLocaleString() }}
                    </small>
                  </div>
                </template>
                <template v-else-if="column.key === 'updatedAt'">
                  {{ new Date(record.updatedAt).toLocaleString() }}
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-space wrap>
                    <a-button type="link" size="small" @click="openProjectRow(record)">
                      <template #icon><FolderOpenOutlined /></template>{{ canActivateProjectWorkspace(record.lifecycleStatus) ? '打开' : '参考打开' }}
                    </a-button>
                    <a-button type="link" size="small" @click="toggleArchiveRow(record)">
                      {{ record.status === 'archived' ? '恢复' : '归档' }}
                    </a-button>
                    <a-button type="link" size="small" :disabled="!canAdvanceWorkflowStatus(record.lifecycleStatus)" @click="advanceLifecycleRow(record)">
                      推进阶段
                    </a-button>
                    <a-button type="link" size="small" @click="exportProjectRow(record)">
                      <template #icon><DownloadOutlined /></template>导出
                    </a-button>
                    <a-button type="link" size="small" @click="openReleasePanelRow(record)">
                      发布面板
                    </a-button>
                    <a-button type="link" size="small" @click="exportProjectReleaseBriefRow(record)">
                      发布摘要
                    </a-button>
                    <a-button type="link" size="small" @click="exportProjectFreezeSnapshotRow(record)">
                      冻结快照
                    </a-button>
                    <a-button type="link" size="small" @click="deriveProjectRevisionRow(record)">
                      派生修订
                    </a-button>
                    <a-button type="link" danger size="small" :disabled="!canDeleteWorkflowRecord(record.lifecycleStatus)" @click="deleteProject(record.id)">
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
      :open="showReleasePanelModal"
      :title="releasePanelData ? `${releasePanelData.project.name} 发布面板` : '发布面板'"
      width="1160"
      :footer="null"
      @cancel="closeReleasePanel"
    >
      <StateEmpty
        v-if="!releasePanelData && !releasePanelLoading"
        description="当前没有可展示的发布面板数据"
      />

      <div v-else class="release-panel-grid">
        <a-card size="small" title="发布判断" :loading="releasePanelLoading">
          <a-row :gutter="[12, 12]">
            <a-col :span="8">
              <a-statistic title="发布状态" :value="releasePanelData?.release.readinessStatus === 'ready' ? '就绪' : releasePanelData?.release.readinessStatus === 'warning' ? '待完善' : '阻塞'" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="归档报告" :value="releasePanelData?.linkedReports.length ?? 0" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="正式结果" :value="releasePanelData?.release.resultCount ?? 0" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="文档已发布" :value="`${releasePanelData?.release.releasedAttachmentCount ?? 0} / ${releasePanelData?.release.attachmentCount ?? 0}`" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="待批任务" :value="releasePanelData?.changeControl.pendingApprovalCount ?? 0" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="未闭环变更" :value="releasePanelData?.changeControl.openChangeCount ?? 0" />
            </a-col>
          </a-row>
          <div class="section-note">
            {{ releasePanelData?.release.blockers.length ? releasePanelData.release.blockers.join('；') : '当前已经具备最小发布基线，可以进入正式发版准备。' }}
          </div>
          <a-space wrap>
            <a-button
              v-if="releasePanelData"
              size="small"
              type="primary"
              @click="exportProjectReleaseBrief(releasePanelData.project)"
            >
              导出发布摘要
            </a-button>
            <a-button
              v-if="releasePanelData"
              size="small"
              @click="exportProjectFreezeSnapshot(releasePanelData.project)"
            >
              导出冻结快照
            </a-button>
            <a-button
              v-if="releasePanelData"
              size="small"
              @click="deriveProjectRevision(releasePanelData.project)"
            >
              派生新修订
            </a-button>
          </a-space>
        </a-card>

        <a-card size="small" title="发布门禁检查" :loading="releasePanelLoading">
          <div class="release-check-list">
            <article
              v-for="item in releasePanelData?.gateChecks ?? []"
              :key="item.key"
              class="release-check-item"
            >
              <div class="release-check-item__head">
                <strong>{{ item.label }}</strong>
                <a-tag :color="item.status === 'pass' ? 'green' : item.status === 'warning' ? 'orange' : 'red'">
                  {{ item.status === 'pass' ? '通过' : item.status === 'warning' ? '待补齐' : '阻塞' }}
                </a-tag>
              </div>
              <div class="release-check-item__desc">{{ item.description }}</div>
            </article>
          </div>
        </a-card>

        <a-card size="small" title="治理收口状态" :loading="releasePanelLoading">
          <StateEmpty
            v-if="!releaseGovernanceProjectSummary"
            description="当前项目还没有可汇总的治理对象"
          />
          <a-row v-else :gutter="[12, 12]">
            <a-col :span="8">
              <a-statistic title="治理完成度" :value="Math.round(releaseGovernanceProjectSummary.completionRate * 100)" suffix="%" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="当前最新占比" :value="Math.round(releaseGovernanceProjectSummary.currentRate * 100)" suffix="%" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="可直接修复" :value="releaseGovernanceProjectSummary.repairableAlerts" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="需人工复核" :value="releaseGovernanceProjectSummary.reviewAlerts" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="滞后修订" :value="releaseGovernanceProjectSummary.staleNodes" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="一致性告警" :value="releaseGovernanceProjectSummary.inconsistentNodes" />
            </a-col>
          </a-row>
          <div v-if="releaseGovernanceProjectSummary" class="section-note">
            治理完成度表示当前项目中既是最新修订且不存在显式一致性问题的对象占比；当前最新占比只看是否仍挂旧修订。
          </div>
        </a-card>

        <a-card size="small" title="滞后与修复建议" :loading="releasePanelLoading">
          <StateEmpty
            v-if="releasePanelGovernanceAlerts.length === 0"
            description="当前项目没有识别到显式的滞后修订或一致性告警"
          />
          <div v-else class="release-check-list">
            <article
              v-for="alert in releasePanelGovernanceAlerts.slice(0, 8)"
              :key="`${alert.objectType}-${alert.nodeId}-${alert.summary}`"
              class="release-check-item"
            >
              <div class="release-check-item__head">
                <strong>{{ alert.summary }}</strong>
                <a-tag :color="alert.level === 'warning' ? 'orange' : 'blue'">
                  {{ alert.objectType }}
                </a-tag>
              </div>
              <div class="release-check-item__desc">{{ alert.title }} · {{ alert.recommendation }}</div>
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
        </a-card>

        <div class="release-panel-columns">
          <a-card size="small" title="待处理审批 / 异常结果" :loading="releasePanelLoading">
            <div class="release-object-list">
              <StateEmpty
                v-if="(releasePanelData?.pendingApprovals.length ?? 0) === 0 && (releasePanelData?.abnormalResults.length ?? 0) === 0"
                description="当前没有待批任务或异常结果"
              />
              <article
                v-for="item in releasePanelData?.pendingApprovals ?? []"
                :key="item.id"
                class="release-object-item"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.approvalRole || '审批任务' }} · {{ item.assigneeName || '待分配' }}</span>
              </article>
              <article
                v-for="item in releasePanelData?.abnormalResults ?? []"
                :key="item.id"
                class="release-object-item"
              >
                <strong>{{ item.summary || `${item.module} 结果对象` }}</strong>
                <span>{{ item.resultKind }} · {{ item.status }} · {{ new Date(item.updatedAt).toLocaleString() }}</span>
              </article>
            </div>
          </a-card>

          <a-card size="small" title="文档 / 报告 / BOM" :loading="releasePanelLoading">
            <div class="release-object-list">
              <article
                v-for="item in releasePanelData?.unreleasedDocuments ?? []"
                :key="item.id"
                class="release-object-item"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.documentKind }} · {{ item.status || '未标注状态' }}</span>
              </article>
              <article
                v-for="item in releasePanelData?.linkedReports ?? []"
                :key="item.id"
                class="release-object-item"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.type.toUpperCase() }} · {{ item.workflowStatus || item.status }}</span>
              </article>
              <article
                v-if="releasePanelData?.linkedBomDraft"
                class="release-object-item"
              >
                <strong>{{ releasePanelData.linkedBomDraft.bomId || '最近 BOM 草稿' }}</strong>
                <span>{{ releasePanelData.linkedBomDraft.status || 'draft' }} · {{ releasePanelData.linkedBomDraft.revision || 'A' }}</span>
              </article>
              <StateEmpty
                v-if="(releasePanelData?.unreleasedDocuments.length ?? 0) === 0 && (releasePanelData?.linkedReports.length ?? 0) === 0 && !releasePanelData?.linkedBomDraft"
                description="当前没有可展示的交付物对象"
              />
            </div>
          </a-card>
        </div>

        <a-card size="small" title="冻结范围摘要" :loading="releasePanelLoading">
          <a-descriptions bordered size="small" :column="2">
            <a-descriptions-item label="项目阶段">{{ releasePanelData?.project.lifecycleStatus || '未标注' }}</a-descriptions-item>
            <a-descriptions-item label="项目修订">{{ releasePanelData?.project.revisionCode || '未标注' }}</a-descriptions-item>
            <a-descriptions-item label="零件 / 供应商料号">{{ releasePanelData?.engineering.partCount ?? 0 }} / {{ releasePanelData?.release.supplierPartCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item label="BOM 修订 / 文档">{{ releasePanelData?.engineering.bomRevisionCount ?? 0 }} / {{ releasePanelData?.engineering.attachmentCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item label="运行 / 结果 / 快照">{{ releasePanelData?.release.runCount ?? 0 }} / {{ releasePanelData?.release.resultCount ?? 0 }} / {{ releasePanelData?.release.snapshotCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item label="事件日志">{{ releasePanelData?.changeControl.eventCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item :span="2" label="最近事件">
              {{ releasePanelData?.recentEvents.length ? `${releasePanelData.recentEvents[0].summary} · ${new Date(releasePanelData.recentEvents[0].eventAt).toLocaleString()}` : '当前没有正式事件日志' }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card size="small" title="修订链与一致性" :loading="releasePanelLoading">
          <a-row :gutter="[12, 12]">
            <a-col :span="8"><a-statistic title="祖先链" :value="Math.max(releaseProjectLineage.ancestry.length - 1, 0)" /></a-col>
            <a-col :span="8"><a-statistic title="直接下游" :value="releaseProjectLineage.children.length" /></a-col>
            <a-col :span="8"><a-statistic title="全链后代" :value="releaseProjectLineage.descendants.length" /></a-col>
          </a-row>
          <div v-if="releaseProjectLineage.ancestry.length" class="release-check-list" style="margin-top: 12px">
            <article
              v-for="node in releaseProjectLineage.ancestry"
              :key="node.id"
              class="release-check-item"
            >
              <div class="release-check-item__head">
                <strong>{{ node.title }}</strong>
                <a-tag>{{ node.revisionCode || 'A' }}</a-tag>
              </div>
              <div class="release-check-item__desc">{{ node.status || '未标注状态' }}</div>
            </article>
          </div>
          <StateEmpty v-else description="当前项目没有可识别的修订祖先链" />
          <div class="release-check-list" style="margin-top: 12px">
            <article
              v-for="check in releaseProjectLineage.consistencyChecks"
              :key="`${check.level}-${check.summary}`"
              class="release-check-item"
            >
              <div class="release-check-item__head">
                <strong>{{ check.level === 'warning' ? '警告' : '信息' }} · {{ check.summary }}</strong>
              </div>
              <div class="release-check-item__desc">{{ check.detail }}</div>
            </article>
          </div>
        </a-card>
      </div>
    </a-modal>

    <a-modal
      v-model:open="showNewProjectModal"
      title="新建项目"
      @ok="createProject"
      :ok-button-props="{ disabled: !newProjectName.trim() }"
    >
      <a-form layout="vertical">
        <a-form-item label="项目名称" required>
          <a-input v-model:value="newProjectName" placeholder="如：泵密封方案A" />
        </a-form-item>
        <a-form-item label="计算模块">
          <a-select v-model:value="selectedModule">
            <a-select-option value="seals">密封圈计算</a-select-option>
            <a-select-option value="bearings">轴承选型</a-select-option>
            <a-select-option value="bolts">螺栓连接</a-select-option>
            <a-select-option value="tolerances">公差配合</a-select-option>
            <a-select-option value="param-scan">参数扫描</a-select-option>
            <a-select-option value="monte-carlo">蒙特卡洛</a-select-option>
            <a-select-option value="bom-export">BOM 导出</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.project-center-page {
  max-width: 1320px;
  margin: 0 auto;
}

.hidden-input {
  display: none;
}

.project-formal-cell {
  display: grid;
  gap: 4px;
}

.project-formal-cell small {
  color: var(--text-secondary);
  line-height: 1.6;
}

.release-panel-grid {
  display: grid;
  gap: 16px;
}

.release-panel-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.release-check-list,
.release-object-list {
  display: grid;
  gap: 10px;
}

.release-check-item,
.release-object-item {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--content-border);
  border-radius: 12px;
  background: var(--surface-raised);
}

.release-check-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.release-check-item__desc,
.release-object-item span {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 12px;
}

@media (max-width: 900px) {
  .release-panel-columns {
    grid-template-columns: 1fr;
  }
}
</style>
