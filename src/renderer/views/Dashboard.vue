<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
    ArrowRightOutlined,
    ClockCircleOutlined,
    DatabaseOutlined,
    FolderOpenOutlined,
    SearchOutlined,
    StarOutlined,
    ToolOutlined,
} from "@ant-design/icons-vue";
import StateEmpty from "../components/StateEmpty.vue";
import { toolNavigationGroups, workspaceNavigationGroup } from "../config/tool-navigation";
import { appRouteMetaByKey, moduleRouteMap } from "../router/route-meta";
import { useStandardStore } from "../store/useStandardStore";
import { REPORTS_STORAGE_EVENT, loadStoredReports } from "../utils/reporting";
import { stageToolLaunchPayload } from "../utils/tool-launch";
import {
    WORKSPACE_STORAGE_EVENT,
    loadActiveProject,
    loadStoredProjects,
    type WorkspaceProject,
} from "../utils/workspace";

const router = useRouter();
const store = useStandardStore();
const rawIcon = <T extends object>(icon: T) => markRaw(icon);

const searchKeyword = ref("");
const projects = ref<WorkspaceProject[]>([]);
const activeProject = ref<WorkspaceProject | null>(null);
const reportCount = ref(0);

function syncWorkspaceState() {
    projects.value = loadStoredProjects();
    activeProject.value = loadActiveProject();
    reportCount.value = loadStoredReports().length;
}

onMounted(() => {
    syncWorkspaceState();
    window.addEventListener(WORKSPACE_STORAGE_EVENT, syncWorkspaceState);
    window.addEventListener(REPORTS_STORAGE_EVENT, syncWorkspaceState);
});

onBeforeUnmount(() => {
    window.removeEventListener(WORKSPACE_STORAGE_EVENT, syncWorkspaceState);
    window.removeEventListener(REPORTS_STORAGE_EVENT, syncWorkspaceState);
});

const allToolItems = computed(() =>
    toolNavigationGroups.flatMap((group) =>
        group.children.map((item) => ({
            ...item,
            groupKey: group.key,
            groupTitle: group.title,
            meta: appRouteMetaByKey[item.key],
        })),
    ),
);

const normalizedKeyword = computed(() => searchKeyword.value.trim().toLowerCase());

function matchesSearch(value: string, keyword: string) {
    return value.toLowerCase().includes(keyword);
}

const filteredToolGroups = computed(() => {
    if (!normalizedKeyword.value) {
        return toolNavigationGroups.map((group) => ({
            ...group,
            children: group.children.map((item) => ({
                ...item,
                meta: appRouteMetaByKey[item.key],
            })),
        }));
    }

    return toolNavigationGroups
        .map((group) => ({
            ...group,
            children: group.children
                .map((item) => ({
                    ...item,
                    meta: appRouteMetaByKey[item.key],
                }))
                .filter((item) => {
                    const searchPool = [
                        item.label,
                        item.summary,
                        item.meta?.title ?? "",
                        item.meta?.description ?? "",
                        ...(item.keywords ?? []),
                    ].join(" ");
                    return matchesSearch(searchPool, normalizedKeyword.value);
                }),
        }))
        .filter((group) => group.children.length > 0);
});

const filteredToolCount = computed(() =>
    filteredToolGroups.value.reduce((total, group) => total + group.children.length, 0),
);

const spotlightTools = computed(() =>
    allToolItems.value.filter((item) => item.spotlight).slice(0, 6),
);

const recentCalculations = computed(() => store.recentCalculations.slice(0, 6));
const recentFavorites = computed(() => store.favorites.slice(0, 6));
const designAndDriveToolCount = computed(() =>
    toolNavigationGroups
        .filter((group) => group.key === "design" || group.key === "drive")
        .reduce((total, group) => total + group.children.length, 0),
);
const referenceToolCount = computed(() =>
    toolNavigationGroups
        .filter((group) => group.key === "reference")
        .reduce((total, group) => total + group.children.length, 0),
);

