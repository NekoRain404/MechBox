<script setup lang="ts">
/**
 * MaterialSubstitutionPage.vue - 跨国材料代换指南
 * 当前基于本地材料力学性能 + 外部体系映射做筛选级推荐
 */
import { ref, computed, onMounted } from 'vue'
import DatabaseRuntimeBanner from '../components/DatabaseRuntimeBanner.vue'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import AlertStack from '../components/AlertStack.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import StateEmpty from '../components/StateEmpty.vue'
import ProjectContextCard from '../components/ProjectContextCard.vue'
import { FilePdfOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { usePdfExport } from '../composables/usePdfExport'
import { useActiveProject } from '../composables/useActiveProject'
import { useWorkflowRecorder } from '../composables/useWorkflowRecorder'
import { useAppFeedback } from '../composables/useAppFeedback'
import { getElectronDb } from '../utils/electron-db'
import { getReportModuleMeta } from '../utils/reporting'

type TargetSystem = 'ASTM' | 'DIN' | 'JIS'

interface MaterialRecord {
  material_id: string
  grade_code: string
  grade_name: string
  material_family: string
  heat_treatment_state?: string
  density: number
  elastic_modulus: number
  shear_modulus?: number
  yield_strength: number
  tensile_strength: number
  elongation?: number
  temp_min?: number
  temp_max?: number
  notes?: string
}

interface MaterialEquivalent {
  relation_id: number
  material_id: string
  external_system_code?: TargetSystem
  external_grade_code?: string
  equivalence_level: 'exact' | 'near' | 'reference'
  note?: string
}

interface SubstitutionCandidate extends MaterialRecord {
  targetEquivalent?: MaterialEquivalent
  yieldDiff: number
  tensileDiff: number
  elongationDiff: number | null
  matchScore: number
  sameFamily: boolean
  temperatureCoverage: 'covered' | 'partial' | 'unknown'
}

const materials = ref<MaterialRecord[]>([])
const equivalents = ref<MaterialEquivalent[]>([])
const selectedMaterial = ref('')
const targetSystem = ref<TargetSystem>('ASTM')
const preferSameFamily = ref(true)
const runtimeNotice = ref('')
const runtimeMode = ref<'fallback' | 'partial' | 'missing'>('missing')
const { activeProject } = useActiveProject()
const { recordModuleCalculation } = useWorkflowRecorder()
const feedback = useAppFeedback()
const reportMeta = getReportModuleMeta('material-sub')

onMounted(async () => {
  const db = getElectronDb()
  if (!db) {
    runtimeNotice.value = '数据库接口未就绪，材料代换需要读取 SQLite 材料表与体系映射表。当前浏览器环境无法提供完整代换链。'
    return
  }
  try {
    const [mats, eqs] = await Promise.all([
      db.queryMaterials(),
      db.queryMaterialEquivalents(),
    ])
    materials.value = mats || []
    equivalents.value = eqs || []
    if (materials.value.length > 0) {
      selectedMaterial.value = materials.value[0].material_id
    } else {
      runtimeNotice.value = '当前未读取到材料主数据，无法生成代换候选。'
    }
  } catch (err) {
    console.error('Failed to load materials:', err)
    runtimeNotice.value = '材料代换数据读取失败，请检查 Electron 数据库初始化与材料映射导入。'
  }
})

const currentMat = computed(() => materials.value.find((m) => m.material_id === selectedMaterial.value))
const equivalentMap = computed(() => {
  const map = new Map<string, MaterialEquivalent[]>()
  for (const item of equivalents.value) {
    const current = map.get(item.material_id) ?? []
    current.push(item)
    map.set(item.material_id, current)
  }
  return map
})

function getEquivalent(materialId: string, system: TargetSystem) {
  return equivalentMap.value.get(materialId)?.find((item) => item.external_system_code === system)
}

function resolveTemperatureCoverage(source: MaterialRecord, candidate: MaterialRecord): 'covered' | 'partial' | 'unknown' {
  if (
    source.temp_min == null ||
    source.temp_max == null ||
    candidate.temp_min == null ||
    candidate.temp_max == null
  ) {
    return 'unknown'
  }
  if (candidate.temp_min <= source.temp_min && candidate.temp_max >= source.temp_max) {
    return 'covered'
  }
  return 'partial'
}

const currentTargetEquivalent = computed(() => {
  if (!currentMat.value) return null
  return getEquivalent(currentMat.value.material_id, targetSystem.value) ?? null
})
const projectMetrics = computed(() => {
  const best = substitutions.value[0]
  if (!currentMat.value) return []
  return [
    { label: '当前材料', value: currentMat.value.grade_code },
    { label: '目标体系', value: targetSystem.value },
    { label: '最佳匹配', value: best ? `${best.grade_code} (${best.matchScore.toFixed(0)}%)` : '未形成' },
  ]
})

const substitutions = computed<SubstitutionCandidate[]>(() => {
  if (!currentMat.value) return []
  const mat = currentMat.value

  if (!mat.yield_strength || !mat.tensile_strength) return []

  return materials.value
    .filter((candidate) => candidate.material_id !== mat.material_id)
    .map((candidate) => {
      const yieldDiff = ((candidate.yield_strength - mat.yield_strength) / mat.yield_strength) * 100
      const tensileDiff = ((candidate.tensile_strength - mat.tensile_strength) / mat.tensile_strength) * 100
      const elongationDiff =
        mat.elongation && candidate.elongation != null
          ? ((candidate.elongation - mat.elongation) / mat.elongation) * 100
          : null
      const sameFamily = candidate.material_family === mat.material_family
      const targetEquivalent = getEquivalent(candidate.material_id, targetSystem.value)
      const temperatureCoverage = resolveTemperatureCoverage(mat, candidate)

      const scorePenalty =
        Math.abs(yieldDiff) * 0.55 +
        Math.abs(tensileDiff) * 0.35 +
        Math.abs(elongationDiff ?? 0) * 0.1 +
        (preferSameFamily.value && !sameFamily ? 10 : 0) +
        (temperatureCoverage === 'partial' ? 8 : 0) +
        (temperatureCoverage === 'unknown' ? 3 : 0) +
        (targetEquivalent ? 0 : 25)

      return {
        ...candidate,
        targetEquivalent,
        yieldDiff,
        tensileDiff,
        elongationDiff,
        sameFamily,
        temperatureCoverage,
        matchScore: Math.max(0, 100 - scorePenalty),
      }
    })
    .filter((candidate) => candidate.targetEquivalent)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5)
})

