import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import {
  APP_META_PATH,
  ROOT_DIR,
  RELEASE_PROFILES,
  buildRequiredArtifacts,
  getReleaseMetadata,
  parseReleaseProfile,
} from './release-config.mjs'

const fail = (message) => {
  console.error(`预检失败: ${message}`)
  process.exit(1)
}

const warn = (message) => {
  console.warn(`预检警告: ${message}`)
}

const ensureCommand = (command) => {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore', shell: process.env.SHELL || '/bin/bash' })
  } catch {
    fail(`缺少命令: ${command}`)
  }
}

const ensurePath = (relativePath) => {
  const absolutePath = join(ROOT_DIR, relativePath)
  if (!existsSync(absolutePath)) {
    fail(`缺少必需文件: ${relativePath}`)
  }
}

const profile = parseReleaseProfile()
const metadata = getReleaseMetadata()
const { pkg } = metadata
const appMetaSource = readFileSync(APP_META_PATH, 'utf8')

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
if (Number.isNaN(nodeMajor) || nodeMajor < 20) {
  fail(`Node.js 版本过低: ${process.versions.node}，要求 >= 20`)
}

const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim()
const npmMajor = Number.parseInt(npmVersion.split('.')[0] ?? '0', 10)
if (Number.isNaN(npmMajor) || npmMajor < 11) {
  fail(`npm 版本过低: ${npmVersion}，要求 >= 11`)
}

for (const command of ['node', 'npm', 'python3', 'rg']) {
  ensureCommand(command)
}

if (profile.targets.includes('linux')) {
  for (const command of ['ar', 'bsdtar', 'ss', 'timeout']) {
    ensureCommand(command)
  }
}

for (const file of [
  'electron.vite.config.ts',
  'README.md',
  'LICENSE',
  'DOC/schema_v3.sql',
  'DOC/seed_sources_v3.sql',
  'data/materials-extended.json',
  'data/standards/o-ring/as568.json',
  'resources/icons/app/icon.ico',
  'resources/icons/app/icon.png',
  'resources/icons/app/icon.svg',
  'src/shared/app-meta.ts',
  'tests/utils/csv.test.ts',
]) {
  ensurePath(file)
}

for (const legacyFile of ['electron-vite.config.ts', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc']) {
  if (existsSync(join(ROOT_DIR, legacyFile))) {
    fail(`检测到不应继续保留的旧文件: ${legacyFile}`)
  }
}

if (!appMetaSource.includes(`APP_VERSION = '${pkg.version}'`)) {
  fail('src/shared/app-meta.ts 中未同步 package.json 版本号')
}

const gitStatus = execSync('git status --short --untracked-files=all', {
  cwd: ROOT_DIR,
  encoding: 'utf8',
}).trim()

if (gitStatus) {
  const dirtyCount = gitStatus.split('\n').filter(Boolean).length
  warn(`当前工作树不是干净状态，共 ${dirtyCount} 条变更；发版前建议完成提交或再次复核`)
}

const requiredArtifacts = buildRequiredArtifacts(metadata, profile.name)

console.log('发布预检通过')
console.log(`- 版本: ${pkg.version}`)
console.log(`- 配置: ${profile.name} (${RELEASE_PROFILES[profile.name].title})`)
console.log(`- 目标: ${profile.targets.join(', ')}`)
console.log(`- 必需产物: ${requiredArtifacts.join(', ')}`)
console.log(`- npm: ${npmVersion}`)
console.log(`- node: ${process.versions.node}`)
