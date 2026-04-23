<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  sideCards?: number
  mainCards?: number
}>(), {
  title: '正在准备页面',
  description: '正在加载当前页面所需的项目、报告与治理数据。',
  sideCards: 3,
  mainCards: 2,
})
</script>

<template>
  <div class="page-loading-state">
    <div class="page-loading-state__hero">
      <div class="page-loading-state__title">{{ title }}</div>
      <div class="page-loading-state__description">{{ description }}</div>
    </div>

    <div class="page-loading-state__layout">
      <div class="page-loading-state__column is-side">
        <a-card v-for="index in sideCards" :key="`side-${index}`" size="small">
          <a-skeleton active :title="{ width: '38%' }" :paragraph="{ rows: 3 }" />
        </a-card>
      </div>
      <div class="page-loading-state__column is-main">
        <a-card v-for="index in mainCards" :key="`main-${index}`" size="small">
          <a-skeleton active :title="{ width: '28%' }" :paragraph="{ rows: index === 1 ? 7 : 5 }" />
        </a-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-loading-state {
  display: grid;
  gap: 16px;
}

.page-loading-state__hero {
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid var(--content-border);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 10%, transparent) 0, transparent 34%),
    linear-gradient(180deg, var(--surface-base) 0%, var(--surface-raised) 100%);
  box-shadow: var(--shadow-soft);
}

.page-loading-state__title {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 800;
}

.page-loading-state__description {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.page-loading-state__layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.75fr) minmax(0, 1.25fr);
  gap: 16px;
  align-items: start;
}

.page-loading-state__column {
  display: grid;
  gap: 16px;
}

@media (max-width: 992px) {
  .page-loading-state__layout {
    grid-template-columns: 1fr;
  }
}
</style>
