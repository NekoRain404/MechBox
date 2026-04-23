<script setup lang="ts">
/**
 * FailureDiagnosisPage - 失效诊断专家系统页面
 * 基于专家规则树的故障诊断向导
 */
import { computed, ref } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import AnalysisBrief from '../components/AnalysisBrief.vue'
import AnalysisDecisionPanel from '../components/AnalysisDecisionPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import StateEmpty from '../components/StateEmpty.vue'
import { MedicineBoxOutlined } from '@ant-design/icons-vue'
import {
  getAllSymptoms,
  getAllCategories,
  diagnoseBySymptom,
  type DiagnosisResult,
} from '../engine/failure-diagnosis'

const selectedCategory = ref('')
const selectedSymptom = ref('')
const diagnosisResult = ref<DiagnosisResult | null>(null)
const activeFormulaSection = ref('规则匹配')

const categories = computed(() => {
  const all = getAllCategories()
  return [{ value: '', label: '全部类别' }, ...all.map((category) => ({ value: category, label: getCategoryLabel(category) }))]
})

const symptoms = computed(() =>
  getAllSymptoms(selectedCategory.value || undefined).map((symptom) => ({ value: symptom, label: symptom })),
)

const diagnosisMetrics = computed(() => [
  { label: '可选类别', value: String(categories.value.length - 1) },
  { label: '可选症状', value: String(symptoms.value.length) },
  { label: '当前诊断链', value: diagnosisResult.value ? String(diagnosisResult.value.causes.length) : '0' },
])

const diagnosisDecision = computed(() => {
  if (!diagnosisResult.value) {
    return {
      conclusion: '尚未形成诊断结论。',
      status: 'info' as const,
      risks: ['如果没有明确症状输入，诊断链无法建立。'],
      actions: ['先选择最接近现场现象的症状，再按概率从高到低排查。'],
      deliverables: ['原因列表', '建议措施清单'],
    }
  }

  const topCause = diagnosisResult.value.causes[0]
  const highCount = diagnosisResult.value.causes.filter((cause) => cause.probability === 'high').length

  return {
    conclusion: `当前首要排查项为“${topCause.cause}”，本次诊断链包含 ${diagnosisResult.value.causes.length} 个可能原因。`,
    status: (topCause.probability === 'high' ? 'warning' : 'info') as 'warning' | 'info',
    risks: [
      `高概率原因数量 ${highCount}，建议不要跳过首位高概率项直接处理低概率项。`,
      diagnosisResult.value.causes.some((cause) => !cause.relatedCalculation)
        ? '部分原因缺少直接计算入口，仍需现场测量、拆检或寿命试验支撑。'
        : '本次诊断链可部分回到已有计算模块复核。',
    ],
    actions: ['优先执行首个高概率原因对应的检查动作。', '若首轮排查未命中，再按中概率项逐步缩小范围。'],
    deliverables: ['诊断原因排序', '建议措施清单', '相关计算模块入口标签'],
  }
})

const diagnosisAlerts = computed(() => {
  if (!diagnosisResult.value) return []

  const items: Array<{ level: 'warning' | 'info'; message: string; description?: string }> = [
    {
      level: 'info',
      message: `当前症状“${diagnosisResult.value.selectedSymptom}”已命中规则链。`,
      description: '以下结果基于专家规则树和经验症状映射，适合作为排查起点，不替代拆检与实测证据。',
    },
  ]

  if (diagnosisResult.value.causes.some((cause) => !cause.relatedCalculation)) {
    items.push({
      level: 'warning',
      message: '当前诊断链包含无直接计算入口的原因。',
      description: '这类原因需要结合现场拆检、磨损观察、表面状态或介质信息做进一步判断。',
    })
  }

  return items
})

const formulaSections = [
  {
    title: '规则匹配',
    formulas: [
      'Rule = find(allRules, symptom = selectedSymptom)',
      'CauseChain = possibleCauses(Rule)',
      'CategoryFilter = allRules where category = selectedCategory',
    ],
    variables: [
      'selectedSymptom: 用户选择的失效现象',
      'selectedCategory: 当前限定的零件类别',
    ],
    notes: [
      '当前引擎按症状精确匹配规则，并返回预定义的原因链，不执行机器学习推断。',
    ],
  },
  {
    title: '排查优先级',
    formulas: [
      'Priority: high > medium > low',
      'ReviewOrder = authored order in possibleCauses',
      'Verification = diagnosis + inspection + measurement',
    ],
    variables: [
      'high/medium/low: 经验概率标签',
      'ReviewOrder: 规则表内预设的排查顺序',
    ],
    notes: [
      '概率标签用于指导排查顺序，不代表统计失效率；正式结论仍需回到拆检、测量和相关计算模块。',
    ],
  },
]

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    seal: '密封圈',
    bearing: '轴承',
    gear: '齿轮',
    bolt: '螺栓',
    general: '通用',
  }
  return labels[category] || category
}

function getProbabilityColor(probability: string): string {
  switch (probability) {
    case 'high':
      return '#ef4444'
    case 'medium':
      return '#f59e0b'
    case 'low':
      return '#22c55e'
    default:
      return '#8c8c8c'
  }
}

