<script setup lang="ts">
/**
 * UnitInput - 智能单位换算输入组件 (Section 11.1)
 * 根据全局设置 (mm/inch) 自动处理 modelValue 转换
 */
import { computed } from 'vue'
import { useStandardStore } from '../store/useStandardStore'

interface Props {
  modelValue: number | undefined
  unit?: 'mm' | 'inch' | 'kN' | 'N' | 'MPa' | 'N·m' | '°C' | 'rpm'
  label?: string
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  placeholder?: string
  status?: 'error' | 'warning' | ''
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  unit: 'mm',
  label: '',
  disabled: false,
  min: undefined,
  max: undefined,
  step: 1,
  placeholder: '',
  status: '',
  errorMessage: ''
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | undefined): void
}>()

const store = useStandardStore()

// 当前全局单位
const globalUnit = computed(() => store.unit)

// 换算系数
const toGlobal = computed(() => props.unit === 'inch' && globalUnit.value === 'mm' ? 25.4 : props.unit === 'mm' && globalUnit.value === 'inch' ? 1 / 25.4 : 1)

// 显示值 = 内部值 * 换算系数
const displayValue = computed({
  get: () => {
    if (props.modelValue === undefined) return undefined
    return props.modelValue * toGlobal.value
  },
  set: (val: number | undefined) => {
    if (val === undefined) {
      emit('update:modelValue', undefined)
      return
    }
    emit('update:modelValue', val / toGlobal.value)
  }
})

// 显示单位标签
const displayUnit = computed(() => globalUnit.value === 'inch' && props.unit === 'mm' ? 'in' : props.unit)
</script>

<template>
  <a-input-number
    v-model:value="displayValue"
    :disabled="disabled"
    :min="min"
    :max="max"
    :step="step"
    :placeholder="placeholder"
    :status="status || (errorMessage ? 'error' : '')"
    style="width: 100%"
  >
    <template #addonAfter>
      <span class="unit-label">{{ displayUnit }}</span>
    </template>
  </a-input-number>
  <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>
</template>

<style scoped>
.unit-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  min-width: 25px;
  display: inline-block;
  text-align: center;
}
.error-msg {
  font-size: 11px;
  color: #ef4444;
  margin-top: 2px;
}
</style>