const pageAlerts = computed(() => {
  const alerts: Array<{ level: 'warning' | 'info'; message: string; description: string }> = []

  if (!currentTargetEquivalent.value && currentMat.value) {
    alerts.push({
      level: 'warning',
      message: `当前材料缺少 ${targetSystem.value} 体系映射`,
      description: '结果仍可做强度相近推荐，但无法给出当前材料在目标体系下的参考牌号。',
    })
  }

  if (!substitutions.value.length && currentMat.value) {
    alerts.push({
      level: 'warning',
      message: `未找到可用的 ${targetSystem.value} 候选材料`,
      description: '当前本地库只会保留在目标体系下已有映射的候选材料。',
    })
  } else if (substitutions.value.length) {
    alerts.push({
      level: 'info',
      message: `当前推荐按 ${targetSystem.value} 体系输出外部对照牌号`,
      description: '排序权重综合了屈服、抗拉、延伸率、材料族一致性和温度覆盖范围。',
    })
  }

  return alerts
})

const decisionPanel = computed(() => {
  if (!currentMat.value) {
    return {
      conclusion: '请选择原材料后再生成代换建议。',
      status: 'info' as const,
      risks: [],
      actions: ['先选定当前材料牌号，再指定目标体系。'],
      boundaries: ['当前代换结果依赖本地材料库和外部体系映射表。'],
    }
  }

  const best = substitutions.value[0]
  if (!best) {
    return {
      conclusion: `当前库中没有满足 ${targetSystem.value} 体系映射条件的可用候选。`,
      status: 'warning' as const,
      risks: ['目标体系缺少候选映射，无法形成可追溯的对照推荐。'],
      actions: ['补充该体系下的材料映射表，或放宽到仅做强度相近筛选。'],
      boundaries: [
        '当前推荐只会输出存在外部体系映射的候选材料。',
        '材料化学成分、焊接性和热处理工艺仍需人工复核。',
      ],
    }
  }

  const status: 'success' | 'info' | 'warning' | 'error' =
    best.matchScore >= 88 ? 'success' : best.matchScore >= 75 ? 'info' : best.matchScore >= 60 ? 'warning' : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (!best.sameFamily) {
    risks.push('最佳候选与当前材料不属于同一材料族，替换后的工艺路线可能变化。')
    actions.push('优先复核热处理状态、切削性和焊接性，确认替换后的制造路线。')
  }
  if (Math.abs(best.yieldDiff) > 15 || Math.abs(best.tensileDiff) > 15) {
    risks.push('最佳候选的强度偏差已超过 15%，不能视为直接等效替代。')
    actions.push('对载荷工况重新做强度校核，再决定是否允许代换。')
  }
  if (best.temperatureCoverage === 'partial') {
    risks.push('候选材料的温度覆盖范围未完全包络当前材料使用区间。')
    actions.push('复核低温脆性或高温强度衰减，再确认服役边界。')
  }
  if (best.elongationDiff != null && Math.abs(best.elongationDiff) > 20) {
    risks.push('延伸率差异较大，塑性和成形行为可能显著不同。')
  }

  return {
    conclusion: `优先候选为 ${best.grade_code}，在 ${targetSystem.value} 体系下对应 ${best.targetEquivalent?.external_grade_code ?? '未标注'}，综合匹配度 ${best.matchScore.toFixed(0)}%。`,
    status,
    risks,
    actions: actions.length
      ? actions
      : ['在进入工程使用前，补做化学成分、热处理状态和耐温边界复核。'],
    boundaries: [
      '当前排序主要依据力学性能接近度、材料族一致性和温度范围，不等同于正式材料等效认证。',
      '如果设计受腐蚀介质、疲劳寿命或焊接要求约束，仍需独立校核。',
    ],
  }
})

