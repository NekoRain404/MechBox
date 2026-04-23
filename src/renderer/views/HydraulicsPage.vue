<script setup lang="ts">
/**
 * HydraulicsPage.vue - 液压气动计算页面
 */
import { ref, computed } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import AlertStack from '../components/AlertStack.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { calcCylinder, cylinderEndConditionOptions, standardBoreSizes } from '@renderer/engine/hydraulics/cylinder'
import { FilePdfOutlined } from '@ant-design/icons-vue'
import { usePdfExport } from '../composables/usePdfExport'

const params = ref({
  boreDiameter: 50,
  rodDiameter: 28,
  pressure: 10,
  stroke: 300,
  unsupportedLength: 300,
  endCondition: 'fixed-pinned' as const,
  flowRate: 10,
  targetExtendTime: 3,
  targetForce: 10,
})
const result = computed(() => calcCylinder(params.value))
const selectedEndCondition = computed(() => {
  return cylinderEndConditionOptions.find((item) => item.value === params.value.endCondition) ?? cylinderEndConditionOptions[1]
})
const formulaSections = computed(() => [
  {
    title: '推力与有效面积',
    formulas: [
      'A = πD² / 4',
      'Arod = πd² / 4',
      'Fext = P · A',
      'Fret = P · (A - Arod)',
    ],
    variables: ['D: 缸径 mm', 'd: 杆径 mm', 'P: 压力 MPa', 'A: 面积 mm²'],
    notes: ['当前实现直接用 MPa 与 mm² 组合，结果为 N。'],
  },
  {
    title: '速度与节拍',
    formulas: [
      'vext = Q / A',
      'vret = Q / (A - Arod)',
      't = s / v',
      'Qreq = A · s / ttarget · 60 / 10^6',
    ],
    variables: ['Q: 流量 L/min', 's: 行程 mm', 't: 时间 s'],
    notes: ['所需流量按目标伸出时间反推，缩回时间仍按输入流量计算。'],
  },
  {
    title: '压杆稳定',
    formulas: [
      'I = πd⁴ / 64',
      'Le = K · Lfree',
      'Fcr = π²EI / Le²',
      'nb = Fcr / Fext',
    ],
    variables: [
      'E: 2.06×10^5 MPa',
      `K: 当前支承条件取 ${selectedEndCondition.value.factor.toFixed(1)} (${selectedEndCondition.value.label})`,
      'Lfree: 受压自由长度 mm',
      'nb: 稳定安全系数',
    ],
    notes: ['这是欧拉稳定的筛查模型，不含导向套、偏载、摩擦和安装误差。'],
  },
])
const activeFormulaSection = ref(formulaSections.value[0].title)
const decisionPanel = computed(() => {
  const cylinder = result.value.value
  const forceMargin = cylinder.extendForce / 1000 - params.value.targetForce
  const status: 'success' | 'info' | 'warning' | 'error' = cylinder.bucklingSafetyFactor < 1
    ? 'error'
    : cylinder.bucklingSafetyFactor < 2
      ? 'warning'
      : forceMargin >= 3 && cylinder.requiredExtendFlow <= params.value.flowRate
      ? 'success'
      : forceMargin >= 0
        ? 'info'
        : 'warning'

  const risks: string[] = []
  const actions: string[] = []

  if (forceMargin < 0) {
    risks.push(`目标推力缺口约 ${Math.abs(forceMargin).toFixed(2)} kN。`)
    actions.push('提高压力或增大缸径，再复核速度和杆径。')
  }
  if (cylinder.requiredExtendFlow > params.value.flowRate) {
    risks.push('当前流量不足以满足目标伸出节拍。')
    actions.push('提高泵流量，或放宽目标伸出时间。')
  }
  if (cylinder.bucklingSafetyFactor < 1) {
    risks.push(`压杆稳定已失效，安全系数仅 ${cylinder.bucklingSafetyFactor.toFixed(2)}。`)
    actions.push('优先增大杆径、缩短受压自由长度，或把支承条件改为更高刚度方案。')
  } else if (cylinder.bucklingSafetyFactor < 2) {
    risks.push(`压杆稳定裕量偏低，安全系数 ${cylinder.bucklingSafetyFactor.toFixed(2)}。`)
    actions.push('建议补充导向、减小悬臂段，并按实际安装方式复核有效长度系数。')
  }

  return {
    conclusion: `当前方案的伸出推力约 ${ (cylinder.extendForce / 1000).toFixed(2) } kN，目标节拍所需流量约 ${cylinder.requiredExtendFlow.toFixed(1)} L/min。`,
    status,
    risks,
    actions,
    boundaries: [
      '当前按理想压力与面积直接估算，不含密封摩擦、泄漏和背压损失。',
      '失稳按欧拉型筛查处理，支承条件与自由长度请按真实安装状态填写。',
    ],
  }
})

function autoSelectBore() {
  const force = params.value.targetForce * 1000
  const area = force / Math.max(params.value.pressure, 0.1)
  params.value.boreDiameter = standardBoreSizes.find(s => Math.PI*s*s/4 >= area) || 80
}

const { isExporting, exportPdf } = usePdfExport()

