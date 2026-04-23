<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { InboxOutlined } from '@ant-design/icons-vue'

const props = withDefaults(
  defineProps<{
    title?: string
    description: string
    icon?: Component
  }>(),
  {
    title: '',
    icon: () => InboxOutlined,
  },
)

const resolvedIcon = computed(() => props.icon ?? InboxOutlined)
</script>

<template>
  <div class="state-empty">
    <div class="state-empty__icon-wrap">
      <component :is="resolvedIcon" class="state-empty__icon" />
    </div>
    <div class="state-empty__content">
      <div v-if="title" class="state-empty__title">{{ title }}</div>
      <div class="state-empty__description">{{ description }}</div>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.state-empty {
  padding: 20px 0;
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
}

.state-empty__icon-wrap {
  width: 72px;
  height: 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  background: color-mix(in srgb, var(--surface-raised) 88%, white);
  border: 1px solid var(--content-border);
}

.state-empty__icon {
  font-size: 34px;
  color: var(--toolbar-subtle);
}

.state-empty__content {
  display: grid;
  gap: 6px;
}

.state-empty__title {
  font-weight: 700;
  color: var(--text-primary);
}

.state-empty__description {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  max-width: 420px;
  margin: 0 auto;
}
</style>
