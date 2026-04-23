<script setup lang="ts">
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
import { CALCULATION_RUNS_EVENT } from '../utils/calculation-runs'
import {
  appendObjectEventLog,
  CHANGE_CONTROL_EVENT,
  fetchChangeControlSnapshot,
  upsertApprovalTask,
  upsertChangeCase,
  type ChangeControlSnapshot,
} from '../utils/change-control'
import {
  ENGINEERING_LIBRARY_EVENT,
  upsertDocumentAttachment,
} from '../utils/engineering-library'
import {
  buildEngineeringObjectGroupStats,
  fetchEngineeringObjectSearchSnapshot,
  getEngineeringObjectFilterMeta,
  getEngineeringObjectTypeMeta,
  searchEngineeringObjects,
  type EngineeringObjectFilterGroup,
  type EngineeringObjectSearchItem,
} from '../utils/engineering-object-search'
import {
  canEditGovernedObject,
  resolveObjectFreezeState,
} from '../utils/governance-freeze'
import {
  appendStoredReport,
  fetchStoredReportsFresh,
  getReportModuleMeta,
  REPORTS_STORAGE_EVENT,
  type ReportRecord,
  upsertStoredReportDerivationMeta,
} from '../utils/reporting'
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
import { WORKFLOW_ARTIFACTS_EVENT } from '../utils/workflow-artifacts'
import {
  saveActiveProject,
  upsertStoredProject,
  WORKSPACE_STORAGE_EVENT,
  type WorkspaceProject,
} from '../utils/workspace'
import {
  ApartmentOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()
const feedback = useAppFeedback()
const loading = ref(false)
const hasLoadedOnce = ref(false)
const lastSyncedAt = ref<string | null>(null)
const syncError = ref('')
const actionLoading = ref(false)
const activeProject = ref<WorkspaceProject | null>(null)
const projects = ref<WorkspaceProject[]>([])
const items = ref<EngineeringObjectSearchItem[]>([])
const changeControlSnapshot = ref<ChangeControlSnapshot>({
  changes: [],
  approvals: [],
  events: [],
})
const searchQuery = ref('')
const selectedGroup = ref<EngineeringObjectFilterGroup>('all')
const activeProjectOnly = ref(false)
const selectedProjectId = ref<'all' | string>('all')
const pendingApprovalOnly = ref(false)
const unreleasedDocumentOnly = ref(false)
const detailVisible = ref(false)
const detailItem = ref<EngineeringObjectSearchItem | null>(null)
const compareVisible = ref(false)
const compareBaseItem = ref<EngineeringObjectSearchItem | null>(null)
const compareTargetItem = ref<EngineeringObjectSearchItem | null>(null)
const governanceWorkbenchVisible = ref(false)
const governanceFilterType = ref<'all' | 'project' | 'report' | 'document'>('all')
const governanceFilterLevel = ref<'all' | 'warning' | 'info'>('all')
const governanceRepairHistory = ref<Array<{
  id: string
  objectType: RevisionGovernanceAlert['objectType']
  sourceNodeId: string
  sourceTitle: string
  sourceRevisionCode?: string | null
  derivedNodeId: string
  derivedTitle: string
  derivedRevisionCode?: string | null
  repairedAt: string
  summary: string
}>>([])
let searchSyncRequestId = 0

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

const groupOrder: EngineeringObjectFilterGroup[] = ['all', 'document', 'part', 'report', 'project', 'change', 'bom', 'run']

const resultColumns = [
  { title: '对象', key: 'title', width: '28%' },
  { title: '类型', key: 'type', width: '10%' },
  { title: '项目 / 模块', key: 'project', width: '16%' },
  { title: '来源', key: 'source', width: '13%' },
  { title: '更新时间', key: 'updatedAt', width: '11%' },
  { title: '操作', key: 'actions', width: '22%' },
]

const baselineColumns = [
  { title: '项目', key: 'project', width: '20%' },
  { title: '发布就绪', key: 'readiness', width: '12%' },
  { title: '文档发布率', key: 'documents', width: '16%' },
  { title: '变更 / 待批', key: 'changes', width: '16%' },
  { title: '零件 / BOM', key: 'parts', width: '16%' },
  { title: '报告 / 运行结果', key: 'runs', width: '14%' },
  { title: '主要阻塞', key: 'blockers', width: '14%' },
  { title: '动作', key: 'actions', width: '12%' },
]

function asWorkflowObjectType(value: string): WorkflowChangeObjectType {
  if (
    value === 'project' ||
    value === 'report' ||
    value === 'bom' ||
    value === 'run' ||
    value === 'result' ||
    value === 'part' ||
    value === 'document'
  ) {
    return value
  }
  return 'document'
}

async function syncSearchSnapshot(options: { silent?: boolean } = {}) {
  const requestId = ++searchSyncRequestId
  loading.value = true

  try {
    const [snapshot, nextChangeControl] = await Promise.all([
      fetchEngineeringObjectSearchSnapshot(),
      fetchChangeControlSnapshot({ changeLimit: 320, approvalLimit: 360, eventLimit: 420 }),
    ])

    if (requestId !== searchSyncRequestId) return

    activeProject.value = snapshot.activeProject
    projects.value = snapshot.projects
    items.value = snapshot.items
    changeControlSnapshot.value = nextChangeControl

    if (selectedProjectId.value !== 'all' && !snapshot.projects.some((project) => project.id === selectedProjectId.value)) {
      selectedProjectId.value = 'all'
    }

    if (!snapshot.activeProject) {
      activeProjectOnly.value = false
    }

    if (detailItem.value) {
      const refreshed = snapshot.items.find((item) => item.id === detailItem.value?.id)
      detailItem.value = refreshed ?? detailItem.value
    }

    lastSyncedAt.value = new Date().toISOString()
    syncError.value = ''
  } catch (error) {
    if (requestId !== searchSyncRequestId) return

    syncError.value = getErrorMessage(error, '文档索引同步失败')
    if (!options.silent) {
      feedback.error(syncError.value)
    }
  } finally {
    if (requestId === searchSyncRequestId) {
      loading.value = false
      hasLoadedOnce.value = true
    }
  }
}

function handleSnapshotChanged() {
  void syncSearchSnapshot({ silent: true })
}

onMounted(() => {
  void syncSearchSnapshot({ silent: true })
  window.addEventListener(WORKSPACE_STORAGE_EVENT, handleSnapshotChanged)
  window.addEventListener(REPORTS_STORAGE_EVENT, handleSnapshotChanged)
  window.addEventListener(WORKFLOW_ARTIFACTS_EVENT, handleSnapshotChanged)
  window.addEventListener(CALCULATION_RUNS_EVENT, handleSnapshotChanged)
  window.addEventListener(CHANGE_CONTROL_EVENT, handleSnapshotChanged)
  window.addEventListener(ENGINEERING_LIBRARY_EVENT, handleSnapshotChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener(WORKSPACE_STORAGE_EVENT, handleSnapshotChanged)
  window.removeEventListener(REPORTS_STORAGE_EVENT, handleSnapshotChanged)
  window.removeEventListener(WORKFLOW_ARTIFACTS_EVENT, handleSnapshotChanged)
  window.removeEventListener(CALCULATION_RUNS_EVENT, handleSnapshotChanged)
  window.removeEventListener(CHANGE_CONTROL_EVENT, handleSnapshotChanged)
  window.removeEventListener(ENGINEERING_LIBRARY_EVENT, handleSnapshotChanged)
})

const projectOptions = computed(() => [
  { value: 'all', label: '全部项目' },
  ...projects.value.map((project) => ({
    value: project.id,
    label: project.name,
  })),
])

const effectiveProjectId = computed(() => {
  if (selectedProjectId.value !== 'all') return selectedProjectId.value
  if (activeProjectOnly.value && activeProject.value) return activeProject.value.id
  return null
})

const filteredResults = computed(() =>
  searchEngineeringObjects(items.value, {
    query: searchQuery.value,
    filterGroup: selectedGroup.value,
    projectId: effectiveProjectId.value,
  }).filter((item) => {
    if (pendingApprovalOnly.value && !(item.type === 'approval' && item.status === 'pending')) {
      return false
    }
    if (unreleasedDocumentOnly.value && !(item.type === 'document' && item.status !== 'released')) {
      return false
    }
    return true
  }),
)

const groupStats = computed(() => buildEngineeringObjectGroupStats(items.value))
const filteredGroupStats = computed(() => buildEngineeringObjectGroupStats(filteredResults.value))
const pendingApprovalCount = computed(() => items.value.filter((item) => item.type === 'approval' && item.status === 'pending').length)
const releasedDocumentCount = computed(() => items.value.filter((item) => item.type === 'document' && item.status === 'released').length)
const currentProjectItems = computed(() => {
  if (!activeProject.value) return []
  return items.value.filter((item) => item.projectId === activeProject.value?.id)
})
const selectedProject = computed(() => {
  if (selectedProjectId.value === 'all') return null
  return projects.value.find((project) => project.id === selectedProjectId.value) ?? null
})
const currentScopeLabel = computed(() => {
  if (selectedProject.value) return `项目：${selectedProject.value.name}`
  if (activeProjectOnly.value && activeProject.value) return `活动项目：${activeProject.value.name}`
  return '全局工作空间'
})

const filteredSummaryMetrics = computed(() => [
  { label: '命中文档', value: String(filteredGroupStats.value.document) },
  { label: '命中零件', value: String(filteredGroupStats.value.part) },
  { label: '命中变更', value: String(filteredGroupStats.value.change) },
  { label: '命中运行结果', value: String(filteredGroupStats.value.run) },
])
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
const governanceNodes = computed(() =>
  items.value
    .filter((item): item is EngineeringObjectSearchItem & { type: 'project' | 'report' | 'document' } =>
      item.type === 'project' || item.type === 'report' || item.type === 'document',
    )
    .filter((item) => !effectiveProjectId.value || item.projectId === effectiveProjectId.value || (item.type === 'project' && item.objectId === effectiveProjectId.value))
    .map((item) => {
      const previewPayload = item.previewPayload as Record<string, unknown> | null
      const nestedPayload =
        previewPayload && typeof previewPayload === 'object' && 'payload' in previewPayload
          ? previewPayload.payload
          : null
      const derivationMeta =
        previewPayload && typeof previewPayload === 'object' && 'derivationMeta' in previewPayload
          ? previewPayload.derivationMeta
          : null
      const parentId =
        item.type === 'project'
          ? projectDerivationMap.value.get(item.objectId)?.parentId ?? null
          : item.type === 'report'
            ? derivationMeta && typeof derivationMeta === 'object' && 'derivedFromReportId' in derivationMeta && typeof derivationMeta.derivedFromReportId === 'string'
              ? derivationMeta.derivedFromReportId
              : null
            : nestedPayload && typeof nestedPayload === 'object' && 'derivedFromDocumentId' in nestedPayload && typeof nestedPayload.derivedFromDocumentId === 'string'
              ? nestedPayload.derivedFromDocumentId
              : null
      const referenceLock =
        item.type === 'project'
          ? projectDerivationMap.value.get(item.objectId)?.referenceLock ?? null
          : item.type === 'report'
            ? derivationMeta && typeof derivationMeta === 'object' && 'referenceLock' in derivationMeta && derivationMeta.referenceLock && typeof derivationMeta.referenceLock === 'object'
              ? (derivationMeta.referenceLock as Record<string, unknown>)
              : null
            : nestedPayload && typeof nestedPayload === 'object' && 'referenceLock' in nestedPayload && nestedPayload.referenceLock && typeof nestedPayload.referenceLock === 'object'
              ? (nestedPayload.referenceLock as Record<string, unknown>)
              : null
      return {
        id: item.entityId,
        title: item.title,
        revisionCode: item.revisionCode,
        status: item.status,
        updatedAt: item.updatedAt,
        parentId,
        referenceLock,
        objectType: item.type,
        projectId: item.projectId ?? null,
        routePath: item.routePath,
      }
    }),
)
const governanceSnapshot = computed(() =>
  analyzeRevisionGovernance(governanceNodes.value, resolveObjectFreezeState),
)
const governanceWorkbenchAlerts = computed(() =>
  governanceSnapshot.value.alerts.filter((alert) => {
    const matchesType = governanceFilterType.value === 'all' || alert.objectType === governanceFilterType.value
    const matchesLevel = governanceFilterLevel.value === 'all' || alert.level === governanceFilterLevel.value
    return matchesType && matchesLevel
  }),
)
const governancePriorityAlerts = computed(() =>
  governanceWorkbenchAlerts.value.filter((alert) => alert.priority === 'high' || alert.repairability === 'repairable').slice(0, 6),
)
const governanceExecutionMetrics = computed(() => [
  { label: '可直接修复', value: governanceSnapshot.value.repairableAlerts },
  { label: '需人工复核', value: governanceSnapshot.value.reviewAlerts },
  { label: '基线参考', value: governanceSnapshot.value.referenceAlerts },
  { label: '最近修复', value: governanceRepairHistory.value.length },
])
const governanceHealthMetrics = computed(() => [
  { label: '当前最新', value: governanceSnapshot.value.currentNodes, suffix: `${Math.round(governanceSnapshot.value.currentRate * 100)}%` },
  { label: '治理完成', value: governanceSnapshot.value.healthyNodes, suffix: `${Math.round(governanceSnapshot.value.completionRate * 100)}%` },
])
const governanceProjectSummaryColumns = [
  { title: '项目', key: 'projectName', width: '24%' },
  { title: '治理完成度', key: 'completion', width: '16%' },
  { title: '当前最新占比', key: 'current', width: '16%' },
  { title: '可修复 / 复核', key: 'actions', width: '16%' },
  { title: '滞后 / 一致性', key: 'issues', width: '16%' },
  { title: '治理对象', key: 'totalNodes', width: '12%' },
]
const governanceProjectRows = computed(() =>
  governanceSnapshot.value.projectSummaries
    .filter((item) => item.projectId)
    .map((summary) => {
      const project = projects.value.find((item) => item.id === summary.projectId) ?? null
      return {
        id: summary.projectId!,
        projectName: project?.name ?? summary.projectId ?? '未命名项目',
        completionRateText: `${Math.round(summary.completionRate * 100)}%`,
        currentRateText: `${Math.round(summary.currentRate * 100)}%`,
        repairableAlerts: summary.repairableAlerts,
        reviewAlerts: summary.reviewAlerts,
        staleNodes: summary.staleNodes,
        inconsistentNodes: summary.inconsistentNodes,
        totalNodes: summary.totalNodes,
      }
    })
    .slice(0, 8),
)

const detailLinkedItems = computed(() => {
  if (!detailItem.value) return []
  return items.value
    .filter((item) => {
      if (item.id === detailItem.value?.id) return false
      return item.objectType === detailItem.value?.objectType && item.objectId === detailItem.value?.objectId
    })
    .slice(0, 8)
})

const detailProjectItems = computed(() => {
  if (!detailItem.value?.projectId) return []
  return items.value
    .filter((item) => item.id !== detailItem.value?.id && item.projectId === detailItem.value?.projectId)
    .slice(0, 8)
})

const detailModuleItems = computed(() => {
  if (!detailItem.value?.module) return []
  return items.value
    .filter((item) => item.id !== detailItem.value?.id && item.module === detailItem.value?.module)
    .slice(0, 8)
})

const detailRelatedChanges = computed(() =>
  detailLinkedItems.value.filter((item) => item.type === 'change'),
)

const detailRelatedApprovals = computed(() =>
  detailLinkedItems.value.filter((item) => item.type === 'approval'),
)

const detailPendingApprovals = computed(() =>
  detailRelatedApprovals.value.filter((item) => item.status === 'pending'),
)

const detailKeywords = computed(() => detailItem.value?.keywords.slice(0, 10) ?? [])
const detailEventLogs = computed(() => {
  if (!detailItem.value) return []
  return changeControlSnapshot.value.events
    .filter(
      (event) =>
        event.objectType === asWorkflowObjectType(detailItem.value!.objectType) &&
        event.objectId === detailItem.value!.objectId,
    )
    .sort((left, right) => right.eventAt.localeCompare(left.eventAt))
    .slice(0, 12)
})

const detailVersionHistory = computed(() => {
  if (!detailItem.value) return []
  return items.value
    .filter((item) => {
      if (item.id === detailItem.value?.id) return false
      if (item.type !== detailItem.value?.type) return false
      return item.objectType === detailItem.value?.objectType && item.objectId === detailItem.value?.objectId
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 8)
})
const detailPreviousVersion = computed(() => detailVersionHistory.value[0] ?? null)
const detailPreviewText = computed(() => {
  if (!detailItem.value?.previewPayload) return ''
  return JSON.stringify(detailItem.value.previewPayload, null, 2)
})
const detailFreezeState = computed(() =>
  detailItem.value ? resolveObjectFreezeState(detailItem.value.status) : null,
)
const detailReferenceLock = computed(() => {
  const previewPayload = detailItem.value?.previewPayload
  if (!previewPayload || typeof previewPayload !== 'object') return null
  const nestedPayload = 'payload' in previewPayload ? previewPayload.payload : null
  const nestedDerivation = 'derivationMeta' in previewPayload ? previewPayload.derivationMeta : null
  const referenceLock =
    nestedPayload && typeof nestedPayload === 'object' && 'referenceLock' in nestedPayload
      ? nestedPayload.referenceLock
      : nestedDerivation && typeof nestedDerivation === 'object' && 'referenceLock' in nestedDerivation
        ? nestedDerivation.referenceLock
        : null
  if (!referenceLock || typeof referenceLock !== 'object') return null
  return referenceLock as Record<string, unknown>
})
const detailFreezeSummary = computed(() => {
  if (!detailItem.value) return null

  const blockers = [
    ...(detailPendingApprovals.value.length > 0 ? [`${detailPendingApprovals.value.length} 条待批任务`] : []),
    ...((detailItem.value.status ?? 'draft') === 'draft' ? ['当前对象仍处于草稿态'] : []),
    ...(detailVersionHistory.value.length === 0 ? ['尚未形成可比较版本链'] : []),
  ]
  const state = resolveObjectFreezeState(detailItem.value.status)

  return {
    phase: state.phase,
    label: state.label,
    description: state.description,
    color: state.color,
    isReadOnly: state.isReadOnly,
    blockers,
  }
})
const detailRevisionLineage = computed(() => {
  if (!detailItem.value) return buildRevisionLineage([], null)

  if (detailItem.value.type === 'document') {
    const nodes = items.value
      .filter((item) => item.type === 'document')
      .map((item) => {
        const previewPayload = item.previewPayload as Record<string, unknown> | null
        const payload =
          previewPayload && typeof previewPayload === 'object' && 'payload' in previewPayload
            ? previewPayload.payload
            : null
        const parentId =
          payload && typeof payload === 'object' && 'derivedFromDocumentId' in payload && typeof payload.derivedFromDocumentId === 'string'
            ? payload.derivedFromDocumentId
            : null
        const referenceLock =
          payload && typeof payload === 'object' && 'referenceLock' in payload && typeof payload.referenceLock === 'object'
            ? (payload.referenceLock as Record<string, unknown>)
            : null
        return {
          id: item.entityId,
          title: item.title,
          revisionCode: item.revisionCode,
          status: item.status,
          updatedAt: item.updatedAt,
          parentId,
          referenceLock,
        }
      })
    return buildRevisionLineage(nodes, detailItem.value.entityId, {
      freezeResolver: resolveObjectFreezeState,
      typeLabel: '文档',
    })
  }

  if (detailItem.value.type === 'report') {
    const nodes = items.value
      .filter((item) => item.type === 'report')
      .map((item) => {
        const previewPayload = item.previewPayload as Record<string, unknown> | null
        const derivationMeta =
          previewPayload && typeof previewPayload === 'object' && 'derivationMeta' in previewPayload
            ? previewPayload.derivationMeta
            : null
        const parentId =
          derivationMeta && typeof derivationMeta === 'object' && 'derivedFromReportId' in derivationMeta && typeof derivationMeta.derivedFromReportId === 'string'
            ? derivationMeta.derivedFromReportId
            : null
        const referenceLock =
          derivationMeta && typeof derivationMeta === 'object' && 'referenceLock' in derivationMeta && typeof derivationMeta.referenceLock === 'object'
            ? (derivationMeta.referenceLock as Record<string, unknown>)
            : null
        return {
          id: item.entityId,
          title: item.title,
          revisionCode: item.revisionCode,
          status: item.status,
          updatedAt: item.updatedAt,
          parentId,
          referenceLock,
        }
      })
    return buildRevisionLineage(nodes, detailItem.value.entityId, {
      freezeResolver: resolveObjectFreezeState,
      typeLabel: '报告',
    })
  }

  return buildRevisionLineage([], null)
})
const detailDiffSummary = computed(() => {
  if (!detailItem.value || !detailPreviousVersion.value) return []
  const changes: string[] = []
  if ((detailItem.value.revisionCode ?? '') !== (detailPreviousVersion.value.revisionCode ?? '')) {
    changes.push(`修订从 ${detailPreviousVersion.value.revisionCode ?? '未标注'} 变为 ${detailItem.value.revisionCode ?? '未标注'}`)
  }
  if ((detailItem.value.status ?? '') !== (detailPreviousVersion.value.status ?? '')) {
    changes.push(`状态从 ${detailPreviousVersion.value.status ?? '未标注'} 变为 ${detailItem.value.status ?? '未标注'}`)
  }
  if ((detailItem.value.fileName ?? '') !== (detailPreviousVersion.value.fileName ?? '')) {
    changes.push(`文件名从 ${detailPreviousVersion.value.fileName ?? '未标注'} 变为 ${detailItem.value.fileName ?? '未标注'}`)
  }
  if ((detailItem.value.summary ?? '') !== (detailPreviousVersion.value.summary ?? '')) {
    changes.push('摘要内容发生变化')
  }
  if (detailItem.value.updatedAt !== detailPreviousVersion.value.updatedAt) {
    changes.push(`更新时间更新为 ${new Date(detailItem.value.updatedAt).toLocaleString()}`)
  }
  return changes
})
const compareFieldRows = computed(() => {
  if (!compareBaseItem.value || !compareTargetItem.value) return []

  const rows = [
    {
      key: 'revisionCode',
      label: '修订',
      baseValue: compareBaseItem.value.revisionCode ?? '未标注',
      targetValue: compareTargetItem.value.revisionCode ?? '未标注',
    },
    {
      key: 'status',
      label: '状态',
      baseValue: compareBaseItem.value.status ?? '未标注',
      targetValue: compareTargetItem.value.status ?? '未标注',
    },
    {
      key: 'summary',
      label: '摘要',
      baseValue: compareBaseItem.value.summary ?? '未标注',
      targetValue: compareTargetItem.value.summary ?? '未标注',
    },
    {
      key: 'fileName',
      label: '文件名',
      baseValue: compareBaseItem.value.fileName ?? '未标注',
      targetValue: compareTargetItem.value.fileName ?? '未标注',
    },
    {
      key: 'documentKind',
      label: '文档类型',
      baseValue: compareBaseItem.value.documentKind ?? '未标注',
      targetValue: compareTargetItem.value.documentKind ?? '未标注',
    },
    {
      key: 'updatedAt',
      label: '更新时间',
      baseValue: new Date(compareBaseItem.value.updatedAt).toLocaleString(),
      targetValue: new Date(compareTargetItem.value.updatedAt).toLocaleString(),
    },
    {
      key: 'sourceLabel',
      label: '来源',
      baseValue: compareBaseItem.value.sourceLabel,
      targetValue: compareTargetItem.value.sourceLabel,
    },
  ]

  return rows.map((row) => ({
    ...row,
    changed: row.baseValue !== row.targetValue,
  }))
})
const comparePreviewBaseText = computed(() =>
  compareBaseItem.value?.previewPayload
    ? JSON.stringify(compareBaseItem.value.previewPayload, null, 2)
    : '',
)
const comparePreviewTargetText = computed(() =>
  compareTargetItem.value?.previewPayload
    ? JSON.stringify(compareTargetItem.value.previewPayload, null, 2)
    : '',
)
const compareSummary = computed(() => {
  const fieldChanges = compareFieldRows.value.filter((row) => row.changed)
  if (!compareBaseItem.value || !compareTargetItem.value) return []

  const summary = fieldChanges.map((row) => `${row.label}：${row.baseValue} -> ${row.targetValue}`)
  if (comparePreviewBaseText.value !== comparePreviewTargetText.value) {
    summary.push('结构化预览内容发生变化')
  }
  return summary
})

const projectBaselineRows = computed(() =>
  projects.value
    .map((project) => {
      const relevant = items.value.filter((item) => item.projectId === project.id)
      const documents = relevant.filter((item) => item.type === 'document')
      const releasedDocuments = documents.filter((item) => item.status === 'released')
      const changes = relevant.filter((item) => item.type === 'change')
      const openChanges = changes.filter((item) => item.status !== 'released' && item.status !== 'archived' && item.status !== 'rejected')
      const pendingApprovals = relevant.filter((item) => item.type === 'approval' && item.status === 'pending')
      const parts = relevant.filter((item) => item.type === 'part' || item.type === 'supplier-part')
      const boms = relevant.filter((item) => item.type === 'bom-link')
      const reports = relevant.filter((item) => item.type === 'report')
      const runResults = relevant.filter((item) => item.type === 'run' || item.type === 'result')
      const releasedRate = documents.length ? releasedDocuments.length / documents.length : 0
      const blockers = [
        ...(pendingApprovals.length > 0 ? [`${pendingApprovals.length} 条待批`] : []),
        ...(openChanges.length > 0 ? [`${openChanges.length} 条未闭环变更`] : []),
        ...(documents.length > 0 && releasedDocuments.length < documents.length ? ['存在未发布文档'] : []),
      ]
      const readinessStatus = pendingApprovals.length > 0 || openChanges.length > 0
        ? 'blocked'
        : documents.length > 0 && releasedRate < 1
          ? 'warning'
          : 'ready'
      return {
        id: project.id,
        project,
        documentCount: documents.length,
        releasedDocumentCount: releasedDocuments.length,
        pendingApprovalCount: pendingApprovals.length,
        openChangeCount: openChanges.length,
        partCount: parts.length,
        bomCount: boms.length,
        reportCount: reports.length,
        runResultCount: runResults.length,
        blockers,
        readinessStatus,
      }
    })
    .sort((left, right) => {
      if (right.pendingApprovalCount !== left.pendingApprovalCount) return right.pendingApprovalCount - left.pendingApprovalCount
      return right.documentCount - left.documentCount
    }),
)

const pageAlerts = computed(() => {
  const alerts: Array<{ level: 'info' | 'warning'; message: string; description?: string }> = []

  if (!activeProject.value) {
    alerts.push({
      level: 'warning',
      message: '当前没有活动项目上下文。',
      description: '统一检索仍可用，但跨对象过滤、文档追踪和审批收敛会明显变弱。',
    })
  }

  if (pendingApprovalCount.value > 0) {
    alerts.push({
      level: 'warning',
      message: `当前索引里还有 ${pendingApprovalCount.value} 条待审批任务。`,
      description: '建议优先清理待批对象，再继续放大正式文档与导出范围。',
    })
  }

  if (!filteredResults.value.length && (searchQuery.value.trim() || selectedGroup.value !== 'all' || activeProjectOnly.value || selectedProjectId.value !== 'all')) {
    alerts.push({
      level: 'info',
      message: '当前筛选条件下没有检索结果。',
      description: '可以放宽类型筛选、关闭项目范围过滤，或改用零件号、报告标题、供应商料号等关键词。',
    })
  }

  if (releasedDocumentCount.value === 0 && groupStats.value.document > 0) {
    alerts.push({
      level: 'info',
      message: '当前文档对象大多还停留在草稿或生成态。',
      description: '建议后续补齐 released / archived 状态流转，否则文档中心只能做检索，不能形成正式受控台账。',
    })
  }

  const frozenObjectCount = filteredResults.value.filter((item) => resolveObjectFreezeState(item.status).isReadOnly).length
  if (frozenObjectCount > 0) {
    alerts.push({
      level: 'info',
      message: `当前筛选结果中有 ${frozenObjectCount} 个对象处于只读冻结态。`,
      description: '这些对象更适合用于比较、导出和审查，不建议继续直接修改状态或重新发起治理动作。',
    })
  }

  if (governanceSnapshot.value.staleNodes > 0 || governanceSnapshot.value.inconsistentNodes > 0) {
    alerts.push({
      level: 'warning',
      message: `当前范围内有 ${governanceSnapshot.value.staleNodes} 个滞后修订、${governanceSnapshot.value.inconsistentNodes} 个一致性告警。`,
      description: '建议优先查看修订治理总览和对象详情里的修订链与一致性卡片，确认是否仍引用旧冻结基线。',
    })
  }
  const weakestProject = governanceProjectRows.value[0]
  if (weakestProject && weakestProject.repairableAlerts > 0) {
    alerts.push({
      level: 'warning',
      message: `项目“${weakestProject.projectName}”当前治理完成度仅 ${weakestProject.completionRateText}。`,
      description: `该项目仍有 ${weakestProject.repairableAlerts} 条可直接修复项、${weakestProject.reviewAlerts} 条需人工复核项，建议优先收口。`,
    })
  }

  return alerts
})

const decisionPanel = computed(() => ({
  conclusion: `${currentScopeLabel.value} 当前已聚合 ${groupStats.value.all} 个工程对象，本次筛选命中 ${filteredResults.value.length} 个结果，其中文档 ${filteredGroupStats.value.document} 个、零件 ${filteredGroupStats.value.part} 个、BOM ${filteredGroupStats.value.bom} 个、运行结果 ${filteredGroupStats.value.run} 个。`,
  status: filteredResults.value.length > 0 ? ('success' as const) : ('info' as const),
  risks: [
    ...(!activeProject.value ? ['未设置活动项目时，统一检索无法稳定承担“项目级台账”职责。'] : []),
    ...(pendingApprovalCount.value > 0 ? [`仍有 ${pendingApprovalCount.value} 条审批任务未闭环，正式对象链存在发布风险。`] : []),
  ],
  actions: [
    '优先把 BOM、报告和计算书导出的附件都在这里收敛，避免对象散落在各页面临时状态中。',
    '通过对象详情抽屉查看同对象链、同项目和同模块关联，并直接发起审批或执行状态流转。',
  ],
  boundaries: [
    '当前索引是基于本地正式对象和兼容缓存的聚合检索，不是全文知识库，也不替代 ERP/PDM 的签审体系。',
  ],
}))

function clearFilters() {
  searchQuery.value = ''
  selectedGroup.value = 'all'
  activeProjectOnly.value = false
  selectedProjectId.value = 'all'
  pendingApprovalOnly.value = false
  unreleasedDocumentOnly.value = false
}

function navigateTo(path: string) {
  void router.push(path)
}

function isSearchItemRecord(item: unknown): item is EngineeringObjectSearchItem {
  return Boolean(item && typeof item === 'object' && 'id' in item && 'routePath' in item)
}

function refreshSearchSnapshot() {
  void syncSearchSnapshot()
}

function inspectSearchItem(record: unknown) {
  if (!isSearchItemRecord(record)) return
  inspectItem(record)
}

function openSearchItem(record: unknown) {
  if (!isSearchItemRecord(record)) return
  openItem(record)
}

function focusSearchProject(record: unknown) {
  if (!isSearchItemRecord(record)) return
  focusProject(record)
}

function openItem(item: EngineeringObjectSearchItem) {
  void router.push(item.routePath)
}

function inspectItem(item: EngineeringObjectSearchItem) {
  detailItem.value = item
  detailVisible.value = true
}

function closeDetail() {
  detailVisible.value = false
  compareVisible.value = false
}

function openVersionCompare(base: EngineeringObjectSearchItem, target: EngineeringObjectSearchItem) {
  compareBaseItem.value = base
  compareTargetItem.value = target
  compareVisible.value = true
}

function compareWithPreviousVersion() {
  if (!detailItem.value || !detailPreviousVersion.value) {
    feedback.info('当前对象没有可比较的上一版本')
    return
  }
  openVersionCompare(detailPreviousVersion.value, detailItem.value)
}

function compareWithCurrentVersion(item: EngineeringObjectSearchItem) {
  if (!detailItem.value) return
  openVersionCompare(item, detailItem.value)
}

function closeCompareModal() {
  compareVisible.value = false
}

function focusProject(item: EngineeringObjectSearchItem) {
  if (!item.projectId) {
    feedback.info('该对象当前没有可识别的项目归属')
    return
  }
  selectedProjectId.value = item.projectId
  activeProjectOnly.value = false
  selectedGroup.value = 'all'
  searchQuery.value = ''
}

function applyGroupFilter(group: EngineeringObjectFilterGroup) {
  selectedGroup.value = group
}

function findGovernanceItem(nodeId?: string | null) {
  if (!nodeId) return null
  return (
    items.value.find((item) => item.entityId === nodeId && (item.type === 'project' || item.type === 'report' || item.type === 'document')) ??
    null
  )
}

function inspectGovernanceAlert(nodeId: string) {
  const target = findGovernanceItem(nodeId)
  if (!target) {
    feedback.info('当前治理提醒对应的对象未在索引中找到')
    return
  }
  inspectItem(target)
}

function openGovernanceWorkbench() {
  governanceWorkbenchVisible.value = true
}

function closeGovernanceWorkbench() {
  governanceWorkbenchVisible.value = false
}

function inspectGovernanceSuggested(nodeId?: string | null) {
  if (!nodeId) {
    feedback.info('当前治理建议没有可定位的目标对象')
    return
  }
  inspectGovernanceAlert(nodeId)
}

function openGovernanceRepairComparison(record: {
  sourceNodeId: string
  derivedNodeId: string
}) {
  const sourceItem = findGovernanceItem(record.sourceNodeId)
  const derivedItem = findGovernanceItem(record.derivedNodeId)
  if (!sourceItem || !derivedItem) {
    feedback.info('当前修复记录缺少可比较的对象版本')
    return
  }
  openVersionCompare(sourceItem, derivedItem)
}

function togglePendingApprovalsOnly() {
  pendingApprovalOnly.value = !pendingApprovalOnly.value
  if (pendingApprovalOnly.value) {
    unreleasedDocumentOnly.value = false
  }
}

function toggleUnreleasedDocumentOnly() {
  unreleasedDocumentOnly.value = !unreleasedDocumentOnly.value
  if (unreleasedDocumentOnly.value) {
    pendingApprovalOnly.value = false
  }
}

function exportFilteredResults() {
  const payload = {
    exportedAt: new Date().toISOString(),
    scope: currentScopeLabel.value,
    query: searchQuery.value,
    filterGroup: selectedGroup.value,
    projectId: effectiveProjectId.value,
    count: filteredResults.value.length,
    items: filteredResults.value,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `document-center-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  feedback.notifyExported('对象检索结果')
}

function exportProjectReleasePackage(projectId?: string | null) {
  const targetProject =
    (projectId ? projects.value.find((project) => project.id === projectId) : null) ??
    selectedProject.value ??
    activeProject.value

  if (!targetProject) {
    feedback.warning('当前没有可导出的项目发布包')
    return
  }

  const relevantItems = items.value.filter((item) => item.projectId === targetProject.id)
  const payload = {
    exportedAt: new Date().toISOString(),
    packageType: 'MechBox Project Release Package',
    project: targetProject,
    releaseBaseline: projectBaselineRows.value.find((row) => row.id === targetProject.id) ?? null,
    documents: relevantItems.filter((item) => item.type === 'document'),
    reports: relevantItems.filter((item) => item.type === 'report'),
    changes: relevantItems.filter((item) => item.type === 'change'),
    approvals: relevantItems.filter((item) => item.type === 'approval'),
    parts: relevantItems.filter((item) => item.type === 'part' || item.type === 'supplier-part'),
    boms: relevantItems.filter((item) => item.type === 'bom-link'),
    runResults: relevantItems.filter((item) => item.type === 'run' || item.type === 'result'),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${targetProject.name.replace(/\s+/g, '_')}-release-package.json`
  anchor.click()
  URL.revokeObjectURL(url)
  feedback.notifyExported('项目发布包')
}

async function copyPreviewPayload() {
  if (!detailPreviewText.value) {
    feedback.warning('当前对象没有可复制的预览内容')
    return
  }
  try {
    await navigator.clipboard.writeText(detailPreviewText.value)
    feedback.success('对象预览内容已复制')
  } catch {
    feedback.error('复制对象预览内容失败')
  }
}

function formatModuleLabel(module?: string) {
  if (!module) return '无模块上下文'
  return getReportModuleMeta(module).label
}

function buildDocumentAttachmentRecord(item: EngineeringObjectSearchItem): WorkflowDocumentAttachmentRecord | null {
  if (item.type !== 'document') return null
  return {
    id: item.entityId,
    projectId: item.projectId,
    objectType: asWorkflowObjectType(item.objectType),
    objectId: item.objectId,
    module: item.module,
    documentKind: (item.documentKind as WorkflowDocumentAttachmentRecord['documentKind']) ?? 'spec',
    title: item.title,
    fileName: item.fileName,
    mimeType: item.mimeType,
    storageType: (item.storageType as WorkflowDocumentAttachmentRecord['storageType']) ?? 'export-reference',
    revisionCode: item.revisionCode ?? 'A',
    createdAt: item.createdAt ?? item.updatedAt,
    createdBy: item.createdBy,
    status: (item.status as WorkflowDocumentAttachmentRecord['status']) ?? 'generated',
    checksum: item.checksum,
    payload: {
      sourceEntityType: item.entityType,
      sourceLabel: item.sourceLabel,
      projectName: item.projectName ?? null,
    },
  }
}

function buildChangeCaseRecord(item: EngineeringObjectSearchItem, nextStatus?: WorkflowChangeCaseRecord['status']): WorkflowChangeCaseRecord {
  return {
    id: item.type === 'change' ? item.entityId : `chg_${Date.now()}`,
    projectId: item.projectId,
    objectType: asWorkflowObjectType(item.objectType),
    objectId: item.objectId,
    changeCode: item.changeCode,
    title: item.type === 'change' ? item.title : `${item.title} 发布申请`,
    module: item.module,
    reason: item.reasonText ?? (item.type === 'document' ? '文档中心发起对象发布审批' : item.summary),
    impactSummary: item.impactSummary ?? item.summary,
    requestedBy: item.createdBy ?? 'MechBox 文档中心',
    requestedAt: item.createdAt ?? item.updatedAt,
    effectiveAt: nextStatus === 'released' ? new Date().toISOString() : undefined,
    status: nextStatus ?? ((item.status as WorkflowChangeCaseRecord['status']) || 'draft'),
    revisionCode: item.revisionCode ?? 'A',
    payload: {
      sourceEntityType: item.entityType,
      sourceEntityId: item.entityId,
      routePath: item.routePath,
    },
  }
}

async function updateDocumentStatus(nextStatus: WorkflowDocumentAttachmentRecord['status']) {
  if (!detailItem.value) return
  if (!canEditGovernedObject(detailItem.value.status)) {
    feedback.info('当前对象已进入只读冻结态，请通过比较、导出或新修订方式继续处理')
    return
  }
  const record = buildDocumentAttachmentRecord(detailItem.value)
  if (!record) {
    feedback.warning('当前对象不是可流转状态的文档附件')
    return
  }

  actionLoading.value = true
  try {
    await upsertDocumentAttachment({
      ...record,
      status: nextStatus,
    })
    await appendObjectEventLog({
      id: `evt_doc_status_${Date.now()}`,
      objectType: record.objectType,
      objectId: record.objectId,
      projectId: record.projectId,
      module: record.module,
      eventType: nextStatus === 'archived' ? 'archived' : 'status-changed',
      summary: `文档“${record.title}”状态更新为 ${nextStatus}`,
      actorName: 'MechBox 文档中心',
      eventAt: new Date().toISOString(),
      payload: {
        documentId: record.id,
        documentStatus: nextStatus,
      },
    })
    await syncSearchSnapshot()
    feedback.notifySaved('文档状态')
  } finally {
    actionLoading.value = false
  }
}

async function requestApprovalForCurrentItem() {
  if (!detailItem.value) return
  if (!canEditGovernedObject(detailItem.value.status)) {
    feedback.info('当前对象已进入只读冻结态，不能重复发起审批')
    return
  }
  if (detailPendingApprovals.value.length > 0) {
    feedback.warning('当前对象已存在待处理审批任务')
    return
  }

  const now = new Date().toISOString()
  const target = detailItem.value
  const changeId = `chg_${Date.now()}`
  const approvalId = `apv_${Date.now()}`

  actionLoading.value = true
  try {
    await upsertChangeCase({
      ...buildChangeCaseRecord(target, 'in-review'),
      id: changeId,
      requestedAt: now,
    })
    await upsertApprovalTask({
      id: approvalId,
      changeId,
      projectId: target.projectId,
      objectType: asWorkflowObjectType(target.objectType),
      objectId: target.objectId,
      module: target.module,
      title: `审批：${target.title}`,
      approvalRole: '工程负责人',
      assigneeName: target.projectName ? `${target.projectName} 负责人` : '待指派',
      decisionStatus: 'pending',
      seqNo: 1,
      createdAt: now,
      updatedAt: now,
      payload: {
        sourceEntityType: target.entityType,
        sourceEntityId: target.entityId,
        revisionCode: target.revisionCode ?? 'A',
      },
    })
    await appendObjectEventLog({
      id: `evt_approval_request_${Date.now()}`,
      objectType: asWorkflowObjectType(target.objectType),
      objectId: target.objectId,
      projectId: target.projectId,
      module: target.module,
      eventType: 'approval-requested',
      summary: `对象“${target.title}”已从文档中心发起审批`,
      actorName: 'MechBox 文档中心',
      eventAt: now,
      payload: {
        changeId,
        approvalId,
        sourceEntityId: target.entityId,
      },
    })
    await syncSearchSnapshot()
    feedback.notifySaved('审批任务')
  } finally {
    actionLoading.value = false
  }
}

async function decideApproval(decision: WorkflowApprovalTaskRecord['decisionStatus']) {
  if (!detailItem.value || detailItem.value.type !== 'approval') {
    feedback.warning('当前对象不是审批任务')
    return
  }

  const target = detailItem.value
  const now = new Date().toISOString()

  actionLoading.value = true
  try {
    await upsertApprovalTask({
      id: target.entityId,
      changeId: target.parentEntityId,
      projectId: target.projectId,
      objectType: asWorkflowObjectType(target.objectType),
      objectId: target.objectId,
      module: target.module,
      title: target.title,
      approvalRole: target.approvalRole,
      assigneeName: target.assigneeName,
      decisionStatus: decision,
      decidedAt: decision === 'pending' ? undefined : now,
      comment: decision === 'approved' ? '文档中心审批通过' : decision === 'rejected' ? '文档中心审批驳回' : '文档中心审批豁免',
      seqNo: 1,
      createdAt: target.createdAt ?? target.updatedAt,
      updatedAt: now,
      payload: {
        sourceEntityId: target.entityId,
      },
    })

    const linkedChange = items.value.find((item) => item.type === 'change' && item.entityId === target.parentEntityId)
    if (linkedChange) {
      await upsertChangeCase(
        buildChangeCaseRecord(
          linkedChange,
          decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'archived',
        ),
      )
    }

    await appendObjectEventLog({
      id: `evt_approval_decision_${Date.now()}`,
      objectType: asWorkflowObjectType(target.objectType),
      objectId: target.objectId,
      projectId: target.projectId,
      module: target.module,
      eventType: 'approval-decided',
      summary: `审批任务“${target.title}”已决策为 ${decision}`,
      actorName: 'MechBox 文档中心',
      eventAt: now,
      payload: {
        approvalId: target.entityId,
        changeId: target.parentEntityId ?? null,
        decision,
      },
    })
    await syncSearchSnapshot()
    feedback.notifySaved('审批决策')
  } finally {
    actionLoading.value = false
  }
}

async function deriveDocumentRevisionFromItem(item: EngineeringObjectSearchItem) {
  const now = new Date().toISOString()
  const nextRevisionCode = getNextRevisionCode(item.revisionCode)
  const referenceLock = buildReferenceLock({
    sourceObjectType: item.objectType,
    sourceObjectId: item.objectId,
    sourceRevisionCode: item.revisionCode,
    sourceStatus: item.status,
    lockedAt: now,
  })

  actionLoading.value = true
  try {
    const derivedDocumentId = `doc_der_${Date.now()}`
    await upsertDocumentAttachment({
      id: derivedDocumentId,
      projectId: item.projectId,
      objectType: asWorkflowObjectType(item.objectType),
      objectId: item.objectId,
      module: item.module,
      documentKind: (item.documentKind as WorkflowDocumentAttachmentRecord['documentKind']) ?? 'spec',
      title: buildDerivedTitle(item.title, nextRevisionCode),
      fileName: buildDerivedFileName(item.fileName, nextRevisionCode),
      mimeType: item.mimeType,
      storageType: (item.storageType as WorkflowDocumentAttachmentRecord['storageType']) ?? 'export-reference',
      revisionCode: nextRevisionCode,
      createdAt: now,
      createdBy: item.createdBy ?? 'MechBox 文档中心',
      status: 'draft',
      checksum: item.checksum,
      payload: {
        sourceEntityType: item.entityType,
        sourceEntityId: item.entityId,
        derivedFromDocumentId: item.entityId,
        sourceRevisionCode: item.revisionCode ?? 'A',
        derivationNote: buildDerivationNote({
          sourceTitle: item.title,
          sourceRevisionCode: item.revisionCode,
          nextRevisionCode,
        }),
        referenceLock,
      },
    })
    await appendObjectEventLog({
      id: `evt_document_derive_${Date.now()}`,
      objectType: asWorkflowObjectType(item.objectType),
      objectId: item.objectId,
      projectId: item.projectId,
      module: item.module,
      eventType: 'linked',
      summary: `文档“${item.title}”派生新修订 ${nextRevisionCode}`,
      actorName: 'MechBox 文档中心',
      eventAt: now,
      payload: {
        derivedFromDocumentId: item.entityId,
        sourceRevisionCode: item.revisionCode ?? 'A',
        nextRevisionCode,
        referenceLock,
      },
    })
    await syncSearchSnapshot()
    feedback.success(`已派生文档修订 ${nextRevisionCode}`)
    return derivedDocumentId
  } finally {
    actionLoading.value = false
  }
}

async function deriveDocumentRevision() {
  if (!detailItem.value || detailItem.value.type !== 'document') {
    feedback.info('当前对象不是可派生修订的文档附件')
    return
  }
  await deriveDocumentRevisionFromItem(detailItem.value)
}

async function deriveProjectRevisionFromGovernance(project: WorkspaceProject) {
  const now = new Date().toISOString()
  const nextRevisionCode = getNextRevisionCode(project.revisionCode)
  const referenceLock = buildReferenceLock({
    sourceObjectType: 'project',
    sourceObjectId: project.id,
    sourceRevisionCode: project.revisionCode,
    sourceStatus: project.lifecycleStatus,
    lockedAt: now,
  })
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

  actionLoading.value = true
  try {
    upsertStoredProject(derivedProject)
    saveActiveProject(derivedProject)
    await appendObjectEventLog({
      id: `evt_project_${project.id}_${Date.now()}`,
      objectType: 'project',
      objectId: project.id,
      projectId: project.id,
      module: project.module,
      eventType: 'linked',
      summary: `项目 ${project.name} 派生新修订 ${nextRevisionCode}`,
      actorName: 'MechBox 文档中心',
      eventAt: now,
      payload: {
        derivedProjectId: derivedProject.id,
        sourceRevisionCode: project.revisionCode,
        nextRevisionCode,
        referenceLock,
      },
    })
    await appendObjectEventLog({
      id: `evt_project_${derivedProject.id}_${Date.now()}`,
      objectType: 'project',
      objectId: derivedProject.id,
      projectId: derivedProject.id,
      module: derivedProject.module,
      eventType: 'created',
      summary: `从 ${project.name} 派生项目修订 ${nextRevisionCode}`,
      actorName: 'MechBox 文档中心',
      eventAt: now,
      payload: {
        derivedFromProjectId: project.id,
        sourceRevisionCode: project.revisionCode,
        nextRevisionCode,
        referenceLock,
      },
    })
    await syncSearchSnapshot()
    feedback.success(`已派生项目修订 ${nextRevisionCode}`)
    return derivedProject.id
  } finally {
    actionLoading.value = false
  }
}

async function deriveReportRevisionFromGovernance(report: ReportRecord) {
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

  actionLoading.value = true
  try {
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
      actorName: 'MechBox 文档中心',
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
      actorName: derivedReport.author ?? 'MechBox 文档中心',
      eventAt: now,
      payload: {
        derivedFromReportId: report.id,
        sourceRevisionCode: report.revisionCode ?? 'A',
        nextRevisionCode,
        referenceLock,
      },
    })
    await syncSearchSnapshot()
    feedback.success(`已派生报告修订 ${nextRevisionCode}`)
    return derivedReport.id
  } finally {
    actionLoading.value = false
  }
}

async function deriveGovernanceSuggested(alert: RevisionGovernanceAlert) {
  if (!alert.suggestedNodeId) {
    feedback.info('当前治理建议没有可派生的目标对象')
    return
  }

  const target = findGovernanceItem(alert.suggestedNodeId)
  if (!target) {
    feedback.warning('当前治理建议对应的最新对象未在索引中找到')
    return
  }

  let derivedNodeId: string | undefined
  if (target.type === 'project') {
    const project = projects.value.find((item) => item.id === target.entityId)
    if (!project) {
      feedback.warning('未找到可派生的项目修订')
      return
    }
    derivedNodeId = await deriveProjectRevisionFromGovernance(project)
  } else if (target.type === 'report') {
    const reports = await fetchStoredReportsFresh()
    const report = reports.find((item) => item.id === target.entityId)
    if (!report) {
      feedback.warning('未找到可派生的报告修订')
      return
    }
    derivedNodeId = await deriveReportRevisionFromGovernance(report)
  } else if (target.type === 'document') {
    derivedNodeId = await deriveDocumentRevisionFromItem(target)
  }

  if (derivedNodeId) {
    const sourceItem = findGovernanceItem(alert.nodeId)
    const derivedItem = findGovernanceItem(derivedNodeId)
    if (sourceItem && derivedItem) {
      governanceRepairHistory.value = [
        {
          id: `${alert.nodeId}_${derivedNodeId}_${Date.now()}`,
          objectType: alert.objectType,
          sourceNodeId: sourceItem.entityId,
          sourceTitle: sourceItem.title,
          sourceRevisionCode: sourceItem.revisionCode ?? null,
          derivedNodeId: derivedItem.entityId,
          derivedTitle: derivedItem.title,
          derivedRevisionCode: derivedItem.revisionCode ?? null,
          repairedAt: new Date().toISOString(),
          summary: alert.summary,
        },
        ...governanceRepairHistory.value.filter((item) => item.derivedNodeId !== derivedItem.entityId),
      ].slice(0, 8)
    }
    inspectGovernanceSuggested(derivedNodeId)
  }
}
</script>

<template>
  <div class="document-center-page">
    <PageToolbar title="MechBox" subtitle="文档中心">
      <a-space>
        <a-button size="small" @click="navigateTo('/projects')">
          <template #icon><FolderOpenOutlined /></template>项目中心
        </a-button>
        <a-button size="small" @click="navigateTo('/reports')">
          <template #icon><FileTextOutlined /></template>报告中心
        </a-button>
        <a-button size="small" @click="navigateTo('/bom-export')">
          <template #icon><NodeIndexOutlined /></template>BOM 中心
        </a-button>
        <a-button size="small" @click="exportFilteredResults">
          <template #icon><DownloadOutlined /></template>导出筛选
        </a-button>
        <a-button size="small" @click="exportProjectReleasePackage()">
          <template #icon><ClockCircleOutlined /></template>导出发布包
        </a-button>
        <a-button size="small" @click="openGovernanceWorkbench">
          修订治理台
        </a-button>
        <a-button size="small" :loading="loading" @click="refreshSearchSnapshot">
          <template #icon><ReloadOutlined /></template>刷新索引
        </a-button>
      </a-space>
    </PageToolbar>

    <PageSyncStatus
      :loading="loading"
      :has-loaded="hasLoadedOnce"
      :last-synced-at="lastSyncedAt"
      :error="syncError"
      loading-label="正在刷新对象索引与治理快照"
      initial-label="正在准备文档工作台"
    >
      <a-space wrap size="small">
        <a-tag>对象 {{ items.length }}</a-tag>
        <a-tag>项目 {{ projects.length }}</a-tag>
        <a-tag>待批 {{ pendingApprovalCount }}</a-tag>
      </a-space>
    </PageSyncStatus>

    <PageLoadingState
      v-if="loading && !hasLoadedOnce"
      title="正在准备文档工作台"
      description="正在建立对象索引、项目范围、审批状态与修订治理快照。"
      :side-cards="4"
      :main-cards="2"
    />

    <div v-else class="content-body" :class="{ 'is-refreshing': loading }">
      <ToolPageLayout :input-span="8" :output-span="16">
        <template #side>
          <a-card title="对象概览" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="总对象" :value="groupStats.all" /></a-col>
              <a-col :span="12"><a-statistic title="文档" :value="groupStats.document" /></a-col>
              <a-col :span="12"><a-statistic title="零件/料号" :value="groupStats.part" /></a-col>
              <a-col :span="12"><a-statistic title="报告" :value="groupStats.report" /></a-col>
              <a-col :span="12"><a-statistic title="BOM" :value="groupStats.bom" /></a-col>
              <a-col :span="12"><a-statistic title="运行/结果" :value="groupStats.run" /></a-col>
              <a-col :span="12"><a-statistic title="变更/审批" :value="groupStats.change" /></a-col>
              <a-col :span="12"><a-statistic title="待批任务" :value="pendingApprovalCount" /></a-col>
            </a-row>
          </a-card>

          <a-card title="修订治理总览" size="small">
            <template #extra>
              <a-button type="link" size="small" @click="openGovernanceWorkbench">查看全部</a-button>
            </template>
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="治理对象" :value="governanceSnapshot.totalNodes" /></a-col>
              <a-col :span="12"><a-statistic title="冻结基线" :value="governanceSnapshot.frozenNodes" /></a-col>
              <a-col :span="12"><a-statistic title="滞后修订" :value="governanceSnapshot.staleNodes" /></a-col>
              <a-col :span="12"><a-statistic title="一致性告警" :value="governanceSnapshot.inconsistentNodes" /></a-col>
            </a-row>
            <a-row :gutter="[12, 12]" style="margin-top: 12px">
              <a-col v-for="metric in governanceHealthMetrics" :key="metric.label" :span="12">
                <a-statistic :title="metric.label" :value="metric.value" :suffix="metric.suffix" />
              </a-col>
            </a-row>
            <div class="section-note">
              当前范围内共有 {{ governanceSnapshot.rootChains }} 条修订根链，最新根链对象展示最近 12 条。
            </div>
            <div v-if="governanceSnapshot.alerts.length" class="drawer-list">
              <article
                v-for="alert in governanceSnapshot.alerts.slice(0, 4)"
                :key="`${alert.objectType}-${alert.nodeId}-${alert.summary}`"
                class="drawer-list-item is-static"
              >
                <strong>{{ alert.summary }}</strong>
                <span>{{ alert.title }} · {{ alert.recommendation }}</span>
                <a-space wrap>
                  <a-tag :color="getRevisionGovernancePriorityMeta(alert.priority).color">{{ getRevisionGovernancePriorityMeta(alert.priority).label }}</a-tag>
                  <a-tag :color="getRevisionGovernanceRepairabilityMeta(alert.repairability).color">{{ getRevisionGovernanceRepairabilityMeta(alert.repairability).label }}</a-tag>
                  <a-button type="link" size="small" @click="inspectGovernanceAlert(alert.nodeId)">查看对象</a-button>
                </a-space>
              </article>
            </div>
            <StateEmpty v-else description="当前范围内没有显式的修订治理告警" />
          </a-card>

          <a-card title="项目治理收口率" size="small">
            <StateEmpty v-if="governanceProjectRows.length === 0" description="当前范围内没有可汇总的项目治理数据" />
            <a-table
              v-else
              :columns="governanceProjectSummaryColumns"
              :data-source="governanceProjectRows"
              size="small"
              :pagination="false"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'projectName'">
                  <strong>{{ record.projectName }}</strong>
                </template>
                <template v-else-if="column.key === 'completion'">
                  <a-tag :color="record.repairableAlerts > 0 ? 'orange' : 'green'">{{ record.completionRateText }}</a-tag>
                </template>
                <template v-else-if="column.key === 'current'">
                  <a-tag color="blue">{{ record.currentRateText }}</a-tag>
                </template>
                <template v-else-if="column.key === 'actions'">
                  {{ record.repairableAlerts }} / {{ record.reviewAlerts }}
                </template>
                <template v-else-if="column.key === 'issues'">
                  {{ record.staleNodes }} / {{ record.inconsistentNodes }}
                </template>
                <template v-else-if="column.key === 'totalNodes'">
                  {{ record.totalNodes }}
                </template>
              </template>
            </a-table>
            <div class="section-note">
              治理完成度表示当前项目中“既是最新修订又不存在显式一致性问题”的对象占比；当前最新占比只看是否仍挂旧修订。
            </div>
          </a-card>

          <a-card title="当前活动项目" size="small">
            <StateEmpty v-if="!activeProject" description="暂无活动项目" />
            <a-descriptions v-else bordered size="small" :column="1">
              <a-descriptions-item label="项目名称">{{ activeProject.name }}</a-descriptions-item>
              <a-descriptions-item label="所属模块">{{ formatModuleLabel(activeProject.module) }}</a-descriptions-item>
              <a-descriptions-item label="阶段 / 修订">{{ activeProject.lifecycleStatus }} / {{ activeProject.revisionCode }}</a-descriptions-item>
              <a-descriptions-item label="当前索引对象">{{ currentProjectItems.length }}</a-descriptions-item>
              <a-descriptions-item label="摘要">{{ activeProject.inputSummary || '尚未写入摘要' }}</a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card title="筛选条件" size="small">
            <div class="filter-stack">
              <a-input-search
                v-model:value="searchQuery"
                placeholder="搜索项目、零件号、报告、供应商料号、变更标题"
                allow-clear
              >
                <template #prefix><SearchOutlined /></template>
              </a-input-search>

              <a-form-item label="对象分组">
                <a-select
                  v-model:value="selectedGroup"
                  :options="groupOrder.map((group) => ({ value: group, label: getEngineeringObjectFilterMeta(group).label }))"
                />
              </a-form-item>

              <a-form-item label="项目范围">
                <a-select v-model:value="selectedProjectId" :options="projectOptions" />
              </a-form-item>

              <a-form-item label="仅活动项目">
                <a-switch v-model:checked="activeProjectOnly" :disabled="!activeProject || selectedProjectId !== 'all'" />
              </a-form-item>

              <a-space wrap>
                <a-button size="small" @click="clearFilters">清空筛选</a-button>
                <a-button size="small" @click="applyGroupFilter('document')">只看文档</a-button>
                <a-button size="small" @click="applyGroupFilter('part')">只看零件</a-button>
                <a-button size="small" @click="applyGroupFilter('change')">只看变更</a-button>
                <a-button size="small" :type="pendingApprovalOnly ? 'primary' : 'default'" @click="togglePendingApprovalsOnly">
                  只看待批
                </a-button>
                <a-button size="small" :type="unreleasedDocumentOnly ? 'primary' : 'default'" @click="toggleUnreleasedDocumentOnly">
                  只看未发布
                </a-button>
              </a-space>
            </div>
          </a-card>

          <a-card title="对象分布" size="small">
            <div class="distribution-stack">
              <button
                v-for="group in groupOrder"
                :key="group"
                type="button"
                class="distribution-item"
                :class="{ 'is-active': selectedGroup === group }"
                @click="selectedGroup = group"
              >
                <span>{{ getEngineeringObjectFilterMeta(group).label }}</span>
                <strong>{{ groupStats[group] }}</strong>
              </button>
            </div>
          </a-card>

          <AlertStack :items="pageAlerts" />

          <CalculationDecisionPanel
            title="对象检索判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
        </template>

        <template #main>
          <a-card size="small" title="项目基线概览">
            <StateEmpty v-if="projectBaselineRows.length === 0" description="当前还没有可汇总的项目基线" />
            <a-table
              v-else
              :columns="baselineColumns"
              :data-source="projectBaselineRows"
              :pagination="false"
              size="small"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'project'">
                  <div class="result-title-cell">
                    <strong>{{ record.project.name }}</strong>
                    <div class="result-subtitle">{{ formatModuleLabel(record.project.module) }} · {{ record.project.lifecycleStatus }}</div>
                  </div>
                </template>
                <template v-else-if="column.key === 'readiness'">
                  <a-tag :color="record.readinessStatus === 'ready' ? 'green' : record.readinessStatus === 'warning' ? 'orange' : 'red'">
                    {{
                      record.readinessStatus === 'ready'
                        ? '就绪'
                        : record.readinessStatus === 'warning'
                          ? '待完善'
                          : '阻塞'
                    }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'documents'">
                  {{ record.releasedDocumentCount }} / {{ record.documentCount }}
                </template>
                <template v-else-if="column.key === 'changes'">
                  {{ record.openChangeCount }} / {{ record.pendingApprovalCount }}
                </template>
                <template v-else-if="column.key === 'parts'">
                  {{ record.partCount }} / {{ record.bomCount }}
                </template>
                <template v-else-if="column.key === 'runs'">
                  {{ record.reportCount }} / {{ record.runResultCount }}
                </template>
                <template v-else-if="column.key === 'blockers'">
                  <div class="result-meta-cell">
                    <span v-if="record.blockers.length">{{ record.blockers.join('；') }}</span>
                    <span v-else class="result-subtle">当前没有明显阻塞</span>
                  </div>
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-space wrap>
                    <a-button type="link" size="small" @click="selectedProjectId = record.project.id">聚焦项目</a-button>
                    <a-button type="link" size="small" @click="exportProjectReleasePackage(record.project.id)">发布包</a-button>
                    <a-button type="link" size="small" @click="record.pendingApprovalCount > 0 ? togglePendingApprovalsOnly() : applyGroupFilter('document')">
                      查看问题
                    </a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-card>

          <a-card size="small">
            <template #title>
              <a-space>
                <FileSearchOutlined />
                <span>统一对象检索</span>
              </a-space>
            </template>
            <template #extra>
              <a-space>
                <a-tag :color="getEngineeringObjectFilterMeta(selectedGroup).color">
                  {{ getEngineeringObjectFilterMeta(selectedGroup).label }}
                </a-tag>
                <a-tag color="blue">
                  {{ currentScopeLabel }}
                </a-tag>
                <span class="section-note" style="margin: 0">命中 {{ filteredResults.length }} 条</span>
              </a-space>
            </template>

            <div class="summary-metric-grid">
              <article
                v-for="metric in filteredSummaryMetrics"
                :key="metric.label"
                class="summary-metric"
              >
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
              </article>
            </div>

            <StateEmpty
              v-if="!filteredResults.length"
              :icon="ApartmentOutlined"
              description="当前没有可显示的工程对象结果"
            />

            <a-table
              v-else
              :columns="resultColumns"
              :data-source="filteredResults"
              :pagination="{ pageSize: 12, showSizeChanger: true }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'title'">
                  <div class="result-title-cell">
                    <div class="result-title-row">
                      <strong>{{ record.title }}</strong>
                      <a-tag v-if="record.status" :color="record.type === 'approval' && record.status === 'pending' ? 'orange' : 'default'">
                        {{ record.status }}
                      </a-tag>
                    </div>
                    <div class="result-subtitle">{{ record.subtitle }}</div>
                    <div v-if="record.summary" class="result-summary">{{ record.summary }}</div>
                  </div>
                </template>

                <template v-else-if="column.key === 'type'">
                  <a-space direction="vertical" size="small">
                    <a-tag :color="getEngineeringObjectTypeMeta(record.type).color">
                      {{ getEngineeringObjectTypeMeta(record.type).label }}
                    </a-tag>
                    <a-tag :color="getEngineeringObjectFilterMeta(record.filterGroup).color">
                      {{ getEngineeringObjectFilterMeta(record.filterGroup).label }}
                    </a-tag>
                  </a-space>
                </template>

                <template v-else-if="column.key === 'project'">
                  <div class="result-meta-cell">
                    <div>{{ record.projectName || '未关联项目' }}</div>
                    <div class="result-subtle">{{ formatModuleLabel(record.module) }}</div>
                  </div>
                </template>

                <template v-else-if="column.key === 'source'">
                  <div class="result-meta-cell">
                    <div>{{ record.sourceLabel }}</div>
                    <div class="result-subtle">{{ record.objectType }} / {{ record.objectId }}</div>
                  </div>
                </template>

                <template v-else-if="column.key === 'updatedAt'">
                  {{ new Date(record.updatedAt).toLocaleString() }}
                </template>

                <template v-else-if="column.key === 'actions'">
                  <a-space wrap>
                    <a-button type="link" size="small" @click="inspectSearchItem(record)">
                      <template #icon><EyeOutlined /></template>详情
                    </a-button>
                    <a-button type="link" size="small" @click="openSearchItem(record)">打开来源</a-button>
                    <a-button type="link" size="small" @click="focusSearchProject(record)">聚焦项目</a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-card>
        </template>
      </ToolPageLayout>
    </div>

    <a-drawer
      :open="detailVisible"
      :title="detailItem?.title || '对象详情'"
      width="760"
      @close="closeDetail"
    >
      <StateEmpty v-if="!detailItem" description="当前没有选中的对象" />

      <template v-else>
        <div class="detail-stack">
          <a-card size="small" title="对象摘要">
            <a-space wrap>
              <a-tag :color="getEngineeringObjectTypeMeta(detailItem.type).color">
                {{ getEngineeringObjectTypeMeta(detailItem.type).label }}
              </a-tag>
              <a-tag :color="getEngineeringObjectFilterMeta(detailItem.filterGroup).color">
                {{ getEngineeringObjectFilterMeta(detailItem.filterGroup).label }}
              </a-tag>
              <a-tag v-if="detailItem.status">{{ detailItem.status }}</a-tag>
              <a-tag v-if="detailItem.revisionCode">修订 {{ detailItem.revisionCode }}</a-tag>
              <a-tag v-if="detailFreezeState" :color="detailFreezeState.color">
                {{ detailFreezeState.label }}
              </a-tag>
            </a-space>

            <a-descriptions bordered size="small" :column="2" style="margin-top: 12px">
              <a-descriptions-item label="对象标题">{{ detailItem.title }}</a-descriptions-item>
              <a-descriptions-item label="来源">{{ detailItem.sourceLabel }}</a-descriptions-item>
              <a-descriptions-item label="对象类型">{{ detailItem.objectType }}</a-descriptions-item>
              <a-descriptions-item label="对象标识">{{ detailItem.objectId }}</a-descriptions-item>
              <a-descriptions-item label="源记录类型">{{ detailItem.entityType }}</a-descriptions-item>
              <a-descriptions-item label="源记录标识">{{ detailItem.entityId }}</a-descriptions-item>
              <a-descriptions-item label="项目">{{ detailItem.projectName || '未关联项目' }}</a-descriptions-item>
              <a-descriptions-item label="模块">{{ formatModuleLabel(detailItem.module) }}</a-descriptions-item>
              <a-descriptions-item label="创建时间">{{ detailItem.createdAt ? new Date(detailItem.createdAt).toLocaleString() : '未记录' }}</a-descriptions-item>
              <a-descriptions-item label="更新时间">{{ new Date(detailItem.updatedAt).toLocaleString() }}</a-descriptions-item>
              <a-descriptions-item v-if="detailItem.documentKind" label="文档类型">{{ detailItem.documentKind }}</a-descriptions-item>
              <a-descriptions-item v-if="detailItem.fileName" label="文件名">{{ detailItem.fileName }}</a-descriptions-item>
              <a-descriptions-item :span="2" label="来源页面">{{ detailItem.routePath }}</a-descriptions-item>
              <a-descriptions-item :span="2" label="副标题">{{ detailItem.subtitle }}</a-descriptions-item>
              <a-descriptions-item v-if="detailItem.summary" :span="2" label="摘要">{{ detailItem.summary }}</a-descriptions-item>
            </a-descriptions>

            <a-space wrap style="margin-top: 12px">
              <a-button type="primary" size="small" @click="openItem(detailItem)">打开来源</a-button>
              <a-button size="small" @click="focusProject(detailItem)">聚焦项目</a-button>
              <a-button size="small" @click="applyGroupFilter(detailItem.filterGroup)">按类型筛选</a-button>
            </a-space>
          </a-card>

          <a-card size="small" title="对象动作">
            <div class="action-grid">
              <div class="action-section">
                <div class="action-section__title">审批与发布</div>
                <a-space wrap>
                  <a-button size="small" :loading="actionLoading" :disabled="Boolean(detailFreezeState?.isReadOnly)" @click="requestApprovalForCurrentItem">
                    <template #icon><UploadOutlined /></template>发起审批
                  </a-button>
                  <a-button
                    v-if="detailItem.type === 'approval' && detailItem.status === 'pending'"
                    size="small"
                    type="primary"
                    :loading="actionLoading"
                    @click="decideApproval('approved')"
                  >
                    <template #icon><CheckOutlined /></template>批准
                  </a-button>
                  <a-button
                    v-if="detailItem.type === 'approval' && detailItem.status === 'pending'"
                    size="small"
                    danger
                    :loading="actionLoading"
                    @click="decideApproval('rejected')"
                  >
                    <template #icon><StopOutlined /></template>驳回
                  </a-button>
                  <a-button
                    v-if="detailItem.type === 'approval' && detailItem.status === 'pending'"
                    size="small"
                    :loading="actionLoading"
                    @click="decideApproval('waived')"
                  >
                    豁免
                  </a-button>
                  <a-button size="small" :disabled="!detailPreviousVersion" @click="compareWithPreviousVersion">
                    比较上一版
                  </a-button>
                  <a-button v-if="detailItem.type === 'document'" size="small" @click="deriveDocumentRevision">
                    派生修订
                  </a-button>
                </a-space>
              </div>

              <div v-if="detailItem.type === 'document'" class="action-section">
                <div class="action-section__title">文档状态流转</div>
                <a-space wrap>
                  <a-button size="small" :loading="actionLoading" :disabled="Boolean(detailFreezeState?.isReadOnly)" @click="updateDocumentStatus('draft')">
                    草稿
                  </a-button>
                  <a-button size="small" :loading="actionLoading" :disabled="Boolean(detailFreezeState?.isReadOnly)" @click="updateDocumentStatus('generated')">
                    已生成
                  </a-button>
                  <a-button size="small" type="primary" :loading="actionLoading" :disabled="Boolean(detailFreezeState?.isReadOnly)" @click="updateDocumentStatus('released')">
                    已发布
                  </a-button>
                  <a-button size="small" :loading="actionLoading" :disabled="Boolean(detailFreezeState?.isReadOnly)" @click="updateDocumentStatus('archived')">
                    归档
                  </a-button>
                </a-space>
              </div>
            </div>

            <div class="section-note">
              当前对象已关联 {{ detailRelatedChanges.length }} 条变更、{{ detailRelatedApprovals.length }} 条审批，其中待处理 {{ detailPendingApprovals.length }} 条。
            </div>
            <div v-if="detailFreezeState?.isReadOnly" class="section-note">
              当前对象处于{{ detailFreezeState.label }}，已按只读基线处理。若需继续演进，请生成新修订或在上游模块重新产出对象。
            </div>
          </a-card>

          <a-card size="small" title="冻结与发布基线">
            <StateEmpty v-if="!detailFreezeSummary" description="当前没有可判断的冻结状态" />
            <a-descriptions v-else bordered size="small" :column="2">
              <a-descriptions-item label="当前判断">
                <a-tag :color="detailFreezeSummary.color">
                  {{ detailFreezeSummary.label }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="可比较版本">{{ detailVersionHistory.length }}</a-descriptions-item>
              <a-descriptions-item label="待批任务">{{ detailPendingApprovals.length }}</a-descriptions-item>
              <a-descriptions-item label="事件日志">{{ detailEventLogs.length }}</a-descriptions-item>
              <a-descriptions-item :span="2" label="判断说明">{{ detailFreezeSummary.description }}</a-descriptions-item>
              <a-descriptions-item :span="2" label="主要阻塞">
                {{ detailFreezeSummary.blockers.length ? detailFreezeSummary.blockers.join('；') : '当前没有明显阻塞' }}
              </a-descriptions-item>
              <a-descriptions-item v-if="detailReferenceLock" :span="2" label="冻结引用">
                {{ detailReferenceLock.sourceObjectType || '对象' }} / {{ detailReferenceLock.sourceObjectId || '未知' }} / 修订 {{ detailReferenceLock.sourceRevisionCode || 'A' }}
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card size="small" title="修订链与一致性">
            <a-row :gutter="[12, 12]">
              <a-col :span="8"><a-statistic title="祖先链" :value="Math.max(detailRevisionLineage.ancestry.length - 1, 0)" /></a-col>
              <a-col :span="8"><a-statistic title="直接下游" :value="detailRevisionLineage.children.length" /></a-col>
              <a-col :span="8"><a-statistic title="全链后代" :value="detailRevisionLineage.descendants.length" /></a-col>
            </a-row>
            <div v-if="detailRevisionLineage.ancestry.length > 0" class="drawer-list" style="margin-top: 12px">
              <article
                v-for="node in detailRevisionLineage.ancestry"
                :key="node.id"
                class="drawer-list-item is-static"
              >
                <strong>{{ node.title }}</strong>
                <span>修订 {{ node.revisionCode || 'A' }} · {{ node.status || '未标注状态' }}</span>
              </article>
            </div>
            <StateEmpty v-else description="当前对象没有可识别的修订祖先链" />
            <div class="drawer-list" style="margin-top: 12px">
              <article
                v-for="check in detailRevisionLineage.consistencyChecks"
                :key="`${check.level}-${check.summary}`"
                class="drawer-list-item is-static"
              >
                <strong>{{ check.level === 'warning' ? '警告' : '信息' }} · {{ check.summary }}</strong>
                <span>{{ check.detail }}</span>
              </article>
            </div>
          </a-card>

          <a-card size="small" title="检索关键词">
            <StateEmpty v-if="detailKeywords.length === 0" description="暂无关键词" />
            <a-space v-else wrap>
              <a-tag v-for="keyword in detailKeywords" :key="keyword">{{ keyword }}</a-tag>
            </a-space>
          </a-card>

          <a-card size="small" title="对象内容预览">
            <template #extra>
              <a-button size="small" @click="copyPreviewPayload">
                <template #icon><CopyOutlined /></template>复制内容
              </a-button>
            </template>
            <StateEmpty v-if="!detailPreviewText" description="当前对象没有结构化预览内容" />
            <pre v-else class="payload-preview">{{ detailPreviewText }}</pre>
          </a-card>

          <a-card size="small" :title="`版本历史 (${detailVersionHistory.length})`">
            <StateEmpty v-if="detailVersionHistory.length === 0" description="当前没有可比较的同对象版本记录" />
            <div v-else class="drawer-list">
              <article
                v-for="item in detailVersionHistory"
                :key="item.id"
                class="drawer-list-item is-static"
              >
                <strong>{{ item.title }}</strong>
                <span>
                  修订 {{ item.revisionCode || '未标注' }} · {{ item.status || '未标注状态' }} · {{ new Date(item.updatedAt).toLocaleString() }}
                </span>
                <a-space wrap>
                  <a-button type="link" size="small" @click="inspectItem(item)">查看详情</a-button>
                  <a-button type="link" size="small" @click="compareWithCurrentVersion(item)">与当前比较</a-button>
                </a-space>
              </article>
            </div>
          </a-card>

          <a-card size="small" :title="`版本差异摘要 (${detailDiffSummary.length})`">
            <StateEmpty v-if="detailDiffSummary.length === 0" description="当前版本与上一版本没有提炼出的显式差异，或暂无上一版本。" />
            <div v-else class="drawer-list">
              <article
                v-for="item in detailDiffSummary"
                :key="item"
                class="drawer-list-item is-static"
              >
                <strong>{{ item }}</strong>
              </article>
            </div>
          </a-card>

          <a-card size="small" :title="`事件时间线 (${detailEventLogs.length})`">
            <StateEmpty v-if="detailEventLogs.length === 0" description="当前对象还没有正式事件日志" />
            <div v-else class="timeline-list">
              <article
                v-for="event in detailEventLogs"
                :key="event.id"
                class="timeline-item"
              >
                <div class="timeline-item__head">
                  <strong>{{ event.summary }}</strong>
                  <a-tag>{{ event.eventType }}</a-tag>
                </div>
                <div class="timeline-item__meta">
                  {{ event.actorName || '系统' }} · {{ new Date(event.eventAt).toLocaleString() }}
                </div>
              </article>
            </div>
          </a-card>

          <a-card size="small" :title="`同对象链 (${detailLinkedItems.length})`">
            <StateEmpty v-if="detailLinkedItems.length === 0" description="当前没有同对象链的其他对象" />
            <div v-else class="drawer-list">
              <button
                v-for="item in detailLinkedItems"
                :key="item.id"
                type="button"
                class="drawer-list-item"
                @click="inspectItem(item)"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.subtitle }}</span>
              </button>
            </div>
          </a-card>

          <a-card size="small" :title="`同项目对象 (${detailProjectItems.length})`">
            <StateEmpty v-if="detailProjectItems.length === 0" description="当前没有可展示的同项目对象" />
            <div v-else class="drawer-list">
              <button
                v-for="item in detailProjectItems"
                :key="item.id"
                type="button"
                class="drawer-list-item"
                @click="inspectItem(item)"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.projectName || '未关联项目' }} · {{ formatModuleLabel(item.module) }}</span>
              </button>
            </div>
          </a-card>

          <a-card size="small" :title="`同模块对象 (${detailModuleItems.length})`">
            <StateEmpty v-if="detailModuleItems.length === 0" description="当前没有可展示的同模块对象" />
            <div v-else class="drawer-list">
              <button
                v-for="item in detailModuleItems"
                :key="item.id"
                type="button"
                class="drawer-list-item"
                @click="inspectItem(item)"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.subtitle }}</span>
              </button>
            </div>
          </a-card>
        </div>
      </template>
    </a-drawer>

    <a-modal
      :open="governanceWorkbenchVisible"
      title="修订治理工作台"
      width="1180"
      :footer="null"
      @cancel="closeGovernanceWorkbench"
    >
      <div class="compare-stack">
        <a-card size="small" title="治理概览">
          <a-row :gutter="[12, 12]">
            <a-col :span="6"><a-statistic title="治理对象" :value="governanceSnapshot.totalNodes" /></a-col>
            <a-col :span="6"><a-statistic title="冻结基线" :value="governanceSnapshot.frozenNodes" /></a-col>
            <a-col :span="6"><a-statistic title="滞后修订" :value="governanceSnapshot.staleNodes" /></a-col>
            <a-col :span="6"><a-statistic title="一致性告警" :value="governanceSnapshot.inconsistentNodes" /></a-col>
          </a-row>
          <a-row :gutter="[12, 12]" style="margin-top: 12px">
            <a-col v-for="metric in governanceExecutionMetrics" :key="metric.label" :span="6">
              <a-statistic :title="metric.label" :value="metric.value" />
            </a-col>
          </a-row>
          <a-space wrap style="margin-top: 12px">
            <a-button size="small" :type="governanceFilterType === 'all' ? 'primary' : 'default'" @click="governanceFilterType = 'all'">全部</a-button>
            <a-button size="small" :type="governanceFilterType === 'project' ? 'primary' : 'default'" @click="governanceFilterType = 'project'">项目</a-button>
            <a-button size="small" :type="governanceFilterType === 'report' ? 'primary' : 'default'" @click="governanceFilterType = 'report'">报告</a-button>
            <a-button size="small" :type="governanceFilterType === 'document' ? 'primary' : 'default'" @click="governanceFilterType = 'document'">文档</a-button>
            <a-divider type="vertical" />
            <a-button size="small" :type="governanceFilterLevel === 'all' ? 'primary' : 'default'" @click="governanceFilterLevel = 'all'">全部级别</a-button>
            <a-button size="small" :type="governanceFilterLevel === 'warning' ? 'primary' : 'default'" @click="governanceFilterLevel = 'warning'">仅告警</a-button>
            <a-button size="small" :type="governanceFilterLevel === 'info' ? 'primary' : 'default'" @click="governanceFilterLevel = 'info'">仅提示</a-button>
          </a-space>
        </a-card>

        <a-card size="small" :title="`优先处理 (${governancePriorityAlerts.length})`">
          <StateEmpty v-if="governancePriorityAlerts.length === 0" description="当前筛选范围内没有需要优先处理的治理项" />
          <div v-else class="drawer-list">
            <article
              v-for="alert in governancePriorityAlerts"
              :key="`priority-${alert.objectType}-${alert.nodeId}-${alert.summary}`"
              class="drawer-list-item is-static"
            >
              <strong>{{ alert.summary }}</strong>
              <span>{{ alert.title }} · {{ alert.recommendation }}</span>
              <a-space wrap>
                <a-tag :color="getRevisionGovernanceCategoryMeta(alert.category).color">{{ getRevisionGovernanceCategoryMeta(alert.category).label }}</a-tag>
                <a-tag :color="getRevisionGovernancePriorityMeta(alert.priority).color">{{ getRevisionGovernancePriorityMeta(alert.priority).label }}</a-tag>
                <a-tag :color="getRevisionGovernanceRepairabilityMeta(alert.repairability).color">{{ getRevisionGovernanceRepairabilityMeta(alert.repairability).label }}</a-tag>
                <a-button type="link" size="small" @click="inspectGovernanceAlert(alert.nodeId)">查看对象</a-button>
                <a-button
                  v-if="alert.suggestedNodeId && alert.suggestedAction === 'inspect-latest'"
                  type="link"
                  size="small"
                  @click="deriveGovernanceSuggested(alert)"
                >
                  立即派生
                </a-button>
              </a-space>
            </article>
          </div>
        </a-card>

        <a-card size="small" title="最新修订根链">
          <StateEmpty v-if="governanceSnapshot.latestNodes.length === 0" description="当前没有可展示的根链对象" />
          <div v-else class="drawer-list">
            <article
              v-for="node in governanceSnapshot.latestNodes"
              :key="node.id"
              class="drawer-list-item is-static"
            >
              <strong>{{ node.title }}</strong>
              <span>{{ node.objectType }} · 修订 {{ node.revisionCode || 'A' }} · {{ node.status || '未标注状态' }}</span>
              <a-button type="link" size="small" @click="inspectGovernanceAlert(node.id)">查看对象</a-button>
            </article>
          </div>
        </a-card>

        <a-card size="small" :title="`治理告警与修复建议 (${governanceWorkbenchAlerts.length})`">
          <StateEmpty v-if="governanceWorkbenchAlerts.length === 0" description="当前筛选范围内没有修订治理告警" />
          <div v-else class="drawer-list">
            <article
              v-for="alert in governanceWorkbenchAlerts"
              :key="`${alert.objectType}-${alert.nodeId}-${alert.summary}`"
              class="drawer-list-item is-static"
            >
              <strong>{{ alert.summary }}</strong>
              <span>{{ alert.title }} · {{ alert.recommendation }}</span>
              <a-space wrap>
                <a-tag :color="alert.level === 'warning' ? 'orange' : 'blue'">{{ alert.objectType }}</a-tag>
                <a-tag :color="getRevisionGovernanceCategoryMeta(alert.category).color">{{ getRevisionGovernanceCategoryMeta(alert.category).label }}</a-tag>
                <a-tag :color="getRevisionGovernancePriorityMeta(alert.priority).color">{{ getRevisionGovernancePriorityMeta(alert.priority).label }}</a-tag>
                <a-tag :color="getRevisionGovernanceRepairabilityMeta(alert.repairability).color">{{ getRevisionGovernanceRepairabilityMeta(alert.repairability).label }}</a-tag>
                <a-button type="link" size="small" @click="inspectGovernanceAlert(alert.nodeId)">查看问题对象</a-button>
                <a-button
                  v-if="alert.suggestedNodeId && alert.suggestedAction === 'inspect-latest'"
                  type="link"
                  size="small"
                  @click="inspectGovernanceSuggested(alert.suggestedNodeId)"
                >
                  打开最新修订 {{ alert.suggestedRevisionCode || '' }}
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
              <div v-if="alert.details.length > 1" class="section-note" style="margin-top: 4px">
                {{ alert.details.join('；') }}
              </div>
            </article>
          </div>
        </a-card>

        <a-card size="small" :title="`最近修复记录 (${governanceRepairHistory.length})`">
          <StateEmpty v-if="governanceRepairHistory.length === 0" description="当前还没有从治理工作台执行过自动修复动作" />
          <div v-else class="drawer-list">
            <article
              v-for="record in governanceRepairHistory"
              :key="record.id"
              class="drawer-list-item is-static"
            >
              <strong>{{ record.sourceTitle }} -> {{ record.derivedTitle }}</strong>
              <span>
                {{ record.summary }} · {{ record.sourceRevisionCode || 'A' }} -> {{ record.derivedRevisionCode || 'A' }} ·
                {{ new Date(record.repairedAt).toLocaleString() }}
              </span>
              <a-space wrap>
                <a-tag color="green">已派生</a-tag>
                <a-button type="link" size="small" @click="inspectGovernanceSuggested(record.derivedNodeId)">查看新副本</a-button>
                <a-button type="link" size="small" @click="openGovernanceRepairComparison(record)">查看修复对比</a-button>
              </a-space>
            </article>
          </div>
        </a-card>
      </div>
    </a-modal>

    <a-modal
      :open="compareVisible"
      :title="compareBaseItem && compareTargetItem ? `${compareBaseItem.revisionCode || '基线'} -> ${compareTargetItem.revisionCode || '当前'} 版本比较` : '版本比较'"
      width="1120"
      :footer="null"
      @cancel="closeCompareModal"
    >
      <StateEmpty
        v-if="!compareBaseItem || !compareTargetItem"
        description="当前没有可展示的版本比较内容"
      />

      <div v-else class="compare-stack">
        <a-card size="small" title="比较摘要">
          <a-row :gutter="[12, 12]">
            <a-col :span="8">
              <a-statistic title="字段变化" :value="compareFieldRows.filter((row) => row.changed).length" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="预览差异" :value="comparePreviewBaseText === comparePreviewTargetText ? 0 : 1" />
            </a-col>
            <a-col :span="8">
              <a-statistic title="差异摘要" :value="compareSummary.length" />
            </a-col>
          </a-row>
          <div class="section-note">
            当前比较基于对象主字段和 `previewPayload` 结构化预览，用于判断是否可以作为新的发布冻结版本。
          </div>
        </a-card>

        <a-card size="small" title="字段对照">
          <a-table
            :columns="[
              { title: '字段', key: 'label', dataIndex: 'label', width: '18%' },
              { title: '基线版本', key: 'baseValue', dataIndex: 'baseValue', width: '34%' },
              { title: '当前版本', key: 'targetValue', dataIndex: 'targetValue', width: '34%' },
              { title: '状态', key: 'changed', width: '14%' }
            ]"
            :data-source="compareFieldRows"
            :pagination="false"
            size="small"
            row-key="key"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'changed'">
                <a-tag :color="record.changed ? 'orange' : 'green'">
                  {{ record.changed ? '已变化' : '一致' }}
                </a-tag>
              </template>
            </template>
          </a-table>
        </a-card>

        <div class="compare-preview-grid">
          <a-card size="small" :title="`基线预览 · ${compareBaseItem.revisionCode || compareBaseItem.status || '未标注'}`">
            <StateEmpty v-if="!comparePreviewBaseText" description="基线版本没有结构化预览内容" />
            <pre v-else class="payload-preview">{{ comparePreviewBaseText }}</pre>
          </a-card>

          <a-card size="small" :title="`当前预览 · ${compareTargetItem.revisionCode || compareTargetItem.status || '未标注'}`">
            <StateEmpty v-if="!comparePreviewTargetText" description="当前版本没有结构化预览内容" />
            <pre v-else class="payload-preview">{{ comparePreviewTargetText }}</pre>
          </a-card>
        </div>

        <a-card size="small" :title="`差异结论 (${compareSummary.length})`">
          <StateEmpty v-if="compareSummary.length === 0" description="当前没有提炼出显式差异" />
          <div v-else class="drawer-list">
            <article
              v-for="item in compareSummary"
              :key="item"
              class="drawer-list-item is-static"
            >
              <strong>{{ item }}</strong>
            </article>
          </div>
        </a-card>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.document-center-page {
  display: grid;
  gap: 16px;
}

