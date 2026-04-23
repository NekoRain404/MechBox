<script setup lang="ts">
export interface ToolPresetOption {
  key: string
  label: string
  description?: string
}

withDefaults(defineProps<{
  title?: string
  description?: string
  presets: readonly ToolPresetOption[]
  activeKey?: string
  showReset?: boolean
  resetLabel?: string
}>(), {
  title: '常用预设',
  description: '',
  activeKey: '',
  showReset: true,
  resetLabel: '恢复默认',
})

const emit = defineEmits<{
  apply: [key: string]
  reset: []
}>()
</script>

<template>
  <a-card :title="title" size="small" class="tool-preset-card">
    <div v-if="description" class="tool-preset-card__description">
      {{ description }}
    </div>

    <div class="tool-preset-grid">
      <button
        v-for="preset in presets"
        :key="preset.key"
        type="button"
        class="tool-preset-item"
        :class="{ 'is-active': preset.key === activeKey }"
        @click="emit('apply', preset.key)"
      >
        <span class="tool-preset-item__label">{{ preset.label }}</span>
        <span v-if="preset.description" class="tool-preset-item__description">
          {{ preset.description }}
        </span>
      </button>
    </div>

    <div v-if="showReset" class="tool-preset-card__actions">
      <a-button block size="small" @click="emit('reset')">
        {{ resetLabel }}
      </a-button>
    </div>
  </a-card>
</template>

<style scoped>
.tool-preset-card__description {
  margin-bottom: 12px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.tool-preset-grid {
  display: grid;
  gap: 10px;
}

.tool-preset-item {
  border: 1px solid var(--content-border);
  background: var(--surface-base);
  border-radius: 14px;
  padding: 12px;
  text-align: left;
  display: grid;
  gap: 4px;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.tool-preset-item:hover {
  transform: translateY(-1px);
  border-color: var(--accent-border);
  box-shadow: var(--shadow-soft);
}

.tool-preset-item.is-active {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--content-border));
  background: color-mix(in srgb, var(--surface-base) 86%, var(--app-bg-accent));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.tool-preset-item__label {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
}

.tool-preset-item__description {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.6;
}

.tool-preset-card__actions {
  margin-top: 12px;
}
</style>
