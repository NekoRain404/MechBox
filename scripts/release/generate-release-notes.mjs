import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { RELEASE_DIR, RELEASE_PROFILES, getReleaseMetadata, parseReleaseProfile } from './release-config.mjs'

const manifestPath = join(RELEASE_DIR, 'release-manifest.json')
const checksumPath = join(RELEASE_DIR, 'SHA256SUMS.txt')
const outputPath = join(RELEASE_DIR, 'RELEASE_NOTES.md')
const metadata = getReleaseMetadata()

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const hasProfileArg = process.argv.slice(2).some((arg) => arg.startsWith('--profile='))
const profile = hasProfileArg
  ? parseReleaseProfile()
  : RELEASE_PROFILES[manifest.releaseProfile] ?? parseReleaseProfile()

if (manifest.releaseProfile !== profile.name) {
  throw new Error(`发布说明生成配置与 manifest 不一致: ${profile.name} !== ${manifest.releaseProfile}`)
}

const checksumMap = new Map()

for (const line of readFileSync(checksumPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [checksum, relativePath] = line.split(/\s{2,}/)
  if (checksum && relativePath) {
    checksumMap.set(relativePath.trim(), checksum.trim())
  }
}

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`
}

const findRequiredArtifact = (suffix) =>
  basename(manifest.requiredArtifacts.find((item) => item.endsWith(suffix)) ?? '')

const artifactLines = manifest.artifacts
  .filter((artifact) => manifest.requiredArtifacts.includes(artifact.filename))
  .map((artifact) => {
    const checksum = artifact.filename === 'SHA256SUMS.txt'
      ? '不适用（校验清单自身不参与自引用校验）'
      : checksumMap.get(artifact.relativePath) ?? artifact.sha256 ?? '未生成'
    const checksumCell = checksum.startsWith('不适用') ? checksum : `\`${checksum}\``
    return `| ${artifact.filename} | ${artifact.kind} | ${formatSize(artifact.sizeBytes)} | ${checksumCell} |`
  })
  .join('\n')

const installGuide = profile.name === 'linux-preview'
  ? [
      '## Linux 安装',
      '',
      '### AppImage',
      '',
      '```bash',
      `chmod +x "${findRequiredArtifact('.AppImage')}"`,
      `./"${findRequiredArtifact('.AppImage')}"`,
      '```',
      '',
      '### Debian / Ubuntu',
      '',
      '```bash',
      `sudo apt install ./"${findRequiredArtifact('.deb')}"`,
      '```',
      '',
      '说明：当前 0.1 预览版验收主线为 Linux，Windows 构建暂不作为本轮发布阻塞项。',
    ]
  : [
      '## 安装',
      '',
      '按对应平台使用安装包或可执行文件安装/运行。',
      '',
      '说明：当前清单为全量预览构建，包含 Windows 与 Linux 产物。',
    ]

const content = [
  `# ${metadata.appName} ${manifest.version} 发布说明`,
  '',
  `- 发布标签：${manifest.releaseLabel}`,
  `- 发布日期：${manifest.releaseDate ?? '未标注'}`,
  `- 发布配置：${manifest.releaseProfile} / ${manifest.releaseProfileTitle}`,
  `- 目标平台：${manifest.releaseTargets.join(', ')}`,
  `- 协议：${metadata.licenseName ?? manifest.license}`,
  `- 规则集：${manifest.rulesetVersion ?? metadata.rulesetVersion ?? '未标注'}`,
  '',
  '## 本次范围',
  '',
  `${manifest.releaseProfileDescription}`,
  '',
  '当前发布说明由脚本自动生成，适合用于预览版附件、内部验收记录和 GitHub Release 草稿。',
  '',
  '## 产物清单',
  '',
  '| 文件 | 类型 | 大小 | SHA256 |',
  '| --- | --- | ---: | --- |',
  artifactLines,
  '',
  ...installGuide,
  '',
  '## 验收命令',
  '',
  '```bash',
  profile.name === 'linux-preview'
    ? 'npm run release:acceptance:linux'
    : 'npm run release:verify && npm run dist:preview && npm run release:verify:assets',
  '```',
  '',
].join('\n')

writeFileSync(outputPath, `${content}\n`, 'utf8')
console.log(`已生成发布说明: ${outputPath}`)
