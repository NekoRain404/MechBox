import type { ThemeConfig } from "ant-design-vue/es/config-provider/context";

export type ThemePresetKey = "graphite-light" | "sand-light" | "graphite-dark";

interface ThemePresetDefinition {
  key: ThemePresetKey;
  label: string;
  shortLabel: string;
  description: string;
  appearance: "light" | "dark";
  menuTheme: "light" | "dark";
  preview: string[];
  antdTheme: ThemeConfig;
  cssVars: Record<string, string>;
}

const sharedComponents = {
  Card: {
    headerPadding: "10px 14px",
    paddingLG: 14,
  },
  Table: {
    padding: 8,
    paddingMD: 10,
  },
  Form: {
    itemMarginBottom: 14,
    labelColonMarginRight: 4,
  },
  Input: {
    paddingInline: 10,
    paddingBlock: 5,
  },
  Descriptions: {
    itemPaddingBottom: 8,
    labelPaddingRight: 12,
  },
  Tabs: {
    horizontalMargin: "0 0 16px 0",
  },
} as unknown as ThemeConfig["components"];

const themePresets: Record<ThemePresetKey, ThemePresetDefinition> = {
  "graphite-light": {
    key: "graphite-light",
    label: "石墨浅色",
    shortLabel: "石墨",
    description: "冷静的灰蓝系工作界面，适合长时间阅读和计算。",
    appearance: "light",
    menuTheme: "light",
    preview: ["#f5f7fb", "#dbe4f2", "#2f5bce", "#101828"],
    antdTheme: {
      token: {
        colorPrimary: "#2f5bce",
        colorSuccess: "#1f9d68",
        colorWarning: "#c88a12",
        colorError: "#d64545",
        colorInfo: "#2f5bce",
        colorBgLayout: "#eef2f7",
        colorBgContainer: "#ffffff",
        colorBgElevated: "#f7f9fc",
        colorText: "#182230",
        colorTextSecondary: "#526071",
        colorTextTertiary: "#7d8b9d",
        colorBorder: "#d8e0eb",
        colorBorderSecondary: "#e7edf5",
        padding: 10,
        paddingSM: 8,
        paddingXS: 6,
        margin: 10,
        marginSM: 8,
        marginXS: 6,
        fontSize: 13,
        fontSizeSM: 12,
        fontSizeLG: 14,
        borderRadius: 10,
        borderRadiusSM: 8,
        borderRadiusLG: 14,
        lineHeight: 1.5,
        controlHeight: 34,
        controlHeightSM: 28,
        controlHeightLG: 40,
      },
      components: sharedComponents,
    },
    cssVars: {
      "--font-sans": "'Avenir Next', 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      "--font-mono": "'JetBrains Mono', 'SFMono-Regular', 'Consolas', monospace",
      "--app-bg": "#eef2f7",
      "--app-bg-accent": "rgba(47, 91, 206, 0.08)",
      "--surface-base": "#ffffff",
      "--surface-raised": "#f7f9fc",
      "--surface-muted": "#f3f6fb",
      "--surface-ghost": "rgba(255, 255, 255, 0.72)",
      "--content-bg": "#ffffff",
      "--content-border": "#dbe3ee",
      "--content-shadow": "0 18px 38px rgba(15, 23, 42, 0.06)",
      "--toolbar-bg": "linear-gradient(135deg, #ffffff 0%, #eef4ff 100%)",
      "--toolbar-border": "#d7e3f7",
      "--toolbar-text": "#182230",
      "--toolbar-subtle": "#5b6877",
      "--toolbar-shadow": "0 12px 28px rgba(47, 91, 206, 0.08)",
      "--sidebar-bg": "linear-gradient(180deg, #f7f9fc 0%, #edf2f8 100%)",
      "--sidebar-panel": "rgba(255, 255, 255, 0.82)",
      "--sidebar-border": "#d9e2ef",
      "--sidebar-text": "#182230",
      "--sidebar-text-muted": "#5b6877",
      "--sidebar-active-bg": "rgba(47, 91, 206, 0.12)",
      "--sidebar-active-text": "#2347a8",
      "--header-bg": "rgba(255, 255, 255, 0.86)",
      "--header-border": "#d8e0eb",
      "--header-title": "#101828",
      "--header-subtitle": "#607081",
      "--header-badge-bg": "#e8efff",
      "--header-badge-text": "#2347a8",
      "--header-badge-border": "#c9d7fb",
      "--text-primary": "#182230",
      "--text-secondary": "#526071",
      "--text-tertiary": "#7d8b9d",
      "--accent": "#2f5bce",
      "--accent-soft": "#e8efff",
      "--accent-soft-strong": "#2347a8",
      "--accent-border": "#c8d7fb",
      "--success-soft": "#e9f8f1",
      "--success-text": "#1d7b58",
      "--success-border": "#bfe7d3",
      "--warning-soft": "#fff6df",
      "--warning-text": "#9e6d0d",
      "--warning-border": "#f1d18c",
      "--danger-soft": "#fff0f0",
      "--danger-text": "#b93838",
      "--danger-border": "#f2b8b8",
      "--result-label-bg": "#f5f7fb",
      "--result-label-border": "#e0e6f0",
      "--result-value-bg": "#eef4ff",
      "--result-value-border": "#cedafb",
      "--result-value-text": "#1d3f98",
      "--formula-bg": "#f8fbff",
      "--formula-border": "#d7e5fa",
      "--formula-accent": "#2f5bce",
      "--muted-block-bg": "#f8fafc",
      "--grid-line": "#e3e9f2",
      "--shadow-soft": "0 10px 24px rgba(15, 23, 42, 0.05)",
      "--shadow-strong": "0 22px 44px rgba(15, 23, 42, 0.08)",
    },
  },
  "sand-light": {
    key: "sand-light",
    label: "砂岩浅色",
    shortLabel: "砂岩",
    description: "更柔和的米白暖灰配色，适合资料阅读和汇报展示。",
    appearance: "light",
    menuTheme: "light",
    preview: ["#fbf7f2", "#eadfce", "#1f6c7a", "#2f2722"],
    antdTheme: {
      token: {
        colorPrimary: "#1f6c7a",
        colorSuccess: "#33835c",
        colorWarning: "#c17b12",
        colorError: "#c94d4d",
        colorInfo: "#1f6c7a",
        colorBgLayout: "#f4efe8",
        colorBgContainer: "#fffdf9",
        colorBgElevated: "#fcf7f1",
        colorText: "#2f2722",
        colorTextSecondary: "#6b6056",
        colorTextTertiary: "#9a8f85",
        colorBorder: "#e4d9ca",
        colorBorderSecondary: "#f0e8dc",
        padding: 10,
        paddingSM: 8,
        paddingXS: 6,
        margin: 10,
        marginSM: 8,
        marginXS: 6,
        fontSize: 13,
        fontSizeSM: 12,
        fontSizeLG: 14,
        borderRadius: 12,
        borderRadiusSM: 8,
        borderRadiusLG: 16,
        lineHeight: 1.5,
        controlHeight: 34,
        controlHeightSM: 28,
        controlHeightLG: 40,
      },
      components: sharedComponents,
    },
    cssVars: {
      "--font-sans": "'Avenir Next', 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      "--font-mono": "'JetBrains Mono', 'SFMono-Regular', 'Consolas', monospace",
      "--app-bg": "#f4efe8",
      "--app-bg-accent": "rgba(31, 108, 122, 0.08)",
      "--surface-base": "#fffdf9",
      "--surface-raised": "#fcf7f1",
      "--surface-muted": "#f8f1e8",
      "--surface-ghost": "rgba(255, 252, 247, 0.84)",
      "--content-bg": "#fffdf9",
      "--content-border": "#e6dbce",
      "--content-shadow": "0 18px 38px rgba(77, 55, 31, 0.06)",
      "--toolbar-bg": "linear-gradient(135deg, #fffdf9 0%, #f6efe6 100%)",
      "--toolbar-border": "#e8dccd",
      "--toolbar-text": "#2f2722",
      "--toolbar-subtle": "#71665d",
      "--toolbar-shadow": "0 12px 28px rgba(31, 108, 122, 0.08)",
      "--sidebar-bg": "linear-gradient(180deg, #fff9f1 0%, #f2e8dc 100%)",
      "--sidebar-panel": "rgba(255, 255, 255, 0.72)",
      "--sidebar-border": "#e7dac8",
      "--sidebar-text": "#2f2722",
      "--sidebar-text-muted": "#71665d",
      "--sidebar-active-bg": "rgba(31, 108, 122, 0.12)",
      "--sidebar-active-text": "#0e5664",
      "--header-bg": "rgba(255, 252, 247, 0.9)",
      "--header-border": "#e6dbc9",
      "--header-title": "#2f2722",
      "--header-subtitle": "#71665d",
      "--header-badge-bg": "#e1f0f2",
      "--header-badge-text": "#0e5664",
      "--header-badge-border": "#bdd9de",
      "--text-primary": "#2f2722",
      "--text-secondary": "#6b6056",
      "--text-tertiary": "#9a8f85",
      "--accent": "#1f6c7a",
      "--accent-soft": "#e3f0f2",
      "--accent-soft-strong": "#0e5664",
      "--accent-border": "#c4dde1",
      "--success-soft": "#edf8f1",
      "--success-text": "#2c7650",
      "--success-border": "#c8e7d2",
      "--warning-soft": "#fff3de",
      "--warning-text": "#98620d",
      "--warning-border": "#efd09a",
      "--danger-soft": "#fff0ee",
      "--danger-text": "#b94a43",
      "--danger-border": "#f0c4be",
      "--result-label-bg": "#faf4ec",
      "--result-label-border": "#ebe0d1",
      "--result-value-bg": "#edf6f7",
      "--result-value-border": "#c4dde1",
      "--result-value-text": "#145763",
      "--formula-bg": "#fbf7f1",
      "--formula-border": "#eadfce",
      "--formula-accent": "#1f6c7a",
      "--muted-block-bg": "#faf4ec",
      "--grid-line": "#eadecf",
      "--shadow-soft": "0 10px 24px rgba(77, 55, 31, 0.05)",
      "--shadow-strong": "0 22px 44px rgba(77, 55, 31, 0.08)",
    },
  },
  "graphite-dark": {
    key: "graphite-dark",
    label: "石墨深色",
    shortLabel: "深石墨",
    description: "偏工程控制台风格的深色主题，适合夜间或大屏展示。",
    appearance: "dark",
    menuTheme: "dark",
    preview: ["#0f1724", "#172235", "#77a0ff", "#e6edf8"],
    antdTheme: {
      token: {
        colorPrimary: "#77a0ff",
        colorSuccess: "#5dd39e",
        colorWarning: "#f3bf57",
        colorError: "#ff7b7b",
        colorInfo: "#77a0ff",
        colorBgLayout: "#0b1220",
        colorBgContainer: "#111a2a",
        colorBgElevated: "#162132",
        colorText: "#e6edf8",
        colorTextSecondary: "#a1afc4",
        colorTextTertiary: "#7b8aa1",
        colorBorder: "#25344c",
        colorBorderSecondary: "#1d2a3e",
        padding: 10,
        paddingSM: 8,
        paddingXS: 6,
        margin: 10,
        marginSM: 8,
        marginXS: 6,
        fontSize: 13,
        fontSizeSM: 12,
        fontSizeLG: 14,
        borderRadius: 12,
        borderRadiusSM: 8,
        borderRadiusLG: 16,
        lineHeight: 1.5,
        controlHeight: 34,
        controlHeightSM: 28,
        controlHeightLG: 40,
      },
      components: sharedComponents,
    },
    cssVars: {
      "--font-sans": "'Avenir Next', 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      "--font-mono": "'JetBrains Mono', 'SFMono-Regular', 'Consolas', monospace",
      "--app-bg": "#0b1220",
      "--app-bg-accent": "rgba(119, 160, 255, 0.12)",
      "--surface-base": "#111a2a",
      "--surface-raised": "#152132",
      "--surface-muted": "#0f1828",
      "--surface-ghost": "rgba(17, 26, 42, 0.84)",
      "--content-bg": "#111a2a",
      "--content-border": "#233249",
      "--content-shadow": "0 22px 50px rgba(0, 0, 0, 0.28)",
      "--toolbar-bg": "linear-gradient(135deg, #162235 0%, #10182a 100%)",
      "--toolbar-border": "#29405f",
      "--toolbar-text": "#edf2fb",
      "--toolbar-subtle": "#a4b2c8",
      "--toolbar-shadow": "0 14px 32px rgba(0, 0, 0, 0.28)",
      "--sidebar-bg": "linear-gradient(180deg, #0d1524 0%, #0a101c 100%)",
      "--sidebar-panel": "rgba(255, 255, 255, 0.04)",
      "--sidebar-border": "#1a2740",
      "--sidebar-text": "#dae3f0",
      "--sidebar-text-muted": "#9facbf",
      "--sidebar-active-bg": "rgba(119, 160, 255, 0.16)",
      "--sidebar-active-text": "#a9c3ff",
      "--header-bg": "rgba(17, 26, 42, 0.82)",
      "--header-border": "#223149",
      "--header-title": "#edf2fb",
      "--header-subtitle": "#a1afc4",
      "--header-badge-bg": "#192943",
      "--header-badge-text": "#a9c3ff",
      "--header-badge-border": "#31466f",
      "--text-primary": "#e6edf8",
      "--text-secondary": "#a1afc4",
      "--text-tertiary": "#7b8aa1",
      "--accent": "#77a0ff",
      "--accent-soft": "#192943",
      "--accent-soft-strong": "#a9c3ff",
      "--accent-border": "#31466f",
      "--success-soft": "#102b24",
      "--success-text": "#75ddb0",
      "--success-border": "#1f5b4d",
      "--warning-soft": "#2d2411",
      "--warning-text": "#f2ca70",
      "--warning-border": "#61522a",
      "--danger-soft": "#31191c",
      "--danger-text": "#ff9c9c",
      "--danger-border": "#6a2d34",
      "--result-label-bg": "#121e30",
      "--result-label-border": "#263750",
      "--result-value-bg": "#152741",
      "--result-value-border": "#33507e",
      "--result-value-text": "#c8dbff",
      "--formula-bg": "#111d2f",
      "--formula-border": "#27405f",
      "--formula-accent": "#77a0ff",
      "--muted-block-bg": "#101a2b",
      "--grid-line": "#233249",
      "--shadow-soft": "0 12px 26px rgba(0, 0, 0, 0.22)",
      "--shadow-strong": "0 24px 48px rgba(0, 0, 0, 0.36)",
    },
  },
};

