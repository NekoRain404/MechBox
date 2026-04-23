import { createRouter, createWebHashHistory } from "vue-router";
import { preloadRouteByPath, routeRecords } from "./route-meta";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    ...routeRecords,
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
  scrollBehavior: () => ({ top: 0 })
})

router.beforeResolve(async (to) => {
  await preloadRouteByPath(to.path)
  return true
})

export default router
