<script setup lang="ts">
import { InfoCircleOutlined } from '@ant-design/icons-vue'

withDefaults(
  defineProps<{
    title?: string
    tone?: 'default' | 'accent'
  }>(),
  {
    title: '使用提示',
    tone: 'default',
  },
)
</script>

<template>
  <div class="info-panel" :class="`is-${tone}`">
    <div class="info-panel__header">
      <InfoCircleOutlined class="info-panel__icon" />
      <span class="info-panel__title">{{ title }}</span>
    </div>
    <div class="info-panel__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.info-panel {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--content-border);
  border-radius: 14px;
  background: var(--surface-raised);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.65;
  display: grid;
  gap: 8px;
}

.info-panel.is-accent {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--content-border));
  background: color-mix(in srgb, var(--surface-raised) 85%, var(--app-bg-accent));
}

.info-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.info-panel__icon {
  color: var(--accent);
}

.info-panel__title {
  font-weight: 700;
}
</style>
