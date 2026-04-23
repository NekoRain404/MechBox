<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import DatabaseRuntimeBanner from '../../components/DatabaseRuntimeBanner.vue'
import PageToolbar from '../../components/PageToolbar.vue'
import FormulaPanel from '../../components/FormulaPanel.vue'
import ToolPageLayout from '../../components/ToolPageLayout.vue'
import ToolPresetBar from '../../components/ToolPresetBar.vue'
import AlertStack from '../../components/AlertStack.vue'
import CalculationDecisionPanel from '../../components/CalculationDecisionPanel.vue'
import ProjectContextCard from '../../components/ProjectContextCard.vue'
import { useStandardStore } from '../../store/useStandardStore'
import { calcLife, calcEquivalentLoad } from '../../engine/bearings/life'
import { calcISO281Life, calcKappa, getA1Factor } from '../../engine/bearings/iso281'
import { usePdfExport } from '../../composables/usePdfExport'
import { useFavorite } from '../../composables/useFavorite'
import { useActiveProject } from '../../composables/useActiveProject'
import { useWorkflowRecorder } from '../../composables/useWorkflowRecorder'
import { useAppFeedback } from '../../composables/useAppFeedback'
import { FilePdfOutlined, StarOutlined, StarTwoTone, PrinterOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons-vue'
import Preview3D from '../../components/Preview3D.vue'
import { isElectronDbAvailable } from '../../utils/electron-db'
import { getReportModuleMeta } from '../../utils/reporting'
import { consumeToolLaunchPayload } from '../../utils/tool-launch'

const store = useStandardStore()
const { isFavorited, toggleFavorite, checkFavorite } = useFavorite()
const { isExporting, exportPdf } = usePdfExport()
const { activeProject } = useActiveProject()
const { recordModuleCalculation } = useWorkflowRecorder()
const feedback = useAppFeedback()
const reportMeta = getReportModuleMeta('bearings')
const defaultBearingSelection = '6205'
const defaultConditions = {
  Fr: 2.0,
  Fa: 0.5,
  X: 0.56,
  Y: 1.5,
  speed: 1500,
  temp: 50,
  operatingViscosity: 32,
  ratedViscosity: 16,
  reliability: 90,
  contaminationFactor: 0.8,
}
const bearingPresets = [
  {
    key: 'general-motor',
    label: '通用电机侧',
    description: '中速中载，适合普通电机或减速机输入端筛查。',
    designation: '6205',
    conditions: { ...defaultConditions },
  },
  {
    key: 'high-speed-light',
    label: '高速轻载',
    description: '更高转速、较低载荷，适合轻载风机或高速轴。',
    designation: '6204',
    conditions: {
      Fr: 1.2,
      Fa: 0.2,
      X: 0.56,
      Y: 1.3,
      speed: 6000,
      temp: 55,
      operatingViscosity: 22,
      ratedViscosity: 10,
      reliability: 90,
      contaminationFactor: 0.9,
    },
  },
  {
    key: 'heavy-belt-side',
    label: '皮带轮侧重载',
    description: '更高径向载荷，适合皮带轮侧或受力偏大的支撑点。',
    designation: '6208',
    conditions: {
      Fr: 5.5,
      Fa: 1.2,
      X: 0.56,
      Y: 1.5,
      speed: 980,
      temp: 65,
      operatingViscosity: 46,
      ratedViscosity: 20,
      reliability: 95,
      contaminationFactor: 0.65,
    },
  },
] as const
const runtimeNotice = computed(() =>
  isElectronDbAvailable()
    ? ''
    : '数据库接口未就绪，当前轴承规格来自本地 JSON 回退数据。可继续做基础寿命筛查，但目录字段与扩展数据链会受限。',
)
const runtimeDetails = computed(() => {
  if (!runtimeNotice.value) return []
  return [
    '深沟球轴承主规格会回退到仓库内置 JSON，基础寿命与 ISO 281 简化修正仍可继续计算。',
    '目录扩展字段与治理链优先来自 SQLite；在浏览器预览中会显示为内置治理快照。',
  ]
})

// 工况参数
const conditions = ref({
  ...defaultConditions,
})

// 用户选择的轴承型号
const selectedDesignation = ref(defaultBearingSelection)
const favoriteId = computed(() => `bearing_${selectedDesignation.value}`)
const activePresetKey = computed(() => {
  const matched = bearingPresets.find((preset) =>
    preset.designation === selectedDesignation.value &&
    Object.entries(preset.conditions).every(([key, value]) => conditions.value[key as keyof typeof conditions.value] === value),
  )
  return matched?.key ?? ''
})
const projectMetrics = computed(() => {
  if (!selectedBearing.value || !results.value) return []
  return [
    { label: '当前型号', value: selectedBearing.value.designation },
    { label: '修正寿命', value: `${results.value.iso281.value.L10mh.toFixed(0)} h` },
    { label: '润滑比 κ', value: results.value.kappa.toFixed(2) },
  ]
})
const resultSummaryCards = computed(() => {
  if (!selectedBearing.value || !results.value) return []

  return [
    {
      label: '当前型号',
      value: selectedBearing.value.designation,
      hint: '深沟球轴承筛查',
      emphasis: true,
    },
    {
      label: '修正寿命',
      value: `${results.value.iso281.value.L10mh.toFixed(0)} h`,
      hint: 'ISO 281 修正结果',
    },
    {
      label: '润滑比 κ',
      value: results.value.kappa.toFixed(2),
      hint: results.value.kappa >= 1 ? '润滑条件基本可接受' : '润滑边界偏紧',
    },
    {
      label: '当量动载荷 P',
      value: `${results.value.P.toFixed(2)} kN`,
      hint: '与额定动载荷直接对比',
    },
  ]
})

function applyBearingLaunchPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return false

  const record = payload as Record<string, unknown>
  let applied = false

  if (typeof record.designation === 'string' && record.designation) {
    selectedDesignation.value = record.designation
    applied = true
  }

  if (record.conditions && typeof record.conditions === 'object') {
    const nextConditions = { ...conditions.value }
    for (const [key, fallbackValue] of Object.entries(defaultConditions)) {
      const numericValue = Number((record.conditions as Record<string, unknown>)[key])
      if (Number.isFinite(numericValue)) {
        nextConditions[key as keyof typeof defaultConditions] = numericValue
      } else {
        nextConditions[key as keyof typeof defaultConditions] = fallbackValue
      }
    }
    conditions.value = nextConditions
    applied = true
  }

  if (applied) {
    activeFormulaSection.value = '当量动载荷与基础寿命'
  }

  return applied
}

