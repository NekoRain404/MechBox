import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { ROOT_DIR } from './release-config.mjs'

const fail = (message) => {
  console.error(`仓库审计失败: ${message}`)
  process.exit(1)
}

const warn = (message) => {
  console.warn(`仓库审计警告: ${message}`)
}

const bannedMatchers = [
  {
    description: '旧 npm 配置文件',
    matches: (file) => file === '.npmrc',
  },
  {
    description: '旧 pnpm 锁定文件',
    matches: (file) => file === 'pnpm-lock.yaml' || file === 'pnpm-workspace.yaml',
  },
  {
    description: '重复 Electron 配置',
    matches: (file) => file === 'electron-vite.config.ts',
  },
  {
    description: '本地模板二进制文件',
    matches: (file) => file === 'template-bearing.xlsx',
  },
  {
    description: 'DOC 下的开发过程文档',
    matches: (file) => file.startsWith('DOC/') && file.endsWith('.md'),
  },
  {
    description: '发布产物目录',
    matches: (file) => file.startsWith('release/'),
  },
  {
    description: '本地资源模板目录',
    matches: (file) => file.startsWith('resources/templates/'),
  },
]

const requiredExportIgnoreRules = [
  'release/ export-ignore',
  '.local/ export-ignore',
  '.qwen/ export-ignore',
  'node_modules/ export-ignore',
  '.npmrc export-ignore',
  'pnpm-lock.yaml export-ignore',
  'pnpm-workspace.yaml export-ignore',
  'electron-vite.config.ts export-ignore',
  'DOC/*.md export-ignore',
  'resources/templates/ export-ignore',
  'template-bearing.xlsx export-ignore',
]

const trackedFiles = execSync('git ls-files', {
  cwd: ROOT_DIR,
  encoding: 'utf8',
})
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const violations = []
const pendingDeletions = []

for (const file of trackedFiles) {
  const matcher = bannedMatchers.find((item) => item.matches(file))
  if (!matcher) continue

  const existsInWorktree = existsSync(join(ROOT_DIR, file))
  if (existsInWorktree) {
    violations.push(`${file} (${matcher.description})`)
  } else {
    pendingDeletions.push(`${file} (${matcher.description})`)
  }
}

if (violations.length > 0) {
  fail(`以下文件仍在公开仓库范围内:\n- ${violations.join('\n- ')}`)
}

if (pendingDeletions.length > 0) {
  warn(`以下历史文件已从工作区移除，但仍需通过提交完成仓库清理:\n- ${pendingDeletions.join('\n- ')}`)
}

const gitattributesPath = join(ROOT_DIR, '.gitattributes')
if (!existsSync(gitattributesPath)) {
  fail('缺少 .gitattributes，无法约束源码归档导出范围')
}

const gitattributes = readFileSync(gitattributesPath, 'utf8')
for (const rule of requiredExportIgnoreRules) {
  if (!gitattributes.includes(rule)) {
    fail(`.gitattributes 缺少 export-ignore 规则: ${rule}`)
  }
}

console.log('仓库审计通过')
console.log(`- 已检查 tracked 文件: ${trackedFiles.length}`)
console.log(`- 待提交删除项: ${pendingDeletions.length}`)
console.log(`- 导出归档规则: ${requiredExportIgnoreRules.length}`)
