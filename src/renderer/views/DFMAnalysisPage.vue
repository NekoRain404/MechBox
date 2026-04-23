<script setup lang="ts">
/**
 * DFMAnalysisPage - 面向制造的公差成本分析页面
 * 公差-工艺映射，制造成本预估
 */
import { computed, ref, watch } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import AnalysisBrief from '../components/AnalysisBrief.vue'
import AnalysisDecisionPanel from '../components/AnalysisDecisionPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import { PlusOutlined, BarChartOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { recommendProcess, generateDFMSuggestions, compareToleranceCosts } from '../engine/dfm-cost'

interface ToleranceItem {
  id: string
  name: string
  itGrade: string
}

const toleranceItems = ref<ToleranceItem[]>([
  { id: '1', name: '轴承位外径', itGrade: 'IT6' },
  { id: '2', name: '齿轮配合孔', itGrade: 'IT7' },
  { id: '3', name: '密封面', itGrade: 'IT5' },
  { id: '4', name: '非配合面', itGrade: 'IT11' },
])

const costComparison = ref<any[]>([])
const showComparison = ref(false)
const activeFormulaSection = ref('工艺成本映射')

const itGradeOptions = ['IT01', 'IT0', 'IT1', 'IT2', 'IT3', 'IT4', 'IT5', 'IT6', 'IT7', 'IT8', 'IT9', 'IT10', 'IT11', 'IT12']

const totalCostIndex = computed(() =>
  toleranceItems.value.reduce((sum, item) => {
    const mapping = recommendProcess(item.itGrade)
    return sum + (mapping ? mapping.relativeCost : 0)
  }, 0),
)

const avgCostPerFeature = computed(() =>
  toleranceItems.value.length > 0 ? totalCostIndex.value / toleranceItems.value.length : 0,
)

const dfmWarnings = computed(() => {
  const grades = toleranceItems.value.map((item) => item.itGrade)
  const { warnings } = generateDFMSuggestions(grades)
  return warnings
})

const dfmSuggestions = computed(() => {
  const grades = toleranceItems.value.map((item) => item.itGrade)
  const { suggestions } = generateDFMSuggestions(grades)
  return suggestions
})

const highPrecisionCount = computed(() =>
  toleranceItems.value.filter((item) => ['IT01', 'IT0', 'IT1', 'IT2', 'IT3', 'IT4', 'IT5', 'IT6'].includes(item.itGrade)).length,
)

const dfmMetrics = computed(() => [
  { label: '特征数量', value: String(toleranceItems.value.length) },
  { label: '高成本特征', value: String(highPrecisionCount.value) },
  { label: '总成本指数', value: totalCostIndex.value.toFixed(1) },
])

const comparisonSaving = computed(() =>
  costComparison.value.length > 1 && costComparison.value[0].totalCostIndex > 0
    ? Math.round((1 - costComparison.value[1].totalCostIndex / costComparison.value[0].totalCostIndex) * 100)
    : 0,
)

const dfmDecision = computed(() => {
  const severeWarnings = dfmWarnings.value.length

  return {
    conclusion:
      severeWarnings > 0
        ? `当前方案存在 ${severeWarnings} 项高成本精度风险，建议先复核关键特征是否真的需要维持现等级。`
        : '当前方案未发现明显的过度精密风险，可继续细化关键工艺特征与成本边界。',
    status: (severeWarnings > 0 ? 'warning' : 'success') as 'warning' | 'success',
    risks: [
      `高精度特征数量 ${highPrecisionCount.value}，总成本指数 ${totalCostIndex.value.toFixed(1)}。`,
      showComparison.value && comparisonSaving.value > 0
        ? `优化方案理论上可节省约 ${comparisonSaving.value}% 的相对制造成本。`
        : '尚未生成对比方案节省结果。',
    ],
    actions: [
      '优先放宽非配合面和非定位面的 IT 等级。',
      '对保留高精度等级的特征补充装配功能依据，避免经验性过度收紧。',
    ],
    deliverables: ['特征-工艺-成本映射表', '方案对比截图', 'DFM 警告与优化建议清单'],
  }
})

