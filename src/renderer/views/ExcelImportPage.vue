<script setup lang="ts">
/**
 * ExcelImportPage.vue - 结构化导入页面
 * 主进程或浏览器侧 CSV 模板解析 + 结构化校验
 */
import { computed, ref } from 'vue'
import DatabaseRuntimeBanner from '../components/DatabaseRuntimeBanner.vue'
import AlertStack from '../components/AlertStack.vue'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import AnalysisBrief from '../components/AnalysisBrief.vue'
import AnalysisDecisionPanel from '../components/AnalysisDecisionPanel.vue'
import StateEmpty from '../components/StateEmpty.vue'
import { useAppFeedback } from '../composables/useAppFeedback'
import {
  generateImportTemplate,
  parseCSV,
  standardTemplates,
  type StandardTemplateType,
  validateImportData,
} from '../engine/excel-import'
import { getElectronDb } from '../utils/electron-db'
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons-vue'

type ImportResult = {
  success: boolean
  recordsImported: number
  errors: string[]
  data: any[]
}

const templateType = ref<StandardTemplateType>('bearing')
const importResult = ref<ImportResult | null>(null)
const isImporting = ref(false)
const downloadMessage = ref('')
const browserFileInput = ref<HTMLInputElement | null>(null)
const feedback = useAppFeedback()

const templateConfig = computed(() => standardTemplates[templateType.value])
const hasElectronDb = computed(() => Boolean(getElectronDb()))
const runtimeNotice = computed(() =>
  hasElectronDb.value
    ? ''
    : '当前未检测到 Electron 原生数据库接口，页面已切换到浏览器本地模板下载与文件校验模式。',
)
const runtimeDetails = computed(() =>
  hasElectronDb.value
    ? []
    : [
        '浏览器模式支持 CSV 模板下载、字段校验和样例预览。',
        '当前流程只做结构化解析与校验，不直接写入 SQLite 数据库。',
      ],
)

const importDecision = computed(() => {
  if (!importResult.value) {
    return {
      conclusion: '尚未执行模板校验任务。',
      status: 'info' as const,
      risks: ['如果未先核对字段、单位和模板版本，批量数据很容易在校验阶段失败。'],
      actions: ['先下载当前模板并按字段定义准备数据，再执行文件校验。'],
      deliverables: ['模板文件', '校验结果摘要', '样例预览'],
    }
  }

  if (importResult.value.success && importResult.value.errors.length === 0) {
    return {
      conclusion: `本次文件已通过结构化校验，共识别 ${importResult.value.recordsImported} 条记录。`,
      status: 'success' as const,
      risks: [
        importResult.value.data.length
          ? '当前结果仅代表字段结构通过校验，仍建议对关键数值、单位和来源做抽样复核。'
          : '当前没有可预览记录，需检查原文件是否为空。',
      ],
      actions: [
        '对关键字段做抽样复核，确认单位、材料代号和标准号没有混用。',
        '如果后续要接入正式入库流程，建议固定模板版本并补充主数据映射。'],
      deliverables: ['通过校验记录数', '记录预览', '模板版本说明'],
    }
  }

  if (importResult.value.success) {
    return {
      conclusion: `本次文件部分通过校验，${importResult.value.recordsImported} 条记录可用，${importResult.value.errors.length} 条记录需要修正。`,
      status: 'warning' as const,
      risks: [
        '当前文件存在部分字段不符合模板约束，若直接继续下游处理，容易造成脏数据混入。',
        '部分行通过不代表整份文件已经满足统一模板要求。',
      ],
      actions: ['按错误列表逐项修正后重新校验。', '优先修正列名、数值列和缺失必填字段。'],
      deliverables: ['错误列表', '部分通过记录预览', '修订后的模板文件'],
    }
  }

  return {
    conclusion: '本次文件未通过结构化校验，需先修正模板或源文件后再重试。',
    status: 'error' as const,
    risks: [...(importResult.value.errors ?? ['存在未识别的导入错误。'])],
    actions: ['按错误信息逐项修正字段、格式或单位。', '先用少量样例数据验证模板，再执行整批校验。'],
    deliverables: ['错误列表', '修订后的模板文件'],
  }
})

const importSummary = computed(() => ({
  passed: importResult.value?.recordsImported ?? 0,
  errors: importResult.value?.errors?.length ?? 0,
  mode: hasElectronDb.value ? '主进程校验' : '浏览器校验',
}))

const resultStatus = computed(() => {
  if (!importResult.value) return 'info'
  if (!importResult.value.success) return 'error'
  return importResult.value.errors.length ? 'warning' : 'success'
})

const pageAlerts = computed(() => {
  const items: Array<{ level: 'error' | 'warning' | 'info' | 'success'; message: string; description?: string }> = []

  if (downloadMessage.value) {
    items.push({
      level: downloadMessage.value.includes('失败') ? 'error' : 'success',
      message: downloadMessage.value,
    })
  }

  if (importResult.value?.errors?.length) {
    items.push(
      ...importResult.value.errors.map((error) => ({
        level: importResult.value?.success ? 'warning' as const : 'error' as const,
        message: error,
      })),
    )
  }

  return items
})

