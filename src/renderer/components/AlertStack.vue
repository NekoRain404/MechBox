<script setup lang="ts">
interface AlertItem {
  message: string
  level?: 'error' | 'warning' | 'info' | 'success'
  description?: string
  suggestion?: string
}

const props = defineProps<{
  items: AlertItem[]
  emptyText?: string
}>()

function resolveType(level?: AlertItem['level']) {
  if (level === 'error') return 'error'
  if (level === 'warning') return 'warning'
  if (level === 'success') return 'success'
  return 'info'
}

function resolveDescription(item: AlertItem) {
  return item.description ?? item.suggestion ?? ''
}
</script>

<template>
  <div v-if="props.items.length" class="alert-stack">
    <a-alert
      v-for="(item, index) in props.items"
      :key="`${item.message}-${index}`"
      :message="item.message"
      :description="resolveDescription(item)"
      :type="resolveType(item.level)"
      show-icon
    />
  </div>
</template>

<style scoped>
.alert-stack {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}
</style>
