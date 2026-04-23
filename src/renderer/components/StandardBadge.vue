<script setup lang="ts">
/**
 * StandardBadge - 标准标签组件
 * 用于显示标准体系标识
 */
interface Props {
  standard: string
  size?: 'small' | 'default'
}

withDefaults(defineProps<Props>(), {
  size: 'default'
})

const standardColors: Record<string, string> = {
  'AS568': '#1890ff',
  'GB': '#52c41a',
  'ISO': '#faad14',
  'JIS': '#722ed1',
  'DIN': '#13c2c2',
  'ANSI': '#eb2f96'
}

const getColor = (std: string): string => {
  for (const [key, color] of Object.entries(standardColors)) {
    if (std.includes(key)) return color
  }
  return '#8c8c8c'
}
</script>

<template>
  <a-tag :color="getColor(standard)" :style="{ fontSize: size === 'small' ? '10px' : '12px' }">
    {{ standard }}
  </a-tag>
</template>
