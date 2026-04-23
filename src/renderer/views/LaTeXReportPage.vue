<script setup lang="ts">
/**
 * LaTeXReportPage.vue - 工程计算书编制
 */
import { computed, ref, watch } from 'vue'
import { jsPDF } from 'jspdf'
import { useRouter } from 'vue-router'
import PageToolbar from '../components/PageToolbar.vue'
import AnalysisBrief from '../components/AnalysisBrief.vue'
import AnalysisDecisionPanel from '../components/AnalysisDecisionPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import ProjectContextCard from '../components/ProjectContextCard.vue'
import { FileTextOutlined } from '@ant-design/icons-vue'
import { appendStoredReport, buildReportText, getReportModuleMeta, type ReportModuleKey } from '../utils/reporting'
import { useAppFeedback } from '../composables/useAppFeedback'
import { useActiveProject } from '../composables/useActiveProject'
import { upsertDocumentAttachment } from '../utils/engineering-library'

const feedback = useAppFeedback()
const router = useRouter()
const { activeProject } = useActiveProject()
const activeFormulaSection = ref('报告结构')

const reportConfig = ref({
  projectName: '轴承选型计算书',
  projectNumber: 'PRJ-2026-001',
  author: '工程师',
  date: new Date().toISOString().slice(0, 10),
  module: 'bearings' as ReportModuleKey,
  standardRef: getReportModuleMeta('bearings').standardRef,
  includeFormulas: true,
  includeStandardRefs: true,
  includeWatermark: true,
  summary: getReportModuleMeta('bearings').summary,
})

const moduleOptions: Array<{ value: ReportModuleKey; label: string }> = [
  { value: 'seals', label: '密封圈' },
  { value: 'bearings', label: '轴承' },
  { value: 'bolts', label: '螺栓' },
  { value: 'tolerances', label: '公差配合' },
  { value: 'param-scan', label: '参数扫描' },
  { value: 'monte-carlo', label: '蒙特卡洛' },
  { value: 'material-sub', label: '材料代换' },
  { value: 'reverse-identify', label: '逆向识别' },
]

const moduleMeta = computed(() => getReportModuleMeta(reportConfig.value.module))

const reportMetrics = computed(() => [
  { label: '报告编号', value: reportConfig.value.projectNumber },
  { label: '引用标准', value: reportConfig.value.standardRef },
  { label: '输出格式', value: 'PDF' },
])
const projectMetrics = computed(() => [
  { label: '当前模块', value: moduleMeta.value.label },
  { label: '报告编号', value: reportConfig.value.projectNumber },
  { label: '引用标准', value: reportConfig.value.standardRef },
])

const previewText = computed(() =>
  buildReportText(
    {
      id: `draft_${reportConfig.value.projectNumber}`,
      title: reportConfig.value.projectName,
      module: reportConfig.value.module,
      createdAt: `${reportConfig.value.date}T00:00:00`,
      projectNumber: reportConfig.value.projectNumber,
      standardRef: reportConfig.value.standardRef,
      author: reportConfig.value.author,
      summary: reportConfig.value.summary,
    },
    {
      includeFormulas: reportConfig.value.includeFormulas,
      includeStandardRefs: reportConfig.value.includeStandardRefs,
      includeWatermark: reportConfig.value.includeWatermark,
    },
  ),
)

const pageAlerts = computed(() => {
  const items: Array<{ level: 'warning' | 'info'; message: string; description?: string }> = []

  if (!reportConfig.value.includeFormulas) {
    items.push({
      level: 'warning',
      message: '当前报告未包含公式说明。',
      description: '这更适合做归档封面或提交件摘要，不适合作为完整计算书。',
    })
  }

  if (!reportConfig.value.includeStandardRefs) {
    items.push({
      level: 'warning',
      message: '当前报告未包含引用标准。',
      description: '对外发版或评审版通常应保留标准依据，避免报告边界不清。',
    })
  }

  if (reportConfig.value.includeWatermark) {
    items.push({
      level: 'info',
      message: '当前报告将附带内部流转水印。',
      description: '适合内部评审与过程归档，不建议直接作为正式外发件。',
    })
  }

  return items
})