onMounted(async () => {
  await store.fetchBearings()
  checkFavorite(favoriteId.value)

  const launch = consumeToolLaunchPayload('bearings')
  if (launch && applyBearingLaunchPayload(launch.payload)) {
    feedback.info(`已恢复${launch.sourceLabel ?? '上次'}参数`)
    checkFavorite(favoriteId.value)
  }
})

watch(favoriteId, (id) => {
  checkFavorite(id)
})

const selectedBearing = computed(() => {
  return store.bearingList.find(b => b.designation === selectedDesignation.value)
})

// Section 11.3: Live input validation
const inputErrors = computed(() => ({
  Fr: conditions.value.Fr < 0 ? '径向载荷不能为负' : '',
  Fa: conditions.value.Fa < 0 ? '轴向载荷不能为负' : '',
  X: conditions.value.X < 0 || conditions.value.X > 1 ? 'X 应在 0~1 之间' : '',
  Y: conditions.value.Y < 0 ? 'Y 不能为负' : '',
  speed: conditions.value.speed <= 0 ? '转速必须大于 0' : conditions.value.speed > 30000 ? '转速过高，请确认轴承规格' : '',
  temp: conditions.value.temp < -50 ? '温度过低' : conditions.value.temp > 200 ? '温度过高，请确认润滑方式' : '',
}))

const isValid = computed(() => Object.values(inputErrors.value).every(e => !e))
const visibleInputErrors = computed(() => Object.values(inputErrors.value).filter(Boolean))
const validationAlerts = computed(() =>
  visibleInputErrors.value.map((message) => ({
    message,
    level: 'error' as const,
  })),
)

