# MechBox

MechBox 是一个面向机械设计与标准件查询的离线桌面工具箱，基于 Electron、Vue 3、TypeScript 和 SQLite 构建。项目目标是把常用机械计算、标准数据查询、工程报告与本地工作流集中到一个可离线运行的桌面应用中。

- 当前版本：`0.1.0-preview.2`
- 当前发布目标：Linux 预览版
- 许可证：GPL-3.0-only

`0.1` 是首个预览版本，适合试用、内测和发布流程验证。部分计算模型仍属于工程筛查或辅助选型级别，不能替代正式设计校核、企业规范审核或第三方认证。

## 当前能力

- 离线桌面应用：应用数据和标准数据默认保存在本机，不依赖云端服务。
- 本地 SQLite 数据库：随应用初始化基础 schema 与种子数据。
- 标准件与材料数据：包含 O 形圈、轴承、螺栓、键、螺纹、公差、材料扩展数据等基础数据集。
- 常用机械计算：覆盖密封、轴承、螺栓、齿轮、轴、弹簧、液压缸、传动、单位换算、公差栈等模块。
- 工作流工具：包含项目中心、收藏、报告、BOM 导出、CSV 结构化导入、参数扫描、蒙特卡洛分析等页面。
- 本地备份与诊断：设置页支持导出/导入本地备份 JSON，并汇总版本、数据版本与工作流诊断信息。
- 本地 CAD 同步端口：应用运行时会启动本地 WebSocket 服务，默认监听 `127.0.0.1:8321`。
- Linux 发布链：支持生成 AppImage 与 Debian 包，并包含包内容校验、资产校验和 AppImage 烟测。

## 明确边界

- `0.1` 版本优先保证基础工具可用、可构建、可打包、可验证。
- Windows 和 macOS 不是当前发布验收主线，本轮仅确认 Linux 预览包。
- 标准库还不是完整工业数据库，后续会继续补数据、补来源、补版本标记。
- CSV 是当前结构化导入的正式支持格式，旧的 Excel 模板导入能力已从发布链中收敛。
- 所有计算结果都应结合企业规范、标准原文、人工复核和实际工况判断。

## 仓库结构

公开仓库按“可构建源码仓库”收口，只保留构建、运行和二次开发所需内容。

```text
MechBox/
├── DOC/
│   ├── schema_v3.sql              # 运行必需数据库 schema
│   └── seed_sources_v3.sql        # 运行必需种子数据来源
├── data/                          # 本地标准数据与材料数据
├── resources/icons/app/           # 应用打包图标
├── rust-core/                     # 预留 Rust 原生计算核心
├── scripts/
│   ├── init_v3_db.py              # 数据库初始化脚本
│   └── release/                   # 发布、验收、校验脚本
├── src/
│   ├── main/                      # Electron 主进程与本地服务
│   ├── preload/                   # Electron preload
│   ├── renderer/                  # Vue 渲染层与计算页面
│   └── shared/                    # 主进程/渲染层共享元数据与工具
├── tests/                         # 计算引擎与工具测试
├── electron.vite.config.ts        # Electron + Vite 配置
├── package.json                   # npm 脚本与 electron-builder 配置
└── README.md
```

以下内容默认不进入公开源码范围或源码归档：

- `release/` 发布产物
- `out/` 构建产物
- `node_modules/`
- 本地数据库文件
- 开发过程文档
- 本地模板与临时导出文件

## 环境要求

- Node.js 20+
- npm 11+
- Python 3
- Linux 验收脚本依赖：`rg`、`bsdtar`、`ar`、`ss`、`timeout`

当前项目统一使用 npm。不要混用 pnpm/yarn 锁文件。

## 开发运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

类型检查与测试：

```bash
npm run release:verify:checks
```

完整构建验证：

```bash
npm run release:verify
```

## Linux 预览版发布

当前 `0.1` 的主要发布链是 Linux。

发布前预检：

```bash
npm run release:preflight:linux
```

仓库公开范围审计：

```bash
npm run release:repo:audit
```

源码归档范围校验：

```bash
npm run release:source:check
```

版本一致性校验：

```bash
npm run release:version:check
```

生产依赖安全审计：

```bash
npm run release:audit
```

生成 GitHub Release 草稿：

```bash
npm run release:github:draft
```

发布就绪检查：

```bash
npm run release:ready:check
```

构建 Linux 预览产物：

```bash
npm run dist:preview:linux
```

校验发布资产：

```bash
npm run release:verify:assets
```

校验 Linux 包内容：

```bash
npm run release:verify:linux-packages
```

执行 AppImage 烟测：

```bash
npm run release:smoke:linux
```