const { isExporting, exportPdf } = usePdfExport()

async function handleExportPdf() {
  await exportPdf({
    selector: '.material-substitution-page',
    filename: `MechBox-Material-Substitution-${currentMat.value?.grade_code ?? 'report'}-${targetSystem.value}`,
    reportRecord: currentMat.value
      ? {
          title: `材料代换 ${currentMat.value.grade_code} ${targetSystem.value}报告`,
          module: 'material-sub',
          projectNumber: activeProject.value?.id ?? currentMat.value.grade_code,
          projectId: activeProject.value?.id,
          projectName: activeProject.value?.name,
          standardRef: reportMeta.standardRef,
          author: '系统',
          summary: buildProjectSummary(),
        }
      : undefined,
    onSuccess: () => {
      feedback.notifyExported('材料代换 PDF')
    },
  })
}

function buildProjectSummary() {
  if (!currentMat.value) return '材料代换结果尚未形成。'
  const best = substitutions.value[0]
  if (!best) {
    return `材料 ${currentMat.value.grade_code} 在 ${targetSystem.value} 体系下暂未找到可追溯候选。`
  }
  return `材料 ${currentMat.value.grade_code} 在 ${targetSystem.value} 体系下优先候选为 ${best.grade_code}/${best.targetEquivalent?.external_grade_code ?? '未标注'}，匹配度 ${best.matchScore.toFixed(0)}%，屈服差异 ${best.yieldDiff.toFixed(1)}%，抗拉差异 ${best.tensileDiff.toFixed(1)}%。`
}

