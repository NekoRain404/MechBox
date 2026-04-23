<script setup lang="ts">
export interface AnalysisMetric {
  label: string
  value: string
}

withDefaults(defineProps<{
  title: string
  summary: string
  metrics?: AnalysisMetric[]
  inputs?: string[]
  outputs?: string[]
  notes?: string[]
}>(), {
  metrics: () => [],
  inputs: () => [],
  outputs: () => [],
  notes: () => [],
})
</script>

<template>
  <a-card class="analysis-brief-card" size="small">
    <div class="analysis-brief">
      <div class="analysis-brief__header">
        <div class="analysis-brief__title">{{ title }}</div>
        <div class="analysis-brief__summary">{{ summary }}</div>
      </div>

      <div v-if="metrics.length" class="analysis-brief__metrics">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="analysis-brief__metric"
        >
          <div class="analysis-brief__metric-label">{{ metric.label }}</div>
          <div class="analysis-brief__metric-value">{{ metric.value }}</div>
        </div>
      </div>

      <div class="analysis-brief__grid">
        <section v-if="inputs.length" class="analysis-brief__section">
          <div class="analysis-brief__section-title">输入条件</div>
          <div
            v-for="item in inputs"
            :key="item"
            class="analysis-brief__item"
          >
            {{ item }}
          </div>
        </section>

        <section v-if="outputs.length" class="analysis-brief__section">
          <div class="analysis-brief__section-title">直接输出</div>
          <div
            v-for="item in outputs"
            :key="item"
            class="analysis-brief__item"
          >
            {{ item }}
          </div>
        </section>

        <section v-if="notes.length" class="analysis-brief__section">
          <div class="analysis-brief__section-title">使用说明</div>
          <div
            v-for="item in notes"
            :key="item"
            class="analysis-brief__item"
          >
            {{ item }}
          </div>
        </section>
      </div>
    </div>
  </a-card>
</template>
