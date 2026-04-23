<script setup lang="ts">
/**
 * ToleranceStackPage.vue - 统计公差分析页面
 * 支持 RSS 和 Monte Carlo 公差分析
 */
import { ref, computed } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import AlertStack from '../components/AlertStack.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import { PlayCircleOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { calcRSS, quickToleranceStack } from '../engine/tolerances/statistical'
import type { ToleranceDimension } from '../engine/tolerances/statistical'

const dimensions = ref<ToleranceDimension[]>([
  { nominal: 50, tolerance_plus: 0.1, tolerance_minus: 0.1, distribution: 'normal', processCapability: 1.33 },
  { nominal: 0.05, tolerance_plus: 0.02, tolerance_minus: 0.02, distribution: 'normal', processCapability: 1.33 },
  { nominal: -50, tolerance_plus: 0.1, tolerance_minus: 0.1, distribution: 'normal', processCapability: 1.33 },
])

const upperSpec = ref(0.05)
const lowerSpec = ref(-0.05)
const result = ref<any>(null)
const isRunning = ref(false)

const quickResult = computed(() => quickToleranceStack(dimensions.value))
const hasInvalidSpec = computed(() => upperSpec.value <= lowerSpec.value)
const formulaSections = [
  {
    title: '极值法与 RSS',
    formulas: [
      'Tworst = Σ max(Ti+, Ti-)',
      'Trss,quick = √ΣTi²',
      'Trss,detail = 3 · √Σ(Ti/3)²',
    ],
    variables: ['Ti: 每个尺寸的单边公差 mm'],
    notes: ['右侧快速对比采用 quick RSS；详细分析页再结合 10000 次抽样。'],
  },
  {
    title: 'Monte Carlo 与能力指数',
    formulas: [
      'Yield = Nin / N · 100%',
      'Cp = (USL - LSL) / (6σ)',
      'Cpk = min((USL - μ)/(3σ), (μ - LSL)/(3σ))',
    ],
    variables: ['USL/LSL: 规格上限与下限', 'μ: 样本均值', 'σ: 样本标准差'],
    notes: ['当前引擎假设各尺寸独立，并按所选分布独立采样。'],
  },
]
const activeFormulaSection = ref(formulaSections[0].title)

const pageAlerts = computed(() => {
  if (!hasInvalidSpec.value) return result.value?.warnings ?? []
  return [
    {
      level: 'error' as const,
      message: '规格限设置无效',
      description: '上限必须大于下限，否则无法计算良品率和能力指数。',
    },
  ]
})

const decisionPanel = computed(() => {
  if (!result.value) {
    return {
      conclusion: `当前尺寸链的快速 RSS 公差为 ±${quickResult.value.rss.toFixed(4)} mm，相比极值法放宽约 ${quickResult.value.savings.toFixed(1)}%。`,
      status: 'info' as const,
      risks: [],
      actions: ['设置规格上下限后运行 Monte Carlo 分析，确认良品率和 Cpk。'],
      boundaries: [
        '快速结果只适合做极值法与 RSS 对比，不包含实际采样良率。',
        '当前模型默认各尺寸彼此独立，不处理相关性和装配补偿。',
      ],
    }
  }

  const status: 'success' | 'info' | 'warning' | 'error' =
    result.value.cpk >= 1.33 && result.value.yieldRate >= 99.73
      ? 'success'
      : result.value.cpk >= 1.0 && result.value.yieldRate >= 97
        ? 'info'
        : result.value.cpk >= 0.8 && result.value.yieldRate >= 95
          ? 'warning'
          : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (result.value.cpk < 1.0) {
    risks.push(`Cpk 仅 ${result.value.cpk.toFixed(2)}，过程中心和波动都不足以稳定满足规格。`)
    actions.push('优先调整尺寸链公差分配，降低主导尺寸的波动贡献。')
  } else if (result.value.cpk < 1.33) {
    risks.push(`Cpk 为 ${result.value.cpk.toFixed(2)}，已接近可制造边界。`)
  }

  if (result.value.yieldRate < 99.73) {
    risks.push(`模拟良品率 ${result.value.yieldRate.toFixed(2)}% 未达到 3σ 水平。`)
    actions.push('复核关键尺寸的分布假设和 Cp 输入，必要时提高工序能力。')
  }

  if (quickResult.value.savings > 40) {
    actions.push('RSS 放宽空间较大，可进一步比较最坏情况设计与统计控制成本。')
  }

  return {
    conclusion: `当前尺寸链 Monte Carlo 良品率为 ${result.value.yieldRate.toFixed(2)}%，Cpk 为 ${result.value.cpk.toFixed(2)}，RSS 相比极值法约放宽 ${quickResult.value.savings.toFixed(1)}%。`,
    status,
    risks,
    actions: actions.length ? actions : ['当前统计结果较稳，可将本方案作为进一步工艺分配的基线。'],
    boundaries: [
      'Monte Carlo 当前固定采样 10000 次，适合方案比较，不替代正式公差分析报告。',
      '模型默认尺寸独立采样，未包含热变形、夹具偏置和工序相关性。',
    ],
  }
})