async function syncToProject() {
  if (!currentMat.value) {
    feedback.warning('当前结果尚未形成，无法写入项目')
    return
  }
  if (!activeProject.value) {
    feedback.warning('当前没有活动项目，无法写入摘要')
    return
  }

  await recordModuleCalculation({
    module: 'material-sub',
    name: `材料代换 ${currentMat.value.grade_code} -> ${targetSystem.value}`,
    projectSummary: buildProjectSummary(),
    inputData: {
      selectedMaterial: currentMat.value,
      targetSystem: targetSystem.value,
      preferSameFamily: preferSameFamily.value,
    },
    contextData: {
      currentTargetEquivalent: currentTargetEquivalent.value,
      pageAlerts: pageAlerts.value,
    },
    outputData: {
      substitutions: substitutions.value,
      bestCandidate: substitutions.value[0] ?? null,
    },
    recentData: {
      selectedMaterial: currentMat.value.grade_code,
      targetSystem: targetSystem.value,
      bestCandidate: substitutions.value[0]?.grade_code ?? null,
      matchScore: substitutions.value[0]?.matchScore ?? null,
    },
    decisionData: decisionPanel.value,
    resultKind: 'recommendation',
    derivedMetrics: {
      bestMatchScore: substitutions.value[0]?.matchScore ?? 0,
      candidateCount: substitutions.value.length,
    },
  })
  feedback.notifySaved('项目摘要')
}

const runtimeDetails = computed(() => {
  if (!runtimeNotice.value) return []
  return [
    '当前页依赖材料主表和材料体系映射表，两者缺一都会削弱代换推荐的可追溯性。',
    '为了避免伪造候选，缺库时页面只提示边界，不输出看似正式的代换结论。',
  ]
})
</script>