export const defaultThemePresetKey: ThemePresetKey = "graphite-light";

export const themePresetOptions = Object.values(themePresets).map((preset) => ({
  key: preset.key,
  label: preset.label,
  shortLabel: preset.shortLabel,
  description: preset.description,
  preview: preset.preview,
}));

const THEME_STYLE_ID = "mechbox-runtime-theme";

const baseThemeCss = `
html, body, #app {
  min-height: 100%;
}

:root {
  color-scheme: light;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background:
    radial-gradient(circle at top left, var(--app-bg-accent) 0, transparent 28%),
    linear-gradient(180deg, var(--app-bg) 0%, var(--app-bg) 100%);
  color: var(--text-primary);
}

::selection {
  background: var(--accent-soft);
  color: var(--accent-soft-strong);
}

* {
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

:root[data-motion="reduced"] *,
:root[data-motion="reduced"] *::before,
:root[data-motion="reduced"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}

a {
  color: var(--accent);
}

.res-value, .number-display {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.compact-card .ant-card-head {
  min-height: 40px;
  padding: 0 14px;
}

.compact-card .ant-card-body {
  padding: 14px;
}

:root[data-ui-density="compact"] .ant-card .ant-card-head {
  min-height: 40px;
  padding: 0 12px;
}

:root[data-ui-density="compact"] .ant-card .ant-card-body {
  padding: 12px;
}

:root[data-ui-density="compact"] .ant-form-vertical .ant-form-item {
  margin-bottom: 10px;
}

:root[data-ui-density="compact"] .ant-input,
:root[data-ui-density="compact"] .ant-input-number,
:root[data-ui-density="compact"] .ant-select-selector,
:root[data-ui-density="compact"] .ant-btn {
  font-size: 12px;
}

:root[data-ui-density="compact"] .page-stage {
  padding: 16px 16px 18px;
}

.status-pass {
  background: var(--success-soft);
  color: var(--success-text);
  border: 1px solid var(--success-border);
}

.status-warning {
  background: var(--warning-soft);
  color: var(--warning-text);
  border: 1px solid var(--warning-border);
}

.status-error {
  background: var(--danger-soft);
  color: var(--danger-text);
  border: 1px solid var(--danger-border);
}

.info-dense {
  font-size: 12px;
  line-height: 1.45;
}

.info-dense .label {
  color: var(--text-secondary);
  font-weight: 600;
}

.info-dense .value {
  color: var(--text-primary);
  font-weight: 700;
  font-family: var(--font-mono);
}

.toolbar-compact {
  padding: 8px 14px;
  background: var(--toolbar-bg);
  color: var(--toolbar-text);
  border: 1px solid var(--toolbar-border);
}

.formula-panel-card {
  margin-top: 18px;
}

.analysis-brief-card,
.analysis-decision-card {
  border-color: var(--content-border);
}

.analysis-brief,
.analysis-decision,
.formula-panel {
  display: grid;
  gap: 14px;
}

.analysis-brief__header {
  display: grid;
  gap: 6px;
}

.analysis-brief__title,
.analysis-brief__section-title,
.analysis-decision__section-title,
.formula-panel-section__title {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
}

.analysis-brief__summary,
.analysis-brief__item,
.analysis-decision__item,
.formula-panel-meta,
.formula-panel-notes {
  color: var(--text-secondary);
}

.analysis-brief__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
}

.analysis-brief__metric,
.analysis-brief__section,
.analysis-decision__section,
.formula-panel-section {
  border: 1px solid var(--content-border);
  border-radius: 14px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.analysis-brief__metric {
  padding: 12px 14px;
}

.analysis-brief__metric-label {
  color: var(--text-secondary);
  font-size: 11px;
}

.analysis-brief__metric-value {
  margin-top: 4px;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.analysis-brief__grid,
.analysis-decision__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.analysis-brief__section,
.analysis-decision__section,
.formula-panel-section {
  padding: 14px;
}

.analysis-brief__item,
.analysis-decision__item {
  position: relative;
  padding-left: 12px;
  font-size: 11px;
  line-height: 1.55;
}

.analysis-brief__item::before,
.analysis-decision__item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 7px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: var(--accent);
}

.analysis-decision__item.is-risk::before {
  background: var(--danger-text);
}

.analysis-decision__item.is-action::before {
  background: var(--warning-text);
}

.analysis-decision__item.is-output::before {
  background: var(--accent);
}

.formula-panel-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.formula-panel-nav__item,
.formula-jump {
  border: 1px solid var(--accent-border);
  background: var(--surface-base);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
}

.formula-panel-nav__item.is-active,
.formula-jump.is-active {
  background: var(--accent-soft);
  color: var(--accent-soft-strong);
}

.formula-panel-section {
  background: linear-gradient(180deg, var(--surface-base) 0%, var(--surface-raised) 100%);
  cursor: pointer;
}

.formula-panel-section.is-active {
  border-color: var(--accent-border);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), var(--shadow-soft);
}

.formula-panel-formulas {
  display: grid;
  gap: 6px;
}

.formula-panel-formula {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  padding: 7px 9px;
  border-radius: 8px;
  background: var(--surface-ghost);
  border: 1px solid var(--grid-line);
}

.brand {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.02em;
}

.brand small {
  font-weight: 500;
  font-size: 11px;
  color: var(--toolbar-subtle);
  margin-left: 8px;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .toolbar-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .content-body {
    padding: 14px;
  }
}
`;

export function normalizeThemePreset(theme?: string | null): ThemePresetKey {
  if (!theme) {
    return defaultThemePresetKey;
  }

  if (theme === "light") {
    return "graphite-light";
  }

  if (theme === "dark") {
    return "graphite-dark";
  }

  return theme in themePresets ? (theme as ThemePresetKey) : defaultThemePresetKey;
}

export function getThemePreset(theme?: string | null): ThemePresetDefinition {
  return themePresets[normalizeThemePreset(theme)];
}

function buildThemeCss(theme: ThemePresetDefinition): string {
  const vars = Object.entries(theme.cssVars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");

  return `
:root {
${vars}
  color-scheme: ${theme.appearance};
}

${baseThemeCss}
`;
}

export function applyThemePreset(theme?: string | null): ThemePresetDefinition {
  const preset = getThemePreset(theme);
  const existing = document.getElementById(THEME_STYLE_ID) ?? document.createElement("style");

  existing.id = THEME_STYLE_ID;
  existing.textContent = buildThemeCss(preset);

  if (!existing.parentNode) {
    document.head.appendChild(existing);
  }

  document.documentElement.dataset.themePreset = preset.key;
  document.documentElement.dataset.themeAppearance = preset.appearance;

  return preset;
}
