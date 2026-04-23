<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from "vue-router";
import { DashboardOutlined, LoadingOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons-vue";
import { ConfigProvider } from "ant-design-vue";
import PageLoadingState from "./components/PageLoadingState.vue";
import {
    applyThemePreset,
    getThemePreset,
    type ThemePresetKey,
} from "./themes/industrial-compact";
import {
    ENTERPRISE_SETTINGS_EVENT,
    loadEnterpriseSettings,
    type EnterpriseSettings,
} from "./engine/enterprise-settings";
import {
    appRouteKeyByPath,
    appRouteMetaByKey,
    defaultRouteKey,
    getRouteMetaByPath,
    preloadRouteComponent,
} from "./router/route-meta";
import {
    getNavigationGroupByRouteKey,
    getNavigationSectionLabel,
    systemNavigationItems,
    toolNavigationGroups,
    workspaceNavigationGroup,
} from "./config/tool-navigation";
import { useStandardStore } from "./store/useStandardStore";

const OPEN_GROUPS_STORAGE_KEY = "mechbox-nav-open-groups";
const defaultOpenMenuKeys = ["design", "reference"];
const validGroupKeys = new Set(toolNavigationGroups.map((group) => group.key));
const spotlightRouteKeys = toolNavigationGroups.flatMap((group) =>
    group.children.filter((item) => item.spotlight).map((item) => item.key),
);
const workspaceRouteKeys = workspaceNavigationGroup.children.map((item) => item.key);

function loadStoredOpenMenuKeys() {
    try {
        const parsed = JSON.parse(localStorage.getItem(OPEN_GROUPS_STORAGE_KEY) ?? "[]");
        if (!Array.isArray(parsed)) {
            return [...defaultOpenMenuKeys];
        }

        const nextKeys = parsed
            .map((value) => String(value))
            .filter((value) => validGroupKeys.has(value));

        return nextKeys.length ? nextKeys : [...defaultOpenMenuKeys];
    } catch (_error) {
        return [...defaultOpenMenuKeys];
    }
}

function persistOpenMenuKeys(keys: string[]) {
    localStorage.setItem(
        OPEN_GROUPS_STORAGE_KEY,
        JSON.stringify(keys.filter((value, index, list) => validGroupKeys.has(value) && list.indexOf(value) === index)),
    );
}

const initialSettings = loadEnterpriseSettings();
const collapsed = ref(initialSettings.sidebarCollapsedByDefault);
const router = useRouter();
const route = useRoute();
const selectedKeys = ref([defaultRouteKey]);
const openMenuKeys = ref<string[]>(loadStoredOpenMenuKeys());
const standardStore = useStandardStore();
const themeKey = ref<ThemePresetKey>(initialSettings.theme);
const uiSettings = ref(initialSettings);
const routeLoading = ref(false);
let clearRouteLoadingTimer: number | null = null;
let idleRoutePreloadHandle: number | null = null;
let routePreloadTimer: number | null = null;

const removeRouteBeforeEach = router.beforeEach((to, from) => {
    if (to.fullPath !== from.fullPath) {
        routeLoading.value = true;
        if (clearRouteLoadingTimer !== null) {
            window.clearTimeout(clearRouteLoadingTimer);
            clearRouteLoadingTimer = null;
        }
    }
    return true;
});

const removeRouteAfterEach = router.afterEach(() => {
    clearRouteLoadingTimer = window.setTimeout(() => {
        routeLoading.value = false;
        clearRouteLoadingTimer = null;
    }, 140);
});

const removeRouteErrorHandler = router.onError(() => {
    routeLoading.value = false;
    if (clearRouteLoadingTimer !== null) {
        window.clearTimeout(clearRouteLoadingTimer);
        clearRouteLoadingTimer = null;
    }
});

async function navigateTo(key: string) {
    const target = appRouteMetaByKey[key];
    if (!target) {
        return;
    }

    primeRoute(key);

    selectedKeys.value = [key];
    const groupKey = getGroupKeyByRouteKey(key);
    if (groupKey && !openMenuKeys.value.includes(groupKey)) {
        openMenuKeys.value = [...openMenuKeys.value, groupKey];
    }

    if (route.path === target.path) {
        return;
    }

    const failure = await router.push(target.path);
    if (failure && !isNavigationFailure(failure, NavigationFailureType.duplicated)) {
        await router.replace(appRouteMetaByKey[defaultRouteKey].path);
    }
}

function getGroupKeyByRouteKey(routeKey: string) {
    return getNavigationGroupByRouteKey(routeKey)?.key;
}

function primeRoute(routeKey: string) {
    if (routeKey === currentRouteKey.value) {
        return;
    }

    void preloadRouteComponent(routeKey).catch(() => undefined);
}

function isRouteActive(key: string) {
    return selectedKeys.value.includes(key);
}

function isGroupOpen(key: string) {
    return openMenuKeys.value.includes(key);
}

const currentRouteKey = computed(() => appRouteKeyByPath[route.path] ?? defaultRouteKey);
const currentRouteMeta = computed(() => getRouteMetaByPath(route.path) ?? appRouteMetaByKey[defaultRouteKey]);
const currentSectionLabel = computed(() => getNavigationSectionLabel(currentRouteKey.value));
const currentHeaderHint = computed(() => {
    if (!uiSettings.value.showPageDescriptions) {
        return "";
    }
    if (currentRouteKey.value === "dashboard") {
        return "从这里直接进入常用设计计算、资料检索和分析工具。";
    }
    if (currentSectionLabel.value === "工具") {
        return "先完成计算与筛选，再把需要沉淀的内容送入工作区。";
    }
    if (currentSectionLabel.value === "工作区") {
        return "这里用于沉淀项目、报告、文档和收藏记录。";
    }
    return "这里管理主题偏好、版本信息和系统级设置。";
});
const activeTheme = computed(() => getThemePreset(themeKey.value));
const sidebarToggleLabel = computed(() => (collapsed.value ? "展开左侧导航" : "收起左侧导航"));
const headerStatusNote = computed(() => (routeLoading.value ? "正在切换页面" : "离线工程工具箱"));

function flushRoutePreload(routeKeys: string[]) {
    const nextKeys = [...new Set(routeKeys)].filter((key) => key && key !== currentRouteKey.value);
    if (!nextKeys.length) {
        return;
    }

    void Promise.allSettled(nextKeys.map((key) => preloadRouteComponent(key)));
}

function cancelScheduledRoutePreload() {
    if (idleRoutePreloadHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleRoutePreloadHandle);
        idleRoutePreloadHandle = null;
    }

    if (routePreloadTimer !== null) {
        window.clearTimeout(routePreloadTimer);
        routePreloadTimer = null;
    }
}