const overviewCards = computed(() => [
    {
        label: "工具模块",
        value: `${allToolItems.value.length}`,
        hint: "覆盖设计计算、资料查询与分析自动化",
        icon: rawIcon(ToolOutlined),
    },
    {
        label: "基础计算",
        value: `${designAndDriveToolCount.value}`,
        hint: "公差、密封、轴承、螺栓、齿轮、轴等",
        icon: rawIcon(ArrowRightOutlined),
    },
    {
        label: "资料入口",
        value: `${referenceToolCount.value}`,
        hint: "材料、标准件、单位与互换查询",
        icon: rawIcon(DatabaseOutlined),
    },
    {
        label: "工作区项目",
        value: `${projects.value.length}`,
        hint: activeProject.value ? `当前项目：${activeProject.value.name}` : "当前未选择活动项目",
        icon: rawIcon(FolderOpenOutlined),
    },
]);

function navigateTo(path: string) {
    void router.push(path);
}

function openModule(moduleKey: string) {
    const target = appRouteMetaByKey[moduleKey];
    void router.push(target?.path ?? "/");
}

function canResumeTool(module: string, data: unknown) {
    return Boolean(moduleRouteMap[module] && data && typeof data === "object");
}

function resumeTool(module: string, data: unknown, sourceLabel: string) {
    const route = moduleRouteMap[module];
    if (!route) return;
    stageToolLaunchPayload(module, data, sourceLabel);
    void router.push(route);
}

function getModuleLabel(moduleKey: string) {
    return appRouteMetaByKey[moduleKey]?.title ?? moduleKey;
}

function formatTime(value: string | number) {
    return new Date(value).toLocaleString();
}
</script>

