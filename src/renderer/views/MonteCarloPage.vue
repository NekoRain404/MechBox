<script setup lang="ts">
/**
 * MonteCarloPage.vue - 蒙特卡洛概率模拟页面
 * Web Worker 并行计算 (Section 1.3.2)
 */
import { ref, computed, onUnmounted, watch } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import AnalysisBrief from '../components/AnalysisBrief.vue'
import AnalysisDecisionPanel from '../components/AnalysisDecisionPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import ProjectContextCard from '../components/ProjectContextCard.vue'
import { PlayCircleOutlined, DownloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { useActiveProject } from '../composables/useActiveProject'
import { useWorkflowRecorder } from '../composables/useWorkflowRecorder'
import { useAppFeedback } from '../composables/useAppFeedback'
import { appendStoredReport, getReportModuleMeta } from '../utils/reporting'

const simType = ref<'bearing-life' | 'tolerance-stackup'>('bearing-life')
const isRunning = ref(false)
const simResult = ref<any>(null)
const progress = ref(0)
const errorMsg = ref('')
let worker: Worker | null = null
const { activeProject } = useActiveProject()
const { recordModuleCalculation } = useWorkflowRecorder()
const feedback = useAppFeedback()
const reportMeta = getReportModuleMeta('monte-carlo')

const bearingParams = ref({ nominalLoad: 2.0, loadStdDev: 0.3, nominalSpeed: 1500, speedStdDev: 100, C_r: 14.0, minLifeHours: 10000, numSamples: 100000 })
const toleranceStackParams = ref({
  dimensions: [
    { nominal: 50, tolerance: 0.1, name: '轴径' },
    { nominal: 0.05, tolerance: 0.02, name: '轴承间隙' },
    { nominal: -50, tolerance: 0.1, name: '孔径' },
  ],
  lowerSpec: -0.05,
  upperSpec: 0.05,
  numSamples: 100000,
})

const simMetrics = computed(() => [
  { label: '模拟对象', value: simType.value === 'bearing-life' ? '轴承寿命' : '公差堆叠' },
  { label: '样本规模', value: simType.value === 'bearing-life' ? `${bearingParams.value.numSamples}` : `${toleranceStackParams.value.numSamples}` },
  { label: '执行状态', value: isRunning.value ? '运行中' : simResult.value ? '已完成' : '待执行' },
])
const projectMetrics = computed(() => {
  if (!simResult.value) return []
  return [
    { label: '良品率', value: `${simResult.value.yield.toFixed(2)}%` },
    { label: '95th 分位', value: simResult.value.p95.toFixed(2) },
    { label: '有效样本', value: String(simResult.value.validSamples ?? 0) },
  ]
})

const conclusionText = computed(() => {
  if (!simResult.value) return '尚未执行模拟'
  if (simResult.value.yield >= 99) return '结果稳定，可作为设计窗口确认依据'
  if (simResult.value.yield >= 95) return '结果可接受，但仍建议优化关键波动源'
  return '良率偏低，建议回到输入分布或设计公差重新分配'
})

const simulationDecision = computed(() => {
  if (!simResult.value) {
    return {
      conclusion: '尚未形成概率结论',
      status: 'info' as const,
      risks: ['没有模拟结果时，无法判断尾部风险和合格率。'],
      actions: ['执行模拟后再根据良率、标准差和百分位数判定是否需要改设计。'],
      deliverables: ['概率直方图', '统计结果 CSV'],
    }
  }

  const yieldRate = simResult.value.yield
  const status = yieldRate >= 99 ? 'success' : yieldRate >= 95 ? 'warning' : 'error'

  return {
    conclusion: `模拟良率 ${yieldRate.toFixed(2)}%，${conclusionText.value}。`,
    status: status as 'success' | 'warning' | 'error',
    risks: [
      `95th 百分位 ${simResult.value.p95.toFixed(2)}，99th 百分位 ${simResult.value.p99.toFixed(2)}，需要关注尾部风险。`,
      simResult.value.validSamples < (simType.value === 'bearing-life' ? bearingParams.value.numSamples : toleranceStackParams.value.numSamples)
        ? '存在无效样本，说明部分输入组合已超出模型可计算边界。'
        : '当前样本均有效，结果可用于方案比较。',
    ],
    actions: [
      '优先降低最主要波动源的标准差，再观察良率提升幅度。',
      '对临界工况补充确定性计算，避免只依赖随机抽样结果。',
    ],
    deliverables: [
      '直方图导出',
      '统计摘要 CSV',
      '良率与百分位数截图',
    ],
  }
})

const hasInvalidToleranceSpec = computed(
  () => simType.value === 'tolerance-stackup' && toleranceStackParams.value.lowerSpec >= toleranceStackParams.value.upperSpec,
)

const pageAlerts = computed(() => {
  const items: Array<{ level: 'error' | 'warning' | 'info' | 'success'; message: string; description?: string }> = []

  if (hasInvalidToleranceSpec.value) {
    items.push({
      level: 'error',
      message: '公差堆叠规格限设置无效',
      description: '上规格限必须大于下规格限，否则无法形成有效良率统计。',
    })
  }

  if (errorMsg.value) {
    items.push({
      level: simResult.value?.validSamples === 0 ? 'error' : 'warning',
      message: errorMsg.value,
    })
  }

  if (simResult.value) {
    items.push({
      level: simResult.value.yield >= 99 ? 'success' : simResult.value.yield >= 95 ? 'info' : 'warning',
      message:
        simResult.value.yield >= 99
          ? '当前良品率处于较高水平，结果可作为方案对比基线。'
          : simResult.value.yield >= 95
            ? '当前良品率可接受，但仍需复核尾部风险与主导波动源。'
            : '当前良品率偏低，建议先回到规格限或输入分布做重新分配。',
      description:
        simType.value === 'bearing-life'
          ? `最低寿命门槛 ${bearingParams.value.minLifeHours} h，当前有效样本 ${simResult.value.validSamples}。`
          : `规格限区间 [${toleranceStackParams.value.lowerSpec}, ${toleranceStackParams.value.upperSpec}]，当前有效样本 ${simResult.value.validSamples}。`,
    })
  }

  return items
})

const histogramData = computed(() => {
  if (!simResult.value?.histogram || simResult.value.histogram.length === 0) return null
  const counts = simResult.value.histogram.map((h: any) => h.count)
  const maxCount = Math.max(...counts)
  if (maxCount === 0) return null
  return simResult.value.histogram.map((h: any) => ({ ...h, height: (h.count / maxCount) * 100 }))
})

const formulaSections = computed(() => {
  if (simType.value === 'bearing-life') {
    return [
      {
        title: '轴承寿命模型',
        formulas: [
          'P = X · Fr + Y · Fa',
          'L10 = (Cr / P)^p',
          'L10h = (10^6 / (60 · n)) · L10',
        ],
        variables: [
          'Fr/Fa: 径向/轴向载荷 kN',
          'X/Y: 载荷系数 (示例值，需按轴承与工况取值)',
          'Cr: 额定动载荷 kN',
          'p: 寿命指数 (球轴承=3, 滚子轴承=10/3)',
          'n: 转速 rpm',
        ],
        notes: [
          '本页用分布抽样形成概率输出，适合做尾部风险与良率判断，不替代完整标准选型报告。',
        ],
      },
      {
        title: '统计量与良率',
        formulas: [
          'μ = (1/N) · Σ xi',
          'σ = √( (1/(N-1)) · Σ (xi - μ)^2 )',
          'Yield = (N_in_spec / N_valid) · 100%',
          'p95/p99: 输出分布的 95% / 99% 分位数',
        ],
        variables: [
          'N_valid: 有效样本数 (剔除越界/不可计算组合)',
          'N_in_spec: 落在规格限内的样本数',
        ],
        notes: [
          '当有效样本明显少于设定样本数，说明输入分布已进入模型不可计算边界，应先收敛边界或修正分布假设。',
        ],
      },
    ]
  }

  return [
    {
      title: '公差堆叠假设',
      formulas: [
        'xi ~ Normal(μi, σi)',
        'σi ≈ T_i / 3 (默认把 ±T 视为 3σ)',
        'y = Σ xi',
      ],
      variables: [
        'μi: 名义尺寸',
        'T_i: 公差半宽 (±T)',
        'σi: 标准差 (简化假设)',
      ],
      notes: [
        '这里采用简化正态假设用于前期风险评估；若零件分布为偏态或截断分布，良率与尾部会产生偏差。',
      ],
    },
    {
      title: '规格限与良率',
      formulas: [
        'Yield = (N_in_spec / N_valid) · 100%',
        'Spec = [LSL, USL]',
        'p95/p99: 总尺寸偏差的分位数',
      ],
      variables: [
        'LSL/USL: 下/上规格限',
      ],
      notes: [
        '当目标是装配间隙或干涉量时，规格限应与功能要求一致，避免用默认范围替代真实需求。',
      ],
    },
  ]
})
const activeFormulaSection = ref('轴承寿命模型')

function createWorker(): Worker {
  return new Worker(
    new URL('../workers/monte-carlo.ts', import.meta.url),
    { type: 'module' }
  )
}

function runSimulation() {
  if (hasInvalidToleranceSpec.value) {
    errorMsg.value = '规格限无效，请先修正上下规格限。'
    simResult.value = null
    return
  }

  isRunning.value = true
  progress.value = 0
  errorMsg.value = ''
  simResult.value = null

  // Kill previous worker
  worker?.terminate()

  worker = createWorker()

  worker.onmessage = function(e: MessageEvent) {
    const data = e.data
    if (data.done) {
      if (data.error) {
        errorMsg.value = data.error
        simResult.value = {
          mean: 0, stdDev: 0, min: 0, max: 0, p5: 0, p95: 0, p99: 0,
          yield: 0, histogram: [], validSamples: 0
        }
      } else {
        simResult.value = data
        if (data.skipped > 0) {
          errorMsg.value = `注意: 跳过了 ${data.skipped} 次无效计算（参数超限）`
        }
      }
      isRunning.value = false
      progress.value = 100
      worker?.terminate()
    } else if (data.progress !== undefined) {
      progress.value = data.progress
    }
  }

  worker.onerror = function(e: ErrorEvent) {
    errorMsg.value = `Worker 错误: ${e.message || '未知错误'}`
    isRunning.value = false
    worker?.terminate()
  }

  if (simType.value === 'bearing-life') {
    worker.postMessage({
      computeType: 'bearing',
      inputDistributions: {
        Fr: { mean: bearingParams.value.nominalLoad, stdDev: bearingParams.value.loadStdDev },
        speed: { mean: bearingParams.value.nominalSpeed, stdDev: bearingParams.value.speedStdDev },
        C_r: { mean: bearingParams.value.C_r, stdDev: 0.001 }
      },
      numSamples: bearingParams.value.numSamples,
      specLimits: { lower: bearingParams.value.minLifeHours, upper: Infinity }
    })
  } else {
    const dims = toleranceStackParams.value.dimensions
    const id: Record<string, any> = {}
    dims.forEach((d, i) => {
      id[`dim${i}`] = { mean: d.nominal, stdDev: Math.max(d.tolerance / 3, 0.0001) }
    })
    worker.postMessage({
      computeType: 'stackup',
      inputDistributions: id,
      numSamples: toleranceStackParams.value.numSamples,
      specLimits: { lower: toleranceStackParams.value.lowerSpec, upper: toleranceStackParams.value.upperSpec }
    })
  }
}

function exportResults() {
  if (!simResult.value) return
  let csv = 'Bin,Count\n'
  simResult.value.histogram.forEach((h: any) => csv += `${h.bin.toFixed(4)},${h.count}\n`)
  csv += `\nMean,${simResult.value.mean}\nStdDev,${simResult.value.stdDev}\nYield,${simResult.value.yield}\nValidSamples,${simResult.value.validSamples}\n`
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `monte-carlo-${simType.value}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)

  appendStoredReport({
    id: `rpt_${Date.now()}`,
    title: `蒙特卡洛 ${simType.value === 'bearing-life' ? '轴承寿命' : '公差堆叠'}结果 CSV`,
    module: 'monte-carlo',
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
  feedback.notifyExported('蒙特卡洛结果')
}

function buildProjectSummary() {
  if (!simResult.value) return '蒙特卡洛结果尚未形成。'
  return `${simType.value === 'bearing-life' ? '轴承寿命概率' : '公差堆叠概率'}：良品率 ${simResult.value.yield.toFixed(2)}%，均值 ${simResult.value.mean.toFixed(2)}，95th 百分位 ${simResult.value.p95.toFixed(2)}，有效样本 ${simResult.value.validSamples ?? 0}。`
}

async function syncToProject() {
  if (!simResult.value) {
    feedback.warning('当前结果尚未形成，无法写入项目')
    return
  }
  if (!activeProject.value) {
    feedback.warning('当前没有活动项目，无法写入摘要')
    return
  }

  await recordModuleCalculation({
    module: 'monte-carlo',
    name: simType.value === 'bearing-life' ? '蒙特卡洛 轴承寿命' : '蒙特卡洛 公差堆叠',
    projectSummary: buildProjectSummary(),
    inputData:
      simType.value === 'bearing-life'
        ? { simType: simType.value, bearingParams: { ...bearingParams.value } }
        : { simType: simType.value, toleranceParams: JSON.parse(JSON.stringify(toleranceStackParams.value)) },
    contextData: {
      progress: progress.value,
      alerts: pageAlerts.value,
      errorMsg: errorMsg.value,
    },
    outputData: simResult.value,
    recentData: {
      simType: simType.value,
      result: simResult.value,
      bearingParams: simType.value === 'bearing-life' ? { ...bearingParams.value } : undefined,
      toleranceParams: simType.value === 'tolerance-stackup' ? JSON.parse(JSON.stringify(toleranceStackParams.value)) : undefined,
    },
    decisionData: simulationDecision.value,
    resultKind: 'analysis',
    derivedMetrics: {
      yield: simResult.value.yield,
      p95: simResult.value.p95,
      p99: simResult.value.p99,
      validSamples: simResult.value.validSamples ?? 0,
    },
  })
  feedback.notifySaved('项目摘要')
}

function resetSimulation() {
  simResult.value = null
  errorMsg.value = ''
  progress.value = 0
  worker?.terminate()
  worker = null
}

watch(simType, () => {
  resetSimulation()
})

onUnmounted(() => worker?.terminate())
</script>

<template>
  <div class="monte-carlo-page">
    <PageToolbar title="MechBox" subtitle="蒙特卡洛概率模拟">
      <a-space>
        <a-button size="small" :disabled="!simResult" @click="syncToProject">
          <template #icon><SaveOutlined /></template>写入项目
        </a-button>
        <a-button size="small" type="primary" @click="runSimulation" :loading="isRunning">
          <template #icon><PlayCircleOutlined /></template>运行模拟
        </a-button>
        <a-button size="small" @click="exportResults" :disabled="!simResult">
          <template #icon><DownloadOutlined /></template>导出结果
        </a-button>
        <a-button size="small" @click="resetSimulation">重置</a-button>
      </a-space>
    </PageToolbar>
    <div class="content-body">
      <AnalysisBrief
        title="概率模拟任务"
        summary="用于评估输入离散性对寿命、尺寸链或合格率的影响，适合替代单点计算形成更正式的风险判断。"
        :metrics="simMetrics"
        :inputs="[
          '轴承寿命模式：按载荷与转速分布抽样，评估寿命概率分布。',
          '公差堆叠模式：按各尺寸分布抽样，评估总尺寸偏差与合格率。'
        ]"
        :outputs="[
          '统计量：均值、标准差、极值、百分位数。',
          '概率分布直方图：用于观察偏态、离散性和失效尾部。'
        ]"
        :notes="[
          '当前计算通过 Web Worker 异步执行，避免阻塞主界面。',
          '当有效样本不足或参数越界时，系统会明确提示跳过样本数。'
        ]"
      />
      <ToolPageLayout :input-span="10" :output-span="14">
        <template #side>
          <a-card title="模拟参数" size="small">
            <a-form layout="vertical">
              <a-form-item label="模拟类型">
                <a-select v-model:value="simType">
                  <a-select-option value="bearing-life">轴承寿命概率</a-select-option>
                  <a-select-option value="tolerance-stackup">公差堆叠分析</a-select-option>
                </a-select>
              </a-form-item>
              <template v-if="simType === 'bearing-life'">
                <a-divider>载荷分布 (kN)</a-divider>
                <a-row :gutter="8">
                  <a-col :span="12"><a-form-item label="均值"><a-input-number v-model:value="bearingParams.nominalLoad" style="width:100%" :min="0"/></a-form-item></a-col>
                  <a-col :span="12"><a-form-item label="标准差"><a-input-number v-model:value="bearingParams.loadStdDev" style="width:100%" :min="0"/></a-form-item></a-col>
                </a-row>
                <a-divider>转速分布 (rpm)</a-divider>
                <a-row :gutter="8">
                  <a-col :span="12"><a-form-item label="均值"><a-input-number v-model:value="bearingParams.nominalSpeed" style="width:100%" :min="0"/></a-form-item></a-col>
                  <a-col :span="12"><a-form-item label="标准差"><a-input-number v-model:value="bearingParams.speedStdDev" style="width:100%" :min="0"/></a-form-item></a-col>
                </a-row>
                <a-form-item label="额定动载荷 Cr (kN)"><a-input-number v-model:value="bearingParams.C_r" style="width:100%" :min="0"/></a-form-item>
                <a-form-item label="最低寿命要求 (h)"><a-input-number v-model:value="bearingParams.minLifeHours" style="width:100%" :min="0"/></a-form-item>
                <a-form-item label="模拟次数">
                  <a-select v-model:value="bearingParams.numSamples">
                    <a-select-option :value="10000">1万 (快速)</a-select-option>
                    <a-select-option :value="100000">10万 (标准)</a-select-option>
                    <a-select-option :value="1000000">100万 (高精度)</a-select-option>
                  </a-select>
                </a-form-item>
              </template>
              <template v-else>
                <a-divider>尺寸链</a-divider>
                <div v-for="(dim, i) in toleranceStackParams.dimensions" :key="i" style="margin-bottom: 8px">
                  <a-row :gutter="8">
                    <a-col :span="8"><a-input v-model:value="dim.name" size="small" placeholder="名称"/></a-col>
                    <a-col :span="8"><a-input-number v-model:value="dim.nominal" size="small" style="width:100%" placeholder="名义尺寸"/></a-col>
                    <a-col :span="8"><a-input-number v-model:value="dim.tolerance" size="small" style="width:100%" placeholder="公差±"/></a-col>
                  </a-row>
                </div>
                <a-row :gutter="8" style="margin-bottom: 12px">
                  <a-col :span="12">
                    <a-form-item label="下规格限">
                      <a-input-number v-model:value="toleranceStackParams.lowerSpec" style="width:100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="上规格限">
                      <a-input-number v-model:value="toleranceStackParams.upperSpec" style="width:100%" />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-button size="small" type="dashed" block @click="toleranceStackParams.dimensions.push({ nominal: 0, tolerance: 0.1, name: '新尺寸' })">添加尺寸</a-button>
              </template>
            </a-form>
          </a-card>

          <ProjectContextCard
            :active-project="activeProject"
            current-module="monte-carlo"
            current-module-label="蒙特卡洛概率模拟"
            :metrics="projectMetrics"
            note="写入项目会同步保留当前良率、百分位数和样本规模摘要，导出结果时会登记到报告中心。"
          />
        </template>

        <template #main>
          <AlertStack :items="pageAlerts" />
          <a-progress v-if="isRunning" :percent="Math.round(progress)" status="active" style="margin-bottom: 12px"/>
          <a-empty v-if="!simResult" description="请设置参数后点击运行"/>
          <div v-else>
            <a-card title="统计结果" size="small">
              <template #extra>
                <span class="analysis-note">{{ conclusionText }}</span>
              </template>
              <a-descriptions bordered size="small" :column="2">
                <a-descriptions-item label="有效样本">{{ simResult.validSamples ?? '—' }}</a-descriptions-item>
                <a-descriptions-item label="均值">{{ simResult.mean.toFixed(2) }}</a-descriptions-item>
                <a-descriptions-item label="标准差">{{ simResult.stdDev.toFixed(4) }}</a-descriptions-item>
                <a-descriptions-item label="最小值">{{ simResult.min.toFixed(2) }}</a-descriptions-item>
                <a-descriptions-item label="最大值">{{ simResult.max.toFixed(2) }}</a-descriptions-item>
                <a-descriptions-item label="5th 百分位">{{ simResult.p5.toFixed(2) }}</a-descriptions-item>
                <a-descriptions-item label="95th 百分位">{{ simResult.p95.toFixed(2) }}</a-descriptions-item>
                <a-descriptions-item label="99th 百分位">{{ simResult.p99.toFixed(2) }}</a-descriptions-item>
                <a-descriptions-item label="良品率">
                  <a-tag :color="simResult.yield >= 99 ? 'green' : simResult.yield >= 95 ? 'orange' : 'red'">
                    {{ simResult.yield.toFixed(2) }}%
                  </a-tag>
                </a-descriptions-item>
              </a-descriptions>
            </a-card>
            <a-card title="概率分布直方图" size="small" style="margin-top: 16px">
              <div class="histogram-container">
                <div class="histogram-bars" v-if="histogramData">
                  <div v-for="(bar, i) in histogramData" :key="i" class="histogram-bar-wrapper">
                    <div class="histogram-bar"
                      :style="{ height: bar.height + '%', backgroundColor: bar.bin < (simType === 'bearing-life' ? bearingParams.minLifeHours : toleranceStackParams.lowerSpec) ? '#ffa39e' : '#80cbc4' }"
                      :title="'Bin: ' + bar.bin.toFixed(4) + '\nCount: ' + bar.count">
                    </div>
                  </div>
                </div>
                <a-empty v-else description="数据不足"/>
                <div class="histogram-label">输出值分布</div>
              </div>
            </a-card>
          </div>
          <AnalysisDecisionPanel
            :conclusion="simulationDecision.conclusion"
            :status="simulationDecision.status"
            :risks="simulationDecision.risks"
            :actions="simulationDecision.actions"
            :deliverables="simulationDecision.deliverables"
          />
          <FormulaPanel v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.histogram-container { height: 200px; display: flex; flex-direction: column }
.histogram-bars { flex: 1; display: flex; align-items: flex-end; gap: 1px; padding: 0 10px }
.histogram-bar-wrapper { flex: 1; height: 100%; display: flex; align-items: flex-end }
.histogram-bar { width: 100%; transition: height 0.1s }
.histogram-label { text-align: center; font-size: 12px; color: var(--text-tertiary); margin-top: 8px }
.analysis-note { font-size: 11px; color: var(--text-tertiary) }
</style>
