<script setup lang="ts">
withDefaults(
  defineProps<{
    inputSpan?: number
    outputSpan?: number
    gutter?: number
    stickySide?: boolean
    stickyOffset?: number
  }>(),
  {
    inputSpan: 10,
    outputSpan: 14,
    gutter: 16,
    stickySide: true,
    stickyOffset: 12,
  },
)
</script>

<template>
  <a-row :gutter="gutter" class="tool-layout">
    <a-col
      :span="inputSpan"
      class="tool-layout__side"
      :class="{ 'is-sticky': stickySide }"
      :style="{ '--tool-layout-sticky-offset': `${stickyOffset}px` }"
    >
      <slot name="side" />
    </a-col>
    <a-col :span="outputSpan" class="tool-layout__main">
      <slot name="main" />
    </a-col>
  </a-row>
</template>

<style scoped>
.tool-layout {
  align-items: start;
}

.tool-layout__side,
.tool-layout__main {
  display: grid;
  gap: 16px;
  align-content: start;
  min-width: 0;
}

.tool-layout__side.is-sticky {
  position: sticky;
  top: var(--tool-layout-sticky-offset, 12px);
  align-self: start;
}

@media (max-width: 992px) {
  .tool-layout {
    display: grid;
    gap: 16px;
  }

  .tool-layout__side.is-sticky {
    position: static;
  }
}
</style>
