<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  BgColorsOutlined,
  CheckOutlined,
  CloudDownloadOutlined,
  CopyOutlined,
  DatabaseOutlined,
  LockOutlined,
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'
import { APP_RELEASE_LABEL, APP_VERSION } from '@shared/app-meta'
import PageToolbar from '../components/PageToolbar.vue'
import { useFormDraftStore } from '../store/useFormDraftStore'
import { useStandardStore } from '../store/useStandardStore'
import { useAppFeedback } from '../composables/useAppFeedback'
import {
  defaultEnterpriseSettings,
  loadEnterpriseSettings,
  saveEnterpriseSettings,
  type StartupRouteMode,
} from '../engine/enterprise-settings'
import {
  getThemePreset,
  themePresetOptions,
  type ThemePresetKey,
} from '../themes/industrial-compact'
import {
  collectBackupDiagnostics,
  collectLocalBackupSnapshot,
  downloadLocalBackup,
  formatBackupDiagnosticsText,
  importLocalBackup,
  parseLocalBackupPayload,
  readRawBackupText,
  type BackupDiagnostics,
} from '../utils/local-backup'

const store = useStandardStore()
const formDraftStore = useFormDraftStore()
const settings = ref(loadEnterpriseSettings())
const activeTab = ref('general')
const feedback = useAppFeedback()
const backupFileInputRef = ref<HTMLInputElement | null>(null)
const backupBusy = ref(false)
const diagnosticsLoading = ref(false)
const diagnostics = ref<BackupDiagnostics | null>(null)

const startupRouteOptions: { value: StartupRouteMode; label: string; hint: string }[] = [
  { value: 'dashboard', label: '工具启动台', hint: '每次启动都从工具总入口开始。' },
  { value: 'last-route', label: '上次页面', hint: '回到上次停留的工具或工作区页面。' },
  { value: 'projects', label: '项目中心', hint: '适合以项目和归档流程为主的使用方式。' },
  { value: 'favorites', label: '我的收藏', hint: '适合高频重复使用固定工具方案。' },
]

const animationDurationOptions = [
  { value: 320, label: '320 ms', hint: '推荐，优先保证尽快进入工具界面。' },
  { value: 420, label: '420 ms', hint: '很短，偏直接。' },
  { value: 720, label: '720 ms', hint: '更平滑，但会明显拉长启动遮罩时间。' },
  { value: 1100, label: '1100 ms', hint: '仅建议在很慢设备上使用。' },
]

const experienceTags = computed(() => {
  const startupLabel = startupRouteOptions.find((item) => item.value === settings.value.startupRouteMode)?.label ?? '工具启动台'
  return [
    `启动进入：${startupLabel}`,
    settings.value.compactMode ? '紧凑布局' : '标准布局',
    settings.value.reduceMotion ? '减少动画' : '标准动画',
    settings.value.sidebarCollapsedByDefault ? '侧栏默认折叠' : '侧栏默认展开',
    settings.value.showStartupAnimation ? `启动遮罩 ${settings.value.startupAnimationDurationMs} ms` : '关闭启动遮罩',
  ]
})

const localRecordTags = computed(() => {
  if (!diagnostics.value) return []
  return [
    `收藏 ${diagnostics.value.localCounts.favorites}`,
    `最近计算 ${diagnostics.value.localCounts.recentCalculations}`,
    `表单草稿 ${diagnostics.value.localCounts.formDrafts}`,
    `项目 ${diagnostics.value.localCounts.projects}`,
    `报告 ${diagnostics.value.localCounts.reports}`,
  ]
})

const workflowRecordTags = computed(() => {
  if (!diagnostics.value?.workflowCounts) return []
  return [
    `工作流项目 ${diagnostics.value.workflowCounts.projects}`,
    `BOM 草稿 ${diagnostics.value.workflowCounts.bomDrafts}`,
    `计算记录 ${diagnostics.value.workflowCounts.calculationRuns}`,
    `变更单 ${diagnostics.value.workflowCounts.changeCases}`,
    `文档附件 ${diagnostics.value.workflowCounts.documentAttachments}`,
  ]
})

