import { existsSync, readFileSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { basename, join } from 'node:path'
import { RELEASE_DIR, buildRequiredArtifacts, getReleaseMetadata } from './release-config.mjs'

const args = new Set(process.argv.slice(2))
const allowDirty = args.has('--allow-dirty')
const skipTag = args.has('--skip-tag')

const fail = (message) => {
  console.error(`发布就绪校验失败: ${message}`)
  process.exit(1)
}

const readText = (path) => readFileSync(path, 'utf8')
const readJson = (path) => JSON.parse(readText(path))
const ensureFile = (path) => {
  if (!existsSync(path)) {
    fail(`缺少文件: ${path}`)
  }
  if (!statSync(path).isFile()) {
    fail(`不是普通文件: ${path}`)
  }
}

const metadata = getReleaseMetadata()
const tagName = `v${metadata.version}`
const headSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
const shortSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
const gitStatus = execSync('git status --short --untracked-files=all', { encoding: 'utf8' }).trim()

if (gitStatus && !allowDirty) {
  fail('工作树不是干净状态，请先提交或使用 --allow-dirty 做开发态校验')
}

if (!skipTag) {
  let taggedSha = ''
  try {
    taggedSha = execSync(`git rev-list -n 1 ${tagName}`, { encoding: 'utf8' }).trim()
  } catch {
    fail(`缺少版本标签: ${tagName}`)
  }

  if (taggedSha !== headSha) {
    fail(`版本标签未指向当前 HEAD: ${tagName}=${taggedSha.slice(0, 12)} HEAD=${headSha.slice(0, 12)}`)
  }
}

const manifestPath = join(RELEASE_DIR, 'release-manifest.json')
const checksumsPath = join(RELEASE_DIR, 'SHA256SUMS.txt')
const releaseNotesPath = join(RELEASE_DIR, 'RELEASE_NOTES.md')
const githubDraftPath = join(RELEASE_DIR, 'GITHUB_RELEASE.md')

for (const path of [manifestPath, checksumsPath, releaseNotesPath, githubDraftPath]) {
  ensureFile(path)
}

const manifest = readJson(manifestPath)
const checksums = readText(checksumsPath)
const releaseNotes = readText(releaseNotesPath)
const githubDraft = readText(githubDraftPath)

if (manifest.version !== metadata.version) {
  fail(`发布清单版本不一致: ${manifest.version} !== ${metadata.version}`)
}

if (manifest.license !== metadata.license) {
  fail(`发布清单协议不一致: ${manifest.license} !== ${metadata.license}`)
}

if (manifest.releaseProfile !== 'linux-preview') {
  fail(`当前 0.1 就绪检查只接受 linux-preview，实际为: ${manifest.releaseProfile}`)
}

const expectedArtifacts = buildRequiredArtifacts(metadata, 'linux-preview')
if (manifest.requiredArtifacts.join('|') !== expectedArtifacts.join('|')) {
  fail('发布清单 requiredArtifacts 与 linux-preview 配置不一致')
}

const requiredReleaseFiles = [
  ...expectedArtifacts,
  'release-manifest.json',
  'RELEASE_NOTES.md',
  'GITHUB_RELEASE.md',
]

for (const filename of requiredReleaseFiles) {
  ensureFile(join(RELEASE_DIR, filename))
}

for (const artifact of manifest.artifacts) {
  if (!artifact.relativePath.startsWith('release/')) {
    fail(`发布清单 relativePath 非 release 路径: ${artifact.relativePath}`)
  }

  const absolutePath = join(RELEASE_DIR, basename(artifact.relativePath))
  ensureFile(absolutePath)

  if (artifact.sizeBytes !== statSync(absolutePath).size) {
    fail(`发布清单文件大小不一致: ${artifact.relativePath}`)
  }

  if (artifact.sha256 && !checksums.includes(artifact.sha256)) {
    fail(`SHA256SUMS 缺少清单校验值: ${artifact.relativePath}`)
  }
}

for (const filename of expectedArtifacts) {
  if (filename !== 'SHA256SUMS.txt' && !checksums.includes(`release/${filename}`)) {
    fail(`SHA256SUMS 缺少必需产物: ${filename}`)
  }
  if (!releaseNotes.includes(filename)) {
    fail(`RELEASE_NOTES 缺少必需产物: ${filename}`)
  }
  if (!githubDraft.includes(filename)) {
    fail(`GITHUB_RELEASE 草稿缺少必需产物: ${filename}`)
  }
}

for (const text of [metadata.version, tagName, shortSha, metadata.license, metadata.releaseLabel]) {
  if (!githubDraft.includes(text)) {
    fail(`GITHUB_RELEASE 草稿缺少关键字: ${text}`)
  }
}

console.log('发布就绪校验通过')
console.log(`- 标签: ${skipTag ? `${tagName} (跳过标签检查)` : tagName}`)
console.log(`- HEAD: ${shortSha}`)
console.log(`- 版本: ${metadata.version}`)
console.log(`- 产物: ${expectedArtifacts.join(', ')}`)
