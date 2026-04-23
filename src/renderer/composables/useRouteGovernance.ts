import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getRouteMetaByPath } from "@renderer/router/route-meta";
import { getGovernanceSnapshot, resolveGovernanceRefs } from "@renderer/utils/data-governance";

export function useRouteGovernance() {
  const route = useRoute();
  const currentRouteMeta = computed(() => getRouteMetaByPath(route.path));
  const resolvedGovernance = ref<ReturnType<typeof resolveGovernanceRefs> | null>(null);

  const hasGovernanceRefs = computed(() => {
    const refs = currentRouteMeta.value?.governanceRefs;
    return !!(refs?.sourceIds?.length || refs?.datasetIds?.length || refs?.versionCodes?.length);
  });

  const runtimeModeLabel = computed(() =>
    resolvedGovernance.value?.mode === "sqlite" ? "SQLite 治理表" : "内置治理快照",
  );

  const runtimeModeNote = computed(() =>
    resolvedGovernance.value?.mode === "sqlite"
      ? "当前页面的来源链直接由 SQLite 治理表解析生成。"
      : "当前处于浏览器预览或降级模式，来源链使用仓库内置治理快照补齐。",
  );

  const sourceNameMap = computed(() => {
    const map = new Map<string, string>();
    for (const source of resolvedGovernance.value?.sources ?? []) {
      map.set(source.source_id, source.source_name);
    }
    return map;
  });

  const topSourceNames = computed(() => {
    return (resolvedGovernance.value?.sources ?? []).slice(0, 3).map((source) => source.source_name);
  });

  const topVersionCodes = computed(() => {
    return (resolvedGovernance.value?.versions ?? []).slice(0, 3).map((version) => version.standard_code);
  });

  const governanceSummary = computed(() => {
    if (!resolvedGovernance.value) {
      return "";
    }

    const parts: string[] = [
      `${runtimeModeLabel.value}`,
      `${resolvedGovernance.value.sources.length} 来源`,
      `${resolvedGovernance.value.datasets.length} 数据集`,
    ];

    if (resolvedGovernance.value.versions.length) {
      parts.push(`${resolvedGovernance.value.versions.length} 版本记录`);
    }

    if (topSourceNames.value.length) {
      parts.push(`覆盖 ${topSourceNames.value.join("、")}`);
    }

    return parts.join(" · ");
  });

  async function refreshGovernance() {
    if (!hasGovernanceRefs.value) {
      resolvedGovernance.value = null;
      return;
    }
    const snapshot = await getGovernanceSnapshot();
    resolvedGovernance.value = resolveGovernanceRefs(currentRouteMeta.value?.governanceRefs, snapshot);
  }

  watch(
    () => route.path,
    () => {
      void refreshGovernance();
    },
    { immediate: true },
  );

  return {
    currentRouteMeta,
    hasGovernanceRefs,
    resolvedGovernance,
    runtimeModeLabel,
    runtimeModeNote,
    sourceNameMap,
    topSourceNames,
    topVersionCodes,
    governanceSummary,
    refreshGovernance,
  };
}