const results = computed(() => {
  if (!selectedBearing.value || conditions.value.speed <= 0) return null

  const P = calcEquivalentLoad(conditions.value.Fr, conditions.value.Fa, conditions.value.X, conditions.value.Y)
  const life = calcLife(selectedBearing.value.dynamic_load_rating / 1000, P, 'ball', conditions.value.speed)
  
  // ISO 281 修正寿命计算 (Section 10.2)
  const kappa = calcKappa(conditions.value.operatingViscosity, conditions.value.ratedViscosity)
  const iso281 = calcISO281Life({
    C_r: selectedBearing.value.dynamic_load_rating / 1000,
    P,
    n: conditions.value.speed,
    bearingType: 'ball',
    kappa,
    a_1: getA1Factor(conditions.value.reliability),
    eta_c: conditions.value.contaminationFactor,
  })

  return { P, life, iso281, kappa }
})
const resultAlerts = computed(() => {
  if (!results.value) return []
  return [...results.value.life.warnings, ...results.value.iso281.value.warnings]
})
const decisionPanel = computed(() => {
  if (!results.value || !selectedBearing.value) return null

  const correctedLife = results.value.iso281.value.L10mh
  const status: 'success' | 'info' | 'warning' | 'error' = correctedLife >= 20000 ? 'success' : correctedLife >= 8000 ? 'info' : correctedLife >= 3000 ? 'warning' : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (results.value.life.warnings.length || results.value.iso281.value.warnings.length) {
    risks.push('当前工况下已触发寿命或润滑相关警告，不能直接视为长期稳定方案。')
  }
  if (results.value.kappa < 1) {
    risks.push('润滑膜厚度比 κ 偏低，边界润滑风险上升。')
    actions.push('优先提高工作粘度、改善润滑条件或降低转速。')
  }
  if (correctedLife < 8000) {
    risks.push(`修正寿命仅 ${correctedLife.toFixed(0)} h，偏低。`)
    actions.push('考虑提高额定动载荷、减小等效载荷或换更高规格轴承。')
  }
  if (results.value.P < (selectedBearing.value.dynamic_load_rating / 1000) * 0.01) {
    actions.push('注意最小载荷要求，必要时增加预载或复核工况。')
  }

  return {
    conclusion: `型号 ${selectedBearing.value.designation} 的修正寿命约为 ${correctedLife.toFixed(0)} h。`,
    status,
    risks,
    actions,
    boundaries: [
      '当前按深沟球轴承与简化 ISO 281 修正模型处理。',
      '润滑与污染影响来自 κ 与污染系数的筛查级近似，不等同于完整厂家寿命校核。',
    ],
  }
})

const formulaSections = computed(() => [
  {
    title: '当量动载荷与基础寿命',
    formulas: [
      'P = X · Fr + Y · Fa',
      'L10 = (C / P)^p',
      'L10h = 10^6 · L10 / (60 · n)',
    ],
    variables: ['Fr/Fa: 径向与轴向载荷 kN', 'C: 额定动载荷 kN', `p: 球轴承 = 3`],
    notes: ['当前页面默认按深沟球轴承处理。'],
  },
  {
    title: 'ISO 281 修正寿命',
    formulas: [
      'κ = ν / ν1',
      'L10m = a1 · aISO · L10',
      'L10mh = 10^6 · L10m / (60 · n)',
    ],
    variables: ['ν: 工作粘度', 'ν1: 额定粘度', 'a1: 可靠性系数', 'aISO: 润滑/污染修正'],
    notes: ['aISO 当前用 κ 与污染系数的简化模型计算，不是完整版标准流程。'],
  },
  {
    title: '边界与警告',
    formulas: [
      'Pmin ≈ 0.01 · C  (球轴承)',
    ],
    variables: ['Pmin: 防 skidding 最小载荷'],
    notes: ['当量载荷低于最小载荷时，页面会给出滑动风险提示。'],
  },
])
const activeFormulaSection = ref('当量动载荷与基础寿命')

