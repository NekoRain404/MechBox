import { defaultThemePresetKey, normalizeThemePreset, type ThemePresetKey } from "../themes/industrial-compact"

export const ENTERPRISE_SETTINGS_EVENT = "mechbox:settings-updated"
export const ENTERPRISE_SETTINGS_STORAGE_KEY = "mechbox-enterprise-settings"
export const LAST_ROUTE_STORAGE_KEY = "mechbox-last-route"

export type StartupRouteMode = "dashboard" | "last-route" | "projects" | "favorites"

/**
 * Section 9: 企业级系统配置与管控中枢
 * 计算引擎调优、知识库管理、CAD联动、报告合规、启动体验
 */
export interface EnterpriseSettings {
  // 基础设置
  language: "zh-CN" | "en-US"
  theme: ThemePresetKey
  showWelcomeOnStart: boolean
  startupRouteMode: StartupRouteMode
  rememberLastRoute: boolean
  showStartupAnimation: boolean
  startupAnimationDurationMs: number
  compactMode: boolean
  reduceMotion: boolean
  sidebarCollapsedByDefault: boolean
  showPageDescriptions: boolean

  // 9.1 求解器与引擎调优
  globalSafetyFactor: number
  solverMaxIterations: number
  solverTolerance: number
  monteCarloThreads: number

  // 9.2 知识库与数据隔离
  strictOfflineMode: boolean
  standardPrecedence: string[]
  dbPathOverride: string

  // 9.3 CAD 联动配置
  defaultCADTarget: "solidworks" | "inventor" | "freecad" | "autocad"
  websocketPort: number

  // 9.4 报告与合规模板
  companyName: string
  defaultAuthor: string
  defaultReviewer: string
  companyLogo: string
  disclaimerText: string
}

type PartialEnterpriseSettings = Partial<EnterpriseSettings>

export const defaultEnterpriseSettings: EnterpriseSettings = {
  language: "zh-CN",
  theme: defaultThemePresetKey,
  showWelcomeOnStart: true,
  startupRouteMode: "dashboard",
  rememberLastRoute: true,
  showStartupAnimation: true,
  startupAnimationDurationMs: 320,
  compactMode: false,
  reduceMotion: false,
  sidebarCollapsedByDefault: false,
  showPageDescriptions: true,

  globalSafetyFactor: 1.5,
  solverMaxIterations: 100,
  solverTolerance: 1e-8,
  monteCarloThreads: 4,

  strictOfflineMode: false,
  standardPrecedence: ["custom", "GB/T", "ISO", "DIN", "JIS"],
  dbPathOverride: "",

  defaultCADTarget: "solidworks",
  websocketPort: 8321,

  companyName: "",
  defaultAuthor: "",
  defaultReviewer: "",
  companyLogo: "",
  disclaimerText: "本计算书仅供参考，实际设计需经专业工程师审核确认。",
}

