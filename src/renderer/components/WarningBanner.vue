<script setup lang="ts">
/**
 * WarningBanner - 警告提示条组件
 * 用于显示计算警告和错误信息
 */
interface Warning {
  level: 'error' | 'warning' | 'info'
  message: string
  suggestion?: string
}

interface Props {
  warnings: Warning[]
}

defineProps<Props>()
</script>

<template>
  <div class="warning-banner" v-if="warnings.length > 0">
    <a-alert
      v-for="(w, index) in warnings"
      :key="index"
      :message="w.message"
      :description="w.suggestion"
      :type="w.level === 'error' ? 'error' : (w.level === 'warning' ? 'warning' : 'info')"
      show-icon
      style="margin-bottom: 8px"
    />
  </div>
</template>

<style scoped>
.warning-banner {
  margin-top: 12px;
}
</style>
