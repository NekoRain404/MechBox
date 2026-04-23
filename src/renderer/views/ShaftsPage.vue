<script setup lang="ts">
/**
 * ShaftsPage.vue - 轴强度校核页面
 */
import { ref, computed } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import AlertStack from '../components/AlertStack.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import { calcShaftStrength } from '@renderer/engine/shafts/strength'
import { calcShaftFatigue, type ShaftFatigueParams } from '@renderer/engine/shafts/fatigue'
import { FilePdfOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { usePdfExport } from '../composables/usePdfExport'

type ShaftFatigueForm = Omit<ShaftFatigueParams, 'yieldStrength'>

const defaultShaftParams = {
  diameter: 30,
  length: 200,
  bendingMoment: 50000,
  torque: 30000,
  axialForce: 0,
  materialYield: 355,
  supportType: 'simply' as const,
}
const defaultFatigueForm: ShaftFatigueForm = {
  alternatingStress: 100,
  meanStress: 50,
  enduranceLimit: 200,
  ultimateStrength: 500,
  criterion: 'goodman',
}

const params = ref({ ...defaultShaftParams })
const fatigueForm = ref<ShaftFatigueForm>({ ...defaultFatigueForm })
const fatigueInput = computed<ShaftFatigueParams>(() => ({
  ...fatigueForm.value,
  yieldStrength: params.value.materialYield,
}))
const result = computed(() => calcShaftStrength(params.value))
const fatigueResult = computed(() => calcShaftFatigue(fatigueInput.value))
const inputErrors = computed(() => ({
  diameter: params.value.diameter <= 0 ? '轴径必须大于 0' : '',
  length: params.value.length <= 0 ? '跨度必须大于 0' : '',
  bendingMoment: params.value.bendingMoment < 0 ? '弯矩不能为负' : '',
  torque: params.value.torque < 0 ? '扭矩不能为负' : '',
  axialForce: params.value.axialForce < 0 ? '轴向力不能为负' : '',
  materialYield: params.value.materialYield <= 0 ? '材料屈服强度必须大于 0' : '',
  alternatingStress: fatigueForm.value.alternatingStress < 0 ? '交变应力不能为负' : '',
  meanStress: fatigueForm.value.meanStress < 0 ? '平均应力不能为负' : '',
  enduranceLimit: fatigueForm.value.enduranceLimit <= 0 ? '疲劳极限必须大于 0' : '',
  ultimateStrength: fatigueForm.value.ultimateStrength <= 0 ? '抗拉强度必须大于 0' : '',
}))
const inputAlerts = computed(() => {
  const alerts: Array<{ level: 'error' | 'warning'; message: string; description?: string }> = []

  for (const message of Object.values(inputErrors.value)) {
    if (message) alerts.push({ level: 'error', message })
  }

  if (params.value.bendingMoment === 0 && params.value.torque === 0 && params.value.axialForce === 0) {
    alerts.push({
      level: 'warning',
      message: '当前静载输入全为 0，静强度结果只反映空载状态。',
      description: '如果想做真实校核，请至少给出弯矩、扭矩或轴向力中的一种。',
    })
  }
  if (fatigueForm.value.ultimateStrength < params.value.materialYield) {
    alerts.push({
      level: 'warning',
      message: '抗拉强度低于当前材料屈服强度，材料参数组合不合理。',
      description: '请检查疲劳输入中的 Su 是否与当前材料牌号一致。',
    })
  }
  if (fatigueForm.value.enduranceLimit >= fatigueForm.value.ultimateStrength) {
    alerts.push({
      level: 'warning',
      message: '疲劳极限已接近或超过抗拉强度，建议复核材料数据来源。',
    })
  }

  return alerts
})
const canShowResults = computed(() => !inputAlerts.value.some((item) => item.level === 'error'))
const emptyDescription = computed(() => {
  const firstError = inputAlerts.value.find((item) => item.level === 'error')
  if (firstError) return firstError.message
  return '当前参数组合暂无可展示结果'
})
const formulaSections = computed(() => [
  {
    title: '静强度',
    formulas: [
      'A = πd² / 4',
      'σa = F / A',
      'σb = 32Mb / (πd³)',
      'τt = 16T / (πd³)',
      'σvM = √((σa + σb)² + 3τt²)',
      'n = σy / σvM',
    ],
    variables: ['d: 轴径 mm', 'Mb: 弯矩 N·mm', 'T: 扭矩 N·mm', 'F: 轴向力 N'],
    notes: ['当前按光轴圆截面计算，不含键槽、台阶和应力集中修正。'],
  },
  {
    title: '挠度与临界转速估算',
    formulas: [
      'Feq = 4Mb / L  (简支)',
      'δ = FeqL³ / (48EI)',
      'ncr ≈ 30 · √(g / δ)',
    ],
    variables: ['E: 弹性模量', 'I = πd⁴ / 64', 'L: 跨度 mm'],
    notes: ['悬臂和固支会切换对应等效载荷系数，仍属于筛查级估算。'],
  },
  {
    title: '疲劳准则',
    formulas: fatigueForm.value.criterion === 'goodman'
      ? ['σa / Se + σm / Su = 1 / n']
      : ['σa / Se + σm / Sy = 1 / n'],
    variables: [`Se: 疲劳极限`, `Su: 抗拉强度`, `Sy: 当前跟随材料屈服强度 ${params.value.materialYield} MPa`],
    notes: ['疲劳输入由用户直接给定，当前不会自动从载荷谱生成应力谱。'],
  },
])
const activeFormulaSection = ref('静强度')
const resultSummaryCards = computed(() => {
  if (!canShowResults.value) return []

  return [
    {
      label: '轴径',
      value: `${params.value.diameter} mm`,
      hint: `${params.value.supportType === 'simply' ? '简支梁' : params.value.supportType === 'cantilever' ? '悬臂梁' : '固支梁'}模型`,
      emphasis: true,
    },
    {
      label: 'von Mises 应力',
      value: `${result.value.value.vonMisesStress.toFixed(1)} MPa`,
      hint: '静强度合成应力',
    },
    {
      label: '静强度安全',
      value: Number.isFinite(result.value.value.safetyFactor) ? result.value.value.safetyFactor.toFixed(2) : '∞',
      hint: result.value.value.safetyFactor >= 2 ? '静强度裕量较稳妥' : '静强度裕量偏紧',
    },
    {
      label: '疲劳安全',
      value: Number.isFinite(fatigueResult.value.fatigueSafetyFactor) ? fatigueResult.value.fatigueSafetyFactor.toFixed(2) : '∞',
      hint: `${fatigueResult.value.criterion} 准则`,
    },
    {
      label: '临界转速',
      value: `${result.value.value.criticalSpeed.toFixed(0)} rpm`,
      hint: '基于挠度的简化估算',
    },
  ]
})
const decisionPanel = computed(() => {
  if (!canShowResults.value) return null

  const staticSF = result.value.value.safetyFactor
  const fatigueSF = fatigueResult.value.fatigueSafetyFactor
  const status: 'success' | 'info' | 'warning' | 'error' = staticSF >= 2 && fatigueSF >= 2
    ? 'success'
    : staticSF >= 1.5 && fatigueSF >= 1.5
      ? 'info'
      : staticSF >= 1.2 && fatigueSF >= 1.2
        ? 'warning'
        : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (staticSF < 1.5) {
    risks.push(`静强度安全系数仅 ${staticSF.toFixed(2)}。`)
    actions.push('增大轴径或降低弯矩、扭矩输入。')
  }
  if (fatigueSF < 1.5) {
    risks.push(`疲劳安全系数仅 ${fatigueSF.toFixed(2)}。`)
    actions.push('复核载荷谱并增加表面强化、圆角过渡或材料等级。')
  }
  if (result.value.warnings.length || fatigueResult.value.warnings.length) {
    risks.push('当前组合已触发强度或疲劳警告，不能直接作为最终定型结果。')
  }

  return {
    conclusion: `静强度安全系数约 ${Number.isFinite(staticSF) ? staticSF.toFixed(2) : '∞'}，疲劳安全系数约 ${Number.isFinite(fatigueSF) ? fatigueSF.toFixed(2) : '∞'}。`,
    status,
    risks,
    actions,
    boundaries: [
      '当前按光轴圆截面计算，不包含键槽、台阶和应力集中自动修正。',
      '疲劳强度输入由用户直接给定，不会自动从载荷谱生成应力谱。',
    ],
  }
})

function resetShaftInputs() {
  params.value = { ...defaultShaftParams }
  fatigueForm.value = { ...defaultFatigueForm }
  activeFormulaSection.value = '静强度'
}

const { isExporting, exportPdf } = usePdfExport()

async function handleExportPdf() {
  await exportPdf({
    selector: '.shafts-page',
    filename: `MechBox-Shaft-${params.value.diameter}`,
  })
}
</script>

<template>
  <div class="shafts-page">
    <PageToolbar title="MechBox" subtitle="轴强度校核">
      <a-space>
        <a-button size="small" @click="resetShaftInputs">
          <template #icon><UndoOutlined /></template>恢复默认
        </a-button>
        <a-button size="small" type="primary" @click="handleExportPdf" :disabled="isExporting || !canShowResults">
          <template #icon><FilePdfOutlined /></template>导出PDF
        </a-button>
      </a-space>
    </PageToolbar>
    <div class="content-body">
      <ToolPageLayout>
        <template #side>
          <a-card title="轴参数" size="small">
            <a-form layout="vertical">
              <a-form-item label="轴径 d (mm)">
                <a-input-number v-model:value="params.diameter" :status="inputErrors.diameter ? 'error' : ''" :min="0.1" style="width:100%"/>
              </a-form-item>
              <a-form-item label="跨度 L (mm)">
                <a-input-number v-model:value="params.length" :status="inputErrors.length ? 'error' : ''" :min="0.1" style="width:100%"/>
              </a-form-item>
              <a-form-item label="弯矩 M_b (N·mm)">
                <a-input-number v-model:value="params.bendingMoment" :status="inputErrors.bendingMoment ? 'error' : ''" :min="0" style="width:100%"/>
              </a-form-item>
              <a-form-item label="扭矩 T (N·mm)">
                <a-input-number v-model:value="params.torque" :status="inputErrors.torque ? 'error' : ''" :min="0" style="width:100%"/>
              </a-form-item>
              <a-form-item label="轴向力 (N)">
                <a-input-number v-model:value="params.axialForce" :status="inputErrors.axialForce ? 'error' : ''" :min="0" style="width:100%"/>
              </a-form-item>
              <a-form-item label="材料屈服强度 (MPa)">
                <a-select v-model:value="params.materialYield">
                  <a-select-option :value="235">Q235 (235 MPa)</a-select-option>
                  <a-select-option :value="355">45# (355 MPa)</a-select-option>
                  <a-select-option :value="785">40Cr (785 MPa)</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="支承类型">
                <a-select v-model:value="params.supportType">
                  <a-select-option value="simply">简支梁</a-select-option>
                  <a-select-option value="cantilever">悬臂梁</a-select-option>
                  <a-select-option value="fixed">固支梁</a-select-option>
                </a-select>
              </a-form-item>
              <a-divider>疲劳强度准则</a-divider>
              <a-row :gutter="8">
                <a-col :span="12">
                  <a-form-item label="交变应力 σ_a (MPa)">
                    <a-input-number v-model:value="fatigueForm.alternatingStress" :status="inputErrors.alternatingStress ? 'error' : ''" :min="0" style="width:100%"/>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="平均应力 σ_m (MPa)">
                    <a-input-number v-model:value="fatigueForm.meanStress" :status="inputErrors.meanStress ? 'error' : ''" :min="0" style="width:100%"/>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="疲劳极限 S_e (MPa)">
                    <a-input-number v-model:value="fatigueForm.enduranceLimit" :status="inputErrors.enduranceLimit ? 'error' : ''" :min="1" style="width:100%"/>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="抗拉强度 S_u (MPa)">
                    <a-input-number v-model:value="fatigueForm.ultimateStrength" :status="inputErrors.ultimateStrength ? 'error' : ''" :min="1" style="width:100%"/>
                  </a-form-item>
                </a-col>
                <a-col :span="24">
                  <a-form-item label="计算准则">
                    <a-radio-group v-model:value="fatigueForm.criterion">
                      <a-radio value="goodman">Goodman (标准)</a-radio>
                      <a-radio value="soderberg">Soderberg (保守)</a-radio>
                    </a-radio-group>
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>
          <div class="section-note">
            静强度、挠度和疲劳这三部分当前仍以圆截面光轴为基础模型，不包含键槽和台阶应力集中自动修正。疲劳静屈服校验会自动跟随当前材料屈服强度。
          </div>
        </template>
        <template #main>
          <AlertStack v-if="inputAlerts.length" :items="inputAlerts" class="inline-validation" />

          <template v-if="canShowResults">
            <a-card title="静强度校核" size="small">
              <div class="tool-summary-strip">
                <article
                  v-for="item in resultSummaryCards"
                  :key="item.label"
                  class="tool-summary-card"
                  :class="{ 'is-emphasis': item.emphasis }"
                >
                  <div class="tool-summary-card__label">{{ item.label }}</div>
                  <div class="tool-summary-card__value">{{ item.value }}</div>
                  <div class="tool-summary-card__hint">{{ item.hint }}</div>
                </article>
              </div>
              <a-descriptions bordered size="small" :column="2">
                <a-descriptions-item label="轴向应力">{{ result.value.axialStress.toFixed(1) }} MPa</a-descriptions-item>
                <a-descriptions-item label="弯曲应力">{{ result.value.bendingStress.toFixed(1) }} MPa</a-descriptions-item>
                <a-descriptions-item label="扭转应力">{{ result.value.torsionalStress.toFixed(1) }} MPa</a-descriptions-item>
                <a-descriptions-item label="von Mises 应力">
                  <a-tag :color="result.value.vonMisesStress > params.materialYield ? 'red' : 'green'">{{ result.value.vonMisesStress.toFixed(1) }} MPa</a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="安全系数">
                  <a-tag :color="result.value.safetyFactor < 1.5 ? 'red' : result.value.safetyFactor < 2 ? 'orange' : 'green'">
                    {{ Number.isFinite(result.value.safetyFactor) ? result.value.safetyFactor.toFixed(2) : '∞' }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="最大挠度">{{ result.value.deflection.toFixed(4) }} mm</a-descriptions-item>
                <a-descriptions-item label="临界转速估算">{{ result.value.criticalSpeed.toFixed(0) }} rpm</a-descriptions-item>
              </a-descriptions>
              <AlertStack :items="result.value.warnings" />
              <div class="section-actions">
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '静强度' }" @click="activeFormulaSection = '静强度'">查看静强度</button>
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '挠度与临界转速估算' }" @click="activeFormulaSection = '挠度与临界转速估算'">查看挠度估算</button>
              </div>
            </a-card>

            <a-card :title="`疲劳强度校核 (${fatigueResult.criterion})`" size="small" style="margin-top:16px">
              <a-descriptions bordered size="small" :column="2">
                <a-descriptions-item label="疲劳安全系数 n">
                  <a-tag :color="fatigueResult.fatigueSafetyFactor >= 2.5 ? 'green' : fatigueResult.fatigueSafetyFactor >= 1.5 ? 'orange' : 'red'">
                    {{ Number.isFinite(fatigueResult.fatigueSafetyFactor) ? fatigueResult.fatigueSafetyFactor.toFixed(2) : '∞' }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="静态屈服安全系数">
                  <a-tag :color="fatigueResult.staticYieldSF >= 1.5 ? 'green' : 'red'">
                    {{ Number.isFinite(fatigueResult.staticYieldSF) ? fatigueResult.staticYieldSF.toFixed(2) : '∞' }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="疲劳极限 S_e">{{ fatigueForm.enduranceLimit.toFixed(0) }} MPa</a-descriptions-item>
                <a-descriptions-item label="跟随屈服强度 S_y">{{ params.materialYield.toFixed(0) }} MPa</a-descriptions-item>
              </a-descriptions>
              <AlertStack :items="fatigueResult.warnings" />
              <div class="section-actions">
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '疲劳准则' }" @click="activeFormulaSection = '疲劳准则'">查看疲劳准则</button>
              </div>
            </a-card>
            <CalculationDecisionPanel
              v-if="decisionPanel"
              title="轴系判断"
              :conclusion="decisionPanel.conclusion"
              :status="decisionPanel.status"
              :risks="decisionPanel.risks"
              :actions="decisionPanel.actions"
              :boundaries="decisionPanel.boundaries"
            />
            <FormulaPanel v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
          </template>
          <a-empty v-else :description="emptyDescription" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.shafts-page{max-width:1200px;margin:0 auto}
</style>