async function handleExportPdf() {
  await exportPdf({
    selector: '.hydraulics-page',
    filename: `MechBox-Hydraulics-${params.value.boreDiameter}`,
  })
}
</script>

<template>
  <div class="hydraulics-page">
    <PageToolbar title="MechBox" subtitle="液压气动计算">
      <a-space>
        <a-button size="small" @click="autoSelectBore">自动选型</a-button>
        <a-button size="small" type="primary" @click="handleExportPdf" :disabled="isExporting"><template #icon><FilePdfOutlined /></template>导出PDF</a-button>
      </a-space>
    </PageToolbar>
    <div class="content-body">
      <ToolPageLayout>
        <template #side>
          <a-card title="液压缸参数" size="small">
            <a-form layout="vertical">
              <a-form-item label="缸径 D (mm)">
                <a-select v-model:value="params.boreDiameter">
                  <a-select-option v-for="s in standardBoreSizes" :key="s" :value="s">{{ s }} mm</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="杆径 d (mm)"><a-input-number v-model:value="params.rodDiameter" :min="10" :max="params.boreDiameter-5" style="width:100%"/></a-form-item>
              <a-form-item label="工作压力 P (MPa)"><a-input-number v-model:value="params.pressure" :min="0" style="width:100%"/><div style="font-size:11px;color:#888">低压≤2.5 / 中压2.5~8 / 高压16~31.5</div></a-form-item>
              <a-form-item label="行程 (mm)"><a-input-number v-model:value="params.stroke" :min="10" style="width:100%"/></a-form-item>
              <a-form-item label="受压自由长度 (mm)"><a-input-number v-model:value="params.unsupportedLength" :min="10" style="width:100%"/></a-form-item>
              <a-form-item label="杆端支承条件">
                <a-select v-model:value="params.endCondition">
                  <a-select-option v-for="item in cylinderEndConditionOptions" :key="item.value" :value="item.value">
                    {{ item.label }} (K={{ item.factor }})
                  </a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="流量 (L/min)"><a-input-number v-model:value="params.flowRate" :min="0" style="width:100%"/></a-form-item>
              <a-form-item label="目标推力 (kN)">
                <a-input-number v-model:value="params.targetForce" :min="0" style="width:100%"/>
              </a-form-item>
              <a-form-item label="目标伸出时间 (s)">
                <a-input-number v-model:value="params.targetExtendTime" :min="0.1" :step="0.1" style="width:100%"/>
              </a-form-item>
            </a-form>
          </a-card>
          <InfoPanel title="选型说明" tone="accent">
            自动选型会按目标推力和当前工作压力反推最接近的标准缸径。稳定校核请优先填写真实受压自由长度和支承条件，否则长行程结果会偏乐观或偏保守。
          </InfoPanel>
        </template>
        <template #main>
          <a-card title="计算结果" size="small">
            <a-descriptions bordered size="small" :column="2">
              <a-descriptions-item label="活塞面积">{{ (result.value.pistonArea/100).toFixed(2) }} cm²</a-descriptions-item>
              <a-descriptions-item label="伸出推力">{{ (result.value.extendForce/1000).toFixed(2) }} kN</a-descriptions-item>
              <a-descriptions-item label="缩回拉力">{{ (result.value.retractForce/1000).toFixed(2) }} kN</a-descriptions-item>
              <a-descriptions-item label="伸出速度">{{ result.value.extendSpeed.toFixed(1) }} mm/s</a-descriptions-item>
              <a-descriptions-item label="缩回速度">{{ result.value.retractSpeed.toFixed(1) }} mm/s</a-descriptions-item>
              <a-descriptions-item label="伸出时间">{{ result.value.extendTime.toFixed(2) }} s</a-descriptions-item>
              <a-descriptions-item label="缩回时间">{{ result.value.retractTime.toFixed(2) }} s</a-descriptions-item>
              <a-descriptions-item label="目标节拍所需流量">{{ result.value.requiredExtendFlow.toFixed(1) }} L/min</a-descriptions-item>
              <a-descriptions-item label="欧拉临界载荷">{{ (result.value.criticalBucklingForce / 1000).toFixed(2) }} kN</a-descriptions-item>
              <a-descriptions-item label="稳定安全系数">
                <a-tag :color="result.value.bucklingSafetyFactor < 1 ? 'red' : result.value.bucklingSafetyFactor < 2 ? 'orange' : 'green'">
                  {{ result.value.bucklingSafetyFactor.toFixed(2) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="失稳风险">
                <a-tag :color="result.value.bucklingRisk?'red':'green'">{{ result.value.bucklingRisk?'有风险':'安全' }}</a-tag>
              </a-descriptions-item>
            </a-descriptions>
            <AlertStack :items="result.value.warnings" />
            <div class="section-actions">
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '推力与有效面积' }" @click="activeFormulaSection = '推力与有效面积'">查看推力公式</button>
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '速度与节拍' }" @click="activeFormulaSection = '速度与节拍'">查看速度公式</button>
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '压杆稳定' }" @click="activeFormulaSection = '压杆稳定'">查看稳定公式</button>
            </div>
          </a-card>
          <CalculationDecisionPanel
            title="液压缸判断"
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
.hydraulics-page{max-width:1200px;margin:0 auto}
</style>