function getIdlePreloadRouteKeys(routeKey: string) {
    const preloadKeys = new Set<string>();

    if (routeKey === "dashboard") {
        spotlightRouteKeys.forEach((key) => preloadKeys.add(key));
        workspaceRouteKeys.slice(0, 3).forEach((key) => preloadKeys.add(key));
        return [...preloadKeys];
    }

    const currentGroup = getNavigationGroupByRouteKey(routeKey);
    currentGroup?.children.forEach((item) => preloadKeys.add(item.key));

    if (currentSectionLabel.value === "工具") {
        preloadKeys.add("projects");
        preloadKeys.add("reports");
    } else if (currentSectionLabel.value === "工作区") {
        workspaceRouteKeys.forEach((key) => preloadKeys.add(key));
    }

    return [...preloadKeys];
}

function scheduleIdleRoutePreload(routeKey: string) {
    cancelScheduledRoutePreload();
    const nextKeys = getIdlePreloadRouteKeys(routeKey);
    if (!nextKeys.length) {
        return;
    }

    const runPreload = () => {
        idleRoutePreloadHandle = null;
        routePreloadTimer = null;
        flushRoutePreload(nextKeys);
    };

    if (typeof window.requestIdleCallback === "function") {
        idleRoutePreloadHandle = window.requestIdleCallback(() => {
            runPreload();
        }, { timeout: 1200 });
        return;
    }

    routePreloadTimer = window.setTimeout(runPreload, 220);
}

watch(
    () => route.path,
    (path) => {
        const routeKey = appRouteKeyByPath[path] ?? defaultRouteKey;
        selectedKeys.value = [routeKey];
        const groupKey = getGroupKeyByRouteKey(routeKey);
        if (groupKey && !openMenuKeys.value.includes(groupKey)) {
            openMenuKeys.value = [...openMenuKeys.value, groupKey];
        }
    },
    { immediate: true },
);

watch(
    openMenuKeys,
    (keys) => {
        persistOpenMenuKeys(keys);
    },
    { deep: true },
);

watch(
    currentRouteKey,
    (routeKey) => {
        scheduleIdleRoutePreload(routeKey);
    },
    { immediate: true },
);