const reportDecision = computed(() => ({
  conclusion: `当前计算书将以 ${reportConfig.value.projectNumber} 为编号输出，引用标准为 ${reportConfig.value.standardRef}。`,
  status: 'info' as const,
  risks: [
    reportConfig.value.includeFormulas
      ? '报告包含公式说明，但当前仍是结构化模板，不会自动串入所有模块的完整实时结果。'
      : '未包含公式说明时，报告更适合作封面级归档而非完整计算书。',
    reportConfig.value.includeWatermark
      ? '水印开启后更适合内部流转，不适合作正式外发件。'
      : '水印关闭时应注意版本标识、审签链和发放范围。',
  ],
  actions: [
    '生成前先核对项目编号、日期和引用标准。',
    '对外发版建议补充审签信息和对应模块结果页。',
  ],
  deliverables: ['PDF 计算书', '封面与项目信息页', '公式与标准引用页'],
}))

const formulaSections = [
  {
    title: '报告结构',
    formulas: [
      'Report = Cover + Metadata + Summary + Standards + Formulas + ArchiveNotes',
      'ProjectNumber = user input',
      'StandardRef = module default or manual override',
    ],
    variables: [
      'Metadata: 项目名称、编号、编制人、日期、模块',
      'Summary: 报告摘要与归档说明',
    ],
    notes: [
      '当前页面生成的是结构化工程 PDF，不是完整 LaTeX 编译流水线，但输出边界比演示态更正式明确。',
    ],
  },
  {
    title: '归档边界',
    formulas: [
      'ArchiveScope = report template + selected references + selected formulas',
      'ExternalIssue requires signoff + module verification',
    ],
    variables: [
      'ArchiveScope: 当前导出的结构化报告范围',
      'ExternalIssue: 正式外发版本',
    ],
    notes: [
      '报告页负责组织归档结构，工程真实性仍取决于上游模块计算、来源链和复核记录。',
    ],
  },
]

watch(
  () => reportConfig.value.module,
  (module) => {
    const meta = getReportModuleMeta(module)
    reportConfig.value.standardRef = meta.standardRef
    reportConfig.value.summary = meta.summary
    if (!reportConfig.value.projectName.trim() || reportConfig.value.projectName.includes('计算书') || reportConfig.value.projectName.includes('报告')) {
      reportConfig.value.projectName = meta.label
    }
  },
)

watch(
  () => activeProject.value,
  (project) => {
    if (!project) return
    if (!reportConfig.value.projectName.trim() || reportConfig.value.projectName === moduleMeta.value.label) {
      reportConfig.value.projectName = project.name
    }
    if (!reportConfig.value.projectNumber.trim() || reportConfig.value.projectNumber.startsWith('PRJ-')) {
      reportConfig.value.projectNumber = project.id
    }
  },
  { immediate: true },
)

function generateReport() {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const lines = previewText.value.split('\n')
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

  if (reportConfig.value.includeWatermark) {
    pdf.setTextColor(226, 232, 240)
    pdf.setFontSize(42)
    pdf.text('INTERNAL', pageWidth / 2, 160, { align: 'center', angle: 38 })
  }

  const filename = `${reportConfig.value.projectNumber}-${reportConfig.value.date}.pdf`
  pdf.save(filename)

  const reportRecord = {
    id: `rpt_${Date.now()}`,
    title: reportConfig.value.projectName,
    module: reportConfig.value.module,
    createdAt: new Date().toISOString(),
    type: 'pdf',
    status: 'generated',
    projectNumber: reportConfig.value.projectNumber,
    projectId: activeProject.value?.id,
    projectName: activeProject.value?.name,
    standardRef: reportConfig.value.standardRef,
    author: reportConfig.value.author,
    summary: reportConfig.value.summary,
    sourceKind: 'manual-report',
  } as const

  appendStoredReport(reportRecord)
  void upsertDocumentAttachment({
    id: `doc_manual_report_${reportRecord.id}`,
    projectId: activeProject.value?.id,
    objectType: 'report',
    objectId: reportRecord.id,
    module: reportRecord.module,
    documentKind: 'pdf',
    title: reportRecord.title,
    fileName: filename,
    mimeType: 'application/pdf',
    storageType: 'export-reference',
    revisionCode: 'A',
    createdAt: reportRecord.createdAt,
    createdBy: reportRecord.author,
    status: 'generated',
    payload: {
      projectNumber: reportRecord.projectNumber,
      standardRef: reportRecord.standardRef,
      sourceKind: reportRecord.sourceKind,
    },
  })

  feedback.notifyGenerated('计算书')
}
</script>