<template>
    <div class="dashboard-page">
        <section class="dashboard-hero">
            <div class="dashboard-hero__main">
                <div class="dashboard-hero__eyebrow">Mechanical Design Toolbox</div>
                <h1>打开工具，输入参数，直接算。</h1>
                <p>
                    首页回到工具启动台，只保留高频工具入口、工作区入口和最近记录。
                    设计计算、标准查询、工程分析都从这里直接进入，不再先绕到管理视图。
                </p>

                <a-input
                    v-model:value="searchKeyword"
                    size="large"
                    class="dashboard-search"
                    placeholder="搜索工具、标准或关键词，例如 O 形圈、ISO 286、轴承寿命"
                    allow-clear
                >
                    <template #prefix>
                        <SearchOutlined />
                    </template>
                </a-input>

                <div class="dashboard-hero__actions">
                    <a-button type="primary" @click="openModule('seals')">打开密封圈</a-button>
                    <a-button @click="openModule('standard-parts')">打开标准件库</a-button>
                    <a-button @click="openModule('tolerances')">打开公差配合</a-button>
                </div>

                <div class="dashboard-stats">
                    <article
                        v-for="item in overviewCards"
                        :key="item.label"
                        class="dashboard-stat"
                    >
                        <div class="dashboard-stat__icon">
                            <component :is="item.icon" />
                        </div>
                        <div class="dashboard-stat__meta">
                            <div class="dashboard-stat__label">{{ item.label }}</div>
                            <div class="dashboard-stat__value">{{ item.value }}</div>
                            <div class="dashboard-stat__hint">{{ item.hint }}</div>
                        </div>
                    </article>
                </div>
            </div>

            <aside class="dashboard-hero__side">
                <div class="hero-panel">
                    <div class="hero-panel__eyebrow">工作区入口</div>
                    <div class="hero-panel__title">
                        {{ activeProject ? activeProject.name : "当前未选择活动项目" }}
                    </div>
                    <p class="hero-panel__desc">
                        {{
                            activeProject
                                ? `${getModuleLabel(activeProject.module)} · 最近更新 ${formatTime(activeProject.updatedAt)}`
                                : "如果需要沉淀项目、报告、文档或 BOM，就从这里进入工作区。"
                        }}
                    </p>
                    <div class="hero-panel__metrics">
                        <span>项目 {{ projects.length }}</span>
                        <span>报告 {{ reportCount }}</span>
                        <span>收藏 {{ recentFavorites.length }}</span>
                    </div>
                    <div class="workspace-grid">
                        <button
                            v-for="item in workspaceNavigationGroup.children"
                            :key="item.key"
                            type="button"
                            class="workspace-link"
                            @click="openModule(item.key)"
                        >
                            <component :is="item.icon" />
                            <span>{{ item.label }}</span>
                        </button>
                    </div>
                </div>
            </aside>
        </section>

        <div class="dashboard-grid">
            <section class="dashboard-main">
                <a-card title="常用工具" size="small" class="dashboard-card">
                    <div class="spotlight-grid">
                        <button
                            v-for="item in spotlightTools"
                            :key="item.key"
                            type="button"
                            class="tool-card"
                            @click="openModule(item.key)"
                        >
                            <div class="tool-card__icon">
                                <component :is="item.icon" />
                            </div>
                            <div class="tool-card__content">
                                <div class="tool-card__title-row">
                                    <h3>{{ item.label }}</h3>
                                    <ArrowRightOutlined />
                                </div>
                                <div class="tool-card__group">{{ item.groupTitle }}</div>
                                <p>{{ item.summary }}</p>
                            </div>
                        </button>
                    </div>
                </a-card>

                <a-card
                    :title="normalizedKeyword ? `搜索结果 (${filteredToolCount})` : '全部工具'"
                    size="small"
                    class="dashboard-card"
                >
                    <StateEmpty
                        v-if="filteredToolGroups.length === 0"
                        description="没有匹配的工具，换个关键词再试"
                    />
                    <div v-else class="group-stack">
                        <section
                            v-for="group in filteredToolGroups"
                            :key="group.key"
                            class="tool-group"
                        >
                            <header class="tool-group__header">
                                <div class="tool-group__title-wrap">
                                    <div class="tool-group__icon">
                                        <component :is="group.icon" />
                                    </div>
                                    <div>
                                        <h3>{{ group.title }}</h3>
                                        <p>{{ group.description }}</p>
                                    </div>
                                </div>
                                <span class="tool-group__count">{{ group.children.length }} 个</span>
                            </header>

                            <div class="tool-list">
                                <button
                                    v-for="item in group.children"
                                    :key="item.key"
                                    type="button"
                                    class="tool-list__item"
                                    @click="openModule(item.key)"
                                >
                                    <div class="tool-list__main">
                                        <component :is="item.icon" class="tool-list__item-icon" />
                                        <div>
                                            <div class="tool-list__item-title">{{ item.label }}</div>
                                            <div class="tool-list__item-desc">{{ item.summary }}</div>
                                        </div>
                                    </div>
                                    <ArrowRightOutlined class="tool-list__item-arrow" />
                                </button>
                            </div>
                        </section>
                    </div>
                </a-card>
            </section>

            <aside class="dashboard-side">
                <a-card :title="`最近计算 (${recentCalculations.length})`" size="small" class="dashboard-card">
                    <StateEmpty v-if="recentCalculations.length === 0" description="暂无最近计算" />
                    <a-list v-else :data-source="recentCalculations" size="small">
                        <template #renderItem="{ item }">
                            <a-list-item>
                                <a-list-item-meta>
                                    <template #title>{{ item.name }}</template>
                                    <template #description>
                                        {{ getModuleLabel(item.module) }} · {{ formatTime(item.createdAt) }}
                                    </template>
                                </a-list-item-meta>
                                <a-space wrap size="small">
                                    <a-button
                                        v-if="canResumeTool(item.module, item.data)"
                                        type="link"
                                        size="small"
                                        @click="resumeTool(item.module, item.data, '最近计算')"
                                    >
                                        恢复参数
                                    </a-button>
                                    <a-button type="link" size="small" @click="openModule(item.module)">空白打开</a-button>
                                </a-space>
                            </a-list-item>
                        </template>
                    </a-list>
                </a-card>

                <a-card :title="`我的收藏 (${recentFavorites.length})`" size="small" class="dashboard-card">
                    <template #extra>
                        <a-button type="link" size="small" @click="navigateTo('/favorites')">查看全部</a-button>
                    </template>
                    <StateEmpty v-if="recentFavorites.length === 0" description="暂无收藏" />
                    <a-list v-else :data-source="recentFavorites" size="small">
                        <template #renderItem="{ item }">
                            <a-list-item>
                                <a-list-item-meta>
                                    <template #title>{{ item.name }}</template>
                                    <template #description>
                                        {{ getModuleLabel(item.module) }} · {{ formatTime(item.createdAt) }}
                                    </template>
                                </a-list-item-meta>
                                <a-space wrap size="small">
                                    <a-button
                                        v-if="canResumeTool(item.module, item.data)"
                                        type="link"
                                        size="small"
                                        @click="resumeTool(item.module, item.data, '收藏配置')"
                                    >
                                        恢复参数
                                    </a-button>
                                    <a-button type="link" size="small" @click="openModule(item.module)">空白打开</a-button>
                                </a-space>
                            </a-list-item>
                        </template>
                    </a-list>
                </a-card>

                <a-card title="当前工作区" size="small" class="dashboard-card">
                    <div class="workspace-summary">
                        <div class="workspace-summary__title">
                            {{ activeProject ? activeProject.name : "未设置活动项目" }}
                        </div>
                        <div class="workspace-summary__desc">
                            {{
                                activeProject
                                    ? `${getModuleLabel(activeProject.module)} · ${activeProject.inputSummary || "已建立工作上下文"}`
                                    : "当某个工具结果需要版本管理、归档报告或文档整理时，再进入工作区。"
                            }}
                        </div>
                        <div class="workspace-summary__meta">
                            <span>项目 {{ projects.length }}</span>
                            <span>报告 {{ reportCount }}</span>
                        </div>
                    </div>
                    <div class="workspace-actions">
                        <a-button type="primary" block @click="navigateTo('/projects')">进入项目中心</a-button>
                        <a-button block @click="navigateTo('/reports')">进入报告中心</a-button>
                        <a-button block @click="navigateTo('/documents')">进入文档中心</a-button>
                    </div>
                </a-card>

                <a-card title="使用方式" size="small" class="dashboard-card">
                    <div class="guidance-list">
                        <div class="guidance-item">
                            <ToolOutlined />
                            <span>高频设计任务先从工具页处理，减少无关流程干扰。</span>
                        </div>
                        <div class="guidance-item">
                            <ClockCircleOutlined />
                            <span>最近计算现在可直接恢复参数，不再只是跳转到对应页面。</span>
                        </div>
                        <div class="guidance-item">
                            <StarOutlined />
                            <span>收藏更适合保存可复用模板，项目中心再负责正式版本和归档。</span>
                        </div>
                    </div>
                </a-card>
            </aside>
        </div>
    </div>
