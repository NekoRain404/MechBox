import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { buildRequiredArtifacts, getReleaseMetadata } from './release-config.mjs'

const rootDir = resolve(import.meta.dirname, '../..')
const releaseDir = join(rootDir, 'release')
const manifestPath = join(releaseDir, 'release-manifest.json')
const checksumsPath = join(releaseDir, 'SHA256SUMS.txt')

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

if (!existsSync(manifestPath)) fail(`缺少发布清单: ${manifestPath}`)
if (!existsSync(checksumsPath)) fail(`缺少校验文件: ${checksumsPath}`)

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const metadata = getReleaseMetadata()
const { appName, license, pkg, productName, releaseDate, releaseLabel, rulesetVersion } = metadata

const checksums = new Map()
for (const line of readFileSync(checksumsPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [checksum, relativePath] = line.split(/\s{2,}/)
  if (checksum && relativePath) {
    checksums.set(relativePath.trim(), checksum.trim())
  }
}

if (manifest.version !== pkg.version) {
  fail(`发布清单版本与 package.json 不一致: ${manifest.version} !== ${pkg.version}`)
}

if (manifest.appName !== appName) {
  fail(`发布清单 appName 不一致: ${manifest.appName} !== ${appName}`)
}

if (manifest.productName !== productName) {
  fail(`发布清单 productName 不一致: ${manifest.productName} !== ${productName}`)
}

if (releaseLabel && manifest.releaseLabel !== releaseLabel) {
  fail(`发布清单 releaseLabel 不一致: ${manifest.releaseLabel} !== ${releaseLabel}`)
}

if (releaseDate && manifest.releaseDate !== releaseDate) {
  fail(`发布清单 releaseDate 不一致: ${manifest.releaseDate} !== ${releaseDate}`)
}

if (license && manifest.license !== license) {
  fail(`发布清单 license 不一致: ${manifest.license} !== ${license}`)
}

if (rulesetVersion && manifest.rulesetVersion !== rulesetVersion) {
  fail(`发布清单 rulesetVersion 不一致: ${manifest.rulesetVersion} !== ${rulesetVersion}`)
}

if (!Array.isArray(manifest.requiredArtifacts) || manifest.requiredArtifacts.length === 0) {
  fail('发布清单缺少 requiredArtifacts')
}

if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
  fail('发布清单缺少 artifacts')
}

if (typeof manifest.releaseProfile !== 'string' || !manifest.releaseProfile) {
  fail('发布清单缺少 releaseProfile')
}

const expectedRequiredArtifacts = buildRequiredArtifacts(metadata, manifest.releaseProfile)
if (expectedRequiredArtifacts.join('|') !== manifest.requiredArtifacts.join('|')) {
  fail('发布清单 requiredArtifacts 与 releaseProfile 不一致')
}

for (const artifactName of manifest.requiredArtifacts) {
  const artifactPath = join(releaseDir, artifactName)
  if (!existsSync(artifactPath)) {
    fail(`缺少必需产物: ${artifactName}`)
  }
}

const digestFile = (filePath) => {
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return hash.digest('hex')
}

for (const artifact of manifest.artifacts) {
  const absolutePath = join(rootDir, artifact.relativePath)
  if (!existsSync(absolutePath)) {
    fail(`发布清单中的产物不存在: ${artifact.relativePath}`)
  }

  const stats = statSync(absolutePath)
  if (artifact.sizeBytes !== stats.size) {
    fail(`产物大小不一致: ${artifact.relativePath} 清单=${artifact.sizeBytes} 实际=${stats.size}`)
  }

  const expectedChecksum = checksums.get(artifact.relativePath)
  if (expectedChecksum) {
    const actualChecksum = digestFile(absolutePath)
    if (artifact.sha256 !== expectedChecksum) {
      fail(`发布清单校验值不一致: ${artifact.relativePath}`)
    }
    if (actualChecksum !== expectedChecksum) {
      fail(`产物校验失败: ${artifact.relativePath}`)
    }
  }
}

const manifestArtifactNames = new Set(manifest.artifacts.map((item) => basename(item.relativePath)))
for (const artifactName of manifest.requiredArtifacts) {
  if (!manifestArtifactNames.has(artifactName)) {
    fail(`发布清单未列出必需产物: ${artifactName}`)
  }
}

console.log('发布资产校验通过')