<template>
  <div class="material-substitution-page">
    <PageToolbar title="MechBox" subtitle="跨国材料代换指南">
      <a-space>
        <a-button size="small" :disabled="!currentMat" @click="syncToProject">
          <template #icon><SaveOutlined /></template>写入项目
        </a-button>
        <a-button size="small" type="primary" @click="handleExportPdf" :disabled="isExporting">
          <template #icon><FilePdfOutlined /></template>导出PDF
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
          <a-card title="代换条件" size="small">
            <a-form layout="vertical">
              <a-form-item label="当前材料">
                <a-select v-model:value="selectedMaterial" style="width: 100%">
                  <a-select-option v-for="material in materials" :key="material.material_id" :value="material.material_id">
                    {{ material.grade_code }} ({{ material.material_family }})
                  </a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="目标体系">
                <a-select v-model:value="targetSystem" style="width: 100%">
                  <a-select-option value="ASTM">美标 ASTM</a-select-option>
                  <a-select-option value="DIN">德标 DIN</a-select-option>
                  <a-select-option value="JIS">日标 JIS</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="筛选偏好">
                <a-switch v-model:checked="preferSameFamily" checked-children="优先同材料族" un-checked-children="允许跨材料族" />
              </a-form-item>
            </a-form>
            <div class="section-note">
              当前页是筛选级代换工具，不会自动认定两种材料“正式等效”。目标体系会直接参与候选筛选和外部牌号展示。
            </div>
          </a-card>

          <a-card v-if="currentMat" title="目标体系映射" size="small">
            <a-descriptions bordered size="small" :column="1">
              <a-descriptions-item label="当前材料">{{ currentMat.grade_code }}</a-descriptions-item>
              <a-descriptions-item label="目标体系">{{ targetSystem }}</a-descriptions-item>
              <a-descriptions-item label="体系对照牌号">
                {{ currentTargetEquivalent?.external_grade_code ?? '未收录' }}
              </a-descriptions-item>
              <a-descriptions-item label="映射级别">
                <a-tag :color="currentTargetEquivalent?.equivalence_level === 'exact' ? 'green' : currentTargetEquivalent ? 'blue' : 'default'">
                  {{ currentTargetEquivalent?.equivalence_level ?? 'none' }}
                </a-tag>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <AlertStack :items="pageAlerts" />

          <ProjectContextCard
            :active-project="activeProject"
            current-module="material-sub"
            current-module-label="材料代换"
            :metrics="projectMetrics"
            note="写入项目会保留当前目标体系和最佳候选摘要，PDF 导出时会同步登记到报告中心。"
          />
        </template>

        <template #main>
          <StateEmpty
            v-if="!materials.length && runtimeNotice"
            title="代换数据未就绪"
            description="当前页面依赖 SQLite 材料主数据和体系映射表。在 Electron 桌面环境中启动后才能生成完整代换候选。"
          />
          <a-card title="当前材料性能" size="small" v-else-if="currentMat">
            <a-descriptions bordered size="small" :column="3">
              <a-descriptions-item label="牌号">{{ currentMat.grade_code }}</a-descriptions-item>
              <a-descriptions-item label="名称">{{ currentMat.grade_name }}</a-descriptions-item>
              <a-descriptions-item label="类别">{{ currentMat.material_family }}</a-descriptions-item>
              <a-descriptions-item label="热处理状态">{{ currentMat.heat_treatment_state || '—' }}</a-descriptions-item>
              <a-descriptions-item label="屈服强度">{{ currentMat.yield_strength }} MPa</a-descriptions-item>
              <a-descriptions-item label="抗拉强度">{{ currentMat.tensile_strength }} MPa</a-descriptions-item>
              <a-descriptions-item label="延伸率">{{ currentMat.elongation ?? '—' }}%</a-descriptions-item>
              <a-descriptions-item label="密度">{{ currentMat.density }} g/cm³</a-descriptions-item>
              <a-descriptions-item label="弹性模量">{{ currentMat.elastic_modulus }} MPa</a-descriptions-item>
              <a-descriptions-item label="使用温度" :span="2">{{ currentMat.temp_min ?? '—' }}°C ~ {{ currentMat.temp_max ?? '—' }}°C</a-descriptions-item>
              <a-descriptions-item label="备注" :span="3">{{ currentMat.notes || '—' }}</a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card v-if="materials.length" title="推荐代换材料" size="small">
            <a-table
              :columns="[
                { title: '匹配度', dataIndex: 'matchScore', key: 'matchScore', width: '12%' },
                { title: '牌号', dataIndex: 'grade_code', key: 'grade_code', width: '14%' },
                { title: `${targetSystem} 对照`, dataIndex: 'targetEquivalent', key: 'targetEquivalent', width: '16%' },
                { title: '屈服差异', dataIndex: 'yieldDiff', key: 'yieldDiff', width: '12%' },
                { title: '抗拉差异', dataIndex: 'tensileDiff', key: 'tensileDiff', width: '12%' },
                { title: '温度覆盖', dataIndex: 'temperatureCoverage', key: 'temperatureCoverage', width: '12%' },
                { title: '类别', dataIndex: 'material_family', key: 'material_family', width: '12%' },
                { title: '备注', dataIndex: 'notes', key: 'notes', width: '10%' }
              ]"
              :data-source="substitutions"
              :pagination="false"
              size="small"
              row-key="material_id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'matchScore'">
                  <a-tag :color="record.matchScore >= 88 ? 'green' : record.matchScore >= 75 ? 'blue' : record.matchScore >= 60 ? 'orange' : 'red'">
                    {{ record.matchScore.toFixed(0) }}%
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'targetEquivalent'">
                  <div>{{ record.targetEquivalent?.external_grade_code || '—' }}</div>
                  <a-tag size="small" :color="record.targetEquivalent?.equivalence_level === 'exact' ? 'green' : 'blue'">
                    {{ record.targetEquivalent?.equivalence_level || 'reference' }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'yieldDiff' || column.key === 'tensileDiff'">
                  <span :style="{ color: Math.abs(record[column.key]) > 15 ? '#ef4444' : Math.abs(record[column.key]) > 8 ? '#f59e0b' : '#22c55e' }">
                    {{ record[column.key] > 0 ? '+' : '' }}{{ record[column.key].toFixed(1) }}%
                  </span>
                </template>
                <template v-else-if="column.key === 'temperatureCoverage'">
                  <a-tag :color="record.temperatureCoverage === 'covered' ? 'green' : record.temperatureCoverage === 'partial' ? 'orange' : 'default'">
                    {{ record.temperatureCoverage === 'covered' ? '已覆盖' : record.temperatureCoverage === 'partial' ? '部分覆盖' : '未知' }}
                  </a-tag>
                </template>
              </template>
            </a-table>
            <div class="section-note">
              排序会优先保留在目标体系下已有映射的材料，再按照力学性能差异、材料族一致性和温度范围覆盖情况综合打分。
            </div>
          </a-card>

          <CalculationDecisionPanel
            v-if="materials.length"
            title="代换判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.material-substitution-page {
  max-width: 1280px;
  margin: 0 auto;
}
</style>