const alertItems = computed(() => [
  ...dfmWarnings.value.map((warning) => ({
    level: 'warning' as const,
    message: warning,
  })),
  ...dfmSuggestions.value.map((suggestion) => ({
    level: 'info' as const,
    message: suggestion,
  })),
  ...(showComparison.value && comparisonSaving.value > 0
    ? [{
        level: 'success' as const,
        message: `成本优化方案理论节省约 ${comparisonSaving.value}%`,
        description: '当前对比仅反映相对成本指数变化，不代表实际报价。',
      }]
    : []),
])

const formulaSections = [
  {
    title: '工艺成本映射',
    formulas: [
      'CostIndex_total = Σ relativeCost_i',
      'CostIndex_avg = CostIndex_total / N',
      'relativeCost_i = map(IT_grade_i)',
    ],
    variables: [
      'relativeCost_i: 对应 IT 等级映射的相对制造成本指数',
      'N: 特征数量',
    ],
    notes: [
      '当前模型以 IT11 为低基准成本，向高精度等级逐级放大相对成本，仅用于趋势比较。',
    ],
  },
  {
    title: '方案节省估算',
    formulas: [
      'Saving = (1 - CostIndex_opt / CostIndex_base) · 100%',
      'CostIndex_base = Σ relativeCost_current',
      'CostIndex_opt = Σ relativeCost_optimized',
    ],
    variables: [
      'CostIndex_base: 当前方案总成本指数',
      'CostIndex_opt: 优化方案总成本指数',
    ],
    notes: [
      '自动优化方案当前按规则放宽 IT5/IT6/IT7 一档，仅用于早期 DFM 讨论，不应直接替代正式工艺评审。',
    ],
  },
]

function addItem() {
  toleranceItems.value.push({
    id: `${Date.now()}`,
    name: '新特征',
    itGrade: 'IT8',
  })
  showComparison.value = false
}

function removeItem(id: string) {
  toleranceItems.value = toleranceItems.value.filter((item) => item.id !== id)
  showComparison.value = false
}

function runComparison() {
  const scenarios = [
    { name: '当前方案', grades: toleranceItems.value.map((item) => item.itGrade) },
    {
      name: '成本优化方案',
      grades: toleranceItems.value.map((item) => {
        if (item.itGrade === 'IT5') return 'IT6'
        if (item.itGrade === 'IT6') return 'IT7'
        if (item.itGrade === 'IT7') return 'IT8'
        return item.itGrade
      }),
    },
  ]

  costComparison.value = compareToleranceCosts(scenarios)
  showComparison.value = true
}

watch(
  toleranceItems,
  () => {
    showComparison.value = false
  },
  { deep: true },
)
</script>

