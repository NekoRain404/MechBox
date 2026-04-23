<script setup lang="ts">
/**
 * MotorsPage.vue - 电机选型页面
 */
import { ref, computed } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import AlertStack from '../components/AlertStack.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { calcMotorSelection } from '@renderer/engine/motors/selection'
import { FilePdfOutlined } from '@ant-design/icons-vue'
import { usePdfExport } from '../composables/usePdfExport'

const params = ref({
  loadForce: 10,
  speed: 1500,
  inertia: 0.001,
  motorInertia: 0.00025,
  acceleration: 100,
  accelDutyCycle: 0.15,
  efficiency: 0.9,
  safetyFactor: 1.5,
})
const result = computed(() => calcMotorSelection(params.value))
const formulaSections = [
  {
    title: '连续扭矩与加速扭矩',
    formulas: [
      'Tcont = Tload / η',
      'Tacc = J · α / η',
      'Tpeak = Tcont + Tacc',
    ],
    variables: ['Tload: 负载扭矩 N·m', 'η: 传动效率', 'J: 负载惯量 kg·m²', 'α: 角加速度 rad/s²'],
    notes: ['页面输入的“负载扭矩”直接作为 Tload 使用。'],
  },
  {
    title: '热等效与功率',
    formulas: [
      'Trms = √(Tcont² · (1 - D) + Tpeak² · D)',
      'P = Trms · 2πn / 60000',
      'Prec = P · S',
    ],
    variables: ['D: 加速段占空比', 'n: 转速 rpm', 'S: 安全系数'],
    notes: ['所需功率按 RMS 扭矩估算，比直接取峰值更接近热负荷。'],
  },
  {
    title: '惯量匹配',
    formulas: [
      'Jratio = Jload / Jmotor',
    ],
    variables: ['Jload: 负载惯量 kg·m²', 'Jmotor: 电机转子惯量 kg·m²'],
    notes: ['惯量比现在按页面输入的电机转子惯量计算，避免隐藏固定常数。'],
  },
]
const activeFormulaSection = ref(formulaSections[0].title)
const decisionPanel = computed(() => {
  const motor = result.value.value
  const status: 'success' | 'info' | 'warning' | 'error' = motor.inertiaRatio <= 3
    ? 'success'
    : motor.inertiaRatio <= 8
      ? 'info'
      : motor.inertiaRatio <= 12
        ? 'warning'
        : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (motor.inertiaRatio > 8) {
    risks.push(`惯量比 ${motor.inertiaRatio.toFixed(1)} 偏高，动态响应会变差。`)
    actions.push('考虑增加减速比、降低负载惯量或选更大转子惯量的电机。')
  }
  if (motor.peakTorque > motor.requiredTorque * 2) {
    actions.push('峰值扭矩占比偏高，建议复核加速度设定和加速段占空比。')
  }
  if (result.value.warnings.length) {
    risks.push('当前参数组合已触发选型警告，不能直接作为最终电机定型依据。')
  }

  return {
    conclusion: `建议连续扭矩约 ${motor.requiredTorque.toFixed(2)} N·m，推荐电机功率约 ${motor.recommendedMotorPower.toFixed(2)} kW。`,
    status,
    risks,
    actions,
    boundaries: [
      '当前输入直接使用负载扭矩，不含电机样本库与具体转矩-转速曲线。',
      '惯量匹配依赖输入的电机转子惯量，仍属于筛查级判断，不替代样本曲线校核。',
    ],
  }
})

const { isExporting, exportPdf } = usePdfExport()

async function handleExportPdf() {
  await exportPdf({
    selector: '.motors-page',
    filename: 'MechBox-Motor',
  })
}
</script>

<template>
  <div class="motors-page">
    <PageToolbar title="MechBox" subtitle="电机选型">
      <a-button size="small" type="primary" @click="handleExportPdf" :disabled="isExporting"><template #icon><FilePdfOutlined /></template>导出PDF</a-button>
    </PageToolbar>
    <div class="content-body">
      <ToolPageLayout>
        <template #side>
          <a-card title="负载参数" size="small">
            <a-form layout="vertical">
              <a-form-item label="负载扭矩 (N·m)"><a-input-number v-model:value="params.loadForce" :min="0" style="width:100%"/></a-form-item>
              <a-form-item label="转速 (rpm)"><a-input-number v-model:value="params.speed" :min="0" style="width:100%"/></a-form-item>
              <a-form-item label="负载惯量 (kg·m²)"><a-input-number v-model:value="params.inertia" :min="0" :step="0.001" style="width:100%"/></a-form-item>
              <a-form-item label="电机转子惯量 (kg·m²)">
                <a-input-number v-model:value="params.motorInertia" :min="0.000001" :step="0.00005" style="width:100%"/>
              </a-form-item>
              <a-form-item label="加速度 (rad/s²)"><a-input-number v-model:value="params.acceleration" :min="0" style="width:100%"/></a-form-item>
              <a-form-item label="加速段占空比">
                <a-input-number v-model:value="params.accelDutyCycle" :min="0" :max="1" :step="0.05" style="width:100%"/>
              </a-form-item>
              <a-form-item label="传动效率"><a-input-number v-model:value="params.efficiency" :min="0.5" :max="1" :step="0.05" style="width:100%"/></a-form-item>
              <a-form-item label="安全系数"><a-input-number v-model:value="params.safetyFactor" :min="1" :max="3" :step="0.1" style="width:100%"/></a-form-item>
            </a-form>
          </a-card>
          <InfoPanel title="模型边界" tone="accent">
            当前页面按筛查级选型流程计算连续扭矩、峰值扭矩和 RMS 热负荷，适合初步匹配电机功率等级。惯量比请尽量按候选电机样本填写转子惯量。
          </InfoPanel>
        </template>
        <template #main>
          <a-card title="选型结果" size="small">
            <a-descriptions bordered size="small" :column="2">
              <a-descriptions-item label="连续所需扭矩">{{ result.value.requiredTorque.toFixed(2) }} N·m</a-descriptions-item>
              <a-descriptions-item label="所需功率">{{ result.value.requiredPower.toFixed(3) }} kW</a-descriptions-item>
              <a-descriptions-item label="峰值扭矩">{{ result.value.peakTorque.toFixed(2) }} N·m</a-descriptions-item>
              <a-descriptions-item label="RMS 扭矩估算">{{ result.value.rmsTorque.toFixed(2) }} N·m</a-descriptions-item>
              <a-descriptions-item label="惯量比">
                <a-tag :color="result.value.inertiaRatio>10?'red':result.value.inertiaRatio>3?'orange':'green'">{{ result.value.inertiaRatio.toFixed(1) }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="计算用转子惯量">{{ params.motorInertia.toFixed(6) }} kg·m²</a-descriptions-item>
              <a-descriptions-item label="推荐电机功率"><strong>{{ result.value.recommendedMotorPower.toFixed(2) }} kW</strong></a-descriptions-item>
            </a-descriptions>
            <AlertStack :items="result.value.warnings" />
            <div class="section-actions">
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '连续扭矩与加速扭矩' }" @click="activeFormulaSection = '连续扭矩与加速扭矩'">查看扭矩公式</button>
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '热等效与功率' }" @click="activeFormulaSection = '热等效与功率'">查看功率公式</button>
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '惯量匹配' }" @click="activeFormulaSection = '惯量匹配'">查看惯量公式</button>
            </div>
          </a-card>
          <CalculationDecisionPanel
            title="电机选型判断"
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
.motors-page{max-width:1200px;margin:0 auto}
</style>