async function handleExportPdf() {
  await exportPdf({
    selector: '.bearings-page',
    filename: `MechBox-Bearing-${selectedDesignation.value}`,
    reportRecord: results.value
      ? {
          title: `轴承 ${selectedDesignation.value} 计算书`,
          module: 'bearings',
          projectNumber: activeProject.value?.id ?? selectedDesignation.value,
          projectId: activeProject.value?.id,
          projectName: activeProject.value?.name,
          standardRef: reportMeta.standardRef,
          author: '系统',
          summary: buildProjectSummary(),
        }
      : undefined,
    onSuccess: () => {
      feedback.notifyExported('轴承计算 PDF')
    },
  })
}

function buildProjectSummary() {
  if (!selectedBearing.value || !results.value) return '轴承选型结果尚未形成。'
  return `轴承 ${selectedBearing.value.designation}：当量动载荷 ${results.value.P.toFixed(2)} kN，修正寿命 ${results.value.iso281.value.L10mh.toFixed(0)} h，润滑比 κ=${results.value.kappa.toFixed(2)}。`
}

async function syncToProject() {
  if (!selectedBearing.value || !results.value) {
    feedback.warning('当前结果尚未形成，无法写入项目')
    return
  }
  if (!activeProject.value) {
    feedback.warning('当前没有活动项目，无法写入摘要')
    return
  }

  await recordModuleCalculation({
    module: 'bearings',
    name: `轴承 ${selectedBearing.value.designation}`,
    projectSummary: buildProjectSummary(),
    inputData: {
      designation: selectedBearing.value.designation,
      conditions: { ...conditions.value },
    },
    contextData: {
      bearing: selectedBearing.value,
      alerts: resultAlerts.value,
    },
    outputData: {
      equivalentLoad: results.value.P,
      basicLife: results.value.life.value,
      correctedLife: results.value.iso281.value,
      kappa: results.value.kappa,
    },
    recentData: {
      designation: selectedBearing.value.designation,
      conditions: { ...conditions.value },
      results: {
        equivalentLoad: results.value.P,
        basicLifeHours: results.value.life.value.L10h,
        correctedLifeHours: results.value.iso281.value.L10mh,
        kappa: results.value.kappa,
      },
    },
    decisionData: decisionPanel.value,
    derivedMetrics: {
      equivalentLoad: results.value.P,
      correctedLifeHours: results.value.iso281.value.L10mh,
      kappa: results.value.kappa,
    },
  })
  feedback.notifySaved('项目摘要')
}

function handleToggleFavorite() {
  if (!selectedBearing.value) return
  toggleFavorite(favoriteId.value, {
    module: 'bearings',
    name: `轴承 ${selectedDesignation.value}`,
    data: {
      designation: selectedDesignation.value,
      bearing: selectedBearing.value,
      conditions: { ...conditions.value },
      results: results.value
    },
  })
}

function printReport() {
  window.print()
}

function applyBearingPreset(presetKey: string) {
  const preset = bearingPresets.find((item) => item.key === presetKey)
  if (!preset) return

  selectedDesignation.value = preset.designation
  conditions.value = { ...preset.conditions }
  activeFormulaSection.value = '当量动载荷与基础寿命'
}

function resetBearingInputs() {
  selectedDesignation.value = defaultBearingSelection
  conditions.value = { ...defaultConditions }
  activeFormulaSection.value = '当量动载荷与基础寿命'
}
</script>