const previewRows = computed(() =>
  (importResult.value?.data ?? []).map((item: Record<string, unknown>, index: number) => ({
    index: index + 1,
    ...item,
  })),
)

const previewColumns = computed(() => [
  { title: '序号', dataIndex: 'index', key: 'index', width: 84 },
  ...templateConfig.value.fields.map((field) => ({
    title: field,
    dataIndex: field,
    key: field,
    ellipsis: true,
  })),
])

const templatePreview = computed(() =>
  templateConfig.value.fields.map((field) => ({
    field,
    example: templateConfig.value.example[field as keyof typeof templateConfig.value.example],
    required: templateConfig.value.requiredFields.includes(field),
  })),
)

async function handleImport() {
  if (!hasElectronDb.value) {
    browserFileInput.value?.click()
    return
  }

  const db = getElectronDb()
  if (!db) {
    return
  }

  isImporting.value = true
  try {
    const result = await db.importExcel(templateType.value)
    importResult.value = normalizeImportResult(result)
    emitFeedback(importResult.value)
  } catch (err: any) {
    importResult.value = { success: false, recordsImported: 0, errors: [err.message || '校验失败'], data: [] }
    feedback.error(err.message || '校验失败')
  } finally {
    isImporting.value = false
  }
}

async function handleBrowserFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  isImporting.value = true
  try {
    importResult.value = await parseBrowserFile(file)
    emitFeedback(importResult.value)
  } catch (err: any) {
    importResult.value = { success: false, recordsImported: 0, errors: [err.message || '文件解析失败'], data: [] }
    feedback.error(err.message || '文件解析失败')
  } finally {
    isImporting.value = false
    input.value = ''
  }
}

async function parseBrowserFile(file: File): Promise<ImportResult> {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('0.1 预览版当前仅支持 CSV 校验，请先下载 CSV 模板后再导入。')
  }

  const { rows: rawRows } = parseCSV(await file.text())
  const template = templateConfig.value

  const headerCheck = validateImportData(
    rawRows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, String(value ?? '')]),
      ),
    ),
    template.requiredFields,
  )

  const errors = [...headerCheck.errors]
  const validRows: Record<string, unknown>[] = []

  rawRows.forEach((row, rowIndex) => {
    const normalized: Record<string, unknown> = {}
    const rowErrors: string[] = []

    for (const field of template.fields) {
      const rawValue = row[field]
      const exampleValue = template.example[field as keyof typeof template.example]
      const isRequired = template.requiredFields.includes(field)
      const isEmpty = rawValue === '' || rawValue == null

      if (isRequired && isEmpty) {
        rowErrors.push(`第${rowIndex + 2}行: 字段 ${field} 不能为空`)
        continue
      }

      if (isEmpty) {
        continue
      }

      if (typeof exampleValue === 'number') {
        const numericValue = Number(rawValue)
        if (!Number.isFinite(numericValue)) {
          rowErrors.push(`第${rowIndex + 2}行: 字段 ${field} 必须为数值`)
          continue
        }
        normalized[field] = numericValue
        continue
      }

      normalized[field] = String(rawValue).trim()
    }

    if (rowErrors.length) {
      errors.push(...rowErrors)
      return
    }

    validRows.push(normalized)
  })

  return {
    success: validRows.length > 0,
    recordsImported: validRows.length,
    errors,
    data: validRows,
  }
}

function normalizeImportResult(result: any): ImportResult {
  return {
    success: Boolean(result?.success),
    recordsImported: Number(result?.recordsImported ?? 0),
    errors: Array.isArray(result?.errors) ? result.errors : [],
    data: Array.isArray(result?.data) ? result.data : [],
  }
}

function emitFeedback(result: ImportResult) {
  if (result.success && result.errors.length === 0) {
    feedback.success(`校验完成，${result.recordsImported} 条记录通过`)
    return
  }

  if (result.success) {
    feedback.warning(`部分通过，${result.recordsImported} 条记录可用`)
    return
  }

  feedback.error(result.errors[0] || '校验失败')
}

async function downloadTemplate() {
  if (!hasElectronDb.value) {
    const csv = generateImportTemplate(templateType.value)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `template-${templateType.value}.csv`
    link.click()
    URL.revokeObjectURL(url)
    downloadMessage.value = `已生成 ${templateType.value} CSV 模板，可直接用于浏览器模式校验。`
    feedback.notifyDownloaded(`${templateType.value.toUpperCase()} 模板`)
    return
  }

  const db = getElectronDb()
  if (!db) {
    return
  }

  const success = await db.downloadTemplate(templateType.value, `template-${templateType.value}.csv`)
  downloadMessage.value = success
    ? `已生成 ${templateType.value} CSV 模板，可在当前工作目录中查看。`
    : '模板生成失败，请检查写入权限后重试。'
  if (success) {
    feedback.notifyDownloaded(`${templateType.value.toUpperCase()} 模板`)
  } else {
    feedback.error('模板生成失败')
  }
}
</script>

