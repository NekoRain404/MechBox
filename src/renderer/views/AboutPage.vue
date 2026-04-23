<script setup lang="ts">
/**
 * AboutPage - 关于与版本信息页面
 * 展示产品定位、版本、技术栈和 GPLv3 许可信息。
 */
import { computed, markRaw, ref } from 'vue'
import {
  BookOutlined,
  BugOutlined,
  CodeOutlined,
  GithubOutlined,
  HeartOutlined,
  SafetyOutlined,
  RocketOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'
import {
  APP_LICENSE_NAME,
  APP_LICENSE_SPDX,
  APP_RELEASE_DATE,
  APP_RELEASE_LABEL,
  APP_VERSION,
} from '@shared/app-meta'

const activeTab = ref('about')
const rawIcon = <T extends object>(icon: T) => markRaw(icon)

const version = APP_VERSION
const buildDate = APP_RELEASE_DATE
const electronVersion = '41.x'
const vueVersion = '3.x'
const viteVersion = '6.x'
const licenseName = APP_LICENSE_NAME
const licenseSpdx = APP_LICENSE_SPDX
const repositoryUrl = 'https://github.com/NekoRain404/MechBox'

const changelog = [
  {
    version: `v${APP_VERSION}`,
    date: APP_RELEASE_DATE,
    type: 'preview',
    title: '0.1 预览版发布',
    changes: [
      '建立 Electron + Vue + SQLite 的离线桌面工具箱基础发布面',
      '公差、密封圈、轴承、螺栓、齿轮、弹簧、电机等核心页面可直接使用',
      '项目中心、报告中心、文档中心和收藏工作流已形成第一版闭环',
      '统一来源链、治理标记、公式面板和页面样式，补齐首轮工程化体验',
      '当前版本定义为预览版，适合内测试用与功能收口，不承诺全部模块已达正式定型标准',
    ],
  },
]

const techStack = [
  { category: '运行环境', items: ['Electron 41.x', 'Node.js', 'Vite 6.x'] },
  { category: '前端框架', items: ['Vue 3.x', 'TypeScript 5.x', 'Pinia'] },
  { category: 'UI 组件', items: ['Ant Design Vue 4.x'] },
  { category: '数据存储', items: ['SQLite', 'better-sqlite3', 'JSON 标准数据'] },
  { category: '测试工具', items: ['Vitest', 'vue-tsc'] },
  { category: '导出功能', items: ['jsPDF', 'html2canvas'] },
  { category: '计算引擎', items: ['纯函数计算', '约束求解器', '规则表驱动'] },
]

const standards = [
  { code: 'ISO 286', name: '公差与配合', status: '已接入' },
  { code: 'SAE AS568', name: 'O 型圈尺寸体系', status: '已接入' },
  { code: 'JIS B 2401', name: 'O 型圈尺寸体系', status: '已接入' },
  { code: 'ISO 281', name: '滚动轴承额定寿命', status: '已接入' },
  { code: 'GB/T 5782', name: '六角头螺栓', status: '已接入' },
  { code: 'VDI 2230', name: '螺栓筛查级校核', status: '近似筛查' },
  { code: 'ISO 6336', name: '齿轮筛查级校核', status: '近似筛查' },
]

const highlightCards = computed(() => [
  { label: '桌面端离线运行', value: 'Offline', hint: '无需云端服务即可使用', icon: rawIcon(SafetyOutlined) },
  { label: '标准与规则并行', value: 'Rule-Driven', hint: '标准数据表和推荐规则联动', icon: rawIcon(BookOutlined) },
  { label: '工程计算闭环', value: 'Design Flow', hint: '计算、收藏、项目、报告可串联', icon: rawIcon(RocketOutlined) },
  { label: '开源协议', value: 'GPLv3', hint: '衍生分发需继续开放源代码', icon: rawIcon(CodeOutlined) },
])
</script>

<template>
  <div class="about-page">
    <section class="about-hero">
      <div class="about-hero__brand">
        <div class="about-hero__icon">
          <ToolOutlined />
        </div>
        <div class="about-hero__copy">
          <div class="about-hero__eyebrow">About MechBox</div>
          <h1>为机械设计校核、选型和归档而构建的离线工程工具箱</h1>
          <p>
            MechBox 面向机械工程师，强调可复核的计算过程、可落地的数据结构和
            不依赖网络的现场可用性。当前发布为 {{ APP_RELEASE_LABEL }}，
            已形成基础计算、标准件检索、高级分析和报告整理的一体化工作台。
          </p>
          <div class="about-hero__meta">
            <a-tag color="blue">v{{ version }}</a-tag>
            <a-tag>{{ buildDate }}</a-tag>
            <a-tag color="orange">{{ APP_RELEASE_LABEL }}</a-tag>
            <a-tag color="green">{{ licenseSpdx }}</a-tag>
          </div>
        </div>
      </div>

      <div class="about-hero__highlights">
        <article
          v-for="item in highlightCards"
          :key="item.label"
          class="about-highlight"
        >
          <div class="about-highlight__icon">
            <component :is="item.icon" />
          </div>
          <div class="about-highlight__label">{{ item.label }}</div>
          <div class="about-highlight__value">{{ item.value }}</div>
          <div class="about-highlight__hint">{{ item.hint }}</div>
        </article>
      </div>
    </section>

    <a-tabs v-model:activeKey="activeTab" class="about-tabs">
      <a-tab-pane key="about" tab="关于">
        <div class="about-section-grid">
          <a-card title="产品简介" size="small" class="about-card">
            <p class="about-paragraph">
              这不是单一模块计算器，而是一套围绕机械设计工作流组织的桌面工具：
              从标准件与材料检索，到设计计算、筛查分析、结果留档，再到项目和报告管理。
            </p>

            <a-descriptions bordered size="small" :column="2" class="about-descriptions">
              <a-descriptions-item label="版本">{{ version }}</a-descriptions-item>
              <a-descriptions-item label="构建日期">{{ buildDate }}</a-descriptions-item>
              <a-descriptions-item label="Electron">{{ electronVersion }}</a-descriptions-item>
              <a-descriptions-item label="Vue">{{ vueVersion }}</a-descriptions-item>
              <a-descriptions-item label="Vite">{{ viteVersion }}</a-descriptions-item>
              <a-descriptions-item label="许可证">{{ licenseName }}</a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card title="核心价值" size="small" class="about-card">
            <div class="value-grid">
              <div class="value-card">
                <div class="value-card__title"><RocketOutlined /> 一站式工程桌面</div>
                <p>把高频机械计算、标准数据和结果输出收进同一套本地工作台。</p>
              </div>
              <div class="value-card">
                <div class="value-card__title"><SafetyOutlined /> 离线优先</div>
                <p>适合受限网络、现场调试和对数据隔离有要求的工作环境。</p>
              </div>
              <div class="value-card">
                <div class="value-card__title"><HeartOutlined /> GPLv3 开源</div>
                <p>允许学习、修改和再分发，但分发衍生作品时必须继续开源。</p>
              </div>
              <div class="value-card">
                <div class="value-card__title"><BookOutlined /> 可复核过程</div>
                <p>公式、警告、推荐理由和规则来源尽量显式展示，而不是只给结果。</p>
              </div>
            </div>
          </a-card>
        </div>
      </a-tab-pane>

      <a-tab-pane key="changelog" tab="更新日志">
        <a-card title="版本演进" size="small" class="about-card">
          <a-timeline>
            <a-timeline-item
              v-for="log in changelog"
              :key="log.version"
              :color="log.type === 'major' ? 'blue' : log.type === 'preview' ? 'orange' : 'green'"
            >
              <template #dot>
                <RocketOutlined v-if="log.type === 'major' || log.type === 'preview'" style="font-size: 16px" />
                <BugOutlined v-else style="font-size: 16px" />
              </template>
              <div class="changelog-item">
                <h3>{{ log.version }} <a-tag size="small">{{ log.date }}</a-tag></h3>
                <h4>{{ log.title }}</h4>
                <ul>
                  <li v-for="(change, index) in log.changes" :key="index">{{ change }}</li>
                </ul>
              </div>
            </a-timeline-item>
          </a-timeline>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="tech" tab="技术栈">
        <div class="about-section-grid">
          <a-card title="技术架构" size="small" class="about-card">
            <a-descriptions bordered size="small" :column="1">
              <a-descriptions-item
                v-for="stack in techStack"
                :key="stack.category"
                :label="stack.category"
              >
                <a-space wrap>
                  <a-tag v-for="item in stack.items" :key="item" color="blue">{{ item }}</a-tag>
                </a-space>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card title="当前标准接入状态" size="small" class="about-card">
            <a-table
              :columns="[
                { title: '标准号', dataIndex: 'code', key: 'code', width: '24%' },
                { title: '名称', dataIndex: 'name', key: 'name', width: '46%' },
                { title: '状态', dataIndex: 'status', key: 'status', width: '30%' },
              ]"
              :data-source="standards"
              :pagination="false"
              size="small"
            />
          </a-card>
        </div>
      </a-tab-pane>

      <a-tab-pane key="contributors" tab="贡献">
        <div class="about-section-grid">
          <a-card title="贡献与协作" size="small" class="about-card">
            <a-alert
              message="欢迎围绕机械设计工作流、标准数据库和计算可靠性继续完善本项目。"
              type="info"
              show-icon
              style="margin-bottom: 16px"
            >
              <template #icon>
                <TeamOutlined />
              </template>
            </a-alert>

            <a-descriptions bordered size="small" :column="1">
              <a-descriptions-item label="作者">
                <a-space>
                  <GithubOutlined />
                  <span>NekoRain</span>
                </a-space>
              </a-descriptions-item>
              <a-descriptions-item label="开源协议">
                <a-tag color="green">{{ licenseSpdx }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="仓库">
                <a :href="repositoryUrl" target="_blank">{{ repositoryUrl }}</a>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card title="建议贡献路径" size="small" class="about-card">
            <a-steps direction="vertical" size="small" :current="-1">
              <a-step title="Fork 仓库" description="在 GitHub 上派生仓库并建立自己的开发分支。" />
              <a-step title="实现改动" description="补功能、修逻辑或改善页面，并尽量附带测试。" />
              <a-step title="说明边界" description="如果是筛查级近似模型，要把适用边界写清楚。" />
              <a-step title="提交 PR" description="发起 Pull Request 并说明变更背景、结果和验证方式。" />
            </a-steps>
          </a-card>
        </div>
      </a-tab-pane>

      <a-tab-pane key="license" tab="许可证">
        <a-card :title="licenseName" size="small" class="about-card">
          <a-alert
            message="本项目采用 GPLv3 许可证发布"
            description="你可以自由使用、学习、修改和再分发本程序，但在分发修改版或基于本项目的衍生作品时，必须继续以 GPLv3 方式提供对应源代码与许可证说明。"
            type="info"
            show-icon
            style="margin-bottom: 16px"
          />

          <a-descriptions bordered size="small" :column="1" style="margin-bottom: 16px">
            <a-descriptions-item label="SPDX 标识符">{{ licenseSpdx }}</a-descriptions-item>
            <a-descriptions-item label="许可证版本">GPL v3</a-descriptions-item>
            <a-descriptions-item label="核心义务">分发修改版时继续开源并保留 GPLv3 许可证</a-descriptions-item>
            <a-descriptions-item label="完整文本">
              <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank">GNU GPL v3 官方文本</a>
            </a-descriptions-item>
          </a-descriptions>

          <pre class="license-text">This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

See the GNU General Public License for more details.</pre>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <div class="about-footer">
      <p>Made with <HeartOutlined style="color: var(--danger-text)" /> by Mechanical Engineers, for Mechanical Engineers</p>
      <p class="copyright">© 2026 MechBox Contributors. Licensed under GPLv3.</p>
    </div>
  </div>
</template>

<style scoped>
.about-page {
  display: grid;
  gap: 20px;
}

.about-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.9fr);
  gap: 18px;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid var(--content-border);
  background:
    radial-gradient(circle at top right, var(--app-bg-accent) 0, transparent 26%),
    linear-gradient(135deg, var(--surface-base) 0%, var(--surface-raised) 100%);
  box-shadow: var(--shadow-strong);
}

