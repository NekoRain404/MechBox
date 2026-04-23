<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import RouteGovernanceCard from "./RouteGovernanceCard.vue";
import RouteEvidenceTags from "./RouteEvidenceTags.vue";
import RouteQualityTags from "./RouteQualityTags.vue";
import { getRouteMetaByPath } from "@renderer/router/route-meta";
import {
  ENTERPRISE_SETTINGS_EVENT,
  loadEnterpriseSettings,
  type EnterpriseSettings,
} from "@renderer/engine/enterprise-settings";

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  showRouteQuality?: boolean
  showEvidence?: boolean
  showGovernance?: boolean
  description?: string
}>(), {
  showRouteQuality: false,
  showEvidence: false,
  showGovernance: false,
})

const route = useRoute()
const showDescriptions = ref(loadEnterpriseSettings().showPageDescriptions)
const currentRouteMeta = computed(() => getRouteMetaByPath(route.path))
const toolFirstHeading = computed(() => props.title === "MechBox" && Boolean(props.subtitle))
const routeDescription = computed(() => {
  if (!showDescriptions.value) return ""
  return props.description ?? currentRouteMeta.value?.description
})
const routeEvidenceSummary = computed(() => currentRouteMeta.value?.evidenceSummary)
const showQualityTags = computed(() => {
  if (!props.showRouteQuality) return false
  return !!(currentRouteMeta.value?.capabilityLevel || currentRouteMeta.value?.verificationLevel)
})
const showEvidenceTags = computed(() => {
  if (!props.showEvidence) return false
  return !!currentRouteMeta.value?.evidenceTags?.length
})
const showEvidenceSummary = computed(() => {
  if (!props.showEvidence) return false
  return !!routeEvidenceSummary.value
})
const showGovernanceCard = computed(() => {
  if (!props.showGovernance) return false
  const refs = currentRouteMeta.value?.governanceRefs
  return !!(refs?.sourceIds?.length || refs?.datasetIds?.length || refs?.versionCodes?.length)
})

onMounted(() => {
  window.addEventListener(ENTERPRISE_SETTINGS_EVENT, handleSettingsUpdated)
})

onBeforeUnmount(() => {
  window.removeEventListener(ENTERPRISE_SETTINGS_EVENT, handleSettingsUpdated)
})

function handleSettingsUpdated(event: Event) {
  const detail = (event as CustomEvent<EnterpriseSettings>).detail
  if (!detail) return
  showDescriptions.value = detail.showPageDescriptions
}
</script>

<template>
  <div class="page-toolbar-stack">
    <div class="toolbar">
      <div class="brand brand--stacked">
        <div v-if="toolFirstHeading" class="brand__eyebrow">
          {{ title }}
        </div>
        <div class="brand__headline">
          <template v-if="toolFirstHeading">
            <span class="brand__headline-main">{{ subtitle }}</span>
          </template>
          <template v-else>
            {{ title }}
            <small v-if="subtitle && showDescriptions">{{ subtitle }}</small>
          </template>
        </div>
        <div v-if="routeDescription || showQualityTags" class="brand__meta">
          <div v-if="routeDescription" class="brand__description">
            {{ routeDescription }}
          </div>
          <RouteQualityTags
            v-if="showQualityTags"
            :capability-level="currentRouteMeta?.capabilityLevel"
            :verification-level="currentRouteMeta?.verificationLevel"
            size="small"
          />
        </div>
        <div v-if="showEvidenceTags || showEvidenceSummary" class="brand__evidence">
          <RouteEvidenceTags
            v-if="showEvidenceTags"
            :evidence-tags="currentRouteMeta?.evidenceTags"
            size="small"
          />
          <div v-if="showEvidenceSummary" class="brand__evidence-summary">
            {{ routeEvidenceSummary }}
          </div>
        </div>
      </div>
      <div v-if="$slots.default" class="toolbar-actions">
        <slot />
      </div>
    </div>
    <RouteGovernanceCard v-if="showGovernanceCard" />
  </div>
</template>
