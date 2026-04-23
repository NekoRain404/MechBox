<script setup lang="ts">
/**
 * DrivesPage - 传动工具页面
 * 带传动、链传动基础计算
 * Section 6.3
 */
import { ref, computed, watch } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import FormulaPanel from '../components/FormulaPanel.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import ToolPresetBar from '../components/ToolPresetBar.vue'
import AlertStack from '../components/AlertStack.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { calcVBel } from '../engine/drives/belt'
import { calcChainDrive } from '../engine/drives/chain'
import { FilePdfOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { usePdfExport } from '../composables/usePdfExport'


const driveType = ref<'belt' | 'chain'>('belt')
const defaultBeltParams = {
  power: 5.0,
  speed1: 1450,
  speed2: 725,
  beltType: 'B',
  centerDistance: 500,
}
const defaultChainParams = {
  power: 5.0,
  speed1: 100,
  speed2: 50,
  centerDistance: 500,
}
const beltPresets = [
  {
    key: 'general-belt',
    label: '通用减速带传动',
    description: '常规电机减速一半，适合一般筛查。',
    values: { ...defaultBeltParams },
  },
  {
    key: 'high-speed-belt',
    label: '高速轻载',
    description: '更高输入转速，适合风机或轻载辅助传动。',
    values: {
      power: 3.0,
      speed1: 2900,
      speed2: 1450,
      beltType: 'A',
      centerDistance: 420,
    },
  },
  {
    key: 'heavy-duty-belt',
    label: '较大功率',
    description: '功率更高，中心距更大，适合较重载的筛查起点。',
    values: {
      power: 11.0,
      speed1: 1480,
      speed2: 740,
      beltType: 'C',
      centerDistance: 720,
    },
  },
] as const
const chainPresets = [
  {
    key: 'general-chain',
    label: '通用链传动',
    description: '低速中载，适合一般链传动估算。',
    values: { ...defaultChainParams },
  },
  {
    key: 'slow-heavy-chain',
    label: '低速重载',
    description: '更高功率、较低转速，适合输送或重载链传动。',
    values: {
      power: 12.0,
      speed1: 80,
      speed2: 32,
      centerDistance: 760,
    },
  },
  {
    key: 'compact-chain',
    label: '紧凑中心距',
    description: '结构紧凑、速比较小，便于快速检查链长变化。',
    values: {
      power: 4.0,
      speed1: 180,
      speed2: 90,
      centerDistance: 360,
    },
  },
] as const

// 带传动参数
const beltParams = ref({
  ...defaultBeltParams,
})

// 链传动参数
const chainParams = ref({
  ...defaultChainParams,
})

const beltResult = computed(() => {
  if (Object.values(beltInputErrors.value).some(Boolean)) return null
  return calcVBel(beltParams.value)
})

const chainResult = computed(() => {
  if (Object.values(chainInputErrors.value).some(Boolean)) return null
  return calcChainDrive(chainParams.value)
})
const beltInputErrors = computed(() => ({
  power: beltParams.value.power <= 0 ? '传递功率必须大于 0。' : '',
  speed1: beltParams.value.speed1 <= 0 ? '小带轮转速必须大于 0。' : '',
  speed2: beltParams.value.speed2 <= 0 ? '大带轮转速必须大于 0。' : '',
  centerDistance: beltParams.value.centerDistance <= 0 ? '中心距必须大于 0。' : '',
}))
const chainInputErrors = computed(() => ({
  power: chainParams.value.power <= 0 ? '传递功率必须大于 0。' : '',
  speed1: chainParams.value.speed1 <= 0 ? '小链轮转速必须大于 0。' : '',
  speed2: chainParams.value.speed2 <= 0 ? '大链轮转速必须大于 0。' : '',
  centerDistance: chainParams.value.centerDistance <= 0 ? '中心距必须大于 0。' : '',
}))
const activeInputErrors = computed(() =>
  Object.values(driveType.value === 'belt' ? beltInputErrors.value : chainInputErrors.value).filter(Boolean),
)
const validationAlerts = computed(() =>
  activeInputErrors.value.map((message) => ({
    message,
    level: 'error' as const,
  })),
)
const resultSummaryCards = computed(() => {
  if (driveType.value === 'belt' && beltResult.value) {
    return [
      {
        label: '传动比',
        value: beltResult.value.value.transmissionRatio.toFixed(2),
        hint: '当前速比关系',
        emphasis: true,
      },
      {
        label: '带速',
        value: `${beltResult.value.value.beltSpeed.toFixed(2)} m/s`,
        hint: '决定带传动运行区间',
      },
      {
        label: '包角',
        value: `${beltResult.value.value.wrapAngle.toFixed(1)}°`,
        hint: '包角过小时传动能力会下降',
      },
      {
        label: '有效拉力',
        value: `${beltResult.value.value.effectivePull.toFixed(0)} N`,
        hint: '几何筛查下的估算结果',
      },
    ]
  }

  if (driveType.value === 'chain' && chainResult.value) {
    return [
      {
        label: '传动比',
        value: chainResult.value.value.transmissionRatio.toFixed(2),
        hint: '当前速比关系',
        emphasis: true,
      },
      {
        label: '推荐链号',
        value: chainResult.value.value.recommendedChain,
        hint: '按当前功率和链速近似推荐',
      },
      {
        label: '链速',
        value: `${chainResult.value.value.chainSpeed.toFixed(2)} m/s`,
        hint: '链速偏高时需复核润滑与冲击',
      },
      {
        label: '链节数',
        value: `${chainResult.value.value.chainLength}`,
        hint: '已按偶数链节圆整',
      },
    ]
  }

  return []
})
const emptyDescription = computed(() =>
  activeInputErrors.value.length ? '请先修正输入参数' : '当前暂无可显示结果',
)
const formulaSections = computed(() => driveType.value === 'belt'
  ? [
      {
        title: 'V 带几何与运动',
        formulas: [
          'i = n1 / n2',
          'v = πd1n1 / 60000',
          'α = 180 - (d2 - d1) · 57.3 / a',
          'L ≈ 2a + π(d1 + d2)/2 + (d2 - d1)² / (4a)',
        ],
        variables: ['d1/d2: 带轮直径 mm', 'n1/n2: 转速 rpm', 'a: 中心距 mm'],
        notes: ['当前程序会按功率自动推荐带型，并据此选取小带轮标准直径。'],
      },
      {
        title: '载荷筛查',
        formulas: [
          'Fe = 1000P / v',
        ],
        variables: ['P: 传递功率 kW', 'v: 带速 m/s'],
        notes: ['这是有效拉力估算，不含包角修正和单根带额定功率校核。'],
      },
    ]
  : [
      {
        title: '链传动速比与链速',
        formulas: [
          'i = n1 / n2',
          'z2 ≈ z1 · i',
          'v = p · z1 · n1 / 60000',
        ],
        variables: ['p: 链节距 mm', 'z1/z2: 链轮齿数'],
        notes: ['小链轮齿数当前按经验公式近似推荐。'],
      },
      {
        title: '链长与中心距',
        formulas: [
          'x ≈ 2a/p + (z1 + z2)/2 + ((z2 - z1)/2π)² · p/a',
          'aactual = p/4 · (t1 + √(t1² - t2))',
          'Fe = 1000P / v',
        ],
        variables: ['x: 链节数', 'a: 初始中心距 mm', 'P: 功率 kW'],
        notes: ['链节数最终会向上圆整为偶数。'],
      },
    ])
const activeFormulaSection = ref('V 带几何与运动')
const activePresetKey = computed(() => {
  const currentPresets = driveType.value === 'belt' ? beltPresets : chainPresets
  const currentParams = driveType.value === 'belt' ? beltParams.value : chainParams.value
  const matched = currentPresets.find((preset) =>
    Object.entries(preset.values).every(([key, value]) => currentParams[key as keyof typeof currentParams] === value),
  )
  return matched?.key ?? ''
})
const decisionPanel = computed(() => {
  if (driveType.value === 'belt') {
    if (!beltResult.value) return null
    const belt = beltResult.value.value
    const status: 'success' | 'info' | 'warning' | 'error' = belt.wrapAngle >= 120 && belt.beltSpeed <= 25
      ? 'success'
      : belt.wrapAngle >= 105
        ? 'info'
        : belt.wrapAngle >= 90
          ? 'warning'
          : 'error'

    const risks: string[] = []
    const actions: string[] = []

    if (belt.wrapAngle < 120) {
      risks.push(`包角仅 ${belt.wrapAngle.toFixed(1)}°，可能降低传动能力。`)
      actions.push('增大中心距或调整带轮尺寸，提升包角。')
    }
    if (beltResult.value.warnings.length) {
      risks.push('当前带传动参数已触发筛查警告。')
    }

    return {
      conclusion: `V 带方案的传动比约 ${belt.transmissionRatio.toFixed(2)}，带速约 ${belt.beltSpeed.toFixed(2)} m/s。`,
      status,
      risks,
      actions,
      boundaries: [
        '当前为几何与有效拉力筛查，不包含完整额定功率和寿命校核。',
      ],
    }
  }

  if (!chainResult.value) return null
  const chain = chainResult.value.value
  const status: 'success' | 'info' | 'warning' | 'error' = chain.chainSpeed <= 8 ? 'success' : chain.chainSpeed <= 12 ? 'info' : 'warning'
  const risks: string[] = []
  const actions: string[] = []

  if (chain.chainSpeed > 8) {
    risks.push(`链速 ${chain.chainSpeed.toFixed(2)} m/s 偏高。`)
    actions.push('复核链号、润滑方式和小链轮齿数。')
  }
  if (chainResult.value.warnings.length) {
    risks.push('当前链传动参数已触发筛查警告。')
  }

  return {
    conclusion: `链传动方案的传动比约 ${chain.transmissionRatio.toFixed(2)}，推荐链号为 ${chain.recommendedChain}。`,
    status,
    risks,
    actions,
    boundaries: [
      '当前按速比、链长与有效拉力近似计算，不包含冲击系数和寿命曲线。',
    ],
  }
})

watch(driveType, (value) => {
  activeFormulaSection.value = value === 'belt' ? 'V 带几何与运动' : '链传动速比与链速'
})

function applyDrivePreset(presetKey: string) {
  if (driveType.value === 'belt') {
    const preset = beltPresets.find((item) => item.key === presetKey)
    if (!preset) return
    beltParams.value = { ...preset.values }
    activeFormulaSection.value = 'V 带几何与运动'
    return
  }

  const preset = chainPresets.find((item) => item.key === presetKey)
  if (!preset) return
  chainParams.value = { ...preset.values }
  activeFormulaSection.value = '链传动速比与链速'
}

function resetDriveParams() {
  beltParams.value = { ...defaultBeltParams }
  chainParams.value = { ...defaultChainParams }
  activeFormulaSection.value = driveType.value === 'belt' ? 'V 带几何与运动' : '链传动速比与链速'
}

const { isExporting, exportPdf } = usePdfExport()

async function handleExportPdf() {
  await exportPdf({
    selector: '.drives-page',
    filename: `MechBox-${driveType.value}-drive`,
  })
}
</script>

<template>
  <div class="drives-page">
    <PageToolbar title="MechBox" subtitle="传动工具">
      <a-space>
        <a-button size="small" @click="resetDriveParams">
          <template #icon><UndoOutlined /></template>恢复默认
        </a-button>
        <a-button size="small" type="primary" @click="handleExportPdf" :disabled="isExporting || !resultSummaryCards.length">
          <template #icon><FilePdfOutlined /></template>导出PDF
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <a-card title="传动类型" size="small">
        <a-radio-group v-model:value="driveType" button-style="solid">
          <a-radio-button value="belt">V带传动</a-radio-button>
          <a-radio-button value="chain">链传动</a-radio-button>
        </a-radio-group>
      </a-card>

      <ToolPageLayout>
        <template #side>
          <ToolPresetBar
            :title="driveType === 'belt' ? 'V 带预设' : '链传动预设'"
            :description="driveType === 'belt' ? '用典型带传动起步，再细调带型、功率和中心距。' : '用典型链传动场景起步，再检查链号、链速和链长。'"
            :presets="driveType === 'belt' ? beltPresets : chainPresets"
            :active-key="activePresetKey"
            @apply="applyDrivePreset"
            @reset="resetDriveParams"
          />
          <a-card :title="driveType === 'belt' ? 'V带传动参数' : '链传动参数'" size="small">
            <a-form layout="vertical" v-if="driveType === 'belt'">
              <a-form-item label="传递功率 (kW)">
                <a-input-number v-model:value="beltParams.power" style="width: 100%" :min="0" />
              </a-form-item>
              <a-form-item label="小带轮转速 (rpm)">
                <a-input-number v-model:value="beltParams.speed1" style="width: 100%" :min="0" />
              </a-form-item>
              <a-form-item label="大带轮转速 (rpm)">
                <a-input-number v-model:value="beltParams.speed2" style="width: 100%" :min="0" />
              </a-form-item>
              <a-form-item label="带型">
                <a-select v-model:value="beltParams.beltType" style="width: 100%">
                  <a-select-option value="Y">Y</a-select-option>
                  <a-select-option value="Z">Z</a-select-option>
                  <a-select-option value="A">A</a-select-option>
                  <a-select-option value="B">B</a-select-option>
                  <a-select-option value="C">C</a-select-option>
                  <a-select-option value="D">D</a-select-option>
                  <a-select-option value="E">E</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="中心距 (mm)">
                <a-input-number v-model:value="beltParams.centerDistance" style="width: 100%" :min="0" />
              </a-form-item>
            </a-form>
            <a-form layout="vertical" v-else>
              <a-form-item label="传递功率 (kW)">
                <a-input-number v-model:value="chainParams.power" style="width: 100%" :min="0" />
              </a-form-item>
              <a-form-item label="小链轮转速 (rpm)">
                <a-input-number v-model:value="chainParams.speed1" style="width: 100%" :min="0" />
              </a-form-item>
              <a-form-item label="大链轮转速 (rpm)">
                <a-input-number v-model:value="chainParams.speed2" style="width: 100%" :min="0" />
              </a-form-item>
              <a-form-item label="中心距 (mm)">
                <a-input-number v-model:value="chainParams.centerDistance" style="width: 100%" :min="0" />
              </a-form-item>
            </a-form>
          </a-card>
          <InfoPanel title="使用提示" tone="accent">
            {{
              driveType === 'belt'
                ? 'V 带结果按几何关系和有效拉力估算输出，适合电机到工作机之间的方案对比。'
                : '链传动结果按速比、链速和链长近似计算，适合节距和链轮齿数的快速初筛。'
            }}
          </InfoPanel>
        </template>

        <template #main>
          <AlertStack v-if="validationAlerts.length" :items="validationAlerts" class="inline-validation" />
          <a-card
            v-if="(driveType === 'belt' && beltResult) || (driveType === 'chain' && chainResult)"
            title="计算结果"
            size="small"
          >
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
            <div v-if="driveType === 'belt'">
              <a-descriptions bordered size="small" :column="2">
                <a-descriptions-item label="传动比">{{ beltResult?.value.transmissionRatio?.toFixed(2) ?? '--' }}</a-descriptions-item>
                <a-descriptions-item label="带型">{{ beltParams.beltType }}</a-descriptions-item>
                <a-descriptions-item label="带速">{{ beltResult?.value.beltSpeed?.toFixed(2) ?? '--' }} m/s</a-descriptions-item>
                <a-descriptions-item label="小带轮直径">{{ beltResult?.value.smallPulleyDiameter ?? '--' }} mm</a-descriptions-item>
                <a-descriptions-item label="大带轮直径">{{ beltResult?.value.largePulleyDiameter ?? '--' }} mm</a-descriptions-item>
                <a-descriptions-item label="包角">{{ beltResult?.value.wrapAngle?.toFixed(1) ?? '--' }}°</a-descriptions-item>
                <a-descriptions-item label="带长">{{ beltResult?.value.beltLength?.toFixed(1) ?? '--' }} mm</a-descriptions-item>
                <a-descriptions-item label="有效拉力">{{ beltResult?.value.effectivePull?.toFixed(0) ?? '--' }} N</a-descriptions-item>
              </a-descriptions>
            </div>
            <div v-else>
              <a-descriptions bordered size="small" :column="2">
                <a-descriptions-item label="传动比">{{ chainResult?.value.transmissionRatio?.toFixed(2) ?? '--' }}</a-descriptions-item>
                <a-descriptions-item label="推荐链号">{{ chainResult?.value.recommendedChain ?? '--' }}</a-descriptions-item>
                <a-descriptions-item label="链节距">{{ chainResult?.value.chainPitch ?? '--' }} mm</a-descriptions-item>
                <a-descriptions-item label="小链轮齿数">{{ chainResult?.value.smallSprocketTeeth ?? '--' }}</a-descriptions-item>
                <a-descriptions-item label="大链轮齿数">{{ chainResult?.value.largeSprocketTeeth ?? '--' }}</a-descriptions-item>
                <a-descriptions-item label="链速">{{ chainResult?.value.chainSpeed?.toFixed(2) ?? '--' }} m/s</a-descriptions-item>
                <a-descriptions-item label="链节数">{{ chainResult?.value.chainLength ?? '--' }}</a-descriptions-item>
                <a-descriptions-item label="有效拉力">{{ chainResult?.value.effectivePull?.toFixed(0) ?? '--' }} N</a-descriptions-item>
              </a-descriptions>
            </div>

            <AlertStack :items="(driveType === 'belt' ? beltResult?.warnings : chainResult?.warnings) ?? []" />
            <div class="section-actions">
              <button
                v-if="driveType === 'belt'"
                type="button"
                class="formula-jump"
                :class="{ 'is-active': activeFormulaSection === 'V 带几何与运动' }"
                @click="activeFormulaSection = 'V 带几何与运动'"
              >查看几何公式</button>
              <button
                v-if="driveType === 'belt'"
                type="button"
                class="formula-jump"
                :class="{ 'is-active': activeFormulaSection === '载荷筛查' }"
                @click="activeFormulaSection = '载荷筛查'"
              >查看载荷公式</button>
              <button
                v-if="driveType === 'chain'"
                type="button"
                class="formula-jump"
                :class="{ 'is-active': activeFormulaSection === '链传动速比与链速' }"
                @click="activeFormulaSection = '链传动速比与链速'"
              >查看速比公式</button>
              <button
                v-if="driveType === 'chain'"
                type="button"
                class="formula-jump"
                :class="{ 'is-active': activeFormulaSection === '链长与中心距' }"
                @click="activeFormulaSection = '链长与中心距'"
              >查看链长公式</button>
            </div>
          </a-card>
          <CalculationDecisionPanel
            v-if="decisionPanel"
            title="传动方案判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
          <FormulaPanel v-if="resultSummaryCards.length" v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
          <a-empty v-else :description="emptyDescription" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.drives-page { max-width: 1200px; margin: 0 auto; }
/* 使用全局统一样式 */
</style>
