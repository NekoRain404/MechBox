<script setup lang="ts">
import { computed } from "vue";
import {
  getCapabilityLevelMeta,
  getVerificationLevelMeta,
  type CapabilityLevel,
  type VerificationLevel,
} from "@renderer/router/route-levels";

const props = withDefaults(
  defineProps<{
    capabilityLevel?: CapabilityLevel;
    verificationLevel?: VerificationLevel;
    size?: "small" | "default";
  }>(),
  {
    size: "small",
  },
);

const capabilityMeta = computed(() => getCapabilityLevelMeta(props.capabilityLevel));
const verificationMeta = computed(() => getVerificationLevelMeta(props.verificationLevel));
</script>

<template>
  <div v-if="capabilityMeta || verificationMeta" class="route-quality-tags" :class="{ 'is-small': size === 'small' }">
    <a-tag v-if="capabilityMeta" :color="capabilityMeta.color" :title="capabilityMeta.description">
      能力·{{ capabilityMeta.label }}
    </a-tag>
    <a-tag v-if="verificationMeta" :color="verificationMeta.color" :title="verificationMeta.description">
      验证·{{ verificationMeta.label }}
    </a-tag>
  </div>
</template>

<style scoped>
.route-quality-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.route-quality-tags.is-small :deep(.ant-tag) {
  margin-inline-end: 0;
  font-size: 11px;
  line-height: 18px;
  padding-inline: 8px;
}

.route-quality-tags :deep(.ant-tag) {
  margin-inline-end: 0;
  border-radius: 999px;
  font-weight: 600;
}
</style>