一键执行当前 Linux 发布验收链：

```bash
npm run release:acceptance:linux
```

CI 无显示环境执行当前 Linux 发布验收链：

```bash
npm run release:acceptance:linux:ci
```

该命令会依次执行：

```text
仓库审计 -> 源码归档校验 -> 版本一致性校验 -> 生产依赖安全审计 -> Linux 预检 -> 类型检查/测试 -> Linux 打包 -> 发布资产校验 -> Linux 包内容校验 -> AppImage 烟测
```

生成产物位于 `release/`：

- `MechBox-0.1.0-preview.2.AppImage`
- `mechbox_0.1.0-preview.2_amd64.deb`
- `latest-linux.yml`
- `SHA256SUMS.txt`
- `release-manifest.json`
- `RELEASE_NOTES.md`
- `GITHUB_RELEASE.md`

## 发布脚本说明

- `release:repo:audit`：检查公开仓库范围，识别不应继续保留的历史文件，并验证 `.gitattributes` 的源码归档排除规则。
- `release:source:check`：基于 `git archive --worktree-attributes` 校验源码归档内容，确认必需源码仍在、旧包管理文件和开发过程文档不会进入源码包。
- `release:version:check`：校验 `package.json`、`package-lock.json`、`src/shared/app-meta.ts`、`README.md` 和已生成发布清单中的版本、协议、产物名称和直接依赖版本是否一致。
- `release:audit`：执行 `npm audit --omit=dev`，只审计实际进入生产发布面的依赖。
- `release:github:draft`：基于 `release-manifest.json` 与 `RELEASE_NOTES.md` 生成 GitHub Release 草稿和 `gh release create` 命令。
- `release:ready:check`：检查工作树、版本标签、发布清单、校验文件、发布说明和 GitHub Release 草稿是否共同指向同一版 0.1 预览产物。
- `release:preflight:linux`：固定按 Linux 预览配置检查 Node/npm 版本、命令依赖、关键资源文件和旧配置文件。
- `dist:preview:linux`：清理旧发布产物，构建 AppImage 与 deb，并生成校验文件、发布清单和发布说明。
- `release:verify:assets`：校验 `release-manifest.json`、`SHA256SUMS.txt` 与实际文件大小、哈希值是否一致。
- `release:verify:linux-packages`：检查 AppImage 和 deb 中的桌面文件、图标、SQL、标准数据、SQLite 数据库和 Debian 控制信息。
- `release:smoke:linux`：实际拉起 AppImage，检查窗口加载、数据库初始化、CAD 同步端口和单实例行为。
- `release:acceptance:linux:ci`：为 GitHub Actions 等无显示环境设置 `xvfb` 与 `APPIMAGE_EXTRACT_AND_RUN=1` 后执行 Linux 验收链。

设置页中的“备份与诊断”标签页可用于：

- 导出当前本地设置、收藏、最近计算、项目、报告和可读取的工作流数据快照。
- 导入历史备份并恢复核心状态，预览版当前采用“按 ID 合并/覆盖”的恢复策略。
- 复制运行诊断摘要，用于发布前自检、问题复现和用户支持。

## GitHub Actions

- `CI`：在 `main` push、pull request 和手动触发时执行仓库审计、源码归档校验、版本一致性校验、生产依赖审计、类型检查、测试和生产构建。
- `Linux Preview Release`：在 `v*-preview.*` tag push 或手动触发时构建 Linux 预览包、执行 AppImage 烟测、校验发布就绪状态、上传 workflow artifacts；tag 触发时会发布 GitHub prerelease 并挂载 Linux 产物。

## 数据与数据库

运行必需 SQL 文件：

- `DOC/schema_v3.sql`
- `DOC/seed_sources_v3.sql`

标准数据目录：

- `data/materials-extended.json`
- `data/standards/o-ring/as568.json`
- `data/standards/threads/iso-metric.json`
- `data/standards/bearings/deep-groove.json`
- `data/standards/bolts/hex-bolts.json`
- `data/standards/keys/parallel-keys.json`
- `data/standards/tolerances/iso286.json`

本地数据库文件属于运行产物，不应提交到 Git。

## 测试

```bash
npm test -- --run
```

当前测试覆盖计算引擎和关键工具函数，包括轴承、螺栓、齿轮、液压、密封、轴强度、求解器、螺纹几何、CSV 工具等。

## 开源协议

本项目采用 GNU General Public License v3.0。

如果你分发修改版或基于本项目的衍生作品，需要继续遵守 GPLv3 的源代码公开和许可证传递要求。当前仓库仅按 GPLv3 发布，不附带商业授权承诺。