<template>
  <div class="latex-report-page">
    <PageToolbar title="MechBox" subtitle="工程计算书编制">
      <a-space>
        <a-button size="small" @click="router.push('/documents')">
          文档中心
        </a-button>
        <a-button type="primary" size="small" @click="generateReport">
          <template #icon><FileTextOutlined /></template>生成报告
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <AnalysisBrief
        title="报告编制任务"
        summary="用于把工程计算过程整理为可归档的计算书封面、项目信息、引用标准和公式说明，适合设计评审或内部归档场景。"
        :metrics="reportMetrics"
        :inputs="[
          '填写项目名称、编号、编制人、日期与引用标准。',
          '按需要勾选公式、标准引用和水印等报告内容。'
        ]"
        :outputs="[
          '封面页、项目信息页和计算公式说明。',
          '生成后会自动登记到报告中心，便于统一归档与导出。'
        ]"
        :notes="[
          '当前实现生成的是结构化 PDF 计算书，不是完整 LaTeX 编译流水线。',
          '如果后续要接入真实模板，可继续把模块结果和公式面板串进报告生成。'
        ]"
      />

      <ToolPageLayout :input-span="9" :output-span="15">
        <template #side>
          <a-card title="报告配置" size="small">
            <a-form layout="vertical">
              <a-form-item label="项目名称">
                <a-input v-model:value="reportConfig.projectName" />
              </a-form-item>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="项目编号">
                    <a-input v-model:value="reportConfig.projectNumber" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="编制人">
                    <a-input v-model:value="reportConfig.author" />
                  </a-form-item>
                </a-col>
              </a-row>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="日期">
                    <a-input type="date" v-model:value="reportConfig.date" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="模块">
                    <a-select v-model:value="reportConfig.module">
                      <a-select-option v-for="option in moduleOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>
              <a-form-item label="引用标准">
                <a-input v-model:value="reportConfig.standardRef" />
              </a-form-item>
              <a-form-item label="报告摘要">
                <a-textarea v-model:value="reportConfig.summary" :rows="4" />
              </a-form-item>
              <a-form-item label="报告内容">
                <div class="checkbox-group">
                  <a-checkbox v-model:checked="reportConfig.includeFormulas">包含公式说明</a-checkbox>
                  <a-checkbox v-model:checked="reportConfig.includeStandardRefs">包含标准引用</a-checkbox>
                  <a-checkbox v-model:checked="reportConfig.includeWatermark">添加内部水印</a-checkbox>
                </div>
              </a-form-item>
            </a-form>
            <div class="section-note">
              当前模块默认标准：{{ moduleMeta.standardRef }}
            </div>
          </a-card>

          <ProjectContextCard
            :active-project="activeProject"
            current-module="latex-report"
            current-module-label="工程计算书编制"
            :metrics="projectMetrics"
            note="如果当前存在活动项目，生成的计算书会自动带上项目关联，便于后续在报告中心按项目过滤。"
          />
        </template>

        <template #main>
          <AlertStack :items="pageAlerts" />

          <a-card title="报告预览" size="small">
            <pre class="report-preview">{{ previewText }}</pre>
          </a-card>

          <AnalysisDecisionPanel
            :conclusion="reportDecision.conclusion"
            :status="reportDecision.status"
            :risks="reportDecision.risks"
            :actions="reportDecision.actions"
            :deliverables="reportDecision.deliverables"
          />

          <FormulaPanel v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.latex-report-page {
  max-width: 1240px;
  margin: 0 auto;
}

.checkbox-group {
  display: grid;
  gap: 10px;
}

.report-preview {
  background: #f8fafc;
  padding: 20px;
  border-radius: 12px;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  max-height: 560px;
  overflow-y: auto;
  white-space: pre-wrap;
  color: #0f172a;
}
</style>