function toggleGroup(groupKey: string) {
    if (collapsed.value) {
        collapsed.value = false;
        if (!openMenuKeys.value.includes(groupKey)) {
            openMenuKeys.value = [...openMenuKeys.value, groupKey];
        }
        const group = toolNavigationGroups.find((item) => item.key === groupKey);
        if (group) {
            flushRoutePreload(group.children.map((item) => item.key));
        }
        return;
    }

    if (openMenuKeys.value.includes(groupKey)) {
        openMenuKeys.value = openMenuKeys.value.filter((key) => key !== groupKey);
        return;
    }

    openMenuKeys.value = [...openMenuKeys.value, groupKey];
    const group = toolNavigationGroups.find((item) => item.key === groupKey);
    if (group) {
        flushRoutePreload(group.children.map((item) => item.key));
    }
}

function getRouteTooltip(routeKey: string) {
    const meta = appRouteMetaByKey[routeKey];
    if (!meta) {
        return "";
    }

    return [meta.title, meta.description].filter(Boolean).join(" · ");
}

function toggleSidebar() {
    collapsed.value = !collapsed.value;
}

onMounted(() => {
    standardStore.loadPersistedState();
    applyThemePreset(themeKey.value);
    window.addEventListener(ENTERPRISE_SETTINGS_EVENT, handleSettingsUpdated);
});

onBeforeUnmount(() => {
    window.removeEventListener(ENTERPRISE_SETTINGS_EVENT, handleSettingsUpdated);
    removeRouteBeforeEach();
    removeRouteAfterEach();
    removeRouteErrorHandler();
    cancelScheduledRoutePreload();
    if (clearRouteLoadingTimer !== null) {
        window.clearTimeout(clearRouteLoadingTimer);
    }
});

function handleSettingsUpdated(event: Event) {
    const detail = (event as CustomEvent<EnterpriseSettings>).detail;
    if (!detail) {
        return;
    }

    uiSettings.value = detail;
    themeKey.value = detail.theme;
    applyThemePreset(detail.theme);
}
</script>