const dataVersionTags = computed(() =>
  diagnostics.value?.snapshot.dataVersion.map((item) => `${item.standard_code} · ${item.version}`) ?? [],
)

function saveSettings() {
  if (settings.value.startupRouteMode === 'last-route') {
    settings.value.rememberLastRoute = true
  }
  saveEnterpriseSettings(settings.value)
  feedback.notifySaved('设置')
}

function resetToDefaults() {
  settings.value = { ...defaultEnterpriseSettings }
  store.setUnit('mm')
  saveEnterpriseSettings(settings.value)
  feedback.info('已恢复默认设置')
}

function onUnitChange(event: { target?: { value?: unknown } }) {
  const unit = event.target?.value
  if (unit === 'mm' || unit === 'inch') {
    store.setUnit(unit)
  }
}

function onStartupRouteChange(value: unknown) {
  if (value !== 'dashboard' && value !== 'last-route' && value !== 'projects' && value !== 'favorites') {
    return
  }
  settings.value.startupRouteMode = value
  if (value === 'last-route') {
    settings.value.rememberLastRoute = true
  }
}

function selectTheme(theme: ThemePresetKey) {
  settings.value.theme = theme
  saveEnterpriseSettings({
    ...loadEnterpriseSettings(),
    theme,
  })
  feedback.success(`已切换到${getThemePreset(theme).label}`)
}

async function refreshDiagnostics() {
  diagnosticsLoading.value = true
  try {
    diagnostics.value = await collectBackupDiagnostics()
  } catch (error) {
    console.error('读取运行诊断失败:', error)
    feedback.error('读取运行诊断失败')
  } finally {
    diagnosticsLoading.value = false
  }
}

async function exportBackup() {
  backupBusy.value = true
  try {
    const snapshot = await collectLocalBackupSnapshot()
    downloadLocalBackup(snapshot)
    diagnostics.value = await collectBackupDiagnostics()
    feedback.notifyExported('本地备份')
  } catch (error) {
    console.error('导出本地备份失败:', error)
    feedback.error('导出本地备份失败')
  } finally {
    backupBusy.value = false
  }
}

function triggerBackupImport() {
  backupFileInputRef.value?.click()
}

async function handleBackupImport(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  try {
    const raw = await readRawBackupText(file)
    const parsed = parseLocalBackupPayload(JSON.parse(raw))
    const confirmed = await feedback.confirmDestructive({
      title: '导入本地备份',
      content: '将覆盖当前设置、收藏、最近计算、项目、报告及工作流同名记录。预览版采用按 ID 合并/覆盖，不会自动删除未知旧数据。',
      okText: '开始导入',
    })
    if (!confirmed) return

    backupBusy.value = true
    await importLocalBackup(parsed)
    settings.value = loadEnterpriseSettings()
    store.loadPersistedState()
    formDraftStore.loadFromStorage()
    await refreshDiagnostics()
    feedback.success('本地备份已导入')
  } catch (error) {
    console.error('导入本地备份失败:', error)
    feedback.error(error instanceof Error ? error.message : '导入本地备份失败')
  } finally {
    if (input) {
      input.value = ''
    }
    backupBusy.value = false
  }
}

async function copyDiagnostics() {
  if (!diagnostics.value) {
    feedback.warning('请先刷新运行诊断')
    return
  }

  try {
    await navigator.clipboard.writeText(formatBackupDiagnosticsText(diagnostics.value))
    feedback.success('诊断摘要已复制')
  } catch (error) {
    console.error('复制诊断摘要失败:', error)
    feedback.error('复制诊断摘要失败')
  }
}

onMounted(() => {
  formDraftStore.loadFromStorage()
  void refreshDiagnostics()
})
</script>

