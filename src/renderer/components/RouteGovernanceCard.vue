<script setup lang="ts">
import {
  formatGovernanceRows,
  formatGovernanceSourceType,
  formatGovernanceTime,
  formatGovernanceTrustLevel,
  getGovernanceTrustColor,
} from "@renderer/utils/data-governance";
import { useRouteGovernance } from "@renderer/composables/useRouteGovernance";

const {
  hasGovernanceRefs,
  resolvedGovernance,
  runtimeModeLabel,
  runtimeModeNote,
  sourceNameMap,
} = useRouteGovernance();
</script>

<template>
  <a-card
    v-if="resolvedGovernance && hasGovernanceRefs"
    class="route-governance-card"
    size="small"
  >
    <template #title>数据来源链</template>
    <template #extra>
      <a-tag color="processing">{{ runtimeModeLabel }}</a-tag>
    </template>

    <div class="route-governance-card__summary">
      <div class="route-governance-card__metric">
        <strong>{{ resolvedGovernance.sources.length }}</strong>
        <span>来源</span>
      </div>
      <div class="route-governance-card__metric">
        <strong>{{ resolvedGovernance.datasets.length }}</strong>
        <span>数据集</span>
      </div>
      <div class="route-governance-card__metric">
        <strong>{{ resolvedGovernance.versions.length }}</strong>
        <span>版本记录</span>
      </div>
    </div>

    <div class="route-governance-card__note">
      {{ runtimeModeNote }}
    </div>

    <div class="route-governance-card__grid">
      <section
        v-if="resolvedGovernance.sources.length"
        class="route-governance-card__section"
      >
        <div class="route-governance-card__section-title">来源站点</div>
        <div
          v-for="source in resolvedGovernance.sources"
          :key="source.source_id"
          class="route-governance-card__entry"
        >
          <div class="route-governance-card__entry-head">
            <strong>{{ source.source_name }}</strong>
            <a-tag>{{ formatGovernanceSourceType(source.source_type) }}</a-tag>
            <a-tag :color="getGovernanceTrustColor(source.trust_level)">
              {{ formatGovernanceTrustLevel(source.trust_level) }}
            </a-tag>
          </div>
          <a
            v-if="source.homepage_url"
            class="route-governance-card__link"
            :href="source.homepage_url"
            target="_blank"
            rel="noreferrer"
          >
            {{ source.homepage_url }}
          </a>
          <div
            v-if="source.license_note || source.notes"
            class="route-governance-card__meta"
          >
            {{ source.license_note || source.notes }}
          </div>
        </div>
      </section>

      <section
        v-if="resolvedGovernance.datasets.length"
        class="route-governance-card__section"
      >
        <div class="route-governance-card__section-title">数据集</div>
        <div
          v-for="dataset in resolvedGovernance.datasets"
          :key="dataset.dataset_id"
          class="route-governance-card__entry"
        >
          <div class="route-governance-card__entry-head">
            <strong>{{ dataset.dataset_name }}</strong>
            <a-tag color="blue">{{ dataset.dataset_version }}</a-tag>
            <a-tag>{{ formatGovernanceRows(dataset.row_count) }}</a-tag>
          </div>
          <div class="route-governance-card__meta">
            {{ sourceNameMap.get(dataset.source_id || "") || dataset.source_id || "来源未标注" }}
            · 导入 {{ formatGovernanceTime(dataset.imported_at) }}
          </div>
          <div
            v-if="dataset.notes"
            class="route-governance-card__meta"
          >
            {{ dataset.notes }}
          </div>
        </div>
      </section>

      <section
        v-if="resolvedGovernance.versions.length"
        class="route-governance-card__section"
      >
        <div class="route-governance-card__section-title">版本记录</div>
        <div
          v-for="version in resolvedGovernance.versions"
          :key="version.standard_code"
          class="route-governance-card__entry"
        >
          <div class="route-governance-card__entry-head">
            <strong>{{ version.standard_code }}</strong>
            <a-tag color="purple">{{ version.version }}</a-tag>
          </div>
          <div class="route-governance-card__meta">
            {{ sourceNameMap.get(version.source || "") || version.source || "来源未标注" }}
            · 更新 {{ formatGovernanceTime(version.updated_at) }}
          </div>
          <div
            v-if="version.checksum"
            class="route-governance-card__meta route-governance-card__meta--mono"
          >
            {{ version.checksum }}
          </div>
        </div>
      </section>
    </div>
  </a-card>
</template>
