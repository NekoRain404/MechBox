<script setup lang="ts">
/**
 * FormulaDisplay - 公式展示组件
 * 用于显示计算公式，支持LaTeX风格（简化版）
 */
interface Props {
  formula: string
  description?: string
}

defineProps<Props>()
</script>

<template>
  <div class="formula-display">
    <div class="formula-code">{{ formula }}</div>
    <div class="formula-desc" v-if="description">{{ description }}</div>
  </div>
</template>

<style scoped>
.formula-display {
  background: #f9f9f9;
  border-left: 3px solid #1677ff;
  padding: 12px 16px;
  margin: 12px 0;
  border-radius: 2px;
}

.formula-code {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #262626;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.formula-desc {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 6px;
}
</style>