<template>
  <div class="settings-page">
    <PageToolbar title="MechBox" subtitle="系统设置">
      <a-space>
        <a-button size="small" type="primary" @click="saveSettings">
          <template #icon><SaveOutlined /></template>保存设置
        </a-button>
        <a-button size="small" @click="resetToDefaults">
          <template #icon><UndoOutlined /></template>恢复默认
        </a-button>
      </a-space>
    </PageToolbar>

    <div class="settings-summary">
      <a-tag v-for="tag in experienceTags" :key="tag" class="settings-summary__tag">
        {{ tag }}
      </a-tag>
    </div>

    <div class="content-body">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="general" tab="界面">
          <div class="settings-grid">
            <a-card title="界面与单位" size="small">
              <a-form layout="vertical">
                <a-form-item label="语言 (Language)">
                  <a-select v-model:value="settings.language" style="width:100%">
                    <a-select-option value="zh-CN">简体中文</a-select-option>
                    <a-select-option value="en-US">English (Coming Soon)</a-select-option>
                  </a-select>
                </a-form-item>

                <a-form-item label="默认单位制">
                  <a-radio-group :value="store.unit" @change="onUnitChange">
                    <a-radio value="mm">公制 (mm)</a-radio>
                    <a-radio value="inch">英制 (inch)</a-radio>
                  </a-radio-group>
                  <div class="field-tip">切换后所有计算页面将自动换算。</div>
                </a-form-item>

                <a-form-item label="界面布局">
                  <a-space direction="vertical" size="small" style="width: 100%">
                    <a-checkbox v-model:checked="settings.compactMode">启用紧凑模式</a-checkbox>
                    <a-checkbox v-model:checked="settings.reduceMotion">减少过渡动画</a-checkbox>
                    <a-checkbox v-model:checked="settings.sidebarCollapsedByDefault">下次启动时默认折叠左侧栏</a-checkbox>
                    <a-checkbox v-model:checked="settings.showPageDescriptions">显示页面说明、副标题和顶部提示</a-checkbox>
                  </a-space>
                </a-form-item>
              </a-form>
            </a-card>

            <a-card title="界面主题" size="small">
              <div class="theme-grid">
                <button
                  v-for="themeOption in themePresetOptions"
                  :key="themeOption.key"
                  type="button"
                  class="theme-card"
                  :class="{ 'is-active': settings.theme === themeOption.key }"
                  @click="selectTheme(themeOption.key)"
                >
                  <div class="theme-card__swatches">
                    <span
                      v-for="color in themeOption.preview"
                      :key="color"
                      class="theme-card__swatch"
                      :style="{ background: color }"
                    />
                  </div>
                  <div class="theme-card__content">
                    <div class="theme-card__title">
                      <BgColorsOutlined />
                      <span>{{ themeOption.label }}</span>
                      <CheckOutlined v-if="settings.theme === themeOption.key" class="theme-card__check" />
                    </div>
                    <div class="theme-card__description">
                      {{ themeOption.description }}
                    </div>
                  </div>
                </button>
              </div>
              <div class="theme-tip">
                主题切换即时生效，保存设置后会保留当前选择。
              </div>
            </a-card>
          </div>
        </a-tab-pane>

        <a-tab-pane key="startup" tab="启动与体验">
          <div class="settings-grid">
            <a-card title="启动入口" size="small">
              <a-form layout="vertical">
                <a-form-item label="默认进入页面">
                  <a-select :value="settings.startupRouteMode" style="width:100%" @change="onStartupRouteChange">
                    <a-select-option
                      v-for="option in startupRouteOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </a-select-option>
                  </a-select>
                  <div class="field-tip">
                    {{ startupRouteOptions.find((item) => item.value === settings.startupRouteMode)?.hint }}
                  </div>
                </a-form-item>

                <a-form-item>
                  <a-checkbox
                    v-model:checked="settings.rememberLastRoute"
                    :disabled="settings.startupRouteMode === 'last-route'"
                  >
                    记录并恢复上次访问页面
                  </a-checkbox>
                </a-form-item>
              </a-form>
            </a-card>

            <a-card title="启动遮罩" size="small">
              <a-form layout="vertical">
                <a-form-item>
                  <a-checkbox v-model:checked="settings.showStartupAnimation">
                    显示启动动画遮罩
                  </a-checkbox>
                  <div class="field-tip">
                    在渲染尚未完成时先显示一个很轻的启动画面，减少白屏感。
                  </div>
                </a-form-item>

                <a-form-item label="遮罩最短显示时间">
                  <a-select
                    v-model:value="settings.startupAnimationDurationMs"
                    style="width:100%"
                    :disabled="!settings.showStartupAnimation"
                  >
                    <a-select-option
                      v-for="option in animationDurationOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </a-select-option>
                  </a-select>
                  <div class="field-tip">
                    {{ animationDurationOptions.find((item) => item.value === settings.startupAnimationDurationMs)?.hint }}
                  </div>
                </a-form-item>
              </a-form>
            </a-card>
          </div>
        </a-tab-pane>

        <a-tab-pane key="solver" tab="求解器调优">
          <a-card title="全局计算参数" size="small">
            <a-form layout="vertical">
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="全局安全系数 S">
                    <a-input-number v-model:value="settings.globalSafetyFactor" :min="1.0" :max="3.0" :step="0.1" style="width:100%"/>
                    <div class="field-tip">航天级 S=2.0 / 普通机械 S=1.5</div>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="蒙特卡洛线程数">
                    <a-input-number v-model:value="settings.monteCarloThreads" :min="1" :max="32" style="width:100%"/>
                  </a-form-item>
                </a-col>
              </a-row>
              <a-divider>求解器精度控制</a-divider>
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="最大迭代次数">
                    <a-input-number v-model:value="settings.solverMaxIterations" :min="10" :max="1000" :step="10" style="width:100%"/>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="收敛容差">
                    <a-select v-model:value="settings.solverTolerance" style="width:100%">
                      <a-select-option :value="1e-6">1×10⁻⁶ (快速)</a-select-option>
                      <a-select-option :value="1e-8">1×10⁻⁸ (标准)</a-select-option>
                      <a-select-option :value="1e-12">1×10⁻¹² (极高精度)</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>
        </a-tab-pane>

        <a-tab-pane key="data" tab="数据管理">
          <a-card title="安全与隔离" size="small">
            <a-form layout="vertical">
              <a-form-item>
                <a-checkbox v-model:checked="settings.strictOfflineMode">
                  <LockOutlined /> <strong>强制物理隔离模式</strong> (阻断所有外部网络连接，适用于军工/保密环境)
                </a-checkbox>
              </a-form-item>
              <a-divider>企业标准优先级</a-divider>
              <a-form-item label="标准调用优先级">
                <a-select v-model:value="settings.standardPrecedence" mode="tags" style="width:100%" placeholder="高优先级 > 低优先级">
                  <a-select-option value="custom">企业自定义库</a-select-option>
                  <a-select-option value="GB/T">国标 GB/T</a-select-option>
                  <a-select-option value="ISO">国际标准 ISO</a-select-option>
                  <a-select-option value="DIN">德标 DIN</a-select-option>
                  <a-select-option value="JIS">日标 JIS</a-select-option>
                  <a-select-option value="ASME">美标 ASME</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="数据库路径重定向">
                <a-input v-model:value="settings.dbPathOverride" placeholder="留空使用默认路径: data/mechbox.db"/>
                <div class="field-tip">可挂载到企业加密局域网盘或 WebDAV。</div>
              </a-form-item>
            </a-form>
          </a-card>
        </a-tab-pane>

        <a-tab-pane key="cad" tab="CAD联动">
          <a-card title="CAD 集成配置" size="small">
            <a-form layout="vertical">
              <a-row :gutter="12">
                <a-col :span="12">
                  <a-form-item label="默认 CAD 目标平台">
                    <a-select v-model:value="settings.defaultCADTarget" style="width:100%">
                      <a-select-option value="solidworks">SolidWorks (VBA 宏)</a-select-option>
                      <a-select-option value="inventor">Inventor (iLogic)</a-select-option>
                      <a-select-option value="freecad">FreeCAD (Python)</a-select-option>
                      <a-select-option value="autocad">AutoCAD (Script)</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="WebSocket 本地通信端口">
                    <a-input-number v-model:value="settings.websocketPort" :min="1024" :max="65535" style="width:100%"/>
                    <div class="field-tip">默认 8321，用于 CAD 双向联动。</div>
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>
        </a-tab-pane>

        <a-tab-pane key="report" tab="报告合规">
          <a-card title="企业级报告元数据" size="small">
            <a-form layout="vertical">
              <a-row :gutter="12">
                <a-col :span="12"><a-form-item label="公司名称"><a-input v-model:value="settings.companyName" placeholder="如：XX 重工集团"/></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="默认编制人"><a-input v-model:value="settings.defaultAuthor"/></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="默认审核人"><a-input v-model:value="settings.defaultReviewer"/></a-form-item></a-col>
                <a-col :span="12"><a-form-item label="企业 Logo 路径"><a-input v-model:value="settings.companyLogo" placeholder="PNG/SVG 路径"/></a-form-item></a-col>
              </a-row>
              <a-form-item label="免责声明 (自动附加到计算书尾页)">
                <a-textarea v-model:value="settings.disclaimerText" :rows="4"/>
              </a-form-item>
            </a-form>
          </a-card>
        </a-tab-pane>

        <a-tab-pane key="backup" tab="备份与诊断">
          <div class="settings-grid">
            <a-card title="本地备份与恢复" size="small">
              <div class="backup-card">
                <div class="backup-card__intro">
                  `0.1` 预览版先补正式的本地备份能力，避免项目、报告、收藏和设置只能依赖浏览器存储或 SQLite 临时状态。
                </div>
                <div class="backup-card__actions">
                  <a-button type="primary" :loading="backupBusy" @click="exportBackup">
                    <template #icon><CloudDownloadOutlined /></template>导出本地备份
                  </a-button>
                  <a-button :loading="backupBusy" @click="triggerBackupImport">
                    <template #icon><UploadOutlined /></template>导入备份
                  </a-button>
                </div>
                <input
                  ref="backupFileInputRef"
                  type="file"
                  accept=".json,application/json"
                  class="backup-file-input"
                  @change="handleBackupImport"
                />
                <div class="field-tip">
                  导出内容包括：系统设置、默认单位、收藏、最近计算、表单草稿、项目、报告，以及当前可读取到的 SQLite 工作流对象。
                </div>
                <div class="backup-card__notice">
                  导入策略：按记录 ID 合并并覆盖同名对象，适合迁移和恢复；预览版不会主动删除当前数据库中备份之外的旧记录。
                </div>
                <div class="backup-card__meta">
                  <span>格式：JSON</span>
                  <span>版本：{{ APP_VERSION }}</span>
                  <span>发布级别：{{ APP_RELEASE_LABEL }}</span>
                </div>
              </div>
            </a-card>

            <a-card title="运行诊断" size="small" :loading="diagnosticsLoading">
              <div class="diagnostics-card">
                <div class="diagnostics-card__actions">
                  <a-button size="small" @click="refreshDiagnostics">
                    <template #icon><ReloadOutlined /></template>刷新状态
                  </a-button>
                  <a-button size="small" @click="copyDiagnostics">
                    <template #icon><CopyOutlined /></template>复制诊断摘要
                  </a-button>
                </div>

                <div v-if="diagnostics" class="diagnostics-summary">
                  <div class="diagnostics-summary__item">
                    <div class="diagnostics-summary__label">应用版本</div>
                    <div class="diagnostics-summary__value">{{ diagnostics.snapshot.app.version }}</div>
                    <div class="diagnostics-summary__hint">{{ diagnostics.snapshot.app.releaseLabel }}</div>
                  </div>
                  <div class="diagnostics-summary__item">
                    <div class="diagnostics-summary__label">标准版本集</div>
                    <div class="diagnostics-summary__value">{{ diagnostics.snapshot.dataVersion.length }}</div>
                    <div class="diagnostics-summary__hint">当前已加载的数据版本条目</div>
                  </div>
                  <div class="diagnostics-summary__item">
                    <div class="diagnostics-summary__label">本地项目</div>
                    <div class="diagnostics-summary__value">{{ diagnostics.localCounts.projects }}</div>
                    <div class="diagnostics-summary__hint">本地工作区与项目壳</div>
                  </div>
                  <div class="diagnostics-summary__item">
                    <div class="diagnostics-summary__label">工作流桥接</div>
                    <div class="diagnostics-summary__value">{{ diagnostics.workflowCounts ? '已连接' : '不可用' }}</div>
                    <div class="diagnostics-summary__hint">SQLite / IPC 运行状态</div>
                  </div>
                </div>

                <a-descriptions v-if="diagnostics" size="small" :column="1" bordered class="diagnostics-descriptions">
                  <a-descriptions-item label="最近页面">
                    {{ diagnostics.snapshot.local.lastVisitedRoute || '未记录' }}
                  </a-descriptions-item>
                  <a-descriptions-item label="当前单位制">
                    {{ diagnostics.snapshot.local.unit === 'inch' ? '英制 (inch)' : '公制 (mm)' }}
                  </a-descriptions-item>
                  <a-descriptions-item label="本地记录计数">
                    <a-space wrap>
                      <a-tag v-for="tag in localRecordTags" :key="tag">{{ tag }}</a-tag>
                    </a-space>
                  </a-descriptions-item>
                  <a-descriptions-item label="工作流计数">
                    <a-space v-if="workflowRecordTags.length" wrap>
                      <a-tag v-for="tag in workflowRecordTags" :key="tag" color="blue">{{ tag }}</a-tag>
                    </a-space>
                    <span v-else>当前环境未启用工作流桥接</span>
                  </a-descriptions-item>
                  <a-descriptions-item label="标准数据版本">
                    <a-space v-if="dataVersionTags.length" wrap>
                      <a-tag v-for="tag in dataVersionTags" :key="tag" color="geekblue">
                        <DatabaseOutlined />
                        {{ tag }}
                      </a-tag>
                    </a-space>
                    <span v-else>未读取到标准版本信息</span>
                  </a-descriptions-item>
                </a-descriptions>
              </div>
            </a-card>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 1120px;
  margin: 0 auto;
}

