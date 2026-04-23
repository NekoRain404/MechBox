<script setup lang="ts">
/**
 * StandardPartsLibraryPage.vue - 标准件库页面
 * 包含：螺纹、螺母、垫圈、齿轮模数、O 型圈材料、制造商与厂商目录
 */
import { ref, onMounted, computed } from 'vue'
import DatabaseRuntimeBanner from '../components/DatabaseRuntimeBanner.vue'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { getElectronDb } from '../utils/electron-db'
import { fallbackThreads } from '../utils/local-standard-fallbacks'

type LibraryTab =
  | 'threads'
  | 'nuts'
  | 'washers'
  | 'gear-modules'
  | 'oring-materials'
  | 'manufacturers'
  | 'vendor-parts'

const activeTab = ref<LibraryTab>('threads')
const searchText = ref('')
const runtimeNotice = ref('')
const runtimeMode = ref<'fallback' | 'partial' | 'missing'>('partial')

const threads = ref<any[]>([])
const nuts = ref<any[]>([])
const washers = ref<any[]>([])
const gearModules = ref<any[]>([])
const oringMaterials = ref<any[]>([])
const manufacturers = ref<any[]>([])
const vendorParts = ref<any[]>([])

onMounted(async () => {
  const db = getElectronDb()
  if (!db) {
    threads.value = fallbackThreads
    runtimeMode.value = 'fallback'
    runtimeNotice.value = '数据库接口未就绪，当前仅展示本地线程回退数据；目录类与材料类标准件数据需在 Electron 中通过 SQLite 访问。'
    return
  }

  const results = await Promise.allSettled([
    db.queryThreads(),
    db.queryNuts(),
    db.queryWashers(),
    db.queryGearModules(),
    db.queryOringMaterials(),
    db.queryManufacturers(),
    db.queryVendorParts(),
  ])

  threads.value = results[0].status === 'fulfilled' && results[0].value?.length ? results[0].value : fallbackThreads
  nuts.value = results[1].status === 'fulfilled' ? results[1].value || [] : []
  washers.value = results[2].status === 'fulfilled' ? results[2].value || [] : []
  gearModules.value = results[3].status === 'fulfilled' ? results[3].value || [] : []
  oringMaterials.value = results[4].status === 'fulfilled' ? results[4].value || [] : []
  manufacturers.value = results[5].status === 'fulfilled' ? results[5].value || [] : []
  vendorParts.value = results[6].status === 'fulfilled' ? results[6].value || [] : []

  const degradedDomains: string[] = []
  if (results[0].status === 'rejected' || !results[0].value?.length) degradedDomains.push('螺纹回退')
  if (results[1].status === 'rejected') degradedDomains.push('螺母')
  if (results[2].status === 'rejected') degradedDomains.push('垫圈')
  if (results[3].status === 'rejected') degradedDomains.push('齿轮模数')
  if (results[4].status === 'rejected') degradedDomains.push('O 型圈材料')
  if (results[5].status === 'rejected') degradedDomains.push('制造商')
  if (results[6].status === 'rejected') degradedDomains.push('厂商零件')

  if (degradedDomains.length) {
    runtimeMode.value = 'partial'
    runtimeNotice.value = `部分标准件数据未能从 SQLite 读取：${degradedDomains.join('、')}。当前页面会优先展示可用数据，并在可回退的数据域中启用本地 JSON。`
  }
})

const runtimeDetails = computed(() => {
  if (!runtimeNotice.value) return []
  if (runtimeMode.value === 'fallback') {
    return [
      '当前浏览器预览只保留 ISO 螺纹本地 JSON 回退数据。',
      '螺母、垫圈、O 型圈材料、制造商与厂商零件仍依赖 Electron + SQLite。',
    ]
  }
  return [
    '已优先展示成功读取的数据域，失败的数据域不会阻断整个页面。',
    '对可回退的数据域会自动启用本地 JSON，其余域保持空集并明确提示。',
  ]
})

const manufacturerNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const manufacturer of manufacturers.value) {
    map.set(manufacturer.manufacturer_id, manufacturer.manufacturer_name)
  }
  return map
})

function includesSearch(values: Array<string | number | null | undefined>) {
  if (!searchText.value) return true
  const search = searchText.value.trim().toLowerCase()
  return values.some((value) => String(value ?? '').toLowerCase().includes(search))
}

const filteredThreads = computed(() =>
  threads.value.filter((item) =>
    includesSearch([item.designation, item.nominal_d, item.pitch, item.standard_id]),
  ),
)

const filteredNuts = computed(() =>
  nuts.value.filter((item) =>
    includesSearch([item.designation, item.nominal_d, item.pitch, item.material_code, item.standard_id]),
  ),
)

const filteredWashers = computed(() =>
  washers.value.filter((item) =>
    includesSearch([item.designation, item.nominal_d, item.material_code, item.finish_code, item.standard_id]),
  ),
)

const filteredGearModules = computed(() =>
  gearModules.value.filter((item) =>
    includesSearch([item.gear_type, item.module_value, item.module_system, item.note]),
  ),
)

const filteredOringMaterials = computed(() =>
  oringMaterials.value.filter((item) =>
    includesSearch([item.material_code, item.material_name, item.oil_resistance_rating, item.water_resistance_rating]),
  ),
)

const filteredManufacturers = computed(() =>
  manufacturers.value.filter((item) =>
    includesSearch([item.manufacturer_name, item.country_code, item.homepage_url, item.notes]),
  ),
)

const filteredVendorParts = computed(() =>
  vendorParts.value.filter((item) =>
    includesSearch([
      item.vendor_part_number,
      manufacturerNameMap.value.get(item.manufacturer_id),
      item.domain_code,
      item.description,
      item.status,
    ]),
  ),
)

const tabMeta = computed(() => ({
  threads: { label: '螺纹', count: filteredThreads.value.length, total: threads.value.length },
  nuts: { label: '六角螺母', count: filteredNuts.value.length, total: nuts.value.length },
  washers: { label: '平垫圈', count: filteredWashers.value.length, total: washers.value.length },
  'gear-modules': { label: '齿轮模数', count: filteredGearModules.value.length, total: gearModules.value.length },
  'oring-materials': { label: 'O 型圈材料', count: filteredOringMaterials.value.length, total: oringMaterials.value.length },
  manufacturers: { label: '制造商', count: filteredManufacturers.value.length, total: manufacturers.value.length },
  'vendor-parts': { label: '厂商零件', count: filteredVendorParts.value.length, total: vendorParts.value.length },
}))

const activeMeta = computed(() => tabMeta.value[activeTab.value])
const totalRecords = computed(
  () =>
    threads.value.length +
    nuts.value.length +
    washers.value.length +
    gearModules.value.length +
    oringMaterials.value.length +
    manufacturers.value.length +
    vendorParts.value.length,
)

const decisionPanel = computed(() => {
  const searchApplied = Boolean(searchText.value.trim())
  const hasResult = activeMeta.value.count > 0
  return {
    conclusion: searchApplied
      ? `当前在“${activeMeta.value.label}”中命中 ${activeMeta.value.count} 条记录，共检索 ${activeMeta.value.total} 条本地数据。`
      : `当前处于“${activeMeta.value.label}”视图，可浏览 ${activeMeta.value.total} 条本地标准或目录数据。`,
    status: (hasResult ? 'info' : 'warning') as 'info' | 'warning',
    risks: hasResult
      ? []
      : ['当前筛选条件下没有结果，可能是关键词过窄，或该类数据尚未完全覆盖。'],
    actions: searchApplied
      ? ['尝试改用标准号、规格尺寸或材料代号检索，以提高命中率。']
      : ['优先按标准号、规格和材料代号检索，可更快定位记录。'],
    boundaries: [
      '标准件库当前整合了标准参数表与厂家目录数据，两者不能默认等同于正式标准全文。',
      '厂商零件页更适合选型检索；正式设计仍应回到对应标准或型录校核。',
    ],
  }
})
</script>