function getProbabilityLabel(probability: string): string {
  switch (probability) {
    case 'high':
      return '高概率'
    case 'medium':
      return '中概率'
    case 'low':
      return '低概率'
    default:
      return probability
  }
}

function runDiagnosis() {
  if (!selectedSymptom.value) {
    diagnosisResult.value = null
    return
  }
  diagnosisResult.value = diagnoseBySymptom(selectedSymptom.value)
}

function resetDiagnosis() {
  selectedSymptom.value = ''
  selectedCategory.value = ''
  diagnosisResult.value = null
}
</script>

<template>
  <div class="failure-diagnosis-page">
    <PageToolbar title="MechBox" subtitle="失效诊断专家系统">
      <a-space>
        <a-button size="small" @click="resetDiagnosis">
          <template #icon><MedicineBoxOutlined /></template>重置
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <AnalysisBrief
        title="诊断任务"
        summary="用于根据观察到的失效现象快速形成排查顺序，把经验性故障定位整理成可执行的检查清单。"
        :metrics="diagnosisMetrics"
        :inputs="[
          '先限定零部件类别，再选择最接近现场现象的症状描述。',
          '如果症状模糊，建议先从全类别进入，再逐步缩小范围。'
        ]"
        :outputs="[
          '按概率排序的可能原因。',
          '与每条原因对应的机理描述、改进建议和相关计算入口。'
        ]"
        :notes="[
          '当前结果基于专家规则树，不替代拆检、测量和寿命试验。',
          '应优先处理高概率项，再回到中低概率项复核。'
        ]"
      />

      <ToolPageLayout :input-span="8" :output-span="16">
        <template #side>
          <a-card title="失效现象选择" size="small">
            <a-form layout="vertical">
              <a-form-item label="设备类别">
                <a-select v-model:value="selectedCategory" style="width: 100%" @change="selectedSymptom = ''">
                  <a-select-option v-for="category in categories" :key="category.value" :value="category.value">
                    {{ category.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="失效现象">
                <a-select
                  v-model:value="selectedSymptom"
                  style="width: 100%"
                  placeholder="选择或搜索失效现象"
                  show-search
                  :filter-option="(input: string, option: any) => option.label.toLowerCase().includes(input.toLowerCase())"
                >
                  <a-select-option v-for="symptom in symptoms" :key="symptom.value" :value="symptom.value" :label="symptom.label">
                    {{ symptom.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-button type="primary" block @click="runDiagnosis" :disabled="!selectedSymptom">
                开始诊断
              </a-button>
            </a-form>
          </a-card>

          <a-card title="使用说明" size="small">
            <a-steps direction="vertical" size="small" :current="-1">
              <a-step title="选择设备类别" description="根据失效零件限定规则范围" />
              <a-step title="选择失效现象" description="描述观察到的失效表现" />
              <a-step title="查看诊断结果" description="系统给出可能原因和建议" />
              <a-step title="执行复核" description="回到现场检查、测量与相关计算模块" />
            </a-steps>
          </a-card>
        </template>

        <template #main>
          <AlertStack :items="diagnosisAlerts" />

          <a-card :title="diagnosisResult ? `诊断结果：${diagnosisResult.selectedSymptom}` : '诊断结果'" size="small">
            <StateEmpty v-if="!diagnosisResult" description="请选择失效现象后点击开始诊断" />

            <div v-else class="diagnosis-result">
              <a-collapse :default-active-key="[0]">
                <a-collapse-panel v-for="(cause, index) in diagnosisResult.causes" :key="`${cause.cause}-${index}`" :header="`${index + 1}. ${cause.cause}`">
                  <template #extra>
                    <a-tag :color="getProbabilityColor(cause.probability)">
                      {{ getProbabilityLabel(cause.probability) }}
                    </a-tag>
                  </template>

                  <a-descriptions bordered size="small" :column="1">
                    <a-descriptions-item label="失效机理">
                      {{ cause.description }}
                    </a-descriptions-item>
                    <a-descriptions-item label="建议措施">
                      <a-list size="small" :data-source="cause.suggestions">
                        <template #renderItem="{ item }">
                          <a-list-item>
                            {{ item }}
                          </a-list-item>
                        </template>
                      </a-list>
                    </a-descriptions-item>
                    <a-descriptions-item v-if="cause.relatedCalculation" label="相关计算">
                      <a-tag color="blue">{{ cause.relatedCalculation }}</a-tag>
                    </a-descriptions-item>
                  </a-descriptions>
                </a-collapse-panel>
              </a-collapse>
            </div>
          </a-card>

          <AnalysisDecisionPanel
            :conclusion="diagnosisDecision.conclusion"
            :status="diagnosisDecision.status"
            :risks="diagnosisDecision.risks"
            :actions="diagnosisDecision.actions"
            :deliverables="diagnosisDecision.deliverables"
          />

          <FormulaPanel v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.failure-diagnosis-page {
  max-width: 1400px;
  margin: 0 auto;
}

.diagnosis-result {
  display: grid;
  gap: 12px;
}
</style>
