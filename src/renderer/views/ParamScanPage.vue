<script setup lang="ts">
/**
 * ParamScanPage.vue - 参数扫描与敏感度分析页面
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import PageToolbar from '../components/PageToolbar.vue'
import AnalysisBrief from '../components/AnalysisBrief.vue'
import AnalysisDecisionPanel from '../components/AnalysisDecisionPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import StateEmpty from '../components/StateEmpty.vue'
import ProjectContextCard from '../components/ProjectContextCard.vue'
import { ScanOutlined, DownloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { bearingLifeScan, sensitivityAnalysis } from '../engine/param-scan'
import { useActiveProject } from '../composables/useActiveProject'
import { useWorkflowRecorder } from '../composables/useWorkflowRecorder'
import { useAppFeedback } from '../composables/useAppFeedback'
import { appendStoredReport, getReportModuleMeta } from '../utils/reporting'

const isRunning = ref(false)
const scanResult = ref<{ matrix: number[][]; loadValues: number[]; speedValues: number[] } | null>(null)
const sensitivityResult = ref<Record<string, Record<string, number>> | null>(null)
const heatmapChartRef = ref<HTMLElement | null>(null)
const sensitivityChartRef = ref<HTMLElement | null>(null)
const activeFormulaSection = ref('扫描模型')
let heatmapInstance: echarts.ECharts | null = null
let sensitivityInstance: echarts.ECharts | null = null
const { activeProject } = useActiveProject()
const { recordModuleCalculation } = useWorkflowRecorder()
const feedback = useAppFeedback()
const reportMeta = getReportModuleMeta('param-scan')

const bearingScan = ref({
  C_r: 14.0,
  loadMin: 1.0,
  loadMax: 10.0,
  loadSteps: 20,
  speedMin: 500,
  speedMax: 5000,
  speedSteps: 20,
})

const handleResize = () => {
  heatmapInstance?.resize()
  sensitivityInstance?.resize()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  heatmapInstance?.dispose()
  sensitivityInstance?.dispose()
})

const hasInvalidLoadRange = computed(() => bearingScan.value.loadMax <= bearingScan.value.loadMin)
const hasInvalidSpeedRange = computed(() => bearingScan.value.speedMax <= bearingScan.value.speedMin)
const hasInvalidGrid = computed(() => bearingScan.value.loadSteps < 2 || bearingScan.value.speedSteps < 2)
const hasInvalidParams = computed(() => hasInvalidLoadRange.value || hasInvalidSpeedRange.value || hasInvalidGrid.value)

const scanMetrics = computed(() => [
  { label: '载荷样本点', value: String(bearingScan.value.loadSteps) },
  { label: '转速样本点', value: String(bearingScan.value.speedSteps) },
  { label: '组合工况数', value: String(bearingScan.value.loadSteps * bearingScan.value.speedSteps) },
])

const scanFindings = computed(() => {
  if (!scanResult.value) return []
  const values = scanResult.value.matrix.flat()
  return [
    { label: '最短寿命', value: `${Math.min(...values).toFixed(0)} h` },
    { label: '最长寿命', value: `${Math.max(...values).toFixed(0)} h` },
  ]
})
const projectMetrics = computed(() => {
  if (!scanResult.value) return []
  const values = scanResult.value.matrix.flat()
  return [
    { label: '最短寿命', value: `${Math.min(...values).toFixed(0)} h` },
    { label: '最长寿命', value: `${Math.max(...values).toFixed(0)} h` },
    { label: '网格规模', value: `${bearingScan.value.loadSteps}×${bearingScan.value.speedSteps}` },
  ]
})

const sensitivityHighlights = computed(() => {
  if (!sensitivityResult.value) return []
  const entries = Object.entries(sensitivityResult.value)
    .map(([key, value]) => ({ key, value: value.L10h ?? 0 }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const top = entries[0]
  return top ? [{ label: '主导参数', value: `${top.key} (${top.value.toFixed(2)})` }] : []
})

const pageAlerts = computed(() => {
  const items: Array<{ level: 'error' | 'warning' | 'info' | 'success'; message: string; description?: string }> = []

  if (hasInvalidLoadRange.value) {
    items.push({
      level: 'error',
      message: '载荷范围设置无效',
      description: '最大载荷必须大于最小载荷，否则无法形成有效扫描面。',
    })
  }

  if (hasInvalidSpeedRange.value) {
    items.push({
      level: 'error',
      message: '转速范围设置无效',
      description: '最大转速必须大于最小转速，否则寿命云图没有工程意义。',
    })
  }

  if (hasInvalidGrid.value) {
    items.push({
      level: 'error',
      message: '扫描步数设置无效',
      description: '每个维度至少需要 2 个点，实际建议使用 10 点以上形成稳定趋势。',
    })
  }

  if (scanResult.value) {
    const values = scanResult.value.matrix.flat()
    const minLife = Math.min(...values)
    items.push({
      level: minLife < 5000 ? 'warning' : 'success',
      message: minLife < 5000 ? '扫描面内存在低寿命危险区' : '当前扫描面整体处于较稳定窗口',
      description: `最短寿命 ${minLife.toFixed(0)} h，扫描网格 ${bearingScan.value.loadSteps * bearingScan.value.speedSteps} 个工况点。`,
    })
  }

  if (sensitivityResult.value) {
    const dominant = Object.entries(sensitivityResult.value)
      .map(([key, value]) => ({ key, value: value.L10h ?? 0 }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]

    if (dominant) {
      items.push({
        level: 'info',
        message: `敏感度排序已形成，当前主导参数为 ${dominant.key}`,
        description: `对应 L10h 敏感系数 ${dominant.value.toFixed(3)}。`,
      })
    }
  }

  return items
})

const scanDecision = computed(() => {
  if (!scanResult.value) {
    return {
      conclusion: '尚未生成扫描结论。',
      status: 'info' as const,
      risks: ['当前没有工况扫描结果，无法识别危险载荷区或高转速区。'],
      actions: ['先执行寿命云图扫描，再根据结果决定是否细化输入边界。'],
      deliverables: ['扫描 CSV 导出', '寿命云图截图', '敏感度排序'],
    }
  }

  const values = scanResult.value.matrix.flat()
  const minLife = Math.min(...values)
  const maxLife = Math.max(...values)
  const dominant = sensitivityResult.value
    ? Object.entries(sensitivityResult.value)
        .map(([key, value]) => ({ key, value: value.L10h ?? 0 }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]
    : null

  return {
    conclusion:
      minLife < 5000
        ? `扫描面内存在寿命低于 5000 h 的危险工况，最长寿命约 ${maxLife.toFixed(0)} h。`
        : `当前扫描范围内寿命均高于 5000 h，设计窗口相对稳定，最长寿命约 ${maxLife.toFixed(0)} h。`,
    status: (minLife < 5000 ? 'warning' : 'success') as 'warning' | 'success',
    risks: [
      `最短寿命 ${minLife.toFixed(0)} h，说明部分工况下存在显著寿命衰减。`,
      dominant ? `敏感参数首位为 ${dominant.key}，后续设计变更应优先控制该参数。` : '尚未生成敏感度排序。',
    ],
    actions: [
      '围绕寿命谷值附近缩小步长做二次扫描，确认边界工况。',
      '把高敏感参数纳入设计审查表，避免后续方案波动放大风险。',
    ],
    deliverables: ['寿命云图 PNG/PDF', '扫描矩阵 CSV', '敏感度排序截图'],
  }
})

const formulaSections = [
  {
    title: '扫描模型',
    formulas: [
      'P = 0.56 · Fr',
      'L10 = (Cr / P)^3',
      'L10h = (10^6 / (60 · n)) · L10',
    ],
    variables: [
      'Fr: 径向载荷 kN',
      'Cr: 额定动载荷 kN',
      'n: 转速 rpm',
    ],
    notes: [
      '当前参数扫描采用简化当量载荷模型，适用于设计窗口筛查，不替代完整轴承选型报告。',
    ],
  },
  {
    title: '敏感度定义',
    formulas: [
      'S = (Δoutput / output) / (Δparam / param)',
      'Δparam = param · perturbation',
      'perturbation = 1%',
    ],
    variables: [
      'S: 相对敏感系数',
      'perturbation: 当前固定为 0.01',
    ],
    notes: [
      '敏感度越大，说明该参数的微小波动越容易放大到目标输出，应优先纳入设计控制。',
    ],
  },
]

function resetResults() {
  scanResult.value = null
  sensitivityResult.value = null
  heatmapInstance?.clear()
  sensitivityInstance?.clear()
}

function runBearingLifeScan() {
  if (hasInvalidParams.value) {
    return
  }

  isRunning.value = true
  scanResult.value = bearingLifeScan(
    { min: bearingScan.value.loadMin, max: bearingScan.value.loadMax, steps: bearingScan.value.loadSteps },
    { min: bearingScan.value.speedMin, max: bearingScan.value.speedMax, steps: bearingScan.value.speedSteps },
    bearingScan.value.C_r,
  )
  isRunning.value = false
  void nextTick(() => renderHeatmap())
}

function runSensitivityAnalysis() {
  if (hasInvalidParams.value) {
    return
  }

  const baseParams = { Fr: 2.0, Fa: 0.5, X: 0.56, Y: 1.5, speed: 1500, C_r: bearingScan.value.C_r }
  sensitivityResult.value = sensitivityAnalysis(
    baseParams,
    ['Fr', 'Fa', 'speed', 'C_r'],
    0.01,
    (params) => {
      const P = params.X * params.Fr + params.Y * params.Fa
      const L10 = Math.pow(params.C_r / P, 3)
      const L10h = (1000000 / (60 * params.speed)) * L10
      return { L10h }
    },
  )
  void nextTick(() => renderSensitivityChart())
}

function renderHeatmap() {
  if (!heatmapChartRef.value || !scanResult.value) return
  if (!heatmapInstance) heatmapInstance = echarts.init(heatmapChartRef.value)

  const result = scanResult.value
  const min = Math.min(...result.matrix.flat())
  const max = Math.max(...result.matrix.flat())
  const data: [number, number, number][] = []

  for (let i = 0; i < result.matrix.length; i++) {
    for (let j = 0; j < result.matrix[i].length; j++) {
      data.push([result.speedValues[j], result.loadValues[i], result.matrix[i][j]])
    }
  }

  heatmapInstance.setOption({
    title: { text: '轴承寿命云图 L10h (小时)', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {
      formatter: (params: any) =>
        `载荷: ${params.value[1].toFixed(1)} kN<br/>转速: ${params.value[0].toFixed(0)} rpm<br/>寿命: ${params.value[2].toFixed(0)} h`,
    },
    grid: { left: 60, right: 80, bottom: 50, top: 50 },
    xAxis: {
      name: '转速 (rpm)',
      type: 'value',
      min: result.speedValues[0],
      max: result.speedValues[result.speedValues.length - 1],
      splitLine: { show: false },
    },
    yAxis: {
      name: '载荷 (kN)',
      type: 'value',
      min: result.loadValues[0],
      max: result.loadValues[result.loadValues.length - 1],
      splitLine: { show: false },
    },
    visualMap: {
      min,
      max,
      calculable: true,
      orient: 'vertical',
      right: 10,
      top: 'center',
      inRange: { color: ['#153b50', '#2b7a78', '#88b04b', '#f2c14e', '#e76f51'] },
    },
    series: [{ type: 'scatter', data, symbolSize: 9, itemStyle: { opacity: 0.92 } }],
  })
}

function renderSensitivityChart() {
  if (!sensitivityChartRef.value || !sensitivityResult.value) return
  if (!sensitivityInstance) sensitivityInstance = echarts.init(sensitivityChartRef.value)

  const params = Object.keys(sensitivityResult.value)
  const values = params.map((param) => sensitivityResult.value?.[param].L10h || 0)

  sensitivityInstance.setOption({
    title: { text: '参数敏感度分析 (L10h)', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { formatter: (param: any) => `${param.name}: ${param.value.toFixed(3)}` },
    grid: { left: 90, right: 40, bottom: 40, top: 50 },
    xAxis: { type: 'value', name: '敏感系数' },
    yAxis: { type: 'category', data: params },
    series: [
      {
        type: 'bar',
        data: values.map((value) => ({
          value,
          itemStyle: {
            color: Math.abs(value) > 2 ? '#cf5c36' : Math.abs(value) > 1 ? '#d99a2b' : '#3b7d3a',
          },
        })),
      },
    ],
  })
}

function exportToCSV() {
  if (!scanResult.value) return

  let csv = '载荷 (kN)\\转速 (rpm),' + scanResult.value.speedValues.map((value) => value.toFixed(0)).join(',') + '\n'
  for (let i = 0; i < scanResult.value.loadValues.length; i++) {
    csv += `${scanResult.value.loadValues[i].toFixed(1)},${scanResult.value.matrix[i].map((value) => value.toFixed(0)).join(',')}\n`
  }

  if (sensitivityResult.value) {
    csv += '\n参数,敏感系数(L10h)\n'
    for (const [key, value] of Object.entries(sensitivityResult.value)) {
      csv += `${key},${(value.L10h ?? 0).toFixed(6)}\n`
    }
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `bearing-life-scan-${Date.now()}.csv`
  anchor.click()
  URL.revokeObjectURL(url)

  appendStoredReport({
    id: `rpt_${Date.now()}`,
    title: '参数扫描结果 CSV',
    module: 'param-scan',
    createdAt: new Date().toISOString(),
    type: 'csv',
    status: 'generated',
    projectNumber: activeProject.value?.id,
    projectId: activeProject.value?.id,
    projectName: activeProject.value?.name,
    standardRef: reportMeta.standardRef,
    author: '系统',
    summary: buildProjectSummary(),
    sourceKind: 'analysis-export',
  })
  feedback.notifyExported('参数扫描 CSV')
}

function buildProjectSummary() {
  if (!scanResult.value) return '参数扫描结果尚未形成。'
  const values = scanResult.value.matrix.flat()
  const dominant = sensitivityResult.value
    ? Object.entries(sensitivityResult.value)
        .map(([key, value]) => ({ key, value: value.L10h ?? 0 }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]
    : null
  return `参数扫描：最短寿命 ${Math.min(...values).toFixed(0)} h，最长寿命 ${Math.max(...values).toFixed(0)} h，扫描网格 ${bearingScan.value.loadSteps}×${bearingScan.value.speedSteps}${dominant ? `，主导参数 ${dominant.key}` : ''}。`
}

async function syncToProject() {
  if (!scanResult.value) {
    feedback.warning('当前结果尚未形成，无法写入项目')
    return
  }
  if (!activeProject.value) {
    feedback.warning('当前没有活动项目，无法写入摘要')
    return
  }

  const values = scanResult.value.matrix.flat()
  await recordModuleCalculation({
    module: 'param-scan',
    name: '参数扫描研究',
    projectSummary: buildProjectSummary(),
    inputData: { ...bearingScan.value },
    contextData: {
      findings: scanFindings.value,
      sensitivity: sensitivityResult.value,
    },
    outputData: {
      scanResult: scanResult.value,
      sensitivityResult: sensitivityResult.value,
    },
    recentData: {
      scan: { ...bearingScan.value },
      findings: scanFindings.value,
      sensitivity: sensitivityResult.value,
    },
    decisionData: scanDecision.value,
    resultKind: 'analysis',
    derivedMetrics: {
      minLife: Math.min(...values),
      maxLife: Math.max(...values),
      dominantParameter: sensitivityHighlights.value[0]?.value ?? '',
    },
  })
  feedback.notifySaved('项目摘要')
}

watch(
  bearingScan,
  () => {
    resetResults()
  },
  { deep: true },
)
</script>

<template>
  <div class="param-scan-page">
    <PageToolbar title="MechBox" subtitle="参数扫描与敏感度分析">
      <a-space>
        <a-button size="small" :disabled="!scanResult" @click="syncToProject">
          <template #icon><SaveOutlined /></template>写入项目
        </a-button>
        <a-button size="small" type="primary" @click="runBearingLifeScan" :loading="isRunning" :disabled="hasInvalidParams">
          <template #icon><ScanOutlined /></template>运行轴承寿命扫描
        </a-button>
        <a-button size="small" type="primary" @click="runSensitivityAnalysis" :disabled="hasInvalidParams">
          运行敏感度分析
        </a-button>
        <a-button size="small" @click="exportToCSV" :disabled="!scanResult">
          <template #icon><DownloadOutlined /></template>导出 CSV
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <AnalysisBrief
        title="参数扫描任务"
        summary="用于识别输入参数变化对目标输出的影响趋势，适合在方案阶段做设计窗口确认、敏感参数排序和极端工况筛查。"
        :metrics="scanMetrics"
        :inputs="[
          '当前页按轴承寿命模型建立二维扫描面，横轴为转速，纵轴为径向载荷。',
          '敏感度分析默认围绕基准工况做 1% 扰动，输出相对敏感系数。'
        ]"
        :outputs="[
          '寿命云图：用于定位危险工况区和保守设计区。',
          '敏感度条形图：用于识别最值得优先控制的输入参数。'
        ]"
        :notes="[
          '当前云图使用简化当量载荷模型，适合前期筛查，不替代完整选型报告。',
          '图表和数据导出共享同一批扫描结果，便于归档。'
        ]"
      />

      <ToolPageLayout :input-span="8" :output-span="16">
        <template #side>
          <a-card title="扫描参数设置" size="small">
            <a-form layout="vertical">
              <a-form-item label="额定动载荷 Cr (kN)">
                <a-input-number v-model:value="bearingScan.C_r" style="width: 100%" :min="1" :max="100" />
              </a-form-item>
              <a-divider>载荷范围 (kN)</a-divider>
              <a-row :gutter="8">
                <a-col :span="12">
                  <a-form-item label="最小值">
                    <a-input-number v-model:value="bearingScan.loadMin" style="width: 100%" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="最大值">
                    <a-input-number v-model:value="bearingScan.loadMax" style="width: 100%" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="24">
                  <a-form-item label="步数">
                    <a-input-number v-model:value="bearingScan.loadSteps" style="width: 100%" :min="2" :max="60" />
                  </a-form-item>
                </a-col>
              </a-row>
              <a-divider>转速范围 (rpm)</a-divider>
              <a-row :gutter="8">
                <a-col :span="12">
                  <a-form-item label="最小值">
                    <a-input-number v-model:value="bearingScan.speedMin" style="width: 100%" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="最大值">
                    <a-input-number v-model:value="bearingScan.speedMax" style="width: 100%" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="24">
                  <a-form-item label="步数">
                    <a-input-number v-model:value="bearingScan.speedSteps" style="width: 100%" :min="2" :max="60" />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
            <div class="section-note">
              建议先用 15×15 到 25×25 的扫描网格形成趋势，再围绕危险区做二次收敛。
            </div>
          </a-card>

          <ProjectContextCard
            :active-project="activeProject"
            current-module="param-scan"
            current-module-label="参数扫描研究"
            :metrics="projectMetrics"
            note="写入项目会保留当前设计窗口和敏感参数摘要，导出 CSV 时会同步登记到报告中心。"
          />
        </template>

        <template #main>
          <AlertStack :items="pageAlerts" />

          <a-row :gutter="12" v-if="scanResult || sensitivityResult" style="margin-bottom: 12px">
            <a-col v-for="item in [...scanFindings, ...sensitivityHighlights]" :key="item.label" :span="8">
              <a-card size="small">
                <div class="analysis-kpi-label">{{ item.label }}</div>
                <div class="analysis-kpi-value">{{ item.value }}</div>
              </a-card>
            </a-col>
          </a-row>

          <a-card title="寿命云图" size="small">
            <template #extra>
              <span class="analysis-note">输出量: L10h / 小时</span>
            </template>
            <div ref="heatmapChartRef" class="chart-block"></div>
            <StateEmpty v-if="!scanResult" description="请先执行寿命扫描任务" />
          </a-card>

          <a-card title="敏感度分析" size="small">
            <template #extra>
              <span class="analysis-note">相对敏感系数</span>
            </template>
            <div ref="sensitivityChartRef" class="chart-block chart-block--short"></div>
            <StateEmpty v-if="!sensitivityResult" description="请执行敏感度分析后查看排序结果" />
          </a-card>

          <AnalysisDecisionPanel
            :conclusion="scanDecision.conclusion"
            :status="scanDecision.status"
            :risks="scanDecision.risks"
            :actions="scanDecision.actions"
            :deliverables="scanDecision.deliverables"
          />

          <FormulaPanel v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.param-scan-page {
  max-width: 1400px;
  margin: 0 auto;
}

.analysis-kpi-label {
  font-size: 11px;
  color: #64748b;
}

.analysis-kpi-value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  color: #0f172a;
}

.analysis-note {
  font-size: 11px;
  color: #64748b;
}

.chart-block {
  width: 100%;
  height: 450px;
}

.chart-block--short {
  height: 300px;
}
</style>