function normalizeStartupRouteMode(
  startupRouteMode: unknown,
  legacyShowWelcomeOnStart: unknown,
): StartupRouteMode {
  if (
    startupRouteMode === "dashboard" ||
    startupRouteMode === "last-route" ||
    startupRouteMode === "projects" ||
    startupRouteMode === "favorites"
  ) {
    return startupRouteMode
  }

  return legacyShowWelcomeOnStart === false ? "last-route" : "dashboard"
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function normalizeEnterpriseSettings(input?: PartialEnterpriseSettings): EnterpriseSettings {
  const merged = { ...defaultEnterpriseSettings, ...(input ?? {}) }
  const startupRouteMode = normalizeStartupRouteMode(input?.startupRouteMode, input?.showWelcomeOnStart)

  return {
    ...merged,
    theme: normalizeThemePreset(merged.theme),
    startupRouteMode,
    showWelcomeOnStart: startupRouteMode === "dashboard",
    rememberLastRoute: input?.rememberLastRoute === undefined ? merged.rememberLastRoute : Boolean(input.rememberLastRoute),
    showStartupAnimation: input?.showStartupAnimation === undefined ? merged.showStartupAnimation : Boolean(input.showStartupAnimation),
    startupAnimationDurationMs: clampNumber(input?.startupAnimationDurationMs, merged.startupAnimationDurationMs, 180, 2200),
    compactMode: input?.compactMode === undefined ? merged.compactMode : Boolean(input.compactMode),
    reduceMotion: input?.reduceMotion === undefined ? merged.reduceMotion : Boolean(input.reduceMotion),
    sidebarCollapsedByDefault:
      input?.sidebarCollapsedByDefault === undefined
        ? merged.sidebarCollapsedByDefault
        : Boolean(input.sidebarCollapsedByDefault),
    showPageDescriptions:
      input?.showPageDescriptions === undefined ? merged.showPageDescriptions : Boolean(input.showPageDescriptions),
    globalSafetyFactor: clampNumber(input?.globalSafetyFactor, merged.globalSafetyFactor, 1, 3),
    solverMaxIterations: clampNumber(input?.solverMaxIterations, merged.solverMaxIterations, 10, 5000),
    solverTolerance: clampNumber(input?.solverTolerance, merged.solverTolerance, 1e-12, 1e-4),
    monteCarloThreads: clampNumber(input?.monteCarloThreads, merged.monteCarloThreads, 1, 64),
    strictOfflineMode: input?.strictOfflineMode === undefined ? merged.strictOfflineMode : Boolean(input.strictOfflineMode),
    standardPrecedence: Array.isArray(input?.standardPrecedence)
      ? input.standardPrecedence.map((item) => String(item)).filter(Boolean)
      : merged.standardPrecedence,
    dbPathOverride: String(merged.dbPathOverride ?? ""),
    defaultCADTarget:
      merged.defaultCADTarget === "inventor" ||
      merged.defaultCADTarget === "freecad" ||
      merged.defaultCADTarget === "autocad"
        ? merged.defaultCADTarget
        : "solidworks",
    websocketPort: clampNumber(input?.websocketPort, merged.websocketPort, 1024, 65535),
    companyName: String(merged.companyName ?? ""),
    defaultAuthor: String(merged.defaultAuthor ?? ""),
    defaultReviewer: String(merged.defaultReviewer ?? ""),
    companyLogo: String(merged.companyLogo ?? ""),
    disclaimerText: String(merged.disclaimerText ?? ""),
  }
}

export function sanitizeEnterpriseSettings(input?: PartialEnterpriseSettings): EnterpriseSettings {
  return normalizeEnterpriseSettings(input)
}

export const loadEnterpriseSettings = (): EnterpriseSettings => {
  try {
    const saved = localStorage.getItem(ENTERPRISE_SETTINGS_STORAGE_KEY)
    if (saved) {
      return normalizeEnterpriseSettings(JSON.parse(saved) as PartialEnterpriseSettings)
    }
  } catch (_error) {
    // ignore
  }

  return normalizeEnterpriseSettings()
}

export function applyEnterpriseDisplaySettings(settings: EnterpriseSettings): void {
  if (typeof document === "undefined") return

  document.documentElement.dataset.uiDensity = settings.compactMode ? "compact" : "comfortable"
  document.documentElement.dataset.motion = settings.reduceMotion ? "reduced" : "normal"
  document.documentElement.dataset.pageDescriptions = settings.showPageDescriptions ? "shown" : "hidden"
  document.documentElement.dataset.sidebarDefault = settings.sidebarCollapsedByDefault ? "collapsed" : "expanded"
}

export const saveEnterpriseSettings = (settings: EnterpriseSettings): void => {
  const normalized = normalizeEnterpriseSettings(settings)
  localStorage.setItem(ENTERPRISE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  applyEnterpriseDisplaySettings(normalized)

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<EnterpriseSettings>(ENTERPRISE_SETTINGS_EVENT, { detail: normalized }))
  }
}

export const getStandardPrecedence = (): string[] => {
  return loadEnterpriseSettings().standardPrecedence
}

export const isStrictOffline = (): boolean => {
  return loadEnterpriseSettings().strictOfflineMode
}

export function persistLastVisitedRoute(path: string): void {
  if (typeof localStorage === "undefined") return
  if (!path || !path.startsWith("/")) return
  localStorage.setItem(LAST_ROUTE_STORAGE_KEY, path)
}

export function loadLastVisitedRoute(): string {
  if (typeof localStorage === "undefined") return "/"
  const saved = localStorage.getItem(LAST_ROUTE_STORAGE_KEY)
  return saved && saved.startsWith("/") ? saved : "/"
}

export function clearLastVisitedRoute(): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(LAST_ROUTE_STORAGE_KEY)
}

export function resolveStartupRoute(settings: EnterpriseSettings): string {
  switch (settings.startupRouteMode) {
    case "last-route":
      return loadLastVisitedRoute()
    case "projects":
      return "/projects"
    case "favorites":
      return "/favorites"
    case "dashboard":
    default:
      return "/"
  }
}
