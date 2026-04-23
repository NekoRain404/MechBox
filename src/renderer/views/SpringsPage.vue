<script setup lang="ts">
/**
 * SpringsPage.vue - 弹簧计算页面
 */
import { ref, computed } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import AlertStack from '../components/AlertStack.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { calcCompressionSpring, getSpringColorGrade } from '@renderer/engine/springs/compression'
import { calcSpringBuckling } from '@renderer/engine/springs/buckling'
import { FilePdfOutlined } from '@ant-design/icons-vue'
import { usePdfExport } from '../composables/usePdfExport'


const params = ref({ 
  wireDiameter: 2, 
  meanDiameter: 16, 
  activeCoils: 10, 
  shearModulus: 79000, 
  load: 50,
  freeLength: 100,
  endCondition: 'hinged-hinged' as 'fixed-fixed' | 'fixed-hinged' | 'hinged-hinged' | 'fixed-free'
})

const result = computed(() => calcCompressionSpring(params.value))
const bucklingResult = computed(() => calcSpringBuckling({
  freeLength: params.value.freeLength,
  meanDiameter: params.value.meanDiameter,
  endCondition: params.value.endCondition,
  workingDeflection: result.value.value.deflection
}))
const formulaSections = [
  {
    title: '压缩弹簧基本关系',
    formulas: [
      'k = Gd⁴ / (8D³n)',
      'δ = F / k',
      'C = D / d',
      'τ = 8FDK / (πd³)',
    ],
    variables: ['d: 线径', 'D: 中径', 'n: 有效圈数', 'G: 剪切模量', 'K: 曲度系数'],
    notes: ['当前模型适用于圆柱螺旋压缩弹簧。'],
  },
  {
    title: '并紧与失稳',
    formulas: [
      'Lsolid ≈ d · (n + 2)',
      'Lcr ≈ 2.63 · D / μ',
    ],
    variables: ['μ: 端部约束对应失稳系数'],
    notes: ['失稳校核按 Haringx 近似，不含导杆与偏载影响。'],
  },
]
const activeFormulaSection = ref(formulaSections[0].title)
const decisionPanel = computed(() => {
  const spring = result.value.value
  const springIndex = spring.springIndex
  const safety = bucklingResult.value.safetyFactor
  const status: 'success' | 'info' | 'warning' | 'error' = safety >= 1.8 && springIndex >= 4 && springIndex <= 12
    ? 'success'
    : safety >= 1.3
      ? 'info'
      : safety >= 1
        ? 'warning'
        : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (springIndex < 4 || springIndex > 12) {
    risks.push(`弹簧指数 ${springIndex.toFixed(2)} 偏离常用制造区间。`)
    actions.push('优先调整中径与线径比例，回到更可制造的弹簧指数。')
  }
  if (safety < 1.5) {
    risks.push(`失稳安全系数仅 ${safety.toFixed(2)}。`)
    actions.push('缩短自由长度、增加导向或提高线径与中径比。')
  }
  if (result.value.warnings.length || bucklingResult.value.warnings.length) {
    risks.push('当前方案已经触发刚度、应力或失稳警告。')
  }

  return {
    conclusion: `当前弹簧刚度约 ${spring.springRate.toFixed(2)} N/mm，失稳安全系数约 ${safety.toFixed(2)}。`,
    status,
    risks,
    actions,
    boundaries: [
      '当前模型针对圆柱螺旋压缩弹簧，不覆盖锥形或异形弹簧。',
      '失稳结果按 Haringx 近似处理，不包含导杆和偏载效应。',
    ],
  }
})

const { isExporting, exportPdf } = usePdfExport()

async function handleExportPdf() {
  await exportPdf({
    selector: '.springs-page',
    filename: 'MechBox-Spring',
  })
}
</script>