</template>

<style scoped>
.dashboard-page {
    display: grid;
    gap: 20px;
}

.dashboard-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.9fr);
    gap: 18px;
}

.dashboard-hero__main,
.dashboard-hero__side {
    min-width: 0;
}

.dashboard-hero__main {
    display: grid;
    gap: 14px;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid var(--content-border);
    background:
        radial-gradient(circle at top right, var(--app-bg-accent) 0, transparent 30%),
        linear-gradient(135deg, var(--surface-base) 0%, var(--surface-raised) 100%);
    box-shadow: var(--shadow-strong);
}

.dashboard-hero__eyebrow,
.hero-panel__eyebrow {
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.dashboard-hero__main h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 42px);
    line-height: 1.06;
    letter-spacing: -0.03em;
    color: var(--text-primary);
}

.dashboard-hero__main p {
    margin: 0;
    max-width: 760px;
    font-size: 14px;
    line-height: 1.75;
    color: var(--text-secondary);
}

.dashboard-search {
    max-width: 760px;
}

.dashboard-hero__actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.dashboard-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.dashboard-stat {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 12px;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid var(--content-border);
    background: color-mix(in srgb, var(--surface-base) 84%, transparent);
    box-shadow: var(--shadow-soft);
}

.dashboard-stat__icon {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--accent-soft);
    color: var(--accent-soft-strong);
    font-size: 18px;
}

.dashboard-stat__meta {
    display: grid;
    gap: 2px;
}

.dashboard-stat__label {
    color: var(--text-secondary);
    font-size: 12px;
}

.dashboard-stat__value {
    color: var(--text-primary);
    font-size: 24px;
    line-height: 1.1;
    font-weight: 800;
    font-family: var(--font-mono);
}

.dashboard-stat__hint {
    color: var(--text-tertiary);
    font-size: 11px;
    line-height: 1.45;
}

