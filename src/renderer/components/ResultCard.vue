<script setup lang="ts">
/**
 * ResultCard - 结果展示卡片组件
 * 用于显示计算结果，支持标题、数值、单位和警告
 */
interface Props {
  title: string
  value: string | number
  unit?: string
  status?: 'pass' | 'warning' | 'error' | 'info'
  tooltip?: string
}

withDefaults(defineProps<Props>(), {
  unit: '',
  status: 'pass',
  tooltip: ''
})
</script>

<template>
  <div class="result-card" :class="status">
    <div class="result-header">
      <span class="result-title">{{ title }}</span>
      <a-tooltip v-if="tooltip" :title="tooltip">
        <QuestionCircleOutlined class="info-icon" />
      </a-tooltip>
    </div>
    <div class="result-value">
      {{ value }} <span class="result-unit" v-if="unit">{{ unit }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { QuestionCircleOutlined } from '@ant-design/icons-vue'
</script>

<style scoped>
.result-card {
  background: #f5f5f5;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 12px;
  transition: all 0.3s;
}

.result-card.pass {
  background: #e0f2f1;
  border-color: #80cbc4;
}

.result-card.warning {
  background: #fff7e6;
  border-color: #ffd666;
}

.result-card.error {
  background: #fff1f0;
  border-color: #ffa39e;
}

.result-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.result-title {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
  flex: 1;
}

.info-icon {
  color: rgba(0, 0, 0, 0.45);
  cursor: help;
  font-size: 14px;
}

.result-value {
  font-size: 20px;
  font-weight: bold;
  color: #004d40;
  font-family: monospace;
}

.result-unit {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
  margin-left: 4px;
}
</style>
