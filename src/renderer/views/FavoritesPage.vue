<script setup lang="ts">
/**
 * FavoritesPage - 我的收藏页面
 * 管理用户收藏的常用配置
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageToolbar from '../components/PageToolbar.vue'
import ToolPageLayout from '../components/ToolPageLayout.vue'
import CalculationDecisionPanel from '../components/CalculationDecisionPanel.vue'
import AlertStack from '../components/AlertStack.vue'
import StateEmpty from '../components/StateEmpty.vue'
import { useAppFeedback } from '../composables/useAppFeedback'
import { moduleRouteMap } from '../router/route-meta'
import { useStandardStore, type FavoriteItem } from '../store/useStandardStore'
import { stageToolLaunchPayload } from '../utils/tool-launch'
import {
  createWorkspaceProject,
  saveActiveProject,
  upsertStoredProject,
  loadActiveProject,
  updateStoredProject,
  WORKSPACE_STORAGE_EVENT,
} from '../utils/workspace'
import { StarOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { FAVORITES_EXPORT_VERSION } from '@shared/app-meta'

const store = useStandardStore()
const router = useRouter()
const feedback = useAppFeedback()
const activeProject = ref(loadActiveProject())

function syncWorkspaceState() {
  activeProject.value = loadActiveProject()
}

onMounted(() => {
  window.addEventListener(WORKSPACE_STORAGE_EVENT, syncWorkspaceState)
})

onBeforeUnmount(() => {
  window.removeEventListener(WORKSPACE_STORAGE_EVENT, syncWorkspaceState)
})

function removeFavorite(id: string) {
  store.removeFavorite(id)
  feedback.notifyDeleted('收藏')
}

async function clearAllFavorites() {
  const confirmed = await feedback.confirmDestructive({
    title: '清空收藏',
    content: '确定要清空所有收藏吗？此操作不可恢复。',
  })
  if (!confirmed) return

  store.clearFavorites()
  feedback.notifyCleared('收藏')
}

const moduleLabels: Record<string, string> = {
  tolerances: '公差配合',
  seals: '密封圈',
  bearings: '轴承选型',
  bolts: '螺栓连接',
  threads: '螺纹',
  'param-scan': '参数扫描',
  'monte-carlo': '蒙特卡洛',
  'bom-export': 'BOM 导出',
  'material-sub': '材料代换',
}

const moduleStats = computed(() => {
  const map = new Map<string, number>()
  for (const favorite of store.favorites) {
    map.set(favorite.module, (map.get(favorite.module) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([module, count]) => ({ module, count }))
})

const pageAlerts = computed(() => {
  const items: Array<{ level: 'info' | 'warning'; message: string; description?: string }> = []

  if (activeProject.value) {
    items.push({
      level: 'info',
      message: `当前活动项目为“${activeProject.value.name}”`,
      description: '收藏配置可作为该项目的起始模板，但当前不会自动覆盖项目内已有详细输入。',
    })
  }

  if (!store.favorites.length) {
    items.push({
      level: 'warning',
      message: '当前没有收藏配置可复用。',
      description: '建议在高频页面完成一次可复用配置后再加入收藏。',
    })
  }

  return items
})

const decisionPanel = computed(() => {
  if (!store.favorites.length) {
    return {
      conclusion: '当前没有收藏配置。',
      status: 'info' as const,
      risks: ['常用配置如果不收藏，后续复用时需要重复录入。'],
      actions: ['在各模块完成一次可复用配置后，优先加入收藏。'],
      boundaries: ['收藏主要保存命名配置和参数快照，不会替代项目版本管理。'],
    }
  }

  return {
    conclusion: `当前共收藏 ${store.favorites.length} 项配置，覆盖 ${moduleStats.value.length} 个模块。`,
    status: 'success' as const,
    risks: activeProject.value ? [] : ['当前没有活动项目，收藏与后续报告、导出记录之间缺少统一上下文。'],
    actions: [
      '优先通过“恢复参数”把收藏直接带回工具页，而不是重新录入。',
      '若要把收藏纳入正式工作流，可直接从收藏创建项目，或把当前收藏摘要写回活动项目。',
    ],
    boundaries: ['收藏是便捷入口，不会自动同步项目版本和报告记录。'],
  }
})

function canResumeFavorite(record: { module: string; data?: unknown }) {
  return Boolean(moduleRouteMap[record.module] && record.data && typeof record.data === 'object')
}

function isFavoriteRecord(record: unknown): record is FavoriteItem {
  return Boolean(record && typeof record === 'object' && 'id' in record && 'module' in record && 'name' in record)
}

function canResumeFavoriteRow(record: unknown) {
  return isFavoriteRecord(record) ? canResumeFavorite(record) : false
}

function openFavorite(record: { module: string; data?: unknown }, restoreSnapshot = false) {
  const route = moduleRouteMap[record.module]
  if (!route) return

  if (restoreSnapshot && record.data && typeof record.data === 'object') {
    stageToolLaunchPayload(record.module, record.data, '收藏配置')
    feedback.info('将按收藏参数恢复工具状态')
  }

  void router.push(route)
}

function openFavoriteRow(record: unknown, restoreSnapshot = false) {
  if (!isFavoriteRecord(record)) return
  openFavorite(record, restoreSnapshot)
}

function createProjectFromFavorite(record: { module: string; name: string }) {
  const project = createWorkspaceProject({
    name: `${record.name} 项目`,
    module: record.module,
    inputSummary: `来源收藏：${record.name}`,
  })
  upsertStoredProject(project)
  saveActiveProject(project)
  activeProject.value = project
  feedback.notifySaved('项目')
}

function createProjectFromFavoriteRow(record: unknown) {
  if (!isFavoriteRecord(record)) return
  createProjectFromFavorite(record)
}

function syncFavoriteToProject(record: { module: string; name: string }) {
  if (!activeProject.value) {
    feedback.warning('当前没有活动项目，无法写入摘要')
    return
  }

  const crossModuleNote =
    activeProject.value.module === record.module
      ? ''
      : `；当前项目模块为 ${moduleLabels[activeProject.value.module] || activeProject.value.module}`

  const result = updateStoredProject(activeProject.value.id, (project) => ({
    ...project,
    inputSummary: `来源收藏：${record.name}（${moduleLabels[record.module] || record.module}）${crossModuleNote}`,
    updatedAt: new Date().toISOString(),
  }))
  activeProject.value = result.activeProject
  feedback.notifySaved('项目摘要')
}

function syncFavoriteToProjectRow(record: unknown) {
  if (!isFavoriteRecord(record)) return
  syncFavoriteToProject(record)
}

function exportFavorites() {
  const data = {
    format: 'MechBox Favorites',
    version: FAVORITES_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    items: store.favorites,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `favorites-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  feedback.notifyExported('收藏集')
}

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: '28%' },
  { title: '模块', dataIndex: 'module', key: 'module', width: '14%' },
  { title: '收藏时间', dataIndex: 'createdAt', key: 'createdAt', width: '18%' },
  { title: '操作', key: 'action', width: '40%' },
]
</script>

<template>
  <div class="favorites-page">
    <PageToolbar title="MechBox" subtitle="我的收藏">
      <a-space>
        <a-button v-if="store.favorites.length > 0" size="small" @click="exportFavorites">
          <template #icon><DownloadOutlined /></template>导出收藏
        </a-button>
        <a-button v-if="store.favorites.length > 0" danger size="small" @click="clearAllFavorites">
          清空全部
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="content-body">
      <ToolPageLayout :input-span="8" :output-span="16">
        <template #side>
          <a-card title="收藏概览" size="small">
            <a-statistic title="收藏总数" :value="store.favorites.length" />
            <a-divider style="margin: 12px 0" />
            <div v-if="moduleStats.length" class="stack-card">
              <div v-for="item in moduleStats" :key="item.module" class="res-label">
                <span>{{ moduleLabels[item.module] || item.module }}</span>
                <strong>{{ item.count }}</strong>
              </div>
            </div>
            <StateEmpty v-else description="暂无模块分布" />
          </a-card>

          <a-card title="当前活动项目" size="small">
            <StateEmpty v-if="!activeProject" description="暂无活动项目" />
              <a-descriptions v-else bordered size="small" :column="1">
              <a-descriptions-item label="项目名称">{{ activeProject.name }}</a-descriptions-item>
              <a-descriptions-item label="所属模块">{{ moduleLabels[activeProject.module] || activeProject.module }}</a-descriptions-item>
              <a-descriptions-item label="摘要">{{ activeProject.inputSummary || '未写入摘要' }}</a-descriptions-item>
            </a-descriptions>
          </a-card>

          <AlertStack :items="pageAlerts" />

          <CalculationDecisionPanel
            title="收藏判断"
            :conclusion="decisionPanel.conclusion"
            :status="decisionPanel.status"
            :risks="decisionPanel.risks"
            :actions="decisionPanel.actions"
            :boundaries="decisionPanel.boundaries"
          />
        </template>

        <template #main>
          <StateEmpty v-if="store.favorites.length === 0" :icon="StarOutlined" description="暂无收藏项目，在使用其他模块时点击收藏按钮即可添加" />

          <a-card v-else title="收藏列表" size="small">
            <a-table
              :columns="columns"
              :data-source="store.favorites"
              :pagination="{ pageSize: 10, showSizeChanger: true }"
              size="small"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'module'">
                  <a-tag color="blue">{{ moduleLabels[record.module] || record.module }}</a-tag>
                </template>
                <template v-else-if="column.key === 'createdAt'">
                  {{ new Date(record.createdAt).toLocaleString() }}
                </template>
                <template v-else-if="column.key === 'action'">
                  <a-space wrap>
                    <a-button
                      v-if="canResumeFavoriteRow(record)"
                      type="link"
                      size="small"
                      @click="openFavoriteRow(record, true)"
                    >
                      恢复参数
                    </a-button>
                    <a-button type="link" size="small" @click="openFavoriteRow(record)">空白打开</a-button>
                    <a-button type="link" size="small" @click="createProjectFromFavoriteRow(record)">
                      <template #icon><PlusOutlined /></template>建项目
                    </a-button>
                    <a-button type="link" size="small" :disabled="!activeProject" @click="syncFavoriteToProjectRow(record)">
                      写入项目
                    </a-button>
                    <a-button type="link" danger size="small" @click="removeFavorite(record.id)">删除</a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-card>
        </template>
      </ToolPageLayout>
    </div>
  </div>
</template>

<style scoped>
.favorites-page {
  max-width: 1320px;
  margin: 0 auto;
}
</style>
