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
import { calcPreload, calcStress, recommendTorque } from '../../engine/bolts/strength'
import { calcVDI2230 } from '../../engine/bolts/vdi2230'
import { exportBoltAssemblyToSTEP } from '../../engine/cad-export'
import { FilePdfOutlined, PrinterOutlined, InfoCircleOutlined, DownloadOutlined, StarOutlined, StarTwoTone, SaveOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { usePdfExport } from '../../composables/usePdfExport'
import { useFavorite } from '../../composables/useFavorite'
import { useActiveProject } from '../../composables/useActiveProject'
import { useWorkflowRecorder } from '../../composables/useWorkflowRecorder'
import { useAppFeedback } from '../../composables/useAppFeedback'
import { getElectronDb } from '../../utils/electron-db'
import { fallbackBolts } from '../../utils/local-standard-fallbacks'
import { getReportModuleMeta } from '../../utils/reporting'
import { consumeToolLaunchPayload } from '../../utils/tool-launch'

const { isFavorited, toggleFavorite, checkFavorite } = useFavorite()
const { activeProject } = useActiveProject()
const { recordModuleCalculation } = useWorkflowRecorder()
const feedback = useAppFeedback()
const reportMeta = getReportModuleMeta('bolts')
const PROPERTY_CLASS_META: Record<string, { tensileStrength: number; yieldStrength: number }> = {
  '4.8': { tensileStrength: 400, yieldStrength: 320 },
  '8.8': { tensileStrength: 800, yieldStrength: 640 },
  '10.9': { tensileStrength: 1000, yieldStrength: 900 },
  '12.9': { tensileStrength: 1200, yieldStrength: 1080 },
}
const boltList = ref<any[]>([])
const defaultBoltSelection = 'M10'
const defaultPropertyClass = '8.8'
const defaultConditions = {
  axialForce: 5.0,
  shearForce: 0,
  torque: 49,
  torqueCoeff: 0.2,
}
const boltPresets = [
  {
    key: 'general-structure',
    label: '一般结构连接',
    description: '常规预紧、轴向载荷为主，适合普通机械连接筛查。',
    designation: 'M10',
    propertyClass: '8.8',
    conditions: { ...defaultConditions },
  },
  {
    key: 'preloaded-flange',
    label: '高强法兰连接',
    description: '更高预紧和综合载荷，适合高强预紧场景。',
    designation: 'M12',
    propertyClass: '10.9',
    conditions: {
      axialForce: 8,
      shearForce: 2,
      torque: 95,
      torqueCoeff: 0.18,
    },
  },
  {
    key: 'shear-dominant',
    label: '剪切主导连接',
    description: '横向载荷更大，便于快速查看剪应力和残余夹紧力。',
    designation: 'M16',
    propertyClass: '8.8',
    conditions: {
      axialForce: 3,
      shearForce: 12,
      torque: 180,
      torqueCoeff: 0.18,
    },
  },
] as const
const selectedDesignation = ref(defaultBoltSelection)
const propertyClass = ref(defaultPropertyClass)
const runtimeNotice = ref('')
const runtimeMode = ref<'fallback' | 'partial' | 'missing'>('fallback')
const propertyClassMeta = computed(() => PROPERTY_CLASS_META[propertyClass.value] ?? PROPERTY_CLASS_META[defaultPropertyClass])

// 工况参数
const conditions = ref({
  ...defaultConditions,
})

const selectedBolt = computed(() => {
  return boltList.value.find(b => b.designation === selectedDesignation.value)
})

const nominalDiameter = computed(() => selectedBolt.value?.nominal_d ?? extractDiameter(selectedDesignation.value))
const stressArea = computed(() => {
  if (selectedBolt.value?.stress_area) return selectedBolt.value.stress_area
  const d = nominalDiameter.value
  return d > 0 ? Math.PI * d * d / 4 : 0
})

const preloadResult = computed(() => {
  return calcPreload(conditions.value.torque, extractDiameter(selectedDesignation.value), conditions.value.torqueCoeff)
})

const stressResult = computed(() => {
  if (!selectedBolt.value || conditions.value.axialForce <= 0) return null
  return calcStress(selectedBolt.value, conditions.value.axialForce, conditions.value.shearForce)
})

// VDI 2230 近似校核 (Section 10.3)
const vdi2230Result = computed(() => {
  if (!selectedBolt.value || conditions.value.torque <= 0) return null
  return calcVDI2230({
    boltDiameter: nominalDiameter.value,
    boltClass: propertyClass.value,
    preloadForce: preloadResult.value.value,
    axialWorkingForce: conditions.value.axialForce,
    shearWorkingForce: conditions.value.shearForce,
    cycles: 100000,  // 假设10万次循环
    surfaceRoughness: 3.2  // 默认 Ra 3.2
  })
})

// Section 11.3: Live input validation
const inputErrors = computed(() => ({
  axialForce: conditions.value.axialForce < 0 ? '轴向载荷不能为负' : '',
  shearForce: conditions.value.shearForce < 0 ? '剪切载荷不能为负' : '',
  torque: conditions.value.torque <= 0 ? '预紧扭矩必须大于 0' : '',
  torqueCoeff: conditions.value.torqueCoeff < 0.1 ? '扭矩系数过低' : conditions.value.torqueCoeff > 0.3 ? '扭矩系数过高，请确认润滑状态' : '',
}))

const isValid = computed(() => Object.values(inputErrors.value).every(e => !e))
const visibleInputErrors = computed(() => Object.values(inputErrors.value).filter(Boolean))
const validationAlerts = computed(() =>
  visibleInputErrors.value.map((message) => ({
    message,
    level: 'error' as const,
  })),
)

const recommendedTorque = computed(() => {
  return recommendTorque(selectedDesignation.value, propertyClass.value)
})
const resultSummaryCards = computed(() => {
  if (!selectedBolt.value || !stressResult.value) return []

  const utilization = stressResult.value.value.von_mises / propertyClassMeta.value.yieldStrength

  return [
    {
      label: '当前连接',
      value: `${selectedDesignation.value} / ${propertyClass.value}级`,
      hint: '规格与性能等级',
      emphasis: true,
    },
    {
      label: '预紧力',
      value: `${preloadResult.value.value.toFixed(2)} kN`,
      hint: `扭矩法估算，当前扭矩 ${conditions.value.torque} N·m`,
    },
    {
      label: '等效应力',
      value: `${stressResult.value.value.von_mises.toFixed(1)} MPa`,
      hint: `屈服利用率 ${(utilization * 100).toFixed(0)}%`,
    },
    vdi2230Result.value
      ? {
          label: 'VDI 屈服安全',
          value: vdi2230Result.value.value.yieldSafety.toFixed(2),
          hint: '近似筛查结果',
        }
      : {
          label: '推荐扭矩',
          value: recommendedTorque.value > 0 ? `${recommendedTorque.value.toFixed(0)} N·m` : '--',
          hint: '当前等级经验值',
        },
  ]
})
const stressAlerts = computed(() => {
  if (!stressResult.value) return []
  const alerts = [...stressResult.value.warnings]
  const yieldStrength = propertyClassMeta.value.yieldStrength
  const safetyFactor = yieldStrength / stressResult.value.value.von_mises

  if (stressResult.value.value.von_mises > yieldStrength) {
    alerts.push({
      message: `等效应力超过 ${propertyClass.value} 级屈服强度，请增大规格或降低载荷。`,
      level: 'error' as const,
    })
  } else if (safetyFactor < 1.2) {
    alerts.push({
      message: `当前屈服安全系数约 ${safetyFactor.toFixed(2)}，已经接近当前性能等级上限。`,
      level: 'warning' as const,
    })
  } else {
    alerts.push({
      message: `当前屈服安全系数约 ${safetyFactor.toFixed(2)}，按 ${propertyClass.value} 级屈服强度估算。`,
      level: 'info' as const,
    })
  }

  return alerts
})
const decisionPanel = computed(() => {
  if (!stressResult.value) return null

  const vonMises = stressResult.value.value.von_mises
  const vdiSafety = vdi2230Result.value?.value.yieldSafety ?? 0
  const utilization = vonMises / propertyClassMeta.value.yieldStrength
  const status: 'success' | 'info' | 'warning' | 'error' = utilization <= 0.65 && (!vdi2230Result.value || vdiSafety >= 1.8)
    ? 'success'
    : utilization <= 0.8 && (!vdi2230Result.value || vdiSafety >= 1.5)
      ? 'info'
      : utilization <= 1
        ? 'warning'
        : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (utilization > 1) {
    risks.push(`一次等效应力已经超过 ${propertyClass.value} 级屈服强度。`)
    actions.push('优先增大螺栓规格，或降低轴向/剪切载荷。')
  } else if (utilization > 0.85) {
    risks.push(`当前屈服利用率约 ${(utilization * 100).toFixed(0)}%，连接裕量偏紧。`)
    actions.push('建议复核载荷假设、预紧力目标和螺栓规格，避免进入屈服边缘。')
  }
  if (vdi2230Result.value && vdiSafety < 1.5) {
    risks.push(`VDI 2230 近似屈服安全系数仅 ${vdiSafety.toFixed(2)}。`)
    actions.push('提高预紧控制质量，或改用更高性能等级和更刚性的接头。')
  }
  if (conditions.value.torqueCoeff > 0.25) {
    risks.push('扭矩系数偏高，实际预紧散差可能偏大。')
    actions.push('复核润滑状态和摩擦条件，避免仅按名义扭矩值判断预紧力。')
  }

  return {
    conclusion: `当前 ${selectedDesignation.value} 在 ${propertyClass.value} 级下的等效应力约为 ${vonMises.toFixed(1)} MPa，屈服利用率约 ${(utilization * 100).toFixed(0)}%。`,
    status,
    risks,
    actions,
    boundaries: [
      '预紧力按扭矩法估算，未显式建模摩擦散差分布。',
      'VDI 2230 为筛查级近似，不含完整夹紧件刚度分配与横向滑移校核。',
    ],
  }
})

const formulaSections = computed(() => [
  {
    title: '预紧力与一次应力',
    formulas: [
      'Fpre = T / (K · d)',
      'σ = Fa / As',
      'τ = Fs / (πd² / 4)',
      'σeq = √(σ² + 3τ²)',
    ],
    variables: ['T: 扭矩 N·m', 'K: 扭矩系数', 'd: 公称直径 mm', 'As: 应力截面积 mm²'],
    notes: ['当前预紧力是扭矩法估算，不含摩擦散差分布。'],
  },
  {
    title: '强度判据',
    formulas: [
      'ny = σy / σeq',
    ],
    variables: [`σy: 当前页面按 ${propertyClass.value} 级材料屈服强度判定（${propertyClassMeta.value.yieldStrength} MPa）`],
    notes: ['如果标准库缺失应力截面积，当前会回退到公称直径截面积估算。'],
  },
  {
    title: 'VDI 2230 近似筛查',
    formulas: [
      'σtot = (Fpre + FA) / As',
      'Sy = Rp0.2 / σtot',
      'Fset = δset · cb',
      'Fres = Fpre - Fset - 0.2 · FA',
    ],
    variables: ['FA: 轴向工作载荷', 'Rp0.2: 屈服强度', 'δset: 沉降量', 'cb: 螺栓刚度'],
    notes: ['这里是筛查级 VDI 2230，不含完整夹紧件刚度分配、横向滑移和拧紧散差。'],
  },
])
const activeFormulaSection = ref('预紧力与一次应力')

const favoriteId = computed(() => `bolt_${selectedDesignation.value}_${propertyClass.value}`)
const activePresetKey = computed(() => {
  const matched = boltPresets.find((preset) =>
    preset.designation === selectedDesignation.value &&
    preset.propertyClass === propertyClass.value &&
    Object.entries(preset.conditions).every(([key, value]) => conditions.value[key as keyof typeof conditions.value] === value),
  )
  return matched?.key ?? ''
})
const projectMetrics = computed(() => {
  if (!selectedBolt.value || !stressResult.value) return []
  return [
    { label: '当前规格', value: `${selectedDesignation.value} / ${propertyClass.value}级` },
    { label: '预紧力', value: `${preloadResult.value.value.toFixed(2)} kN` },
    { label: '等效应力', value: `${stressResult.value.value.von_mises.toFixed(1)} MPa` },
  ]
})
const emptyDescription = computed(() => {
  if (!selectedBolt.value) return '正在加载螺栓规格数据'
  if (!isValid.value) return '请先修正输入参数'
  if (conditions.value.axialForce <= 0) return '请输入有效轴向载荷后再计算'
  return '当前组合暂无可用结果'
})

function extractDiameter(designation: string): number {
  const match = designation.match(/M(\d+)/)
  return match ? parseFloat(match[1]) : 0
}

const { isExporting, exportPdf } = usePdfExport()

async function handleExportPdf() {
  await exportPdf({
    selector: '.bolts-page',
    filename: `MechBox-Bolt-${selectedDesignation.value}-${propertyClass.value}`,
    reportRecord: stressResult.value
      ? {
          title: `螺栓 ${selectedDesignation.value} ${propertyClass.value}级计算书`,
          module: 'bolts',
          projectNumber: activeProject.value?.id ?? `${selectedDesignation.value}-${propertyClass.value}`,
          projectId: activeProject.value?.id,
          projectName: activeProject.value?.name,
          standardRef: reportMeta.standardRef,
          author: '系统',
          summary: buildProjectSummary(),
        }
      : undefined,
    onSuccess: () => {
      feedback.notifyExported('螺栓计算 PDF')
    },
  })
}

function buildProjectSummary() {
  if (!stressResult.value) return '螺栓连接结果尚未形成。'
  const vdiSafety = vdi2230Result.value?.value.yieldSafety
  return `螺栓 ${selectedDesignation.value} ${propertyClass.value}级：预紧力 ${preloadResult.value.value.toFixed(2)} kN，等效应力 ${stressResult.value.value.von_mises.toFixed(1)} MPa，${vdiSafety ? `VDI 屈服安全系数 ${vdiSafety.toFixed(2)}` : '未启用 VDI 2230 校核'}。`
}

async function syncToProject() {
  if (!stressResult.value) {
    feedback.warning('当前结果尚未形成，无法写入项目')
    return
  }
  if (!activeProject.value) {
    feedback.warning('当前没有活动项目，无法写入摘要')
    return
  }

  await recordModuleCalculation({
    module: 'bolts',
    name: `螺栓 ${selectedDesignation.value} ${propertyClass.value}级`,
    projectSummary: buildProjectSummary(),
    inputData: {
      designation: selectedDesignation.value,
      propertyClass: propertyClass.value,
      conditions: { ...conditions.value },
    },
    contextData: {
      selectedBolt: selectedBolt.value,
      recommendedTorque: recommendedTorque.value,
      stressAlerts: stressAlerts.value,
    },
    outputData: {
      preload: preloadResult.value.value,
      stress: stressResult.value.value,
      vdi2230: vdi2230Result.value?.value ?? null,
    },
    recentData: {
      designation: selectedDesignation.value,
      propertyClass: propertyClass.value,
      conditions: { ...conditions.value },
      results: {
        preload: preloadResult.value.value,
        tensileStress: stressResult.value.value.tensile_stress,
        shearStress: stressResult.value.value.shear_stress,
        vonMises: stressResult.value.value.von_mises,
        vdiYieldSafety: vdi2230Result.value?.value.yieldSafety ?? null,
      },
    },
    decisionData: decisionPanel.value,
    derivedMetrics: {
      preload: preloadResult.value.value,
      vonMises: stressResult.value.value.von_mises,
      vdiYieldSafety: vdi2230Result.value?.value.yieldSafety ?? null,
    },
  })
  feedback.notifySaved('项目摘要')
}

function handleToggleFavorite() {
  if (!selectedBolt.value) return

  toggleFavorite(favoriteId.value, {
    module: 'bolts',
    name: `螺栓 ${selectedDesignation.value} (${propertyClass.value}级)`,
    data: {
      designation: selectedDesignation.value,
      propertyClass: propertyClass.value,
      conditions: { ...conditions.value },
      results: {
        preload: preloadResult.value.value,
        stress: stressResult.value?.value.von_mises
      }
    },
  })
}

function exportCAD() {
  if (!selectedBolt.value) return
  
  const cadScript = exportBoltAssemblyToSTEP(
    selectedBolt.value,
    20,  // 假设板厚20mm
    2
  )
  
  // 创建下载
  const blob = new Blob([cadScript], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bolt_assembly_${selectedBolt.value.designation}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function printReport() {
  window.print()
}

function applyBoltPreset(presetKey: string) {
  const preset = boltPresets.find((item) => item.key === presetKey)
  if (!preset) return

  selectedDesignation.value = preset.designation
  propertyClass.value = preset.propertyClass
  conditions.value = { ...preset.conditions }
  activeFormulaSection.value = '预紧力与一次应力'
}

function resetBoltInputs() {
  selectedDesignation.value = defaultBoltSelection
  propertyClass.value = defaultPropertyClass
  conditions.value = { ...defaultConditions }
  activeFormulaSection.value = '预紧力与一次应力'
}

function applyRecommendedTorqueValue() {
  conditions.value = {
    ...conditions.value,
    torque: recommendedTorque.value,
  }
}

function applyBoltLaunchPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return false

  const record = payload as Record<string, unknown>
  let applied = false

  if (typeof record.designation === 'string' && record.designation) {
    selectedDesignation.value = record.designation
    applied = true
  }
  if (typeof record.propertyClass === 'string' && record.propertyClass) {
    propertyClass.value = record.propertyClass
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
    activeFormulaSection.value = '预紧力与一次应力'
  }

  return applied
}

onMounted(async () => {
  const db = getElectronDb()
  if (!db) {
    boltList.value = fallbackBolts
    runtimeMode.value = 'fallback'
    runtimeNotice.value = '数据库接口未就绪，当前螺栓规格来自本地 JSON 回退数据，可用于基础连接筛查。'
    checkFavorite(favoriteId.value)
    const launch = consumeToolLaunchPayload('bolts')
    if (launch && applyBoltLaunchPayload(launch.payload)) {
      feedback.info(`已恢复${launch.sourceLabel ?? '上次'}参数`)
      checkFavorite(favoriteId.value)
    }
    return
  }
  try {
    const bolts = await db.queryBolts()
    boltList.value = bolts?.length ? bolts : fallbackBolts
    if (!bolts?.length) {
      runtimeMode.value = 'fallback'
      runtimeNotice.value = 'SQLite 中未读取到螺栓数据，已切换到本地 JSON 回退规格集。'
    }
    checkFavorite(favoriteId.value)
    const launch = consumeToolLaunchPayload('bolts')
    if (launch && applyBoltLaunchPayload(launch.payload)) {
      feedback.info(`已恢复${launch.sourceLabel ?? '上次'}参数`)
      checkFavorite(favoriteId.value)
    }
  } catch (err) {
    console.error('Failed to load bolts:', err)
    boltList.value = fallbackBolts
    runtimeMode.value = 'fallback'
    runtimeNotice.value = '螺栓数据库读取失败，已切换到本地 JSON 回退规格集。'
    const launch = consumeToolLaunchPayload('bolts')
    if (launch && applyBoltLaunchPayload(launch.payload)) {
      feedback.info(`已恢复${launch.sourceLabel ?? '上次'}参数`)
      checkFavorite(favoriteId.value)
    }
  }
})

watch(favoriteId, (id) => {
  checkFavorite(id)
})

const runtimeDetails = computed(() => {
  if (!runtimeNotice.value) return []
  return [
    '当前回退只影响规格主数据来源，不会阻断预紧力、等效应力和 VDI 2230 近似筛查公式。',
    '治理来源链会退回到仓库内置快照，正式选型仍建议回到实际标准或厂商目录复核。',
  ]
})
</script>

<template>
  <div class="bolts-page">
    <PageToolbar title="MechBox" subtitle="螺栓连接模块">
      <a-space>
        <a-button size="small" @click="resetBoltInputs">
          <template #icon><UndoOutlined /></template>恢复默认
        </a-button>
        <a-button size="small" :disabled="!stressResult" @click="syncToProject">
          <template #icon><SaveOutlined /></template>写入项目
        </a-button>
        <a-button 
          size="small" 
          type="default"
          @click="handleToggleFavorite"
        >
          <template #icon>
            <StarTwoTone v-if="isFavorited" two-tone-color="#faad14" />
            <StarOutlined v-else />
          </template>
          {{ isFavorited ? '已收藏' : '收藏' }}
        </a-button>
        <a-button size="small" type="primary" :disabled="isExporting || !stressResult" @click="handleExportPdf">
          <template #icon><FilePdfOutlined /></template>创建PDF
        </a-button>
        <a-button size="small" :disabled="!selectedBolt" @click="exportCAD">
          <template #icon><DownloadOutlined /></template>导出CAD
        </a-button>
        <a-button size="small" @click="printReport">
          <template #icon><PrinterOutlined /></template>打印报告
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <DatabaseRuntimeBanner
        v-if="runtimeNotice"
        :mode="runtimeMode"
        :message="runtimeNotice"
        :details="runtimeDetails"
      />
      <ToolPageLayout>
        <template #side>
          <ToolPresetBar
            title="常用连接预设"
            description="先套典型连接场景，再根据载荷和摩擦条件做二次修正。"
            :presets="boltPresets"
            :active-key="activePresetKey"
            @apply="applyBoltPreset"
            @reset="resetBoltInputs"
          />
          <a-card title="螺栓选型与工况" size="small">
            <a-form layout="vertical">
              <a-form-item label="选择螺栓规格">
                <a-select v-model:value="selectedDesignation" show-search style="width: 100%">
                  <a-select-option v-for="b in boltList" :key="b.designation" :value="b.designation">
                    {{ b.designation }} (d={{ b.nominal_d }}mm, 对边={{ b.head_width_s }}mm)
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="性能等级">
                <a-select v-model:value="propertyClass" style="width: 100%">
                  <a-select-option value="4.8">4.8级 (一般结构)</a-select-option>
                  <a-select-option value="8.8">8.8级 (机械结构最常用)</a-select-option>
                  <a-select-option value="10.9">10.9级 (高强度连接)</a-select-option>
                  <a-select-option value="12.9">12.9级 (极高强度)</a-select-option>
                </a-select>
              </a-form-item>

              <a-divider>工况载荷</a-divider>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="轴向载荷 (kN)">
                    <a-input-number v-model:value="conditions.axialForce" :status="inputErrors.axialForce ? 'error' : ''" style="width: 100%" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="剪切载荷 (kN)">
                    <a-input-number v-model:value="conditions.shearForce" :status="inputErrors.shearForce ? 'error' : ''" style="width: 100%" :min="0" />
                  </a-form-item>
                </a-col>
              </a-row>

              <a-divider>预紧参数</a-divider>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="预紧扭矩 (N·m)">
                    <a-input-number v-model:value="conditions.torque" :status="inputErrors.torque ? 'error' : ''" style="width: 100%" :min="0" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="扭矩系数 K">
                    <a-input-number v-model:value="conditions.torqueCoeff" :status="inputErrors.torqueCoeff ? 'error' : ''" style="width: 100%" :min="0.1" :max="0.3" :step="0.01" />
                    <div class="hint">干摩擦≈0.2, 润滑≈0.1~0.15</div>
                  </a-form-item>
                </a-col>
              </a-row>
              <a-button block size="small" style="margin-top: 8px" @click="applyRecommendedTorqueValue">
                套用当前等级推荐扭矩
              </a-button>
            </a-form>
          </a-card>

          <ProjectContextCard
            :active-project="activeProject"
            current-module="bolts"
            current-module-label="螺栓连接"
            :metrics="projectMetrics"
            note="写入项目会同步记录当前预紧与应力结果，便于后续在项目中心和报告中心统一回溯。"
          />
        </template>

        <template #main>
          <AlertStack v-if="!isValid" :items="validationAlerts" class="inline-validation" />

          <a-card title="螺栓参数与强度校核" size="small" v-if="selectedBolt && stressResult">
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
            <a-descriptions bordered size="small" :column="2" title="螺栓规格参数">
              <a-descriptions-item label="规格">{{ selectedBolt.designation }}</a-descriptions-item>
              <a-descriptions-item label="标准">{{ selectedBolt.standard_id || 'std_gbt_5782' }}</a-descriptions-item>
              <a-descriptions-item label="公称直径">{{ nominalDiameter.toFixed(1) }} mm</a-descriptions-item>
              <a-descriptions-item label="应力截面积">{{ stressArea.toFixed(1) }} mm²</a-descriptions-item>
              <a-descriptions-item label="对边宽度">{{ selectedBolt.head_width_s }} mm</a-descriptions-item>
              <a-descriptions-item label="头部高度">{{ selectedBolt.head_height_k }} mm</a-descriptions-item>
            </a-descriptions>

            <a-divider />

            <div class="result-section">
                <div class="result-column-header">预紧力计算</div>
              <div class="result-grid">
                <div class="res-label">预紧扭矩</div>
                <div class="res-value">{{ conditions.torque }} N·m</div>
                <div class="res-label">计算预紧力</div>
                <div class="res-value">{{ preloadResult.value.toFixed(2) }} kN</div>
                <div class="res-label">推荐预紧扭矩 ({{ propertyClass }}级)</div>
                <div class="res-value">{{ recommendedTorque }} N·m</div>
              </div>
              <div class="section-actions">
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '预紧力与一次应力' }" @click="activeFormulaSection = '预紧力与一次应力'">查看预紧公式</button>
              </div>
            </div>

            <a-divider />

            <div class="result-section">
              <div class="result-column-header">强度校核结果</div>
              <div class="result-grid">
                <div class="res-label">拉伸应力</div>
                <div class="res-value">{{ stressResult.value.tensile_stress.toFixed(1) }} MPa</div>
                <div class="res-label">剪切应力</div>
                <div class="res-value">{{ stressResult.value.shear_stress.toFixed(1) }} MPa</div>
                <div class="res-label">von Mises 等效应力</div>
                <div class="res-value" :class="{ error: stressResult.value.von_mises > 640 }">
                  {{ stressResult.value.von_mises.toFixed(1) }} MPa
                </div>
              </div>

              <AlertStack :items="stressAlerts" />
              <div class="section-actions">
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '强度判据' }" @click="activeFormulaSection = '强度判据'">查看强度判据</button>
              </div>
            </div>

            <a-divider />

            <!-- VDI 2230 近似校核 (Section 10.3) -->
            <div v-if="vdi2230Result" class="result-section">
              <div class="result-column-header">VDI 2230 近似校核</div>
              <div class="result-grid">
                <div class="res-label">屈服安全系数</div>
                <div class="res-value" :class="{ error: vdi2230Result.value.yieldSafety < 1.5 }">{{ vdi2230Result.value.yieldSafety.toFixed(2) }}</div>
                <div class="res-label">沉降损失</div>
                <div class="res-value">{{ vdi2230Result.value.settlingLoss.toFixed(2) }} kN</div>
                <div class="res-label">残余夹紧力</div>
                <div class="res-value" :class="{ error: vdi2230Result.value.residualClampForce < 0 }">{{ vdi2230Result.value.residualClampForce.toFixed(2) }} kN</div>
              </div>

              <AlertStack :items="vdi2230Result.value.warnings" />
              <div class="section-actions">
                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === 'VDI 2230 近似筛查' }" @click="activeFormulaSection = 'VDI 2230 近似筛查'">查看 VDI 近似公式</button>
              </div>
            </div>

            <a-divider />

            <a-descriptions bordered size="small" :column="1" title="参考信息">
              <a-descriptions-item label="性能等级参数">
                <a-space direction="vertical">
                  <div><InfoCircleOutlined /> 当前 {{ propertyClass }}级: 抗拉 {{ propertyClassMeta.tensileStrength }} MPa, 屈服 {{ propertyClassMeta.yieldStrength }} MPa</div>
                  <div><InfoCircleOutlined /> 4.8级: 抗拉400MPa, 屈服320MPa</div>
                  <div><InfoCircleOutlined /> 8.8级: 抗拉800MPa, 屈服640MPa</div>
                  <div><InfoCircleOutlined /> 10.9级: 抗拉1000MPa, 屈服900MPa</div>
                  <div><InfoCircleOutlined /> 12.9级: 抗拉1200MPa, 屈服1080MPa</div>
                </a-space>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
          <CalculationDecisionPanel
            v-if="decisionPanel"
            title="连接判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
          <FormulaPanel v-if="selectedBolt && stressResult" v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
          <a-empty v-else :description="emptyDescription" />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.bolts-page { font-size: 12px; }
/* 使用全局统一样式 */

.hint { font-size: 11px; color: #888; margin-top: 4px; }
</style>