<template>
  <div class="springs-page">
    <PageToolbar title="MechBox" subtitle="弹簧计算">
      <a-button size="small" type="primary" @click="handleExportPdf" :disabled="isExporting"><template #icon><FilePdfOutlined /></template>导出PDF</a-button>
    </PageToolbar>
    <div class="content-body">
      <ToolPageLayout>
        <template #side>
          <a-card title="弹簧参数" size="small">
            <a-form layout="vertical">
              <a-form-item label="线径 d (mm)"><a-input-number v-model:value="params.wireDiameter" :min="0.1" style="width:100%"/></a-form-item>
              <a-form-item label="中径 D (mm)"><a-input-number v-model:value="params.meanDiameter" :min="1" style="width:100%"/></a-form-item>
              <a-form-item label="有效圈数 n"><a-input-number v-model:value="params.activeCoils" :min="1" :step="0.5" style="width:100%"/></a-form-item>
              <a-form-item label="剪切模量 G (MPa)"><a-input-number v-model:value="params.shearModulus" style="width:100%"/><div style="font-size:11px;color:#888">钢 ≈ 79000</div></a-form-item>
              <a-form-item label="工作载荷 F (N)"><a-input-number v-model:value="params.load" :min="0" style="width:100%"/></a-form-item>
              <a-divider>失稳校核 (Section 10.5)</a-divider>
              <a-form-item label="自由长度 L0 (mm)"><a-input-number v-model:value="params.freeLength" :min="10" style="width:100%"/></a-form-item>
              <a-form-item label="端部约束">
                <a-select v-model:value="params.endCondition" style="width:100%">
                  <a-select-option value="fixed-fixed">两端固定</a-select-option>
                  <a-select-option value="fixed-hinged">一端固定一端铰接</a-select-option>
                  <a-select-option value="hinged-hinged">两端铰接</a-select-option>
                  <a-select-option value="fixed-free">一端固定一端自由</a-select-option>
                </a-select>
              </a-form-item>
            </a-form>
          </a-card>
          <InfoPanel title="适用范围" tone="accent">
            当前页覆盖圆柱螺旋压缩弹簧的刚度、切应力和失稳筛查，适合在定型前快速校核几何比例。
          </InfoPanel>
        </template>
        <template #main>
          <a-card title="计算结果" size="small">
            <a-descriptions bordered size="small" :column="2">
              <a-descriptions-item label="弹簧刚度">{{ result.value.springRate.toFixed(2) }} N/mm</a-descriptions-item>
              <a-descriptions-item label="弹簧指数 C">{{ result.value.springIndex.toFixed(2) }}</a-descriptions-item>
              <a-descriptions-item label="变形量">{{ result.value.deflection.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="切应力">{{ result.value.shearStress.toFixed(1) }} MPa</a-descriptions-item>
              <a-descriptions-item label="曲度系数 K">{{ result.value.curvatureFactor.toFixed(3) }}</a-descriptions-item>
              <a-descriptions-item label="并紧长度">{{ result.value.solidLength.toFixed(1) }} mm</a-descriptions-item>
              <a-descriptions-item label="固有频率">{{ result.value.naturalFreq.toFixed(0) }} Hz</a-descriptions-item>
              <a-descriptions-item label="载荷等级">{{ getSpringColorGrade(result.value.springRate, result.value.deflection) }}</a-descriptions-item>
            </a-descriptions>
            <AlertStack :items="result.value.warnings" />
            
            <a-divider>失稳校核结果 (Haringx 理论)</a-divider>
            <a-descriptions bordered size="small" :column="2">
              <a-descriptions-item label="临界长度 Lcr">
                <a-tag :color="bucklingResult.safetyFactor >= 1.5 ? 'green' : 'red'">{{ bucklingResult.criticalLength.toFixed(1) }} mm</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="失稳安全系数">
                <a-tag :color="bucklingResult.safetyFactor >= 1.5 ? 'green' : bucklingResult.safetyFactor >= 1.0 ? 'orange' : 'red'">{{ bucklingResult.safetyFactor.toFixed(2) }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="进入稳定区所需压缩量">{{ bucklingResult.maxDeflection.toFixed(2) }} mm</a-descriptions-item>
            </a-descriptions>
            <AlertStack :items="bucklingResult.warnings" />
            <div class="section-actions">
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '压缩弹簧基本关系' }" @click="activeFormulaSection = '压缩弹簧基本关系'">查看弹簧公式</button>
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '并紧与失稳' }" @click="activeFormulaSection = '并紧与失稳'">查看失稳公式</button>
            </div>
          </a-card>
          <CalculationDecisionPanel
            title="弹簧判断"
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
.springs-page{max-width:1200px;margin:0 auto}
</style>