<template>
  <div class="dfm-analysis-page">
    <PageToolbar title="MechBox" subtitle="DFM 公差成本分析">
      <a-space>
        <a-button size="small" @click="addItem">
          <template #icon><PlusOutlined /></template>添加特征
        </a-button>
        <a-button size="small" type="primary" @click="runComparison">
          <template #icon><BarChartOutlined /></template>方案对比
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <AnalysisBrief
        title="制造性分析任务"
        summary="用于把尺寸精度要求映射为工艺复杂度和相对成本，帮助在方案阶段识别过度精密设计和不必要的制造代价。"
        :metrics="dfmMetrics"
        :inputs="[
          '按特征逐项录入 IT 等级，系统自动映射推荐工艺、表面粗糙度和相对成本指数。',
          '当前模型以 IT11 为低基准成本，向高精度等级逐级放大制造代价。'
        ]"
        :outputs="[
          '单特征工艺建议、粗糙度区间和成本指数。',
          '全局 DFM 警告、优化建议和方案对比。'
        ]"
        :notes="[
          '这里输出的是相对成本趋势，不是报价系统。',
          '如果多个关键特征集中在 IT6 及以上，应优先复核装配需求和测量方案。'
        ]"
      />

      <ToolPageLayout :input-span="14" :output-span="10">
        <template #side>
          <a-card :title="`公差特征列表 (${toleranceItems.length}项)`" size="small">
            <a-table
              :columns="[
                { title: '特征名称', dataIndex: 'name', key: 'name', width: '24%' },
                { title: '公差等级', dataIndex: 'itGrade', key: 'itGrade', width: '16%' },
                { title: '推荐工艺', dataIndex: 'process', key: 'process', width: '22%' },
                { title: '粗糙度', dataIndex: 'surfaceFinish', key: 'surfaceFinish', width: '18%' },
                { title: '相对成本', dataIndex: 'cost', key: 'cost', width: '12%' },
                { title: '操作', key: 'actions', width: '8%' }
              ]"
              :data-source="toleranceItems"
              :pagination="false"
              size="small"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <a-input v-model:value="record.name" size="small" style="width: 100%" />
                </template>
                <template v-else-if="column.key === 'itGrade'">
                  <a-select v-model:value="record.itGrade" size="small" style="width: 100%">
                    <a-select-option v-for="grade in itGradeOptions" :key="grade" :value="grade">
                      {{ grade }}
                    </a-select-option>
                  </a-select>
                </template>
                <template v-else-if="column.key === 'cost'">
                  <a-tag :color="(recommendProcess(record.itGrade)?.relativeCost ?? 0) > 10 ? 'red' : (recommendProcess(record.itGrade)?.relativeCost ?? 0) > 5 ? 'orange' : 'green'">
                    {{ recommendProcess(record.itGrade)?.relativeCost ?? 0 }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'process'">
                  {{ recommendProcess(record.itGrade)?.process ?? '-' }}
                </template>
                <template v-else-if="column.key === 'surfaceFinish'">
                  {{ recommendProcess(record.itGrade)?.surfaceFinish ?? '-' }}
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-button type="link" danger size="small" @click="removeItem(record.id)">
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </template>
              </template>
            </a-table>
          </a-card>
        </template>

        <template #main>
          <a-card title="成本分析汇总" size="small">
            <a-descriptions bordered size="small" :column="1">
              <a-descriptions-item label="特征总数">{{ toleranceItems.length }}</a-descriptions-item>
              <a-descriptions-item label="总成本指数">{{ totalCostIndex.toFixed(1) }}</a-descriptions-item>
              <a-descriptions-item label="平均成本/特征">{{ avgCostPerFeature.toFixed(1) }}</a-descriptions-item>
            </a-descriptions>
          </a-card>

          <AlertStack :items="alertItems" />

          <a-card v-if="showComparison" title="方案对比" size="small">
            <a-table
              :columns="[
                { title: '方案', dataIndex: 'name', key: 'name', width: '30%' },
                { title: '总成本指数', dataIndex: 'totalCostIndex', key: 'totalCostIndex', width: '25%' },
                { title: '平均成本', dataIndex: 'avgCostPerFeature', key: 'avgCostPerFeature', width: '25%' },
                { title: '节省', dataIndex: 'savings', key: 'savings', width: '20%' }
              ]"
              :data-source="costComparison.map((item, index) => ({
                ...item,
                totalCostIndex: Number(item.totalCostIndex).toFixed(1),
                avgCostPerFeature: Number(item.avgCostPerFeature).toFixed(1),
                savings: index === 0 ? '-' : `${Math.round((1 - item.totalCostIndex / costComparison[0].totalCostIndex) * 100)}%`
              }))"
              :pagination="false"
              size="small"
              row-key="name"
            />
          </a-card>

          <AnalysisDecisionPanel
            :conclusion="dfmDecision.conclusion"
            :status="dfmDecision.status"
            :risks="dfmDecision.risks"
            :actions="dfmDecision.actions"
            :deliverables="dfmDecision.deliverables"
          />

          <FormulaPanel v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.dfm-analysis-page {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