<template>
    <ConfigProvider :theme="activeTheme.antdTheme">
        <a-layout class="app-shell">
            <a-layout-sider
                v-model:collapsed="collapsed"
                collapsible
                :trigger="null"
                :width="252"
                :collapsed-width="72"
                class="sider"
            >
                <div class="logo">
                    <span class="logo-mark">MB</span>
                    <div v-if="!collapsed" class="logo-copy">
                        <div class="logo-title">MechBox</div>
                        <div v-if="uiSettings.showPageDescriptions" class="logo-subtitle">Mechanical Design Toolbox</div>
                    </div>
                </div>

                <nav class="menu-scroll" aria-label="主导航">
                    <section class="sidebar-section">
                        <div v-if="!collapsed" class="sidebar-section__label">工具启动</div>
                        <button
                            type="button"
                            class="sidebar-item is-root"
                            :class="{ 'is-active': isRouteActive('dashboard') }"
                            :aria-current="isRouteActive('dashboard') ? 'page' : undefined"
                            @mouseenter="primeRoute('dashboard')"
                            @focus="primeRoute('dashboard')"
                            @click="navigateTo('dashboard')"
                        >
                            <span class="sidebar-item__mainline">
                                <DashboardOutlined class="sidebar-item__icon" />
                                <span v-if="!collapsed" class="sidebar-item__label">工具启动台</span>
                            </span>
                        </button>
                    </section>

                    <section class="sidebar-section">
                        <div v-if="!collapsed" class="sidebar-section__label">工具分类</div>

                        <section
                            v-for="group in toolNavigationGroups"
                            :key="group.key"
                            class="sidebar-group"
                        >
                            <button
                                type="button"
                                class="sidebar-group__header"
                                :class="{ 'is-open': isGroupOpen(group.key) }"
                                :aria-expanded="isGroupOpen(group.key)"
                                :title="group.description"
                                @click="toggleGroup(group.key)"
                            >
                                <span class="sidebar-item__mainline">
                                    <component :is="group.icon" class="sidebar-item__icon" />
                                    <span v-if="!collapsed" class="sidebar-item__label">{{ group.title }}</span>
                                </span>
                                <span v-if="!collapsed" class="sidebar-group__arrow">{{ isGroupOpen(group.key) ? "⌄" : "›" }}</span>
                            </button>

                            <div v-if="isGroupOpen(group.key) && !collapsed" class="sidebar-group__items">
                                <button
                                    v-for="item in group.children"
                                    :key="item.key"
                                    type="button"
                                    class="sidebar-item is-child"
                                    :class="{ 'is-active': isRouteActive(item.key) }"
                                    :aria-current="isRouteActive(item.key) ? 'page' : undefined"
                                    :title="getRouteTooltip(item.key)"
                                    @mouseenter="primeRoute(item.key)"
                                    @focus="primeRoute(item.key)"
                                    @click="navigateTo(item.key)"
                                >
                                    <span class="sidebar-item__mainline">
                                        <component :is="item.icon" class="sidebar-item__icon" />
                                        <span class="sidebar-item__label">{{ item.label }}</span>
                                    </span>
                                </button>
                            </div>
                        </section>
                    </section>

                    <section class="sidebar-section">
                        <div v-if="!collapsed" class="sidebar-section__label">工作区</div>
                        <button
                            v-for="item in workspaceNavigationGroup.children"
                            :key="item.key"
                            type="button"
                            class="sidebar-item"
                            :class="{ 'is-active': isRouteActive(item.key) }"
                            :aria-current="isRouteActive(item.key) ? 'page' : undefined"
                            :title="getRouteTooltip(item.key)"
                            @mouseenter="primeRoute(item.key)"
                            @focus="primeRoute(item.key)"
                            @click="navigateTo(item.key)"
                        >
                            <span class="sidebar-item__mainline">
                                <component :is="item.icon" class="sidebar-item__icon" />
                                <span v-if="!collapsed" class="sidebar-item__label">{{ item.label }}</span>
                            </span>
                        </button>
                    </section>
                </nav>

                <div class="system-bar">
                    <div v-if="!collapsed" class="sidebar-section__label sidebar-section__label--system">系统</div>
                    <button
                        v-for="item in systemNavigationItems"
                        :key="item.key"
                        type="button"
                        class="sidebar-item"
                        :class="{ 'is-active': isRouteActive(item.key) }"
                        :aria-current="isRouteActive(item.key) ? 'page' : undefined"
                        :title="getRouteTooltip(item.key)"
                        @mouseenter="primeRoute(item.key)"
                        @focus="primeRoute(item.key)"
                        @click="navigateTo(item.key)"
                    >
                        <span class="sidebar-item__mainline">
                            <component :is="item.icon" class="sidebar-item__icon" />
                            <span v-if="!collapsed" class="sidebar-item__label">{{ item.label }}</span>
                        </span>
                    </button>
                </div>
            </a-layout-sider>

            <a-layout class="app-main-shell">
                <div class="route-progress" :class="{ 'is-active': routeLoading }" aria-hidden="true">
                    <span class="route-progress__bar" />
                </div>

                <a-layout-header class="app-header" :class="{ 'is-routing': routeLoading }">
                    <div class="app-header-main">
                        <div class="app-header-leading">
                            <a-button
                                type="text"
                                class="app-header-toggle"
                                :aria-label="sidebarToggleLabel"
                                :title="sidebarToggleLabel"
                                @click="toggleSidebar"
                            >
                                <template #icon>
                                    <MenuUnfoldOutlined v-if="collapsed" />
                                    <MenuFoldOutlined v-else />
                                </template>
                            </a-button>

                            <div class="app-header-copy">
                                <div class="app-group">{{ currentSectionLabel }}</div>
                                <div class="app-title">{{ currentRouteMeta.title }}</div>
                                <div v-if="uiSettings.showPageDescriptions" class="app-subtitle">{{ currentRouteMeta.description }}</div>
                            </div>
                        </div>
                        <div class="app-header-side">
                            <div class="app-header-chip-row">
                                <div class="app-header-chip">{{ activeTheme.shortLabel }} 主题</div>
                                <div v-if="routeLoading" class="app-header-chip app-header-chip--loading">
                                    <LoadingOutlined />
                                    <span>页面切换中</span>
                                </div>
                            </div>
                            <div v-if="uiSettings.showPageDescriptions" class="app-header-note">{{ headerStatusNote }}</div>
                            <div v-if="currentHeaderHint" class="app-header-meta">{{ currentHeaderHint }}</div>
                        </div>
                    </div>
                </a-layout-header>

                <a-layout-content class="app-content">
                    <div class="page-stage" :class="{ 'is-routing': routeLoading }" :aria-busy="routeLoading">
                        <div v-if="routeLoading" class="page-stage__overlay" aria-hidden="true">
                            <PageLoadingState
                                :title="`正在加载 ${currentRouteMeta.title}`"
                                :description="currentRouteMeta.description"
                                :side-cards="3"
                                :main-cards="2"
                            />
                        </div>
                        <router-view v-slot="{ Component, route: slotRoute }">
                            <transition name="route-stage" mode="out-in">
                                <component :is="Component" :key="slotRoute.fullPath" />
                            </transition>
                        </router-view>
                    </div>
                </a-layout-content>
            </a-layout>
        </a-layout>
    </ConfigProvider>