.settings-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
}

.settings-summary__tag {
  margin-inline-end: 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field-tip {
  margin-top: 4px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.6;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.theme-card {
  border: 1px solid var(--content-border);
  border-radius: 16px;
  background: var(--surface-base);
  padding: 14px;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
}

.theme-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-strong);
}

.theme-card.is-active {
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

.theme-card__swatches {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.theme-card__swatch {
  width: 100%;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.theme-card__content {
  display: grid;
  gap: 6px;
}

.theme-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-weight: 700;
}

.theme-card__description {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.theme-card__check {
  margin-left: auto;
  color: var(--accent);
}

.theme-tip {
  margin-top: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.backup-card,
.diagnostics-card {
  display: grid;
  gap: 14px;
}

.backup-card__intro,
.backup-card__notice {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.backup-card__notice {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--content-border);
  background: color-mix(in srgb, var(--accent-soft) 60%, var(--surface-base));
}

.backup-card__actions,
.diagnostics-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.backup-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.backup-file-input {
  display: none;
}

.diagnostics-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.diagnostics-summary__item {
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--content-border);
  background: var(--surface-base);
  box-shadow: var(--shadow-soft);
}

.diagnostics-summary__label {
  color: var(--text-tertiary);
  font-size: 12px;
}

.diagnostics-summary__value {
  margin-top: 8px;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 700;
}

.diagnostics-summary__hint {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.diagnostics-descriptions :deep(.ant-descriptions-item-label) {
  width: 160px;
}

@media (max-width: 960px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .diagnostics-summary {
    grid-template-columns: 1fr;
  }
}
</style>
