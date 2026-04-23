<script setup lang="ts">
import { computed } from 'vue'
import StateEmpty from './StateEmpty.vue'
import type { WorkspaceProject } from '../utils/workspace'

interface ContextMetric {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  activeProject: WorkspaceProject | null
  currentModule: string
  currentModuleLabel?: string
  title?: string
  note?: string
  metrics?: ContextMetric[]
  moduleLabels?: Record<string, string>
}>(), {
  title: '活动项目上下文',
  currentModuleLabel: '',
  note: '',
  metrics: () => [],
  moduleLabels: () => ({}),
})

const currentModuleText = computed(() => props.currentModuleLabel || props.moduleLabels[props.currentModule] || props.currentModule)
const projectModuleText = computed(() => {
  if (!props.activeProject) return ''
  return props.moduleLabels[props.activeProject.module] || props.activeProject.module
})
const moduleMismatch = computed(() =>
  !!(props.activeProject && props.activeProject.module !== props.currentModule),
)
</script>

<template>
  <a-card :title="title" size="small">
    <StateEmpty v-if="!activeProject" description="暂无活动项目" />
    <template v-else>
      <a-descriptions bordered size="small" :column="1">
        <a-descriptions-item label="项目名称">{{ activeProject.name }}</a-descriptions-item>
        <a-descriptions-item label="项目模块">{{ projectModuleText }}</a-descriptions-item>
        <a-descriptions-item label="当前页面">{{ currentModuleText }}</a-descriptions-item>
        <a-descriptions-item label="项目摘要">{{ activeProject.inputSummary || '尚未写入摘要' }}</a-descriptions-item>
      </a-descriptions>

      <div v-if="metrics.length" class="context-metrics">
        <div v-for="item in metrics" :key="item.label" class="context-metrics__item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <a-alert
        v-if="moduleMismatch"
        type="warning"
        show-icon
        class="context-alert"
        message="当前活动项目模块与本页面不一致"
        :description="`项目模块为 ${projectModuleText}，如果继续写回当前页面结果，请确认这是你要的跨模块工作流。`"
      />

      <div v-if="note" class="section-note">
        {{ note }}
      </div>
    </template>
  </a-card>
</template>

<style scoped>
.context-metrics {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.context-metrics__item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-subtle, #f8fafc);
  border: 1px solid var(--content-border, #e2e8f0);
}

.context-alert {
  margin-top: 12px;
}
</style>
