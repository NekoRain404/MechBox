<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  mode: "fallback" | "partial" | "missing"
  message: string
  details?: string[]
}>(), {
  details: () => [],
})

const title = computed(() => {
  switch (props.mode) {
    case "fallback":
      return "当前已进入本地回退模式"
    case "partial":
      return "当前数据域处于部分降级状态"
    case "missing":
      return "当前页面依赖的数据库主数据未就绪"
    default:
      return "数据库运行时提示"
  }
})

const alertType = computed(() => (props.mode === "fallback" ? "info" : "warning"))
</script>

<template>
  <a-alert
    class="database-runtime-banner"
    :message="title"
    :type="alertType"
    show-icon
  >
    <template #description>
      <div class="database-runtime-banner__body">
        <div>{{ message }}</div>
        <ul
          v-if="details.length"
          class="database-runtime-banner__details"
        >
          <li v-for="detail in details" :key="detail">
            {{ detail }}
          </li>
        </ul>
      </div>
    </template>
  </a-alert>
</template>
