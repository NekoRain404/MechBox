<script setup lang="ts">
/**
 * ReverseIdentifyPage.vue - 逆向识别向导页面
 * 通过测量值反推标准规格
 */
import { ref, computed } from 'vue'
import DatabaseRuntimeBanner from '../components/DatabaseRuntimeBanner.vue'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import StateEmpty from '../components/StateEmpty.vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { getElectronDb } from '../utils/electron-db'
import { fallbackBearings, fallbackBolts, fallbackThreads } from '../utils/local-standard-fallbacks'

type IdentifyType = 'thread' | 'bearing' | 'bolt'

const identifyType = ref<IdentifyType>('thread')
const measurements = ref<Record<string, number>>({
  outerDiameter: 10,
  pitch: 1.5,
})
const results = ref<any[]>([])
const isSearching = ref(false)
const hasSearched = ref(false)
const runtimeNotice = ref('')
const runtimeMode = ref<'fallback' | 'partial' | 'missing'>('fallback')

const measurementGuide: Record<IdentifyType, string> = {
  thread: '建议至少测量螺纹外径与螺距，若存在镀层或磨损，优先取平均值后再识别。',
  bearing: '建议测量内径、外径和宽度三个特征，带密封圈或防尘盖时避免把外侧非功能尺寸算入。',
  bolt: '建议测量公称直径、对边宽度和头部高度，异形头或带法兰结构会降低匹配可信度。',
}

const resultRows = computed(() =>
  results.value.map((item, index) => ({
    ...item,
    rank: index + 1,
    details:
      identifyType.value === 'thread'
        ? `d=${item.d} mm, P=${item.pitch} mm, d2=${item.d2?.toFixed(2)} mm`
        : identifyType.value === 'bearing'
          ? `d=${item.inner_diameter} mm, D=${item.outer_diameter} mm, B=${item.width} mm`
          : `d=${item.d} mm, s=${item.head_width_s} mm, k=${item.head_height_k} mm`,
  })),
)

const topResult = computed(() => resultRows.value[0] ?? null)
const runtimeDetails = computed(() => {
  if (!runtimeNotice.value) return []
  if (runtimeMode.value === 'fallback') {
    return [
      '当前逆向识别改用仓库内置的 ISO 螺纹、深沟球轴承和六角螺栓 JSON 回退数据。',
      '识别结果仍可用于缩小规格范围，但应回到正式标准或目录复核精度等级和版本。',
    ]
  }
  return [
    '主数据读取失败后已自动切换到本地回退表，页面不会静默失败。',
    '若要恢复完整 SQLite 识别链，请在 Electron 运行时检查数据库初始化与 IPC 状态。',
  ]
})

const decisionPanel = computed(() => {
  if (!hasSearched.value) {
    return {
      conclusion: '输入测量值后执行识别，系统会返回最接近的标准规格候选。',
      status: 'info' as const,
      risks: [],
      actions: ['优先使用卡尺或千分尺复测关键尺寸，再执行识别。'],
      boundaries: ['当前识别范围仅覆盖本地标准库中的螺纹、轴承和六角螺栓。'],
    }
  }

  if (!topResult.value) {
    return {
      conclusion: '当前测量值没有匹配到候选规格。',
      status: 'warning' as const,
      risks: ['测量值可能偏离标准系列，或当前零件不在本地标准库覆盖范围内。'],
      actions: ['复测关键尺寸并确认单位为 mm。', '尝试增加第二特征尺寸，避免仅凭单一尺寸识别。'],
      boundaries: ['系统不会自动识别非标件、磨损件或带特殊改型的零件。'],
    }
  }

  const diff = Number(topResult.value.diff ?? 0)
  const status: 'success' | 'info' | 'warning' | 'error' =
    diff <= 0.3 ? 'success' : diff <= 1 ? 'info' : diff <= 2 ? 'warning' : 'error'

  const risks: string[] = []
  const actions: string[] = []

  if (diff > 1) {
    risks.push(`首选候选的综合差异值为 ${diff.toFixed(2)}，尺寸偏差已较明显。`)
    actions.push('优先复测最敏感尺寸，再确认是否存在表面处理层、磨损或测量基准误差。')
  }
  if (results.value.length > 1 && diff > Number(results.value[1]?.diff ?? diff + 1) - 0.2) {
    risks.push('前两名候选差异接近，存在规格误判风险。')
    actions.push('增加一个辅助特征尺寸，例如螺纹中径、轴承倒角或螺栓长度。')
  }

  return {
    conclusion: `当前最可能的${identifyType.value === 'thread' ? '螺纹' : identifyType.value === 'bearing' ? '轴承' : '螺栓'}规格为 ${topResult.value.designation}，综合差异值 ${diff.toFixed(2)}。`,
    status,
    risks,
    actions: actions.length ? actions : ['可以将首选候选作为复核起点，再结合功能尺寸进一步确认。'],
    boundaries: [
      '差异值越小越接近，但不等于自动通过正式检验。',
      '识别结果只基于当前录入的几何特征，不包含材料、精度等级和表面处理信息。',
    ],
  }
})

async function runIdentification() {
  isSearching.value = true
  hasSearched.value = true
  try {
    const db = getElectronDb()
    if (!db) {
      runtimeMode.value = 'fallback'
      runtimeNotice.value = '未检测到 Electron SQLite 接口，当前识别已切换到本地标准 JSON 回退模式。'
      results.value = runFallbackIdentification()
      return
    }

    const res = await db.reverseIdentify(identifyType.value, measurements.value)
    results.value = res || []
    runtimeNotice.value = ''
  } catch (err) {
    console.error('Reverse identification failed:', err)
    runtimeMode.value = 'partial'
    runtimeNotice.value = 'SQLite 逆向识别失败，当前已自动回退到本地标准数据继续输出候选。'
    results.value = runFallbackIdentification()
  } finally {
    isSearching.value = false
  }
}