.about-hero__brand {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 18px;
  align-items: start;
}

.about-hero__icon {
  width: 92px;
  height: 92px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft-strong) 100%);
  color: white;
  font-size: 40px;
  box-shadow: var(--shadow-soft);
}

.about-hero__copy {
  display: grid;
  gap: 12px;
}

.about-hero__eyebrow {
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.about-hero__copy h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.about-hero__copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.8;
}

.about-hero__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.about-hero__highlights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.about-highlight {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--content-border);
  background: var(--surface-base);
  box-shadow: var(--shadow-soft);
}

.about-highlight__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent-soft-strong);
  font-size: 18px;
}

.about-highlight__label {
  margin-top: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}

.about-highlight__value {
  margin-top: 4px;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}

.about-highlight__hint {
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.5;
}

.about-tabs {
  margin-bottom: 8px;
}

.about-section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.about-card {
  border-radius: 18px;
}

.about-paragraph {
  margin: 0 0 16px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.about-descriptions {
  margin-top: 16px;
}

.value-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.value-card {
  padding: 16px;
  border: 1px solid var(--content-border);
  border-radius: 18px;
  background: var(--surface-raised);
}

.value-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
}

.value-card p {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.changelog-item h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--text-primary);
}

.changelog-item h4 {
  margin: 0 0 10px;
  font-size: 15px;
  color: var(--text-secondary);
}

.changelog-item ul {
  margin: 8px 0 0;
  padding-left: 20px;
  color: var(--text-secondary);
}

.changelog-item li + li {
  margin-top: 6px;
}

.license-text {
  background: var(--surface-raised);
  padding: 16px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  font-family: var(--font-mono);
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--content-border);
  color: var(--text-secondary);
}

.about-footer {
  text-align: center;
  padding: 22px 12px 8px;
  border-top: 1px solid var(--grid-line);
  color: var(--text-secondary);
}

.about-footer p {
  margin: 4px 0;
}

.copyright {
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 1100px) {
  .about-hero,
  .about-section-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .about-hero {
    padding: 18px;
    border-radius: 20px;
  }

  .about-hero__brand {
    grid-template-columns: 1fr;
  }

  .about-hero__icon {
    width: 72px;
    height: 72px;
    font-size: 30px;
  }

  .about-hero__highlights,
  .value-grid {
    grid-template-columns: 1fr;
  }
}
</style>
