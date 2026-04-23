import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, execSync } from 'node:child_process'
import { ROOT_DIR } from './release-config.mjs'

const fail = (message) => {
  console.error(`源码归档校验失败: ${message}`)
  process.exit(1)
}

const warn = (message) => {
  console.warn(`源码归档校验警告: ${message}`)
}

const ensureCommand = (command) => {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore', shell: process.env.SHELL || '/bin/bash' })
  } catch {
    fail(`缺少命令: ${command}`)
  }
}

ensureCommand('git')
ensureCommand('bsdtar')

const gitStatus = execSync('git status --short --untracked-files=all', {
  cwd: ROOT_DIR,
  encoding: 'utf8',
}).trim()

if (gitStatus) {
  warn('当前工作树存在未提交变更，源码归档校验基于 HEAD + worktree attributes，仅验证导出范围规则，不代表未提交新文件已经进入源码包')
}

const tempDir = mkdtempSync(join(tmpdir(), 'mechbox-source-archive-'))
const archivePath = join(tempDir, 'source.tar')

try {
  execFileSync('git', ['archive', '--worktree-attributes', '--format=tar', '-o', archivePath, 'HEAD'], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
  })

  const archiveEntries = execFileSync('bsdtar', ['-tf', archivePath], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const entrySet = new Set(archiveEntries)

  const expectedPresent = [
    'README.md',
    'LICENSE',
    'package.json',
    'electron.vite.config.ts',
    'DOC/schema_v3.sql',
    'DOC/seed_sources_v3.sql',
    'src/main/index.ts',
    'src/renderer/App.vue',
    'data/materials-extended.json',
  ]

  for (const path of expectedPresent) {
    if (!entrySet.has(path)) {
      fail(`源码归档缺少必需文件: ${path}`)
    }
  }

  const expectedAbsent = [
    '.npmrc',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'electron-vite.config.ts',
    'template-bearing.xlsx',
    'release/',
    'DOC/CRITIQUE_AND_IMPROVEMENT.md',
    'DOC/DEV_DOC.md',
    'DOC/IMPROVEMENT_IMPLEMENTATION_REPORT.md',
    'DOC/SQL_DATABASE_SCHEMA.md',
    'DOC/dev.md',
  ]

  for (const path of expectedAbsent) {
    if (path.endsWith('/')) {
      const hasDirectory = archiveEntries.some((entry) => entry === path || entry.startsWith(path))
      if (hasDirectory) {
        fail(`源码归档不应包含目录: ${path}`)
      }
      continue
    }

    if (entrySet.has(path)) {
      fail(`源码归档不应包含文件: ${path}`)
    }
  }

  console.log('源码归档校验通过')
  console.log(`- 归档条目数: ${archiveEntries.length}`)
  console.log(`- 必需文件校验: ${expectedPresent.length}`)
  console.log(`- 排除文件校验: ${expectedAbsent.length}`)
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
