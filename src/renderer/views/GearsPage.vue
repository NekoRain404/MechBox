<script setup lang="ts">
/**
 * GearsPage.vue - 齿轮计算页面
 * 渐开线圆柱齿轮几何计算 + ISO 6336 近似强度筛查
 */
import { ref, computed } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import AlertStack from '../components/AlertStack.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { calcGearGeometry, recommendModule, standardModules } from '@renderer/engine/gears/geometry'
import { calcGearISO6336 } from '@renderer/engine/gears/iso6336'
import { FilePdfOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { usePdfExport } from '../composables/usePdfExport'

const defaultGearParams = {
  module: 2,
  teeth1: 20,
  teeth2: 40,
  pressureAngle: 20,
  helixAngle: 0,
  x1: 0,
  x2: 0,
  faceWidth: 20,
  torque1: 50,
  sigmaHlim: 1500,
  sigmaFlim: 400,
}

const params = ref({ ...defaultGearParams })
const result = computed(() => calcGearGeometry(params.value))
const iso6336Result = computed(() => calcGearISO6336(params.value))
const inputErrors = computed(() => ({
  module: params.value.module <= 0 ? '模数必须大于 0' : '',
  teeth1: params.value.teeth1 <= 0 ? '小齿轮齿数必须大于 0' : '',
  teeth2: params.value.teeth2 <= 0 ? '大齿轮齿数必须大于 0' : '',
  pressureAngle: params.value.pressureAngle <= 0 ? '压力角必须大于 0' : '',
  helixAngle: params.value.helixAngle < 0 || params.value.helixAngle >= 45 ? '螺旋角建议在 0~45° 内' : '',
  faceWidth: params.value.faceWidth <= 0 ? '齿宽必须大于 0' : '',
  torque1: params.value.torque1 <= 0 ? '输入扭矩必须大于 0' : '',
  sigmaHlim: params.value.sigmaHlim <= 0 ? '接触疲劳极限必须大于 0' : '',
  sigmaFlim: params.value.sigmaFlim <= 0 ? '弯曲疲劳极限必须大于 0' : '',
}))
const inputAlerts = computed(() => {
  const alerts: Array<{ level: 'error' | 'warning'; message: string; description?: string }> = []

  for (const message of Object.values(inputErrors.value)) {
    if (message) {
      alerts.push({ level: 'error', message })
    }
  }

  if (params.value.teeth1 < 17 && params.value.x1 <= 0) {
    alerts.push({
      level: 'warning',
      message: '小齿轮齿数偏少且未做正变位，存在根切风险。',
      description: '建议提高小齿轮齿数，或给小齿轮分配正变位系数。',
    })
  }
  if (params.value.faceWidth < params.value.module * 8) {
    alerts.push({
      level: 'warning',
      message: '齿宽偏窄，弯曲与接触安全系数可能偏低。',
      description: '常规快速筛查可先把齿宽控制在 8m 以上，再复核强度结果。',
    })
  } else if (params.value.faceWidth > params.value.module * 16) {
    alerts.push({
      level: 'warning',
      message: '齿宽偏大，当前近似模型的载荷分布误差会放大。',
      description: '宽齿轮建议进一步补充齿向载荷分布系数和轴系挠度影响。',
    })
  }
  if (Math.abs(params.value.x1) > 0.8 || Math.abs(params.value.x2) > 0.8) {
    alerts.push({
      level: 'warning',
      message: '当前变位系数偏大，建议复核齿顶厚与齿根强度。',
      description: '大变位组合容易把几何筛查带入非标准齿形边界。',
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
const ratio = computed(() => (params.value.teeth1 > 0 ? params.value.teeth2 / params.value.teeth1 : 0))
const resultSummaryCards = computed(() => {
  if (!canShowResults.value) return []

  return [
    {
      label: '传动比',
      value: ratio.value.toFixed(2),
      hint: `${params.value.teeth1} : ${params.value.teeth2}`,
      emphasis: true,
    },
    {
      label: '中心距',
      value: `${result.value.value.centerDistance.toFixed(2)} mm`,
      hint: '当前几何组合',
    },
    {
      label: '重合度',
      value: result.value.value.contactRatio.toFixed(2),
      hint: result.value.value.contactRatio >= 1.2 ? '啮合平稳性基本可接受' : '啮合平稳性偏弱',
    },
    {
      label: '接触安全 SH',
      value: iso6336Result.value.value.SH.toFixed(2),
      hint: 'ISO 6336 近似筛查',
    },
    {
      label: '最低弯曲安全',
      value: Math.min(iso6336Result.value.value.SF1, iso6336Result.value.value.SF2).toFixed(2),
      hint: '按齿根疲劳最低值判断',
    },
  ]
})
const formulaSections = [
  {
    title: '几何关系',
    formulas: [
      'd = m · z / cos(β)',
      'da = d + 2m(ha* + x)',
      'df = d - 2m(ha* + c* - x)',
      'a = (d1 + d2) / 2',
    ],
    variables: ['m: 模数', 'z: 齿数', 'β: 螺旋角', 'x: 变位系数'],
    notes: ['当前页面主要覆盖渐开线圆柱齿轮几何。'],
  },
  {
    title: 'ISO 6336 近似筛查',
    formulas: [
      'Ft = 2T / d1',
      'SH = σHlim / σH',
      'SF1 = σFlim / σF1',
      'SF2 = σFlim / σF2',
    ],
    variables: ['T: 输入扭矩', 'σH: 接触应力', 'σF: 齿根弯曲应力'],
    notes: ['这是近似强度筛查，不是完整 ISO 6336 系数链。'],
  },
]
const activeFormulaSection = ref(formulaSections[0].title)
const decisionPanel = computed(() => {
  if (!canShowResults.value) return null

  const geometry = result.value.value
  const strength = iso6336Result.value.value
  const minSafety = Math.min(strength.SH, strength.SF1, strength.SF2)
  const status: 'success' | 'info' | 'warning' | 'error' = minSafety >= 1.8 ? 'success' : minSafety >= 1.4 ? 'info' : minSafety >= 1.1 ? 'warning' : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (geometry.contactRatio < 1.2) {
    risks.push(`重合度 ${geometry.contactRatio.toFixed(2)} 偏低，啮合平稳性不足。`)
    actions.push('优先调整模数、齿数或变位系数组合，提高重合度。')
  }
  if (strength.SH < 1.1 || strength.SF1 < 1.4 || strength.SF2 < 1.4) {
    risks.push('接触或齿根强度安全系数偏低。')
    actions.push('增大模数、齿宽或提高材料许用应力后再复核。')
  }
  if (iso6336Result.value.warnings.length) {
    risks.push('近似筛查已触发强度警告，不能替代完整标准校核。')
  }

  return {
    conclusion: `当前组合的接触安全系数 SH 为 ${strength.SH.toFixed(2)}，齿根安全系数最低值约 ${Math.min(strength.SF1, strength.SF2).toFixed(2)}。`,
    status,
    risks,
    actions,
    boundaries: [
      'ISO 6336 结果为近似筛查，不包含完整系数链和修形建模。',
      '当前主要针对渐开线圆柱齿轮几何与初步强度判断。',
    ],
  }
})

function recommendGearModule() {
  const centerDistance = params.value.module * (params.value.teeth1 + params.value.teeth2) / 2
  params.value.module = recommendModule(centerDistance)
}

function resetGearInputs() {
  params.value = { ...defaultGearParams }
  activeFormulaSection.value = formulaSections[0].title
}

const { isExporting, exportPdf } = usePdfExport()

async function handleExportPdf() {
  await exportPdf({
    selector: '.gears-page',
    filename: `MechBox-Gear-${params.value.teeth1}x${params.value.teeth2}`,
  })
}
</script>

<template>
  <div class="gears-page">
    <PageToolbar title="MechBox" subtitle="齿轮计算">
      <a-space>
        <a-button size="small" @click="resetGearInputs">
          <template #icon><UndoOutlined /></template>恢复默认
        </a-button>
        <a-button size="small" @click="recommendGearModule">推荐模数</a-button>
        <a-button size="small" type="primary" @click="handleExportPdf" :disabled="isExporting || !canShowResults">
          <template #icon><FilePdfOutlined /></template>导出PDF
        </a-button>
      </a-space>
    </PageToolbar>
    <div class="content-body">
      <ToolPageLayout>
        <template #side>
          <a-card title="齿轮参数" size="small">
            <a-form layout="vertical">
              <a-form-item label="模数 m (mm)">
                <a-select v-model:value="params.module">
                  <a-select-option v-for="m in standardModules" :key="m" :value="m">{{ m }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-row :gutter="8">
                <a-col :span="12">
                  <a-form-item label="小齿轮齿数 z1">
                    <a-input-number v-model:value="params.teeth1" :status="inputErrors.teeth1 ? 'error' : ''" :min="1" style="width:100%"/>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="大齿轮齿数 z2">
                    <a-input-number v-model:value="params.teeth2" :status="inputErrors.teeth2 ? 'error' : ''" :min="1" style="width:100%"/>
                  </a-form-item>
                </a-col>
              </a-row>
              <a-form-item label="压力角 α (°)">
                <a-select v-model:value="params.pressureAngle">
                  <a-select-option :value="20">20° (标准)</a-select-option>
                  <a-select-option :value="25">25°</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="螺旋角 β (°)">
                <a-input-number v-model:value="params.helixAngle" :status="inputErrors.helixAngle ? 'error' : ''" :min="0" :max="44.9" style="width:100%"/>
              </a-form-item>
              <a-row :gutter="8">
                <a-col :span="12">
                  <a-form-item label="小齿轮变位 x1">
                    <a-input-number v-model:value="params.x1" :step="0.1" style="width:100%"/>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="大齿轮变位 x2">
                    <a-input-number v-model:value="params.x2" :step="0.1" style="width:100%"/>
                  </a-form-item>
                </a-col>
              </a-row>
              <a-form-item label="齿宽 b (mm)">
                <a-input-number v-model:value="params.faceWidth" :status="inputErrors.faceWidth ? 'error' : ''" :min="0.1" style="width:100%"/>
              </a-form-item>
              <a-divider>强度筛查输入</a-divider>
              <a-form-item label="输入扭矩 T1 (N·m)">
                <a-input-number v-model:value="params.torque1" :status="inputErrors.torque1 ? 'error' : ''" :min="0.1" style="width:100%"/>
              </a-form-item>
              <a-row :gutter="8">
                <a-col :span="12">
                  <a-form-item label="接触疲劳极限 σHlim">
                    <a-input-number v-model:value="params.sigmaHlim" :status="inputErrors.sigmaHlim ? 'error' : ''" :min="1" style="width:100%"/>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="弯曲疲劳极限 σFlim">
                    <a-input-number v-model:value="params.sigmaFlim" :status="inputErrors.sigmaFlim ? 'error' : ''" :min="1" style="width:100%"/>
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>
          <InfoPanel title="适用范围" tone="accent">
            当前页适合做渐开线圆柱齿轮方案初筛。几何关系和 ISO 6336 结果都属于快速设计阶段参考，不能替代完整修形与载荷分布校核。
          </InfoPanel>
        </template>
        <template #main>
          <AlertStack v-if="inputAlerts.length" :items="inputAlerts" class="inline-validation" />
          <a-card v-if="canShowResults" title="几何与强度筛查结果" size="small">
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
              <a-descriptions-item label="分度圆 d1">{{ result.value.d1.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="分度圆 d2">{{ result.value.d2.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="齿顶圆 da1">{{ result.value.da1.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="齿顶圆 da2">{{ result.value.da2.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="齿根圆 df1">{{ result.value.df1.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="齿根圆 df2">{{ result.value.df2.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="基圆 db1">{{ result.value.db1.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="基圆 db2">{{ result.value.db2.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="中心距 a">{{ result.value.centerDistance.toFixed(3) }} mm</a-descriptions-item>
              <a-descriptions-item label="重合度 ε">{{ result.value.contactRatio.toFixed(3) }}</a-descriptions-item>
            </a-descriptions>
            <AlertStack :items="result.value.warnings" />

            <a-divider>ISO 6336 近似强度筛查</a-divider>
            <a-descriptions bordered size="small" :column="2">
              <a-descriptions-item label="切向力 Ft">{{ iso6336Result.value.Ft.toFixed(0) }} N</a-descriptions-item>
              <a-descriptions-item label="接触应力 σH">{{ iso6336Result.value.sigmaH.toFixed(1) }} MPa</a-descriptions-item>
              <a-descriptions-item label="小齿轮弯曲应力 σF1">{{ iso6336Result.value.sigmaF1.toFixed(1) }} MPa</a-descriptions-item>
              <a-descriptions-item label="大齿轮弯曲应力 σF2">{{ iso6336Result.value.sigmaF2.toFixed(1) }} MPa</a-descriptions-item>
              <a-descriptions-item label="接触安全系数 SH">
                <a-tag :color="iso6336Result.value.SH >= 1.5 ? 'green' : (iso6336Result.value.SH >= 1.0 ? 'orange' : 'red')">{{ iso6336Result.value.SH.toFixed(2) }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="弯曲安全系数 SF1">
                <a-tag :color="iso6336Result.value.SF1 >= 2.0 ? 'green' : (iso6336Result.value.SF1 >= 1.4 ? 'orange' : 'red')">{{ iso6336Result.value.SF1.toFixed(2) }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="弯曲安全系数 SF2">
                <a-tag :color="iso6336Result.value.SF2 >= 2.0 ? 'green' : (iso6336Result.value.SF2 >= 1.4 ? 'orange' : 'red')">{{ iso6336Result.value.SF2.toFixed(2) }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="齿顶修缘建议">{{ iso6336Result.value.tipRelief.toFixed(0) }} μm</a-descriptions-item>
            </a-descriptions>
            <AlertStack :items="iso6336Result.value.warnings" />
            <div class="section-actions">
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '几何关系' }" @click="activeFormulaSection = '几何关系'">查看几何公式</button>
              <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === 'ISO 6336 近似筛查' }" @click="activeFormulaSection = 'ISO 6336 近似筛查'">查看强度筛查</button>
            </div>
          </a-card>
          <CalculationDecisionPanel
            v-if="decisionPanel"
            title="齿轮组合判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
          <FormulaPanel v-if="canShowResults" v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
          <a-empty v-else :description="emptyDescription" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.gears-page{max-width:1200px;margin:0 auto}
</style>
