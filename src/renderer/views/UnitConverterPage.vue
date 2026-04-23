<script setup lang="ts">
/**
 * UnitConverterPage - 单位换算页面
 * 支持长度、压力、力、扭矩、温度、速度、功率、质量等单位换算
 */
import { ref, computed } from 'vue'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import { 
  SwapOutlined, 
  DownloadOutlined 
} from '@ant-design/icons-vue'
import { 
  convertUnit, 
  getAvailableUnits, 
  getUnitDisplayName,
  type UnitCategory 
} from '@renderer/engine/unit-converter'

const categories: { key: UnitCategory; label: string; icon: string }[] = [
  { key: 'length', label: '长度', icon: '📏' },
  { key: 'pressure', label: '压力', icon: '💨' },
  { key: 'force', label: '力', icon: '💪' },
  { key: 'torque', label: '扭矩', icon: '🔧' },
  { key: 'temperature', label: '温度', icon: '🌡️' },
  { key: 'speed', label: '速度', icon: '⚡' },
  { key: 'power', label: '功率', icon: '⚙️' },
  { key: 'mass', label: '质量', icon: '⚖️' },
]

const selectedCategory = ref<UnitCategory>('length')
const fromUnit = ref('mm')
const toUnit = ref('m')
const inputValue = ref(1000)

const availableFromUnits = computed(() => getAvailableUnits(selectedCategory.value))
const availableToUnits = computed(() => getAvailableUnits(selectedCategory.value))

const convertedValue = computed(() => {
  try {
    return convertUnit(inputValue.value, selectedCategory.value, fromUnit.value, toUnit.value)
  } catch (e) {
    return null
  }
})

function swapUnits() {
  const temp = fromUnit.value
  fromUnit.value = toUnit.value
  toUnit.value = temp
}

function onCategoryChange() {
  // 重置为类别的默认单位
  const units = getAvailableUnits(selectedCategory.value)
  if (units.length >= 2) {
    fromUnit.value = units[0]
    toUnit.value = units[1]
  }
}

function exportToCSV() {
  const csv = `类别,从单位,到单位,输入值,输出值\n${selectedCategory.value},${fromUnit.value},${toUnit.value},${inputValue.value},${convertedValue.value}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `unit-conversion-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="unit-converter-page">
    <PageToolbar title="MechBox" subtitle="单位换算">
      <a-space>
        <a-button size="small" @click="exportToCSV">
          <template #icon><DownloadOutlined /></template>导出CSV
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <a-card title="选择单位类别" size="small">
        <a-space wrap>
          <a-button
            v-for="cat in categories"
            :key="cat.key"
            :type="selectedCategory === cat.key ? 'primary' : 'default'"
            size="small"
            @click="() => { selectedCategory = cat.key; onCategoryChange() }"
          >
            {{ cat.icon }} {{ cat.label }}
          </a-button>
        </a-space>
      </a-card>

      <div style="margin-top: 16px">
        <ToolPageLayout :input-span="10" :output-span="14" :gutter="24">
          <template #side>
            <a-card title="单位换算" size="small">
            <a-form layout="vertical">
              <a-form-item label="从单位">
                <a-select v-model:value="fromUnit" style="width: 100%">
                  <a-select-option v-for="unit in availableFromUnits" :key="unit" :value="unit">
                    {{ getUnitDisplayName(selectedCategory, unit) }}
                  </a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="输入值">
                <a-input-number 
                  v-model:value="inputValue" 
                  style="width: 100%" 
                  size="large"
                  :precision="6"
                />
              </a-form-item>
            </a-form>
            </a-card>
            <div class="section-note">
              适合在图纸、样本和现场数据之间快速切换单位，结果按当前类别的基础换算关系实时更新。
            </div>
          </template>

          <template #main>
            <a-card title="换算结果" size="small">
              <div class="section-actions" style="margin-top: 0; margin-bottom: 12px">
                <a-button shape="circle" @click="swapUnits">
                  <template #icon><SwapOutlined /></template>
                </a-button>
              </div>
              <a-form layout="vertical">
                <a-form-item label="到单位">
                  <a-select v-model:value="toUnit" style="width: 100%">
                    <a-select-option v-for="unit in availableToUnits" :key="unit" :value="unit">
                      {{ getUnitDisplayName(selectedCategory, unit) }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item label="换算结果">
                <div class="result-display">
                  {{ convertedValue !== null ? convertedValue.toFixed(6) : '---' }}
                </div>
                </a-form-item>
              </a-form>
            </a-card>

            <a-card title="常用换算参考" size="small">
              <a-table
                :columns="[
                  { title: '类别', dataIndex: 'category', key: 'category', width: '15%' },
                  { title: '换算关系', dataIndex: 'relation', key: 'relation', width: '50%' },
                  { title: '备注', dataIndex: 'note', key: 'note', width: '35%' }
                ]"
                :data-source="[
                  { category: '长度', relation: '1 inch = 25.4 mm', note: '英制转公制' },
                  { category: '压力', relation: '1 MPa = 10 bar = 145 psi', note: '常用压力单位' },
                  { category: '力', relation: '1 kgf = 9.80665 N', note: '重力加速度相关' },
                  { category: '扭矩', relation: '1 N·m = 0.7376 lbf·ft', note: '螺栓预紧常用' },
                  { category: '温度', relation: '°C = (°F - 32) × 5/9', note: '温度转换公式' },
                  { category: '功率', relation: '1 kW = 1.341 HP', note: '电机功率常用' },
                ]"
                :pagination="false"
                size="small"
              />
            </a-card>
          </template>
        </ToolPageLayout>
      </div>
    </div>
  </div>
</template>

<style scoped>
.unit-converter-page {
  max-width: 1200px;
  margin: 0 auto;
}

.result-display {
  font-size: 28px;
  font-weight: bold;
  color: var(--result-value-text);
  font-family: var(--font-mono);
  text-align: right;
  padding: 14px 16px;
  background: var(--result-value-bg);
  border-radius: 14px;
  border: 1px solid var(--result-value-border);
}
</style>
