import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import {
  RELEASE_DIR,
  ROOT_DIR,
  buildRequiredArtifacts,
  getReleaseMetadata,
  parseReleaseProfile,
} from './release-config.mjs'

const rootDir = ROOT_DIR
const releaseDir = RELEASE_DIR
const checksumsPath = join(releaseDir, 'SHA256SUMS.txt')
const outputPath = join(releaseDir, 'release-manifest.json')
const profile = parseReleaseProfile()
const metadata = getReleaseMetadata()
const { appName, license, productName, releaseDate, releaseLabel, rulesetVersion, version } = metadata
const requiredArtifacts = buildRequiredArtifacts(metadata, profile.name)

const checksumMap = new Map()
const checksumsText = readFileSync(checksumsPath, 'utf8')
for (const line of checksumsText.split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [checksum, relativePath] = line.split(/\s{2,}/)
  if (checksum && relativePath) {
    checksumMap.set(relativePath.trim(), checksum.trim())
  }
}

const topLevelFiles = readdirSync(releaseDir)
  .map((name) => join(releaseDir, name))
  .filter((path) => path !== outputPath && statSync(path).isFile())

const missingArtifacts = requiredArtifacts.filter((name) => !topLevelFiles.some((path) => basename(path) === name))
if (missingArtifacts.length > 0) {
  console.error(`缺少发布产物: ${missingArtifacts.join(', ')}`)
  process.exit(1)
}

const classifyArtifact = (filename) => {
  if (filename.endsWith('.AppImage')) return 'linux-appimage'
  if (filename.endsWith('.deb')) return 'linux-deb'
  if (filename.endsWith('.blockmap')) return 'windows-blockmap'
  if (filename === `latest.yml`) return 'windows-latest-yml'
  if (filename === `latest-linux.yml`) return 'linux-latest-yml'
  if (filename.endsWith('.exe') && filename.includes('Setup')) return 'windows-installer'
  if (filename.endsWith('.exe')) return 'windows-portable'
  if (filename === 'SHA256SUMS.txt') return 'checksum'
  if (filename === 'release-manifest.json') return 'manifest'
  return extname(filename).replace('.', '') || 'file'
}

const artifacts = topLevelFiles
  .map((absolutePath) => {
    const filename = basename(absolutePath)
    const relativePath = `release/${filename}`
    const stats = statSync(absolutePath)
    return {
      filename,
      relativePath,
      kind: classifyArtifact(filename),
      sizeBytes: stats.size,
      sha256: checksumMap.get(relativePath) ?? null,
    }
  })
  .sort((left, right) => left.filename.localeCompare(right.filename))

const manifest = {
  appName,
  productName,
  version,
  releaseLabel,
  releaseDate,
  license,
  releaseProfile: profile.name,
  releaseProfileTitle: profile.title,
  releaseTargets: profile.targets,
  releaseProfileDescription: profile.description,
  rulesetVersion,
  generatedAt: new Date().toISOString(),
  requiredArtifacts,
  artifacts,
}

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`已生成发布清单: ${outputPath}`)