.filter-stack {
  display: grid;
  gap: 12px;
}

.distribution-stack {
  display: grid;
  gap: 10px;
}

.distribution-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--content-border);
  border-radius: 12px;
  background: var(--surface-raised);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.distribution-item:hover,
.distribution-item.is-active {
  border-color: var(--accent);
  box-shadow: var(--shadow-soft);
  transform: translateY(-1px);
}

.summary-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-metric {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--content-border);
  border-radius: 14px;
  background: var(--surface-raised);
}

.summary-metric span {
  color: var(--text-secondary);
  font-size: 12px;
}

.summary-metric strong {
  color: var(--text-primary);
  font-size: 20px;
  line-height: 1;
}

.result-title-cell {
  display: grid;
  gap: 4px;
}

.result-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.result-subtitle {
  color: var(--text-secondary);
  line-height: 1.6;
}

.result-summary,
.result-subtle {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
}

.result-meta-cell {
  display: grid;
  gap: 4px;
}

.detail-stack {
  display: grid;
  gap: 16px;
}

.action-grid {
  display: grid;
  gap: 14px;
}

.action-section {
  display: grid;
  gap: 10px;
}

.action-section__title {
  font-weight: 600;
  color: var(--text-primary);
}

.drawer-list {
  display: grid;
  gap: 10px;
}

.drawer-list-item {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--content-border);
  border-radius: 12px;
  background: var(--surface-raised);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.drawer-list-item.is-static {
  cursor: default;
}

.drawer-list-item:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.drawer-list-item.is-static:hover {
  transform: none;
}

.drawer-list-item span {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.timeline-list {
  display: grid;
  gap: 10px;
}

.timeline-item {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--content-border);
  border-radius: 12px;
  background: var(--surface-raised);
}

.timeline-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.timeline-item__meta {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.compare-stack {
  display: grid;
  gap: 16px;
}

.compare-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.payload-preview {
  margin: 0;
  padding: 12px 14px;
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--content-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-raised) 88%, black 2%);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .summary-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .summary-metric-grid {
    grid-template-columns: 1fr;
  }

  .compare-preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
