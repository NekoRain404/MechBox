<script setup lang="ts">
/**
 * BOMExportPage.vue - BOM 导出页面
 * 物料清单自动汇总与导出
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import AnalysisBrief from '../components/AnalysisBrief.vue'
import StateEmpty from '../components/StateEmpty.vue'
import { useAppFeedback } from '../composables/useAppFeedback'
import { useWorkflowRecorder } from '../composables/useWorkflowRecorder'
import { loadEnterpriseSettings } from '../engine/enterprise-settings'
import { generateBOMReport, exportBOMToCSV, exportBOMToJSON, type BOMItem } from '../engine/bom-export'
import { listBomDrafts, loadLatestBomDraft, saveBomDraft } from '../utils/bomDrafts'
import { appendStoredReport, getReportModuleMeta } from '../utils/reporting'
import {
  ENGINEERING_LIBRARY_EVENT,
  fetchEngineeringLibrarySnapshot,
  notifyEngineeringLibraryUpdated,
  upsertDocumentAttachment,
  type EngineeringLibrarySnapshot,
} from '../utils/engineering-library'
import {
  loadActiveProject,
  saveActiveProject,
  updateStoredProject,
  WORKSPACE_STORAGE_EVENT,
  type WorkspaceProject,
} from '../utils/workspace'
import { DownloadOutlined, PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons-vue'

const feedback = useAppFeedback()
const router = useRouter()
const { recordModuleCalculation } = useWorkflowRecorder()
const settings = loadEnterpriseSettings()
const activeProject = ref<WorkspaceProject | null>(loadActiveProject())
const persistedBomId = ref<string | null>(null)
let projectContextRequestId = 0
const engineeringSnapshot = ref<EngineeringLibrarySnapshot>({
  partMasters: [],
  supplierParts: [],
  bomRevisionLinks: [],
  documentAttachments: [],
})

function createDefaultProjectInfo(project: WorkspaceProject | null) {
  return {
    name: project?.name || '机械装配体BOM',
    number: project?.id.replace('proj_', 'BOM-') || 'BOM-2026-001',
    author: settings.defaultAuthor || '工程师',
    date: new Date().toISOString().slice(0, 10),
  }
}

const projectInfo = ref(createDefaultProjectInfo(activeProject.value))

const categoryOptions = [
  { value: 'bearing', label: '轴承' },
  { value: 'bolt', label: '螺栓' },
  { value: 'seal', label: '密封圈' },
  { value: 'gear', label: '齿轮' },
  { value: 'spring', label: '弹簧' },
  { value: 'shaft', label: '轴' },
  { value: 'motor', label: '电机' },
  { value: 'material', label: '材料' },
  { value: 'other', label: '其他' },
]

const supplierOptions = ['SKF', 'NSK', 'FAG', 'NTN', 'MISUMI', 'SIEMENS', 'ABB', '国标', '自定义']
const categoryLabels: Record<string, string> = {
  bearing: '轴承',
  bolt: '螺栓',
  seal: '密封圈',
  gear: '齿轮',
  spring: '弹簧',
  shaft: '轴',
  motor: '电机',
  material: '材料',
  other: '其他',
}

const projectModuleLabels: Record<string, string> = {
  seals: '密封圈',
  bearings: '轴承选型',
  bolts: '螺栓连接',
  tolerances: '公差配合',
  'param-scan': '参数扫描',
  'monte-carlo': '蒙特卡洛',
  'bom-export': 'BOM 导出',
  'material-sub': '材料代换',
}

const allowedBomCategories: BOMItem['category'][] = ['bearing', 'bolt', 'seal', 'gear', 'spring', 'shaft', 'motor', 'material', 'other']

function createBlankItem(): BOMItem {
  return {
    id: `item_${Date.now()}`,
    category: 'other',
    designation: '',
    description: '',
    quantity: 1,
    supplier: '',
    supplierPartNo: '',
    unitCost: 0,
    totalCost: 0,
  }
}

function createInitialBomItems(): BOMItem[] {
  return [createBlankItem()]
}

const bomItems = ref<BOMItem[]>(createInitialBomItems())

function normalizeBomCategory(category?: string): BOMItem['category'] {
  return allowedBomCategories.includes(category as BOMItem['category']) ? (category as BOMItem['category']) : 'other'
}

function addItem() {
  bomItems.value.push(createBlankItem())
}

function removeItem(id: string) {
  bomItems.value = bomItems.value.filter((item) => item.id !== id)
}

function normalizeItem(item: BOMItem) {
  item.quantity = Math.max(1, Number(item.quantity || 1))
  item.unitCost = Number(item.unitCost || 0)
  item.totalCost = item.quantity * item.unitCost
}

function updateItem(item: BOMItem) {
  normalizeItem(item)
}

function isBomItemRecord(record: unknown): record is BOMItem {
  return Boolean(record && typeof record === 'object' && 'id' in record && 'designation' in record)
}

function handlePersistBomDraft() {
  void persistBomDraft()
}

function handleBomItemChange(record: unknown) {
  if (!isBomItemRecord(record)) return
  updateItem(record)
}

const bomReport = computed(() =>
  generateBOMReport(projectInfo.value.name, projectInfo.value.number, projectInfo.value.author, bomItems.value),
)

const invalidItems = computed(() =>
  bomItems.value.filter((item) => !item.designation.trim() || !item.description.trim()),
)

const incompleteCommercialItems = computed(() =>
  bomItems.value.filter((item) => !item.standard?.trim() || !item.supplierPartNo?.trim()),
)

const duplicateAggregations = computed(() =>
  bomReport.value.items.filter((aggregated) => {
    const matches = bomItems.value.filter(
      (source) =>
        source.category === aggregated.category &&
        source.designation === aggregated.designation &&
        (source.supplier || '') === (aggregated.supplier || ''),
    )
    return matches.length > 1
  }),
)

const bomObjectId = computed(() => persistedBomId.value ?? `draft_${projectInfo.value.number}`)
const engineeringStats = computed(() => {
  const relevantAttachments = engineeringSnapshot.value.documentAttachments.filter(
    (item) =>
      item.objectType === 'bom' &&
      item.objectId === bomObjectId.value,
  )
  const relevantRevisionLinks = engineeringSnapshot.value.bomRevisionLinks.filter((item) => item.bomId === bomObjectId.value)
  const linkedPartIds = new Set(relevantRevisionLinks.map((item) => item.partId))
  const relevantParts = engineeringSnapshot.value.partMasters.filter((item) => linkedPartIds.has(item.id))
  const relevantSupplierParts = engineeringSnapshot.value.supplierParts.filter((item) => linkedPartIds.has(item.partId))
  return {
    partCount: relevantParts.length,
    supplierPartCount: relevantSupplierParts.length,
    revisionLinkCount: relevantRevisionLinks.length,
    attachmentCount: relevantAttachments.length,
  }
})

async function syncEngineeringSnapshot() {
  engineeringSnapshot.value = await fetchEngineeringLibrarySnapshot({
    projectId: activeProject.value?.id,
    bomId: bomObjectId.value,
    objectType: 'bom',
    objectId: bomObjectId.value,
  })
}

function handleEngineeringLibraryChanged() {
  void syncEngineeringSnapshot()
}

const pageAlerts = computed(() => {
  const alerts: Array<{ level: 'warning' | 'info'; message: string; description: string }> = []

  if (!activeProject.value) {
    alerts.push({
      level: 'warning',
      message: '当前 BOM 未绑定活动项目。',
      description: '建议先在项目中心打开项目，再把 BOM 摘要同步进去，避免导出记录和项目上下文脱节。',
    })
  }

  if (invalidItems.value.length) {
    alerts.push({
      level: 'warning',
      message: `有 ${invalidItems.value.length} 条物料缺少型号或描述`,
      description: '导出前应补齐关键信息，否则 BOM 只能作为内部草稿使用。',
    })
  }

  if (duplicateAggregations.value.length) {
    alerts.push({
      level: 'info',
      message: `检测到 ${duplicateAggregations.value.length} 组可合并项目`,
      description: '右侧汇总表会自动合并相同类别、规格和供应商的记录。',
    })
  }

  if (incompleteCommercialItems.value.length) {
    alerts.push({
      level: 'warning',
      message: `有 ${incompleteCommercialItems.value.length} 条物料缺少标准号或订货号`,
      description: '如果要直接进入采购或 ERP，应补齐标准号和供应商订货号，避免后续人工二次确认。',
    })
  }

  if (persistedBomId.value) {
    alerts.push({
      level: 'info',
      message: '当前 BOM 草稿已持久化到 SQLite。',
      description: `草稿编号 ${persistedBomId.value}，可以继续迭代后再次保存，不再只依赖页面临时状态。`,
    })
  }

  if (engineeringStats.value.partCount || engineeringStats.value.attachmentCount) {
    alerts.push({
      level: 'info',
      message: `当前 BOM 已映射 ${engineeringStats.value.partCount} 条零件主数据、${engineeringStats.value.revisionLinkCount} 条修订链、${engineeringStats.value.attachmentCount} 条文档记录。`,
      description: '这批对象可继续作为采购、文档中心和后续 ERP 桥接的正式骨架。',
    })
  }

  return alerts
})

const decisionPanel = computed(() => {
  const status: 'success' | 'info' | 'warning' | 'error' =
    invalidItems.value.length === 0 ? 'success' : invalidItems.value.length <= 2 ? 'warning' : 'error'

  return {
    conclusion: `当前 BOM 共录入 ${bomItems.value.length} 条原始物料，汇总后为 ${bomReport.value.itemCount} 个采购项，总成本约 ¥${bomReport.value.totalCost.toFixed(2)}。`,
    status,
    risks: [
      ...(invalidItems.value.length ? ['存在未补齐型号或描述的物料，导出后的采购沟通信息不完整。'] : []),
      ...(incompleteCommercialItems.value.length ? ['部分物料缺少标准号或订货号，正式采购落单时仍需人工补录。'] : []),
      ...(duplicateAggregations.value.length ? ['当前存在可合并项目，若不汇总会造成采购数量和成本阅读分散。'] : []),
      ...(!activeProject.value ? ['当前 BOM 尚未绑定活动项目，后续归档链会比较松散。'] : []),
    ],
    actions: invalidItems.value.length
      ? ['先补齐空白物料行，再导出给采购或归档。', '对关键件补充标准号、材质和供应商订货号。']
      : ['可以直接导出 CSV 或 JSON，再进入 ERP/采购流程。', '建议把当前汇总结果同步到项目摘要，并为关键件补齐订货号。', '保存草稿后优先复核零件主数据和文档附件是否已经完整生成。'],
    boundaries: [
      '左侧编辑表是原始录入区，右侧汇总表才是最终导出结果。',
      '当前 BOM 主要做结构化整理，不自动判断替代料、库存和交期。',
    ],
  }
})

function buildProjectSummary() {
  return `BOM 共 ${bomReport.value.itemCount} 项采购件，总成本 ¥${bomReport.value.totalCost.toFixed(2)}，缺少采购字段 ${incompleteCommercialItems.value.length} 项，最后同步 ${new Date().toLocaleString()}。`
}

function applyBomDraft(draft: WorkflowBomDraftRecord) {
  persistedBomId.value = draft.bomId ?? null
  projectInfo.value.name = draft.projectName
  projectInfo.value.number = draft.projectNumber
  projectInfo.value.author = draft.author || settings.defaultAuthor || '工程师'
  projectInfo.value.date = draft.date || projectInfo.value.date
  bomItems.value = draft.items.map((item) => ({
    id: item.id,
    category: normalizeBomCategory(item.category),
    designation: item.designation,
    description: item.description,
    quantity: Number(item.quantity || 1),
    standard: item.standard,
    material: item.material,
    supplier: item.supplier,
    supplierPartNo: item.supplierPartNo,
    unitCost: Number(item.unitCost || 0),
    totalCost: Number(item.totalCost || 0),
  }))
}

function resetBomEditor(project: WorkspaceProject | null) {
  persistedBomId.value = null
  projectInfo.value = createDefaultProjectInfo(project)
  bomItems.value = createInitialBomItems()
}

function hasMeaningfulBomContent() {
  if (persistedBomId.value) return true
  return bomItems.value.some(
    (item) =>
      Boolean(item.designation?.trim()) ||
      Boolean(item.description?.trim()) ||
      Boolean(item.standard?.trim()) ||
      Boolean(item.material?.trim()) ||
      Boolean(item.supplier?.trim()) ||
      Boolean(item.supplierPartNo?.trim()) ||
      Number(item.unitCost || 0) > 0 ||
      Number(item.totalCost || 0) > 0 ||
      Number(item.quantity || 1) !== 1,
  )
}

async function loadLatestDraftForCurrentContext(project: WorkspaceProject | null) {
  if (project?.id) {
    return loadLatestBomDraft(project.id)
  }

  const drafts = await listBomDrafts(200)
  return drafts.find((draft) => !draft.projectId) ?? null
}

async function restoreLatestDraft() {
  const draft = await loadLatestDraftForCurrentContext(activeProject.value)
  if (!draft) {
    feedback.info(activeProject.value ? '当前项目还没有已保存的 BOM 草稿' : '当前没有可恢复的 BOM 草稿')
    return
  }
  applyBomDraft(draft)
  await syncEngineeringSnapshot()
  feedback.notifyOpened('BOM 草稿')
}

async function persistBomDraft(showFeedback = true, targetProject: WorkspaceProject | null = activeProject.value) {
  const draft = await saveBomDraft({
    bomId: persistedBomId.value ?? undefined,
    projectId: targetProject?.id,
    projectName: projectInfo.value.name,
    projectNumber: projectInfo.value.number,
    author: projectInfo.value.author,
    date: projectInfo.value.date,
    revision: 'A',
    summary: buildProjectSummary(),
    status: 'draft',
    sourceKind: 'manual',
    items: bomItems.value.map((item) => ({
      ...item,
      quantity: Number(item.quantity || 1),
      unitCost: Number(item.unitCost || 0),
      totalCost: Number(item.totalCost || Number(item.quantity || 1) * Number(item.unitCost || 0)),
    })),
  })

  if (!draft) {
    if (showFeedback) {
      feedback.warning('当前环境不支持 BOM 草稿持久化')
    }
    return
  }

  applyBomDraft(draft)
  notifyEngineeringLibraryUpdated()
  await syncEngineeringSnapshot()
  if (showFeedback) {
    feedback.notifySaved('BOM 草稿')
  }
}

function syncProjectContext(project: WorkspaceProject | null) {
  const previousProject = activeProject.value
  activeProject.value = project
  if (!project) {
    const previousAutoNumber = previousProject?.id ? previousProject.id.replace('proj_', 'BOM-') : 'BOM-2026-001'
    if (projectInfo.value.number === previousAutoNumber) {
      projectInfo.value.number = 'BOM-2026-001'
    }
    if (!previousProject || projectInfo.value.name === previousProject.name) {
      projectInfo.value.name = '机械装配体BOM'
    }
    return
  }

  if (!previousProject || projectInfo.value.name === previousProject.name || projectInfo.value.name === '机械装配体BOM') {
    projectInfo.value.name = project.name
  }

  const previousAutoNumber = previousProject?.id ? previousProject.id.replace('proj_', 'BOM-') : 'BOM-2026-001'
  if (!previousProject || projectInfo.value.number === previousAutoNumber || projectInfo.value.number === 'BOM-2026-001') {
    projectInfo.value.number = project.id.replace('proj_', 'BOM-')
  }
}

async function applyProjectContext(project: WorkspaceProject | null) {
  const requestId = ++projectContextRequestId
  activeProject.value = project
  const draft = await loadLatestDraftForCurrentContext(project)
  if (requestId !== projectContextRequestId) return

  if (draft) {
    applyBomDraft(draft)
  } else {
    resetBomEditor(project)
  }

  await syncEngineeringSnapshot()
}

async function refreshProjectContext() {
  const nextProject = loadActiveProject()
  const currentProjectId = activeProject.value?.id ?? null
  const nextProjectId = nextProject?.id ?? null

  if (currentProjectId === nextProjectId) {
    syncProjectContext(nextProject)
    await syncEngineeringSnapshot()
    return
  }

  if (hasMeaningfulBomContent()) {
    await persistBomDraft(false, activeProject.value)
  }

  await applyProjectContext(nextProject)
}

function handleWorkspaceChanged() {
  void refreshProjectContext()
}

async function syncToProject() {
  if (!activeProject.value) {
    feedback.warning('当前没有活动项目，无法同步')
    return
  }

  const result = updateStoredProject(activeProject.value.id, (project) => ({
    ...project,
    inputSummary: buildProjectSummary(),
    updatedAt: new Date().toISOString(),
  }))
  activeProject.value = result.activeProject
  if (activeProject.value) {
    saveActiveProject(activeProject.value)
  }
  await persistBomDraft(false)
  await recordBomWorkflow('项目同步')
  feedback.notifySaved('项目摘要')
}

async function recordBomWorkflow(reason: '项目同步' | 'CSV 导出' | 'JSON 导出') {
  return recordModuleCalculation({
    module: 'bom-export',
    name: `${projectInfo.value.name} BOM ${reason}`,
    projectSummary: buildProjectSummary(),
    inputData: {
      projectInfo: { ...projectInfo.value },
      bomId: persistedBomId.value,
      items: bomItems.value.map((item) => ({
        ...item,
        quantity: Number(item.quantity || 1),
        unitCost: Number(item.unitCost || 0),
        totalCost: Number(item.totalCost || 0),
      })),
    },
    contextData: {
      pageAlerts: pageAlerts.value,
      invalidItems: invalidItems.value.length,
      incompleteCommercialItems: incompleteCommercialItems.value.length,
      duplicateAggregations: duplicateAggregations.value.length,
      decisionPanel: decisionPanel.value,
    },
    outputData: {
      bomId: persistedBomId.value,
      report: bomReport.value,
      totalCost: bomReport.value.totalCost,
      itemCount: bomReport.value.itemCount,
    },
    decisionData: decisionPanel.value,
    derivedMetrics: {
      itemCount: bomReport.value.itemCount,
      totalCost: bomReport.value.totalCost,
      invalidItems: invalidItems.value.length,
      incompleteCommercialItems: incompleteCommercialItems.value.length,
    },
    resultKind: 'summary',
    sourceKind: 'analysis-export',
    appendRecent: false,
  })
}

async function registerExportRecord(type: 'csv' | 'json', artifactLink?: { runId?: string | null; resultId?: string | null }) {
  const reportMeta = getReportModuleMeta('bom-export')
  appendStoredReport({
    id: `rpt_${Date.now()}`,
    title: `${projectInfo.value.name} BOM ${type.toUpperCase()}`,
    module: 'bom-export',
    createdAt: new Date().toISOString(),
    type,
    status: 'generated',
    projectNumber: projectInfo.value.number,
    projectId: activeProject.value?.id,
    projectName: activeProject.value?.name ?? projectInfo.value.name,
    author: projectInfo.value.author,
    standardRef: reportMeta.standardRef,
    summary: buildProjectSummary(),
    sourceKind: 'analysis-export',
    linkedRunId: artifactLink?.runId ?? undefined,
    linkedResultId: artifactLink?.resultId ?? undefined,
  })
}

onMounted(() => {
  void applyProjectContext(loadActiveProject())
  window.addEventListener(WORKSPACE_STORAGE_EVENT, handleWorkspaceChanged)
  window.addEventListener(ENGINEERING_LIBRARY_EVENT, handleEngineeringLibraryChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener(WORKSPACE_STORAGE_EVENT, handleWorkspaceChanged)
  window.removeEventListener(ENGINEERING_LIBRARY_EVENT, handleEngineeringLibraryChanged)
})

async function registerBomDocumentAttachment(type: 'csv' | 'json') {
  const fileName =
    type === 'csv'
      ? `BOM-${projectInfo.value.number}-${projectInfo.value.date}.csv`
      : `BOM-${projectInfo.value.number}.json`
  const mimeType = type === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
  await upsertDocumentAttachment({
    id: `doc_bom_${bomObjectId.value}_${type}`,
    projectId: activeProject.value?.id,
    objectType: 'bom',
    objectId: bomObjectId.value,
    module: 'bom-export',
    documentKind: type,
    title: `${projectInfo.value.name} BOM ${type.toUpperCase()}`,
    fileName,
    mimeType,
    storageType: 'export-reference',
    revisionCode: 'A',
    createdAt: new Date().toISOString(),
    createdBy: projectInfo.value.author,
    status: 'generated',
    payload: {
      bomId: persistedBomId.value,
      projectNumber: projectInfo.value.number,
      itemCount: bomReport.value.itemCount,
      totalCost: bomReport.value.totalCost,
    },
  })
}

async function exportCSV() {
  await persistBomDraft(false)
  const artifactLink = await recordBomWorkflow('CSV 导出')
  const csv = exportBOMToCSV(bomReport.value)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `BOM-${projectInfo.value.number}-${projectInfo.value.date}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
  await registerBomDocumentAttachment('csv')
  await registerExportRecord('csv', artifactLink)
  await syncEngineeringSnapshot()
  feedback.notifyExported('BOM CSV')
}

async function exportJSON() {
  await persistBomDraft(false)
  const artifactLink = await recordBomWorkflow('JSON 导出')
  const json = exportBOMToJSON(bomReport.value)
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `BOM-${projectInfo.value.number}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  await registerBomDocumentAttachment('json')
  await registerExportRecord('json', artifactLink)
  await syncEngineeringSnapshot()
  feedback.notifyExported('BOM JSON')
}
</script>

<template>
  <div class="bom-export-page">
    <PageToolbar title="MechBox" subtitle="BOM 物料清单导出">
      <a-space>
        <a-button size="small" @click="router.push('/documents')">文档中心</a-button>
        <a-button size="small" @click="addItem"><template #icon><PlusOutlined /></template>添加零件</a-button>
        <a-button size="small" @click="handlePersistBomDraft"><template #icon><SaveOutlined /></template>保存草稿</a-button>
        <a-button size="small" @click="restoreLatestDraft">恢复草稿</a-button>
        <a-button size="small" @click="syncToProject" :disabled="!activeProject"><template #icon><SaveOutlined /></template>同步到项目</a-button>
        <a-button size="small" type="primary" @click="exportCSV"><template #icon><DownloadOutlined /></template>导出 CSV</a-button>
        <a-button size="small" @click="exportJSON"><template #icon><DownloadOutlined /></template>导出 JSON</a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <AnalysisBrief
        title="BOM 汇总任务"
        summary="用于把原始零部件条目整理为采购侧可读的汇总物料清单，适合设计阶段快速形成采购项、成本视图和结构化导出。"
        :metrics="[
          { label: '原始记录', value: String(bomItems.length) },
          { label: '汇总采购项', value: String(bomReport.itemCount) },
          { label: '总成本', value: `¥${bomReport.totalCost.toFixed(2)}` }
        ]"
        :inputs="[
          '左侧维护原始物料条目，包括类别、规格、数量、供应商和单价。',
          '右侧会按类别、规格和供应商自动汇总成采购视图。'
        ]"
        :outputs="[
          'CSV/JSON 结构化导出。',
          '可同步到当前项目摘要，并登记到报告中心形成导出记录。'
        ]"
        :notes="[
          '当前汇总逻辑适合结构化整理，不替代 ERP 主数据、库存或交期系统。',
          '导出前应补齐型号、描述、标准和订货号等关键字段。'
        ]"
      />

      <ToolPageLayout :input-span="11" :output-span="13">
        <template #side>
          <a-card title="项目信息" size="small">
            <a-row :gutter="12">
              <a-col :span="8"><a-form-item label="项目名称"><a-input v-model:value="projectInfo.name" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="项目编号"><a-input v-model:value="projectInfo.number" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="编制人"><a-input v-model:value="projectInfo.author" /></a-form-item></a-col>
            </a-row>
            <div class="section-note">
              左侧维护原始物料行，右侧会按类别、规格和供应商自动汇总成导出清单。
            </div>
          </a-card>

          <a-card title="活动项目上下文" size="small">
              <a-descriptions v-if="activeProject" bordered size="small" :column="1">
              <a-descriptions-item label="项目名称">{{ activeProject.name }}</a-descriptions-item>
              <a-descriptions-item label="所属模块">{{ projectModuleLabels[activeProject.module] || activeProject.module }}</a-descriptions-item>
              <a-descriptions-item label="项目摘要">{{ activeProject.inputSummary || '尚未写入摘要' }}</a-descriptions-item>
            </a-descriptions>
            <StateEmpty v-else description="暂无活动项目" />
          </a-card>

          <a-card title="正式对象映射" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="零件主数据" :value="engineeringStats.partCount" /></a-col>
              <a-col :span="12"><a-statistic title="供应商料号" :value="engineeringStats.supplierPartCount" /></a-col>
              <a-col :span="12"><a-statistic title="BOM 修订链" :value="engineeringStats.revisionLinkCount" /></a-col>
              <a-col :span="12"><a-statistic title="文档附件" :value="engineeringStats.attachmentCount" /></a-col>
            </a-row>
            <div class="section-note">
              BOM 草稿保存后会自动派生零件主数据、供应商料号和 BOM 修订映射；导出 CSV/JSON 时会登记文档附件对象。
            </div>
          </a-card>

          <a-card :title="`原始物料录入 (${bomItems.length} 条)`" size="small">
            <a-table
              :columns="[
                { title: '类别', dataIndex: 'category', key: 'category', width: '14%' },
                { title: '型号/规格', dataIndex: 'designation', key: 'designation', width: '18%' },
                { title: '描述', dataIndex: 'description', key: 'description', width: '18%' },
                { title: '数量', dataIndex: 'quantity', key: 'quantity', width: '10%' },
                { title: '供应商', dataIndex: 'supplier', key: 'supplier', width: '14%' },
                { title: '单价', dataIndex: 'unitCost', key: 'unitCost', width: '12%' },
                { title: '操作', key: 'actions', width: '14%' }
              ]"
              :data-source="bomItems"
              :pagination="false"
              size="small"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'category'">
                  <a-select v-model:value="record.category" size="small" style="width: 100%" :options="categoryOptions" @change="handleBomItemChange(record)" />
                </template>
                <template v-else-if="column.key === 'designation'">
                  <a-input v-model:value="record.designation" size="small" placeholder="型号" @change="handleBomItemChange(record)" />
                </template>
                <template v-else-if="column.key === 'description'">
                  <a-input v-model:value="record.description" size="small" placeholder="描述" @change="handleBomItemChange(record)" />
                </template>
                <template v-else-if="column.key === 'quantity'">
                  <a-input-number v-model:value="record.quantity" size="small" :min="1" style="width: 100%" @change="handleBomItemChange(record)" />
                </template>
                <template v-else-if="column.key === 'supplier'">
                  <a-select
                    v-model:value="record.supplier"
                    size="small"
                    style="width: 100%"
                    :options="supplierOptions.map((supplier) => ({ value: supplier, label: supplier }))"
                    placeholder="供应商"
                    @change="handleBomItemChange(record)"
                  />
                </template>
                <template v-else-if="column.key === 'unitCost'">
                  <a-input-number v-model:value="record.unitCost" size="small" :min="0" :step="0.1" style="width: 100%" @change="handleBomItemChange(record)" />
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-button type="link" danger size="small" @click="removeItem(record.id)">
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </template>
              </template>
            </a-table>
          </a-card>

          <AlertStack :items="pageAlerts" />
        </template>

        <template #main>
          <a-card :title="`汇总物料清单 (${bomReport.itemCount} 项)`" size="small">
            <a-table
              :columns="[
                { title: '类别', dataIndex: 'category', key: 'category', width: '12%' },
                { title: '型号/规格', dataIndex: 'designation', key: 'designation', width: '16%' },
                { title: '描述', dataIndex: 'description', key: 'description', width: '18%' },
                { title: '数量', dataIndex: 'quantity', key: 'quantity', width: '10%' },
                { title: '供应商', dataIndex: 'supplier', key: 'supplier', width: '12%' },
                { title: '订货号', dataIndex: 'supplierPartNo', key: 'supplierPartNo', width: '14%' },
                { title: '单价(元)', dataIndex: 'unitCost', key: 'unitCost', width: '9%' },
                { title: '总价(元)', dataIndex: 'totalCost', key: 'totalCost', width: '9%' }
              ]"
              :data-source="bomReport.items"
              :pagination="false"
              size="small"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'category'">
                  <a-tag color="blue">{{ categoryLabels[record.category] || record.category }}</a-tag>
                </template>
                <template v-else-if="column.key === 'unitCost' || column.key === 'totalCost'">
                  ¥{{ Number(record[column.key] || 0).toFixed(2) }}
                </template>
              </template>
            </a-table>

            <a-divider />
            <a-row :gutter="12">
              <a-col :span="8"><a-statistic title="原始记录" :value="bomItems.length" /></a-col>
              <a-col :span="8"><a-statistic title="汇总采购项" :value="bomReport.itemCount" /></a-col>
              <a-col :span="8"><a-statistic title="总成本" prefix="¥" :value="bomReport.totalCost" :precision="2" /></a-col>
            </a-row>
          </a-card>

          <CalculationDecisionPanel
            title="BOM 判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.bom-export-page {
  max-width: 1320px;
  margin: 0 auto;
}
</style>
