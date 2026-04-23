<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'

const props = withDefaults(defineProps<{
  loading: boolean
  hasLoaded: boolean
  lastSyncedAt?: string | null
  error?: string
  loadingLabel?: string
  idleLabel?: string
  initialLabel?: string
}>(), {
  lastSyncedAt: null,
  error: '',
  loadingLabel: '正在同步数据',
  idleLabel: '数据已同步',
  initialLabel: '正在准备页面',
})

const statusLabel = computed(() => {
  if (props.loading) {
    return props.hasLoaded ? props.loadingLabel : props.initialLabel
  }
  if (props.error) {
    return '同步存在异常'
  }
  if (!props.hasLoaded) {
    return props.initialLabel
  }
  return props.idleLabel
})

const statusColor = computed(() => {
  if (props.loading) return 'processing'
  if (props.error) return 'error'
  return 'success'
})

const statusIcon = computed(() => {
  if (props.loading) return LoadingOutlined
  if (props.error) return ExclamationCircleOutlined
  return CheckCircleOutlined
})

const formattedTime = computed(() => {
  if (!props.lastSyncedAt) return ''

  const date = new Date(props.lastSyncedAt)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
})
</script>

<template>
  <div class="page-sync-status">
    <div class="page-sync-status__main">
      <a-tag :color="statusColor" class="page-sync-status__tag">
        <component :is="statusIcon" />
        <span>{{ statusLabel }}</span>
      </a-tag>
      <div v-if="formattedTime" class="page-sync-status__time">
        <ClockCircleOutlined />
        <span>上次同步 {{ formattedTime }}</span>
      </div>
      <div v-if="error" class="page-sync-status__error">{{ error }}</div>
    </div>
    <div v-if="$slots.default" class="page-sync-status__extra">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.page-sync-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
  border-radius: 14px;
  border: 1px solid var(--content-border);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 10%, transparent) 0, transparent 34%),
    linear-gradient(180deg, var(--surface-base) 0%, var(--surface-raised) 100%);
  box-shadow: var(--shadow-soft);
}

.page-sync-status__main {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.page-sync-status__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-inline-end: 0;
  font-weight: 600;
}

.page-sync-status__time {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.page-sync-status__error {
  color: var(--danger-text);
  font-size: 12px;
  line-height: 1.6;
}

.page-sync-status__extra {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .page-sync-status {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-sync-status__extra {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