<template>
  <div class="excel-import-page">
    <PageToolbar title="MechBox" subtitle="结构化数据导入" />

    <div class="content-body">
      <DatabaseRuntimeBanner
        v-if="runtimeNotice"
        mode="fallback"
        :message="runtimeNotice"
        :details="runtimeDetails"
      />

      <AnalysisBrief
        title="CSV 模板校验任务"
        summary="用于把外部 CSV 模板数据转为统一字段结构，并在进入正式入库流程前完成字段、类型和样例记录校验。"
        :metrics="[
          { label: '当前模板', value: templateType.toUpperCase() },
          { label: '校验模式', value: importSummary.mode },
          { label: '执行状态', value: isImporting ? '校验中' : importResult ? (importResult.success ? '已完成' : '失败') : '待执行' }
        ]"
        :inputs="[
          '请先下载当前模板，再按字段规范填充数据，避免列名、单位和字段名不一致。',
          '页面当前支持 CSV 文件校验；当前输出为结构化预览，不直接代表数据库已入库。'
        ]"
        :outputs="[
          '通过校验记录数、错误列表和样例记录预览。',
          '适合在数据库扩库、供应商目录整理或模板交付前做统一入口校验。'
        ]"
        :notes="[
          '当前流程偏结构化校验，不会自动清洗复杂脏数据或推断缺失字段。',
          '模板下载与文件校验应使用同一模板类型，避免字段错配。'
        ]"
      />

      <ToolPageLayout :input-span="8" :output-span="16">
        <template #side>
          <a-card title="导入设置" size="small">
            <a-form layout="vertical">
              <a-form-item label="模板类型">
                <a-radio-group v-model:value="templateType" button-style="solid">
                  <a-radio-button value="bearing">轴承</a-radio-button>
                  <a-radio-button value="bolt">螺栓</a-radio-button>
                  <a-radio-button value="material">材料</a-radio-button>
                </a-radio-group>
              </a-form-item>
            </a-form>
            <div class="section-actions">
              <a-button @click="downloadTemplate">
                <template #icon><DownloadOutlined /></template>下载模板
              </a-button>
              <a-button type="primary" @click="handleImport" :loading="isImporting">
                <template #icon><UploadOutlined /></template>选择文件校验
              </a-button>
            </div>
            <input
              ref="browserFileInput"
              type="file"
              accept=".csv"
              class="hidden-file-input"
              @change="handleBrowserFileChange"
            />
            <div class="section-note">
              当前模板用于结构化校验和样例预览。页面不会把校验通过自动等同为“已入库”。
            </div>
          </a-card>

          <a-card title="模板字段" size="small">
            <a-table
              :columns="[
                { title: '字段', dataIndex: 'field', key: 'field', width: '42%' },
                { title: '必填', dataIndex: 'required', key: 'required', width: '18%' },
                { title: '示例', dataIndex: 'example', key: 'example', width: '40%' }
              ]"
              :data-source="templatePreview"
              :pagination="false"
              size="small"
              row-key="field"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'required'">
                  <a-tag :color="record.required ? 'red' : 'default'">
                    {{ record.required ? '是' : '否' }}
                  </a-tag>
                </template>
              </template>
            </a-table>
          </a-card>

          <a-card title="执行摘要" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="通过记录" :value="importSummary.passed" /></a-col>
              <a-col :span="12"><a-statistic title="错误条数" :value="importSummary.errors" /></a-col>
            </a-row>
          </a-card>

          <AnalysisDecisionPanel
            :conclusion="importDecision.conclusion"
            :status="importDecision.status"
            :risks="importDecision.risks"
            :actions="importDecision.actions"
            :deliverables="importDecision.deliverables"
          />
        </template>

        <template #main>
          <AlertStack :items="pageAlerts" />

          <a-card title="校验结果" size="small">
            <a-result
              v-if="importResult"
              :status="resultStatus"
              :title="
                importResult.success
                  ? importResult.errors.length
                    ? `部分通过：${importResult.recordsImported} 条记录可用`
                    : `校验通过：${importResult.recordsImported} 条记录`
                  : '校验失败'
              "
              :sub-title="
                importResult.success
                  ? '当前结果表示字段和结构通过校验，不代表数据已写入数据库。'
                  : '请根据错误列表修正模板、列名或数值格式。'
              "
            />
            <StateEmpty v-else description="选择模板并执行文件校验后，在这里查看结果" />

            <a-table
              v-if="previewRows.length > 0"
              :columns="previewColumns"
              :data-source="previewRows"
              :pagination="{ pageSize: 8 }"
              size="small"
              row-key="index"
            />
          </a-card>
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.excel-import-page {
  max-width: 1200px;
  margin: 0 auto;
}

.hidden-file-input {
  display: none;
}
</style>