<template>
  <div class="bearings-page">
    <PageToolbar title="MechBox" subtitle="轴承选型">
      <a-space>
        <a-button size="small" @click="resetBearingInputs">
          <template #icon><UndoOutlined /></template>恢复默认
        </a-button>
        <a-button size="small" :disabled="!results" @click="syncToProject">
          <template #icon><SaveOutlined /></template>写入项目
        </a-button>
        <a-button 
          size="small"
          @click="handleToggleFavorite"
        >
          <template #icon>
            <StarTwoTone v-if="isFavorited" two-tone-color="#faad14" />
            <StarOutlined v-else />
          </template>
          {{ isFavorited ? '已收藏' : '收藏' }}
        </a-button>
        <a-button size="small" type="primary" :disabled="isExporting || !results" @click="handleExportPdf">
          <template #icon><FilePdfOutlined /></template>创建PDF
        </a-button>
        <a-button size="small" @click="printReport">
          <template #icon><PrinterOutlined /></template>打印报告
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <DatabaseRuntimeBanner
        v-if="runtimeNotice"
        mode="fallback"
        :message="runtimeNotice"
        :details="runtimeDetails"
      />
      <ToolPageLayout>
        <template #side>
          <ToolPresetBar
            title="常用工况预设"
            description="先套常用工况，再按载荷、转速和润滑条件细调，筛查更快。"
            :presets="bearingPresets"
            :active-key="activePresetKey"
            @apply="applyBearingPreset"
            @reset="resetBearingInputs"
          />
          <a-card title="轴承选型与工况" size="small">
            <a-form layout="vertical">
              <a-form-item label="选择深沟球轴承型号">
                <a-select v-model:value="selectedDesignation" show-search style="width: 100%">
                  <a-select-option v-for="b in store.bearingList" :key="b.designation" :value="b.designation">
                    {{ b.designation }} (d={{ b.inner_diameter }}mm, D={{ b.outer_diameter }}mm)
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-divider>工况载荷 (kN)</a-divider>
              <a-row :gutter="12">
                <a-col :span="12"><a-form-item label="径向载荷 Fr"><a-input-number v-model:value="conditions.Fr" :status="inputErrors.Fr ? 'error' : ''" style="width: 100%" /></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="轴向载荷 Fa"><a-input-number v-model:value="conditions.Fa" :status="inputErrors.Fa ? 'error' : ''" style="width: 100%" /></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="系数 X"><a-input-number v-model:value="conditions.X" :status="inputErrors.X ? 'error' : ''" :min="0" :max="1" style="width: 100%" /></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="系数 Y"><a-input-number v-model:value="conditions.Y" :status="inputErrors.Y ? 'error' : ''" :min="0" style="width: 100%" /></a-form-item></a-col>
              </a-row>

              <a-divider>运行参数</a-divider>
              <a-row :gutter="12">
                <a-col :span="12"><a-form-item label="转速 (rpm)" :validate-status="inputErrors.speed ? 'error' : ''"><a-input-number v-model:value="conditions.speed" :status="inputErrors.speed ? 'error' : ''" style="width: 100%" /></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="温度 (°C)" :validate-status="inputErrors.temp ? 'error' : ''"><a-input-number v-model:value="conditions.temp" :status="inputErrors.temp ? 'error' : ''" style="width: 100%" /></a-form-item></a-col>
              </a-row>

              <a-divider>ISO 281 修正条件</a-divider>
              <a-row :gutter="12">
                <a-col :span="12"><a-form-item label="工作粘度 ν (mm²/s)"><a-input-number v-model:value="conditions.operatingViscosity" :min="1" style="width: 100%" /></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="额定粘度 ν1 (mm²/s)"><a-input-number v-model:value="conditions.ratedViscosity" :min="1" style="width: 100%" /></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="目标可靠性 (%)"><a-input-number v-model:value="conditions.reliability" :min="90" :max="99.9" :step="0.1" style="width: 100%" /></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="污染系数 ηc"><a-input-number v-model:value="conditions.contaminationFactor" :min="0.1" :max="1" :step="0.05" style="width: 100%" /></a-form-item></a-col>
              </a-row>
            </a-form>
          </a-card>

          <ProjectContextCard
            :active-project="activeProject"
            current-module="bearings"
            current-module-label="轴承选型"
            :metrics="projectMetrics"
            note="把当前寿命结果写入项目时，会同时登记一条最近计算，便于后续在项目中心回溯。"
          />
        </template>

        <template #main>
          <AlertStack v-if="!isValid" :items="validationAlerts" class="inline-validation" />

          <a-card title="轴承参数与寿命计算" size="small" v-if="selectedBearing && results">
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
            <a-descriptions bordered size="small" :column="2" title="轴承规格参数">
              <a-descriptions-item label="型号">{{ selectedBearing.designation }}</a-descriptions-item>
              <a-descriptions-item label="类型">深沟球轴承</a-descriptions-item>
              <a-descriptions-item label="内径 d">{{ selectedBearing.inner_diameter }} mm</a-descriptions-item>
              <a-descriptions-item label="外径 D">{{ selectedBearing.outer_diameter }} mm</a-descriptions-item>
              <a-descriptions-item label="宽度 B">{{ selectedBearing.width }} mm</a-descriptions-item>
              <a-descriptions-item label="质量">{{ selectedBearing.mass }} kg</a-descriptions-item>
              <a-descriptions-item label="额定动载荷 Cr">{{ (selectedBearing.dynamic_load_rating / 1000).toFixed(2) }} kN</a-descriptions-item>
              <a-descriptions-item label="额定静载荷 C0r">{{ (selectedBearing.static_load_rating / 1000).toFixed(2) }} kN</a-descriptions-item>
              <a-descriptions-item label="脂润滑极限">{{ selectedBearing.grease_speed_limit }} rpm</a-descriptions-item>
              <a-descriptions-item label="油润滑极限">{{ selectedBearing.oil_speed_limit }} rpm</a-descriptions-item>
            </a-descriptions>

            <!-- Section 4.1: 3D parameterized visualization -->
            <a-divider>3D 参数预览</a-divider>
            <Preview3D type="bearing" :params="{ d: selectedBearing.inner_diameter, D: selectedBearing.outer_diameter, B: selectedBearing.width }" />

            <a-divider />

            <div class="result-section">
              <div class="result-column-header">寿命校验结果 (ISO 281)</div>
              <div class="result-grid">
                <div class="res-label">当量动载荷 P [kN]</div>
                <div class="res-value">{{ results.P.toFixed(2) }}</div>
                <div class="res-label">基本额定寿命 L10 [百万转]</div>
                <div class="res-value">{{ results.life.value.L10.toFixed(2) }}</div>
                <div class="res-label">小时寿命 L10h [h]</div>
                <div class="res-value" :class="{ error: results.life.warnings.length }">{{ results.life.value.L10h.toFixed(0) }}</div>
              </div>
              
              <a-divider>ISO 281 修正额定寿命</a-divider>
              <div class="result-grid">
                <div class="res-label">润滑膜厚度比 κ</div>
                <div class="res-value">{{ results.kappa.toFixed(2) }}</div>
                <div class="res-label">可靠性系数 a1</div>
                <div class="res-value">{{ getA1Factor(conditions.reliability).toFixed(2) }}</div>
                <div class="res-label">修正系数 a_ISO</div>
                <div class="res-value">{{ results.iso281.value.a_ISO.toFixed(2) }}</div>
                <div class="res-label">修正寿命 L10m [百万转]</div>
                <div class="res-value">{{ results.iso281.value.L10m.toFixed(2) }}</div>
                <div class="res-label">修正小时寿命 L10mh [h]</div>
                <div class="res-value" :class="{ error: results.iso281.value.L10mh < results.life.value.L10h }">{{ results.iso281.value.L10mh.toFixed(0) }}</div>
              </div>
              
              <AlertStack :items="resultAlerts" />
              <div class="section-actions">
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '当量动载荷与基础寿命' }" @click="activeFormulaSection = '当量动载荷与基础寿命'">查看寿命公式</button>
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === 'ISO 281 修正寿命' }" @click="activeFormulaSection = 'ISO 281 修正寿命'">查看修正寿命</button>
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '边界与警告' }" @click="activeFormulaSection = '边界与警告'">查看边界条件</button>
              </div>
            </div>
          </a-card>
          <CalculationDecisionPanel
            v-if="decisionPanel"
            title="选型判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
          <FormulaPanel v-if="selectedBearing && results" v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
          <a-empty v-else description="正在加载数据或参数输入无效..." />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.bearings-page { font-size: 12px; }
/* 使用全局统一样式 */
</style>
