<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    evidenceTags?: string[]
    size?: "small" | "default"
  }>(),
  {
    evidenceTags: () => [],
    size: "small",
  },
)
</script>

<template>
  <div v-if="evidenceTags.length" class="route-evidence-tags" :class="{ 'is-small': size === 'small' }">
    <a-tag v-for="tag in evidenceTags" :key="tag" color="default">
      依据·{{ tag }}
    </a-tag>
  </div>
</template>

<style scoped>
.route-evidence-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.route-evidence-tags.is-small :deep(.ant-tag) {
  margin-inline-end: 0;
  font-size: 11px;
  line-height: 18px;
  padding-inline: 8px;
}

.route-evidence-tags :deep(.ant-tag) {
  margin-inline-end: 0;
  border-radius: 999px;
}
</style>