<template>
  <div class="standard-parts-page">
    <PageToolbar title="MechBox" subtitle="标准件库" />

    <div class="content-body">
      <DatabaseRuntimeBanner
        v-if="runtimeNotice"
        :mode="runtimeMode"
        :message="runtimeNotice"
        :details="runtimeDetails"
      />
      <ToolPageLayout :input-span="8" :output-span="16">
        <template #side>
          <a-card title="检索条件" size="small">
            <a-form layout="vertical">
              <a-form-item label="关键词搜索">
                <a-input v-model:value="searchText" placeholder="搜索标准号、规格、材料、制造商">
                  <template #prefix><SearchOutlined /></template>
                </a-input>
              </a-form-item>
              <a-form-item label="当前数据域">
                <a-tag color="blue">{{ activeMeta.label }}</a-tag>
                <span style="margin-left: 8px; color: var(--text-secondary)">
                  {{ activeMeta.count }}/{{ activeMeta.total }} 条
                </span>
              </a-form-item>
            </a-form>
            <div class="section-note">
              搜索现在覆盖全部 tab，包括标准件参数、O 型圈材料、制造商和厂商零件目录。
            </div>
          </a-card>

          <a-card title="数据覆盖摘要" size="small">
            <a-row :gutter="[12, 12]">
              <a-col :span="12"><a-statistic title="总记录" :value="totalRecords" /></a-col>
              <a-col :span="12"><a-statistic title="螺纹" :value="threads.length" /></a-col>
              <a-col :span="12"><a-statistic title="螺母" :value="nuts.length" /></a-col>
              <a-col :span="12"><a-statistic title="垫圈" :value="washers.length" /></a-col>
              <a-col :span="12"><a-statistic title="O 型圈材料" :value="oringMaterials.length" /></a-col>
              <a-col :span="12"><a-statistic title="厂商零件" :value="vendorParts.length" /></a-col>
            </a-row>
          </a-card>

          <CalculationDecisionPanel
            title="检索判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
        </template>

        <template #main>
          <a-card :title="`${activeMeta.label} 数据`" size="small">
            <a-tabs v-model:activeKey="activeTab">
              <a-tab-pane key="threads" tab="螺纹">
                <a-table
                  :columns="[
                    { title: '规格', dataIndex: 'designation', key: 'designation', width: '18%' },
                    { title: '公称直径', dataIndex: 'nominal_d', key: 'nominal_d', width: '12%' },
                    { title: '螺距', dataIndex: 'pitch', key: 'pitch', width: '10%' },
                    { title: '大径', dataIndex: 'major_diameter', key: 'major_diameter', width: '12%' },
                    { title: '中径', dataIndex: 'pitch_diameter', key: 'pitch_diameter', width: '12%' },
                    { title: '小径', dataIndex: 'minor_diameter', key: 'minor_diameter', width: '12%' },
                    { title: '底孔', dataIndex: 'tap_drill', key: 'tap_drill', width: '10%' },
                    { title: '应力面积', dataIndex: 'stress_area', key: 'stress_area', width: '14%' }
                  ]"
                  :data-source="filteredThreads"
                  :pagination="{ pageSize: 15 }"
                  size="small"
                  row-key="thread_id"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="typeof column.key === 'string' && ['nominal_d', 'pitch', 'major_diameter', 'pitch_diameter', 'minor_diameter', 'tap_drill'].includes(column.key)">
                      {{ record[column.key] != null ? `${record[column.key].toFixed(3)} mm` : '—' }}
                    </template>
                    <template v-else-if="column.key === 'stress_area'">
                      {{ record.stress_area != null ? `${record.stress_area.toFixed(3)} mm²` : '—' }}
                    </template>
                  </template>
                </a-table>
              </a-tab-pane>

              <a-tab-pane key="nuts" tab="六角螺母">
                <a-table
                  :columns="[
                    { title: '规格', dataIndex: 'designation', key: 'designation', width: '18%' },
                    { title: '公称直径', dataIndex: 'nominal_d', key: 'nominal_d', width: '12%' },
                    { title: '螺距', dataIndex: 'pitch', key: 'pitch', width: '10%' },
                    { title: '对边宽度', dataIndex: 'width_s', key: 'width_s', width: '14%' },
                    { title: '高度', dataIndex: 'height_m', key: 'height_m', width: '12%' },
                    { title: '强度等级', dataIndex: 'strength_class', key: 'strength_class', width: '14%' },
                    { title: '材料', dataIndex: 'material_code', key: 'material_code', width: '12%' },
                    { title: '标准', dataIndex: 'standard_id', key: 'standard_id', width: '18%' }
                  ]"
                  :data-source="filteredNuts"
                  :pagination="{ pageSize: 15 }"
                  size="small"
                  row-key="nut_id"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="typeof column.key === 'string' && ['nominal_d', 'pitch', 'width_s', 'height_m'].includes(column.key)">
                      {{ record[column.key] != null ? `${record[column.key].toFixed(2)} mm` : '—' }}
                    </template>
                  </template>
                </a-table>
              </a-tab-pane>

              <a-tab-pane key="washers" tab="平垫圈">
                <a-table
                  :columns="[
                    { title: '规格', dataIndex: 'designation', key: 'designation', width: '18%' },
                    { title: '公称直径', dataIndex: 'nominal_d', key: 'nominal_d', width: '12%' },
                    { title: '内径', dataIndex: 'inner_diameter', key: 'inner_diameter', width: '12%' },
                    { title: '外径', dataIndex: 'outer_diameter', key: 'outer_diameter', width: '12%' },
                    { title: '厚度', dataIndex: 'thickness', key: 'thickness', width: '12%' },
                    { title: '材料', dataIndex: 'material_code', key: 'material_code', width: '12%' },
                    { title: '表面处理', dataIndex: 'finish_code', key: 'finish_code', width: '12%' },
                    { title: '标准', dataIndex: 'standard_id', key: 'standard_id', width: '18%' }
                  ]"
                  :data-source="filteredWashers"
                  :pagination="{ pageSize: 15 }"
                  size="small"
                  row-key="washer_id"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="typeof column.key === 'string' && ['nominal_d', 'inner_diameter', 'outer_diameter', 'thickness'].includes(column.key)">
                      {{ record[column.key] != null ? `${record[column.key].toFixed(2)} mm` : '—' }}
                    </template>
                  </template>
                </a-table>
              </a-tab-pane>

              <a-tab-pane key="gear-modules" tab="齿轮模数">
                <a-table
                  :columns="[
                    { title: '齿轮类型', dataIndex: 'gear_type', key: 'gear_type', width: '16%' },
                    { title: '压力角', dataIndex: 'pressure_angle_deg', key: 'pressure_angle_deg', width: '14%' },
                    { title: '螺旋角', dataIndex: 'helix_angle_deg', key: 'helix_angle_deg', width: '14%' },
                    { title: '模数', dataIndex: 'module_value', key: 'module_value', width: '14%' },
                    { title: '模数系统', dataIndex: 'module_system', key: 'module_system', width: '14%' },
                    { title: '备注', dataIndex: 'note', key: 'note', width: '28%' }
                  ]"
                  :data-source="filteredGearModules"
                  :pagination="{ pageSize: 15 }"
                  size="small"
                  row-key="gear_module_id"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'gear_type'">
                      <a-tag color="blue">
                        {{ record.gear_type === 'spur' ? '直齿轮' : record.gear_type === 'helical' ? '斜齿轮' : record.gear_type }}
                      </a-tag>
                    </template>
                    <template v-else-if="typeof column.key === 'string' && ['pressure_angle_deg', 'helix_angle_deg', 'module_value'].includes(column.key)">
                      {{ record[column.key] != null ? record[column.key].toFixed(2) : '—' }}
                    </template>
                  </template>
                </a-table>
              </a-tab-pane>

              <a-tab-pane key="oring-materials" tab="O 型圈材料">
                <a-table
                  :columns="[
                    { title: '材料代号', dataIndex: 'material_code', key: 'material_code', width: '14%' },
                    { title: '材料名称', dataIndex: 'material_name', key: 'material_name', width: '20%' },
                    { title: '硬度(Shore A)', dataIndex: 'hardness_shore_a', key: 'hardness_shore_a', width: '14%' },
                    { title: '最低温度', dataIndex: 'temperature_min_c', key: 'temperature_min_c', width: '12%' },
                    { title: '最高温度', dataIndex: 'temperature_max_c', key: 'temperature_max_c', width: '12%' },
                    { title: '耐油性', dataIndex: 'oil_resistance_rating', key: 'oil_resistance_rating', width: '14%' },
                    { title: '耐水性', dataIndex: 'water_resistance_rating', key: 'water_resistance_rating', width: '14%' }
                  ]"
                  :data-source="filteredOringMaterials"
                  :pagination="{ pageSize: 15 }"
                  size="small"
                  row-key="material_id"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="typeof column.key === 'string' && ['temperature_min_c', 'temperature_max_c'].includes(column.key)">
                      {{ record[column.key] != null ? `${record[column.key]} °C` : '—' }}
                    </template>
                  </template>
                </a-table>
              </a-tab-pane>

              <a-tab-pane key="manufacturers" tab="制造商">
                <a-table
                  :columns="[
                    { title: '制造商名称', dataIndex: 'manufacturer_name', key: 'manufacturer_name', width: '32%' },
                    { title: '国家', dataIndex: 'country_code', key: 'country_code', width: '12%' },
                    { title: '官网', dataIndex: 'homepage_url', key: 'homepage_url', width: '28%' },
                    { title: '备注', dataIndex: 'notes', key: 'notes', width: '28%' }
                  ]"
                  :data-source="filteredManufacturers"
                  :pagination="{ pageSize: 15 }"
                  size="small"
                  row-key="manufacturer_id"
                />
              </a-tab-pane>

              <a-tab-pane key="vendor-parts" tab="厂商零件">
                <a-table
                  :columns="[
                    { title: '零件号', dataIndex: 'vendor_part_number', key: 'vendor_part_number', width: '18%' },
                    { title: '制造商', dataIndex: 'manufacturer_id', key: 'manufacturer_id', width: '16%' },
                    { title: '领域', dataIndex: 'domain_code', key: 'domain_code', width: '10%' },
                    { title: '描述', dataIndex: 'description', key: 'description', width: '28%' },
                    { title: '状态', dataIndex: 'status', key: 'status', width: '10%' },
                    { title: '产品链接', dataIndex: 'product_url', key: 'product_url', width: '18%' }
                  ]"
                  :data-source="filteredVendorParts"
                  :pagination="{ pageSize: 15 }"
                  size="small"
                  row-key="vendor_part_id"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'manufacturer_id'">
                      {{ manufacturerNameMap.get(record.manufacturer_id) || record.manufacturer_id }}
                    </template>
                    <template v-else-if="column.key === 'status'">
                      <a-tag :color="record.status === 'active' ? 'green' : record.status === 'obsolete' ? 'red' : 'orange'">
                        {{ record.status }}
                      </a-tag>
                    </template>
                  </template>
                </a-table>
              </a-tab-pane>
            </a-tabs>
          </a-card>
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.standard-parts-page {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
