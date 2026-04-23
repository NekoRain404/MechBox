<script setup lang="ts">
import { computed } from "vue";
import RouteEvidenceTags from "./RouteEvidenceTags.vue";
import RouteQualityTags from "./RouteQualityTags.vue";
import { useRouteGovernance } from "@renderer/composables/useRouteGovernance";
import { formatRouteQualitySummary } from "@renderer/router/route-levels";

withDefaults(defineProps<{
  title?: string
  conclusion: string
  status?: 'success' | 'info' | 'warning' | 'error'
  risks?: string[]
  actions?: string[]
  boundaries?: string[]
}>(), {
  title: '结果判断',
  status: 'info',
  risks: () => [],
  actions: () => [],
  boundaries: () => [],
})

const {
  currentRouteMeta,
  governanceSummary,
  topSourceNames,
  topVersionCodes,
} = useRouteGovernance()
const evidenceSummary = computed(() => currentRouteMeta.value?.evidenceSummary)
const qualitySummary = computed(() => {
  return formatRouteQualitySummary(
    currentRouteMeta.value?.capabilityLevel,
    currentRouteMeta.value?.verificationLevel,
  )
})
</script>

<template>
  <a-card class="analysis-decision-card" :title="title" size="small">
    <div class="analysis-decision">
      <a-alert :message="conclusion" :type="status" show-icon />

      <div class="analysis-decision__grid">
        <section class="analysis-decision__section" v-if="risks.length">
          <div class="analysis-decision__section-title">主要风险</div>
          <div
            v-for="risk in risks"
            :key="risk"
            class="analysis-decision__item is-risk"
          >
            {{ risk }}
          </div>
        </section>

        <section class="analysis-decision__section" v-if="actions.length">
          <div class="analysis-decision__section-title">下一步建议</div>
          <div
            v-for="action in actions"
            :key="action"
            class="analysis-decision__item is-action"
          >
            {{ action }}
          </div>
        </section>

        <section class="analysis-decision__section" v-if="boundaries.length">
          <div class="analysis-decision__section-title">适用边界</div>
          <div
            v-for="boundary in boundaries"
            :key="boundary"
            class="analysis-decision__item is-output"
          >
            {{ boundary }}
          </div>
        </section>

        <section class="analysis-decision__section" v-if="qualitySummary">
          <div class="analysis-decision__section-title">适用级别</div>
          <RouteQualityTags
            :capability-level="currentRouteMeta?.capabilityLevel"
            :verification-level="currentRouteMeta?.verificationLevel"
          />
          <div class="analysis-decision__item is-output analysis-decision__summary">
            {{ qualitySummary }}
          </div>
        </section>

        <section class="analysis-decision__section" v-if="currentRouteMeta?.evidenceTags?.length || evidenceSummary">
          <div class="analysis-decision__section-title">计算依据</div>
          <RouteEvidenceTags
            v-if="currentRouteMeta?.evidenceTags?.length"
            :evidence-tags="currentRouteMeta?.evidenceTags"
          />
          <div v-if="evidenceSummary" class="analysis-decision__item is-output">
            {{ evidenceSummary }}
          </div>
        </section>

        <section class="analysis-decision__section" v-if="governanceSummary">
          <div class="analysis-decision__section-title">来源追溯</div>
          <div class="analysis-decision__item is-output">
            {{ governanceSummary }}
          </div>
          <div v-if="topSourceNames.length" class="analysis-decision__tag-row">
            <a-tag v-for="sourceName in topSourceNames" :key="sourceName" color="processing">
              {{ sourceName }}
            </a-tag>
          </div>
          <div v-if="topVersionCodes.length" class="analysis-decision__tag-row">
            <a-tag v-for="versionCode in topVersionCodes" :key="versionCode">
              {{ versionCode }}
            </a-tag>
          </div>
        </section>

      </div>
    </div>
  </a-card>
</template>