</template>

<style scoped>
.app-shell {
    height: 100vh;
    overflow: hidden;
    background:
        radial-gradient(circle at top right, var(--app-bg-accent) 0, transparent 22%),
        linear-gradient(180deg, var(--app-bg) 0%, var(--app-bg) 100%);
}

.app-shell :deep(.ant-layout) {
    min-height: 0;
}

.app-main-shell {
    position: relative;
}

.sider {
    height: 100vh !important;
    max-height: 100vh !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    background: var(--sidebar-bg);
    box-shadow: inset -1px 0 0 var(--sidebar-border);
}

.sider :deep(.ant-layout-sider-children) {
    height: 100vh !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
}

.logo {
    margin: 16px 16px 12px;
    padding: 12px;
    background: var(--sidebar-panel);
    border: 1px solid var(--sidebar-border);
    border-radius: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--sidebar-text);
    box-shadow: var(--shadow-soft);
}

.logo-mark {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft-strong) 100%);
    color: white;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    flex-shrink: 0;
}

.logo-copy {
    min-width: 0;
}

.logo-title {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.03em;
}

.logo-subtitle {
    margin-top: 2px;
    color: var(--sidebar-text-muted);
    font-size: 11px;
    line-height: 1.3;
}

.menu-scroll {
    flex: 1 1 0 !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding-bottom: 12px;
    scrollbar-gutter: stable;
}

.menu-scroll::-webkit-scrollbar {
    width: 4px;
}

.menu-scroll::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--sidebar-text-muted) 40%, transparent);
    border-radius: 2px;
}

.sidebar-section {
    display: grid;
    gap: 4px;
    padding-top: 2px;
}

.sidebar-section + .sidebar-section {
    margin-top: 8px;
}

.sidebar-section__label {
    margin: 0 18px 4px;
    color: var(--sidebar-text-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.sidebar-section__label--system {
    margin-top: 2px;
}

.sidebar-group {
    display: grid;
    gap: 4px;
}

.sidebar-group__items {
    display: grid;
    gap: 4px;
}

.sidebar-group__header,
.sidebar-item {
    width: calc(100% - 20px);
    margin: 0 10px;
    min-height: 38px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--sidebar-text-muted);
    padding: 0 12px;
    text-align: left;
    cursor: pointer;
    user-select: none;
    -webkit-user-drag: none;
    transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.sidebar-group__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.sidebar-item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.sidebar-item.is-root,
.sidebar-group__header {
    font-weight: 700;
    color: var(--sidebar-text);
}

.sidebar-item.is-child {
    min-height: 34px;
    padding-left: 26px;
}

.sidebar-item__mainline {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.sidebar-item__icon {
    font-size: 14px;
    flex-shrink: 0;
}

.sidebar-item__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sidebar-group__arrow {
    font-size: 16px;
    line-height: 1;
    color: var(--sidebar-text-muted);
}

.sidebar-item:hover,
.sidebar-group__header:hover {
    color: var(--sidebar-text);
    background: var(--sidebar-panel);
}

.sidebar-item.is-active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
    font-weight: 700;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sidebar-active-text) 18%, transparent);
}

.system-bar {
    border-top: 1px solid var(--sidebar-border);
    flex-shrink: 0;
    display: grid;
    gap: 4px;
    padding: 10px 0 14px;
}

.route-progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    height: 3px;
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.18s ease;
}

.route-progress.is-active {
    opacity: 1;
}

.route-progress__bar {
    display: block;
    width: 42%;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent 0%, var(--accent) 24%, var(--accent-soft-strong) 100%);
    transform: translateX(-130%);
    animation: route-progress-slide 1s ease-in-out infinite;
}

.app-header {
    background: var(--header-bg);
    backdrop-filter: blur(16px);
    padding: 16px 24px 14px;
    border-bottom: 1px solid var(--header-border);
    line-height: 1.2;
    height: auto;
}

.app-header.is-routing {
    box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--accent) 20%, var(--header-border));
}

.app-header-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
}