.hero-panel {
    height: 100%;
    display: grid;
    align-content: start;
    gap: 14px;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid var(--content-border);
    background: linear-gradient(180deg, var(--surface-base) 0%, var(--surface-raised) 100%);
    box-shadow: var(--shadow-soft);
}

.hero-panel__title {
    color: var(--text-primary);
    font-size: 24px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -0.02em;
}

.hero-panel__desc {
    margin: 0;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.7;
}

.hero-panel__metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.hero-panel__metrics span {
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--surface-raised);
    border: 1px solid var(--content-border);
    color: var(--text-secondary);
    font-size: 12px;
}

.workspace-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.workspace-link {
    border: 1px solid var(--content-border);
    background: var(--surface-base);
    border-radius: 16px;
    padding: 12px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    justify-content: flex-start;
    color: var(--text-primary);
    cursor: pointer;
    box-shadow: var(--shadow-soft);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.workspace-link:hover,
.tool-card:hover,
.tool-list__item:hover {
    transform: translateY(-1px);
    border-color: var(--accent-border);
    box-shadow: var(--shadow-strong);
}

.dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
    gap: 18px;
}

.dashboard-main,
.dashboard-side {
    display: grid;
    gap: 18px;
    align-content: start;
}

.dashboard-card {
    border-radius: 18px;
}

.spotlight-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.tool-card {
    border: 1px solid var(--content-border);
    background: var(--surface-base);
    border-radius: 18px;
    padding: 16px;
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 14px;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--shadow-soft);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.tool-card__icon,
.tool-group__icon {
    width: 48px;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    background: var(--accent-soft);
    color: var(--accent-soft-strong);
    font-size: 22px;
}

.tool-card__content {
    display: grid;
    gap: 6px;
}

.tool-card__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: var(--text-primary);
}

.tool-card__title-row h3,
.tool-group__header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
}

.tool-card__group {
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.tool-card p,
.tool-group__header p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.65;
}

.group-stack {
    display: grid;
    gap: 14px;
}

.tool-group {
    border: 1px solid var(--content-border);
    border-radius: 18px;
    background: var(--surface-base);
    padding: 16px;
    box-shadow: var(--shadow-soft);
}

.tool-group__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
}

.tool-group__title-wrap {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
}

.tool-group__count {
    flex-shrink: 0;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--surface-raised);
    border: 1px solid var(--content-border);
    color: var(--text-secondary);
    font-size: 12px;
    font-family: var(--font-mono);
}

.tool-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.tool-list__item {
    border: 1px solid var(--content-border);
    background: var(--surface-raised);
    border-radius: 16px;
    padding: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
    text-align: left;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.tool-list__main {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.tool-list__item-icon {
    margin-top: 2px;
    color: var(--accent-soft-strong);
    font-size: 18px;
}

.tool-list__item-title {
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 700;
}

.tool-list__item-desc {
    margin-top: 3px;
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.6;
}

.tool-list__item-arrow {
    color: var(--text-tertiary);
    flex-shrink: 0;
}

.workspace-summary {
    display: grid;
    gap: 10px;
}

.workspace-summary__title {
    color: var(--text-primary);
    font-size: 18px;
    font-weight: 800;
}

.workspace-summary__desc {
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.7;
}

.workspace-summary__meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.workspace-summary__meta span {
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--surface-raised);
    border: 1px solid var(--content-border);
    color: var(--text-secondary);
    font-size: 12px;
}

.workspace-actions {
    display: grid;
    gap: 10px;
    margin-top: 14px;
}

.guidance-list {
    display: grid;
    gap: 12px;
}

.guidance-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.7;
}

.guidance-item :deep(svg) {
    color: var(--accent-soft-strong);
    margin-top: 3px;
}

@media (max-width: 1100px) {
    .dashboard-hero,
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 768px) {
    .dashboard-hero__main,
    .hero-panel {
        padding: 18px;
        border-radius: 20px;
    }

    .dashboard-stats,
    .workspace-grid,
    .spotlight-grid,
    .tool-list {
        grid-template-columns: 1fr;
    }

    .tool-card {
        grid-template-columns: 42px 1fr;
        padding: 14px;
    }

    .tool-group__header {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