function runAnalysis() {
  if (hasInvalidSpec.value) {
    result.value = null
    return
  }
  isRunning.value = true
  try {
    result.value = calcRSS(dimensions.value, upperSpec.value, lowerSpec.value)
  } catch (e) {
    console.error('Analysis failed:', e)
    result.value = null
  } finally {
    isRunning.value = false
  }
}

function addDimension() {
  dimensions.value.push({
    nominal: 0,
    tolerance_plus: 0.1,
    tolerance_minus: 0.1,
    distribution: 'normal',
    processCapability: 1.33,
  })
}

function removeDimension(index: number) {
  dimensions.value.splice(index, 1)
  if (result.value) result.value = null
}

function exportResults() {
  if (!result.value) return
  let csv = '参数,值\n'
  csv += `名义尺寸,${result.value.nominal}\n`
  csv += `极值法公差,${result.value.worstCaseTolerance}\n`
  csv += `RSS统计公差,${result.value.rssTolerance}\n`
  csv += `模拟均值,${result.value.simulatedMean}\n`
  csv += `模拟标准差,${result.value.simulatedStdDev}\n`
  csv += `良品率,${result.value.yieldRate}%\n`
  csv += `Cp,${result.value.cp}\n`
  csv += `Cpk,${result.value.cpk}\n`

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tolerance-stack-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="tolerance-stack-page">
    <PageToolbar title="MechBox" subtitle="统计公差分析">
      <a-space>
        <a-button size="small" type="primary" @click="runAnalysis" :loading="isRunning" :disabled="hasInvalidSpec">
          <template #icon><PlayCircleOutlined /></template>运行分析
        </a-button>
        <a-button size="small" @click="exportResults" :disabled="!result">
          <template #icon><DownloadOutlined /></template>导出结果
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <ToolPageLayout>
        <template #side>
          <a-card title="尺寸链定义" size="small">
            <a-table
              :columns="[
                { title: '序号', dataIndex: 'index', key: 'index', width: '8%' },
                { title: '名义尺寸', dataIndex: 'nominal', key: 'nominal', width: '18%' },
                { title: '上偏差', dataIndex: 'tolerance_plus', key: 'tolerance_plus', width: '15%' },
                { title: '下偏差', dataIndex: 'tolerance_minus', key: 'tolerance_minus', width: '15%' },
                { title: '分布类型', dataIndex: 'distribution', key: 'distribution', width: '15%' },
                { title: 'Cp', dataIndex: 'processCapability', key: 'processCapability', width: '12%' },
                { title: '操作', key: 'actions', width: '17%' }
              ]"
              :data-source="dimensions.map((dimension, index) => ({ ...dimension, index: index + 1 }))"
              :pagination="false"
              size="small"
              row-key="index"
            >
              <template #bodyCell="{ column, index }">
                <template v-if="column.key === 'nominal'">
                  <a-input-number v-model:value="dimensions[index].nominal" size="small" style="width: 100%" />
                </template>
                <template v-else-if="column.key === 'tolerance_plus'">
                  <a-input-number v-model:value="dimensions[index].tolerance_plus" size="small" style="width: 100%" :min="0" />
                </template>
                <template v-else-if="column.key === 'tolerance_minus'">
                  <a-input-number v-model:value="dimensions[index].tolerance_minus" size="small" style="width: 100%" :min="0" />
                </template>
                <template v-else-if="column.key === 'distribution'">
                  <a-select v-model:value="dimensions[index].distribution" size="small" style="width: 100%">
                    <a-select-option value="normal">正态分布</a-select-option>
                    <a-select-option value="uniform">均匀分布</a-select-option>
                    <a-select-option value="triangular">三角分布</a-select-option>
                  </a-select>
                </template>
                <template v-else-if="column.key === 'processCapability'">
                  <a-input-number v-model:value="dimensions[index].processCapability" size="small" style="width: 100%" :min="0.5" :max="2" :step="0.01" />
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-button type="link" danger size="small" @click="removeDimension(index)">
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </template>
              </template>
            </a-table>
            <a-button type="dashed" block style="margin-top: 12px" @click="addDimension">
              <template #icon><PlusOutlined /></template>添加尺寸
            </a-button>
          </a-card>

          <a-card title="规格限设置" size="small">
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="上限">
                  <a-input-number v-model:value="upperSpec" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="下限">
                  <a-input-number v-model:value="lowerSpec" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <div class="section-note">
              规格限用于 Monte Carlo 良品率和能力指数计算。当前引擎把每个尺寸视为独立随机变量。
            </div>
          </a-card>
        </template>

        <template #main>
          <a-card title="极值法 vs RSS 对比" size="small">
            <a-descriptions bordered size="small" :column="1">
              <a-descriptions-item label="极值法公差 (Worst-case)">
                <a-tag color="red">±{{ quickResult.worstCase.toFixed(4) }} mm</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="RSS 统计公差">
                <a-tag color="green">±{{ quickResult.rss.toFixed(4) }} mm</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="公差放宽">
                <a-tag color="blue">{{ quickResult.savings.toFixed(1) }}%</a-tag>
              </a-descriptions-item>
            </a-descriptions>
            <div class="section-note">
              RSS 更适合受统计控制的批量制造场景；极值法更适合单件保证或安全冗余要求极高的尺寸链。
            </div>
            <div class="section-actions">
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '极值法与 RSS' }" @click="activeFormulaSection = '极值法与 RSS'">
                查看 RSS 公式
              </button>
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === 'Monte Carlo 与能力指数' }" @click="activeFormulaSection = 'Monte Carlo 与能力指数'">
                查看能力指数
              </button>
            </div>
          </a-card>

          <a-card v-if="result" title="Monte Carlo 分析结果" size="small">
            <a-descriptions bordered size="small" :column="1">
              <a-descriptions-item label="名义总尺寸">{{ result.nominal.toFixed(4) }} mm</a-descriptions-item>
              <a-descriptions-item label="模拟均值">{{ result.simulatedMean.toFixed(4) }} mm</a-descriptions-item>
              <a-descriptions-item label="模拟标准差">{{ result.simulatedStdDev.toFixed(4) }} mm</a-descriptions-item>
              <a-descriptions-item label="良品率">
                <a-tag :color="result.yieldRate >= 99.73 ? 'green' : result.yieldRate >= 95 ? 'orange' : 'red'">
                  {{ result.yieldRate.toFixed(2) }}%
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="Cp">
                <a-tag :color="result.cp >= 1.33 ? 'green' : result.cp >= 1.0 ? 'orange' : 'red'">
                  {{ result.cp.toFixed(2) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="Cpk">
                <a-tag :color="result.cpk >= 1.33 ? 'green' : result.cpk >= 1.0 ? 'orange' : 'red'">
                  {{ result.cpk.toFixed(2) }}
                </a-tag>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <AlertStack :items="pageAlerts" />

          <CalculationDecisionPanel
            title="统计判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />

          <FormulaPanel v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.tolerance-stack-page {
  max-width: 1360px;
  margin: 0 auto;
}
</style>