.app-header-leading {
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.app-header-toggle {
    flex-shrink: 0;
    margin-top: 2px;
    border-radius: 12px;
    color: var(--header-title);
    background: color-mix(in srgb, var(--surface-base) 72%, transparent);
    border: 1px solid color-mix(in srgb, var(--header-border) 82%, transparent);
    box-shadow: var(--shadow-soft);
}

.app-header-toggle:hover {
    color: var(--accent);
    background: color-mix(in srgb, var(--surface-base) 88%, var(--app-bg-accent));
    border-color: color-mix(in srgb, var(--accent) 20%, var(--header-border));
}

.app-header-copy {
    min-width: 0;
}

.app-group {
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.app-title {
    margin-top: 6px;
    font-size: 24px;
    font-weight: 800;
    color: var(--header-title);
    letter-spacing: -0.02em;
}

.app-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: var(--header-subtitle);
    line-height: 1.55;
    max-width: 780px;
}

.app-header-side {
    min-width: min(320px, 100%);
    display: grid;
    justify-items: end;
    gap: 6px;
    text-align: right;
}

.app-header-chip-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
}

.app-header-chip {
    white-space: nowrap;
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--header-badge-bg);
    color: var(--header-badge-text);
    border: 1px solid var(--header-badge-border);
    font-size: 12px;
    font-weight: 600;
}

.app-header-chip--loading {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: color-mix(in srgb, var(--accent) 12%, var(--surface-base));
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 18%, var(--header-badge-border));
}

.app-header-note {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 700;
}

.app-header-meta {
    max-width: 320px;
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.6;
}

.app-content {
    flex: 1 1 auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    background:
        radial-gradient(circle at top right, var(--app-bg-accent) 0, transparent 18%),
        linear-gradient(180deg, var(--app-bg) 0%, var(--app-bg) 100%);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
}

.app-content::-webkit-scrollbar {
    width: 6px;
}

.app-content::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--text-tertiary) 65%, transparent);
    border-radius: 3px;
}

.app-content::-webkit-scrollbar-track {
    background: transparent;
}

.page-stage {
    position: relative;
    width: min(100%, 1560px);
    margin: 0 auto;
    padding: 22px 22px 26px;
    min-height: 100%;
    box-sizing: border-box;
    transition: opacity 0.18s ease, filter 0.18s ease;
}

.page-stage.is-routing {
    opacity: 0.9;
    filter: saturate(0.96);
}

.page-stage__overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    padding: 22px 22px 26px;
    background:
        linear-gradient(180deg, color-mix(in srgb, var(--app-bg) 72%, transparent) 0%, color-mix(in srgb, var(--app-bg) 88%, transparent) 100%);
    backdrop-filter: blur(2px);
    pointer-events: none;
}

.route-stage-enter-active,
.route-stage-leave-active {
    transition: opacity 0.16s ease, transform 0.16s ease;
}

.route-stage-enter-from,
.route-stage-leave-to {
    opacity: 0;
    transform: translateY(8px);
}

@keyframes route-progress-slide {
    0% {
        transform: translateX(-130%);
    }
    100% {
        transform: translateX(330%);
    }
}

@media (max-width: 960px) {
    .app-header-main {
        flex-direction: column;
        align-items: flex-start;
    }

    .app-header-leading {
        width: 100%;
    }

    .app-header-side {
        justify-items: start;
        text-align: left;
    }

    .app-header-chip-row {
        justify-content: flex-start;
    }

    .page-stage {
        padding: 14px;
    }

    .page-stage__overlay {
        padding: 14px;
    }

    .app-header {
        padding: 14px 16px 12px;
    }
}

@media (max-width: 768px) {
    :deep(.ant-table-wrapper) {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    :deep(.ant-table) {
        min-width: 500px;
    }

    .page-stage {
        padding: 8px;
    }

    .page-stage__overlay {
        padding: 8px;
    }

    :deep(.ant-card-small .ant-card-body) {
        padding: 8px;
    }

    :deep(.ant-row) {
        margin: 0 !important;
    }

    :deep(.ant-col) {
        padding: 0 !important;
    }
}

@media (max-width: 480px) {
    .page-stage {
        padding: 8px;
    }

    .app-header-leading {
        gap: 10px;
    }

    .logo {
        margin: 12px 12px 10px;
        padding: 10px;
    }

    :deep(.ant-card) {
        border-radius: 4px;
    }

    :deep(.ant-descriptions-bordered) {
        font-size: 11px;
    }

    :deep(.ant-descriptions-item-label) {
        width: 35% !important;
        padding: 4px 6px !important;
    }

    :deep(.ant-descriptions-item-content) {
        padding: 4px 6px !important;
    }
}
</style>
