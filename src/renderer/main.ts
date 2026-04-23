import { createApp } from "vue";
import { createPinia } from "pinia";
import { isNavigationFailure, NavigationFailureType, type Router } from "vue-router";
import "ant-design-vue/dist/reset.css";
import "./assets/styles/components.css";
import { applyThemePreset } from "./themes/industrial-compact";
import {
  applyEnterpriseDisplaySettings,
  clearLastVisitedRoute,
  ENTERPRISE_SETTINGS_EVENT,
  loadEnterpriseSettings,
  persistLastVisitedRoute,
  resolveStartupRoute,
  type EnterpriseSettings,
} from "./engine/enterprise-settings";

function shouldApplyStartupRoute() {
  const hashPath = window.location.hash.replace(/^#/, "") || "/";
  return !window.location.hash || hashPath === "/" || hashPath === ""
}

async function restoreStartupRoute(router: Router, preloadRouteByPath: (path: string) => Promise<void>) {
  if (!shouldApplyStartupRoute()) return

  const startupRoute = resolveStartupRoute(currentSettings)
  if (startupRoute === "/" || startupRoute === router.currentRoute.value.path) return

  try {
    await preloadRouteByPath(startupRoute)
    const failure = await router.replace(startupRoute)
    if (failure && !isNavigationFailure(failure, NavigationFailureType.duplicated)) {
      console.error("[Renderer] startup route restore failed", failure)
    }
  } catch (error) {
    console.error("[Renderer] startup route restore failed", error)
  }
}

function finishBootSplash() {
  const splash = document.getElementById("boot-splash")
  if (!splash) return

  const bootInfo = window.__MECHBOX_BOOT__
  const startedAt = bootInfo?.startedAt ?? Date.now()
  const minDuration = bootInfo?.minDuration ?? 0
  const remaining = Math.max(0, minDuration - (Date.now() - startedAt))

  window.setTimeout(() => {
    splash.classList.add("is-hidden")
    const removeDelay = document.documentElement.dataset.motion === "reduced" ? 40 : 360
    window.setTimeout(() => {
      splash.remove()
    }, removeDelay)
  }, remaining)
}

let currentSettings = loadEnterpriseSettings()
applyThemePreset(currentSettings.theme)
applyEnterpriseDisplaySettings(currentSettings)

async function bootstrapApp() {
  const [{ default: App }, { default: router }, { preloadRouteByPath }] = await Promise.all([
    import("./App.vue"),
    import("./router"),
    import("./router/route-meta"),
  ])

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  router.afterEach((to) => {
    if (!currentSettings.rememberLastRoute) return
    persistLastVisitedRoute(to.path)
  })

  if (!currentSettings.rememberLastRoute) {
    clearLastVisitedRoute()
  }

  app.mount("#app")

  await router.isReady()
  await restoreStartupRoute(router, preloadRouteByPath)

  window.addEventListener(ENTERPRISE_SETTINGS_EVENT, (event) => {
    const detail = (event as CustomEvent<EnterpriseSettings>).detail
    if (!detail) return

    currentSettings = detail
    applyThemePreset(detail.theme)
    applyEnterpriseDisplaySettings(detail)

    if (!detail.rememberLastRoute) {
      clearLastVisitedRoute()
    } else {
      persistLastVisitedRoute(router.currentRoute.value.path)
    }
  })

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      finishBootSplash()
    })
  })
}

void bootstrapApp().catch((error) => {
  console.error("[Renderer] bootstrap failed", error)
  window.requestAnimationFrame(() => {
    finishBootSplash()
  })
})