function onTypeChange() {
  results.value = []
  hasSearched.value = false
  if (identifyType.value === 'thread') {
    measurements.value = { outerDiameter: 10, pitch: 1.5 }
  } else if (identifyType.value === 'bearing') {
    measurements.value = { id: 25, od: 52, width: 15 }
  } else {
    measurements.value = { d: 10, headWidth: 17, headHeight: 6.4 }
  }
}

function runFallbackIdentification() {
  if (identifyType.value === 'thread') {
    const { outerDiameter = 0, pitch = 0 } = measurements.value
    return [...fallbackThreads]
      .map((item) => ({
        ...item,
        d: item.nominal_d,
        d2: item.pitch_diameter,
        diff: Math.abs(Number(item.nominal_d ?? 0) - outerDiameter) + Math.abs(Number(item.pitch ?? 0) - pitch),
      }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 5)
  }

  if (identifyType.value === 'bearing') {
    const { id = 0, od = 0, width = 0 } = measurements.value
    return [...fallbackBearings]
      .map((item) => ({
        ...item,
        diff:
          Math.abs(Number(item.inner_diameter ?? 0) - id) +
          Math.abs(Number(item.outer_diameter ?? 0) - od) +
          Math.abs(Number(item.width ?? 0) - width),
      }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 5)
  }

  const { d = 0, headWidth = 0, headHeight = 0 } = measurements.value
  return [...fallbackBolts]
    .map((item) => ({
      ...item,
      d: item.nominal_d,
      diff:
        Math.abs(Number(item.nominal_d ?? 0) - d) +
        Math.abs(Number(item.head_width_s ?? 0) - headWidth) +
        Math.abs(Number(item.head_height_k ?? 0) - headHeight),
    }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 5)
}
</script>

<template>
  <div class="reverse-identify-page">
    <PageToolbar title="MechBox" subtitle="逆向识别向导" />

    <div class="content-body">
      <DatabaseRuntimeBanner
        v-if="runtimeNotice"
        :mode="runtimeMode"
        :message="runtimeNotice"
        :details="runtimeDetails"
      />
      <ToolPageLayout>
        <template #side>
          <a-card title="测量输入" size="small">
            <a-form layout="vertical">
              <a-form-item label="零件类型">
                <a-radio-group v-model:value="identifyType" @change="onTypeChange">
                  <a-radio-button value="thread">螺纹</a-radio-button>
                  <a-radio-button value="bearing">轴承</a-radio-button>
                  <a-radio-button value="bolt">螺栓</a-radio-button>
                </a-radio-group>
              </a-form-item>

              <template v-if="identifyType === 'thread'">
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="外径 (mm)">
                      <a-input-number v-model:value="measurements.outerDiameter" :min="1" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="螺距 (mm)">
                      <a-input-number v-model:value="measurements.pitch" :min="0.1" :step="0.1" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                </a-row>
              </template>

              <template v-else-if="identifyType === 'bearing'">
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="内径 (mm)">
                      <a-input-number v-model:value="measurements.id" :min="1" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="外径 (mm)">
                      <a-input-number v-model:value="measurements.od" :min="1" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="宽度 (mm)">
                      <a-input-number v-model:value="measurements.width" :min="1" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                </a-row>
              </template>

              <template v-else>
                <a-row :gutter="12">
                  <a-col :span="8">
                    <a-form-item label="公称直径 d (mm)">
                      <a-input-number v-model:value="measurements.d" :min="1" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="对边宽度 (mm)">
                      <a-input-number v-model:value="measurements.headWidth" :min="1" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="头部高度 (mm)">
                      <a-input-number v-model:value="measurements.headHeight" :min="1" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                </a-row>
              </template>

              <a-button type="primary" @click="runIdentification" :loading="isSearching">
                <template #icon><SearchOutlined /></template>识别规格
              </a-button>
            </a-form>
            <div class="section-note">
              {{ measurementGuide[identifyType] }}
            </div>
          </a-card>
        </template>

        <template #main>
          <a-card title="匹配结果" size="small">
            <a-table
              v-if="resultRows.length"
              :columns="[
                { title: '排名', dataIndex: 'rank', key: 'rank', width: '10%' },
                { title: '规格型号', dataIndex: 'designation', key: 'designation', width: '25%' },
                { title: '差异值', dataIndex: 'diff', key: 'diff', width: '15%' },
                { title: '详细信息', dataIndex: 'details', key: 'details', width: '50%' }
              ]"
              :data-source="resultRows"
              :pagination="false"
              size="small"
              row-key="rank"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'rank'">
                  <a-tag :color="record.rank === 1 ? 'green' : record.rank <= 3 ? 'blue' : 'default'">
                    #{{ record.rank }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'diff'">
                  <a-tag :color="record.diff <= 0.3 ? 'green' : record.diff <= 1 ? 'blue' : record.diff <= 2 ? 'orange' : 'red'">
                    {{ Number(record.diff).toFixed(2) }}
                  </a-tag>
                </template>
              </template>
            </a-table>
            <StateEmpty v-else :description="hasSearched ? '未找到匹配规格' : '输入测量值后开始识别'" />
          </a-card>

          <CalculationDecisionPanel
            title="识别判断"
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
.reverse-identify-page {
  max-width: 1180px;
  margin: 0 auto;
}
</style>
